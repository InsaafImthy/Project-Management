# ADR 0001: Use SharePoint-only direct services in the foundation

## Status

Accepted — Stage 01.

## Decision

The initial PMO application is a SharePoint-hosted SPFx web part. It accesses the provisioned
SharePoint lists and document library through typed, direct SharePoint services based on
`SPHttpClient`.

Microsoft Teams hosting and Power Automate integration are deferred. Future feature work must
keep its workflow rules in domain services so asynchronous flows can reuse or reproduce them
later. This foundation does not add a Teams package, Teams host detection, Power Automate
connector, client ID, secret, or mock business data.

## Consequences

Features can depend on one application root, central environment configuration, typed models,
and the SharePoint service boundary. Tenant-side flow and Teams configuration is intentionally
outside this stage.
