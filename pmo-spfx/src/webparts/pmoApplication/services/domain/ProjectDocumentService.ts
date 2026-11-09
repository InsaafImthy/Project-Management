import { PMO_FIELDS as F } from "../../config/sharePointSchema";
import type { IPmoProjectDocument } from "../../models/domain";
import type { ProjectDocumentsRepository } from "../repositories/repositories";
import { PmoBusinessError } from "./ConfigurationManagementService";
import type {
  IPmoResolvedUserContext,
  UserCapabilityService,
} from "./UserCapabilityService";

export interface IProjectDocumentUpload {
  readonly projectId: number;
  readonly projectCode: string;
  readonly file: File;
  readonly documentType: IPmoProjectDocument["documentType"];
  readonly documentStatus: IPmoProjectDocument["documentStatus"];
  readonly confidentiality: IPmoProjectDocument["confidentiality"];
  readonly workItemId?: number;
  readonly qualityItemId?: number;
  readonly approvalRequestId?: number;
  readonly templateVersion?: string;
}

export const canReadRestrictedDocuments = (
  actor: Pick<IPmoResolvedUserContext, "securityRoles" | "capabilities">,
): boolean =>
  actor.securityRoles.has("owner") ||
  actor.securityRoles.has("executive") ||
  actor.securityRoles.has("finance") ||
  actor.capabilities.has("projects.manage");

export const canOpenProjectDocument = (
  actor: Pick<IPmoResolvedUserContext, "securityRoles" | "capabilities">,
  document: Pick<IPmoProjectDocument, "confidentiality">,
): boolean =>
  document.confidentiality !== "Restricted" ||
  canReadRestrictedDocuments(actor);

/** Project-library boundary. It never uses list attachments or task folders. */
export class ProjectDocumentService {
  public constructor(
    private readonly documents: ProjectDocumentsRepository,
    private readonly capabilities: UserCapabilityService,
    private readonly libraryRootServerRelativeUrl = "/sites/ProjectManagementTool/PMO_ProjectDocuments",
  ) {}

  public async list(
    projectId: number,
    projectCode: string,
    documentType?: IPmoProjectDocument["documentType"],
  ): Promise<readonly IPmoProjectDocument[]> {
    const actor = await this.authorizeProject(projectId);
    const values: IPmoProjectDocument[] = [];
    let continuation: string | undefined;
    do {
      const page = await this.documents.getByProjectCode(
        projectCode,
        continuation,
      );
      values.push(...page.items);
      continuation = page.continuation;
    } while (continuation);
    return values.filter(
      (document) =>
        (!documentType || document.documentType === documentType) &&
        canOpenProjectDocument(actor, document),
    );
  }

  public async upload(
    draft: IProjectDocumentUpload,
  ): Promise<IPmoProjectDocument> {
    const actor = await this.authorizeProject(draft.projectId);
    if (
      draft.confidentiality === "Restricted" &&
      !canReadRestrictedDocuments(actor)
    ) {
      throw new PmoBusinessError(
        "authorization",
        "You cannot upload a restricted project document.",
      );
    }
    if (!draft.file.name.trim()) {
      throw new PmoBusinessError("validation", "Choose a file to upload.");
    }
    const fileName = draft.file.name.replace(/[~#%&*{}\\:<>?/+|\"]/g, "-");
    return this.documents.upload(
      this.libraryRootServerRelativeUrl,
      fileName,
      draft.file,
      {
        [F.projectDocuments.ProjectCode]: draft.projectCode,
        [F.projectDocuments.DocumentType]: draft.documentType,
        [F.projectDocuments.WorkItemId]: draft.workItemId ?? null,
        [F.projectDocuments.QualityItemId]: draft.qualityItemId ?? null,
        [F.projectDocuments.ApprovalRequestId]: draft.approvalRequestId ?? null,
        [F.projectDocuments.DocumentStatus]: draft.documentStatus,
        [F.projectDocuments.Confidentiality]: draft.confidentiality,
        [F.projectDocuments.TemplateVersion]:
          draft.templateVersion?.trim() || null,
      },
    );
  }

  public async assertCanOpen(
    projectId: number,
    document: IPmoProjectDocument,
  ): Promise<string> {
    const actor = await this.authorizeProject(projectId);
    if (!canOpenProjectDocument(actor, document)) {
      throw new PmoBusinessError(
        "authorization",
        "You do not have access to this restricted document.",
      );
    }
    return document.serverRelativeUrl;
  }

  private async authorizeProject(
    projectId: number,
  ): Promise<IPmoResolvedUserContext> {
    const actor = await this.capabilities.resolveCurrent();
    if (
      actor.securityRoles.has("owner") ||
      actor.securityRoles.has("executive") ||
      actor.capabilities.has("projects.view") ||
      actor.capabilities.has("quality.view")
    ) {
      return actor;
    }
    const memberships = await this.capabilities.getProjectMemberships();
    if (
      memberships.some(
        (membership) =>
          membership.projectId === projectId && membership.isActive,
      )
    ) {
      return actor;
    }
    throw new PmoBusinessError(
      "authorization",
      "You do not have access to this project's documents.",
    );
  }
}
