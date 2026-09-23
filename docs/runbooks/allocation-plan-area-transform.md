# Drag and resize saved Areas

Feature: `allocation-plan-area-transform`; specification `d4aa10e`, approval `f56488e` (2026-09-23).

Managers can drag an existing Area by its body or outside code label in Move mode and immediately after creation while Add area remains active. A selected editable Area exposes eight corner/edge resize handles. Hand, Space-pan and armed rectangle creation do not transform saved Areas. Viewers do not receive edit handles.

Pointer transformations preserve the opposite edges, clamp to drawing bounds and save once on release. Keyboard users focus a handle, press Enter or Space, adjust with arrows, and press Enter to save. Escape or Tab cancels. The existing Alt+arrow movement also works in unarmed Add area mode. Failed writes restore saved geometry and retain retry inputs; conflicts require reload.

## Deployment and rollback

Deploy the compatible Area PATCH API before the frontend. Resize requests include x/y/width/height and expectedUpdatedAt. Metadata-only and paired x/y requests remain supported. Existing database columns and geometry constraints suffice; no migration or backfill is required. Keep the existing Area feature gate and Site Access/MANAGE_SIGNS checks.

Smoke-check create → drag body/label → resize → reload, confirm metadata and the Signage Schedule are unchanged, and verify a Viewer cannot transform an Area. Roll back the frontend first if transformation fails; preserve saved Area dimensions and data. Existing categorical Area success/failure events cover these writes without logging coordinates or content.

## Validation

- Contract and UI tests failed before implementing complete resize requests and immediate Add area dragging.
- 39 focused frontend regression tests passed, covering selection, creation, transforms, every handle, cancellation, retries, keyboard controls and existing Sign interactions.
- Area contracts, geometry, and API service achieved 100% focused coverage. The real PostgreSQL test verifies complete geometry persistence, unchanged metadata, permissions, stale versions and bounded rectangles.
- Twelve combined browser tests passed across Area interactions, Sign type selection and toolbar icons, including resize at narrow widths and 200% zoom. The selected handles and outside label were visually inspected.
- Repository lint, typecheck, production builds, Storybook build and specification validation passed. Storybook includes selected handles, keyboard resize preview, pending, failure and Viewer states.

## Outstanding verification gates

The focused Area frontend coverage command exits nonzero at 98.47% lines/statements, 96.87% functions and 92.22% branches. The controller retains uncovered paths, so the repository's 100% coverage requirement is not met. No thresholds were relaxed.

`pnpm verify` passes specification checks and then stops on 22 existing formatting failures outside this change. Later aggregate stages were not reached; relevant checks above ran independently. Production deployment, remote CI/security scans and deployment smoke checks have not been performed by this local implementation.
