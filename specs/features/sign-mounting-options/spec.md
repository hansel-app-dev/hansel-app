# Feature: Sign General Type options

- ID: `sign-mounting-options`
- Status: `approved`
- Approval: User approved this specification in conversation on 2026-09-15.
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-15`
- Domain references: `CONTEXT.md — Sign, Allocation Plan, Site Access, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Sign), Canonical interpretation notes, Organization roles and permissions, Known ambiguities 7 and 10, Current implementation alignment`
- Design authority: User-supplied `Hansel App UI (9)/field.png`, `field-1.png`, `field-2.png`, and `field-3.png`. Subsequent user direction supplies exact 24×24 PNGs: `cantilivered.png`, `freestanding.png`, `overhead.png`, and `wall_mounted.png`; use these unchanged instead of recreated vectors.

## Problem

General → Type currently permits only Wall-mounted and does not provide the illustrated mounting icons. The requested four choices supersede the single-value mounting restriction in `allocation-plan-signs` REQ-007, once approved.

## Outcome and success metrics

All four mounting choices show their reference icon and label in the dropdown and selected field. Changing the selection persists through reload without affecting other Sign attributes.

## Non-goals

- No new Function or Colour choices, custom option management, schedule grouping changes, marker appearance changes, or permission changes.
- No change to the existing Wall-mounted default for new Signs.

## Requirements

- REQ-001: General → Type is single-select with exactly Freestanding, Wall-mounted, Overhead, and Cantilevered, in that order. These describe the existing Sign mounting attribute, not the Site's Sign Type grouping.
- REQ-002: Each menu option and the closed selected field display the corresponding illustrated icon beside its exact label. Match the supplied 302×40px field reference, neutral border, rounded corners, muted icon styling, aligned text and trailing chevron. Use the supplied individual PNG icons unchanged at their native 24×24 size; do not embed entire field screenshots or infer a black field background from image transparency.
- REQ-003: Selecting a choice saves immediately through the existing Sign update flow. Preserve optimistic concurrency, pending/failed-save recovery and current Site-access/MANAGE_SIGNS authorization. Existing Signs retain their values; new Signs remain Wall-mounted by default.
- REQ-004: Client and server accept all four exact values and reject unsupported values. Reading any supported value must not break the plan's Sign list. Other attributes and Sign Type grouping remain unchanged.
- REQ-005: Provide a labelled accessible trigger/listbox with selected state, keyboard navigation, Enter/Space selection, Escape dismissal and focus return. Viewers see the current icon and label but cannot edit. Add all selected states, open-menu, disabled and keyboard states to Storybook.

## Acceptance scenarios

### AC-001 — Illustrated menu [REQ-001,002,005]

- Given a selected Sign, when an authorized editor opens Type, then all four labelled icons are visible, the current value is identified, and keyboard selection works.
- Given any selected value, when the menu closes, then its matching icon and label appear in the 40px field.

### AC-002 — Persistence and validation [REQ-003,004]

- Given each supported choice, when selected and reloaded, then the saved choice remains and the plan's Sign list loads successfully.
- Given an unsupported value or stale update, when submitted, then the server rejects it without changing other fields.

### AC-003 — Existing permissions [REQ-003,005]

- Given a Viewer, when inspecting General, then the selected icon and label are visible but mutation is unavailable.
- Given a save failure, when selecting a value, then existing retry/error handling preserves the pending edit without falsely reporting success.

## UX and accessibility

Use the existing font and drawer spacing. Icons are decorative; labels provide accessible names. Menu width follows the field and remains within the drawer. Visible hover/focus/selected states must not shift icon or text alignment.

## API and integrations

Expand the mounting field in the existing plan Sign read/create/update contracts and OpenAPI definitions. No new endpoint or external integration. Deploy compatible readers/writers together before users save new values.

## Data and migration

Reuse the persisted Sign mounting attribute. Do not rewrite existing records or backfill samples. If storage constrains values, expand that constraint additively; otherwise no migration is needed. No additional ownership relationship.

## Security and privacy

Retain session, exact-Origin, tenant/Site ownership and MANAGE_SIGNS checks. Render labels as text. Icons contain no uploaded or remote content.

## Reliability and observability

Reuse existing Sign update errors and categorical logging. A failed/stale save must remain recoverable. No additional telemetry or infrastructure.

## Test strategy

Write failing contract tests for all four values and unsupported inputs before implementation. Verify persistence and permissions using existing Sign feature tests. Browser tests cover icon/label rendering for every option, selection/reload, field geometry and keyboard behavior. Run affected unit tests, type checks, lint and build.

## Rollout and rollback

Remain under the existing allocation-plan-signs flag. Release expanded contracts and API support before or with the menu. Do not roll back readers to a Wall-mounted-only validator after new values are stored; retain expanded reads or disable the feature without deleting data.

## Open questions

- None.
