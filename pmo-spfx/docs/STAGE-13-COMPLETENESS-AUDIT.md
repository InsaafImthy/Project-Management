# Stage 13 completeness audit

Release: 1.1.0 / solution 1.1.0.0

This audit maps production routes to their SharePoint-backed domain boundary. The authoritative
direct-link registry is `authorization/routeAuthorization.ts`; navigation is a filtered subset.
Unknown routes render Not Found, and capability failures render Access Denied before a feature page
can issue a query. Domain services repeat command and record-level checks.

| Capability area             | Routes                                                                                                    | Domain services                                                                            | Verification                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Employees and settings      | `employees`, `employee-list`, `employee`, `my-profile`, `settings`, `settings-list`                       | `EmployeeManagementService`, `ConfigurationManagementService`, `PeopleDirectoryService`    | employee, validation, paging, schema/capability tests              |
| Projects, summary and team  | `projects`, `project-list`, `project-onboarding`, `project-overview`, `project-team`, `portfolio`         | `ProjectManagementService`, `MetricsService`, `ResourceManagementService`                  | project-stage, metrics, resource/Stage 08 rules                    |
| Planning and assignments    | `planning-dashboard`, `project-plan`, `my-work`, `task`, `reviews`                                        | `PlanningService`, `WorkManagementService`, `TaskWorkflowService`, `ReviewWorkflowService` | planning, task-workflow, review-workflow tests                     |
| Time accountability         | `my-time`, `time-daily`, `time-weekly`, `time-review`                                                     | `TimeManagementService`                                                                    | Stage 08 rules and workflow tests; tenant calendar UAT             |
| Changes and approvals       | `approvals`, `change-requests`, `change-request`, `approval-queue`, `approval-detail`                     | `ChangeManagementService`, `ApprovalWorkflowService`                                       | approval workflow/components and Stage 08/10 tests                 |
| Risks, issues, blockers     | `risks`, `risk-list`, `risk-detail`; blocker actions in `task`                                            | `RiskManagementService`, `TaskWorkflowService`                                             | Stage 10 and task-workflow tests                                   |
| QA, defects, exceptions     | `quality`, `quality-list`, `quality-detail`, `reviews`                                                    | `QualityGovernanceService`, `ReviewWorkflowService`                                        | Stage 10 rules/components and task routing tests                   |
| Learning and resources      | `resources`, `my-learning`, `learning-manage`                                                             | `ResourceManagementService`, `LearningManagementService`                                   | Stage 08 rules plus tenant UAT                                     |
| Costs and profitability     | `financial-summary`, `employee-rates`, `project-costs`, `project-financials`                              | `FinancialManagementService`, `MetricsService`                                             | Stage 11 financial/security tests                                  |
| Status and closure          | `status-reports`, `status-report-list`, `status-report-editor`, `status-report-detail`, project workspace | `ProjectStatusReportService`, `ClosureReadinessService`, `ProjectManagementService`        | Stage 10/12 tests plus closure tenant UAT                          |
| Role dashboards and reports | `home`, `portfolio`, `reports`                                                                            | `ActionCenterService`, `MetricsService`, `ReportService`                                   | action-center, metrics, Stage 12 and route-security tests          |
| Documents                   | project workspace, task/approval evidence panels                                                          | `ProjectDocumentService`                                                                   | Stage 12 document policy tests plus library UAT                    |
| Excel plan import           | project planning import panel                                                                             | `ExcelImportService`                                                                       | Stage 12 import validation/idempotency tests plus Excel/tenant UAT |
| Support                     | `support-diagnostics`                                                                                     | `SupportDiagnosticsService`                                                                | Stage 13 restricted-container and safe-error tests                 |

## Shared UI audit

Feature pages use the shared page header, content/layout containers, action buttons, data table,
form inputs, validation summary, modal/reason dialog, KPI/summary cards, status badge, and shared
loading/empty/error states. Status is always text-first. Feature modules import shared components;
shared components do not import feature modules. The remaining feature-specific compositions carry
workflow semantics and were not abstracted merely to remove small repetitions.

`ReasonDialog` replaced native browser prompts for project hold/cancel, team removal, review return,
and clarification. The task action form uses the shared select input and its label/error contract.

## Workflow and reliability audit

- Project creation reserves a configuration-backed code through an ETag-guarded sequence and writes
  the financial baseline. Baseline approval rechecks Approver group membership and Employee
  eligibility inside the service.
- Team and plan operations use project-scoped, selected-field queries. Assignment validation checks
  active membership, availability/overlap inputs, effort, schedule, and project budget.
- Task actions are append-only audit records with idempotency keys; transitions are status-controlled.
  Review, QA, blocker, defect, retest, and exception routes preserve source relationships.
- Time validation uses configuration and employee working days. Corrections preserve the prior row
  through SharePoint history/audit fields and status gates.
- Approval decisions recheck security role and eligibility. Additional effort and variations retain
  original baselines and apply approved values only after the valid decision.
- Labor synchronization resolves effective-dated rates and reports missing rates/currency inputs
  instead of inventing cost. Financial repositories are not called by unauthorized report paths,
  and report execution checks type-specific access first.
- Project closure calls a readiness service for open work, time, critical defects, approvals, risks,
  acceptance/status report, and authorized exceptions.
- Repository list reads require selected fields, indexed server filters, an explicit page size, and
  continuation handling. Reports stop at 1,000 filtered rows and require a narrower filter rather
  than downloading an entire list. Tables page rendered results.
- Mutations use ETags where a current record is changed. HTTP 409/412 conflicts are never retried;
  the user receives a stale-data message. Only transient throttling/service failures use bounded
  retry behavior. Validation and authorization failures are not retried.
- Code generation and import use persistent sequence/batch identity and are safe to resume. Import
  validates before commit and records per-row errors; it does not silently partially import invalid
  workbooks.

## Security and support audit

- The previous development administrator identity override has been removed. Capabilities derive
  only from SharePoint groups plus active Employee eligibility.
- Every rendered route is in one authorization registry. Unknown and unauthorized deep links stop
  before feature rendering. Domain commands repeat authorization and state checks.
- Detailed rates/costs are restricted to Owner/Finance/approved Executive roles. A project manager
  receives only the project summary capability. Report filters cannot enumerate another user's
  change/approval records without the matching capability.
- User-safe errors omit SharePoint payloads and retain the correlation ID. No production source uses
  `console`, browser prompt/alert, or business data in a URL/global store.
- Support diagnostics checks effective permissions on list/library metadata without retrieving
  records. Support-only users never probe the three restricted financial containers; Owners check
  all required containers. Failed-action results contain operational metadata only.

## Accessibility and responsive audit

Shared controls provide native/Fluent keyboard behavior, visible labels, associated errors,
screen-reader names for icon actions, focus-managed dialogs/panels, and text equivalents for status
and KPI visuals. Layouts reflow at tablet widths and avoid fixed data-table viewport assumptions.
Global reduced-motion rules suppress nonessential transition/animation, while print rules remove
navigation/actions and expand report content. Tenant UAT must still cover supported browser,
200% zoom, keyboard-only operation, screen reader, high contrast, and print/PDF output.

## Completion boundary

Static analysis, automated workflow tests, and the production bundle verify repository behavior.
They cannot prove tenant group membership, actual list permissions/indexes, retention policy,
SharePoint search timing, or multi-user browser behavior. Those release gates are explicitly listed
in `MANUAL-UAT.md`; production sign-off remains conditional until tenant evidence is recorded.
