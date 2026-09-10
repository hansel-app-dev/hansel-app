# Feature: Named Allocation Plans with Multiple Files

- ID: `allocation-plan-multiple-files`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-10`
- Domain references: `CONTEXT.md — Allocation Plan, Site, Site Access, Organization, Membership, Organization Role, Activity; docs/domain/figjam-object-catalog.md — Objects and data points (Allocation Plan and Site), Canonical interpretation notes, Nesting map, Known ambiguities 7, 8, and 10, Current implementation alignment`
- Product evidence: `The user explicitly confirmed on 2026-09-10 that one plan can have multiple files and supplied selection, uploading, and uploaded designs.`
- Design authority: `Add new Allocation.png; Add new Allocation_ Uploaded and Uploading.png; Add new Allocation_ Uploaded.png, supplied in the Codex task. Example names, percentages, counts, and sizes are not policy.`
- Supersedes on implementation: `site-allocation-plans-add naming non-goal, one-file/one-plan cardinality, immediate plan creation on file verification, filename-based collection labels/search, and old Add plans/Upload/Done modal presentation. All unaffected authorization, private storage, verification, limits, accessibility, and retention requirements remain authoritative. This draft does not yet authorize application changes.`

## Problem

The approved upload flow creates an independent Allocation Plan for each file. The new design and explicit product decision require one named Allocation Plan containing multiple files, with file verification separated from the final Add Allocation action.

## Outcome and success metrics

- One completed creation flow produces exactly one named Allocation Plan with all retained, verified files in selection order.
- No plan or creation Activity becomes visible before Add Allocation succeeds.
- All existing plans and stored files remain accessible as collection metadata after migration.
- Deterministic visual checks match all three supplied modal states at 1512 × 982; integration tests prove atomic creation and retry safety.

## Non-goals

- Renaming or modifying already-created plans, adding files to existing plans, file preview/download, annotations, and Sign placement.
- New role permissions, commercial storage allowances, or file-count limits inferred from screenshot examples.
- Changes to the Site shell or restoration of previously removed navigation overflow controls.

## Requirements

- REQ-001: Only the existing authorized Owner/Administrator with Site access may create a plan. Read access and tenant isolation MUST remain unchanged and be checked independently on every endpoint.
- REQ-002: The initial dialog MUST show `Add new Allocation`, the Allocation Plan icon tile, an editable name initialized to `New allocation plan`, the dashed file drop zone, supported-format help, and `Cancel`/`Next`. The proposed name rule is trim whitespace, require 1–200 Unicode code points, reject control characters, allow duplicate plan names within a Site, and preserve original filenames separately. Validation MUST run on client and server. These name rules require approval with this specification.
- REQ-003: Picker and drop MUST share validation and permit 1–20 PNG, JPEG, or PDF files, each 1 byte through 5 MiB, no more than 100 MiB total. Existing duplicate detection by normalized filename, byte size, and digest remains. Counts and sizes MUST reflect actual files; `2 of 5` is not a five-file limit and the pictured `5.3MB` does not raise the byte limit. Next MUST remain disabled until name and selection are valid.
- REQ-004: Next MUST start the private upload workflow and replace the drop zone with `Add plans here` and file rows. It MUST NOT create a visible plan. The name remains visible and editable; no additional files can be selected in this stage. Each row MUST show truthful queued, uploading, verifying, verified, or failed state. Uploading rows show filename, `• Uploading…`, numeric percentage, progress bar, and cancel icon. Verified rows show filename and formatted size with pale-green background and green outline. At most three transfers run concurrently.
- REQ-005: The second-stage footer MUST show `Cancel` and `Add Allocation`. Add Allocation MUST be disabled while any retained file is unverified, the name is invalid, no files remain, or creation is pending. On activation it MUST atomically create one named plan containing every retained verified file in selection order, close on success, and refresh the collection without reloading the document. No Done step is added.
- REQ-006: Row cancellation/removal MUST omit that file from final creation and abort its transfer where active. Failed rows MUST show a concise error and retry action; retries retain successful files. If all rows are removed, return to selection with the name retained. Removing or retrying a row MUST not allow a late upload response to reinsert it or change another row's state.
- REQ-007: Close, Escape, backdrop dismissal, and Cancel MUST dismiss immediately before uploads start. After uploads start they MUST request confirmation that unfinished allocation work will be discarded. Confirmation MUST stop client transfers, create no plan, and leave staged objects eligible for cleanup. During the final creation request, dismissal MUST be disabled until its result is resolved. A creation failure MUST retain the name/files and support safe retry with the same idempotency key.
- REQ-008: File verification MUST retain existing checksum, exact size, MIME, signature, private-storage, and expiry checks but mark the file ready for attachment instead of creating a plan. The final creation transaction MUST recheck current access and require a nonempty unique ordered set of verified, unexpired, unattached file intents from the same Site, Organization, creator, and batch. It MUST attach each intent at most once. Replaying the same creation key and normalized payload MUST return the original plan; a changed payload MUST conflict. File intents remain valid for the existing 15-minute window; expiration requires reupload, never a partial plan.
- REQ-009: Grid and List MUST render one item per Allocation Plan using its name, timestamps, and existing layout. Client-only case-insensitive search MUST match plan names, not silently generate separate items per file. Existing plans MUST receive their original filename as their initial name and one ordered child file, preserving IDs, Site/Organization ownership, timestamps, uploader, stored bytes, and existing Activity references.
- REQ-010: Successful final creation MUST produce exactly one existing Allocation Plan creation Activity for the named plan, transactionally and idempotently. Individual upload verification, removal, cancellation, and retries MUST produce no plan-created Activity.
- REQ-011: Desktop selection geometry MUST follow the supplied 500 × 531 dialog: 52px header, 24px body inset, 40px name row with 40px tile/8px gap, 452 × 250 drop zone, and 74px light footer. The single-file uploading/verified states MUST follow the 500 × 343 dialog: same header and name row, 62px file row, and 74px footer. Multiple rows expand the body with a bounded scroll area. Use the reference white surface, dim blurred backdrop, 6px corner treatment, slate upload icon/progress, compact typography, and specified button states. Center each dialog in the viewport.
- REQ-012: Preserve focus trapping/restoration, accessible control labels, keyboard operation, visible focus, status announcements, and non-color state indicators. At 320 CSS pixels and 200% zoom, controls MUST stay reachable with no horizontal page scroll. Add reusable components and selection, multiple-file, uploading, verifying, uploaded, failure/retry, invalid-name, creation-error, and cancellation states to Storybook.

## Acceptance scenarios

### AC-001 — Multiple files create one plan [REQ-001..REQ-005, REQ-008..REQ-010]

- Given an authorized manager selects three valid files and names the plan
- When Next uploads/verifies them and Add Allocation succeeds
- Then one collection item and one creation Activity exist, containing three ordered file associations
- And verification alone creates neither a visible plan nor Activity.

### AC-002 — Failure, removal, and retries [REQ-003..REQ-008]

- Given one verified file, one failed file, and one active upload
- When the manager retries the failed file or removes the active file
- Then successful files remain ready, late responses cannot restore removed files, and Add Allocation stays disabled until all retained files are verified
- And duplicate final requests return the same plan without duplicate associations or Activity.

### AC-003 — Abandonment and security [REQ-001, REQ-007, REQ-008]

- Given expired, cross-Site, cross-Organization, foreign-creator, or already-attached intents
- When creation is attempted
- Then the entire operation fails generically without partial records
- And confirmed abandonment creates no plan and cleanup removes unattached staged objects within the existing 24-hour deadline.

### AC-004 — Visual and migration fidelity [REQ-009, REQ-011, REQ-012]

- Given existing single-file plans and the three deterministic modal fixtures
- When the migration and UI checks run
- Then existing IDs and bytes survive, each old plan has one file, new plan names drive collection display/search, and modal geometry matches the supplied designs
- And keyboard, axe, narrow-width, and zoom checks pass.

## UX and accessibility

The initial design governs selection; the two newly supplied references govern active and verified rows. The Next-to-upload and Add Allocation-to-create sequence is proposed for approval because the designs show states rather than a complete interaction contract. Dynamic data replaces every screenshot sample. Existing accessible behavior is retained, not removed to achieve a visual match.

## API and integrations

Add strict, separately named grouped-upload endpoints under `/api/sites/{siteId}/allocation-plan-drafts`: create a draft upload batch, verify a draft file, and commit a named plan with ordered retained file IDs and a creation idempotency key. Exact OpenAPI schemas MUST be updated before application implementation. Reuse private S3 transport and verification internals without changing the meaning of existing legacy finalize endpoints. Legacy upload endpoints remain available during the deployment compatibility window and continue producing single-file plans through the new file association model. Collection responses add name and ordered safe file metadata while retaining existing fields for legacy single-file consumers; the upgraded UI uses the new fields. No fabricated singular file values may represent a multi-file plan: multi-file creation stays disabled until upgraded readers are deployed.

## Data and migration

Add a plan name and an ordered Allocation Plan file association with private object metadata, unique intent attachment, and tenant/Site-safe foreign keys. Add verified-but-unattached draft lifecycle and creation idempotency state. Backfill existing plans with their filenames and one child file while preserving all plan identities and stored objects. This resolves multiple files per Allocation Plan only; child files are not automatically shared Document/Image library records. The object catalog alignment note MUST be updated on approval/implementation, not claim this draft is implemented.

## Security and privacy

Retain all existing exact-origin/session protection, bounded limits, generated keys, private/no-store responses, verification, and storage policies. Never log plan names, filenames, file contents, checksums, or upload URLs. Final attachment rechecks current access and ownership. Staged verified files remain private and eligible for cleanup until atomically attached.

## Reliability and observability

Retain existing categorical metrics; add bounded grouped-creation success/failure/conflict and unattached-expiry categories. Cleanup MUST coordinate with final attachment so it cannot delete an attached file. Creation and Activity recording share one transaction. Retry ambiguity must not duplicate a plan; failed creation does not discard verified files before expiry.

## Test strategy

After specification approval, write failing contract, migration/backfill, server transaction/idempotency, authorization, expiry/cleanup-race, UI-state, and collection tests mapped to REQ IDs, then implement. Exercise both legacy single-file and new grouped flows. Add deterministic Storybook/Playwright visual fixtures for all three references, multi-file/error states, keyboard/axe, 320px and 200% zoom. Run focused suites, lint, type checks, builds, spec validation, and repository-required coverage checks; report unrelated baseline failures separately.

## Rollout and rollback

Commit/push this specification separately and obtain explicit approval before test-first application changes. Deploy additive migration and compatibility API first, then upgraded readers, then enable grouped creation behind a default-off flag subordinate to allocationPlansEnabled. Roll back by disabling grouped creation while keeping upgraded readers for already-created multi-file plans. Do not roll back to a reader that assumes every plan has one file, drop child data, or delete stored objects.

## Open questions

- Approval is requested for the proposed interaction sequence and name validation rules. The user has confirmed the multiple-files-per-plan domain decision and the supplied visual states; application implementation is pending approval of this complete amendment.
