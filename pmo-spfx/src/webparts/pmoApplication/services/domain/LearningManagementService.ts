import { PMO_FIELDS as F } from "../../config/sharePointSchema";
import type { IPmoLearningAssignment } from "../../models/domain";
import type {
  EmployeesRepository,
  LearningAssignmentsRepository,
  TimeEntriesRepository,
} from "../repositories/repositories";
import {
  appendValidatedSkill,
  generateRecordCode,
  validateLearningValidation,
} from "./DomainRules";
import { PmoBusinessError } from "./ConfigurationManagementService";
import type { UserCapabilityService } from "./UserCapabilityService";

export interface ILearningDraft {
  readonly employeeId: number;
  readonly title: string;
  readonly skillName: string;
  readonly objective: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly plannedHours: number;
  readonly deliverable: string;
  readonly mentorId?: number;
  readonly evidenceLink?: string;
}
const all = async <T>(
  page: (continuation?: string) => Promise<{
    readonly items: readonly T[];
    readonly continuation?: string;
  }>,
): Promise<T[]> => {
  const values: T[] = [];
  let continuation: string | undefined;
  do {
    const result = await page(continuation);
    values.push(...result.items);
    continuation = result.continuation;
  } while (continuation);
  return values;
};
const parse = (value: string): Date => new Date(`${value}T00:00:00`);

