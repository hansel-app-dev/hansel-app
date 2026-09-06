# Feature: Site Allocation Plans empty state

- ID: `site-allocation-plans-empty-state`
- Status: `approved`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-06`
- Product approval: `Approved by product owner in the Codex task on 2026-09-06`
- Domain references: `CONTEXT.md — Organization, Membership, Site, Site Access, Allocation Plan, Sign; docs/domain/figjam-object-catalog.md — Site and Allocation Plan objects, Canonical interpretation notes, Nesting map, Current implementation alignment, and Known ambiguities 4, 7, 8, and 10`
- Design authority: `Figma Hansel App UI frame 2037:1019 (New Site / Allocation Plan / No plans)`
- Design evidence: `The exact frame was browser-inspected at 113% zoom on 2026-09-06; the structured Figma connector was blocked by the Professional View-seat MCP call limit`
- Supersedes on implementation: `site-details-activity-shell REQ-010 only where Allocations is unavailable; Activity, Signage Schedule, and all other Site-shell requirements remain authoritative`

## Problem

An authorized member can open a Site's Activity page, but the `Allocations` label is intentionally unavailable and there is no destination for a Site that has no Allocation Plans. The approved Figma frame defines the empty presentation and its relationship to the existing Site shell. Hansel needs that truthful empty state without inventing an Allocation Plan persistence model, upload workflow, Google Maps integration, or permissions that the object catalog and current application do not define.

## Outcome and success metrics

- An authorized member can navigate from a Site's Activity page to `/sites/{siteId}/allocations` and see the selected Site's Allocation Plans empty state.
- The page matches frame `2037:1019`: the established Site shell, `Allocations` as the current section, and the exact `No plans` message and action hierarchy.
- Existing Organization context, latest-first Site navigation, selected-Site identity, direct-member preview, session replacement, Site Access enforcement, and logout behavior remain consistent with the implemented Site Activity shell.
- `Add plan` and `Use Google Maps` are represented honestly as unavailable until separately approved workflows define data, validation, storage, provider, authorization, and failure behavior.
- Frontend and backend unit coverage remains 100%, and Storybook, deterministic visual, accessibility, responsive, and application E2E checks pass.

## Non-goals

- Creating, uploading, importing, editing, listing, sorting, previewing, downloading, replacing, archiving, or deleting Allocation Plans.
- Defining Allocation Plan identifiers, file formats, image/PDF processing, byte limits, storage accounting, malware scanning, retention, metadata, timestamps, thumbnails, or links to Signs.
- Integrating Google Maps, loading map SDKs, geocoding, storing coordinates, accepting provider terms, or adding AWS/network secrets.
- Implementing Signs, Signage Schedule, section overflow, sharing, notifications, Site settings, `Shared Sites`, Documents, or other library destinations.
- Inferring Allocation Plan records, permissions, ownership, cardinality, ordering, or lifecycle from Figma or FigJam.
- Adding or changing an API operation, OpenAPI schema, Prisma model, migration, seed, AWS resource, external integration, background job, analytics event, or client persistence.
- Reproducing Figma editor chrome, collaborator cursors or avatars, prototype annotations, example Organization/Site names, or sample member identities.

## Requirements

- REQ-001: The authenticated application MUST expose the native route `/sites/{siteId}/allocations` for this bounded empty state. The route MUST reject a missing, malformed, inaccessible, cross-Organization, deleted, or otherwise unavailable Site through the existing generic failure and authentication behavior without disclosing whether that Site exists.
- REQ-002: The application MUST validate the Dashboard session before starting Site reads. After successful validation, it MUST start the existing `GET /api/sites/{siteId}` authorized Site-context read and `GET /api/sites` visible-Sites read together; it MUST NOT add a dedicated Allocation Plans request while no approved Allocation Plan contract exists.
- REQ-003: The page MUST render only after the selected Site appears in the visible latest-first Sites collection and both reads agree on its identifier and name. Any disagreement, partial success, changed route/loader identity, or obsolete response MUST fail closed without rendering stale Site or Organization context.
- REQ-004: The page MUST reuse `ApplicationShell` and the established Site details header, breadcrumb, member preview, unavailable header controls, Site navigation, account menu, logout behavior, and session-replacement boundary. It MUST NOT create a second application or Site-shell implementation.
- REQ-005: The left rail MUST show the real Organization name and the same server-authored latest-first visible Site collection used by the Sites and Activity pages. The selected Site MUST be visibly and programmatically current; the top-level `Sites` destination MUST not simultaneously claim page-current semantics. `Shared Sites` and unimplemented library destinations MUST remain absent.
- REQ-006: The top Site header MUST show the existing `Sites` breadcrumb link, decorative separator, and selected Site name as the current item. Long Organization and Site names MUST truncate visually where necessary while retaining complete escaped accessible text and title.
- REQ-007: The header MAY show only the selected Site's existing ordered, accepted direct-member preview and `+N` remainder from the approved Site-summary contract. Zero members MUST show no fake avatar; pending invitees, email addresses, and unauthorized people MUST not appear.
- REQ-008: The existing Share split control, notification control, and settings control MUST remain unavailable with native disabled semantics and accessible names. They MUST issue no request, open no empty UI, navigate nowhere, and imply no state change.
- REQ-009: Site-section navigation MUST retain the Figma order `Activity`, `Allocations`, and `Signage Schedule`. `Activity` MUST remain an available link to `/sites/{siteId}/activity`; `Allocations` MUST be the sole current section at `/sites/{siteId}/allocations`; `Signage Schedule` MUST remain visibly unavailable and non-focusable. The adjacent overflow symbol MUST be decorative and non-interactive.
- REQ-010: The main content MUST show a centered Allocation Plans empty state with the exact heading `No plans` and the exact two-line supporting copy `Upload an architectural plan` and `or plot your signage on Google Maps`, in that reading order.
- REQ-011: The empty state MUST use the exact committed Figma asset when one is available; otherwise it MUST use the clearly matching existing Material Symbols map glyph. The icon MUST be decorative. Figma editor collaborator markers, cursors, badges, and avatars MUST NOT be copied into the application.
- REQ-012: The empty state MUST show `Add plan` as the visually primary action with its decorative add symbol and `Use Google Maps` as the secondary action, matching the reference order. In this slice both controls MUST use native disabled semantics, remain non-focusable, expose clear accessible names, and perform no navigation, request, upload, SDK load, or state change.
- REQ-013: The page MUST NOT fabricate Allocation Plan records, counts, thumbnails, names, files, dates, Signs, map markers, permissions, loading skeletons, or sample values. `No plans` is the only supported Allocation Plan data state until a separately approved specification introduces an authoritative model and read contract.
- REQ-014: Loading MUST expose exactly one concise status without a partial Site shell. A recoverable failure in either Site read MUST expose the existing generic message `We couldn't load this site.` and keyboard-operable `Retry`, which repeats both Site reads only after the validated session boundary. An authentication failure MUST replace navigation with `/login`, not appear as a recoverable Site failure.
- REQ-015: Dashboard, Sites, nested Site, Activity, Allocations, and logout navigation MUST use native same-origin links and the established optional client-navigation seam. The available navigation MUST retain the existing no-JavaScript usefulness; disabled future actions MUST not become links for appearance.
- REQ-016: The page MUST use existing Figtree typography, Material Symbols or exact committed Figma assets, Hansel semantic tokens, Tailwind conventions, shared Button behavior, avatar treatment, and the established Site shell. It MUST add no parallel component library, remote runtime asset, page-specific primary color, hand-authored replacement SVG, or duplicate shell composition.
- REQ-017: At 320 CSS pixels and 200% browser zoom, the application rail, breadcrumb, Site name, member preview, unavailable header controls, Site-section navigation, empty-state copy, disabled actions, and account actions MUST reflow without horizontal page scrolling, clipped essential content, or overlap. A bounded local horizontal section-navigation region is permitted only when every label remains keyboard and screen-reader discoverable.
- REQ-018: The page MUST meet WCAG 2.2 AA, expose one unambiguous page heading containing the selected Site name and Allocation Plans context, use distinct application, breadcrumb, and section-navigation landmarks, retain logical reading order, expose current and unavailable states without color alone, preserve visible focus for every available action, hide decorative symbols, and report no serious axe violations.
- REQ-019: Organization, Site, and member display values MUST be rendered as untrusted text and never injected markup. The browser MUST store none of the page DTOs in local storage, session storage, query parameters, analytics, or a service worker. Logs, traces, and metrics MUST contain no Organization names, Site names, member names, emails, complete UUIDs, or response bodies.
- REQ-020: Storybook MUST include API-independent Allocation Plans empty states for zero members, member preview, long Organization and Site names, loading, retryable failure, narrow width, and 200% zoom. Any new exported reusable Site header, breadcrumb, section navigation, or empty-state component MUST be added to the cookbook with its normal, boundary, unavailable, responsive, and accessibility states.
- REQ-021: Frontend and backend unit suites MUST retain 100% statement, branch, function, and line coverage. Tests MUST prove session-before-Site reads, concurrent Site reads, identity consistency, stale-response rejection, latest-first preservation, current navigation semantics, exact copy and action order, truthful disabled controls, navigation, retry, member bounds, escaped values, responsive reflow, axe, and deterministic visuals. Application E2E MUST prove authorized navigation from Activity to the real Allocation Plans route plus inaccessible and expired-session outcomes without weakening existing tests.
- REQ-022: The existing OpenAPI, Prisma, AWS, integration, and observability boundaries MUST remain unchanged. This presentation slice MUST add no migration, seed, external service, queue, scheduled job, client persistence, metric dimension, or alarm. Existing categorical Sites telemetry and CloudWatch alarms remain authoritative.
- REQ-023: Implementation of this specification MUST update the Activity shell's `Allocations` item from unavailable text to a native link for the same selected Site. It MUST change no behavior of Activity, Signage Schedule, overflow, summary widgets, or the Activity panel beyond that single navigation availability decision.

