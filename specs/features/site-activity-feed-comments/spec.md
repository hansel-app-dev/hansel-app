# Feature: Site Activity Feed and Comments

- ID: `site-activity-feed-comments`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-06`
- Product and technical approval: `Pending review of this specification; the user approved the scope direction in the Codex task on 2026-09-06`
- Domain references: `CONTEXT.md — Organization, User, Membership, Organization Role, Site Access, Site, Allocation Plan, Sign, Activity, Sign Comment, and Allocation Plan Comment; docs/domain/figjam-object-catalog.md — Objects and data points (Organization, Site, Allocation Plan, Sign, Sign Comment, and Allocation Plan Comment); Canonical interpretation notes; Nesting map; Organization roles and permissions; Known ambiguities 7, 9, and 10; Current implementation alignment; Source node index Organization Activities node 30:828 and comment nodes 30:835 and 30:874`
- Design authority: `User-supplied Site.png (1512×982)`
- Design evidence: `The supplied design establishes a bounded lower-left Activity timeline, actor treatment, relative timestamps, visually distinct comment cards, and a comment composer with a trailing Comment action. Invoice language, example people, sample timestamps, attachment and emoji controls, and sample comments are reference content only and do not authorize Hansel records or behavior.`
- Supersedes on implementation: `site-details-activity-shell REQ-012 and its related non-goals, API/data constraints, acceptance language, and implementation notes only where they prohibit real Activity records and Site comments; the existing Site shell, empty summary widgets, navigation, access boundaries, and all unrelated requirements remain authoritative`

## Problem

The approved Site Activity shell truthfully shows an empty placeholder because Hansel has no approved persistent Activity model or Site-level comment behavior. Authorized members therefore cannot see meaningful changes to a Site or participate in the Site discussion shown by the design. The object catalog identifies Organization Activities and comments attached to Signs or Allocation Plans, but it supplies no Activity fields, lifecycle, retention, ordering, Site association, or Site-level comment object. This specification resolves those gaps only for a Site-scoped Activity feed and text-only Site comments.

## Outcome and success metrics

- An authorized member can open `/sites/{siteId}/activity` and see persisted Activity for that Site in a newest-first timeline using real Hansel actors and objects.
- Site creation, Allocation Plan addition, Sign Type creation or rename, Sign creation or update, and Site comments produce immutable Activity exactly once with their successful domain mutation.
- Any User with Site Access, including a Viewer, can add a 1–2,000 character text-only Site Comment that appears immediately in the timeline.
- At least 99% of valid Activity reads and comment submissions complete or return an actionable categorical response within two seconds, excluding client disconnects and regional incidents.
- No invoice content, sample identity, sample timestamp, attachment, emoji behavior, or fabricated Activity from the design is seeded or displayed.

## Non-goals

- Editing, deleting, hiding, resolving, pinning, reacting to, mentioning Users in, or replying to a Site Comment.
- Attachments, Images, Documents, emoji pickers, rich text, Markdown, HTML, links with previews, notifications, email, or external integrations.
- Sign Comments or Allocation Plan Comments; those remain separate catalog concepts requiring their own approved behavior.
- Activity for authentication, billing, invitations, Membership changes, Site Access changes, viewing, searching, filtering, sorting, exports, or reads.
- Recording field names, before/after values, comment text excerpts, credentials, email addresses, or arbitrary metadata in Activity summaries or telemetry.
- Making the four `Widget title` cards functional, or implementing Share, notifications, Site settings, section overflow, or `Shared Sites`.
- Backfilling historical Activity for domain changes that occurred before this feature is deployed.

## Requirements

- REQ-001: `CONTEXT.md` MUST define **Site Comment** as a text discussion entry attached directly to a Site and distinguish it from Sign Comment and Allocation Plan Comment. The object catalog Current implementation alignment MUST identify Activity and Site Comment as implemented only for this approved scope and preserve the fact that Site Comment was not a named FigJam object.
- REQ-002: A persisted `Activity` MUST belong to exactly one Organization and Site and contain a server-generated UUID `id`, categorical `kind`, required actor Membership reference, optional subject UUID, optional bounded subject-label snapshot, optional Site Comment text, and server-generated `createdAt`. Activity MUST be immutable after creation and deleted only through an independently approved parent Site or Organization deletion workflow.
- REQ-003: Activity kind MUST be exactly `SITE_CREATED`, `ALLOCATION_PLAN_ADDED`, `SIGN_TYPE_CREATED`, `SIGN_TYPE_RENAMED`, `SIGN_CREATED`, `SIGN_UPDATED`, or `SITE_COMMENT_ADDED`. The database and runtime contract MUST reject any other kind. `SITE_COMMENT_ADDED` MUST contain comment text and MUST NOT contain a subject; every other kind MUST omit comment text and contain the applicable Site, Allocation Plan, Sign Type, or Sign subject.
- REQ-004: Subject-label snapshots MUST contain only the Site name, Allocation Plan filename, Sign Type name, or Sign code visible at the time of the action; MUST be trimmed plain text of 1–255 Unicode characters; and MUST NOT include field values, comments, email addresses, IDs, or before/after values. Activity copy MUST use the bounded kind and escaped snapshot rather than persist arbitrary prose.
- REQ-005: Successful Site creation, finalized Allocation Plan addition, Sign Type creation or rename, and Sign creation or update MUST insert their corresponding Activity in the same database transaction as the domain mutation. A failed or rolled-back mutation MUST create no Activity. Idempotent retries and optimistic-concurrency conflicts MUST create no duplicate Activity. A Sign update records one `SIGN_UPDATED` Activity per successful API mutation, regardless of the edited field.
- REQ-006: Existing Sites and their historical mutations MUST receive no fabricated or inferred backfill. A Site with no Activity MUST show the exact truthful message `Site activity will appear here.` followed by the permitted comment composer.
- REQ-007: `GET /api/sites/{siteId}/activity` MUST validate the application session, authorize Site Access using the same Organization/Site visibility rules as the Site shell, and return at most 50 Activity items ordered by `createdAt` descending with `id` descending as the stable tiebreaker. It MUST accept an optional opaque cursor and return `nextCursor` only when older Activity exists.
- REQ-008: Each Activity response item MUST contain only `id`, `kind`, escaped `subjectLabel` when applicable, escaped `commentText` for Site comments, `createdAt` as an ISO UTC timestamp, and an actor object containing bounded display name and deterministic initials already authorized for Site member presentation. It MUST expose no Organization key, raw Membership/User key, email, role record, normalized field, database error, or cross-Site data.
- REQ-009: `POST /api/sites/{siteId}/comments` MUST accept strict JSON `{ "text": string }`, reject unknown fields, require a same-origin mutation proof, and create one `SITE_COMMENT_ADDED` Activity for the authenticated Membership. Text MUST be trimmed, contain 1–2,000 Unicode characters after trimming, and be stored and returned as plain text. Empty, overlong, malformed, inaccessible, and cross-Organization requests MUST create no record.
- REQ-010: Every User with Site Access MAY read Activity and add a Site Comment, including a Viewer. The API MUST authorize each read and mutation independently; client-visible permissions are not an authorization boundary. Unknown, inaccessible, deleted, and cross-Organization Site identifiers MUST use the same non-disclosing not-found outcome.
- REQ-011: The desktop Activity region MUST follow the supplied design’s lower-left proportion and visual hierarchy: `Activity` heading; a vertical timeline; actor identity, action copy, and relative time; distinct bordered comment cards; and a comment composer aligned below the feed. It MUST use the existing Site shell and MUST NOT copy the design’s invoice terms, sample people, sample timestamps, or sample comments.
- REQ-012: Timeline copy MUST map deterministically to each kind: `{actor} created this Site`; `{actor} added allocation plan {subject}`; `{actor} created sign type {subject}`; `{actor} renamed a sign type to {subject}`; `{actor} created sign {subject}`; `{actor} updated sign {subject}`; and `{actor} commented`. Visible subject labels MUST remain escaped text. The actor name and action MUST remain understandable without color or iconography.
- REQ-013: Activity timestamps MUST render as concise relative time in the viewer’s browser locale while exposing the exact server timestamp through a semantic `time` element with `dateTime` and an accessible exact-date label or title. The browser MUST recompute relative labels without persisting Activity locally. Ordering MUST always follow the server response, not client clock calculations.
- REQ-014: The composer MUST contain an accessible multiline field with placeholder `Add your comment…` and a `Comment` button. The button MUST be disabled for empty/whitespace-only text and while submitting. `Ctrl+Enter` and `Meta+Enter` MAY submit; plain Enter MUST insert a newline. A successful response MUST prepend the canonical returned Activity without refetching and clear the composer.
- REQ-015: Invalid or failed submission MUST preserve the entered text, associate a concise categorical error with the field, and restore the enabled submission action. Duplicate activation while pending MUST issue one request. Authentication failure MUST replace navigation with `/login`; inaccessible Site failure MUST use the generic Site boundary; transient comment failure MUST remain local to the composer.
- REQ-016: The attachment and emoji symbols shown by the design MUST NOT render as enabled controls in this release. They MAY be omitted or rendered as decorative/unavailable presentation, but MUST not be focusable, open a picker, upload a file, issue a request, or imply stored content.
- REQ-017: When older Activity exists, a keyboard-operable `Load older activity` action MUST request the supplied cursor once, append only canonical non-duplicate items, and disappear when `nextCursor` is absent. Loading and failure MUST be announced without removing already loaded Activity. Route changes MUST disregard obsolete read and submission responses.
- REQ-018: At 320 CSS pixels and 200% zoom, the Activity panel, timeline entries, comment cards, composer, and pagination action MUST reflow without document-level horizontal scrolling or clipped controls. Every interactive target MUST be at least 24×24 CSS pixels, have visible focus, and retain logical keyboard and screen-reader order.
- REQ-019: The Activity feed MUST meet WCAG 2.2 AA, use one labelled region, represent the timeline as a semantic list, expose comments as list items rather than chat roles, announce newly added comments politely without moving focus, and report no serious axe violations. Decorative timeline marks and avatars MUST be hidden from assistive technology when their equivalent text is present.
- REQ-020: Activity and comment values MUST render as untrusted text. Responses MUST be private and `no-store`; the browser MUST store no Activity or comment data in local storage, session storage, service workers, analytics, or query parameters. Logs, metrics, and traces MUST use bounded event names and MUST NOT contain actor names, subject labels, comment text, UUIDs, response bodies, or cursor values.
- REQ-021: Add additive Prisma models and enums for Activity with composite Organization/Site foreign keys, actor Membership relation, kind constraints, bounded text columns, and descending read indexes. The schema MUST enforce kind-specific comment/subject consistency where PostgreSQL supports it. No existing data is changed or seeded.
- REQ-022: Storybook MUST include API-independent Activity states for empty, mixed actions, comments, long escaped values, loading, initial failure, loading older, older-page failure, submitting, submission failure, Viewer commenting, narrow width, and 200%-zoom. Any new reusable Activity timeline, entry, comment card, or composer component and its important states MUST be represented.
- REQ-023: Tests MUST retain 100% frontend/backend unit coverage and prove exact kind contracts, transactional creation, idempotency, optimistic concurrency, ordering, cursors, Organization/Site isolation, Viewer commenting, validation bounds, strict responses, empty/populated rendering, deterministic copy, timestamp semantics, submission reconciliation, duplicate prevention, stale-response handling, responsive behavior, and serious axe results.
- REQ-024: Rollout MUST use a new `siteActivityEnabled` runtime flag defaulting off in production. When disabled, the Site shell retains its approved truthful empty Activity panel and no comment composer; new Activity/comment endpoints return categorical `404`; domain mutations continue without Activity writes. Telemetry MUST use bounded `site_activity_read_*` and `site_comment_create_*` event names without record data.

## Acceptance scenarios

### AC-001 — Authorized member reads real Site Activity [REQ-002..REQ-008, REQ-011..REQ-013]

- Given an authenticated Membership can access a Site with persisted Activity
- When the member opens `/sites/{siteId}/activity`
- Then the existing Site shell shows a newest-first semantic timeline of real Hansel actions and comments
- And each item shows the authorized actor, deterministic action copy, applicable subject snapshot, and accessible time
- And no invoice example, sample identity, or fabricated Activity appears

### AC-002 — Domain mutations record Activity exactly once [REQ-003..REQ-006, REQ-021, REQ-023]

- Given Activity recording is enabled and an authorized mutation is attempted
- When Site creation, Allocation Plan addition, Sign Type creation or rename, or Sign creation or update succeeds
- Then the mutation and its categorical Activity commit atomically with the correct actor, Site, kind, subject, snapshot, and timestamp
- And a retry, conflict, validation failure, authorization failure, or rollback creates no missing or duplicate Activity

### AC-003 — Any Site member adds a text-only comment [REQ-009, REQ-010, REQ-014..REQ-016]

- Given an Owner, Administrator, Editor, or Viewer has Site Access
- When they submit a valid 1–2,000 character Site Comment
- Then one immutable plain-text comment Activity is persisted and prepended from the canonical response
- And the composer clears only after success
- And attachment, emoji, edit, delete, reply, mention, and notification behavior remains unavailable

### AC-004 — Invalid and inaccessible comments fail safely [REQ-009, REQ-010, REQ-015, REQ-020]

- Given comment text is invalid, a request is duplicated, the session expires, the Site is inaccessible, or the service fails
- When submission resolves
- Then no unauthorized or duplicate Activity is created, authentication replacement and generic Site boundaries remain intact, and transient errors stay local
- And the member’s valid unsaved text remains available without exposing another Organization or Site

### AC-005 — Older Activity loads deterministically [REQ-007, REQ-017]

- Given more than 50 Activity items exist for an accessible Site
- When the member activates `Load older activity`
- Then the next server-ordered page appends once without duplicates or reordered existing items
- And pending, failed, exhausted, and route-change states remain truthful and accessible

### AC-006 — Empty and responsive states remain truthful [REQ-006, REQ-018, REQ-019, REQ-022]

- Given a Site has no post-rollout Activity, or the page is used at 320 CSS pixels, 200% zoom, with a keyboard, or with assistive technology
- When the member opens and uses the Activity region
- Then the truthful empty message and permitted composer remain usable without horizontal document scrolling
- And timeline, comments, loading, errors, focus, and announcements remain understandable without color or pointer input

### AC-007 — Feature rollout is reversible [REQ-024]

- Given the production feature flag is disabled or rolled back
- When a member opens Activity or calls a new endpoint
- Then the existing truthful empty Activity panel remains, the composer is absent, new endpoints return `404`, and unrelated domain mutations continue successfully without Activity writes

## UX and accessibility

The supplied 1512×982 design governs the Activity panel’s desktop placement, timeline rhythm, actor/action/time hierarchy, comment-card treatment, and composer silhouette. Hansel uses real Organization, Site, Membership, actor, and subject data only. The four summary cards remain empty `Widget title` placeholders, and existing Site-section navigation remains unchanged.

Activity is a semantic list inside the existing labelled region. Each item contains readable actor/action copy and a semantic timestamp. Comment cards visually distinguish member-authored discussion without using chat roles or suggesting synchronous messaging. The composer is a labelled textarea with explicit submission, preserved failure text, pending state, and polite success announcement. Attachment and emoji affordances are omitted because this scope is text-only.

## API and integrations

- `GET /api/sites/{siteId}/activity?cursor={opaque}` returns `{ items, nextCursor }` under a strict schema.
- `POST /api/sites/{siteId}/comments` accepts strict `{ text }` and returns the complete canonical `SITE_COMMENT_ADDED` Activity.
- Existing Site creation, Allocation Plan finalization, Sign Type mutations, and Sign mutations gain internal transactional Activity writes when the runtime flag is enabled; their public success schemas do not change.

No external integration, upload, queue, webhook, email, notification, object storage, image processing, or scheduled job is added. The cursor is server-authored, opaque, bounded, and contains no client-trusted authorization decision.

## Data and migration

Add `ActivityKind` and `Activity` with UUID primary key, `tenantId`, `siteId`, `actorMembershipId`, categorical kind, nullable `subjectId`, nullable bounded `subjectLabel`, nullable bounded `commentText`, and `createdAt`. Composite relations preserve Organization/Site scoping, and a descending `(siteId, createdAt, id)` index supports cursor reads. A database check constraint enforces comment-versus-subject shape by kind.

The Activity row itself is the durable Site Comment record when kind is `SITE_COMMENT_ADDED`; no parallel comment table or mutable lifecycle is introduced. Records are retained indefinitely unless their parent Site or Organization is deleted by a separately approved workflow. Deployment creates no historical backfill and no example data.

## Security and privacy

The server derives User, Membership, Organization, role, and Site Access only from the opaque application session. A Site UUID and cursor are identifiers, never authorization. All queries and inserts scope by Organization and Site; actor presentation uses only the already-approved bounded member display treatment. Comment text and subject labels are private Site data, escaped at render, excluded from telemetry, and never placed in URLs or browser persistence.

Comment creation requires the established same-origin mutation proof and strict content type/schema checks. The response discloses no email, role, internal tenant key, normalized value, or database detail. Viewer permission to comment is explicit product behavior, not a relaxation of Site visibility.

## Reliability and observability

Activity writes share the successful domain mutation transaction, preventing false or missing records. Reads are indexed, cursor-bounded to 50 items, and stable under concurrent inserts. Client reconciliation deduplicates by Activity ID and ignores stale route responses. Existing request correlation and service alarms remain; new metrics record only bounded read/create success, categorical failure, conflict, and latency events.

A sustained Activity read or comment-create failure rate above 1% for ten minutes triggers the existing API availability response process. Rollback disables recording and UI/API exposure without requiring destructive data reversal.

## Test strategy and implementation plan

1. Add failing runtime-contract tests for Activity kinds, strict list/comment schemas, limits, timestamps, and response privacy.
2. Add the additive Prisma migration and persistence tests for Organization/Site/actor relations, check constraints, ordering, cursors, isolation, and retention behavior.
3. Introduce one transactional Activity writer and integrate it test-first with Site creation, Allocation Plan finalization, Sign Type mutations, and Sign mutations, proving success, rollback, retry, and conflict semantics.
4. Add authenticated Activity-list and Site-comment API tests for Site Access, Viewer permission, same-origin proof, validation, strict private responses, feature-flag behavior, and categorical failures.
5. Implement reusable Activity timeline, entry, comment-card, and composer components from failing component tests; add every important state to Storybook.
6. Integrate the Activity read and comment mutation into the existing `SiteActivity` loaded/failure/session lifecycle without duplicating the Site shell or weakening identity consistency.
7. Extend application E2E to create real domain mutations and comments, reload persistence, paginate, verify Viewer commenting, reject cross-Organization access, and cover keyboard, responsive, and axe behavior.
8. Update `CONTEXT.md` and the object catalog alignment in the same implementation change, preserving the distinction between board evidence and accepted Site Comment behavior.
9. Run focused red-green checks for each slice. Before the implementation commit, run specification validation, formatting, lint, typecheck, complete unit coverage, builds, Storybook build/design-system tests, application E2E, OpenAPI validation, Prisma checks, and CDK synthesis once.
10. Commit and push implementation only after independent standards and specification reviews report no unresolved findings.

## Rollout and rollback

Deploy the additive migration first, then API and frontend with `siteActivityEnabled=false`. Verify Site isolation, Viewer commenting, mutation atomicity, pagination, escaped rendering, keyboard operation, and responsive/accessibility checks in the protected environment before enabling. Rollback disables the flag, restoring the truthful empty panel and suppressing new endpoints/writes while retaining already-created private Activity rows for a future safe re-enable.

## Open questions

- None. Scope approval accepts the seven Activity kinds, Site-scoped immutable Activity, text-only immutable Site Comments, all-Site-member comment permission including Viewers, 1–2,000 character bounds, omission of attachment/emoji behavior, newest-first cursor pagination, no historical backfill, retention until parent deletion, and feature-flagged rollout described above.
