# Feature: Move Allocation Plan comment pins

- ID: `allocation-plan-comment-moving`
- Status: `approved`
- Approval: User explicitly approved this specification in the Codex task on 2026-09-27.
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-27`
- Domain references: `CONTEXT.md — Allocation Plan Comment, Allocation Plan, Site Access, Membership, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Allocation Plan Comment, Allocation Plan), Nesting map, Organization roles and permissions, Known ambiguities 7–10, Current implementation alignment (Allocation Plan Comment), How feature work must use this catalog (allocation-plan-comments amendment)`
- Design authority: User request to drag the comment icon after placing it in Allocation Details; existing comment-pin appearance and viewer interaction patterns.
- Supersedes on approval: `allocation-plan-comments Non-goals (moving saved pins), REQ-004 (immutable position), Open questions (fixed pin positions), CONTEXT.md Allocation Plan Comment fixed-position wording and the catalog's fixed-position amendment only. Other discussion, attachment, resolution and access requirements remain authoritative.`

## Problem

Allocation Plan comment pins can be placed but not repositioned. Users need to correct their drawing location without discarding a draft or recreating a saved discussion. The existing approved specification intentionally forbids movement; this amendment explicitly changes that decision.

## Outcome and success metrics

A participant can drag a temporary or saved open-thread comment icon within its drawing. A temporary pin retains its draft; a saved pin retains its entire discussion and reloads at its new position. Clicking still opens the thread, and panning never moves or creates a comment.

## Non-goals

- Moving pins across Allocation Plans/files, moving resolved pins before reopening, deleting/editing discussion text, resizing pins or bulk movement.
- Changing Sign/Area/Linear behavior, authorship, notifications, discussion permissions or attachment ownership.

## Requirements

- REQ-001: In Move or Add comment, authenticated participants with current Site Access and COMMENT capability, including Viewers, MUST be able to move any saved open-thread pin on the accessible Allocation Plan/file. This follows the existing all-participant discussion/resolution scope; MANAGE_SIGNS and authorship are not required. Resolved pins MUST remain selectable for history/reopen but immovable until reopened. Verify permission and ownership on every server mutation.
- REQ-002: Primary-pointer dragging MUST move only the targeted pin after a 3 CSS pixel movement threshold, show a move cursor and live preview, preserve the initial pointer-to-pin offset, and suppress the subsequent click/placement action. A pointer click below the threshold MUST retain existing selection/card behavior. Dragging MUST never create another thread, Sign or annotation.
- REQ-003: Coordinates MUST remain normalized, finite and bounded to [0,1] relative to the source drawing. Use the current rendered drawing bounds under zoom and scrolling, clamp the pin anchor to its edges and preserve its plan/file association. Keep the existing pin appearance and screen sizing. An open discussion card MUST follow the previewed pin and remain within the viewer using the existing positioning logic.
- REQ-004: A temporary pin MUST be draggable in Add comment without a server mutation. Preserve its draft ID, text, attachments, mentions, retry key and card; a later root submission MUST use the final position. A drag canceled before release MUST restore the previous draft position. After a failed submission, do not reuse its submission key with changed coordinates: retain the original payload for retry, or reconcile the original result before permitting movement.
- REQ-005: A saved-pin move MUST send exactly one coordinate update on release, only when the final position differs from the persisted position. Atomically update paired x/y and the thread's updatedAt using expectedUpdatedAt. Preserve thread/comment IDs, root author, creation times, text, replies, attachments, mentions and resolution metadata. Return the canonical updated thread and reconcile it locally. Reload MUST restore the saved location.
- REQ-006: Hand or Space-pan MUST take precedence over pin movement. Escape, pointer cancellation, lost capture, tool/plan/file changes or unmount MUST cancel an unsaved drag and restore its previous position. Capture the pointer for an active gesture. Prevent overlapping moves and thread state/submission writes; after release block conflicting actions until saving settles. Preserve unsent reply text when moving the same selected pin; selecting another pin uses the existing draft-discard guard. Keep other viewer dirty/pending guards intact.
- REQ-007: Failed saves MUST restore the last canonical coordinates and retain the discussion/draft, announce a categorical error and offer retry using the intended coordinates and original concurrency token. Stale updates or a thread resolved elsewhere MUST produce 409 and require reload before another move. Ignore stale responses after plan/file changes. An uncertain save retry MAY return success without changing updatedAt again when the current coordinates already equal the desired coordinates and the thread remains open; a stale request MUST never overwrite a different current position or change resolution state.
- REQ-008: Add a strict plan/file/thread-scoped position request containing only x, y and expectedUpdatedAt; reject missing, non-finite, out-of-bounds or unknown fields and inaccessible/deleted/foreign parents without mutation or disclosure. Use existing sessions, exact-Origin checks, private no-store responses, feature flag and categorical errors/logs. Never log coordinates or discussion content.
- REQ-009: A focused saved open-thread pin MUST support Alt+arrow movement in 1% drawing steps through the same guarded save path. Preserve ordinary activation and existing drawing keyboard placement behavior. Expose movement instructions, visible focus, saving/error announcements and no keyboard trap. Temporary pin repositioning MUST also be accessible through a keyboard control in its composer, moving in 1% steps without submitting or losing text.
- REQ-010: Add Storybook states and requirement-linked tests for draft/saved movement, live preview, saving, error/conflict, Viewer participation, resolved history, keyboard operation and zoom/scroll bounds. Update canonical/domain documentation and the previous specification's supersession note. Record checks and a commit verified on origin/main.

