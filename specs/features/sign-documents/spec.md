# Feature: Sign drawer Docs

- ID: `sign-documents`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-15`
- Domain references: `CONTEXT.md — Organization, Site, Site Access, Allocation Plan, Sign, Document, Image; docs/domain/figjam-object-catalog.md — Objects and data points (Sign, Document, Image), Canonical interpretation notes, Nesting map, Organization roles and permissions, Known ambiguities 7 and 8, Current implementation alignment`
- Design authority: User-supplied `Workspace 5/Sites/Allcations/Plan_ Plan dropdown.png` showing Docs. The additional Workspace 9 image was unavailable; this specification uses the visible reference and the user's explicit answers.

## Problem and outcome

The Sign drawer has an inactive Docs tab. Enable uploading and downloading supporting files for the selected shared Sign, matching the supplied design. A successful upload remains available after reload and is never shown on another Sign accidentally.

## Accepted product decisions and non-goals

The user confirmed multiple PNG, JPG and PDF uploads, up to 5 MB each; clicking a document downloads it; three-dot menu options are deferred; Library files is disabled. This amendment supersedes only the inactive Docs requirement in `allocation-plan-signs`. Photos and Comments remain inactive. No preview, library picker, document removal/renaming/sharing menu, tags, categories, search, or new organisation-wide library is included. Screenshot filenames and duplicate rows are illustrative, not seeded data.

## Requirements

- REQ-001: Enable Docs for a selected Sign. Preserve General edits and existing save/conflict guards when changing tabs. Load only that Sign's completed documents, with loading, empty and retryable error states. Switching Signs or closing the drawer must not apply stale responses to another Sign.
- REQ-002: Match the reference's 350px drawer, existing code/header/tabs, active Docs underline, 24px content inset, compact document rows and pinned upload footer. Show `Link relevant documents` and the reference description. Rows contain a file-type icon and truncated actual filename, with the full filename accessible. Hover/focus gives a pale rounded background and reveals the three-dot control. That control is disabled and labelled as unavailable; it opens no options and makes no request.
- REQ-003: Keep the document list independently scrollable above the footer. Match the footer's top divider, dashed upload area, upload icon, drag prompt, `or` separator, outlined Browse local files button, Library files button and file-limit helper. Library files remains visibly disabled and makes no request. Preserve the plan, zoom controls and drawer boundaries. Constrain overflow on smaller viewports without hiding essential controls.
- REQ-004: Browse local files and drag/drop accept multiple files and upload immediately, with at most three concurrent transfers. Accept nonempty PNG, JPEG (.jpg or .jpeg) and PDF files of at most 5,242,880 bytes each, consistent with existing allocation uploads. Validate each file independently; a rejected file does not block valid files. No aggregate file-count or storage allowance is inferred from the catalog.
- REQ-005: Show per-file pending/progress, completed and failure states; errors support retry without duplicating a completed document. Do not display fabricated progress. Completed files remain listed while further files upload. Disable duplicate submission for an active transfer and announce progress/errors accessibly. Warn before leaving with active uploads; interrupted transfers must not appear completed.
- REQ-006: Clicking a completed document downloads its original verified bytes with its safe original filename, not an inline preview. Download failures show a retryable error. Pending/failed uploads are not downloadable. Downloads and lists require current Site read access; uploads require existing MANAGE_SIGNS permission. Read-only users may download but cannot upload.
- REQ-007: Documents are private, tenant- and Site-scoped attachments owned by the selected shared Sign. Uploading PNG/JPG in Docs does not populate Photos or create an organisation library entry. Persist filename, media type, verified size/checksum, uploader, upload time, private storage reference and upload lifecycle metadata. Deleting the shared Sign revokes access to its attachments and schedules deletion of only their stored objects, without touching other Signs, plan files or Site comments.
- REQ-008: The server verifies actual type/signature, size and checksum before completion; client metadata alone is insufficient. Reject unsupported, empty, oversized, mismatched or expired uploads. Authorize initiation, completion, listing and download against the current tenant and Sign. Completion retries are idempotent; a deleted Sign cannot acquire new attachments through an outstanding upload.

## Acceptance scenarios

- AC-001 [REQ-001..003]: Given a selected Sign with documents, when Docs opens, then its actual files and reference layout appear; hover/focus reveals the inactive three-dot control, Library files stays disabled, and a long list scrolls without moving the footer.
- AC-002 [REQ-004..005,008]: Given a manager selects or drops multiple supported files plus an invalid file, when uploads run, then valid files complete independently, the invalid file explains its rejection, and retry does not duplicate completed records. Boundary-size, empty and forged files are tested server-side.
- AC-003 [REQ-001,006..008]: Given completed documents, when the user reloads or changes Signs, then each list remains correctly scoped; clicking downloads exact bytes with attachment disposition. Another tenant or a user without Site access cannot list, finish or download them.
- AC-004 [REQ-005..008]: Given an interrupted transfer, revoked permission or a concurrently deleted Sign, when completion is attempted, then no inaccessible or unverified document becomes a completed attachment. Deleting a Sign removes its document visibility from all sessions and permits retryable object cleanup.
- AC-005 [REQ-002..006]: Given keyboard and read-only users, when interacting with Docs, then downloads remain accessible, unavailable actions are disabled, focus is visible, and upload errors/progress are announced without changing General/Photos/Comments behavior.

## API, data and security

Add backward-compatible Sign-scoped list, upload-intent, completion and authenticated download operations to OpenAPI and shared contracts. Use cursor pagination for lists and the existing private upload infrastructure with short-lived upload authorization and checksum verification. Scope idempotency keys to tenant and upload payload; completion returns the existing result on retry. Use existing session, exact-Origin mutation checks and permission rules. Downloads use attachment Content-Disposition, sanitized filenames, no-store and nosniff; storage is never public. Do not render uploaded HTML or embed PDFs. Signature verification is not malware scanning; malware scanning is not represented as implemented by this feature.

Use an additive attachment/upload schema migration with composite ownership constraints and no backfill. Preserve existing Signs and allocation files. Completed attachment metadata is removed/revoked atomically with Sign deletion; a durable cleanup record allows retry after storage failures. Expired/incomplete uploads are cleaned up, never listed as documents. Update domain alignment notes after approval to record this bounded Sign-attachment interpretation; the wider Document/Image library model remains unresolved.

## Reliability and observability

Bound requests and transfers with timeouts. Keep failures actionable without infinite loading. Log categorical upload/completion/download/cleanup outcomes and correlation IDs, not filenames, document bytes, credentials or signed URLs. Track error counts and cleanup failures; add a recovery procedure for retrying cleanup. No new billing/storage quota is introduced.

## Test strategy

After approval, write failing tests mapped to the acceptance scenarios before implementation. Cover contracts, authorization, validation, retry/idempotency, deletion races, persistence and download bytes/headers in backend tests. Cover tab isolation, multiple uploads, disabled actions, progress/error/retry and downloads in frontend tests. Add reusable Docs components and empty/populated/hover/uploading/error/read-only states to Storybook. Run browser geometry/accessibility checks against the reference, affected integration tests, lint, type checks and builds; report any unrun or failing repository-wide checks explicitly.

## Rollout and rollback

Gate behind a new sign-documents flag, default off in production, alongside allocation-plan Signs. Apply the additive migration before enabling the API/UI. Smoke-test upload, reload, download, cross-Sign isolation and deletion cleanup locally before rollout. Disable the flag on authorization, corruption or persistent completion failures; retain stored data for compatible rollback and keep cleanup operational. No production deployment is authorized by this specification.

## Open questions

- None. Awaiting approval of this specification before application changes.
