# Feature: Sign drawer Comments

- ID: `sign-comments`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-15`
- Domain references: `CONTEXT.md — Sign Comment, Sign, Site Access, Membership, Organization Role, Image, Document; docs/domain/figjam-object-catalog.md — Objects and data points (Sign Comment, Sign, User, Image, Document), Canonical interpretation notes, Nesting map, Organization roles and permissions, Known ambiguities 7–10, Current implementation alignment`
- Design authority: User-supplied `Workspace 6/Sites/Allcations/Plan_ Plan dropdown.png`, `Plan_ Plan dropdown-1.png`, and `Plan_ Plan dropdown-2.png`, plus explicit answers about permissions, attachments, mentions, reactions and deferred controls.

## Problem

The Sign drawer's Comments tab is inactive. Users need persistent Sign-specific discussions and replies, including attachments, mentions and reactions, matching the supplied empty, populated and expanded-composer designs.

## Outcome and success metrics

Comments, replies, attachments and reactions survive reload and appear only under their owning Sign. All Organization Roles with current Site access can participate. Browser geometry checks match the reference drawer and fixed composer; tests verify tenant isolation and retries without duplicate submissions.

## Non-goals

No comment editing or deletion controls, resolved/completed state, notifications, email, realtime delivery, rich HTML, larger image preview, Organization library, or copying attachments into Docs/Photos. No Site Activity entry or Signage Schedule comment-cell synchronization is introduced. These are Sign Comments, not Site Comments or Allocation Plan Comments. The shared Sign owns them regardless of which view deletes that Sign.

This specification supersedes only the inactive Comments scope in `allocation-plan-signs`, `sign-documents` and `sign-photos`. Other tab behavior remains unchanged. The circled checkmark is a noninteractive icon, not a resolution action.

## Requirements

- REQ-001: Enable Comments for the selected Sign in the existing 350px drawer, preserving its header, code and other tabs. Fetch only the selected Sign's comments; ignore stale responses after switching or closing. Show loading, retryable error, and the centered empty copy `There are no comments yet.`. Do not seed screenshot authors or messages.
- REQ-002: Match the reference at 1512×982: tab baseline around y268, content inset 24px, 28px avatars, 8px avatar/text gap, 13px body/name text and muted relative timestamps. Root comment text starts around x1222; replies are indented 28px with the subtle connector line. Wrap long content; truncate attachment filenames with accessible full names. The comment list scrolls independently while the drawer header/tabs and bottom composer stay visible.
- REQ-003: Match the bottom composer: white footer with top border and 16px vertical padding, author avatar at the left, pale bordered rounded field approximately 262px wide. Collapsed field is 56px high with `Write a comment...` and Submit. Focus expands it to approximately 128px, with textarea above a separated toolbar containing attachment, @mention and emoji controls, and Submit on the right. Empty blur collapses it; nonempty or attachment-bearing drafts remain expanded. Submission clears the successful draft and reveals the new comment. Failure preserves text, attachments and reply target with a retryable error.
- REQ-004: All authenticated Organization Roles, including Viewers, with current Site access and the existing COMMENT capability may read, post, reply, attach files and react. Validate access server-side on every operation. Losing access prevents new submissions and attachment reads. No MANAGE_SIGNS requirement is introduced for discussion.
- REQ-005: Persist root comments and replies. Proposed thread behavior for approval: one visual reply level; replying to a reply targets its root thread, without unbounded indentation. Reply focuses the fixed composer and shows a cancellable `Replying to <name>` indicator. Roots and replies are ordered oldest-first by creation time and stable ID. Use paginated reads (up to 50 items per page), retaining root context when loading replies. No parent from another Sign or tenant is accepted.
- REQ-006: Proposed content limits for approval: at most 5,000 Unicode code points, at most five attachments and twenty distinct mentioned Memberships per comment. Require non-whitespace text or at least one verified attachment. Submit is disabled for an empty draft, active uploads, unresolved attachment failures or a pending request. Enter inserts a newline; Submit or Ctrl/Cmd+Enter posts. Render plain text safely, with only validated mention tokens highlighted blue. Use a stable submission key bound to author, tenant, Sign and full draft; retries must not duplicate comments or replies.
- REQ-007: Attachment selection supports multiple nonempty PNG/JPEG/PDF files, each at most 5,242,880 bytes. Show per-file progress, validation failures, retry and removal from the unpublished draft; allow at most three concurrent transfers. Validate actual type, byte count and checksum before attaching. Fully decode images using the existing bounded decoder (40-megapixel input, timeout, single image), producing orientation-correct metadata-free thumbnails. Verify PDF signature using the existing private document upload pattern; no malware-scanning claim is made. Attachment errors must not discard the rest of the draft.
- REQ-008: Render PDF attachments as compact bordered file rows with PDF icon and filename; clicking downloads original bytes with a safe filename. Render images as reference-style rounded cover thumbnails approximately 266×170px, with an accessible download action. No larger preview opens. Attachment authorization derives from the owning Sign Comment and current Site access. Draft uploads are private to their uploader until atomically attached to a submitted comment and cannot be claimed by another author or Sign. Images/Documents here do not automatically populate other tabs.
- REQ-009: Typing @ or activating the @ button opens a searchable, keyboard-accessible candidate list restricted to active Memberships that currently have access to this Site, including the existing Owner access override. Exclude pending invitations and inaccessible users; return only display names, initials/avatar data and opaque identifiers needed for selection. Store structured mention identity plus display text, not inferred matches from arbitrary `@text`. Revalidate selected targets at submission; on revoked access preserve the draft and ask the author to remove/reselect the mention. Historical mentions remain readable without granting access or sending notifications.
- REQ-010: Implement an emoji picker for composer insertion and per-comment/reply reactions. Proposed initial palette for approval: 👍, 👎, ❤️, 🎉, 😄, 👀. Render reaction chips with counts and the current user's selected state. One reaction per emoji per author per comment; an author may select several different emoji and toggle their own off. Use idempotent desired-state writes rather than retry-sensitive toggle requests. Failures restore the prior state and show a retryable error. Emoji insertion adds ordinary text to the draft. The adjacent circled checkmark has no action, state or request.
- REQ-011: Protect drafts and in-flight submissions from accidental Sign/tab switching, drawer closure and navigation using existing unsaved-work guards. Offer discard confirmation for unsent changes; block repeated submissions while pending. Requests/transfers have bounded timeouts. Successful upload completion retries must not resend already verified bytes. Removing a file from a draft or abandoning the draft schedules cleanup, not publication. Persisting unsent text across browser restarts is not required.
- REQ-012: Deleting the shared Sign from either existing view revokes access to all its comments, replies, mentions, reactions and attachments and durably schedules private object cleanup. A Sign deleted during upload/submission must never receive a new accessible comment. Individual comment edit/delete endpoints are not exposed. Existing Sign deletion confirmation already includes comments; preserve it and never delete another Sign's discussion.

## Acceptance scenarios

### AC-001 — reference layouts [REQ-001..003]

- Given no comments, when the tab opens, then the empty copy and collapsed fixed composer match the design.
- Given threads, when the list scrolls or the composer expands, then avatars, connectors, attachment cards and toolbar match the reference without moving the drawer header or obscuring the composer.

### AC-002 — posting and replying [REQ-004..006,011]

- Given a Viewer with Site access, when a valid comment or reply is submitted, then it persists under the selected Sign and survives reload.
- Given a failed or lost response, when retried, then the draft is retained until success and only one record is created.
- Given a reply to a reply, when submitted, then it appears in the original thread at the same reply indentation.

### AC-003 — attachment lifecycle [REQ-007,008,011,012]

- Given mixed valid images/PDFs and invalid, oversized or corrupt files, when selected, then each file is independently validated and no invalid file is published.
- Given a completed attachment, when downloaded, then original bytes are returned privately; images use safe thumbnails and PDFs do not preview inline.
- Given an abandoned draft or deleted Sign, when cleanup runs, then its objects are eventually removed and access is already denied.

### AC-004 — mentions and reactions [REQ-009,010]

- Given Site members and inaccessible users, when @ is used, then only eligible members can be selected and submission rechecks their access without sending notifications.
- Given a reaction, when the author selects it twice or retries a lost response, then the intended selected state and count are correct without duplicate reactions.
- Given the circled checkmark icon, when clicked, then no action or request occurs.

### AC-005 — isolation and accessibility [REQ-001,004,008..012]

- Given another tenant, another Sign, revoked access or a foreign draft attachment, when read or mutation is attempted, then the server rejects it.
- Given keyboard-only use, long text, many replies, a narrow drawer or pending submissions, when interacting, then focus and scrolling remain usable and no draft is silently lost.

## UX and accessibility

Label tabs, composer, picker controls, attachments and reactions. Provide visible focus, pressed state for reactions, selected mention options, arrow-key/Enter selection and Escape dismissal for pickers. Announce errors/progress without reading entire threads repeatedly. Render timestamps with an accessible absolute date. Use stable initials when no profile image exists. Checkmark is decorative/noninteractive. Support touch without hover-dependent actions. Maintain a visible composer and bounded scrolling at narrow widths.

## API and integrations

Add backward-compatible Sign-scoped contracts and OpenAPI operations for paginated roots/replies, comment submission, eligible mention search, desired reaction state, attachment intent/completion and private thumbnail/download. Reuse session and exact-Origin mutation checks. Submission atomically validates ownership, parent, access, mentions and verified attachments, then creates the comment and binds attachments. Replies cannot cross Sign boundaries. No notification, library or schedule synchronization endpoint is called. Preserve all existing APIs and use live contracts in development.

## Data and migration

Add tenant/Site/Sign-owned comment records with author, body, timestamps, optional root parent and idempotency digest/key; structured mentions, uniquely constrained reactions, and private comment attachment records with verified upload metadata and lifecycle. Use composite ownership constraints. Retain a durable object ledger independently of parent-row deletion. No conversion/backfill from Site Comments, Docs or Photos. Proposed abandoned-upload lifetime: 15 minutes until verification, then up to 24 hours to submit a verified draft attachment; cleanup retains retry work and observes the existing signed-upload grace interval. Update the domain catalog after approval to record these explicitly accepted associations, not a general media library.

## Security and privacy

Enforce tenant/Site access and COMMENT capability without trusting client roles. Render plain text and validated mentions, not HTML. Keep all uploaded bytes private, bound to their uploader and Sign until submission. Derivative images strip metadata; original downloads retain it. Use no-store and nosniff responses and safe attachment filenames. Recheck access during transactional submission and reject deleted parents. Avoid exposing inaccessible membership details. Never log comment text, filenames, bytes, mention searches or signed URLs.

## Reliability and observability

Bound network and decoding work; use retry-safe submission/reaction operations, persistent cleanup bookkeeping and stale-response guards. Emit categorical outcomes with correlation IDs for list, submit, attachment verification/download, reaction and cleanup failures. Document fixture-only smoke checks, cleanup backlog recovery and flag rollback in a runbook. No polling/realtime guarantee or new commercial quota is implied.

## Test strategy

After approval, write failing tests for these acceptance scenarios before application changes. Cover real database ownership/parent constraints, Viewer participation, membership revocation, mention filtering, submission/reaction idempotency, attachment forgery, image decoding, deletion races and cleanup retry. Add Storybook empty/threaded/expanded/reply/mention/reaction/attachment/loading/error states. Browser tests verify reference geometry, fixed composer, scrolling, keyboard access, upload retries and duplicate-submit protection. Run affected API/UI regressions, lint, types and builds; report unrun or pre-existing repository-wide failures explicitly.

## Rollout and rollback

Add a Sign Comments flag default off in production, gated alongside Allocation Plan Signs. Apply additive migrations and private storage permissions before local enablement. Verify using generated comments/files and clean up only those fixtures. No production deployment is authorized. Roll back by disabling Comments while preserving data and cleanup workers; General, Docs, Photos and Signage Schedule remain compatible.

## Open questions

- No unanswered user questions. The proposed defaults for thread depth, draft limits, emoji palette and draft-upload expiry are included for approval with this specification.
