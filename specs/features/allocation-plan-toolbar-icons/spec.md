# Feature: Supplied Allocation Plan toolbar icons

- ID: `allocation-plan-toolbar-icons`
- Status: `approved`
- Approval: `User approved this published specification in the Codex task on 2026-09-23.`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-23`
- Domain references: `CONTEXT.md — Allocation Plan, Sign, Site Access, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Allocation Plan and Sign), Organization roles and permissions, How feature work must use this catalog (allocation-plan-toolbar, allocation-plan-hand-tool and allocation-plan-add-sign-tool amendments)`
- Design authority: `Six user-supplied 102 × 102 transparent PNGs on 2026-09-23, preserved unchanged in references/.`
- Supersedes on approval: `Only the toolbar artwork in allocation-plan-toolbar. Current tool behavior and later Hand/Add sign amendments remain authoritative.`

## Problem

The Allocation Plan toolbar uses inline SVG approximations. The user supplied replacement artwork for all six buttons.

## Outcome and success metrics

All six buttons display their corresponding supplied artwork, with recognizable active and inactive states and unchanged interactions.

## Non-goals

- Enabling Rectangle, Line or Comment, renaming tools, changing tool behavior, or changing toolbar layout and permissions.
- Altering zoom controls, drawing cursors, Sign Type icons, APIs or stored data.

## Requirements

- REQ-001: Replace the six toolbar SVG illustrations with the supplied PNGs, copied byte-for-byte into local application assets. Map Move to `move_toolbar.png`, Hand to `hand_toolbar.png`, Add sign to `add_sign_toolbar.png`, Rectangle (coming soon) to `add_area_toolbar.png`, Line (coming soon) to `add_linear_toolbar.png`, and Comment (coming soon) to `comment_toolbar.png`. Preserve this button order.
- REQ-002: Preserve transparent backgrounds, proportions and the artwork's internal padding. Render each complete 102 × 102 source canvas at 34 × 34 CSS pixels inside the existing 34px button; do not crop, redraw or distort it. Inactive icons retain their supplied dark appearance. For active Move, Hand or Add sign, render the artwork white using a CSS filter while preserving the existing blue button background; do not modify the source bytes.
- REQ-003: Preserve existing accessible button names, titles, aria-pressed state, keyboard focus, disabled states and hit targets. Treat images as decorative with empty alternative text. Move, Hand and Add sign retain their current behavior and permission/pending guards; Rectangle, Line and Comment remain disabled. Clicking artwork MUST behave exactly like clicking its button and MUST NOT propagate a drawing action.
- REQ-004: Preserve the current floating toolbar dimensions, placement and responsive behavior. Update Storybook coverage for default Move, active Hand, active Add sign, Viewer and pending states. Verify all assets load and remain legible at desktop/narrow widths and 200% zoom.

## Acceptance scenarios

### AC-001 — Correct supplied artwork [REQ-001, REQ-002]

- Given the toolbar, when rendered, then each button uses its mapped local PNG and the six source files match the supplied bytes.
- Given an inactive tool, when displayed, then the complete transparent artwork is dark and undistorted inside the button.
- Given Move, Hand or Add sign is active, when displayed, then its supplied shape is white on the existing blue background.

### AC-002 — Existing interaction and accessibility [REQ-003]

- Given an enabled tool, when activated by pointer on its image or by keyboard, then the existing tool transition occurs once and no drawing action is triggered.
- Given a Viewer, pending state or deferred tool, when the toolbar is used, then existing availability restrictions remain intact.
- Given assistive technology, when inspecting the toolbar, then buttons retain their existing names and state without duplicate image announcements.

### AC-003 — Layout and preview states [REQ-004]

- Given desktop or narrow layouts and 200% zoom, when viewing the toolbar, then the supplied images load, fit the existing buttons and introduce no extra toolbar overflow.
- Given Storybook, when previewing default, active and disabled states, then the new artwork is used consistently.

## UX and accessibility

Use the supplied artwork as the visual authority. Keep native buttons, visible focus, existing tooltips and truthful disabled states. Active-state filtering affects only the decorative image. Preserve existing toolbar and zoom-control separation.

## API and integrations

No API or external integration changes. Serve the six assets with the frontend.

## Data and migration

No database, persisted tool state, migration or backfill changes. This amendment is presentation only; no domain objects or capabilities are inferred from the image filenames.

## Security and privacy

Retain all current Site Access and MANAGE_SIGNS checks. No new requests to third parties, user data collection or upload functionality.

## Reliability and observability

Verify all six assets load in production and Storybook builds. Existing interaction and error behavior remains unchanged. No new telemetry or infrastructure.

## Test strategy

After approval, first add failing checks for the exact button-to-asset mapping and active/inactive presentation. Verify unchanged tool interaction and disabled states with existing toolbar tests. Run focused browser checks for image loading, dimensions, focus, accessibility and narrow/zoomed layouts, plus formatting, lint, typecheck, specification validation and frontend/Storybook builds. Report unrelated repository-wide failures separately.

## Rollout and rollback

Commit and push the specification separately and obtain explicit approval before application changes. Implement on main and publish through the existing frontend release process. Reverting the icon/component changes restores the previous artwork without affecting saved data or tools.

## Open questions

- None.