## Acceptance scenarios

### AC-001 — Authorized member sees the No Plans page [REQ-001..REQ-013, REQ-023]

- Given an authenticated Membership can access a Site that is present in its latest-first visible Sites collection
- When the member follows `Allocations` from that Site's Activity page
- Then `/sites/{siteId}/allocations` shows the real Organization and selected Site in the established shell
- And `Allocations` is the sole current Site section
- And the exact `No plans` heading, two-line supporting copy, `Add plan`, and `Use Google Maps` hierarchy matches the reference
- And no Allocation Plan, file, map, Sign, member, or editor-prototype sample is fabricated

### AC-002 — Future creation choices remain honest [REQ-011..REQ-013]

- Given the Allocation Plans empty state is visible
- When the member inspects or attempts to operate `Add plan` and `Use Google Maps`
- Then both actions are exposed as unavailable through native semantics
- And neither action receives focus, navigates, changes state, issues a request, opens an uploader, or loads a Google Maps resource

### AC-003 — Site authorization and identity fail closed [REQ-001..REQ-003, REQ-014, REQ-019]

- Given the requested Site is inaccessible, absent from the visible Sites collection, belongs to another Organization, disagrees between reads, or becomes obsolete during navigation
- When the Allocation Plans route resolves
- Then no Site, Organization, member, or Allocation Plan context is disclosed
- And the page shows only the generic recoverable failure unless the existing session boundary requires `/login`

