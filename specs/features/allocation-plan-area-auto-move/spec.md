# Feature: Switch selected Areas to Move

- ID: `allocation-plan-area-auto-move`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-23`
- Domain references: `CONTEXT.md — Area, Allocation Plan, Sign, Site Access; docs/domain/figjam-object-catalog.md — Objects and data points (Allocation Plan and Sign), Organization roles and permissions, allocation-plan-add-sign-tool, allocation-plan-add-area and allocation-plan-area-transform amendments`
- Supersedes on approval: `allocation-plan-add-area REQ-002 and allocation-plan-area-transform REQ-001/005 where they require Add area to remain active after creation. Existing transformation, permissions and persistence rules otherwise remain unchanged.`

## Problem

After creating an Area, Add area stays highlighted and the drawing retains a crosshair. Users expect the selected Area to be in Move mode, consistent with successful Add sign creation.

## Outcome and success metrics

Successful creation or selection of an existing Area activates Move, displays the editing cursors, and leaves the Area selected with its details and resize handles. Users can immediately drag or resize it without changing tools manually.

## Non-goals

- Changes to geometry, metadata, permissions, Area ownership, API, database or Sign behavior.
- Changing Floor selection into immediate creation; users still draw the rectangle.

## Requirements

- REQ-001: Choosing Floor from Add area MUST retain the drawing cursor while the user defines a rectangle. Only after successful creation, including a successful retry, switch the active toolbar tool to Move. Retain the created Area selection, details drawer and eight resize handles for managers. Failed or cancelled creation MUST NOT trigger this switch or create an annotation.
- REQ-002: Selecting an existing Area with a click or keyboard activation MUST switch to Move after current pending/unsaved-change guards permit selection. Retain the chosen Area and its drawer. Selection during Hand/Space-pan MUST NOT interrupt panning. Viewers retain read-only details without transformation handles.
- REQ-003: Move MUST use the existing default drawing cursor, a move cursor over editable Area bodies/labels and directional resize cursors over handles. The toolbar's Move button MUST expose its active state. Re-entering Add area must be explicit before drawing another Area.
- REQ-004: Preserve immediate body/label dragging and all eight resize handles. A pointer gesture that selects an Area while Add area is active MUST NOT be cancelled by the automatic tool transition; commit the transition before starting the gesture or after the gesture ends. Ordinary user tool changes still cancel unfinished gestures. Preserve keyboard focus, concurrency, retry and stale-response protection; a response for an old plan/file MUST NOT change the current tool.

## Acceptance scenarios

### AC-001 — Create then edit [REQ-001, REQ-003, REQ-004]

- Given Add area and Floor selected, when drawing is unfinished, then the drawing cursor remains and no automatic Move transition occurs.
- Given successful pointer or keyboard creation, when saving completes, then Move is active, the new Area remains selected, and dragging/resizing works immediately.
- Given failed creation, when retry succeeds, then only one Area appears and Move becomes active; cancellation creates nothing.

### AC-002 — Select then edit [REQ-002..REQ-004]

- Given an existing Area and Add area active, when selecting its body or label, then Move activates and only its details drawer is visible.
- Given a body/label drag that selects the Area, when released, then the move is saved once rather than lost during the automatic tool transition.
- Given an unsaved draft, pending write or Hand/Space-pan, then existing selection guards and pan behavior remain effective.
- Given a Viewer, when selecting an Area, then details remain read-only and no resize handles appear.

## UX and accessibility

Keep the supplied Move toolbar icon and active styling. Preserve focus on the Area after keyboard creation/selection and on a handle after keyboard resizing. Toolbar aria-pressed reflects Move. Keep drawing, move and resize cursors distinct; no drawer input should invoke drawing shortcuts.

## API and integrations

No API or integration changes. Use the existing Area create/update endpoints and idempotency behavior.

## Data and migration

No schema, migration or data changes. Tool selection remains local UI state.

## Security and privacy

Retain Site Access and MANAGE_SIGNS protections. Automatic tool selection grants no additional capabilities and introduces no telemetry containing user content.

## Reliability and observability

Switch after a current successful creation or accepted selection only. Preserve unsaved-change guards, cancellation and stale-response handling. Existing request/error events suffice; no new monitoring infrastructure.

## Test strategy

After approval, update tests first for active Move after pointer/keyboard creation, retry and existing Area selection; verify the initial Floor drawing cursor remains. Cover selection-drag continuity, keyboard focus, Viewer, pan, dirty state and old responses. Update Storybook and run focused unit/browser regressions, lint, types and builds; report existing aggregate verification blockers separately.

## Rollout and rollback

Frontend-only change on main after separate specification approval. Smoke-check Floor → draw → Move → drag/resize, then explicitly re-enter Add area to create another rectangle. Revert the UI change if selection or gesture continuity fails; saved Areas are unaffected.

## Open questions

- None. This proposal interprets selection as selecting an existing Area or completing its creation; Floor menu selection still begins drawing.
