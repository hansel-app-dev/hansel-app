# Feature: Allocation Plan toolbar and Move tool

- ID: `allocation-plan-toolbar`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-19`
- Domain references: `CONTEXT.md — Allocation Plan, Sign, Site Access, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Allocation Plan and Sign), Nesting map, Organization roles and permissions, Current implementation alignment (allocation-plan-signs)`
- Design authority: User-supplied `/Users/nsingh/Downloads/Toolbar/Move.png`.
- Confirmed scope: Single-Sign selection and dragging only; circle-plus enables existing Add sign behavior; the other four tools remain disabled.

## Problem

The drawing currently defaults to click-to-create and lacks the floating tool selector shown in the reference. Users need an explicit selection mode that cannot accidentally create Signs.

## Outcome and success metrics

The toolbar matches the supplied desktop design and separates selection from creation. In Move mode, blank clicks and drawing Enter presses create zero Signs; a drag updates exactly one existing Sign through the existing persistence path.

## Non-goals

- Box selection, multiple selection, bulk movement, resizing, new drawing objects, plan comments, undo or new backend endpoints.
- Enabling the hand, dashed-rectangle, line or comment tools. Existing Space-pan remains available.

## Requirements

- REQ-001: Replace the full-width bottom help strip in the Sign-enabled Allocation Plan details viewer with the reference floating bottom-left toolbar: approximately 282 by 48 CSS pixels, white background, thin light-grey border, subtle shadow, rounded corners, and six evenly spaced icon buttons. At the reference 1512 by 982 viewport its left and bottom offsets are approximately 18 and 20 pixels from the main viewer boundary. Preserve the lower-right zoom pill and file selector; position zoom independently of the removed strip. Leave the legacy viewer without Sign support unchanged.
- REQ-002: Tool order MUST be Move (outlined pointer), hand, Add sign (circle-plus), dashed-rectangle-plus, line-plus and comment. Move is initially active and uses a blue approximately 34-pixel square with a white icon. Inactive icons use dark strokes; the four deferred tools remain disabled, expose their unavailable state accessibly and perform no action. Do not infer functionality from their shapes.
- REQ-003: In Move mode, clicking an existing Sign selects only that Sign and opens its existing drawer with the existing selection outline. A manager can drag that Sign using the existing move cursor, threshold, normalized coordinates, bounds, save, concurrency and failure handling. Selecting another Sign replaces the selection. Blank drawing clicks do not create Signs and clear selection only through existing unsaved-change protection. The drawing itself remains non-selectable as a managed object.
- REQ-004: Add sign is available only to users with MANAGE_SIGNS. Activating it enables the existing drawing crosshair, Add new hover hint and click/keyboard creation flow. It remains active after successful creation until Move is selected. Existing Signs remain clickable to inspect their drawers in Add sign mode, but pointer dragging and Alt-arrow repositioning require Move mode. Toolbar interactions never create Signs or pan the drawing.
- REQ-005: Move MUST suppress creation by both pointer and keyboard. Retain existing keyboard activation of Signs and Alt-arrow movement in Move mode. Space-pan temporarily overrides either tool without changing the selected tool and never creates or moves a Sign. Changing the plan/file resets the tool to Move and preserves existing cancellation and stale-response guards. Tool changes cannot bypass an in-flight mutation or unresolved-edit protection.
- REQ-006: Viewers can use Move to select/read Signs but cannot reposition or create them. Keep all existing server authorization unchanged. Tool state is local UI state only; no new persistence or backend permissions.
- REQ-007: Provide an accessible named toolbar, named buttons, active state via aria-pressed, visible keyboard focus and tooltips. Keep controls reachable and inside the viewer at narrow sizes and with the drawer open; avoid overlapping the zoom control. Add reusable toolbar and important states to Storybook.

## Acceptance scenarios

### AC-001 — Default selection [REQ-001, REQ-002, REQ-003, REQ-005]

- Given a loaded Allocation Plan file, when the viewer opens, then Move is active and the floating toolbar matches the reference.
- Given Move mode, when a user clicks blank drawing space or presses Enter on the drawing, then no Sign is created.
- Given two existing Signs, when the user clicks them successively, then only the last Sign is selected and shown in the drawer.

### AC-002 — Move and save [REQ-003, REQ-005, REQ-006]

- Given an authorized manager in Move mode, when they drag one Sign at any supported zoom, then only that Sign moves and its saved position survives reload.
- Given cancellation, a failed save or a stale record, when movement ends, then existing rollback/retry/reload protections remain intact.
- Given a Viewer or Space-pan, when dragging, then no Sign mutation occurs.

### AC-003 — Explicit creation [REQ-004, REQ-005]

- Given a manager, when Add sign is activated and the drawing is clicked, then the existing creation flow creates one shared Sign and opens its drawer.
- Given Add sign mode, when Move is activated, then the creation hint disappears and subsequent blank clicks create nothing.
- Given either mode, when a disabled tool or toolbar background is clicked, then no drawing action occurs.

### AC-004 — Accessibility and layout [REQ-001, REQ-002, REQ-006, REQ-007]

- Given keyboard navigation, a narrow viewport, a Viewer or an open drawer, when using the toolbar, then enabled controls remain reachable, labelled and visibly focused, active state is announced, and deferred controls do nothing.

## UX and accessibility

Use the supplied design for icon proportions, spacing, border, shadow and active colour. Preserve existing font and icon conventions. Use native buttons, accessible labels and truthful disabled descriptions. Retain keyboard zoom and Space-pan despite removing the help strip. No new keyboard shortcut letters are introduced.

## API and integrations

No API changes. Reuse existing Sign selection, creation and placement PATCH flows, including idempotency, optimistic concurrency and exact-origin protections.

## Data and migration

No database migration. Existing Sign records, positions, plan/file ownership and Site Signage Schedule synchronization are unchanged. Active tool is not stored server-side or across viewer sessions.

## Security and privacy

Retain session-derived Site Access and MANAGE_SIGNS checks. UI tool availability is not authorization. No new data collection, external service or telemetry payload.

## Reliability and observability

Reuse current mutation status messages, categorical events and retry/conflict flows. Prevent duplicate writes, accidental creation from drag release and stale responses after file changes. No new infrastructure or alarms.

## Test strategy

After approval, write failing tests mapped to REQ-001 through REQ-007 before implementation. Cover toolbar state/order, disabled controls, blank-click and keyboard suppression, mode switching, single selection, drag and keyboard movement gating, pan, read-only access and file reset. Run existing creation/movement regressions, typecheck, lint, build and Storybook build. Verify desktop and narrow browser layouts, drawer interaction and persisted dragging.

## Rollout and rollback

Use the existing Sign-enabled viewer boundary; no new feature flag or deployment migration. Upon approval this specification supersedes default click-to-create in `allocation-plan-signs` REQ-002/REQ-013, gates movement from `allocation-plan-sign-moving` by Move mode, and replaces the viewer bottom help-strip design only. All other accepted behavior remains. Revert this frontend change to restore the previous interaction model without altering saved data.

## Open questions

- None.
