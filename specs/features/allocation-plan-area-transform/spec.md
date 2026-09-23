# Feature: Drag and resize saved Areas

- ID: `allocation-plan-area-transform`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-23`
- Domain references: `CONTEXT.md — Area, Allocation Plan, Sign, Site Access, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Allocation Plan and Sign), Organization roles and permissions, Known ambiguities 10, Current implementation alignment, allocation-plan-add-area amendment`
- Supersedes on approval: `allocation-plan-add-area REQ-009's Move-only editing and deferred resizing, its resizing non-goal, and its immutable dimensions API restriction. Other approved Area behavior remains in force.`

## Problem

Creation leaves Add area active, but saved Areas currently drag only in Move mode. Users need to reposition an Area immediately after creation and adjust its size without recreating it. The current contract rejects width/height updates.

## Outcome and success metrics

A manager can drag a newly created Area immediately, resize any saved Area using visible handles, and reload its saved position and dimensions. No duplicate annotation or Sign is created during these interactions.

## Non-goals

- Rotation, polygons, aspect-ratio locking, snapping, multi-selection, bulk transformations, or numeric size fields.
- Changes to Area metadata, fixed Floor/Environmental/Blue choices, ownership or Signage Schedule behavior.

## Requirements

- REQ-001: In Move mode and in Add area mode when no new rectangle is armed, managers MUST be able to drag a saved Area by its body or outside label. Select the Area at gesture start, preserve the pointer offset and dimensions, preview within drawing bounds, and save once on release after the existing 3 CSS pixel movement threshold. Creation continues to leave Add area active. While new rectangle creation is armed, existing Area interactions MUST NOT start a move or resize; Escape returns to ordinary Area editing.
- REQ-002: A selected editable Area MUST show eight handles: four corners and four edge midpoints. Corner handles adjust two edges; edge handles adjust one edge. Keep the opposite edges fixed and clamp at drawing boundaries. Prevent crossing the fixed edge; preserve positive dimensions with a minimum of 4 CSS pixels per changed dimension at the current drawing scale. If an existing dimension is smaller than this minimum, allow expansion and do not enlarge it merely by selecting. Use normalized drawing coordinates so zoom, scrolling and the drawer do not shift geometry. Keep the label outside the rectangle and attached to its current preview.
- REQ-003: Resize MUST preview locally and persist x, y, width and height atomically once on valid release. A click without geometry change MUST NOT write. Failed saves restore the saved rectangle and retain the intended transform for Retry; stale timestamps require reload. Do not allow concurrent writes, dirty metadata loss, or responses from an old plan/file to affect the current view.
- REQ-004: Escape, pointer cancellation/lost capture, tool/plan/file changes, permission loss, window blur, scrolling, or viewport/zoom changes MUST cancel unfinished move/resize previews without saving. Hand and Space-pan MUST never move or resize Areas. Viewers can inspect but cannot transform Areas and see no editable handles. Existing Site Access and MANAGE_SIGNS authorization remains mandatory at the API.
- REQ-005: Handles MUST be named, keyboard-focusable controls with visible focus and at least 24 CSS pixel hit targets around compact visual handles. Enter/Space starts keyboard resize on a focused handle; arrows adjust its applicable edge(s) in 1% drawing steps, Enter saves and Escape cancels. Tab cancels an unfinished keyboard preview and moves focus normally. Keep existing Alt+arrow movement, including immediately after creation when Add area remains active and no new rectangle is armed. Announce resize instructions and saving/failure states. No drawing shortcuts may consume drawer input.
- REQ-006: Extend Area PATCH to accept a complete normalized geometry tuple x/y/width/height with expectedUpdatedAt. Preserve existing metadata-only and paired x/y movement requests. Reject partial resize tuples, non-finite values, nonpositive dimensions and out-of-bounds extents. Validate the complete resulting rectangle on the server; retain optimistic concurrency and tenant/file ownership protections. Area identity, code and unrelated metadata MUST remain unchanged by transformation.
- REQ-007: Add Storybook selected/handles, resizing preview, keyboard resize, pending, failure and Viewer states. Verify label/body dragging, all eight resize directions, drawing boundaries, narrow viewports and 200% zoom. Point Signs remain above Area fills and independently selectable.

