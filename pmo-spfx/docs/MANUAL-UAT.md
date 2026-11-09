# Manual tenant UAT

Release 1.1.0 must not receive production sign-off until this checklist is executed in the target
tenant. Automated tests validate domain transitions with repositories/fakes; the checks below need
real SharePoint identities, permissions, list indexes, ETags, files, browser behavior, and concurrency.

## Test preparation

Create distinct test users for Employee, Project Manager, QA, Resource Manager, Approver, Finance,
Executive, Time Approver, Support, and Owner. Where applicable, create matching active Employee rows
and eligibility flags. Prepare two projects, overlapping allocations, an eight-hour workday calendar,
effective-dated rates/currencies, a document set, valid/invalid import workbooks, and a second browser
session for conflicts. Capture user, timestamp, input IDs, screenshots, correlation IDs, and pass/fail
for every scenario; never use production-confidential data in evidence.

## BRD acceptance scenarios

| ID     | Scenario and execution                                                             | Expected evidence                                                                   | Tenant users                     |
| ------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------- |
| UAT-01 | Create a project, verify generated code, submit and approve baseline.              | Code unique; original baseline fixed; status permits planning; approval audit.      | Manager, Approver                |
| UAT-02 | Add a team member after skills/availability review with an overlapping allocation. | Warning and allocation are correct; membership acknowledgement retained.            | Resource Manager, Employee       |
| UAT-03 | Create phase, milestone, dependency, task and subtask; validate/submit plan.       | Effort/schedule reconcile to approved baseline; invalid dependencies are blocked.   | Manager, Approver                |
| UAT-04 | Download, complete, validate, and import the Excel template twice.                 | Draft plan matches rows; second attempt is idempotent; approval is not bypassed.    | Manager                          |
| UAT-05 | Import bad type/date/owner/dependency and over-limit rows.                         | Row/field errors; no silent partial plan; batch status/audit visible.               | Manager                          |
| UAT-06 | Assign a task, open as assignee, accept it, then refresh.                          | Accepted status/version/time retained; action record applied once.                  | Manager, Employee                |
| UAT-07 | Return an assignment with a conflict reason.                                       | Manager sees reason; work cannot start until reassigned/resolved.                   | Employee, Manager                |
| UAT-08 | Log eight hours across permitted categories on a working day.                      | Day is complete; task and category rules reconcile.                                 | Employee                         |
| UAT-09 | Leave a working day two hours short.                                               | Day is incomplete and appears in approver/action-center follow-up.                  | Employee, Time Approver          |
| UAT-10 | Submit, return, correct, and approve a time entry.                                 | Original/revised value, reason, actors, timestamps, and versions are retained.      | Employee, Time Approver          |
| UAT-11 | Record progress approaching configured effort threshold.                           | Employee and manager see the configured warning without duplicate actions.          | Employee, Manager                |
| UAT-12 | Request additional task effort within project budget and approve.                  | Current estimate changes; original estimate remains; approval linked/audited.       | Employee, Manager/Approver       |
| UAT-13 | Request effort exceeding project budget.                                           | Full impact is shown and request escalates to PMO approval.                         | Employee, Manager, Approver      |
| UAT-14 | Reject additional effort.                                                          | No approved effort added; reason and decision remain traceable.                     | Approver, Employee               |
| UAT-15 | Submit a task with evidence, review, and accept.                                   | Submission and acceptance times differ; evidence remains linked/versioned.          | Employee, Manager                |
| UAT-16 | Fail QA and create a defect from the task.                                         | Defect links to source task; failed task/release cannot be accepted.                | QA, Manager                      |
| UAT-17 | Start fix, mark ready for retest, and retest.                                      | Fix effort and QA retest result/actors are retained.                                | Employee, QA                     |
| UAT-18 | Approve a release exception for a failed test.                                     | Failed result remains Fail; exception/risk/approver is visible and auditable.       | QA, Approver                     |
| UAT-19 | Create a production defect.                                                        | Release, source task, QA coverage, root cause, and corrective action are linked.    | QA, Manager                      |
| UAT-20 | Forecast delay and effort overrun; publish status.                                 | Baseline, approved current plan, actual, and forecast remain distinct.              | Manager, Executive               |
| UAT-21 | Drill portfolio KPI to project/task evidence.                                      | Totals reconcile; a user without project access is denied.                          | Executive, unauthorized Employee |
| UAT-22 | Drill employee contributions across projects.                                      | Authorized work/time/learning visible; salary/rates never exposed.                  | Resource Manager, Employee       |
| UAT-23 | Synchronize labor cost and calculate margin, then remove a required rate.          | Effective rates/currency used; missing rate is explicit; no invented margin.        | Finance, Manager                 |
| UAT-24 | Assign approved learning, record time, submit validation, validate skill.          | Learning time approval and skill validation are separate, traceable outcomes.       | Resource Manager, Employee       |
| UAT-25 | Complete final report/acceptance/lessons, release team, and close project.         | Final comparison and close audit complete; members released.                        | Manager, Approver                |
| UAT-26 | Attempt closure with a critical open defect, then add authorized exception.        | First closure blocked; exception permits only the governed path.                    | Manager, QA, Approver            |
| UAT-27 | Transfer task ownership after accepted work/time exists.                           | Historic effort stays with original user; new actions use new owner.                | Manager, two Employees           |
| UAT-28 | End-date a cost rate and add a future rate; sync costs across boundary.            | Past cost keeps old rate; future work uses new rate.                                | Finance                          |
| UAT-29 | Deactivate an employee and attempt new assignment.                                 | Assignment blocked; history and reports remain intact.                              | Resource Manager, Manager        |
| UAT-30 | Export financial report as Finance and as ordinary Employee.                       | Finance export succeeds and is audited; Employee is denied before restricted query. | Finance, Employee, Support       |

