# Allocation Plan Add linear

Specification: [allocation-plan-add-linear](../../specs/features/allocation-plan-add-linear/spec.md).

## Deployment

Back up the database, apply `20260923020000_linear_sign_placements`, regenerate Prisma Client, then deploy API and web together. Existing placements default to point; no Sign appearance or stored file changes. Refresh existing browser sessions: older strict clients cannot read Linear response fields. The existing Allocation Plan Signs flag controls availability.

Local migration was applied after saving `/tmp/hansel-before-linear.dump` outside the repository. Application and Storybook builds pass; the pre-existing large-bundle warning remains.

## Smoke checks

1. As a manager, select Add linear, click the drawing, choose Safety Decal and drag a segment in either direction. Confirm one Pr.01-style Sign, Orange dashed geometry, outside badge, shared General drawer and automatic Move mode.
2. Reload; verify endpoints, Type, Colour and Function. Confirm the same Sign/code in the Signage Schedule and shared edits in either view.
3. Drag the body/badge, then each endpoint; verify bounds, a single save per gesture and unchanged opposite endpoint. Use Alt+arrows and keyboard endpoint editing; verify focus after save.
4. Cancel drawing with Escape, pan, scroll or tool change. Simulate a failed request and retry; confirm no duplicate. Confirm stale updates require reload.
5. Inspect as Viewer; verify creation/editing is disabled and direct unauthorized writes fail. Reject foreign files and point/linear appearance or endpoint mismatches.
6. Delete through the shared Sign flow; verify placement and schedule removal, while other Signs and Areas remain.
7. Verify narrow/200% layouts, supplied one-third-size cursors, and point Sign/Area/Hand interactions. Storybook: Sites / Linear Signs has Interactive, Selected, Menu, Armed, Drawing, Endpoint Editing, Viewer, Pending, Failure and Conflict examples.

## Validation

Focused contract tests, Linear interaction/geometry unit tests, real-database Sign integration and API route checks pass. The new Linear interaction/geometry modules and updated Sign contracts reach 100% in all focused unit coverage metrics. Browser checks cover draw/move/endpoint edit/delete, keyboard/retry/Viewer and narrow/zoom/shared selection.

Repository-wide verification remains subject to existing formatting failures. The existing Area browser check that reopens Floor at 200% zoom also fails intermittently in both viewport sizes; the 1512px failure was reproduced using the pre-Linear viewer implementation. Track it separately from the passing Linear scenarios. The shared Sign service has 100% focused lines/statements/functions and 96.03% branches; its existing capacity/fallback branches keep the 100% branch gate below target. Full-repository verification is not green.

## Recovery and rollback

Monitor existing categorical API errors; do not log Sign text or drawing coordinates. A 409 requires reload, not blind overwrite. Failed create retries reuse the original idempotency key. Database constraints reject incomplete, out-of-bounds or zero-length line geometry.

Disable new Linear creation while retaining the reader for existing Linear Signs if rollback is needed. Retain columns and data; do not deploy a point-only API over saved Linear records or delete geometry as rollback. Existing shared Sign attachment cleanup and parent lifecycle remain in effect.