### AC-004 — Loading, retry, and session replacement remain coherent [REQ-002..REQ-004, REQ-014]

- Given session validation or either Site read is pending or fails
- When the member opens or retries the Allocation Plans route
- Then exactly one loading status appears before any Site shell
- And `Retry` starts a fresh authorized pair of Site reads without stale content
- And an expired or invalid session replaces the destination with `/login`

### AC-005 — Navigation remains native and consistent [REQ-004..REQ-009, REQ-015, REQ-023]

- Given the Allocation Plans page is loaded
- When the member uses Sites, another visible Site, Activity, Allocations, or account navigation
- Then every available destination uses the correct native same-origin URL and optional client-navigation seam
- And only the selected Site and Allocation Plans section expose their respective current semantics
- And unavailable controls and Signage Schedule do not become links

### AC-006 — Responsive and assistive use preserves the design hierarchy [REQ-016..REQ-021]

- Given the loaded, loading, or retryable-failure state is viewed at desktop, 320 CSS pixels, or 200% zoom
- When a keyboard or screen-reader user reads and operates the page
- Then the shell and empty state retain their order without horizontal page scrolling or overlap
- And landmarks, heading, current states, disabled states, names, focus, contrast, and announcements meet WCAG 2.2 AA
- And deterministic visual and axe checks pass

