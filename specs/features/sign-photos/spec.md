# Feature: Sign drawer Photos

- ID: `sign-photos`
- Status: `approved`
- Approval: User approved in conversation on 2026-09-15.
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-15`
- Domain references: `CONTEXT.md — Sign, Image, Document, Site Access, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Sign, Image, Document), Canonical interpretation notes, Nesting map, Organization roles and permissions, Known ambiguities 7, 8 and 10, Current implementation alignment`
- Design authority: User-supplied `Workspace 7/Sites/Allcations/Plan_ Plan dropdown.png` (empty) and `Plan_ Plan dropdown-1.png` (populated), plus the user's explicit clarification of file types and interactions.

## Problem

The Photos tab is inactive. Users need to record existing signage conditions using Images belonging to the selected shared Sign, with the supplied empty and populated layouts.

## Outcome and success metrics

Valid uploads survive reload, render only under their owning Sign, and download successfully. Confirmed deletion removes only the selected Image. Browser checks verify the reference layout and both view modes; authorization and persistence tests verify isolation.

## Non-goals

No PDF uploads, full-size preview, image-click action, editing, cropping controls, renaming, reordering, bulk deletion, Organization library, sharing, or Comments implementation. Library files remains disabled. Images uploaded through Docs remain Documents and are not automatically copied into Photos. No screenshot sample photos or filenames are seeded.

This specification supersedes only the inactive Photos scope in `allocation-plan-signs` and `sign-documents`; Docs behavior and the shared Sign remain unchanged.

## Requirements

- REQ-001: Enable Photos for the selected Sign, preserving its code, General edits/save guards, plan position and the other tabs. Show only that Sign's completed Images. Ignore stale responses after switching Signs or closing the drawer; provide loading, empty and retryable error states.
- REQ-002: Match the 350px reference drawer, Photos underline, approximately 24px content inset, muted 13px introductory copy and white surfaces. Empty heading: `Add sign’s photos`; populated heading: `Sign photos`. Description: `Record conditions of existing signage`. Preserve the drawer header and tabs while content beneath them scrolls.
- REQ-003: Empty state places the pale upload section immediately beneath the introduction, separated by a border. Match the 302px-wide, 232px-high rounded long-dashed area, upload icon, drag prompt, `or` divider and full-width Browse local files and disabled Library files buttons. Helper text must say `PNG and JPG supported and up to 5mb.`; the user's explicit exclusion of PDF overrides the screenshot copy.
- REQ-004: Default populated view is the screenshot's single-column large-card list. Place grid/list controls above the cards, right-aligned. List cards are approximately 302px wide with a 192px image area, 60px filename footer, subtle border, 4px corners and 16px vertical gaps. Render actual Images with centered cover fitting, respecting image orientation; do not stretch. Truncate long filenames with accessible full text. Hover/focus adds the subtle shadow and reveals download/delete actions at the right of the footer. Clicking the image or filename does nothing for now.
- REQ-005: Implement both view controls. Proposed grid treatment, because no grid reference is supplied: two equal columns with a 12px gap, square image areas and compact filename/action footers using the same visual tokens. Both views show the same records and actions. Selection is local UI state, defaults to list on a new drawer session, and does not mutate data. On constrained widths cards must not overflow; touch and keyboard users can access actions without requiring hover.
- REQ-006: In populated states the upload section follows the cards in the same scrollable content, not pinned over them. It remains available to add more Images. Removing the last Image restores the empty layout. View controls appear only when there are completed Images.
- REQ-007: Browse and drop support multiple nonempty PNG/JPEG files (.png, .jpg, .jpeg), at most 5,242,880 bytes each, with at most three concurrent transfers. PDF and all other types are rejected. Validate files independently; invalid files do not block valid files. Upload immediately, showing real per-file progress, verification, failure and retry states. Retry must not duplicate completed Images or resend bytes when only completion failed. Protect active transfers from accidental navigation and ignore results after unmount.
- REQ-008: Download retrieves the original verified file as an attachment with a safe filename. No larger preview opens. A failed download retains the Image and shows a retryable error. Read access permits list, thumbnail and download; existing MANAGE_SIGNS permission is required for upload and delete. Read-only users see no active upload/delete action. Library files stays disabled for everyone and makes no request.
- REQ-009: Delete opens an accessible confirmation for the captured Image ID and filename; it does not immediately mutate. Reuse the existing confirmation styling with title `Delete photo`, body `This photo will be permanently deleted.`, the actual filename, Cancel, close and red Delete. Cancel/close/Escape make no changes and restore focus. Initial focus is Cancel, background interactions are blocked, and outside clicks do not dismiss. While deleting, disable repeated submissions and dismissal. Failure retains the card and offers retry; success removes only that Image, never its Sign, placement, Docs or other Images. Already-deleted requests are safe and idempotent after authorizing the parent Sign.
- REQ-010: Verify actual media type, image decodability, byte count and checksum server-side before completion. Reject corrupt/forged images and expired uploads. Generate safe, orientation-correct thumbnails with metadata stripped; do not inline unverified source bytes. Reuse the existing image decoder's bounded resource safeguards and timeouts. Store originals privately for download, not as public URLs.
- REQ-011: Persist each Image's tenant, Site, owning Sign, original filename/type/size/checksum, uploader/time, private original/thumbnail storage references and upload lifecycle. Completion and retries are idempotent and cannot attach to a deleted Sign. Individual Image deletion and shared Sign deletion revoke list/thumbnail/download access and durably schedule original, thumbnail and temporary object cleanup. Storage failures retain retryable cleanup work. No Organization-wide library link or storage allowance is inferred from the catalog.

## Acceptance scenarios

### AC-001 — empty and populated designs [REQ-001..006]

- Given a Sign with no Images, when Photos opens, then the empty reference layout appears with corrected PNG/JPG helper text.
- Given completed Images, when Photos opens or the view toggle changes, then the list matches the supplied large cards, the grid uses the proposed two-column layout, and the upload area remains below the cards.

### AC-002 — multi-file uploads [REQ-007,010,011]

- Given mixed valid PNG/JPEG, PDF, empty, oversized and corrupt files, when uploaded, then valid Images complete independently and invalid files show actionable errors.
- Given a lost completion response, when retried, then only one completed Image exists and it survives reload under the correct Sign.

### AC-003 — download and safe deletion [REQ-008,009,011]

- Given a completed Image, when download is activated, then its original bytes download without opening a preview.
- Given a delete confirmation, when canceled, then nothing changes; when confirmed, only the captured Image disappears. Failure preserves the card, and duplicate confirmation requests cannot delete another record.

### AC-004 — isolation and lifecycle [REQ-001,008,010,011]

- Given another tenant, inaccessible Site or read-only membership, when requesting protected operations, then the server enforces access independently of the UI.
- Given a Sign deleted during upload, when completion runs, then no new Image becomes accessible. Sign deletion removes access to all its Images while preserving other Signs and retrying storage cleanup.

### AC-005 — accessible states [REQ-002..009]

- Given keyboard, touch, long filenames, many Images and a constrained viewport, when browsing, toggling or deleting, then controls remain available, content scrolls without covering header/tabs, focus is visible, and progress/errors are announced.

## UX and accessibility

Use labelled tab/view controls with selected/pressed state, meaningful thumbnail alt text, named download/delete buttons, visible focus and live status/error announcements. Confirmation traps focus and uses safe cancellation. Hover-only styling must also apply on focus; touch actions remain discoverable. Failed thumbnails show a bounded placeholder/retry state without breaking card geometry. No fake photo-click affordance.

## API and integrations

Add backward-compatible Sign-scoped list, upload-intent, completion, thumbnail, download and delete operations to OpenAPI and shared contracts. Reuse private storage/session/Origin patterns from Docs without changing its accepted media or behavior. Lists are paginated with stable ordering; upload idempotency binds tenant, Sign, uploader and file manifest. Thumbnails and downloads reauthorize current Site access. Mutation routes require exact allowed Origin. Use bounded transfers and requests, private/no-store responses, safe Content-Disposition for downloads and nosniff. No library endpoint is called.

## Data and migration

Use an additive Image persistence change with composite ownership constraints and durable cleanup bookkeeping. No backfill or automatic conversion of existing Documents. Keep original bytes for download and a generated display thumbnail. Deletion revokes metadata/access transactionally before asynchronous object removal. Expired uploads are cleaned up and never listed as completed. Record this Sign-owned Image interpretation in the catalog after approval; broader Image library associations remain unresolved.

## Security and privacy

Enforce Site access and MANAGE_SIGNS centrally, validate actual decoded image format rather than extensions/client MIME alone, constrain decoding resources, and strip metadata from display derivatives. Never expose object keys, signed URLs, filenames or image bytes in logs. Original metadata remains in the original download; no public image hosting or malware-scanning claim is introduced.

## Reliability and observability

Retain per-file recoverable errors; prevent infinite loading and stale selection updates. Emit categorical upload/completion/download/delete/cleanup outcomes and correlation IDs. Durable cleanup survives request failures and service restarts. Extend the private-media runbook with cleanup retry, access-revocation and generated-fixture smoke checks. No new quotas or billing behavior.

## Test strategy

After approval, write failing tests tied to these acceptance scenarios before application changes. Cover contracts, byte/type/image validation, access, idempotency, deletion races, persistence and private downloads/thumbnail rendering. Add reusable Photos components and empty/list/grid/hover/uploading/error/read-only/delete-confirmation states to Storybook. Run visual geometry/accessibility checks, affected unit/integration/browser regressions, type checks, lint and builds. Report any unrun or pre-existing failing repository-wide checks without claiming full coverage.

## Rollout and rollback

Use a Photos-specific flag, default off in production, alongside allocation-plan Signs. Apply the additive migration and storage permissions before enabling locally. Verify with generated test images and clean them up afterwards. No production deployment is authorized. Disable Photos on access, decoding or persistence failures while retaining data and cleanup processing; General, Docs and Signage Schedule remain compatible.

## Open questions

- None.
