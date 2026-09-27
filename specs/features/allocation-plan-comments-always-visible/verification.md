# Verification — Always-visible Allocation Plan comments

Date: 2026-09-27. Specification proposal: `4b519e4`. User approval recorded and pushed separately in `2d195fa` before application changes.

## Behavior and scope

Removed the Show resolved checkbox, its client state/query and both marker-service and UI resolution filters. Open and resolved threads share the existing creation-order pagination. Successful resolution retains the pin while closing the card; selecting it still opens read-only history and Reopen. Open-only movement, draft retention, access checks, state concurrency, attachment privacy and stored resolution metadata remain unchanged. No migration or backfill is required.

The server validates former resolved=true/false parameters for compatibility but never filters results by them; invalid legacy values return 400. The public client/OpenAPI no longer expose a visibility argument. The normal populated drawing has no empty feedback box; existing loading, empty, pagination, retry and movement feedback still appear when needed. Screen-reader movement instructions and announcements remain mounted.

Updated Storybook resolved and mixed states, canonical domain language, catalog acceptance notes, historical specification supersession and both comment runbooks. No production deployment was performed.

## Checks

- Test first: new/updated component, client, service and route assertions failed for the existing checkbox, hidden resolved pins, outgoing query, server predicate and former service argument before implementation.
- Relevant frontend viewer/client tests: 53 pass, including resolved-only initial load/remount, resolve/reopen, absence of the checkbox, unchanged movement and Sign/Area/Hand/plan-switching guards.
- API service/route unit tests: 5 pass. Marker scope, mixed-state page size/order/cursor and valid/invalid legacy-query handling are verified alongside position/access and route security checks.
- Real PostgreSQL integration: 3 pass. Updated discussion integration verifies a resolved pin in the default marker read, inclusive mixed-state listing and stable pagination without duplicates. Existing position and attachment tests verify retained content, access isolation, retries and concurrency guards. Fixtures are cleaned up.
- Browser: 7 pass. Viewer resolve/reopen keeps the pin visible, resolved Storybook reload restores history without a filter, resolved movement remains blocked, and mixed open/resolved pins plus retained history fit a 320px drawing. Existing draft/saved drag, keyboard, cancel, retry/conflict, 200% zoom, scroll and panning scenarios pass. Browser transport uses Storybook fixtures; real storage is verified separately against PostgreSQL.
- Workspace type checks, repository lint, spec/runtime/Tailwind/design validation, workspace builds and Storybook build pass. Existing bundle-size warnings remain.
- Changed files pass formatting and whitespace checks. Narrow resolved-history screenshot inspected at `/tmp/hansel-comments-always-visible-narrow.png`.

## Remaining gates

The required 100% coverage gate remains failing despite passing test assertions. Focused frontend coverage is 95.87% lines/statements, 85.6% branches and 79.36% functions across PlanComments/client (client coverage is 100%). Focused API unit coverage across the full existing comments service/routes is 51.26% lines/statements, 95.69% branches and 53.84% functions; existing discussion/history operations are exercised by database integration, which is not unit coverage.

Global Prettier still reports 19 previously identified unrelated files. Those files were preserved. Broader previously recorded App/SiteAllocationPlans auth/mock failures, session-refresh API mock failure, unrelated design-system failures and single-file routing E2E failure were not rerun for this change. This does not certify the full repository or production release.
