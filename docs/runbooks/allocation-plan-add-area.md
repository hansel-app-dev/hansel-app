# Allocation Plan Add area

Feature: `allocation-plan-add-area`; specification `86ec5ae`, approval `b277658` (2026-09-23).

Areas are independent Allocation Plan annotations. They do not create Signs, Site Sign Type groups or Signage Schedule rows. The fourth toolbar button opens a Floor menu on the drawing; choosing Floor arms rectangle drawing. Keyboard users use Enter, arrows and Enter to set both corners. Environmental and Blue are fixed. Managers can edit code, content and orientation, move the rectangle, and delete it with confirmation. Viewers can inspect it.

## Deployment and recovery

Apply migration `20260923010000_allocation_plan_areas` before deploying the API. It adds `PlanArea` and `PlanAreaRequest`, composite parent/file ownership constraints, plan-local normalized code uniqueness, and bounded geometry constraints. Existing Signs and files need no backfill. The local development database was backed up before applying and verifying the migration.

The existing `allocationPlanSignsEnabled` feature flag gates the new endpoints. Reads require Site Access; writes require MANAGE_SIGNS. Responses are private/no-store. Creation retries reuse an idempotency key, and request tombstones survive individual Area deletion. Concurrent edits require the last returned timestamp. A conflict requires reload; other failures retain a retry action. Do not manually delete request tombstones to retry a creation.

Roll back application artifacts together to the previous release if required. Leave the additive tables and migration applied so saved Areas remain recoverable. Do not drop tables as an application rollback. Allocation Plan/file deletion cascades its Areas; Allocation Plan deletion also removes its request ledger.

## Verification

- Test-first contract, route, persistence and UI tests cover the approved creation, permission, bounds, selection, editing, retry, deletion and keyboard paths.
- Area contracts, API service (with real PostgreSQL), client API, geometry and details component each achieved 100% statements, branches, functions and lines in focused coverage runs.
- The final Area frontend suite passed 15 tests, including shared Sign/Area selection and offscreen keyboard-menu positioning.
- Browser coverage includes pointer and keyboard creation, edit/move/delete, mutually exclusive drawers, fixed custom fields, narrow layouts and 200% zoom. Area, existing Sign type and supplied toolbar icon browser suites passed together (11 tests).
- A combined browser rerun exposed an existing toolbar-image load race; its assertion now waits for image completion before checking dimensions. The combined suite passed after this test correction.
- Repository lint, typecheck, production builds and Storybook build passed. Reusable components and menu, armed, preview, selected, Viewer, pending and failure states are in Storybook.
- Database integration verifies simultaneous creation, idempotency, cross-tenant/file ownership, stale edits, code conflicts, capacity, geometry constraints, parent cascades and absence of Sign side effects.

## Outstanding verification gates

The focused frontend coverage command still exits nonzero: 99.01% lines/statements, 98.18% functions and 91.6% branches, below the repository's 100% requirement. Uncovered paths remain in the Area interaction controller; browser tests do not count toward unit coverage. This feature has not satisfied the repository's full definition of done.

The aggregate `pnpm verify` gate also stops at existing formatting failures outside this feature after specification checks. Modified/new feature files were formatted separately. Later aggregate stages are therefore not claimed to have passed; the focused checks above ran independently. Production rollout, remote CI/security scans and deployment smoke checks have not been performed by this local implementation.

## Operational checks

After deployment, check API health, create and reload an Area on an accessible plan, verify the Schedule is unchanged, and confirm a Viewer cannot mutate it. Inspect categorical `plan_area_<method>_success` / `plan_area_<method>_failure` events for write failures or repeated conflicts. Events must not include Area content, codes, credentials or file data. The change adds no new telemetry provider or dashboard.

## Label placement correction

The Area code badge sits outside the rectangle at its upper-right edge, matching the applied design. Near the drawing’s right edge it moves above the rectangle to remain reachable. Placement follows the live move preview. The browser regression checks the badge’s position against the rectangle bounds; it failed before the correction.
