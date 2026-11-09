# Release 1.1.0

- Application version: `1.1.0`
- SharePoint solution version: `1.1.0.0`
- Production package: `sharepoint/solution/pmo-spfx.sppkg`
- Package size: 516,513 bytes
- SHA-256: `61c3fc9e948137d72108c64f5fa413d03c2a2e736cec51c2852822325332aaf3`

## Verified gates

- Prettier formatting check: passed.
- ESLint: passed with 0 errors (legacy explicit-return/no-void warnings remain).
- Strict TypeScript check: passed.
- Jest: 26 suites, 147 tests passed.
- SPFx clean production bundle: passed.
- SPFx package validation/creation: passed.
- Package inspection: 17 entries; no `.map` files and no `sourceMappingURL` marker.
- The production navigation contains no component-gallery route; the debug-only query token is absent
  from the production bundle.

The package was not uploaded or deployed. Target-tenant sign-off remains subject to
[`MANUAL-UAT.md`](MANUAL-UAT.md), including group/list permission readiness, multi-user workflows,
large-list/index behavior, accessibility/browser checks, and retention/rollback evidence.
