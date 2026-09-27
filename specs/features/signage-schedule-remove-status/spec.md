# Feature: Remove Sign status

- ID: `signage-schedule-remove-status`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-27`
- Domain references: `CONTEXT.md — Sign, Site, Allocation Plan, Site Access, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Sign State), Known ambiguities requiring specification (7 and 10), Current implementation alignment (Sign), Source node index (Sign State node 25:360)`
- Supersedes on approval: `site-signage-schedule REQ-004, REQ-005, REQ-007, REQ-008, REQ-012, REQ-013, REQ-018, REQ-020, REQ-022 and associated acceptance/API/data text only where they require Sign status; allocation-plan-signs REQ-003 status default; allocation-plan-add-linear REQ-001 state default; CONTEXT.md Sign state wording and catalog implementation alignment`
- Requested scope: `Remove the Status column from the Signage Schedule and remove the shared Sign status field throughout frontend, backend, API contracts and database. Approval explicitly accepts removal of stored Sign status values after backup.`

## Problem

The user requests removal of Status from the Signage Schedule and every affected layer. Status is currently persisted on the shared Sign record, required by strict request/response schemas, editable inline, and used by search, filters and decorative map-indicator color. Hiding its column alone would retain an unwanted product attribute.

Existing approved specifications require three Sign statuses. This proposal explicitly changes that decision. The FigJam State label remains historical discovery evidence and does not authorize retaining or replacing the field.

## Outcome and success metrics

Authorized users can create, read and edit schedule and Allocation Plan Signs without a status attribute. The schedule has no Status column, status filter or status-derived styling. Existing Signs, placements, quantities, other attributes, Documents, Images and discussions survive migration. No executable Sign status reference remains, apart from historical migrations and documented superseded decisions.

## Non-goals

- Introducing a replacement state, workflow, approval attribute or persisted status archive.
- Changing unrelated upload, invitation, email-delivery or health statuses, HTTP status codes or accessible live-region roles.
- Changing Sign permissions, placement geometry, other attributes, ordering, totals, concurrency, selection or discussion behavior.

## Requirements

- REQ-001: The Signage Schedule MUST remove its Status header, column sizing, cells, editor and draft defaults. Comments MUST follow Content and its eye indicator. Preserve existing widths of remaining columns, 35 px row heights, quantity total alignment and flexible trailing space. Remove exactly the 150 px Status column from the minimum table width and adjust affected spans. Tables MUST scroll locally at narrow widths and 200% zoom.
- REQ-002: Search MUST match only code, location, content, comments and Sign Type name. Filter MUST contain only Sign Type choices, preserving OR within that category. Remove status labels, filter state and status-derived colors. The decorative map indicator MUST use the existing neutral grey treatment; its decorative accessibility semantics remain unchanged.
- REQ-003: Shared Sign responses and creation contracts MUST omit `status`. Remove `signStatusSchema` and the `field: status` update variant. The API MUST reject a create body containing `status` or a status update request with the existing categorical validation response (400), without mutating the Sign. All schedule and Allocation Plan readers, creators, serializers and client consumers MUST use the same status-free Sign contract.
- REQ-004: Prisma MUST remove `Sign.status` and `SignStatus`. A new forward migration MUST drop the column before dropping its enum without cascade. Preserve historical migrations. Existing records MUST retain their IDs, other fields, timestamps, relationships and quantities. Do not backfill a replacement field or emit Activity for schema cleanup. Creation via the schedule, point placement and Linear placement MUST succeed without writing Sign status.
- REQ-005: Update affected fixtures, mocks, contracts, API/module/component tests, Storybook stories and browser checks. Preserve meaningful filtered/editing/error/read-only stories using remaining fields. Add assertions for absent Status UI, strict rejection of legacy status writes, status-free responses and successful create/edit/reload through both schedule and Allocation Plan flows. Migration verification MUST prove all three legacy values migrate while unrelated data remains intact.
- REQ-006: Update canonical Sign wording and catalog implementation alignment on implementation, retaining the board's original State label as source evidence and recording that this approved decision removes the implemented attribute. Mark affected earlier specifications as superseded for status only and document the deployment and rollback procedure.
- REQ-007: Deploy the schema, backend and frontend coherently while Sign operations are disabled or traffic is quiesced. Back up affected data before dropping the field. Do not serve old clients against the new strict contract or old Prisma servers against the dropped column. After deployment require a fresh frontend load and verify schedule, point and Linear Sign creation and editing before restoring traffic.

## Acceptance scenarios

### AC-001 — Status-free schedule [REQ-001, REQ-002, REQ-005]

- Given a populated or empty schedule for an authorized manager or Viewer
- When they open the page, use search/filter/sort or select/collapse groups
- Then no Status column, editor or filter exists; search has no hidden status input; Comments follows Content; totals and remaining behavior stay correct
- And desktop, narrow and zoomed layouts retain local table overflow and accessible controls.

### AC-002 — Status-free shared Sign lifecycle [REQ-003, REQ-004, REQ-005]

- Given an authorized manager and an accessible Site and Allocation Plan
- When they create a schedule Sign, a point Sign or a Linear Sign, edit supported fields and reload both views
- Then each flow persists the canonical shared Sign without a status property and retains its expected relationships and quantities
- And a create body with status or a status update receives 400 without a database mutation.

### AC-003 — Preserve existing data [REQ-004, REQ-005, REQ-007]

- Given existing Signs covering UNSPECIFIED, IN_PROGRESS and APPROVED, with placements and associated media/discussions
- When the new migration runs on a backed-up database with Sign traffic quiesced
- Then the Sign column and enum are absent and all other Sign values, IDs, timestamps, relationships and totals are unchanged
- And applying the full migration history to a fresh database produces the same status-free schema.

### AC-004 — Consistent domain and release [REQ-006, REQ-007]

- Given approval of this specification
- When implementation is reviewed and released
- Then domain documentation explains the accepted removal and earlier status requirements are explicitly superseded
- And verification evidence records checks, migration results and a commit verified on origin/main.

## UX and accessibility

Preserve native table, disclosure, selection and remaining inline-control semantics. Keep existing saving/error announcements: ARIA `role="status"` is unrelated to the removed product field. Remove status-specific controls and labels only. Use neutral grey for the decorative map indicator. Update Storybook desktop, filtered, editable, read-only, narrow and zoom states to reflect the new column layout.

## API and integrations

This is a breaking change to the strict Sign schema shared by schedule and Allocation Plan operations. Update `specs/openapi.yaml`, `packages/contracts/src/index.ts`, schedule API validation/serialization and plan Sign consumers together. POST Sign bodies contain code, quantity, location, content and comments; PATCH still accepts one supported field plus expectedUpdatedAt. Preserve existing authentication, validation failure categories, private no-store responses and concurrency semantics. No external integration is added.

## Data and migration

Create a new Prisma migration that drops Sign.status and then SignStatus, without CASCADE, editing historical SQL, rebuilding Signs or resetting the database. Generate the Prisma client after changing the schema. Back up existing status values together with Sign identifiers and concurrency timestamps using the existing secure database backup process. This backup is for controlled recovery and is not a new application attribute or permanent archive. Verify row counts and unchanged remaining values/relationships before and after the migration on representative fixtures, then validate fresh-database migration replay. Migration execution against a deployed database follows its existing release controls.

## Security and privacy

Preserve Organization/Site scoping, Site Access, MANAGE_SIGNS checks, strict input schemas and optimistic concurrency. Unknown status inputs fail before persistence. Backups use the existing protected backup mechanism; never commit data snapshots, secrets or production records. No new telemetry fields or permissions are introduced.

## Reliability and observability

Reuse existing categorical schedule and Sign operation events and health checks. Observe read/create/update failures during smoke verification. A schema/API mismatch or failed migration keeps traffic quiesced until recovery. Never suppress validation failures by silently accepting discarded status writes.

## Test strategy

After explicit approval, write failing tests mapped to the acceptance scenarios before application changes. Cover strict contracts, API status rejection, schedule persistence/serialization, point and Linear Sign flows, absent UI/filter/search behavior, remaining edit/concurrency/permission behavior and quantity totals. Update affected Storybook fixtures and design-system/browser checks, including narrow/zoom and accessibility. Exercise the migration on an isolated database with all legacy statuses and on a fresh database. Run pnpm verify, relevant application E2E and CDK synthesis gates; document any failure explicitly.

## Implementation plan

1. Commit and push this draft separately; obtain explicit approval and record it before application changes.
2. Write failing contract, backend, UI and migration assertions for AC-001 through AC-003.
3. Update strict shared contracts and OpenAPI; remove backend serializers/write fields and Prisma status declarations; add the forward migration and regenerate the client.
4. Remove schedule status UI/search/filter/style paths and update every dependent client, test fixture and Storybook state, including plan Sign flows.
5. Update domain references, earlier specification supersession notes and a release/rollback runbook; run required checks and migration/browser smoke verification.
6. Review the staged implementation diff, commit and push directly to main, and verify the remote commit. Report remaining release blockers rather than claiming completion.

## Rollout and rollback

Quiesce affected schedule and plan Sign traffic, take a protected backup, apply the migration, deploy compatible API/frontend assets and invalidate old frontend loads, then run smoke checks before restoring traffic. Use existing feature flags where they cover the affected operations; quiesce remaining Sign operations during the coordinated change. The destructive migration cannot be reversed by rolling back binaries alone. Before resuming writes, recovery can restore the pre-migration database backup and matching application version. After writes resume, fix forward; do not restore an old whole-database snapshot over newer changes. If restoring the removed field is necessary, require a reviewed forward recovery migration and a decision about new Signs without historical status. Disabling features limits exposure but does not recover dropped values.

## Open questions

- None. Approval accepts complete removal of the shared Sign status attribute, rejection of legacy status writes, neutral map-indicator styling and backup-protected deletion of stored status values.
