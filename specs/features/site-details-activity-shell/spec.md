# Feature: Site details Activity shell

- ID: `site-details-activity-shell`
- Status: `implemented`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-06`
- Product approval: `Approved by product owner in the Codex task on 2026-09-05`
- Domain references: `CONTEXT.md — Organization, Membership, Site, Site Access, Allocation Plan, Sign, Activity; docs/domain/figjam-object-catalog.md — Site, Allocation Plan, Sign, and Organization objects, Canonical interpretation notes, Current implementation alignment, and Known ambiguities 1, 4, 5, and 10`
- Design authority: `Figma Hansel App UI frame 2030:3333 (Workspace / Sites / Site)`
- Design evidence: `Browser-inspected through the signed-in Figma file on 2026-09-05; the structured Figma connector was blocked by the Professional View-seat MCP call limit`
- Supersedes on implementation: `sites-add-new REQ-019 presentation only; its tenant-scoped route, authorization, and truthful placeholder boundary remain authoritative`

## Implementation evidence

- `pnpm verify` passed specification validation, formatting, linting, type checking, production builds, Storybook build, and all 54 deterministic visual/accessibility checks.
- Frontend and backend suites retained 100% statement, branch, function, and line coverage: 199 frontend tests and 454 backend tests passed.
- All 39 isolated Chromium application E2E journeys passed, including authorized Site details, inaccessible Site, expired-session, latest-first navigation, and existing authentication/onboarding regression coverage.
- Storybook covers loaded, zero-member, member-preview, long-name, loading, retryable-failure, narrow-width, and 200%-zoom states, plus the reusable Site member preview.
- Independent specification and repository-standards reviews passed. The implementation uses only the established dashboard, Site details, and Sites read seams; OpenAPI, Prisma, infrastructure, integrations, and client persistence remain unchanged.

## Problem

The authenticated `/sites/{siteId}/activity` route currently proves only that a Site can be loaded: it shows the Site name, one Activity link, and a large generic placeholder. It does not match the approved Site details frame or carry forward the Organization and visible-Site context established on the populated Sites page. A member needs a coherent Site details shell that identifies the current Site and preserves the established Hansel navigation without fabricating the invoice events, comments, widgets, sharing workflow, or domain fields shown as examples in Figma.

## Outcome and success metrics

- The existing Activity route matches the desktop composition of frame `2030:3333`: populated application rail, Site breadcrumb/header, Site-section navigation, four placeholder cards, and a bounded Activity panel.
- Real server-authorized Organization, Site, member-preview, viewer, and visible-Site values replace Figma sample values everywhere they are available.
- The Site shown in the header is visibly and programmatically current in the nested Site navigation.
- Unspecified Share, overflow, notification, settings, Allocation Plan, Signage Schedule, Activity-feed, attachment, and commenting behavior is not fabricated or exposed as available.
- Existing tenant isolation, Site Access rules, latest-first Site ordering, session replacement, and Activity destination remain unchanged.
- Frontend and backend unit coverage remains 100%, and Storybook, visual, accessibility, responsive, and application E2E checks pass.

## Non-goals

- Creating or loading Activity records, invoice events, comments, attachments, notifications, summary metrics, configurable widgets, or an Activity persistence model.
- Implementing Share, Site Access editing, member invitation, the split-button menu, Site settings, the overflow menu, or hover details for members with access.
- Implementing Allocation Plan, Sign, signage-schedule, library, document, or site-management destinations.
- Defining `Shared Sites`, cross-Organization sharing, ownership classification, invitation acceptance, or a second Site collection.
- Changing Site creation, Site Access Scope, role permissions, Site Allowance, billing, Stripe, Resend, ordering, or populated Sites behavior.
- Copying Figma's example Site names, workspace label, initials, invoice wording, people, timestamps, comments, or editor/prototype chrome into production data.
- Adding an API operation, response field, Prisma model, migration, seed, external integration, background job, analytics event, or AWS resource.

## Requirements

- REQ-001: Figma frame `2030:3333` MUST be the visual authority for the authenticated Site details Activity shell. At the 1512×982 reference viewport, the implementation MUST preserve its left application rail, shallow Site header, bordered Site-section navigation, four equal summary cards, and lower-left Activity panel without reproducing Figma editor chrome, selection outlines, collaborators, comments, or annotations.
- REQ-002: `/sites/{siteId}/activity` MUST remain the only implemented Site details route in this slice. The UUID path parameter MUST be encoded into fixed same-origin links and treated only as an identifier, never as authorization. Unknown, inaccessible, and cross-Organization Site IDs MUST retain the same generic unavailable result.
- REQ-003: The page MUST use the existing authenticated `GET /api/sites/{siteId}` read for the selected Site identity and the existing `GET /api/sites` read for the Organization name, visible Site navigation, and selected Site member preview. Both reads MUST derive the Membership and Organization exclusively from the application session and MUST retain their strict private, no-store response contracts.
- REQ-004: The two Site reads SHOULD begin together after application-session validation. The loaded shell MUST render only when both succeed and the selected Site appears in the visible Sites collection. The browser MUST reject an inconsistent result generically rather than combine Site identities from different responses. No stale Site or Organization content MAY remain after a failure or authentication replacement.
- REQ-005: The page MUST deepen the existing `ApplicationShell`; it MUST NOT create a second application rail. The rail MUST show the real Organization name, Dashboard, active and initially expanded Sites, the same latest-first visible Site collection returned by `GET /api/sites`, the existing Libraries section, and the authenticated viewer/account menu. The selected nested Site link MUST expose `aria-current="page"` without making the top-level Sites link a second current page.
- REQ-006: The Figma `Shared Sites` group MUST remain absent because no approved rule distinguishes that collection. Organization-owned or directly granted Sites MUST NOT be relabelled or duplicated as shared merely to fill the reference frame.
- REQ-007: The top Site header MUST show a breadcrumb with a working `Sites` link, a decorative separator, and the selected Site's real name as the current item. Long names MUST truncate visually where required while retaining their complete escaped accessible text and title. The breadcrumb MUST use navigation and current-item semantics.
- REQ-008: The header MAY show the selected Site's existing ordered member preview and `+N` remainder using the approved Site-summary contract and deterministic avatar presentation. It MUST show only accepted direct Site members already authorized for disclosure; zero members MUST produce no fake avatars, and pending invitees or email addresses MUST not appear.
- REQ-009: The Figma Share split control, notification symbol, and settings/tune symbol MUST retain their reference position and visual hierarchy but MUST be exposed as unavailable in this bounded slice. They MUST not accept an action, open an empty menu, claim unread state, navigate, issue a request, or imply that access was changed. Decorative portions MUST be hidden from assistive technology; any visible unavailable control MUST use native disabled semantics and an accessible name.
- REQ-010: The Site-section navigation MUST display `Activity`, `Allocations`, and `Signage Schedule` in the Figma order. `Activity` MUST be the only active destination and link to the current `/sites/{siteId}/activity` route. `Allocations` and `Signage Schedule` are design labels only in this slice: they MUST be visibly unavailable, non-focusable, and MUST NOT establish domain records or routes. The adjacent overflow symbol MUST remain decorative and non-interactive.
- REQ-011: The main summary region MUST render exactly four equal cards in one desktop row. Each card MUST contain the exact placeholder heading `Widget title`, the Figma divider, and an otherwise empty body. It MUST reuse the same card composition as the approved Dashboard shell where practical and MUST not display fabricated values, loading skeletons, actions, or implied forthcoming data.
- REQ-012: The lower Activity region MUST be a bordered panel headed `Activity` in the position and proportion shown by Figma. Until Activity records have their own approved specification, the body MUST show the existing truthful empty message `Site activity will appear here.` and MUST NOT reproduce the reference invoice events, sample identities, relative timestamps, comment composer, attachment symbol, emoji control, or `Comment` action.
- REQ-013: Loading MUST expose one concise status without a partial Site shell. A recoverable failure in either Site read MUST expose the existing generic message `We couldn't load this site.` plus a keyboard-operable `Retry` action that repeats both reads. An authentication failure MUST continue to replace navigation with `/login`; it MUST not be rendered as a recoverable Site failure.
- REQ-014: Existing Dashboard, Sites, nested Site, Activity, and logout navigation MUST continue through native same-origin links and the established optional client-navigation seam. The page MUST remain useful without JavaScript after server delivery to the same extent as the existing shell; unavailable reference controls MUST not become links solely for no-JavaScript appearance.
- REQ-015: The shell MUST use existing Figtree, Material Symbols or exact committed Figma assets, Hansel semantic tokens, `ApplicationShell`, avatar treatment, and established Tailwind conventions. It MUST not add a parallel component library, remote runtime asset, page-specific primary color, hand-authored replacement SVG, or duplicated shell implementation.
- REQ-016: At 320 CSS pixels and 200% zoom, the rail, breadcrumb, Site name, member preview, unavailable header controls, Site-section navigation, four cards, Activity panel, retry, and account actions MUST reflow without horizontal page scrolling or content overlap. A bounded local horizontal region MAY be used only for the Site-section navigation if every label remains keyboard and screen-reader discoverable.
- REQ-017: The page MUST meet WCAG 2.2 AA, expose one unambiguous page heading containing the selected Site name, use application/breadcrumb/section navigation landmarks without duplicate names, preserve logical reading order, expose current and unavailable states without color alone, retain visible focus on every available action, hide decorative symbols, and report no serious axe violations.
- REQ-018: Site and Organization names and member display values MUST be rendered as untrusted text, never injected markup. The browser MUST store none of the page DTOs in local storage, session storage, query parameters, analytics, or a service worker. Logs, traces, and metrics MUST not contain Site names, Organization names, member names, emails, complete UUIDs, or response bodies.
- REQ-019: Storybook MUST include API-independent Site details states for loaded zero-member, loaded member-preview, long Site and Organization names, loading, retryable failure, narrow width, and 200% zoom. Any new exported reusable breadcrumb, section-navigation, placeholder-card, member-preview, or Activity-panel component MUST be added to the cookbook with important normal, boundary, unavailable, responsive, and accessibility states.
- REQ-020: Frontend and backend unit suites MUST retain 100% statement, branch, function, and line coverage. Tests MUST prove the shared loaded/failure state, concurrent reads, identity-consistency guard, no stale content, current nested Site semantics, latest-first sidebar preservation, exact breadcrumb/tab/card/panel composition, truthful unavailable controls, member-preview bounds, retry, navigation, escaped text, responsive reflow, axe, and deterministic visual output. Application E2E MUST load a real authorized Site details route and prove inaccessible/session outcomes without weakening existing tests.
- REQ-021: The existing OpenAPI and Prisma boundaries MUST remain unchanged. This presentation feature MUST add no migration, seed data, infrastructure change, external service, queue, scheduled job, client persistence, or new observability dimension. Existing categorical Sites API telemetry and CloudWatch alarms remain authoritative.

