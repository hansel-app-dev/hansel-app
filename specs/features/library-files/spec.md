# Feature: Library Files and reuse

- ID: `library-files`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-27`
- Domain references: `CONTEXT.md — Organization, Membership, Organization Role, Site, Site Access, Allocation Plan, Document, Image; docs/domain/figjam-object-catalog.md — Source and authority, Objects and data points (Organization, Allocation Plan, Document, Image), Canonical interpretation notes (Linked to), Nesting map, Known ambiguities requiring specification (7, 8, 10), Current implementation alignment`
- User request: `Uploaded plans, documents and photos are saved in Library Files and can be picked again from Library Files.`
- Accepted decisions: `User confirmed source Site access, reuse of the stored file with independent plan/Sign links, and inclusion of existing completed uploads in this Codex task on 2026-09-27.`
- Supersedes on approval: `The disabled library actions and Sign-exclusive storage/deletion assumptions in sign-documents REQ-003,007 and sign-photos REQ-008,009,011; the library exclusion in site-allocation-plans-add; the inactive Documents library navigation. Other upload, permission, format, size and single-file plan requirements remain authoritative.`

## Problem

Plans, Sign Documents and Sign Photos currently have separate upload lifecycles.
The application has no active shared file library, and Library files actions in
the drawers are disabled. Members must upload bytes again to use a file on
another supported object. Existing cleanup assumes those bytes belong to one
attachment, which cannot safely support reuse.

## Outcome and success metrics

Every successfully completed in-scope upload produces one durable Library File.
Members can find eligible files and attach them through a Library files picker
without uploading the same bytes again. Reusing a plan file creates an independent
Allocation Plan with exactly one file and no copied Signs, Areas or Comments.
Removing one attachment does not break any other use of its file.

## Non-goals

- Comment attachments, Site cover images, Videos, Styleguide, folders, tags,
  renaming, file replacement, versions, or direct uploads from the library page.
- A public library, cross-Organization reuse, automatic sharing with everyone,
  or new notifications.
- Copying annotations or Sign records when selecting a plan file.
- Checksum-based merging of unrelated uploads or new Storage Allowance policy.
- Permanent library deletion in this initial slice; retention needs an explicit
  later policy. Removal from a Sign is an unlink operation.

## Requirements

These requirements include the confirmed decisions. Obtain specification approval
before application changes.

- REQ-001: A completed Allocation Plan upload, Sign Document upload or Sign Photo upload MUST register a private Library File in the current Organization. Failed, pending, expired, abandoned and rejected uploads MUST NOT appear. Registration and completion retries MUST be atomic and idempotent, producing one entry per completed upload rather than one per retry. Only a committed Allocation Plan file becomes eligible; an uncommitted upload draft is not a library asset.
- REQ-002: Each Library File MUST retain its stable ID, Organization, source Site, safe original filename, verified media type, size/checksum, uploader and completion time, plus private original and available thumbnail references. The source Site is an authorization boundary, not merely display metadata. Storage keys and presigned URLs MUST NOT appear in ordinary list DTOs.
- REQ-003: Library list, thumbnail, download and picker reads MUST require an active Membership in the same Organization and current read access to the source Site. Unauthorized IDs MUST disclose neither metadata nor bytes. Owner access follows existing Site rules. Permissions MUST be checked on every request and again when attaching; the browser's previously loaded list does not authorize a reuse.
- REQ-004: Enable an application navigation item named Files under Libraries, replacing the currently unavailable Documents library item. The Files page MUST list eligible completed files with filename, format, size, uploader, upload date and source Site. Provide server-side filename search, media-type filtering, latest-first stable cursor pagination, empty/loading/retryable-error states and authorized attachment downloads. Keep Styleguide unavailable.
- REQ-005: Add an accessible Library files picker to Add plans and enable the existing Library files actions in Sign Docs and Photos for users allowed to mutate that target. The picker MUST list only eligible verified files compatible with the destination. Plans and Docs accept PNG/JPEG/PDF within their existing byte limits; Photos accepts PNG/JPEG within its existing limit. Compatibility depends on verified content, not which upload surface originally received it. A PDF MUST never be selectable for Photos.
- REQ-006: Add plans MUST accept exactly one local file or one Library File, require the existing plan name validation, and create one independent Allocation Plan on confirmation. Library selection MUST use stored verified bytes without a browser upload. The new plan MUST receive its own file association and start with no Signs, Areas or Comments. Selecting from the library MUST not modify or move an existing plan.
- REQ-007: Docs and Photos MAY select multiple eligible Library Files in one picker confirmation. Each selected file MUST create an independent attachment link on the captured Sign, preserving other attachments. Linking requires current target Site access and MANAGE_SIGNS. Selecting a source from a different Site requires source read access and target mutation permission; confirmation deliberately makes that attachment available under the target Site's existing read rules.
- REQ-008: Reuse MUST reference the immutable stored Library File without duplicating original bytes. Allocation Plan files and Sign attachments retain independent identities and associations. Replaying the same request MUST return the original result; a reused key with different payload MUST conflict. Concurrent attachment and cleanup MUST never leave a live link pointing to deleted bytes. Selecting an already linked file for the same Sign and attachment kind MUST not create a duplicate link; Docs and Photos links remain distinct.
- REQ-009: Removing a Photo or deleting its owning Sign MUST remove only that association and its parent-specific access. Library Files and surviving links MUST remain valid. Change the Photo confirmation to truthful removal copy rather than claiming permanent deletion of shared bytes. Original and thumbnail cleanup MUST occur only for abandoned uploads or files explicitly eligible for deletion under a separately approved policy. Existing object cleanup jobs MUST recognize registered library assets before any shared reference is released.
- REQ-010: Existing completed Allocation Plan files, Documents and Photos MUST be backfilled into Library Files without re-uploading bytes or changing IDs, geometry, access, timestamps or filenames of existing parents. Map only verified and retained source objects; pending/quarantined/orphaned/expired objects MUST not become selectable. Missing or inconsistent source objects MUST be reported and withheld rather than fabricated. The backfill MUST be resumable and idempotent.
- REQ-011: Picker cancellation MUST make no associations, restore focus and preserve existing local upload state. Submission failures MUST preserve selection for retry. Switching targets, leaving, revoked access or concurrent parent deletion MUST not attach a file to another target or apply stale results. Existing unsaved-edit and upload navigation guards remain in force. Read-only members can inspect authorized library content but cannot link files to plans or Signs.
- REQ-012: Existing local upload validation, original downloads, decoder bounds, safe thumbnail generation, private storage and progress/retry behavior MUST remain intact. A Library File selected for Photos MUST have a safe thumbnail generated before that link is completed if one is not already available. No unverified original may be inlined as an image preview.
- REQ-013: New reusable Library File list, picker and important states MUST have Storybook coverage. Preserve visible focus, labelled selection, keyboard use, announced progress/errors, responsive layout at 320 CSS pixels and 200% zoom, and WCAG 2.2 AA. Display real data only.

## Acceptance scenarios

### AC-001 — Upload once [REQ-001, REQ-002, REQ-012]

- Given an authorized member uploading an eligible plan, Document or Photo
- When the upload successfully completes and its parent association is committed
- Then one Library File appears with verified metadata; completion retries do not duplicate it, and failed or abandoned uploads never appear.

### AC-002 — Safe discovery [REQ-003, REQ-004]

- Given completed files from different Sites and Organizations
- When a member opens Files, searches, pages or requests a file by ID
- Then only files whose source Site the member can currently read are visible and downloadable; stale or forged IDs do not bypass access.

### AC-003 — Independent plan [REQ-005, REQ-006, REQ-008]

- Given an eligible Library File and permission to add a plan to the selected Site
- When the member selects it and confirms a valid plan name
- Then one plan with one file is created without uploading bytes, with independent identity and no inherited Signs, Areas or Comments.

### AC-004 — Reuse in Docs and Photos [REQ-005, REQ-007, REQ-008, REQ-012]

- Given compatible files and permission to manage the selected Sign
- When the member confirms selected Library Files
- Then Docs or Photos receives independent links and a retry creates no duplicate links. PDF is unavailable in Photos, while an eligible image uploaded through Docs can deliberately be selected for Photos.

### AC-005 — Shared lifetime [REQ-008, REQ-009]

- Given one Library File used by multiple parents
- When one Photo association or its Sign is removed
- Then that association disappears but the library entry and surviving associations still download the original bytes. No cleanup worker deletes shared original or thumbnail objects.

### AC-006 — Existing content [REQ-010]

- Given existing completed uploads and incomplete or missing objects
- When backfill runs repeatedly or resumes after interruption
- Then verified existing uploads appear once with retained parent identities and access; incomplete or missing objects remain excluded and produce actionable reports.

### AC-007 — Picker boundaries [REQ-003, REQ-011, REQ-013]

- Given a picker selection, navigation, changed permission or failed request
- When the member cancels, changes target or retries
- Then cancellation creates nothing, the target remains correctly scoped, revoked access is rejected, retry preserves selection, and keyboard/focus behavior remains usable at narrow widths and zoom.

## UX and accessibility

Use existing Hansel modal, buttons, upload styling and drawer layout. Plans use
single selection; Docs and Photos use multiple selection. Confirm actions name
their destination, and only confirmation establishes an association. Show source
Site and actual metadata so members understand the file they are selecting.
Search and type filters work within the picker. Preserve the existing upload
option and do not report transfer progress when no bytes are being uploaded.
Removal copy must explain that the file remains in Library Files.

## API and integrations

Define additive OpenAPI and Zod contracts for authorized library listing,
thumbnail/download access, plan creation from one Library File and Sign Document
or Photo linking. Keep existing upload endpoints compatible. Mutations use the
existing session, exact-Origin/CSRF and idempotency conventions, validate both
source and target, and return safe errors for incompatible, unavailable,
conflicting or inaccessible selections. Page size is bounded and cursors include
a stable ID tiebreaker. Contract design follows approval of this specification.

## Data and migration

Add a tenant-scoped immutable asset record separate from parent links. Preserve
source Site provenance and current access checks. Link existing plan file rows,
Sign Documents and Sign Photos to this record through additive nullable columns
and tenant-safe constraints during migration. Original/thumbnail storage belongs
to the shared record; parent lifecycle records retain their existing IDs.

Roll out storage-lifetime protection before enabling reuse, so old cleanup jobs
cannot delete registered assets. Backfill existing completed rows in bounded
batches using stable source IDs for idempotency; validate object retention and
write durable reports for missing objects. Do not deduplicate separate uploads
by checksum in this slice. Do not infer library fields from FigJam labels.

## Security and privacy

Remain private and Organization-isolated. Preserve source Site restrictions for
library discovery. Existing attachment readers authorize their own destination
Site; deliberate reuse is a new association rather than an automatic expansion
of the library's audience. Revalidate source and target before commit and reject
deleted parents or assets. Source Site deletion is outside this release; a
missing source Site must fail library discovery closed without invalidating
surviving authorized destination links. Never expose presigned storage access
to an unauthorized caller or log filenames, signed URLs or file contents.

## Reliability and observability

Atomic registration, linking and idempotency prevent partial completed states.
Thumbnail work and backfill use bounded retries. Record counts of registered
assets, successful links, failed links, missing backfill objects and cleanup
failures without sensitive metadata. Surface recoverable failures to the user;
never silently fall back to an unverified or inaccessible file.

## Test strategy

After approval, write tests first against AC-001 through AC-007. Cover all three
upload sources, same- and cross-Site access, cross-Organization denial, changed
permissions, immutable bytes, type/size filtering, thumbnail creation, single-file
plans, independent associations, retries/concurrency and source/target deletion.
Database integration tests prove tenant constraints, migration/backfill and
cleanup races. Browser tests prove upload-to-library-to-picker journeys, removal,
keyboard use, focus, narrow layouts, zoom and accessibility. Retain current 100%
API/web/contracts coverage gates and run repository verification.

## Rollout and rollback

1. Approve this specification.
2. Add contracts, shared asset schema and cleanup protections, then backfill.
3. Register new completed uploads and verify lifecycle/access invariants.
4. Enable Files navigation and compatible library pickers with Storybook states.
5. Verify all affected gates and smoke-test upload, reuse and removal.

Use a feature flag for library reads and reuse. On rollback, disable new library
actions while preserving shared records and protections for already linked files.
Do not revert to destructive per-attachment cleanup or remove shared mappings.

## Open questions

- None. The user confirmed all three access, reuse and backfill decisions.

Specification approval remains required before implementation.
