# Feature: Sign Function options

- ID: `sign-function-options`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-22`
- Domain references: `CONTEXT.md — Sign, Allocation Plan, Site, Site Access, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Sign), Known ambiguities requiring specification (7 and 10), Current implementation alignment, How feature work must use this catalog (allocation-plan-signs)`

## Problem

The Sign General drawer currently permits only Wayfinder for Function, as required by `allocation-plan-signs` REQ-007. The user requested Identification, Directional, Informational, and Regulatory/Statutory. This amendment supersedes that Function restriction only after approval; the object catalog does not define these values.

## Outcome and success metrics

Editors can select and persist each of the four requested Function values. Existing Signs remain readable after migration and no Wayfinder option appears in the dropdown.

## Non-goals

- Changes to mounting, Colour, Sign Type grouping, marker appearance, permissions, or custom option management.

## Requirements

- REQ-001: General → Function MUST be single-select with exactly Identification, Directional, Informational, and Regulatory/Statutory, in that order and with that spelling.
- REQ-002: Selecting a value MUST save through the existing shared Sign update flow and remain selected after reload. Preserve concurrency checks, pending/error states, and recovery behavior without changing other attributes.
- REQ-003: Client and server MUST accept each of the four exact values and reject unsupported values for writes. Shared read contracts MUST support all four values.
- REQ-004: Proposed for approval: migrate existing Wayfinder values to Directional and use Directional as the default for new Signs, including database and application defaults. Preserve Sign IDs, ownership, placement, and all other attributes. Migration MUST NOT create user-edit Activity entries. Readers MUST tolerate legacy Wayfinder during deployment; new writes MUST use the four supported values.
- REQ-005: Preserve the labelled, keyboard-accessible select, visible focus, selected state, and disabled state for users without editing permission. Storybook MUST demonstrate each supported selected value and the disabled control.

## Acceptance scenarios

### AC-001 — Exact choices and persistence [REQ-001,002,003]

- Given an editor viewing a Sign, when opening Function, then exactly the four requested options appear in the specified order.
- Given each supported option, when selected and the Sign reloaded, then the saved option remains selected in the shared Sign record.
- Given an unsupported write or stale revision, when submitted, then it is rejected without overwriting the Sign.

### AC-002 — Existing records and defaults [REQ-003,004]

- Given a Sign with Wayfinder, when the migration runs, then its Function becomes Directional and all other attributes remain unchanged.
- Given migrated data, when the migration logic is repeated, then supported values remain unchanged.
- Given a new Sign, when created using the existing creation flow, then its Function defaults to Directional.
- Given a legacy record during deployment, when read, then its presence does not prevent the Sign list from loading.

### AC-003 — Accessibility, permissions, and errors [REQ-002,005]

- Given an editor using a keyboard, when focusing and changing Function, then the accessible label and selected value identify the control and the choice saves.
- Given a Viewer, when inspecting General, then the current Function is visible but cannot be edited; direct unauthorized updates remain rejected.
- Given a failed save, when changing Function, then existing error and recovery behavior remains available without falsely reporting success.

## UX and accessibility

Retain the existing drawer layout and native select behavior. Regulatory/Statutory must remain legible within the field and menu. Reuse established loading, disabled, focus, and error presentation.

## API and integrations

Update shared Sign read/update contracts and document Function values in the existing OpenAPI Sign schemas where applicable. No new endpoint or external integration. During rollout, accept legacy Wayfinder reads but reject legacy writes once the updated API is active.

## Data and migration

Reuse the existing Sign.function string column; all requested values fit its current 32-character limit. Add a versioned migration replacing Wayfinder with Directional and changing the database default. Update application creation defaults. Do not rewrite other Function values silently. No new ownership or retention rules.

## Security and privacy

Retain session, Origin, Organization/Site access, and MANAGE_SIGNS authorization. Values are fixed labels rendered as text. No new sensitive data or logging.

## Reliability and observability

Reuse existing validation and save errors. Check migration counts and confirm no Wayfinder rows remain after migration without logging Sign contents. No new background jobs, telemetry, or infrastructure.

## Test strategy

Write failing tests before application changes for all supported values, unsupported writes, creation defaults, and legacy read compatibility. Cover migration preservation, UI selection and reload, existing permission/concurrency behavior, and Storybook selected/disabled states. Run relevant contract, API, frontend, formatting, lint, type, build, and specification checks.

## Rollout and rollback

Use the existing allocation-plan-signs flag. Deploy compatible readers and updated writers, apply the data/default migration, then expose the updated UI. Avoid serving old Wayfinder-only readers after migration. If rollback is required, disable the feature while retaining compatible reads and stored values; do not collapse the new categories into Wayfinder.

## Open questions

- None beyond approval of the explicitly proposed legacy mapping and default in REQ-004.
