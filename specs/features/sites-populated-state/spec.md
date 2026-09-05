# Feature: Sites populated state

- ID: `sites-populated-state`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-05`
- Product approval: `Pending explicit approval of this specification`
- Domain references: `CONTEXT.md — Organization, Membership, Organization Role, Site, Site Access; docs/domain/figjam-object-catalog.md — Site, User, and Organization objects plus Known ambiguities 1–5`
- Design authority: `Figma Hansel App UI frame 2025:11221, 1.1 Sites Populated / Grid View`
- Design evidence: `Browser-inspected through the signed-in Figma file on 2026-09-02; the structured Figma connector was blocked by the Professional View-seat MCP call limit`

## Problem

Hansel persists and returns tenant sites after the approved add-site flow, but the populated `/sites` page uses a generic card treatment and the application sidebar contains only the top-level Sites destination. A member with existing sites needs the same real, authorized site collection exposed as compact nested links in the sidebar and as the Figma-defined boxes in the main grid, without duplicating sample Figma data or inventing unfinished sharing and management behavior.

## Outcome and success metrics

- Every site returned by the authenticated Sites boundary appears once beneath the expanded Sites navigation group and once as a box in the main grid.
- Sidebar links and grid boxes lead to the same tenant-scoped Activity destination for the selected site.
- Grid boxes reproduce the approved Figma hierarchy: site symbol, name, last-edited information, bounded member-avatar preview, and overflow symbol.
- Empty tenants retain the already approved empty state; populated tenants no longer see the generic `Your sites` heading/count composition.
- Frontend and backend unit suites retain 100% statement, branch, function, and line coverage, and focused Storybook, accessibility, responsive, visual, contract, integration, and end-to-end checks pass.

## Non-goals

- Defining or implementing the Figma `Shared Sites` classification, cross-organization sharing, invitation acceptance, or a separate shared-sites page. Sample shared sites in Figma MUST NOT be fabricated from tenant-owned records.
- Implementing list view, grid/list preference persistence, searching, sorting, filtering, folders, pagination, or infinite scrolling.
- Implementing the card overflow menu, rename, duplicate, move, archive, delete, ownership transfer, or bulk actions.
- Changing site creation, access assignment, invitations, billing, plan limits, Activity functionality, signs, allocations, signage schedules, libraries, documents, or notifications.
- Treating Figma example names, initials, timestamps, comments, cursors, editor panels, annotations, or prototype chrome as production data.

## Requirements

- REQ-001: Figma frame `2025:11221` MUST be the visual authority for the authenticated populated grid state. The implementation MUST reproduce the Hansel Beta shell, expanded Sites navigation group, nested site rows, top utility bar, `New site` action, grid/list symbols, and compact main-view site boxes without reproducing Figma editor or prototype chrome.
- REQ-002: `GET /api/sites` MUST remain the single page-data boundary and MUST return only sites visible to the authenticated membership within its server-derived tenant. The browser MUST NOT submit a user, membership, tenant, or organization identifier to obtain the list.
- REQ-003: Each returned site summary MUST contain an opaque site ID, normalized display name, last-updated instant, and an ordered, bounded member preview sufficient for the Figma card. It MUST NOT contain member email addresses, invitation tokens, provider identifiers, billing identifiers, or records from another tenant.
- REQ-004: The server MUST order sites deterministically by creation instant ascending, with site ID as the stable tie-breaker. The same ordered collection MUST drive both the sidebar and main grid so the two views cannot disagree or make duplicate list requests.
- REQ-005: The populated sidebar MUST deepen the existing `ApplicationShell` Sites destination rather than introduce a second sidebar. On `/sites`, Sites MUST remain the sole current top-level page and its nested collection MUST be expanded initially.
- REQ-006: Every nested sidebar row MUST show the Figma blue site symbol and the site's real display name on one line. Long names MUST truncate visually without changing the accessible name or the link destination. Each row MUST link to `/sites/{siteId}/activity` through the established same-origin navigation seam.
- REQ-007: The expanded Sites control MUST be a real disclosure button with an accessible name and expanded state. Activating it MUST collapse or restore only the nested site rows; it MUST NOT hide the main grid, mutate server data, navigate, or persist the preference outside the current page lifetime.
- REQ-008: The Figma `Shared Sites` group MUST NOT be rendered in this bounded slice because no approved rule distinguishes an owned site from a shared site. A later specification MAY add it only after its visibility, authorization, empty-state, and navigation semantics are approved.
- REQ-009: The main populated view MUST omit the current generic `Your sites` heading and numeric count. It MUST place the site grid at the Figma-defined upper-left content position beneath the utility bar and preserve the reference whitespace, border, radius, color, typography, and spacing with existing Hansel/Tailwind tokens.
- REQ-010: Every main-view site box MUST be one list item containing a primary link to `/sites/{siteId}/activity`, the Figma blue site symbol, the real site name, a deterministic relative label in the form `Edited …`, and an overlapping member-avatar preview. The whole primary box area, excluding the reserved overflow symbol, MUST activate the site link.
- REQ-011: Relative edit text MUST be derived from the server-provided UTC instant against the client clock using stable English units: `Edited just now` for less than one minute, then the largest whole minute, hour, day, month, or year with correct singular/plural wording. Future timestamps MUST clamp to `Edited just now`; invalid timestamps MUST be rejected by the shared contract rather than displayed.
- REQ-012: Member previews MUST represent direct accepted site members only, ordered by grant creation instant and then membership ID, and MUST contain display name and initials. Cards MUST display at most three avatars followed by a `+N` indicator when more accepted members exist. Zero-member sites MUST preserve the card layout without fake avatars. Pending external invitations MUST NOT appear.
- REQ-013: Avatar backgrounds MUST use the existing deterministic Hansel avatar palette and MUST not depend on a remote image service. The preview group MUST expose one concise accessible label naming the visible members and remaining count; decorative initials MUST not be announced repeatedly.
- REQ-014: The Figma vertical overflow symbol MUST be present at the card's upper-right as a decorative, non-interactive symbol in this slice. It MUST NOT accept focus, expose an action name, open an empty menu, or issue a request until card-management behavior has an approved specification.
- REQ-015: The grid symbol MUST use the Figma selected treatment and the list symbol MUST use its unselected treatment. Because the user requested boxes and list behavior remains unspecified, both symbols are presentational in this slice and MUST NOT accept focus, change layout, update the URL, or write a preference.
- REQ-016: The existing `New site` action MUST retain the approved role, plan-limit, modal, and navigation behavior from `sites-add-new`. Adding populated navigation and cards MUST not create a second modal implementation or weaken server authorization.
- REQ-017: An authenticated request returning zero sites MUST continue to render the approved `sites-empty-state`. Loading, generic authentication rejection, recoverable failure/retry, plan-limit notice, viewer identity, account menu, and logout MUST retain their established behavior.
- REQ-018: Site summaries MUST be treated as untrusted text. Names and member display values MUST be rendered as text, never injected markup; UUIDs MUST be encoded into the fixed same-origin Activity route shape; private page responses MUST remain `Cache-Control: private, no-store`.
- REQ-019: Site visibility MUST be enforced before summaries are assembled. Cross-tenant site IDs and members without site visibility MUST be excluded without a distinguishable disclosure, and direct Activity access MUST continue to return the existing generic not-found outcome.
- REQ-020: Sidebar and grid MUST use semantic navigation and list structures. Every site link MUST have a unique accessible context, all available controls MUST retain visible keyboard focus, current and expanded states MUST not rely on color alone, and axe MUST report no serious violations.
- REQ-021: At 320 CSS pixels and 200% zoom, site rows and boxes MUST reflow without horizontal page scrolling. Names, relative edit text, member previews, creation-limit status, navigation, account actions, and retry behavior MUST remain readable and operable without overlap.
- REQ-022: Storybook MUST add deterministic populated states for one site, multiple sites matching the Figma composition, long names, zero and more-than-three member previews, a collapsed sidebar, plan limit, loading, retryable failure, 320-pixel width, and 200% zoom. Any new reusable site-card or navigation-disclosure component MUST be exported to the cookbook with interaction and accessibility coverage.
- REQ-023: Frontend and backend unit suites MUST retain 100% statement, branch, function, and line coverage. Tests MUST cover strict contracts, tenant and visibility filtering, deterministic ordering, member-preview bounding, timestamp boundaries, matching sidebar/grid collections, collapse behavior, truncation semantics, navigation, presentational symbols, empty/loading/error/session states, keyboard behavior, responsive reflow, and exact Figma screenshots.
- REQ-024: The OpenAPI schema MUST describe the enriched strict site summary, Prisma reads MUST select only required fields, and no migration, seed data, new AWS resource, external service, analytics event, queue, scheduled job, or client storage is permitted for this read-only presentation feature.

## Acceptance scenarios

### AC-001 — Existing sites appear in both approved locations [REQ-001, REQ-004..REQ-010]

- Given an authenticated member can see two tenant sites
- When the member opens `/sites`
- Then both sites appear in the same deterministic order beneath the expanded Sites navigation group
- And both appear once as Figma-matching boxes in the main grid
- And the empty state, generic `Your sites` heading, and numeric count are absent

### AC-002 — Sidebar and card navigation agree [REQ-006, REQ-007, REQ-010, REQ-020]

- Given a visible site appears in the sidebar and the grid
- When the member activates either representation using pointer or keyboard
- Then the browser opens the same `/sites/{siteId}/activity` destination
- And collapsing the nested sidebar list leaves the grid and server state unchanged

### AC-003 — Card metadata is truthful and bounded [REQ-003, REQ-010..REQ-014]

- Given a site has a valid update instant, accepted direct members, and pending invitations
- When its grid box is rendered
- Then the box shows the deterministic `Edited …` label and at most three accepted-member avatars plus any remaining count
- And pending invitees, email addresses, fake avatars, and an actionable overflow menu are absent

### AC-004 — Tenant and visibility boundaries fail closed [REQ-002, REQ-018, REQ-019, REQ-024]

- Given another tenant has sites or a member lacks visibility to a site
- When the member loads `/api/sites` or manipulates an Activity URL
- Then no inaccessible site or member metadata is returned or rendered
- And no browser-supplied tenant value can broaden the result

### AC-005 — Existing states remain intact [REQ-016, REQ-017]

- Given a tenant has no sites, has reached its plan limit, loses its session, or encounters a recoverable dependency failure
- When `/sites` loads or the member retries or creates a site
- Then the existing empty, limit, login-replacement, retry, modal, and successful Activity navigation behaviors remain unchanged

### AC-006 — The populated page works across assistive and narrow contexts [REQ-020..REQ-023]

- Given keyboard-only use, assistive technology, a 320-pixel viewport, or 200% zoom
- When the member navigates, expands or collapses Sites, and opens a site
- Then every real action remains understandable and operable without horizontal page scrolling or serious axe violations
- And deterministic Storybook, screenshot, unit, integration, and end-to-end checks pass with required coverage

## UX and accessibility

The reference composition keeps the white Hansel Beta sidebar and utility bar. Sites is selected and expanded, with compact blue-symbol site rows immediately below it. The main canvas begins with a grid of low-profile bordered boxes rather than a separate heading. Each box places the blue site symbol and truncated name at the upper left, the non-interactive overflow symbol at the upper right, relative edit text below, and overlapping member avatars along the lower edge. The top-right grid symbol is selected, the list symbol is visually secondary, and the existing dark `New site` button remains available according to the approved authorization and plan rules.

The sidebar disclosure exposes its expanded state and manages focus normally. Site names retain their complete accessible text even when visually truncated. Card metadata is grouped to avoid repetitive screen-reader output, decorative symbols are hidden, and every site remains reachable as a conventional link when client-side navigation is unavailable. Narrow layouts may stack boxes and move the shell according to its existing responsive behavior, but they must not remove site access or introduce an unspecified mobile drawer.

The structured Figma connector could not provide inspectable measurements or exports because the connected Professional View seat had reached its MCP call limit. Signed-in browser inspection of frame `2025:11221` is therefore the current design evidence. If structured context becomes available before implementation, its exact component properties and measurements take precedence without expanding the approved behavior.

## API and integrations

`GET /api/sites` remains the only populated-page request. Its strict `SiteSummary` response is enriched with an ISO 8601 UTC `updatedAt` value and a bounded `memberPreview` array of accepted direct members. The existing request/session boundary, categorical authentication handling, private no-store policy, and `/sites/{siteId}/activity` route remain authoritative.

No mutation or new external integration is added. Site creation continues to use the approved existing endpoint and Resend worker only when the user explicitly completes the add-site flow. This populated read does not call Stripe, Resend, Figma at runtime, S3, or another AWS service.

## Data and migration

No schema migration or backfill is required. `Site.updatedAt`, `SiteGrant.createdAt`, membership identity, and personal-profile names already exist. The Prisma adapter must retrieve only visible site IDs, names, update instants, and the bounded accepted direct-grant member projection needed for the page. Existing records become visible automatically; no sample sites or initials are seeded.

The shared Zod contract and OpenAPI schema remain strict and aligned. Member preview limits are applied in the database query where practical and revalidated at the boundary so an oversized internal result cannot reach the browser.

## Security and privacy

The API derives the principal and tenant exclusively from the opaque application session and applies site visibility before selecting card metadata. A site UUID is an identifier, not authorization. Site and member names are escaped text, Activity URLs use a fixed same-origin route shape, and private responses are never stored in browser persistence or shared caches.

Member previews disclose only accepted direct members' display names and initials to another member who can already access that site. Emails, pending invitees, external-provider data, tokens, tenant IDs, membership IDs, exact grant roles, and full member directories are excluded. Logs and metrics remain categorical and must not include site names, member names, or unbounded site IDs as dimensions.

## Reliability and observability

The page uses one Sites read for both representations, avoiding inconsistent sidebar and grid requests. Deterministic ordering and fixed preview bounds keep rendering stable. The existing retry treatment covers recoverable read failures; authentication rejection replaces navigation with `/login`; no stale prior site list may remain visible after either outcome.

Existing API latency, error, and database observability applies. No new dashboard, alarm, queue, worker, or metric dimension is justified. Query-count and payload-bound tests must prevent an N+1 member lookup and enforce the documented site and preview limits.

## Test strategy

- Start with failing shared-contract tests for `updatedAt` and bounded member previews, then backend behavior tests for authorization filtering, deterministic ordering, data minimization, and no N+1 query shape.
- Add failing frontend tests for one shared page collection driving nested sidebar links and grid boxes, disclosure behavior, exact navigation destinations, relative-time boundaries, member preview counts, decorative controls, and unchanged empty/error/limit states.
- Add Storybook cookbook states and interaction tests before styling the grid and nested navigation to the Figma evidence.
- Add focused Playwright journeys for real site creation followed by populated rendering, sidebar/card Activity navigation, session expiry, keyboard disclosure, axe, the 1512×982 reference viewport, 320 pixels, and 200% zoom.
- During implementation run focused contract/API/web tests for each red-green step. Before implementation commit and push, run specification validation, formatting, lint, typecheck, complete unit coverage, builds, Storybook build and browser checks, focused E2E, OpenAPI validation, Prisma checks, and CDK synthesis once.

## Rollout and rollback

The change is an additive response enrichment and authenticated presentation update behind the existing Sites feature boundary. Deploy the backward-compatible API response before or with the frontend. Rollback restores the prior frontend grid and prior response projection; no database or data rollback is required. If the Sites runtime flag is disabled, the existing unavailable route behavior remains authoritative.

## Open questions

- None for this bounded populated-grid slice. `Shared Sites`, list view, card management, and persisted view preferences require separate specifications because their product and authorization rules are not established by frame `2025:11221` alone.