## Acceptance scenarios

### AC-001 — Authorized Site opens in the Figma-derived shell [REQ-001, REQ-003, REQ-005, REQ-007..REQ-012]

- Given an authenticated Membership can see a Site and other visible Sites in its Organization
- When the member opens `/sites/{siteId}/activity`
- Then the page shows the real Organization, latest-first Site navigation, selected Site breadcrumb and current nested link
- And the Activity tab, four empty `Widget title` cards, and truthful empty Activity panel match the reference hierarchy
- And no Figma sample identity, invoice, timestamp, comment, or fake widget value appears

### AC-002 — Unspecified reference actions remain honest [REQ-006, REQ-009, REQ-010, REQ-012]

- Given the Site details shell is loaded
- When the member inspects Share, notifications, settings, section navigation, overflow, and Activity content
- Then only Activity and the established application links are operable
- And every other unimplemented action is either unavailable or decorative with correct semantics
- And no empty menu, request, route, mutation, or fabricated data is produced

### AC-003 — Site identity and navigation stay tenant-safe [REQ-002..REQ-005, REQ-008, REQ-018]

- Given the selected UUID is inaccessible, cross-Organization, absent from the visible Sites collection, or inconsistent between the two authorized reads
- When the page loads
- Then no Site, Organization, or member content is combined or disclosed
- And the page uses the same generic unavailable outcome without revealing which check failed

