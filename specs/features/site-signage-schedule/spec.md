# Feature: Site Signage Schedule

- ID: `site-signage-schedule`
- Status: `approved`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-06`
- Product and technical approval: `Original scope and exact-table visual amendment approved in the Codex task on 2026-09-06`
- Domain references: `CONTEXT.md — Organization, Membership, Organization Role, Site, Site Access, Allocation Plan, Sign, and Sign Comment; docs/domain/figjam-object-catalog.md — Organization, Site, Allocation Plan, and Sign objects; Canonical interpretation notes; Nesting map; Organization roles and permissions; Current implementation alignment; Source node index Sign nodes 24:25, 25:246, 25:437, 25:271, 25:272, and 25:360; and Known ambiguities 7 and 10`
- Design authority: `User-supplied screenshots 04.png and 05.png`
- Design evidence: `The supplied 1512×982 screenshots establish the Site shell, current Signage Schedule tab, toolbar, grouped Sign Type tables, editable-looking Sign rows, status colors, group totals, and add actions. Screenshot values are examples only and do not authorize seeded records.`
- Supersedes on implementation: `site-details-activity-shell REQ-010 and site-allocation-plans-empty-state REQ-009 only where Signage Schedule is unavailable; Activity, Allocations, and all other Site-shell requirements remain authoritative`

## Problem

Authorized Site members cannot open a Signage Schedule or manage Signs. The screenshots show the intended grouped schedule, but the repository has no approved Sign persistence model and the FigJam catalog does not define quantity, location, content, comments, lifecycle values, identifiers, validation, ordering, or edit behavior. This feature must introduce those decisions explicitly and keep every record isolated to its Organization and Site.

## Outcome and success metrics

- An authorized member can open `/sites/{siteId}/signage-schedule` and see real persisted Signs grouped by real persisted Sign Types in the established Site shell.
- Owners, Administrators, and Editors can create and rename Sign Types and create or edit Signs inline without leaving the schedule; Viewers receive a read-only schedule.
- Search, Filter, Sort, row selection, group totals, loading, empty, saving, conflict, and retry states are truthful and accessible.
- At least 99% of valid create/update requests complete or return an actionable categorical response within two seconds, excluding client disconnects and regional incidents.
- No example Sign, Sign Type, status, location, content, or comment from the screenshots is seeded or fabricated.

## Non-goals

- Deleting, archiving, duplicating, moving, or reordering Sign Types or Signs.
- Bulk editing or acting on selected rows; selection is local presentation state only in this slice.
- Sign photos, Sign Comments as separate discussion records, attachments, mentions, Activity records, notifications, audit history, import/export, printing, pagination, or offline editing.
- Positioning a Sign on an Allocation Plan, opening the map/eye glyphs, Google Maps, coordinates, rooms, wayfinding, or drawing tools. The narrow map and eye cells shown in screenshots 04.png and 05.png MAY be rendered as non-interactive, accessibility-hidden visual indicators. They MUST NOT be buttons, links, or imply available plan-positioning behavior.
- Custom statuses, custom colors, color editing, approval permissions distinct from Sign editing, workflow automation, or persisted filter/sort preferences.
- Reproducing screenshot sample data, Figma editor chrome, collaborators, cursor markers, or unimplemented overflow actions.

## Requirements

- REQ-001: The authenticated application MUST expose `/sites/{siteId}/signage-schedule` through a native, keyboard-operable `Signage Schedule` Site-section link. It MUST reuse the established Site shell, Organization/Site identity, visible-Sites collection, member preview, client-navigation seam, session replacement, and generic inaccessible-Site boundary. `Signage Schedule` MUST be the sole current Site section on this route.
- REQ-002: After validating the application session, the route MUST load the authorized Site context, visible Sites, and `GET /api/sites/{siteId}/signage-schedule`. The schedule MUST render only when the Site identifiers agree. Missing, malformed, deleted, inaccessible, cross-Organization, or cross-Site identifiers MUST disclose no record existence or data.
- REQ-003: A persisted `SignType` MUST belong to exactly one Organization and Site and contain server-generated UUID `id`, required trimmed `name`, server-assigned `color`, `createdAt`, and `updatedAt`. Name MUST contain 1–80 Unicode characters and be unique case-insensitively within the Site. Color MUST be assigned in repeating creation order from `SLATE`, `RED`, and `TEAL`; users cannot edit color in this slice.
- REQ-004: A persisted `Sign` MUST belong to exactly one Organization, Site, and Sign Type and contain server-generated UUID `id`; required trimmed `code`; integer `quantity`; optional trimmed `location`, `content`, and `comments`; `status`; `createdAt`; and `updatedAt`. Code MUST contain 1–40 Unicode characters and be unique case-insensitively within the Site. Quantity MUST be an integer from 1 through 9,999. Location and content MUST each contain at most 200 characters; comments MUST contain at most 1,000 characters.
- REQ-005: Sign status MUST be exactly `UNSPECIFIED`, `IN_PROGRESS`, or `APPROVED`, displayed respectively as a blank neutral cell, `In progress` with orange treatment, or `Approved` with green treatment. These values describe presentation state only; they trigger no approval workflow or role distinction.
- REQ-006: The schedule response MUST return Sign Types oldest-created first and Signs within each type by natural, case-insensitive code order with `id` as the stable tiebreaker. Each type MUST include its Signs and server-derived sum of quantities. An empty Site MUST show a truthful empty schedule and the permitted `New sign type` action without sample records.
- REQ-007: The desktop page MUST match screenshots 04.png and 05.png: current Site shell and Signage Schedule underline; Search, Filter, and Sort toolbar; collapsible color-coded Sign Type groups; and the exact table silhouette. At the reference width, each table MUST use a 6 px color rail followed by a 34 px checkbox gutter, 150 px Sign code column, 80 px Quantity column, 150 px Location column with a 34 px trailing map-indicator cell, 170 px Content column with a 34 px trailing eye-indicator cell, 150 px Status column, 150 px Comments column, and a flexible blank remainder. Header and data rows MUST be 35 px high, the Add sign row MUST be 35 px high, and the quantity total MUST align directly below Quantity. The map and eye indicators are decorative in this release and MUST be hidden from assistive technology. `Add sign` remains per group and `New sign type` follows all groups. Horizontal overflow MUST remain inside each schedule table, not the document.
- REQ-008: Search MUST be client-side, case-insensitive, and match code, location, content, comments, status label, or Sign Type name without another request. Filter MUST allow zero or more Sign Types and statuses, with OR inside a category and AND between categories. Sort MUST offer `Sign code A–Z`, `Sign code Z–A`, `Newest`, and `Oldest`; it MUST sort Signs within their groups and MUST NOT reorder groups. Search/filter/sort state MUST reset on route change and MUST NOT be persisted or encoded in the URL.
- REQ-009: A group disclosure MUST be a real button, default expanded, expose `aria-expanded`, and preserve its state while the current schedule remains mounted. Collapsing hides only that group's table. Row and group checkboxes MUST support local select-one/select-visible-all behavior, expose labels containing the full Sign code or Sign Type name, announce the selected count, and perform no server request.
- REQ-010: `New sign type` MUST insert an inline draft group and focus its name field. Enter or blur MUST attempt creation; Escape MUST cancel an unpersisted draft. Empty, duplicate, overlong, authorization, conflict, and server errors MUST keep the draft editable, associate concise error text with the field, and MUST NOT fabricate a successful group. Only one new Sign Type draft may exist at a time.
- REQ-011: An editable Sign Type name MUST enter inline edit on activation. Enter or blur MUST save a changed valid name; Escape MUST restore the persisted name. Unchanged blur MUST issue no request. During save the field MUST remain disabled and expose saving status; failure MUST restore editing with the submitted value and an associated categorical message.
- REQ-012: `Add sign` MUST insert one inline draft row in that group and focus Sign code. The draft MUST start with quantity `1`, empty optional fields, and `UNSPECIFIED` status. Enter from the code field or blur after a non-empty code MUST create the record; Escape from an untouched draft MUST cancel it. Invalid fields or request failure MUST preserve the draft and expose field-associated errors. Only one new Sign draft may exist per group.
- REQ-013: For persisted Signs, activating an editable cell MUST replace only that cell with the suitable text, number, or status control. Enter or blur MUST save a changed valid value; Escape MUST restore the persisted value. Status selection MUST save immediately. Unchanged exits MUST issue no request. The row MUST expose at most one active editor, saving state, field error, and retryable value at a time.
- REQ-014: Inline updates MUST use the record's `updatedAt` as an optimistic concurrency token. A stale update MUST return `409`, keep the submitted value visible, announce that the record changed elsewhere, and offer `Reload schedule`; it MUST never silently overwrite newer data. Successful mutation responses MUST return the complete canonical record and updated group total.
- REQ-015: Owners, Administrators, and Editors with Site Access and `MANAGE_SIGNS` MAY create and edit Sign Types and Signs. Viewers and other memberships MAY read accessible schedules but MUST receive no enabled editing controls; the API MUST independently reject mutation attempts. Organization ownership alone never bypasses Site resolution outside the existing Owner override already defined by Site Access.
- REQ-016: API mutations MUST be JSON, validate UUIDs and exact schemas, reject unknown fields, use private `no-store` responses, and scope every query and uniqueness check by Organization and Site. Public responses MUST expose no internal tenant key, role record, database error, stack, credential, or unrelated Site identifier.
- REQ-017: The client MUST serialize edits per record, prevent duplicate submission, abort or disregard obsolete reads/mutations on route change, and reconcile successful server records without refetching the entire schedule. A top-level read failure MUST show the established generic Site retry boundary. Mutation failures MUST remain local to the edited group/row and preserve other visible data and selection.
- REQ-018: At 320 CSS pixels and 200% browser zoom, the shell and toolbar MUST reflow without document-level horizontal scrolling; tables MAY scroll locally. Every control and inline field MUST be keyboard reachable with visible focus, labels, instructions, error association, and a minimum 24×24 CSS pixel target. Color MUST never be the only Sign Type or status cue. Saving, error, selection, expand/collapse, and current navigation states MUST be announced without stealing focus.
- REQ-019: All names and Sign values MUST render as untrusted text. The browser MUST store no schedule data in local/session storage, service workers, analytics, or query parameters. Logs, metrics, and traces MUST use bounded event names and MUST NOT contain names, codes, locations, content, comments, UUIDs, or response bodies.
- REQ-020: Add additive Prisma `SignType` and `Sign` models, enums for color and status, tenant/Site foreign keys, uniqueness constraints, timestamps, and cascade deletion only when the parent Site or Sign Type is deleted by a separately approved workflow. Existing Sites receive no seeded records. Update the object catalog's Current implementation alignment when implementation ships.
- REQ-021: Storybook MUST include API-independent empty, one-group, multi-group, collapsed, searching, filtered, sorted, Viewer/read-only, new-type draft/error, new-sign draft/error, cell-editing, saving, conflict, narrow-width, and 200%-zoom states. New reusable schedule components and their important states MUST be represented.
- REQ-022: Tests MUST preserve 100% frontend/backend unit coverage and prove authorization, tenant/Site isolation, validation boundaries, uniqueness, ordering, totals, optimistic concurrency, exact status mapping, navigation, empty/populated rendering, toolbar semantics, local selection, group disclosure, inline create/edit/save/cancel/error behavior, stale-response handling, responsive local overflow, and serious axe results without relying on screenshot sample records.
- REQ-023: Rollout MUST use a new `signageScheduleEnabled` runtime flag defaulting off in production. When disabled, the Site-section item remains unavailable and all schedule API routes return categorical `404`. Telemetry MUST use bounded `signage_schedule_read_*`, `sign_type_mutation_*`, and `sign_mutation_*` event names without record data.

## Acceptance scenarios

### AC-001 — Authorized member opens a real grouped schedule [REQ-001..REQ-009]

- Given an authenticated Membership can access a Site with persisted Sign Types and Signs
- When the member opens its Signage Schedule
- Then the established shell shows Signage Schedule as the sole current Site section
- And real groups, naturally ordered Signs, exact columns, status labels, and quantity totals match the persisted records
- And no screenshot example is fabricated

### AC-002 — Manager creates and renames a Sign Type inline [REQ-003, REQ-010, REQ-011, REQ-014..REQ-017]

- Given a member has `MANAGE_SIGNS`
- When they create a valid unique Sign Type and later rename it inline
- Then each change is authorized, persisted, reconciled in place, and keyboard accessible
- And validation, duplicate, conflict, or server failure preserves an editable value with a categorical message

### AC-003 — Manager creates and edits a Sign inline [REQ-004, REQ-005, REQ-012..REQ-017]

- Given an editable Sign Type group
- When the member adds a Sign and edits its code, quantity, location, content, status, or comments
- Then valid changes persist one record at a time and update the group total
- And Escape cancels the applicable draft/edit while invalid, duplicate, stale, or failed changes do not overwrite canonical data

### AC-004 — Viewer reads without mutation affordances [REQ-015, REQ-016, REQ-019]

- Given a Viewer has Site Access
- When they open the schedule or attempt a mutation directly
- Then they can search, filter, sort, collapse, and locally select real records
- And create/edit controls are absent or disabled and the API rejects mutation without disclosing other data

### AC-005 — Toolbar and grouping remain deterministic [REQ-006..REQ-009]

- Given a populated schedule
- When search, filters, sort, disclosures, or checkboxes change
- Then only matching Signs are shown inside their original groups, ordering and totals remain truthful, selection is local, and no toolbar action mutates or persists data

### AC-006 — Failures, concurrency, and navigation fail safely [REQ-002, REQ-014, REQ-016, REQ-017, REQ-019, REQ-023]

- Given an inaccessible Site, expired session, stale edit, obsolete response, disabled feature, or server failure
- When the read or mutation resolves
- Then the generic route/session boundary or local inline error appears as specified
- And no cross-Site record, stale overwrite, sensitive value, duplicate request, or fabricated success is exposed

### AC-007 — Responsive and assistive operation preserves the design [REQ-007, REQ-018, REQ-021, REQ-022]

- Given desktop, 320 CSS pixels, 200% zoom, keyboard-only use, or a screen reader
- When the member navigates, searches, filters, sorts, expands, selects, creates, or edits
- Then essential controls remain operable and announced with visible focus and associated errors
- And only table regions scroll horizontally while the document and Site shell remain stable

## UX and accessibility

Screenshots 04.png and 05.png govern desktop hierarchy and density, not sample content. The schedule uses semantic disclosure buttons, tables, headings, form controls, and status text. Inline editing does not turn the entire grid into an ARIA grid: standard table and form semantics retain predictable browser behavior. Each truncated value exposes its complete text accessibly and by title. Saving and failure feedback is local and announced politely; destructive confirmation is unnecessary because deletion is out of scope.

On narrow screens, the toolbar wraps and each group owns its horizontal table scrollbar. Group heading and add actions remain outside that overflow where practical. The colored rail/dot supplements the visible Sign Type name, and status background supplements the visible label.

## API and integrations

- `GET /api/sites/{siteId}/signage-schedule` returns Site-scoped Sign Types, nested Signs, permissions, and derived totals.
- `POST /api/sites/{siteId}/sign-types` creates a Sign Type from `{ name }`.
- `PATCH /api/sites/{siteId}/sign-types/{signTypeId}` updates `{ name, expectedUpdatedAt }`.
- `POST /api/sites/{siteId}/sign-types/{signTypeId}/signs` creates a Sign from the exact fields in REQ-004.
- `PATCH /api/sites/{siteId}/signs/{signId}` updates exactly one editable field plus `expectedUpdatedAt`.

No external integration, upload, queue, webhook, presigned URL, or background worker is added. OpenAPI must define exact request/response schemas and categorical 400/401/403/404/409/503 failures.

## Data and migration

The additive migration creates `SignType` and `Sign` plus categorical enums. Both records carry Organization and Site IDs even though these can be reached through relationships; the deliberate redundancy enables explicit tenant/Site constraints and indexed authorization queries. Database constraints enforce UUID relationships, per-Site case-insensitive uniqueness using normalized name/code columns, quantity bounds where supported, status/color enums, and timestamps. No backfill or screenshot seed is allowed.

The migration changes the catalog's Sign alignment from source-only to implemented for code, type, state, timestamps, and this specification's accepted schedule fields. Sign photos, Sign Comments, Allocation Plan positioning, deletion, and lifecycle beyond the three statuses remain unresolved.

## Security and privacy

Every route authenticates the application credential, resolves Membership and Site Access independently, and scopes reads/writes by Organization and Site. Mutations require `MANAGE_SIGNS`; UI permission flags are not an authorization boundary. Normalized uniqueness values are internal and never returned. Inputs are bounded before persistence, rendered as text, and never used in headers or telemetry.

## Reliability and observability

Reads are one bounded Site schedule request with nested records; this slice intentionally adds no pagination and therefore sets a guardrail of 100 Sign Types and 5,000 Signs per Site. Creation beyond either guardrail returns `409 schedule_limit_reached`. Bounded success/failure/conflict events and request latency are recorded without record dimensions. A sustained schedule read or mutation failure rate above 1% for ten minutes triggers the existing API availability response process.

## Test strategy

Contract and domain tests cover schemas, normalization, ordering, totals, limits, and conflict semantics. Prisma tests cover tenant/Site scoping, unique constraints, relations, and transactions. API tests cover sessions, Site Access, role permissions, categorical failures, private caching, and absence of sensitive fields. Component and application tests cover both screenshot-derived layouts, real empty/populated data, every toolbar and inline state, stale work, native navigation, responsive overflow, and accessibility. Storybook supplies deterministic fixtures only; application E2E creates its own records through the API and proves reload persistence.

## Rollout and rollback

Deploy the additive migration, API, and frontend with `signageScheduleEnabled=false`. Verify cross-Organization/Site rejection, Viewer read-only behavior, inline persistence, conflict handling, totals, and responsive/accessibility checks in the protected environment before enabling. Rollback disables the flag and restores the unavailable tab while retaining new tables. A later cleanup migration may remove data only under a separately approved retention decision.

## Open questions

- None. Approval accepts the bounded fields, validation, three statuses, automatic color cycle, inline interaction, role permissions, API surface, optimistic concurrency, record limits, local-only selection/filter/sort state, and explicit non-goals above.

## Sign status removal amendment — 2026-09-27

The approved `signage-schedule-remove-status` specification supersedes this specification only where it requires Sign status/state, status defaults, status UI/search/filter behavior or status-derived styling. Shared Signs no longer expose or persist status; the schedule has no Status column or status filters. All other behavior remains governed by this specification and its existing amendments. See the removal specification for strict contracts, migration, validation and rollout requirements.
