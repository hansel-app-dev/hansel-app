# Feature: Add Site Cover Image

- ID: `site-cover-image-add`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-07`
- Product approval: `Pending explicit user approval`
- Domain references: `CONTEXT.md — Organization, Membership, Organization Role, Site, Image; docs/domain/figjam-object-catalog.md — Objects and data points (Site “Photo / Cover”, Image filename/link/upload metadata); Canonical interpretation notes; Known ambiguities 8 and 10; Current implementation alignment`
- Design authority: `User-supplied Add new site – Step 3_ Add cover image.png (1512×982)`
- Design evidence: `The design establishes a centred optional cover-image upload step with a dashed drop zone, file icon, drag/browse affordances, PNG/JPG and 3 MB guidance, Skip for now, and a disabled-until-valid Add cover image action. The visible “Step 2 of 3” conflicts with the filename and existing two-step flow; this specification resolves it as Step 3 of 3.`
- Extends: `sites-add-new REQ-001..REQ-023 after the existing Details and Invite team members steps`

## Problem

Site creation currently navigates directly to the new Site’s Activity page. An authorized creator cannot optionally add the Site cover Image shown by the supplied design before finishing the flow.

## Outcome and success metrics

- Successful Site creation opens a truthful third step labelled `Add a cover image`.
- The creator can upload one valid PNG or JPEG up to 3 MB, or skip without uploading.
- Either completion path replaces navigation with the created Site’s Activity destination.
- The stored Image is private, tenant-scoped, and linked only to the newly created Site.

## Non-goals

- Image editing, cropping, rotation, focal-point selection, galleries, multiple covers, camera capture, external URLs, HEIC, SVG, GIF, WebP, video, or document upload.
- A general media library, reusable Image picker, cover removal/replacement after creation, image optimization/CDN transformation, or public object access.
- Changing Site access, invitations, billing, Site creation authorization, or the first two approved steps.
- Copying sample Sites, Users, filenames, or background content from the design.

## Requirements

- REQ-001: After the existing Step 2 `Create site` request succeeds, the modal MUST retain the returned Site identifier and safe Activity destination, MUST NOT navigate yet, and MUST show `Add a cover image` as `Step 3 of 3`. Site creation remains atomic and idempotent; reopening or retrying the upload MUST NOT create another Site.
- REQ-002: Step 3 MUST match the supplied desktop composition: existing modal/backdrop treatment; compact title and close control; dashed upload region; upload-file symbol; `Drag your file here`; an `or` divider; `Browse files`; `PNG, JPG supported and up to 3 MB.`; footer progress; `Skip for now`; and `Add cover image`.
- REQ-003: The browser MUST accept exactly one `.png`, `.jpg`, or `.jpeg` selection whose detected media type is `image/png` or `image/jpeg` and whose size is 1 through 3,000,000 bytes. It MUST validate extension, declared type, byte size, and decoded image validity without trusting the filename alone. Invalid files MUST remain unsubmitted and produce a specific accessible recovery message.
- REQ-004: The dashed region MUST support both file selection and native drag/drop. Browse MUST use a labelled file input. Drag state, selected-file state, validation error, upload-pending state, upload-failure state, and upload-success transition MUST be understandable without relying on color. Keyboard operation MUST not require drag/drop.
- REQ-005: Before a valid selection, `Add cover image` MUST be visibly disabled and expose its disabled state. After a valid selection, the view MUST show the escaped filename and formatted byte size, allow replacement before submission, and enable `Add cover image`.
- REQ-006: Activating `Add cover image` MUST initiate at most one upload, show `Adding cover image…`, disable replacement/skip/close during the committed upload, and prevent duplicate requests. A recoverable failure MUST preserve the selected file in memory, show an alert, and allow retry without creating another Site.
- REQ-007: Activating `Skip for now` MUST perform no upload or Image write and MUST replace navigation with the server-returned `/sites/:siteId/activity` destination. The close control or Escape on Step 3 MUST use the same skip completion behavior so an already-created Site is never presented as discarded.
- REQ-008: A successful upload MUST create or finalize exactly one tenant-owned Site cover Image linked to the created Site, then replace navigation with its Activity destination. Replaying the same upload operation MUST return the original cover result; a different payload under the same idempotency key MUST conflict.
- REQ-009: Only the authenticated Membership that successfully created the Site in this flow MAY complete its pending cover upload. The server MUST derive User, Membership, Organization, and Site from the application session and creation result, verify Site ownership and tenant scope, and reject cross-tenant, expired, replaced, unauthorized, or fabricated identifiers generically.
- REQ-010: Cover bytes MUST be stored in a private encrypted S3 bucket under a server-generated opaque key. Public ACLs and caller-supplied object keys are forbidden. The API/database MAY retain a bounded normalized original filename, detected media type, exact byte count, opaque object key, uploader Membership, and timestamps; it MUST NOT retain local paths, EXIF location/device metadata, browser MIME claims as authority, or raw bytes in PostgreSQL.
- REQ-011: The server MUST verify size and image signature/decodability before finalization, remove EXIF and nonessential metadata, and reject malformed or polyglot content. Incomplete staged objects MUST be lifecycle-deleted after 24 hours. Rejected or superseded objects MUST not become Site covers.
- REQ-012: Upload authorization MUST expire after 15 minutes and be bound to the Site, authenticated session family, accepted media type, byte limit, and idempotency operation. Responses and logs MUST expose no S3 credentials, bucket name, internal tenant/User/Membership keys, local filename paths, or object key.
- REQ-013: Add strict private, `no-store` API contracts for starting and finalizing the cover upload. The final response MUST contain only the safe Activity destination. Mutation requests MUST retain the existing exact-origin, session rotation, CSRF, categorical-error, and rate/size-limit protections.
- REQ-014: The Site cover record MUST be optional and unique per Site. The forward migration MUST enforce tenant-consistent Site linkage and one current cover. Site deletion MUST delete its cover record and schedule object deletion; failed object cleanup MUST be retryable without retaining an accessible orphan.
- REQ-015: The modal MUST remain usable at 320 CSS pixels and 200% zoom without document-level horizontal scrolling. It MUST trap focus, restore focus only when the whole creation modal closes, expose status/alert changes, provide at least 24×24 targets, and pass serious axe checks.
- REQ-016: API-independent Storybook stories MUST cover empty, drag-active, selected, invalid type, oversized, pending, failure, narrow, and 200%-zoom states. The reusable upload/drop-zone component and its important states MUST be represented.
- REQ-017: Tests MUST cover the third-step transition, no premature navigation, skip/close/Escape completion, selection and replacement, drag/drop, PNG/JPEG acceptance, extension/type/signature/size rejection, pending/retry/duplicate prevention, idempotency, authorization, tenant isolation, expiry, private storage, metadata removal, cleanup, accessibility, responsive layout, and the final Activity navigation. Existing Site creation tests MUST remain green.
- REQ-018: Rollout MUST use `siteCoverImageEnabled`, default off in production. When disabled, successful Site creation MUST preserve the currently approved immediate Activity navigation and require no upload storage configuration. Rollback disables new starts while allowing already-issued uploads to expire or finalize safely.

## Acceptance scenarios

### AC-001 — Creation continues to optional cover upload [REQ-001, REQ-002]

- Given an authorized creator completes the existing first two Add Site steps
- When Site creation succeeds
- Then the same modal shows `Add a cover image` and `Step 3 of 3`
- And the browser has not navigated or created a second Site

### AC-002 — Creator uploads a valid cover [REQ-003..REQ-006, REQ-008]

- Given Step 3 is open
- When the creator selects or drops one valid PNG or JPEG no larger than 3,000,000 bytes and activates `Add cover image`
- Then exactly one private, verified Site cover is finalized
- And the browser replaces navigation with the created Site’s Activity destination

### AC-003 — Creator skips the optional cover [REQ-007]

- Given Step 3 is open after the Site exists
- When the creator activates `Skip for now`, closes the modal, or presses Escape
- Then no Image or object is written
- And the browser replaces navigation with the created Site’s Activity destination

### AC-004 — Invalid content fails safely [REQ-003..REQ-006, REQ-011]

- Given a file is empty, oversized, unsupported, malformed, extension/type mismatched, or not a decodable PNG/JPEG
- When it is selected, dropped, uploaded, or finalized
- Then it never becomes the Site cover
- And the creator receives a specific recoverable message without losing the created Site

### AC-005 — Storage and authorization remain private [REQ-008..REQ-014]

- Given a stale, replayed, cross-tenant, fabricated, or unauthorized upload attempt
- When the API evaluates it
- Then it fails generically without exposing object or identity keys
- And no cover association or accessible orphan is created

### AC-006 — Rollout is reversible [REQ-018]

- Given `siteCoverImageEnabled` is false
- When Site creation succeeds
- Then the current immediate Activity navigation remains unchanged
- And no cover-upload endpoint or bucket configuration is required by the browser

## UX and accessibility

The design is authoritative for the Step 3 hierarchy and spacing. Canonical copy uses `Step 3 of 3` because Details and Invite team members already occupy Steps 1 and 2. `MB` is used for the unit. Selected and error states extend the design truthfully without inventing editing capability. Native file input, drag/drop enhancement, keyboard activation, focus containment, status announcements, and visible focus are required.

## API and integrations

The existing `POST /api/sites` response supplies the created Site and safe destination internally to the modal. New strict start/finalize cover-upload operations use the existing application session and a short-lived server-bound upload operation. S3 stores private bytes; PostgreSQL stores the bounded Site/Image association. No public URL or third-party image service is introduced.

## Data and migration

Add an optional, tenant-consistent, unique Site cover record with opaque object key, normalized original filename, detected media type, byte count, uploader Membership, and timestamps. Add an idempotent staged-upload record with expiry and state. Use a forward-only migration; no backfill is required because existing Sites have no cover.

## Security and privacy

Files are hostile input. Both browser and server validate, while only server verification authorizes finalization. The bucket is private and encrypted; metadata is stripped; object identifiers and infrastructure details remain internal. Filename and upload metadata are personal/operational data and must remain bounded, escaped, tenant-scoped, and absent from telemetry dimensions.

## Reliability and observability

Site creation success is durable before Step 3 begins. Cover failure cannot roll back or duplicate the Site. Staged-upload cleanup and failed object deletion are retryable. Events are categorical and privacy-safe: started, rejected category, finalized, skipped, cleanup retried, and cleanup exhausted; they contain no filename, Site name, identity, bucket, or object key.

## Test strategy

- Start with strict shared-contract tests and backend authorization/idempotency tests.
- Add storage adapter and PostgreSQL integration tests for private keys, tenant consistency, expiry, uniqueness, finalization, rollback, and cleanup.
- Add frontend tests for every Step 3 transition and file state before implementation.
- Add Storybook and browser checks for design comparison, keyboard/focus, axe, 320px, and 200% zoom.
- Run focused suites during development, then the full repository verification and authenticated Site-creation journey.

## Rollout and rollback

Deploy the additive database migration and private bucket first. Deploy API/frontend with `siteCoverImageEnabled=false`, validate protected-environment PNG/JPEG upload and skip paths, then enable deliberately. Rollback disables new Step 3 starts; existing signed operations may safely finalize until their 15-minute expiry, and lifecycle cleanup removes abandoned objects.

## Open questions

- None. This specification resolves the reference footer mismatch as `Step 3 of 3`, treats cover upload as optional after durable Site creation, and limits this increment to one private PNG/JPEG up to 3,000,000 bytes.
