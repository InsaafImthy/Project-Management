# PMO SPFx

Production SharePoint Framework application for project governance, planning, task delivery, time,
changes and approvals, quality, resources and learning, financials, status reporting, documents,
role dashboards, and governed Excel plan import. SharePoint lists and the PMO document library are
the system of record; the React UI never contains production mock data.

Application version: **1.1.0**. Solution version: **1.1.0.0**.

## Prerequisites and supported runtime

- Node.js 22.14.x, 24.x, or 26.x. The repository recommends Node 26 through `.nvmrc`.
- npm 10 or later.
- SharePoint Framework 1.24.1-compatible tenant and tenant App Catalog.
- The provisioned PMO site, 17 lists, `PMO Project Documents` library, indexed columns, groups,
  configuration rows, and versioning described in
  [`../README-PMO-PROVISIONING.md`](../README-PMO-PROVISIONING.md).
- A tenant administrator for App Catalog deployment and a site owner for first-run setup.

The pinned client stack is SPFx 1.24.1, React 18.3.1, Fluent UI 8.106.4, and TypeScript 5.8.3.

## Local development

```bash
nvm use
npm ci
npm run start
```

`config/serve.json` opens the modern home page at the configured ProjectManagementTool site. Sign
in with a test account, accept the local debug manifest, edit the page, and add **PmoApplication**.
The repository stores no credentials. For another environment, change the environment-specific
site URL in `config/serve.json` and `.vscode/launch.json`; list and library names are centralized in
`src/webparts/pmoApplication/config/environment.ts` and must match provisioning.

The component gallery is development-only. Append `?pmoGallery=true` while using a debug build.
The SPFx `DEBUG` guard removes this path from normal production behavior.

## Quality, build, and package

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run build` performs a clean production bundle and creates
`sharepoint/solution/pmo-spfx.sppkg`. `npm run package` packages an already-built production bundle.
Do not weaken TypeScript, lint, or tests to package the application.

## Tenant deployment

1. Complete the provisioning verification and resolve every failed row before deployment.
2. Run the quality and production build commands above; verify the package checksum supplied with
   the release.
3. Upload `sharepoint/solution/pmo-spfx.sppkg` to the tenant App Catalog. Review the package details
   and deploy it. Tenant-wide availability is an administrator decision; the package does not
   provision or modify production permissions.
4. Create a modern SharePoint page in the PMO site, add a one-column full-width section, add
   **PmoApplication**, and publish the page. Full-width sections require a communication site.
   The web part also supports a Single Part App Page and includes its own full-screen canvas
   overrides for application-style hosting.
5. Assign test users to the exact PMO SharePoint groups and maintain matching active Employee rows
   where business eligibility is required.
6. Run [`docs/MANUAL-UAT.md`](docs/MANUAL-UAT.md) with separate tenant users before production use.

### Optional site-specific shell overrides

On initialization, the web part loads
`<site-url>/SiteAssets/css/developer.css` after the bundled application-shell stylesheet. Upload
[`docs/developer.css`](docs/developer.css) to that SiteAssets location (it can remain empty). Keep
all essential full-screen behavior in the package; reserve this external file for tenant-specific
SharePoint corrections only.

No tenant deployment is performed by the build scripts.

## Permission and identity model

SharePoint groups are the security boundary; Employee flags are additional business eligibility
and never grant access alone. Use the provisioned groups exactly: PMO Owners, Project Managers,
Employees, QA, Resource Managers, Approvers, Finance, Executives, Time Approvers, and Support.
Administrators can open **Support diagnostics** to check list/library connectivity and effective
read/write readiness without reading confidential list records.

The application repeats authorization in domain commands, uses record/project membership where
applicable, and does not call restricted rate/cost repositories for unauthorized users. Direct
SharePoint list access is still governed by SharePoint itself: users with edit permission can bypass
app workflow controls by editing lists directly. Restrict list pages to appropriate administrators,
use version history and audit logs, and grant `PMO_EmployeeRates`, `PMO_ProjectCosts`, and detailed
financial data only to Owners, Finance, and explicitly approved Executives. Project managers receive
only their governed project financial summary through the app.

See [`docs/PRODUCTION-OPERATIONS.md`](docs/PRODUCTION-OPERATIONS.md) for the full permission,
support, retention, and recovery assumptions.

## First run

1. Verify active configuration rows, especially standard day hours, person-day hours, warning
   thresholds, margin threshold, project code sequence, and import limits.
2. Create active Employee rows for users, including SharePoint user identity, calendar/working-day
   data, manager, cost center, skills, and only the required eligibility flags.
3. Add users to the corresponding PMO SharePoint security groups. Refresh/reopen the app after a
   group change because capability context is cached for the session.
4. Use Support diagnostics as an Owner to confirm all required containers are readable/writable.
5. Create a pilot project, approve its baseline with a different Approver user, then complete the
   UAT checklist before allowing broad use.

## Operations

- Project and portfolio KPIs are recalculated from bounded, filtered SharePoint queries when their
  pages or workflows request refresh; freshness timestamps are displayed. Treat an external list
  edit or ETag conflict as stale data, reload, review the newer values, and repeat the action.
- Support users can inspect failed Task Actions and Approval Requests in Support diagnostics. The
  page shows status, IDs, retry counts, last attempt, and correlation references—not confidential
  record payloads. Retry only after confirming the command is still valid; workflow commands are
  status-controlled and use idempotency keys where applicable.
- User-facing SharePoint failures are sanitized while preserving correlation IDs for Microsoft 365
  support. Production code does not log business records to the console.
- Use SharePoint/Microsoft 365 backup, list/library versioning, retention labels, recycle bins, and
  audit configuration according to organizational policy. This package does not implement a second
  backup system or override tenant retention.

## Release limitations

- Teams tabs, Teams notifications, and Teams deep-link packaging are not included.
- Power Automate flows, scheduled reminders/escalations, and email delivery are not included.
- Notifications are in-app; tenant automation can be added later by consuming the existing Task
  Action and Approval Request records and invoking the same status/idempotency rules.
- Direct list confidentiality is only as strong as tenant SharePoint permissions. The app is not a
  substitute for item-level SharePoint security where strict project secrecy is required.
- Live tenant behavior, browser/assistive-technology combinations, and tenant search/index timing
  require manual UAT; unit/component tests cannot certify tenant configuration.

Future Teams or Power Automate work must orchestrate the existing SharePoint records and domain
state transitions, not duplicate or rewrite business rules in a flow.

## Audit references

- [`docs/STAGE-13-COMPLETENESS-AUDIT.md`](docs/STAGE-13-COMPLETENESS-AUDIT.md)
- [`docs/MANUAL-UAT.md`](docs/MANUAL-UAT.md)
- [`docs/PRODUCTION-OPERATIONS.md`](docs/PRODUCTION-OPERATIONS.md)
- [`docs/RELEASE-1.1.0.md`](docs/RELEASE-1.1.0.md)
- [`docs/adr/0001-sharepoint-direct-services.md`](docs/adr/0001-sharepoint-direct-services.md)
