# PMO SPFx

Stage 03 shared presentation foundation for the PMO SharePoint Framework application. It provides
the SharePoint-only React web part, centralized design tokens and primitives, reusable tables,
forms, dashboards, layouts, a capability-aware application shell, and query-string routing. It
intentionally contains no business-module pages, SharePoint queries in presentation components,
Teams host, Power Automate integration, provisioning logic, credentials, or business mock data.

## Prerequisites

- Node.js 26 LTS (the recommended SPFx 1.24.1 baseline; Node 24.0.0+ and Node 22.14.0+ are also
  supported by SPFx 1.24.1).
- npm 10 or later.
- Access to `https://aufaitcloud.sharepoint.com/sites/ProjectManagementTool` to run the web part
  on a SharePoint page.

The repository pins SPFx 1.24.1, React 18.3.1, Fluent UI 8.106.4, and TypeScript 5.8.3. Select
Node 26 with your version manager before installing:

```bash
nvm use
```

## Setup and development

```bash
npm install
npm run start
```

`config/serve.json` opens the ProjectManagementTool site workbench over HTTPS. Add the local
debug manifest when prompted, then add **PmoApplication** to a SharePoint page. No credentials
are stored in the repository; SharePoint authenticates the signed-in Microsoft 365 user.

## Quality checks

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run build
```

`build` runs the SPFx Heft production pipeline and packages the solution. To package after an
existing production build, run:

```bash
npm run package
```

The generated package is `sharepoint/solution/pmo-spfx.sppkg`.

## Deployment

1. Run `npm run build`.
2. Upload `sharepoint/solution/pmo-spfx.sppkg` to the tenant App Catalog.
3. Deploy the package, then add **PmoApplication** to a modern page on
   `ProjectManagementTool`.
4. Verify the signed-in user has the required SharePoint-site and list permissions.

The package permits tenant-wide deployment as selected during scaffolding; whether to enable that
option is a tenant-administrator deployment decision. The already-provisioned PMO lists and
library are not managed by this repository.

## Architecture notes

- Environment URL assumptions and the exact 17 list names plus document library are centralized
  in `src/webparts/pmoApplication/config/environment.ts`.
- Feature stages import the root, theme, context, models, services, and testing helpers without
  reorganizing the scaffold.
- [ADR 0001](docs/adr/0001-sharepoint-direct-services.md) records why Teams and Power Automate
  are deferred and why the current app uses direct SharePoint services.

## Shared components

Stage 02 centralizes Fluent-backed visual decisions in `theme/pmoDesignTokens.ts` and exports the
PMO primitives from `components/primitives/index.ts`. Components own repeated PMO behavior such as
semantic action emphasis, accessible field/error wiring, number boundaries, debounced search,
M365 person resolution boundaries, text-first statuses, locale-aware values, and feedback states.

In a development build, append `?pmoGallery=true` to the SharePoint workbench/page URL to render
the component gallery. The gate uses the SPFx `DEBUG` build constant, so the gallery cannot replace
normal application content in a production build.

Stage 03 exports feature-neutral composites from `components/composites/index.ts` and shell/layout
components from `components/layout/index.ts`. `DataTable<T>` is deliberately query-free: features
own server paging, sorting, filtering, selection state, and mutations. Feature modules register
typed navigation entries and required capabilities through `routing/pmoRoutes.ts`; they do not edit
sidebar markup. Application context is limited to current identity/capabilities, display preference,
messages/dialogs, and route state.