## Acceptance scenarios

### AC-001 — Drag immediately after creation [REQ-001, REQ-003, REQ-004]

- Given a newly created Area with Add area still active, when its body or outside label is dragged, then its location changes without changing size or creating another record, and persists after reload.
- Given Move mode, when dragging an existing Area, then the same behavior holds.
- Given armed creation, Hand, Space-pan, Viewer or a pending write, when attempting a transform, then no transform write occurs.

### AC-002 — Resize and persist [REQ-002, REQ-003, REQ-006]

- Given a selected Area, when each corner or edge handle is dragged, then only the intended edges move, the opposite edges stay fixed, and one complete bounded rectangle is saved on release.
- Given a drawing boundary or attempted edge crossing, then the rectangle remains within bounds with positive size.
- Given a saved resized Area, when reloaded, then geometry matches and its code/content/orientation and the Signage Schedule remain unchanged.

### AC-003 — Recovery, access and keyboard [REQ-003..REQ-007]

- Given a gesture, when cancelled or interrupted, then the saved geometry is restored without a write.
- Given a save failure or stale timestamp, then retry or reload preserves concurrency protection and never creates a new Area.
- Given keyboard-only use, when focusing a handle, starting resize, adjusting with arrows and pressing Enter, then one resize is saved; Escape or Tab cancels without saving.
- Given Viewer or foreign Site/Organization access, then transform writes are rejected. Given narrow/zoomed layout, then handles and label remain reachable.

## UX and accessibility

Use the existing blue dashed Area outline with compact white/blue handles, directional resize cursors and a move cursor over editable bodies and labels. Handles appear only on the selected Area in eligible editing modes. Keep the outside label placement and existing single-drawer selection protection. Separate handle controls from the Area button to avoid nested interactive elements. Maintain focus through saves and expose status through the existing live region.

## API and integrations

Update the Area PATCH shared contract, OpenAPI and service for complete geometry writes. Existing clients sending x/y or metadata remain compatible. No new endpoint or external integration. Retain existing request limits, exact Origin checks, session authentication and private/no-store responses.

## Data and migration

Use existing PlanArea x/y/width/height columns and bounded geometry constraints. No database migration, backfill or ownership change is required. Store the whole transform in the same guarded transaction with updatedAt.

## Security and privacy

Use current Site Access and MANAGE_SIGNS checks. Never trust client ownership. Validate geometry server-side even when UI controls are disabled. Do not log Area content, codes, pointer positions or authentication material.

## Reliability and observability

Reuse Area categorical success/failure events, expectedUpdatedAt conflicts and bounded transaction retries. Save only committed gestures and preserve the intended transform for retry on ordinary failures. No new telemetry service or infrastructure is required.

## Test strategy

Implement test-first after approval. Cover geometry for eight handles, bounds, minimum size, zoom and no-op gestures; contract validation and compatibility; real database resize persistence, concurrency, permissions and unchanged metadata; immediate post-create body/label dragging; cancellation, retry, keyboard operations and interaction with Signs. Run focused unit/integration/browser suites, coverage, lint, typecheck, specification checks and builds. Record pre-existing aggregate gate failures separately.

## Rollout and rollback

Deploy the backwards-compatible API before the resize UI under the existing Area feature gate. Smoke-check create → drag → resize → reload. Roll back the UI first if transforms fail; preserve saved dimensions and existing data. No destructive database rollback is needed. Commit and push this specification separately and obtain explicit approval before application changes.

## Open questions

- None. Approval accepts the proposed eight handles, immediate editing in Add area mode, and keyboard interaction described above.