### AC-004 — Loading, retry, and session replacement are distinct [REQ-004, REQ-013]

- Given the Site reads are pending, fail unexpectedly, or reject the application session
- When the member opens or retries the route
- Then pending reads show one status, recoverable failures show the generic Site error and retry both reads, and authentication rejection navigates to `/login`
- And stale loaded details are absent in every failure state

### AC-005 — The Site shell remains accessible and responsive [REQ-014..REQ-020]

- Given keyboard-only use, assistive technology, a 320-pixel viewport, or 200% zoom
- When the member traverses the application rail, breadcrumb, section navigation, cards, Activity panel, retry, and account menu
- Then available actions, current state, unavailable state, names, and regions remain understandable without horizontal page scrolling
- And Storybook interaction, axe, deterministic screenshot, unit, and application E2E checks pass at 100% frontend and backend unit coverage

## UX and accessibility

The desktop reference is a 1512×982 white application canvas. The populated 300-pixel rail identifies the Organization, shows Dashboard and expanded Sites, and preserves the existing Libraries and viewer regions. The content column begins with a shallow header containing the Site breadcrumb on the left and member/share/utility presentation on the right. A bordered horizontal Site-section navigation follows, then four equal placeholder cards, then a smaller Activity panel aligned to the lower-left content grid.