## UX and accessibility

Frame `2037:1019` is authoritative for the desktop composition: selected Site shell, Allocations underline, centered map glyph, exact empty copy, and primary/secondary action hierarchy. Existing implemented shell behavior overrides reference-only elements that have no approved product meaning, including `Shared Sites`, library links, live Share/notification/settings controls, and Figma collaborator indicators. Disabled actions must look intentionally unavailable while retaining the reference hierarchy; a dead enabled-looking control is not acceptable.

The implementation must preserve semantic headings and navigation landmarks rather than reproduce Figma's absolute coordinates. Responsive behavior may stack or wrap the existing shell and empty-state actions. Truncation must not remove the complete accessible Site or Organization name.

## API and integrations

Use only the existing Dashboard session, visible Sites, and authorized Site-context reads already consumed by the Site Activity shell. The existing `/api/sites/{siteId}` response remains the access-controlled Site identity source even though its current generated type is named `SiteActivityResponse`; this feature must not rename or broaden that public contract. No Allocation Plans or Google Maps request, SDK, key, domain allow-list, callback, webhook, or provider account is authorized.

## Data and migration

No Prisma schema, migration, seed, backfill, object-store record, cache, or local persistence is permitted. The FigJam Allocation Plan labels (`Name`, `PDF / Image`, created/modified times, and nested Signs) remain discovery evidence only and are deliberately not selected as fields by this specification. A future approved Allocation Plan model must supersede the bounded `No plans` assumption before real records can be displayed.

## Security and privacy

The existing Hansel session, Organization Membership, Site Access, Owner override, and fail-closed Site lookup remain authoritative. Validate the session before Site reads and require the selected Site to agree with the visible collection before rendering any shell context. Render all server-authored display values as text. Do not send data to Google, load remote map resources, accept files, expose signed URLs, or add telemetry containing user or tenant values.

## Reliability and observability

The page uses the existing generic loading, retry, authentication replacement, and Site-read failure behavior. No independent SLO, dashboard, alarm, log field, metric, trace dimension, or event is justified for a presentation-only route. Existing categorical Sites request telemetry and alarms remain the operational boundary.

## Test strategy

1. Add failing route and component tests first for the validated-session boundary, concurrent existing Site reads, identity guard, stale-response rejection, exact Figma-derived copy and action order, current navigation, member preview, disabled controls, navigation, loading, retry, and escaped values.
2. Reuse deterministic Site fixtures and prove latest-first rail order without client sorting or an additional request.
3. Add Storybook stories for loaded zero-member, member-preview, long-name, loading, failure, narrow, and 200%-zoom states; add a reusable-component story only if implementation exports a new reusable component.
4. Add deterministic desktop and narrow/zoom screenshots plus axe assertions covering the full shell and empty state.
5. Extend application E2E to follow Allocations from an authorized Site Activity route and prove the real route, exact empty state, native Activity return link, inaccessible Site, and expired-session behavior.
6. Run specification validation, formatting, lint, typecheck, frontend/backend/contracts coverage, production builds, Storybook build, all design-system tests, and all application E2E tests before the implementation commit.

## Rollout and rollback

Ship the additive frontend route and navigation change through the normal immutable web artifact. No feature flag or ordered backend deployment is required because existing public contracts remain unchanged. Rollback restores `Allocations` to its prior unavailable state and removes the frontend route; no data, API, integration, or infrastructure rollback is necessary.

## Open questions

- None. Approval authorizes the Allocation Plans empty presentation and native Activity/Allocations navigation only. Upload/import, Google Maps, Allocation Plan data, Signs, and Signage Schedule each require separately approved specifications.
