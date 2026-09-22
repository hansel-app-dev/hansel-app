# Feature: Move placed Signs

- ID: `allocation-plan-sign-moving`
- Status: `approved`
- Approval: User approved in conversation on 2026-09-15.
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-15`
- Domain references: `CONTEXT.md — Sign, Allocation Plan, Site Access, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Sign and Allocation Plan), Nesting map, Organization roles and permissions, Known ambiguities 10`
- Design authority: User-supplied `Plan_ Plan dropdown.png` and request to show a move cursor and allow moving a Sign.

## Problem

Placed Signs cannot currently be repositioned. Authorized users must be able to move an existing Sign without creating another Sign or changing its schedule data.

## Outcome and success metrics

Authorized users can reposition the same Sign and recover its saved location after reload, without creating another Sign or changing its schedule data.

## Non-goals

Upon approval, supersedes only the marker-dragging exclusion in `allocation-plan-signs`. Existing creation, selection, drawer, sharing, deletion and permission requirements remain unchanged. No cross-file moves, marker resizing, rotation by dragging, bulk moves or new Signs.

## Requirements

- REQ-001: Users with MANAGE_SIGNS see `cursor: move` over an existing Sign's icon and code badge. Viewers may select Signs but cannot move them and do not see the move cursor.
- REQ-002: Primary-pointer dragging moves only the targeted Sign, with a live preview. A movement threshold of 3 CSS pixels distinguishes dragging from clicking. A click without dragging retains existing drawer selection. Dragging never triggers Add new or creates a Sign.
- REQ-003: Keep the initial pointer-to-Sign offset. Calculate movement in normalized drawing coordinates, respecting current zoom and scroll. Clamp the Sign anchor to the drawing boundaries; never change its plan or file. Marker size stays constant on screen.
- REQ-004: Save the final coordinates once on release. Atomically update placement and the shared Sign's updatedAt with optimistic concurrency. Preserve code, quantity, content, appearance and schedule membership. Reloading the plan restores the saved location.
- REQ-005: Prevent overlapping writes and movement during Space-pan or unresolved drawer edits. Escape, pointer cancellation or file changes cancel an unsaved drag and restore its previous location. After release, show saving/error states; failure restores the saved location with retry, while conflicts require reload instead of overwriting.
- REQ-006: Strictly validate finite x/y in [0,1] and expectedUpdatedAt. Reuse session-derived tenant, Site Access, plan/file/Sign ownership, MANAGE_SIGNS, exact Origin, private/no-store and categorical logging. Reject unauthorized moves without altering data.
- REQ-007: Provide keyboard movement on a focused Sign using Alt+arrow keys, each moving 1% of the drawing and saving through the same guarded path. Plain arrows on the drawing retain existing placement behavior. Announce save failures accessibly.

## Acceptance scenarios

### AC-001 — Move and persist [REQ-001, REQ-002, REQ-003, REQ-004]

Given a manager and a placed Sign, dragging its icon/badge shows the move cursor and moves that same Sign; after release and reload its new position persists and the schedule still contains the same unchanged record.

### AC-002 — Coordinates and cancellation [REQ-002, REQ-003, REQ-004, REQ-005]

Given zoom, scroll or Space-pan, dragging keeps the correct drawing-relative position, never creates a Sign, respects bounds, and cancellation restores the original location. A plain click still opens the drawer.

### AC-003 — Guarded movement [REQ-005, REQ-006, REQ-007]

Given a Viewer, foreign tenant, stale updatedAt or failed request, movement is rejected or rolled back safely. Authorized keyboard moves persist through the same API.

## API and integrations

Extend the existing plan Sign PATCH contract with paired x/y coordinates: both or neither must be supplied. Update placement and shared Sign timestamp in one transaction. Update OpenAPI alongside implementation.

## Data and migration

No database migration or separate Sign records are needed. Placement and the shared Sign timestamp update atomically; other Sign attributes remain unchanged.

## UX and accessibility

Preserve click selection, show the authorized move cursor and live preview, and support Alt+arrow movement on a focused Sign. Announce failures accessibly. Add Storybook draggable, dragging, read-only and failure states.

## Security and privacy

Reuse session-derived tenant, Site Access, plan/file/Sign ownership, MANAGE_SIGNS, exact Origin and private/no-store controls. Reject unauthorized moves without altering data.

## Reliability and observability

Prevent overlapping writes. Cancel unsaved drags safely; failed saves restore the saved location with retry, while conflicts require reload. Retain categorical logging.

## Test strategy

Test pointer threshold, cursor, drag offset, zoom/pan, bounds, cancellation, keyboard, persistence, concurrency and tenant/role checks before production code. Run affected unit/integration/browser tests, types, lint and builds.

## Rollout and rollback

Use the existing allocationPlanSignsEnabled flag; disabling it remains the rollback path without deleting data.

## Open questions

- None.