The Figma frame contains generic invoice Activity entries, an attachment/comment composer, example identities, and placeholder widget headings. The object catalog supplies no Activity fields, lifecycle, comment association, retention, or permission rules, and the approved `sites-add-new` specification limits this route to a truthful Activity context. This feature therefore adopts the frame's composition but not its fabricated invoice content or controls. The same rule excludes `Shared Sites` and executable Share, Allocation, Signage Schedule, overflow, notification, and settings behavior.

The structured Figma connector could not provide reference code, exact measurements, or downloadable assets because the Professional View seat reached its tool-call limit. The frame was inspected through the signed-in browser. If structured context becomes available before implementation is complete, its component metadata, tokens, measurements, and exact assets take precedence over browser-derived approximation without expanding this specification's behavior.

## API and integrations

- `GET /api/sites/{siteId}` remains the strict tenant-scoped selected-Site identity read.
- `GET /api/sites` remains the strict tenant-scoped Organization, visible-Site, and bounded member-preview read; its latest-first order remains authoritative.
- `GET /api/dashboard` remains the established viewer/account-shell read owned by `ApplicationShell`.

No endpoint or schema changes. The frontend combines the two Site reads only after checking that their opaque IDs and normalized names agree for the selected visible Site. All responses retain cookie authentication, private/no-store caching, categorical failures, and strict Zod parsing. Figma is a design-time reference only; the runtime does not call Figma, Resend, Stripe, S3, or another external integration.

## Data and migration

No Prisma model, field, relation, index, migration, backfill, or seed change is permitted. `Site.id`, `Site.name`, existing visible Site summaries, ordered accepted member previews, Organization name, and the authenticated viewer supply the complete approved content. The reference Activity events and comments do not become data records in this feature.

## Security and privacy

The server continues to derive User, Membership, Organization, role, Site visibility, and member-preview disclosure from the opaque application session. The two requests must independently authorize the principal; the client consistency guard is defense in depth, not authorization. Inaccessible outcomes remain indistinguishable, values are escaped, fixed route shapes are used, and private DTOs are neither cached nor persisted.

Unavailable controls must not create accidental mutation or privilege-escalation paths. No member email, invitation state/token, exact Site Access role, provider or billing identifier, password/session value, or cross-Organization record may reach the shell.

## Reliability and observability

The read-only page starts its two bounded Site reads together and enters loaded state only after both validate consistently. Retry repeats the complete pair so the rail and selected content cannot represent different attempts. Existing request correlation, latency, unexpected-failure, authentication, and authorization telemetry is sufficient; this visual slice adds no unbounded label or CloudWatch resource.

## Test strategy and implementation plan

1. Add failing SiteActivity component tests for the two-read loaded model, current navigation, exact Figma-derived regions, truthful unavailable controls, member preview, identity mismatch, loading, failure, retry, and no stale content.
2. Extend `ApplicationShell` through its existing public interface only as needed for a current nested Site and Site-header composition; preserve all Dashboard and Sites consumers and drive the change with focused regression tests.
3. Implement the Site breadcrumb, Site-section navigation, shared placeholder cards, and truthful empty Activity panel using existing components and tokens; do not change backend contracts or persistence.
4. Update `App` to pass the existing Sites loader to the Site details module while retaining application-session replacement and native/client navigation behavior.
5. Add the required API-independent Storybook states and deterministic desktop/narrow visual baselines, with axe and interaction checks for current/unavailable semantics and responsive reflow.
6. Extend the existing Sites application E2E to load an authorized Site details page and prove real Organization/Site context, navigation, generic inaccessible behavior, retry, and session replacement.
7. During implementation, run only focused changed-package checks for each red-green slice. Before the implementation commit, run specification validation, formatting, lint, typecheck, complete frontend/backend unit coverage, builds, Storybook build and design-system tests, application E2E, OpenAPI validation, Prisma checks, and CDK synthesis once.
8. Commit and push the implementation only after independent standards and specification reviews report no unresolved findings. Do not begin another specification until this implementation commit is pushed.

## Rollout and rollback

Deploy the frontend presentation change through the normal immutable application release after existing API compatibility is confirmed. No data or infrastructure deployment order is introduced. Rollback restores the previous minimal Activity presentation; it does not alter Sites, Site Access, sessions, Organizations, or persisted data.

## Open questions

- None. Approval authorizes the Figma-derived shell and truthful empty/unavailable states only. Real Activity, comments, attachments, summary widgets, sharing, Site Access management, Allocation Plans, Signage Schedule, `Shared Sites`, and Site settings each require behavior and data acceptance criteria in later specifications.
