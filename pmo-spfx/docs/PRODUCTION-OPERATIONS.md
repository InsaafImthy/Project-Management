# Production operations

## Environment readiness

Use `README-PMO-PROVISIONING.md` at the repository root as the source of truth. Confirm every list,
field internal name, content type, index, group, default configuration row, library folder/metadata
column, versioning setting, and unique key before UAT. The application deliberately does not create
or guess production groups and does not repair permissions automatically.

Open **Support diagnostics** as a PMO Owner. A green connection proves only that the current user
has the effective read/write level expected by the application; it does not expose list records.
Repeat once with a PMO Support user and confirm restricted financial containers are absent.

## Least privilege and direct-list access

Application capabilities come from PMO groups. Project Manager, QA, Resource Manager, and Approver
commands additionally require the matching active Employee eligibility flag. Removing either side
removes the capability after the user's context is refreshed.

SharePoint remains authoritative. If a user can open a list directly and edit rows, they can bypass
UI state controls. Limit list edit access, hide list navigation where appropriate, enable audit and
version history, and monitor direct edits. Do not grant Employees or Support direct access to
`PMO_EmployeeRates`, `PMO_ProjectCosts`, or detailed financial fields. If strict per-project secrecy
is required, configure and test SharePoint item permissions separately before use; the package does
not manufacture item-level permission scopes.

## Routine operation

- Review Support diagnostics for failed Task Actions/Approval Requests and list connectivity.
- Review stale KPI timestamps and refresh the affected page/workflow. A direct-list change can make
  the displayed ETag stale; reload before reapplying a command.
- Keep configuration keys unique and active. Change thresholds with an effective change record and
  run regression UAT for time, effort, margin, and import limits.
- Add rate rows with non-overlapping effective dates. Never overwrite a historic rate used by cost
  synchronization; close its date range and add a future row.
- Deactivate Employee records rather than deleting them so historic task/time/cost attribution is
  retained. Remove group memberships separately when access must end immediately.
- Treat export files as confidential according to their report type. Financial export is capability
  checked but downstream storage and sharing remain the user's responsibility.

## Failed actions and approvals

The diagnostic view exposes IDs, processing status, retry count, timestamp, and correlation/support
reference to authorized Support/Owners. It excludes comments and business payloads. Before retry:

1. Open the source task/request and confirm the intended transition is still legal.
2. Resolve missing permissions, configuration, target record, or validation data.
3. Check SharePoint version history for an already-applied change. Do not recreate the action when
   its idempotency key has succeeded.
4. Retry through the supported feature command when safe. Preserve the correlation ID and row ID in
   the incident record. A 409/412 requires reload/review, not automatic retry.

## Backup, retention, and recovery

The release relies on Microsoft 365 controls: list/library versioning, both recycle-bin stages,
retention labels/policies, audit, and tenant backup/recovery arrangements. Define owners and restore
SLAs outside the package. Test restoration of a list item, document version, and configuration row
in a non-production site. Preserve Task Actions, approvals, time, rate history, and project baselines
for the organization's required audit period.

Before upgrading, export configuration and schema evidence, retain the currently deployed `.sppkg`
and checksum, and take a tenant-approved recovery point. SPFx package rollback does not roll back
SharePoint data migrations.

## Upgrade and automation path

Deploy a later package through the App Catalog using semantic application and four-part solution
versions. Validate backward-compatible list schema first. Add columns/lists through reviewed
provisioning, not client-side guesses.

Teams and Power Automate are deferred. Future automation should observe pending Task Action and
Approval Request records, call the same guarded/idempotent application endpoint or equivalent domain
transition, and record correlation/status. A flow must not directly invent alternate workflow states
or duplicate approval rules. Run the full regression/UAT suite after any automation is introduced.

## Incident information

Record application version, solution version, tenant/site URL, UTC time, current route (without
confidential query data), user role—not salary/rate data—SharePoint correlation ID, affected record
ID, expected status, and actual status. Do not copy full SharePoint error payloads or confidential
records into broad support channels.
