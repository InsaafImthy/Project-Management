import {
  PMO_FIELDS,
  PMO_LIBRARIES,
  PMO_LISTS,
  type PmoContainerName,
} from "../../config/sharePointSchema";
import type { ISharePointClient } from "./SharePointClient";

export interface ISchemaContainerDiagnostic {
  readonly containerName: PmoContainerName;
  readonly exists: boolean;
  readonly expectedFieldCount: number;
  readonly foundFieldCount: number;
  readonly missingFields: readonly string[];
  readonly error?: string;
}

interface IFieldCollectionWire {
  readonly value?: readonly { readonly InternalName: string }[];
  readonly d?: {
    readonly results?: readonly { readonly InternalName: string }[];
  };
}

const encodeODataString = (value: string): string => value.replace(/'/g, "''");

const schemaEntries: readonly [
  PmoContainerName,
  Readonly<Record<string, string>>,
][] = [
  [PMO_LISTS.config, PMO_FIELDS.config],
  [PMO_LISTS.employees, PMO_FIELDS.employees],
  [PMO_LISTS.employeeRates, PMO_FIELDS.employeeRates],
  [PMO_LISTS.projects, PMO_FIELDS.projects],
  [PMO_LISTS.projectFinancials, PMO_FIELDS.projectFinancials],
  [PMO_LISTS.projectMembers, PMO_FIELDS.projectMembers],
  [PMO_LISTS.workItems, PMO_FIELDS.workItems],
  [PMO_LISTS.taskActions, PMO_FIELDS.taskActions],
  [PMO_LISTS.timeEntries, PMO_FIELDS.timeEntries],
  [PMO_LISTS.changeRequests, PMO_FIELDS.changeRequests],
  [PMO_LISTS.approvalRequests, PMO_FIELDS.approvalRequests],
  [PMO_LISTS.risksIssues, PMO_FIELDS.risksIssues],
  [PMO_LISTS.qualityItems, PMO_FIELDS.qualityItems],
  [PMO_LISTS.learningAssignments, PMO_FIELDS.learningAssignments],
  [PMO_LISTS.projectCosts, PMO_FIELDS.projectCosts],
  [PMO_LISTS.projectStatusReports, PMO_FIELDS.projectStatusReports],
  [PMO_LISTS.importBatches, PMO_FIELDS.importBatches],
  [PMO_LIBRARIES.projectDocuments, PMO_FIELDS.projectDocuments],
];

/** Read-only tenant diagnostic. It never reads list items or modifies schema. */
export class SchemaDiagnosticsService {
  public constructor(private readonly client: ISharePointClient) {}

  public async verify(): Promise<readonly ISchemaContainerDiagnostic[]> {
    return Promise.all(
      schemaEntries.map(async ([containerName, fieldRegistry]) => {
        const expectedFields = Array.from(
          new Set(
            Object.keys(fieldRegistry).map(
              (key) => fieldRegistry[key] as string,
            ),
          ),
        );
        try {
          const result = await this.client.getJson<IFieldCollectionWire>(
            `_api/web/lists/getbytitle('${encodeODataString(containerName)}')/fields?$select=InternalName`,
          );
          const actual = new Set(
            (result.value ?? result.d?.results ?? []).map(
              (field) => field.InternalName,
            ),
          );
          const missingFields = expectedFields.filter(
            (field) => !actual.has(field),
          );
          return {
            containerName,
            exists: true,
            expectedFieldCount: expectedFields.length,
            foundFieldCount: expectedFields.length - missingFields.length,
            missingFields,
          };
        } catch (error) {
          return {
            containerName,
            exists: false,
            expectedFieldCount: expectedFields.length,
            foundFieldCount: 0,
            missingFields: expectedFields,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }),
    );
  }
}
