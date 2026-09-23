# Feature: Single-file Allocation Plans and plan switching

- ID: `allocation-plan-single-file`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-23`
- Domain references: `CONTEXT.md — Allocation Plan, Site, Site Access, Sign, Activity; docs/domain/figjam-object-catalog.md — Objects and data points (Allocation Plan and Site), Nesting map, Known ambiguities 7, 8 and 10, Current implementation alignment (multiple-file amendment)`
- Product decisions: `On 2026-09-23 the user clarified that the Allocation Details dropdown lists different allocations and each allocation has one file. The user then confirmed splitting existing multi-file allocations while preserving every file and its Signs. Full specification approval remains pending.`
- Supersedes on approval and implementation: `allocation-plan-multiple-files cardinality, multi-file creation and related acceptance scenarios; allocation-details-design file-switching semantics; references to the file selector in allocation-plan-signs, allocation-plan-toolbar and allocation-plan-hand-tool. Other approved behavior remains authoritative.`

## Problem

The approved model groups multiple files under one Allocation Plan and the details selector switches files. The corrected product model requires a separate Allocation Plan for each file and navigation between the Site's Allocation Plans.

## Outcome and success metrics

Every finalized Allocation Plan has exactly one file. The details dropdown switches Allocation Plans within the current Site. Migration preserves every stored file and shared Sign, including each placement's coordinates and file association.

## Non-goals

- Multiple-file bulk creation, file replacement, PDF page navigation, or new naming and renaming features.
- Changes to permissions, Sign attributes, discussion, media, storage limits, or viewer tools.
- Deleting files or Signs to achieve the new cardinality.

## Requirements

- REQ-001: Each finalized Allocation Plan MUST own exactly one verified file. Drafts may have no verified file while uploading. All creation paths MUST enforce this invariant server-side; requests containing zero or multiple files MUST fail atomically with a validation error and create no plan or Activity. Preserve valid creation idempotency and existing authorization.
- REQ-002: Add new Allocation MUST retain the required editable plan name and existing Next/upload/Add Allocation sequence, accepting exactly one PNG, JPEG or PDF under the existing 1 byte–5 MiB limit. Picker and drop MUST reject multiple files with accessible feedback without silently choosing one. An existing valid selection MUST survive a rejected selection. Preserve retry, removal, cancellation, expiration and verification behavior for the single file.
- REQ-003: Allocation Details MUST use the route's Allocation Plan as its selection. The dropdown MUST show real Allocation Plan names and list all accessible finalized Allocation Plans in the same Site in collection order, including the selected plan. Duplicate names remain valid and entries MUST use plan IDs as identity; show the original filename as secondary text to aid distinction. A Site with one plan MUST show its name without an empty actionable menu.
- REQ-004: Selecting a different plan MUST navigate client-side to its details route, update the breadcrumb and selector, load its sole file and Signs, clear prior selection and reset the view to fit. Back, Forward and direct links MUST restore the route-selected plan. Cancel obsolete preview/Sign requests and prevent late results or saves from changing the newly selected plan. Preserve the existing guards for pending or failed Sign edits before allowing navigation.
- REQ-005: Loading and retry errors MUST identify the current selection accessibly and MUST NOT display the previous plan's drawing or Signs as the new plan's content. Retry targets the current plan. Unknown, removed or inaccessible plans MUST use existing generic failure boundaries; never silently select another plan. Every read and write MUST independently enforce Organization and Site Access.
- REQ-006: Migration MUST split each existing multi-file plan into one plan per attached file in persisted order. Keep the original plan ID and name for the first file; use new IDs for subsequent files and names formed from the original plan name plus `—` plus the original filename, truncating to the existing 200-code-point limit. Duplicate names remain allowed. Preserve original filenames, upload IDs, private object keys, bytes, uploader, Site/Organization ownership and timestamps. Preserve existing single-file plan IDs and names unchanged.
- REQ-007: Migration MUST move every affected Sign placement to the plan that now owns its file, preserving the shared Sign ID, file ID, normalized coordinates and all Sign attributes, Documents, Images, Comments and reactions. Preserve existing Activity records and their original plan references without fabricating user creation Activities. Record old-plan/file/new-plan mappings for verification and recovery. Ambiguous placements or inconsistent file associations MUST stop migration for investigation; never guess or discard data.
- REQ-008: The migration MUST be transactional and safe to retry without duplicate plans. Enforce at most one attached file per plan in persistence and exactly one at finalized-plan creation. Existing single-file and legacy content paths MUST remain readable. Update canonical domain documentation and catalog alignment with the approved cardinality during implementation.
- REQ-009: Preserve selector geometry, keyboard operation, expanded/selected state, Escape/outside dismissal, focus management, responsive behavior, existing tools and zoom behavior. Add the reusable plan selector and important single-plan, multi-plan, duplicate/long-name, loading and error states to Storybook.

## Acceptance scenarios

### AC-001 — Create exactly one file [REQ-001, REQ-002]

- Given an authorized creator with a valid plan name and one supported file
- When upload verification and Add Allocation succeed
- Then exactly one plan, file association and creation Activity exist, including after a retry.
- Given zero or multiple files in a creation request, the server rejects the entire request; multi-file picker/drop input reports an error without losing a prior valid selection.

### AC-002 — Switch plans and navigate history [REQ-003..REQ-005, REQ-009]

- Given two accessible plans in one Site and a plan in another Site
- When a user opens the dropdown and selects the second same-Site plan
- Then only same-Site plans are listed, the route/name/breadcrumb/drawing/Signs change together and the view resets to fit.
- Back, Forward and direct links select the correct plan; rapid switching cannot display stale content; failed edits retain their existing navigation guard.
- A single-plan Site, duplicate names, keyboard use, long names and narrow layouts remain usable.

### AC-003 — Preserve existing data [REQ-006..REQ-008]

- Given a three-file plan with Signs on each file and an existing single-file plan
- When migration runs and is retried
- Then exactly three single-file plans replace the grouped plan, the first retains its ID/name, the others receive deterministic names, and the existing single-file plan remains unchanged.
- Every file remains readable and every Sign retains its identity, attributes, media, discussion and exact placement on its original file; historical Activity references remain valid and no new user creation Activity is invented.
- An ambiguous placement causes a rollback with no partial split.

### AC-004 — Reject invalid scope and cardinality [REQ-001, REQ-005, REQ-008]

- Given cross-Site/Organization, inaccessible, unverified or already-attached file references
- When a caller attempts creation or content access
- Then existing generic authorization/validation boundaries prevent disclosure and partial writes.
- Concurrent attachment attempts cannot attach a second file to a finalized plan.

## UX and accessibility

Retain the existing visual design, using plan names in the selector and original filenames as secondary menu text. Announce selection, upload validation and preview errors. Verify keyboard focus, screen-reader labels, 320 CSS pixel layout and 200% zoom. Switching plans must respect existing unsaved-edit protection.

## API and integrations

Update OpenAPI and shared creation schemas to require exactly one retained verified file ID. Existing collection responses may retain a one-element files array for compatibility. Reuse Site-scoped listing and existing plan/file content endpoints; do not add storage URLs or a new cross-Site listing. Old clients submitting multiple files receive validation failure, never a silent partial creation. Review creation-key replay behavior so a pre-migration committed request cannot recreate a grouped plan or return stale multi-file metadata; preserve its original result identity with current canonical metadata.

## Data and migration

Use AllocationPlan, AllocationPlanUpload and Sign placement associations; avoid duplicating objects in storage. Preflight finalized file counts, legacy associations, placements and creation idempotency records. Preserve migration mapping in a durable migration-owned record or artifact with identifiers only. Split and reassign dependent foreign keys atomically before adding the single-file association uniqueness constraint. Verify file/Sign totals and referential integrity before committing. Legacy single-file storage remains a valid sole-file representation; do not count its compatibility metadata as a second file.

## Security and privacy

Keep current upload/preview permissions, authentication, private storage, verification, cleanup and generic error policies. Migration mappings must contain no file contents, signed URLs or credentials. No widening of Site access or Organization ownership is permitted.

## Reliability and observability

Report aggregate pre/post migration counts and categorical failures without names or file contents. Creation remains atomic with Activity and idempotency recording. Preview cancellation and bounded retry retain existing behavior. Any unexpected cardinality, missing mapping or changed file/Sign count blocks rollout.

## Test strategy

After separate specification approval, write failing contract, creation/concurrency, migration, authorization and UI tests mapped to REQ IDs before application changes. Exercise real persistence constraints and rollback with representative legacy, single-file and multi-file fixtures. Cover rapid switching, history, Sign navigation guards, preview failure, idempotency replay, Storybook states and accessibility. Run required spec checks, formatting, lint, types, unit coverage, builds and relevant browser checks; report failures explicitly.

## Rollout and rollback

Commit and push this draft separately and obtain explicit approval before implementation. Quiesce allocation and Sign writes during migration so old servers cannot reintroduce grouped plans or race placement reassignment. Deploy schema, API and client coherently, validate migration counts and smoke-test creation/navigation before restoring writes. Back up metadata and mappings first. On failure keep writes disabled and restore the transactional pre-migration state or fix forward. After writes resume, never automatically merge split plans or roll back to code that permits multiple attached files; preserve new user changes and stored objects.

## Open questions

- None. The user accepted splitting existing allocations; naming, compatibility and rollout details above are proposed for full specification approval.