export class LearningManagementService {
  public constructor(
    private readonly learning: LearningAssignmentsRepository,
    private readonly employees: EmployeesRepository,
    private readonly time: TimeEntriesRepository,
    private readonly capabilities: UserCapabilityService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async mine(): Promise<readonly IPmoLearningAssignment[]> {
    const actor = await this.requireEmployee();
    return all((continuation) =>
      this.learning.getForEmployee(actor.id, continuation),
    );
  }

  public async awaitingValidation(): Promise<
    readonly IPmoLearningAssignment[]
  > {
    await this.requireManager();
    return all((continuation) =>
      this.learning.getAwaitingValidation(continuation),
    );
  }

  public async save(
    draft: ILearningDraft,
    existing?: IPmoLearningAssignment,
  ): Promise<IPmoLearningAssignment> {
    await this.requireManager();
    const employee = await this.employees.getById(draft.employeeId);
    if (!employee.isActive || employee.employmentStatus !== "Active")
      throw new PmoBusinessError("assignment", "Select an active employee.");
    if (
      !draft.title.trim() ||
      !draft.skillName.trim() ||
      !draft.objective.trim() ||
      !draft.deliverable.trim()
    )
      throw new PmoBusinessError(
        "validation",
        "Topic, skill, objective and deliverable are required.",
      );
    if (
      draft.plannedHours <= 0 ||
      parse(draft.endDate) < parse(draft.startDate)
    )
      throw new PmoBusinessError(
        "validation",
        "Use positive planned hours and a valid date range.",
      );
    const values = {
      [F.learningAssignments.Title]: draft.title.trim(),
      [F.learningAssignments.EmployeeId]: employee.id,
      [`${F.learningAssignments.EmployeeUser}Id`]: employee.user.id,
      [F.learningAssignments.SkillName]: draft.skillName.trim(),
      [F.learningAssignments.Objective]: draft.objective.trim(),
      [F.learningAssignments.StartDate]: parse(draft.startDate).toISOString(),
      [F.learningAssignments.EndDate]: parse(draft.endDate).toISOString(),
      [F.learningAssignments.PlannedHours]: draft.plannedHours,
      [F.learningAssignments.Deliverable]: draft.deliverable.trim(),
      [`${F.learningAssignments.Mentor}Id`]: draft.mentorId ?? null,
      [F.learningAssignments.EvidenceLink]: draft.evidenceLink?.trim() || null,
      [F.learningAssignments.Status]: existing?.status ?? "Assigned",
    };
    const saved = existing
      ? await this.learning.update(existing.id, values, existing.etag)
      : await this.learning.create({
          ...values,
          [F.learningAssignments.ActualHours]: 0,
        });
    return existing
      ? saved
      : this.learning.update(
          saved.id,
          {
            [F.learningAssignments.LearningNumber]: generateRecordCode(
              "Learning",
              saved.id,
              saved.created ?? this.now(),
            ),
          },
          saved.etag,
        );
  }

  public async submitEvidence(
    assignment: IPmoLearningAssignment,
    evidenceLink: string,
  ): Promise<IPmoLearningAssignment> {
    const actor = await this.requireEmployee();
    if (assignment.employeeId !== actor.id)
      throw new PmoBusinessError(
        "authorization",
        "You can submit evidence only for your own learning.",
      );
    if (!evidenceLink.trim())
      throw new PmoBusinessError("validation", "Evidence link is required.");
    return this.learning.update(
      assignment.id,
      {
        [F.learningAssignments.EvidenceLink]: evidenceLink.trim(),
        [F.learningAssignments.Status]: "Submitted",
      },
      assignment.etag,
    );
  }

  public async validate(
    assignment: IPmoLearningAssignment,
    result: "Passed" | "Partially Met" | "Not Met",
    comment: string,
    updateSkillSummary: boolean,
  ): Promise<IPmoLearningAssignment> {
    const actor = await this.requireManager();
    const validationErrors = validateLearningValidation(
      assignment.status,
      result,
      comment,
    );
    if (validationErrors.length)
      throw new PmoBusinessError(
        "validation",
        validationErrors[0] ?? "Invalid learning validation.",
      );
    const status = result === "Passed" ? "Validated" : result;
    const validated = await this.learning.update(
      assignment.id,
      {
        [F.learningAssignments.Status]: status,
        [F.learningAssignments.ValidationResult]: result,
        [`${F.learningAssignments.ValidatedBy}Id`]: actor.sharePointUserId,
        [F.learningAssignments.ValidatedOn]: this.now().toISOString(),
        [F.learningAssignments.ValidationComment]: comment.trim(),
      },
      assignment.etag,
    );
    if (updateSkillSummary && result === "Passed") {
      const employee = await this.employees.getById(assignment.employeeId);
      await this.employees.update(
        employee.id,
        {
          [F.employees.SkillsSummary]: appendValidatedSkill(
            employee.skillsSummary,
            assignment.skillName,
          ),
        },
        employee.etag,
      );
    }
    return validated;
  }

  public async refreshActualHours(
    assignment: IPmoLearningAssignment,
  ): Promise<IPmoLearningAssignment> {
    const actor = await this.capabilities.resolveCurrent();
    if (
      actor.employee?.id !== assignment.employeeId &&
      !actor.capabilities.has("resources.manage")
    )
      throw new PmoBusinessError(
        "authorization",
        "You cannot refresh this learning assignment.",
      );
    const entries = await all((continuation) =>
      this.time.getEmployeeRange(
        assignment.employeeId,
        assignment.startDate,
        assignment.endDate,
        continuation,
      ),
    );
    const actualHours = entries
      .filter(
        (entry) =>
          entry.workCategory === "Approved Learning" &&
          ["Submitted", "Approved", "Locked"].indexOf(entry.entryStatus) >= 0,
      )
      .reduce((sum, entry) => sum + entry.hours, 0);
    return this.learning.update(
      assignment.id,
      { [F.learningAssignments.ActualHours]: actualHours },
      assignment.etag,
    );
  }

  private async requireEmployee() {
    const actor = await this.capabilities.resolveCurrent();
    if (!actor.employee)
      throw new PmoBusinessError(
        "authorization",
        "An active employee profile is required.",
      );
    return actor.employee;
  }
  private async requireManager() {
    const actor = await this.capabilities.resolveCurrent();
    if (!actor.capabilities.has("resources.manage"))
      throw new PmoBusinessError(
        "authorization",
        "Only resource managers may manage learning.",
      );
    return actor;
  }
}
