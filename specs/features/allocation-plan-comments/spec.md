# Feature: Allocation Plan Comment tool

- ID: `allocation-plan-comments`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-23`
- Domain references: `CONTEXT.md — Allocation Plan Comment, Allocation Plan, Sign Comment, Site Comment, Site Access, Membership, Organization Role, Image and Document; docs/domain/figjam-object-catalog.md — Objects and data points (Allocation Plan Comment, Allocation Plan, User, Image and Document), Canonical interpretation notes, Nesting map, Organization roles and permissions, Known ambiguities 7–10, Current implementation alignment, How feature work must use this catalog (sign-comments, allocation-plan-toolbar and allocation-plan-tool-cursors)`
- Design authority: `references/composer.png and references/thread.png. User explicitly confirmed plan-owned comments independent of Signs/Schedule, participation by all Site-access roles, reuse of existing attachment/mention/emoji behaviors, and resolving threads with access to view and reopen them.`
- Supersedes on approval: `The disabled sixth toolbar tool and source-only Allocation Plan Comment scope. Existing Sign Comments retain their own ownership and decorative checkmark; no change to Sign, Area or Linear behavior.`

## Problem

The sixth toolbar button is disabled. Users need to pin discussions to locations on an Allocation Plan, reply in place, and mark discussions resolved without losing their history.

## Outcome and success metrics

A Site participant can click a drawing location, submit one persistent comment thread, reopen its pin, reply, resolve and reopen it. Pin coordinates and discussion remain associated with the same Allocation Plan/file after reload, zoom and scroll. Retries never duplicate a thread, reply or attachment. No Sign, Schedule row or Site Activity comment is created.

## Non-goals

- Sign-linked comments, Signage Schedule comment-cell synchronization, Site Activity events, notifications, email or realtime updates.
- Moving saved pins, editing/deleting individual comments or threads, nested replies beyond one visual level, bulk resolution, rich HTML, attachment previews or a media library.
- Changing existing Sign Comments or copying attachments into Sign Docs/Photos.

## Requirements

- REQ-001: Model a pinned discussion as an Allocation Plan Comment thread owned by one Allocation Plan and its file, within its Site and Organization. It MUST remain independent of Signs, Areas and Linear placements. All authenticated roles with current Site Access and COMMENT capability, including Viewers, may read, create, reply and use attachments/mentions/emoji. Proposed resolution permissions for approval: the same participants may resolve or reopen any thread on that accessible plan. Check access on every server operation; MANAGE_SIGNS is not required.
- REQ-002: Enable the sixth tool as Add comment for participants with COMMENT capability, independently of Sign-management permission. Use the supplied toolbar artwork, blue active state and supplied Comment cursor at 3x asset density (one-third native size). In Add comment, a primary click on blank drawing content captures a normalized bounded x/y position and opens the empty floating composer beside a temporary blue speech-bubble pin. Existing object controls still select their object; do not attach to an underlying Sign automatically. Opening or canceling an empty composer creates no published thread. Focus its textarea. Successful root submission selects the saved thread, opens its discussion card and switches to Move, matching the second reference.
- REQ-003: Match the references: approximately 262px-wide composer/card, subtle light background, rounded border/shadow, compact 13–14px text, text field above a separated attachment/@/emoji/Submit footer. Empty Submit is disabled. A new composer has blue focus treatment and a plain blue pin; a saved pin shows the root author's initials in white on blue. Thread header says Comment with Resolve/Reopen and Close controls; body shows real author initials/name, relative timestamp with accessible absolute time, text and replies, then a Reply composer. Never seed screenshot authors/messages. Hide other detail drawers through existing draft guards when opening a comment and vice versa.
- REQ-004: Keep pin coordinates relative to the source file, independent of zoom, scrolling and popover dimensions. Pin, text and controls remain legible at supported zoom levels. Fit/flip the card within the visible viewer; on narrow screens use a bounded overlay within the viewer, with independently scrolling thread content and reachable composer. Keep the card anchored to the same pin when scrolling/zooming. Only one comment card or draft is open at a time. Pin placement is immutable in this version; dragging/panning never creates or moves it. Existing saved pins are selectable in Move or Add comment, while Hand/Space-pan takes precedence.
- REQ-005: Persist root text and one visual level of replies; all replies target the root thread, with oldest-first creation-time/ID ordering. Use paginated thread comments, up to 50 entries per page. Initial thread text and pin creation are atomic. Reuse existing Sign Comment content rules: up to 5,000 Unicode code points, five attachments and twenty distinct mentioned Memberships per submission; require non-whitespace text or at least one verified attachment. Enter inserts newline; Submit or Ctrl/Cmd+Enter submits. Disable duplicate submission and submit while uploads are pending or failed. Stable keys bind author, Organization, plan/file, thread or root position, and full draft; retry returns the same result and changed-payload key reuse conflicts.
- REQ-006: Implement the header checkmark as Resolve for an open thread. Resolution is an idempotent desired-state update of the root thread, including actor and timestamp, guarded against stale opposing changes. Resolving retains the complete discussion and attachments, closes the selected card and hides its pin from the default open-thread view. Add a compact Show resolved toggle near the Allocation Plan selector, adapting without overlapping toolbar/zoom controls. When enabled, include resolved pins with a distinguishable muted/checkmarked state and accessible Resolved label. Selecting one opens retained history and a Reopen action. Proposed reply behavior for approval: resolved history is read-only until reopened; Reopen restores the ordinary pin and reply composer. All participants described in REQ-001 may perform these actions. No individual reply has its own resolution state.
- REQ-007: Reuse attachment behavior from Sign Comments for PNG/JPEG/PDF, each nonempty and at most 5,242,880 bytes, up to five per submission and three concurrent transfers. Validate bytes, actual type and checksum server-side before publication; fully decode images with existing 40-megapixel/timeout limits and metadata-free thumbnails, and validate PDF signatures with the existing private upload pattern. Show per-file progress/error/retry/removal. Draft uploads are private to their uploader and plan/file until atomically claimed by a submitted root or reply; no cross-plan/thread/author claim is accepted. Images display compact thumbnails with accessible downloads; PDFs display filename/download rows. Neither opens a larger preview. Preserve existing bounded upload and durable cleanup behavior; do not claim malware scanning.
- REQ-008: Typing @ or activating the @ button opens searchable, keyboard-accessible eligible Memberships with current Site access, excluding pending invitations and inaccessible members. Revalidate selected identities during submission; revoked mention targets preserve the draft and require removal/reselection. Render structured mentions in blue and plain text safely. Mentions send no notifications. Emoji button inserts ordinary emoji text using the existing palette (👍, 👎, ❤️, 🎉, 😄, 👀). Per-comment reaction controls are outside this initial pinned-card design scope; existing Sign Comment reactions are unchanged.
- REQ-009: Protect unsent text, replies and draft attachments on card close, selection, tool/plan changes and navigation using discard confirmation; block switching during submission or attachment finalization. An empty draft can close without confirmation. Escape dismisses an open picker first, then closes the card through the same guard. Failed submission retains the complete draft and original retry key. Failed resolve/reopen leaves the current pin/history intact with retry; a conflicting opposing action requires reload. Ignore stale reads/responses after closing or switching plan/file, and cancel transfers appropriately. Sign, Area, Linear, toolbar and comment controls must coordinate pending/dirty state so no draft is silently lost.
- REQ-010: Store comments, authorship, mentions, attachments, coordinates and resolution separately from Sign discussion. Support the existing legacy null-file plan shape only when that plan has verified legacy content; otherwise validate the plan's single completed file. Deleting the Allocation Plan or Site removes its thread records and revokes attachment access while retaining durable object-cleanup work. Deleting a Sign has no effect on plan threads. A deleted parent cannot receive a late submission or upload claim. Draft uploads expire after 15 minutes if unverified and 24 hours after verification if unsubmitted, using existing cleanup grace/retry rules.
- REQ-011: Provide keyboard placement: with the drawing focused in Add comment, arrows position a visible cursor in 1% steps (center initially), Enter opens the composer and Escape cancels. Focus the new saved pin after successful keyboard submission without stealing focus from another control; activating a pin opens the card. Name pins by author and a short text preview, with resolved state when applicable. Provide visible focus, accessible picker controls, status/error announcements and no keyboard trap. Close restores focus to the pin or drawing. Space inside the textarea remains text and does not trigger plan panning.
- REQ-012: List markers in deterministic creation-time/ID order, with paginated reads of up to 100 threads per page and an accessible Load more comments control when needed; show loading, empty and retryable error states. Proposed bounded capacity for approval: at most 5,000 threads per Allocation Plan (open plus resolved); return a recoverable capacity error without publishing a partial thread. No commercial plan allowance change is implied. Add Storybook examples for empty composer, populated thread/reply, attachments, mentions, emoji, Viewer, pending/failure, resolved/history and narrow/zoomed layouts. Verify all existing toolbar workflows remain functional.

## Acceptance scenarios

### AC-001 — Pin and submit [REQ-001..005, REQ-009, REQ-011]

- Given an accessible plan and any participating role including Viewer, when Add comment → drawing click → valid Submit is completed, then exactly one plan-owned thread and pin persist and Move becomes active with the thread open.
- Given empty/canceled input or panning, then no published thread or Sign is created.
- Given a lost response and retry, then one thread exists with the original position and draft content.

### AC-002 — Discuss with media and mentions [REQ-003..005, REQ-007..009]

- Given a saved pin, when opened and replied to, then real authorship, timestamps and one-level discussion persist after reload.
- Given valid files, mentions and emoji, when submitted, then authorized participants see the content while foreign users and draft-attachment claims are rejected.
- Given failed upload/submission or a revoked mention target, then the draft remains available for correction/retry.

### AC-003 — Resolve and reopen [REQ-001, REQ-006, REQ-009]

- Given an open thread, when a participant resolves it, then its pin leaves the default view while discussion/attachments remain stored.
- Given Show resolved enabled, when selecting a resolved pin and reopening it, then its history is visible and replies become available again.
- Given repeated desired-state requests or stale opposing changes, then state remains consistent without duplicate records or silent overwrites.

### AC-004 — Isolation and lifecycle [REQ-001, REQ-005, REQ-007, REQ-010, REQ-012]

- Given a foreign Organization/plan/file, revoked Site access, foreign attachment or deleted parent, when any operation is attempted, then access or mutation is rejected.
- Given parent deletion or abandoned uploads, then private access is revoked and cleanup work remains durable; Sign deletion does not remove plan comments.
- Given pagination or capacity reached, then existing history remains readable and no partial submission is published.

### AC-005 — Accessible viewer integration [REQ-002..004, REQ-009, REQ-011, REQ-012]

- Given keyboard-only use, 320px width, 200% zoom, scrolling or an existing dirty Sign/Area draft, when using the Comment tool, then controls remain reachable, geometry stays aligned and draft guards work.
- Given existing Move, Hand, Add sign, Add area or Add linear, then their permissions, geometry, cursors and shared-selection behavior remain intact.

## UX and accessibility

Use the supplied composer/thread references, with functional resolution as explicitly requested. Show resolved is a new necessary control absent from the references, positioned near the plan selector rather than adding a seventh tool. Pins use stable root-author initials and accessible text; resolved state cannot rely only on colour. Keep the card approximately 262px wide where space permits and fully usable within the viewport at narrow widths. Reuse existing custom controls and comment picker patterns without carrying Sign-specific ownership into the UI.

## API and integrations

Add Allocation Plan/file-scoped marker listing, thread/history listing, atomic root/reply creation, resolve/reopen, mention search and private attachment intent/verification/read/download operations, documented in OpenAPI and shared strict contracts. Do not route these through Sign IDs. Pin listing includes resolution state and an expectedUpdatedAt token for state changes; root creation includes normalized x/y, fileId and a stable submission key. Reply submission validates the root is open and belongs to the same plan/file. Desired-state resolution replays succeed when already in that state; opposing stale changes return conflict. Use existing session, exact-Origin, validation, private/no-store, timeout and error conventions. No external messaging or notification integration.

## Data and migration

Use additive AllocationPlanCommentThread and AllocationPlanComment records (or equivalently named domain-specific models), plus structured mentions and plan-comment attachment ownership. Thread holds normalized coordinates, plan/file ownership, root author and resolution metadata; entries hold text/authorship and root linkage. Add composite ownership constraints and bounded-coordinate checks, state indexes and unique submission-key/digest records. No backfill from Sign or Site comments. Reuse private storage/verification utilities through explicit ownership boundaries; durable cleanup records must outlive parent deletion. Update CONTEXT.md and the catalog with the approved pinned-thread and resolution behavior during implementation.

## Security and privacy

Derive Organization identity from the session and revalidate Site Access/COMMENT on every operation, including reads, mention search, resolution and attachment downloads. Restrict unpublished attachments to their uploader; publish atomically with the owning comment. Render only escaped text and validated mention tokens. Do not disclose inaccessible Membership details or log comment text, coordinates, filenames, bytes, searches or signed URLs. Preserve content-size, image-decoding and transfer limits.

## Reliability and observability

Use transactional parent/state/attachment validation and retry-safe submission and resolution. Retain drafts on recoverable failures, bound network and decode work, and ignore stale results on plan changes. Reuse categorical request/verification/cleanup outcomes with correlation IDs, never discussion content. Document capacity errors, cleanup backlog recovery and smoke checks in a feature runbook. No realtime or polling guarantee is introduced.

## Test strategy

After separate approval, write failing contract, service, component and browser tests tied to the requirements. Cover Viewer participation, plan/file isolation, root/reply ordering and pagination, idempotency, concurrent reply/resolve, history/reopen, mention revalidation, attachment privacy/verification/cleanup, parent deletion races and dirty/pending guards. Verify both supplied layouts, keyboard creation, cursor density, zoom/scroll alignment, narrow cards and the other five tools. Run relevant unit coverage, real database integration, API checks, lint, typecheck, builds, Storybook and browser tests; report unrelated existing failures explicitly.

## Rollout and rollback

Publish this specification separately for approval before application changes. Back up local data and apply additive migrations before API/web enablement. Add an Allocation Plan Comments feature flag, default off in production, independent of Sign management; existing Sign Comments flags remain unchanged. Verify local private-storage configuration and clean up only generated fixtures. No production deployment is authorized. Rollback disables new plan-comment interactions while preserving records, attachment access policy and durable cleanup processing; do not destructively drop discussion data.

## Open questions

- None. Approval also accepts the proposed all-participant resolve/reopen permission, read-only resolved history, fixed pin positions, Show resolved control, no reaction chips, content/upload limits and capacity/pagination behavior above.
