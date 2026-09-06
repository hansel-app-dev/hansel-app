# Feature: Add Site Allocation Plans

- ID: `site-allocation-plans-add`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-06`
- Domain references: `CONTEXT.md — Organization, Membership, Organization Role, Site, Site Access, Allocation Plan, Sign, Document, Image, and Storage Allowance; docs/domain/figjam-object-catalog.md — Allocation Plan, Site, Organization, Document, and Image objects; Canonical interpretation notes; Nesting map; Current implementation alignment; and Known ambiguities 7, 8, and 10`
- Design authority: `Figma Hansel App UI frame 2057:3458 (1.2.2 New site > Allocation plan / Add plans)`
- Design evidence: `The exact frame was browser-inspected at 100% zoom on 2026-09-06; the structured Figma connector was blocked by the Professional View-seat MCP call limit`
- Supersedes on implementation: `site-allocation-plans-empty-state REQ-002, REQ-012, REQ-013, and its bounded no-persistence assumptions; all unaffected Site-shell, access, accessibility, and failure requirements remain authoritative`

## Problem

Authorized Site managers can reach the Allocation Plans empty state, but `Add plan` is deliberately disabled because Hansel has no approved Allocation Plan persistence, upload, storage, or authorization contract. The supplied Figma frame defines a multi-file upload modal and identifies PNG, JPG, and PDF files up to 5 MB. Hansel needs a tenant-isolated way to add those files to a Site without exposing AWS credentials, making objects public, or turning design examples into undocumented behavior.

## Outcome and success metrics

- An authenticated Organization Owner or Administrator with access to a Site can open the Figma-derived `Add plans` modal, select one or more supported files, and add each valid file as an Allocation Plan for that Site.
- Valid files upload directly to a private, stage-scoped S3 bucket through bounded, single-object presigned requests and become visible only after server verification and atomic finalization.
- The Allocation Plans route truthfully transitions from `No plans` to a latest-created-first list without exposing incomplete, rejected, cross-Organization, or orphaned uploads.
- At least 99% of locally valid uploads complete without an application error, excluding client disconnects and AWS regional incidents; failed or abandoned uploads never become visible and are automatically removed.
- Frontend and backend unit coverage remains 100%, and contract, integration, CDK, Storybook, deterministic visual/accessibility, and application E2E checks pass.

## Non-goals

- Google Maps, geocoding, map markers, or `Use Google Maps` behavior.
- Naming, renaming, replacing, editing, downloading, sharing, archiving, restoring, or deleting an Allocation Plan.
- Creating Signs, linking Signs to Allocation Plans, preview annotations, comments, thumbnails, OCR, PDF rasterization, or image transformations.
- Defining or enforcing the commercial Plan's Storage Allowance; this slice enforces only the per-file limit because no approved Organization storage allowance is persisted.
- Malware scanning. Supported files remain private, are never executed or embedded as active HTML, and are served only through a future separately approved read/download contract.
- Client-supplied S3 keys, bucket names, Organization IDs, uploader IDs, timestamps, status, or trusted MIME metadata.
- Creating infrastructure imperatively with developer AWS access keys or exposing AWS credentials to the browser. Infrastructure is versioned in CDK and deployed through the existing protected pipeline.

## Requirements

- REQ-001: The existing `/sites/{siteId}/allocations` route MUST enable `Add plan` only for an authenticated Organization Owner or Administrator who can access the selected Site. Editors, Viewers, inaccessible Sites, cross-Organization identifiers, expired sessions, and disabled rollout state MUST fail closed; the server MUST independently enforce the same authorization on every mutation.
- REQ-002: Invoking `Add plan` MUST open a modal matching Figma frame `2057:3458`, with the exact visible strings `Add plans`, `Add plans here`, `Drag your file(s) here to get started`, `or`, `Browse files`, `PNG, JPG and PDF supported and up to 5mb.`, `Cancel`, and `Upload`. The decorative file-upload symbol and close symbol MUST have no redundant accessible name.
- REQ-003: The modal MUST accept one or more files through both a native file picker and drag-and-drop. It MUST accept only files whose filename extension and browser-reported media type correspond to PNG, JPEG, or PDF, and whose size is from 1 byte through 5 MiB (5,242,880 bytes). The browser check is advisory; the server MUST repeat authoritative checks.
- REQ-004: The modal MUST show the selected files in deterministic selection order with escaped filename, formatted size, per-file state, and a remove action available before upload. Duplicate files in one batch MUST be rejected when normalized filename, byte size, and SHA-256 digest all match. A filename is display metadata only and MUST NOT influence an object key or filesystem path.
- REQ-005: `Upload` MUST remain disabled when no valid file is selected, validation errors exist, or a batch is pending. Close, Escape, backdrop, and `Cancel` MUST dismiss without a request before upload starts. If a transfer has started, dismissal MUST require an accessible confirmation that explains unfinished files will be abandoned; confirming MUST stop client work and leave server cleanup to the bounded expiry process.
- REQ-006: The browser MUST request an upload intent from Hansel for each file using its normalized display name, exact byte size, SHA-256 digest, and claimed media type plus one opaque batch idempotency key. The server MUST derive the User, Membership, Organization, Site, role, object key, timestamps, and lifecycle status from trusted state.
- REQ-007: Creating upload intents for one batch MUST be idempotent. Reusing the same batch key with the same normalized manifest MUST return the original intent set; reusing it with different content MUST return a categorical conflict. A batch MUST contain no more than 20 files and 100 MiB of claimed bytes so retries and resource use stay bounded.
- REQ-008: An upload intent MUST create an Organization- and Site-owned `AllocationPlanUpload` record in `PENDING` state with an opaque UUID, generated S3 object key, normalized original filename, claimed media type, expected byte size, SHA-256 digest, uploader User ID, creation time, and a 15-minute expiry. It MUST NOT create a visible Allocation Plan yet.
- REQ-009: Hansel MUST return a SigV4 presigned S3 `PUT` URL valid for no more than 15 minutes and bound to exactly one generated key, the expected content type, exact content length, and required checksum header. The response MUST NOT reveal AWS credentials, bucket-list capability, another object's key, or a reusable prefix. Browser uploads MUST not traverse the API load balancer.
- REQ-010: The storage bucket MUST be a dedicated, stage-scoped CDK resource with all public access blocked, bucket-owner-enforced object ownership, TLS-only access, S3-managed encryption at rest, versioning in production, access logging to a separately protected log bucket or the repository's approved centralized equivalent, no website hosting, no permissive CORS origin, and `RETAIN` removal policy in production. Only the API task role MUST receive the least-privilege object and presigning permissions for the Allocation Plan prefix; the deployment role alone manages bucket configuration.
- REQ-011: Bucket CORS MUST allow only `PUT` and the checksum/content-type headers from the configured same-origin Hansel application origins for that stage, with no wildcard production origin and no credentialed cross-origin request. S3 object keys MUST use generated opaque identifiers under a stage-scoped quarantine prefix and MUST contain no Organization name, Site name, email address, or original filename.
- REQ-012: After every successful S3 transfer, the browser MUST call the finalize endpoint with only the upload-intent ID. The server MUST perform an S3 `HeadObject`, require the expected key, exact byte count, checksum, allowed stored content type, and a still-valid `PENDING` intent, then inspect the object's leading signature bytes through a bounded ranged read. PNG MUST have the PNG signature, JPEG MUST have a valid JPEG start marker, and PDF MUST begin with `%PDF-`; a mismatch MUST reject the intent and schedule the object for removal.
- REQ-013: Successful verification MUST atomically create one visible Site-owned `AllocationPlan`, associate it with the verified object, record its normalized original filename, canonical media type, byte size, SHA-256 digest, uploader User ID, created time, and modified time, and mark the upload intent `COMPLETED`. One upload intent MUST finalize at most once and retries MUST return the same Allocation Plan.
- REQ-014: Finalization MUST fail generically for an expired, missing, already rejected, unauthorized, cross-Organization, wrong-Site, wrong-key, wrong-size, wrong-checksum, unsupported-signature, or unavailable object without exposing storage details. Invalid uploaded bytes MUST never create an Allocation Plan. The client MUST show a concise per-file failure and allow a fresh retry with a new intent.
- REQ-015: `GET /api/sites/{siteId}/allocation-plans` MUST return only finalized Allocation Plans for the authorized Site, ordered by `createdAt` descending and opaque ID as the stable tie-breaker. It MUST expose ID, escaped display filename, canonical media type, byte size, created time, modified time, and uploader display name only; it MUST NOT expose bucket names, object keys, presigned URLs, checksums, email addresses, pending uploads, or another Site's data.
- REQ-016: The Allocation Plans route MUST load its existing authenticated Site shell inputs and the Allocation Plan collection without rendering stale identities. Zero results MUST preserve the approved `No plans` state. One or more results MUST replace the empty state with a semantic `Allocation Plans` list and retain the enabled `Add plan` action for authorized managers; unsupported preview/download actions MUST not be fabricated.
- REQ-017: The upload flow MUST use the existing application session, exact-origin mutation proof, private/no-store API responses, strict request/response parsing, bounded categorical errors, correlation IDs, and request limits. Logs, metrics, traces, and alarms MUST never contain filenames, presigned URLs, object keys, checksums, Site or Organization names, or other unbounded/personal dimensions.
- REQ-018: A scheduled cleanup path MUST mark expired `PENDING` intents `EXPIRED` and remove their quarantine objects. A bucket lifecycle rule MUST independently abort incomplete multipart uploads and expire noncurrent versions; unreferenced quarantine objects MUST be deleted within 24 hours. Finalized production objects MUST be retained unless a future approved deletion or Organization-retention specification says otherwise.
- REQ-019: The browser MUST upload at most three files concurrently, show queued/uploading/verifying/complete/failed state without relying on color, prevent duplicate submissions, retain recoverable failed selections, and announce aggregate and per-file progress to assistive technology without excessive live-region updates.
- REQ-020: The modal MUST trap focus, focus its heading or first useful control on open, restore focus to `Add plan` on close, support keyboard file selection and removal, expose associated validation messages, maintain visible focus, and meet WCAG 2.2 AA. It MUST reflow without horizontal page scrolling at 320 CSS pixels and 200% zoom.
- REQ-021: New reusable modal upload-zone, selected-file row, and Allocation Plan list components plus normal, empty, invalid-type, too-large, duplicate, multi-file, pending, partial-failure, complete, narrow-width, and 200%-zoom states MUST be added to Storybook using API-independent fixtures.
- REQ-022: OpenAPI MUST define the collection, upload-intent, and finalize contracts with strict schemas and categorical failures. Prisma MUST add tenant-safe Allocation Plan and upload-intent models plus forward-only migration, indexes for Site ordering and expiry cleanup, unique idempotency constraints, and referential rules that cannot orphan a finalized record from its Site or Organization.
- REQ-023: Frontend and backend unit suites MUST retain 100% statement, branch, function, and line coverage. Tests MUST prove permissions, tenant isolation, exact limits, signatures, checksums, idempotency, finalize races, expiry cleanup, private bucket policy, least privilege, exact UI copy, picker/drop parity, keyboard/focus behavior, concurrency bounds, partial failure, responsive reflow, axe, deterministic visuals, and critical E2E upload/list journeys without using live AWS.
- REQ-024: Infrastructure and application behavior MUST be guarded by an `allocationPlansEnabled` stage context/runtime flag that defaults off in production. No local `.env` AWS key is copied into source, CloudFormation, the task definition, a browser bundle, logs, or test fixtures. CDK synthesis and tests MUST not require live AWS credentials or create a bucket.

## Acceptance scenarios

### AC-001 — Authorized manager adds supported Allocation Plans [REQ-001..REQ-016, REQ-019]

- Given an authenticated Owner or Administrator can access a Site with no Allocation Plans
- When they open `Add plan`, choose valid PNG, JPEG, and PDF files of no more than 5 MiB each, and activate `Upload`
- Then Hansel creates bounded upload intents, transfers no more than three files concurrently to private S3, verifies each object, and finalizes one Allocation Plan per valid file
- And the route replaces `No plans` with the latest-created-first Allocation Plans list without exposing storage identifiers

### AC-002 — Invalid files are rejected before or after transfer [REQ-003, REQ-004, REQ-012, REQ-014]

- Given a file is empty, larger than 5 MiB, duplicated in the batch, has an unsupported extension or claimed media type, or its bytes do not match the allowed signature
- When it is selected, uploaded through a manipulated client, or finalized
- Then Hansel rejects it at the earliest trusted boundary with a concise categorical error
- And it never becomes a visible Allocation Plan or reveals internal storage data

### AC-003 — Authorization and tenant isolation fail closed [REQ-001, REQ-006, REQ-14..REQ-17]

- Given an Editor, Viewer, expired session, inaccessible Site, or manipulated Organization/Site/upload-intent identifier
- When the client or caller attempts to list, create, upload, or finalize
- Then the browser exposes no enabled mutation and the server independently rejects the operation generically
- And no cross-Organization metadata, object access, or existence signal is disclosed

### AC-004 — Retry and concurrency do not duplicate records [REQ-005..REQ-009, REQ-013, REQ-019]

- Given the browser retries after an ambiguous intent or finalize response, double-activates Upload, or two finalize requests race
- When the same idempotency material is submitted
- Then Hansel returns the original intent or Allocation Plan and creates no duplicate records or object keys
- And a changed manifest under the same batch key produces a conflict

### AC-005 — Abandoned and invalid objects are removed [REQ-008, REQ-014, REQ-018]

- Given an upload is abandoned, expires, fails verification, or leaves an unreferenced quarantine object
- When cleanup runs or the lifecycle deadline is reached
- Then the intent becomes expired or rejected and the object is removed within 24 hours
- And no finalized production object is deleted by this initial cleanup policy

### AC-006 — The Figma modal remains accessible in boundary states [REQ-002..REQ-005, REQ-019..REQ-021]

- Given keyboard-only use, a screen reader, 320 CSS pixels, 200% zoom, multiple files, or a partial upload failure
- When the member opens, operates, cancels, confirms abandonment, retries, or completes the modal
- Then focus, exact copy, validation, status, progress, and actions remain ordered and understandable without horizontal page scrolling
- And Storybook, axe, and deterministic visual checks pass

### AC-007 — Infrastructure is private, reproducible, and staged [REQ-009..REQ-011, REQ-017, REQ-018, REQ-024]

- Given CDK is synthesized for test and production
- When the Allocation Plan feature is inspected or deployed through the protected pipeline
- Then the stage-scoped bucket, CORS, lifecycle, encryption, public-access block, production retention/versioning, logging, and least-privilege task policy match the specification
- And no developer AWS credential is embedded or required for synthesis and production behavior remains off until explicitly enabled

## UX and accessibility

The first modal state follows frame `2057:3458`: a centered white dialog over the muted Site Allocation Plans page, compact title/close header, `Add plans here` label, large dashed drop zone, file-upload artwork, centered drag/picker copy, supporting format/size text, and footer actions. After selection, the drop zone remains available for additional files and selected-file rows show truthful state. `Upload` becomes available only when the manifest is valid.

The dialog is labelled by `Add plans`, traps focus, restores it to the invoker, and supports Escape and backdrop dismissal under REQ-005. Drag-and-drop is never the only input method. Validation is associated with the affected file; progress is exposed as bounded text and progress semantics. Completed and failed states use iconography/text in addition to color. Names are escaped and visually truncated with complete accessible text. Responsive states preserve reachable header, scrollable content, and footer actions.

## API and integrations

- `GET /api/sites/{siteId}/allocation-plans` lists finalized Site-owned Allocation Plans.
- `POST /api/sites/{siteId}/allocation-plan-upload-batches` creates idempotent upload intents and returns one bounded presigned `PUT` contract per accepted file.
- `POST /api/sites/{siteId}/allocation-plan-uploads/{uploadId}/finalize` verifies S3 state and atomically finalizes one Allocation Plan.
- S3 stores quarantined and finalized objects in a private stage-scoped bucket. The API signs uploads and performs bounded `HeadObject`, ranged `GetObject`, copy/tag transition if required by the implementation, and cleanup operations through its task role.

Every API response is strict, private, and `no-store`. Mutations require the current session and exact-origin proof. Presigned URLs are sensitive bearer capabilities and are returned only once through authenticated intent responses, never logged, persisted in browser storage, or included in telemetry. The OpenAPI contract represents the URL as a time-bounded opaque string and enumerates required upload headers.

## Data and migration

Add `AllocationPlan`, `AllocationPlanUpload`, and a batch-idempotency representation under the existing internal Prisma `Tenant`, `Site`, and `User` relations. `AllocationPlan` stores the generated object key as internal operational data plus the approved response metadata. `AllocationPlanUpload` stores expected verification values, lifecycle status, expiry, rejection category, and an optional finalized-plan relation. Database identifiers are UUIDs; all tenant and Site relationships are explicit foreign keys and indexed.

The migration is additive and requires no backfill. Existing Sites begin with zero Allocation Plans, preserving the current empty state. The approved spec resolves the catalog's unspecified identifiers, required fields, ordering, lifecycle, byte limit, supported types, ownership, tenant isolation, timestamps, and cleanup only for this initial add/list slice. It deliberately does not resolve Sign nesting, editing/deletion, Organization Storage Allowance, or media-library ownership.

## Security and privacy

The server derives every authorization and storage decision. Client filename, MIME type, size, digest, and completion claims remain untrusted until verified. Generated object keys contain no personal or business names. Public access and ACLs are blocked; objects are encrypted, available only over TLS, and never served by the web CloudFront origin. Presigned upload capability is exact-key, short-lived, header-bound, and omitted from logs and persistent client storage.

Filenames and uploader identity are personal/organization data and are exposed only to members authorized to read the Site. Upload signatures are inspected through bounded byte ranges and content is never interpreted as HTML or executed. Malware scanning is explicitly excluded from this slice; therefore the feature supplies no preview or download surface. A later read/download specification must reassess scanning, safe content disposition, PDF handling, and retention before users can retrieve stored bytes.

## Reliability and observability

Intent creation and finalization are separately idempotent. S3 transfer failure does not create a visible record; database finalization failure can be retried against the same verified object. Expiry and lifecycle cleanup bound orphan cost independently. The client limits concurrency to three and surfaces partial completion rather than rolling back successful independent files.

Metrics cover intent accepted/rejected, transfer finalization succeeded/rejected, verification category, cleanup success/failure, expired-intent age, and aggregate uploaded bytes using bounded dimensions only. Alerts cover sustained finalize failure, cleanup failure/age, and S3 access denial. Structured logs include correlation ID and internal opaque IDs only. The existing API availability objective applies; S3 availability errors are categorical and retryable.

## Test strategy

- Start with OpenAPI and contract tests for exact limits, normalized manifests, strict responses, categorical errors, and opaque identifiers.
- Use test doubles for unit suites and an S3-compatible local test seam or AWS SDK request interception for integration; CI and E2E MUST never require live AWS credentials.
- Exercise authorization, tenant isolation, batch idempotency, presigning constraints, `HeadObject`, signature range reads, checksum/size mismatches, finalize races, transaction rollback, expiry, and cleanup.
- Add frontend tests for exact Figma copy, picker/drop parity, multiple selection, invalid/duplicate files, removal, cancel/abandon confirmation, three-transfer limit, partial failure, retry, progress announcements, and list transition.
- Add Storybook and deterministic Playwright states from REQ-021, keyboard/focus-return checks, axe, 320-pixel and 200%-zoom checks, and critical upload/list journeys using a controlled S3 seam.
- Extend CDK assertions for bucket count and configuration, task-role least privilege, no public policy, exact production CORS origins, lifecycle, logging, retention/versioning, feature-flag environment, and credential-free synthesis.
- Run focused red-green-refactor checks while implementing, then migrations, specification validation, formatting, lint, types, 100% unit coverage, production builds, Storybook, design-system checks, application E2E, and CDK synthesis.

## Rollout and rollback

Commit and approve this specification before implementation. Deploy the additive database migration and private bucket/policies before enabling application behavior. Release API and frontend with `allocationPlansEnabled=false` in production, run smoke checks for session enforcement, list isolation, presign constraints, upload verification, cleanup, and alarms, then enable through the protected deployment input.

Rollback disables intent creation first while preserving reads of already finalized metadata, then restores the prior application artifact. The additive tables and retained production bucket stay in place so rollback never destroys user files. Failed rollout objects remain subject to quarantine cleanup. A later reviewed migration may remove unused schema or retained storage only after ownership and retention decisions are approved.

## Open questions

- None. Approval accepts the explicit initial constraints above, including manager-only creation, PNG/JPEG/PDF at 5 MiB each, 20 files/100 MiB per batch, no download/preview/delete, no malware scanning, no Storage Allowance enforcement, 15-minute upload intents, and 24-hour orphan cleanup.