## Cross-cutting release checks

- Direct-link every registered route as an allowed and denied user; unknown routes show Not Found.
- Run Support diagnostics as Owner and Support. Verify Owner sees all containers, Support does not
  see restricted financial containers, and neither view exposes record content.
- In two sessions edit the same project/time/task row. The stale session must receive a clear conflict
  and must not overwrite the newer row. Throttle a test request if tenant tooling permits and confirm
  only transient failures retry.
- Seed lists above the first SharePoint page and verify indexed filters, continuation paging, report
  1,000-row protection, search, sorting, and export. Confirm no page downloads an entire large list.
- Keyboard-only: reach navigation, tabs, tables, menus, forms, dialogs, panels, and every command;
  confirm logical focus entry/return and no trap. Test accessible names/errors with the supported
  screen reader and Microsoft Accessibility Insights.
- Verify 200% zoom and responsive layout at 1280, 1024, and 768 CSS-pixel widths; test Windows high
  contrast and reduced-motion preference. Confirm chart/status meaning without color.
- Print/PDF a status report and financial report. Navigation/actions must be omitted and content must
  remain readable without clipped critical columns.
- Force a SharePoint 403, 404, 409/412, 429/503, and invalid field response in a non-production site.
  Confirm safe messages, correlation ID, safe retry rules, and functioning root error boundary.
- Inspect the deployed production page/network bundle: no source maps, no debug gallery navigation,
  no console business data, no secrets, and no confidential values in URL/query/history.
- Verify App Catalog deployment, full-width page publication, version 1.1.0 in header/diagnostics,
  backup/versioning/retention evidence, and a documented rollback owner.

## Sign-off

Record tenant/site, package SHA-256, browsers/versions, assistive technology, tester names, execution
dates, failures/defects, retest evidence, and Product Owner/PMO/IT Security approval. Any failed
security, financial, workflow-state, data-loss, or accessibility-critical scenario blocks release.
