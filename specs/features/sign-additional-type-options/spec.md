# Feature: Additional Sign Type options

- ID: `sign-additional-type-options`
- Status: `approved`
- Approval: `User approved this published specification in the Codex task on 2026-09-23.`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-23`
- Domain references: `CONTEXT.md — Sign, Allocation Plan, Site, Site Access, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Sign), Organization roles and permissions, Known ambiguities 7 and 10, Current implementation alignment, How feature work must use this catalog (sign-mounting-options and allocation-plan-add-sign-tool amendments)`
- Design authority: `User request on 2026-09-23: add Safety Decal, Privacy Decal, Environmental as Type items using the three supplied PNGs, preserved in references/.`
- Supersedes on approval: `The five-choice restriction in sign-mounting-options and allocation-plan-add-sign-tool. All other behavior remains authoritative.`

## Problem

The Sign General Type dropdown and Allocation Plan Add sign menu cannot represent the three additional choices requested by the user.

## Outcome and success metrics

Users can create and edit Signs with each of the three new choices, see the corresponding supplied icon, and reload the saved value. Both menus offer the same eight choices.

## Non-goals

- Site Sign Type groups, custom user-defined types, new domain objects or special behavior inferred from the option names.
- Changes to Function, Colour, orientation, Sign markers, permissions or the existing Wall-mounted creation default.

## Requirements

- REQ-001: The General Type dropdown and Add sign menu MUST offer Freestanding, Wall-mounted, Overhead, Cantilevered, Floor, Safety Decal, Privacy Decal and Environmental in that order. Append the three choices to the existing five. New type remains disabled.
- REQ-002: Safety Decal MUST use `references/safety_decal.png`, Privacy Decal MUST use `references/privacy_decal.png`, and Environmental MUST use `references/environmental.png`. Copy the supplied PNG bytes unchanged to local application assets and render them at 24 × 24 CSS pixels, preserving transparency and aspect ratio. Show each icon in both menus and in the selected General Type trigger. Retain text labels and mark icons decorative.
- REQ-003: Selecting a different Type in General MUST use the existing single Sign update and concurrency guard. Each new value MUST persist and round-trip through existing read APIs. Opening, dismissing or selecting the current value MUST NOT save. Preserve pending, failure and conflict handling, other attributes, and MANAGE_SIGNS permission checks; Viewers cannot change Type.
- REQ-004: Choosing a new option in Add sign MUST create once at the captured placement with that initial value, using the existing idempotency key and retry behavior; success opens General and switches to Move. Opening or dismissing the menu MUST NOT create a Sign. Omitted API mounting MUST still default to Wall-mounted.
- REQ-005: Shared read, create and update contracts and OpenAPI MUST accept all eight exact values and reject unsupported values. Reuse the existing Sign.mounting attribute; these UI choices do not create Site Sign Type groups or require a new field. Existing stored values remain valid.
- REQ-006: Preserve custom dropdown styling and keyboard selection/dismissal. All eight choices MUST remain reachable with pointer and keyboard in narrow or short viewports, including at 200% zoom; use bounded scrolling and placement adjustment where needed. Navigation MUST keep the active option visible and MUST NOT trigger drawing actions or close the drawer on dropdown Escape. Add Storybook examples for the new selected values, expanded choices, constrained viewport and disabled states.

## Acceptance scenarios

### AC-001 — Exact choices and supplied artwork [REQ-001, REQ-002, REQ-006]

- Given either menu, when opened, then all eight labels appear in the specified order with the correct icons and no enabled custom-type action.
- Given each new selected Type, when General renders, then the trigger shows its exact label and corresponding supplied icon.
- Given a 320 CSS pixel viewport or 200% zoom, when reaching the last option with pointer or keyboard, then it remains visible and selectable without horizontal document overflow.

### AC-002 — Edit and reload [REQ-003, REQ-005]

- Given an editable Sign, when each new value is selected and the Sign reloaded, then the saved value is returned and shown without changing other attributes.
- Given a pending save, Viewer, failed update or stale update, when attempting selection, then existing disabled and recovery behavior remains intact.
- Given an open menu, when dismissed or the current value selected, then no update occurs.

### AC-003 — Create and retry [REQ-004, REQ-005]

- Given Add mode and a captured placement, when each new option is selected, then one Sign is created with that initial value, General opens and Move becomes active.
- Given a failed creation, when retried, then the existing idempotency behavior prevents duplicates and retains the chosen value and placement.
- Given a creation request without mounting, when processed, then the value remains Wall-mounted; unsupported values fail validation.

### AC-004 — Accessible menu operation [REQ-006]

- Given a focused Type trigger, when the user opens and navigates the list with arrows and Home/End, then all choices can be reached and the active option stays visible.
- Given an open menu, when Escape, Tab or outside interaction dismisses it, then no mutation occurs; Escape keeps General open and trigger focus is retained.

## UX and accessibility

Retain the existing custom Type presentation, labelled controls, selected/active option semantics, visible focus and 40px option rows. Supplied images are decorative; text carries meaning. Bound the longer menus within their available viewport and preserve existing Add sign placement and dismissal rules.

## API and integrations

Expand mounting enums in shared read/create/update schemas and OpenAPI. Existing Sign endpoints, payload keys, authorization and idempotency mechanisms remain unchanged. Deploy compatible readers and validators before enabling new writes in the frontend.

## Data and migration

Reuse the current Sign.mounting string column. No backfill, new table or database migration is expected. These choices are explicit user-provided values, not categories inferred from FigJam. Record the approved amendment in the object catalog during implementation.

## Security and privacy

Retain session, Origin, Organization/Site access and MANAGE_SIGNS checks. Serve fixed local images and render labels as text. No new user data, uploads or third-party requests.

## Reliability and observability

Preserve existing save status, errors, conflict recovery and idempotent creation. No new infrastructure or telemetry. Validate saved-value round trips and failed-save behavior before release.

## Test strategy

After separate approval, write failing contract and UI tests for all three values before implementation. Cover exact ordering/icon mapping, edit/reload, create initial values, default compatibility, invalid values, permissions, no-op selection and keyboard reachability. Extend Storybook and focused browser checks for constrained layouts. Run affected contracts/API/frontend tests, specification validation, formatting, lint, types and application/Storybook builds; document unrelated existing failures separately.

## Rollout and rollback

Commit and push this draft separately for explicit approval before application changes. Implement on main after approval. Release compatible contracts/API readers before the frontend under the existing feature controls. If rollback is needed after new values have been stored, remove new choices from write menus while retaining read support and selected-value rendering; do not deploy validators that reject persisted new values or rewrite user selections silently.

## Open questions

- None.