## Acceptance scenarios

### AC-001 — Move a saved discussion [REQ-001..003, REQ-005, REQ-010]

- Given any participating role, including Viewer, and an accessible saved open-thread pin
- When they drag its icon and release at a different drawing location
- Then only that thread's coordinates and updatedAt change once, its card follows it, and the same discussion reloads at that position
- And clicking without a drag still opens its discussion.

### AC-002 — Move before submission [REQ-002..004, REQ-006, REQ-009]

- Given a temporary pin and unsent text, mentions or attachments
- When the participant drags or keyboard-repositions it before submitting
- Then the draft remains intact, no position request is sent, and root submission persists the final position
- And an uncertain failed submission cannot be duplicated by moving and reusing a key with a different payload.

### AC-003 — Coordinates, cancellation and panning [REQ-002, REQ-003, REQ-006, REQ-009]

- Given zoomed/scrolled drawing content, edge positions, keyboard use or Hand/Space-pan
- When movement is attempted, canceled or completed
- Then geometry remains drawing-relative, stays bounded, cancellation restores its original position and panning neither moves nor creates a pin
- And pending operations and dirty drafts remain guarded.

### AC-004 — Failures, concurrency and isolation [REQ-001, REQ-005..008]

- Given a failed request, stale timestamp, resolved thread, revoked access, foreign plan/file, deleted parent or obsolete response
- When a position update is attempted
- Then the client preserves discussion and canonical coordinates with the specified retry/reload feedback and the server performs no unauthorized or stale overwrite
- And replay of an already-applied open-thread position does not create new data or change resolution metadata.

### AC-005 — Resolved history and accessible states [REQ-001, REQ-009, REQ-010]

- Given Show resolved, 320 CSS pixels, 200% zoom or keyboard-only use
- When a participant selects history, reopens a thread or moves a pin
- Then resolved pins remain read-only until reopened, movement controls remain accessible and the existing card remains usable.

## UX and accessibility

Reuse the existing blue author-initial pin and muted resolved appearance. Show the move cursor only for movable open pins or an eligible draft. Dragging the current selected pin preserves the open card and reply draft. Keep native pin buttons and visible focus; add concise Alt+arrow instructions for saved pins and an accessible keyboard position control for the temporary composer. Movement errors use the existing local comment feedback region.

## API and integrations

Add `PUT /api/sites/{siteId}/allocation-plans/{planId}/files/{fileId-or-legacy}/comments/{threadId}/position` with strict `{ x, y, expectedUpdatedAt }` and a canonical Allocation Plan Comment thread response. Use existing 400/401/403/404/409/503 conventions and feature gating. Resolve/reopen continues through its existing state endpoint and shares the thread concurrency timestamp. Revalidate access, plan/file/thread ownership and open state transactionally; successful no-op replay requires the desired coordinates to match current coordinates. Update shared contracts, client API and OpenAPI after approval. No external integration is added.

## Data and migration

Reuse existing AllocationPlanCommentThread x/y, updatedAt and ownership constraints. No schema migration, backfill or new object is needed. Keep thread order based on original createdAt/ID. Saved movement changes only coordinates and the concurrency timestamp; draft movement is local until initial publication. Coordinates must update atomically with state/concurrency checks so a concurrent resolution or deletion cannot race a move.

## Security and privacy

All current Site-access participants with COMMENT may move open pins, matching accepted discussion/resolution participation. Server-side checks are authoritative. Preserve legacy-file validation and cross-Organization/Site/plan/file isolation. Render discussion as safe text, keep attachments private and omit pin coordinates, thread text and identifiers from categorical telemetry.

## Reliability and observability

Use one guarded write per completed gesture, local preview and rollback, and existing categorical request/failure/conflict events. Do not claim realtime synchronization. Preserve current paging and stale-response protection. Uncertain requests can be retried without changing discussion ownership or silently overwriting a different position.

## Test strategy

After approval, write failing strict-contract, route/service, real database and component/browser tests before implementation. Cover paired finite coordinates, access including Viewer, open/resolved state, stale timestamps, retry/no-op semantics, transaction races, unchanged discussion/attachment data and reload persistence. Cover drag threshold and click suppression, pointer offsets/capture/cancel, drawing boundaries under zoom/scroll, card anchoring, draft preservation and retry keys, dirty/pending guards, keyboard operation and other viewer tools. Add Storybook states and run relevant spec, formatting, lint, types, unit coverage, builds and browser checks; report broader existing failures explicitly.

## Rollout and rollback

Commit and push this specification separately and obtain explicit approval before application changes. Implement with the existing Allocation Plan Comments feature flag and no new migration. Verify locally, review the staged implementation/tests/docs diff, commit and push directly to main and verify the remote commit. No production deployment is authorized. Rollback restores fixed-pin interaction while retaining the most recently saved coordinates and all discussion data; do not reset moved pins or delete threads.

## Open questions

- None. Approval accepts movement of temporary and saved open pins, all-current-participant movement permission, resolved pins remaining read-only until reopened, and the specified guarded persistence and keyboard behavior.
