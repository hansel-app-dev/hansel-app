# Feature: Main sidebar design

- ID: `main-sidebar-design`
- Status: `approved`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-10-11`
- Domain references: `CONTEXT.md — Organization, Membership, Site, Library File`; `docs/domain/figjam-object-catalog.md — Objects and data points (Organization 25:501, Site 24:18), Canonical interpretation notes, Known ambiguities requiring specification`
- Design authority: `Hansel Design System Figma node 2314:1151`
- Product approval: `User approved adopting the Figma sidebar labels on 2026-10-11`

## Problem

The authenticated application shell uses older navigation labels and spacing than the approved Hansel Design System main-sidebar component. The shell needs to match the Figma component while preserving existing route and authorization boundaries.

## Outcome and success metrics

The application shell uses the approved Figma labels and visual states, existing destinations remain reliable, and no shared-site behavior is fabricated. Focused frontend checks and the production/Storybook builds pass.

## Non-goals

- Implementing shared-site classification, authorization, invitations, or a separate shared-sites page.
- Adding API, database, persistence, billing, or navigation routes.
- Reproducing Figma editor chrome or sample data.

## Requirements

- REQ-001: The application sidebar MUST use the Figma node `2314:1151` as its visual authority for the organization header, navigation rows, nested Site rows, active state, disclosure control, Library row, and account menu composition.
- REQ-002: The visible top-level labels MUST be `Home`, `My Sites`, `Shared Sites`, and `Library`, in that order. `Home` MUST navigate to `/dashboard`; `My Sites` and `Shared Sites` MUST use the existing `/sites` route; `Library` MUST navigate to `/library/files`.
- REQ-003: Existing route and session behavior MUST remain unchanged. The `Shared Sites` label MUST NOT imply a new API, access rule, data classification, or duplicated site collection until separately specified. It is a navigation label backed by the existing Sites route.
- REQ-004: The expanded My Sites group MUST use the existing authorized site collection, preserve nested Activity destinations, and expose the existing site-creation callback as the Figma-styled `New site` row when available.
- REQ-005: Sidebar colors, typography, spacing, radii, icons, active/hover states, organization badge, counts, and account-menu surfaces MUST use the shared Hansel theme tokens and match the Figma reference at desktop and narrow widths.
- REQ-006: Sidebar navigation MUST retain semantic links, current-page state, keyboard focus, disclosure semantics, account-menu behavior, logout behavior, and no horizontal overflow at 320 CSS pixels and 200% zoom.
- REQ-007: No Figma editor chrome, sample organization/site records, shared-site authorization, new persistence, or backend schema/API changes are introduced by this presentation update.

## Acceptance scenarios

### AC-001 — Sidebar labels and destinations [REQ-002, REQ-003]

- Given an authenticated member views any application page
- When the sidebar renders
- Then it shows Home, My Sites, Shared Sites, and Library with the existing destinations and no invented shared-site data.

### AC-002 — Authorized nested sites [REQ-004, REQ-006]

- Given the Sites read returns visible sites
- When My Sites is expanded
- Then each site remains a keyboard-accessible Activity link, the existing disclosure state is exposed, and New site invokes the existing creation callback.

### AC-003 — Visual and responsive fidelity [REQ-001, REQ-005, REQ-006]

- Given the sidebar is rendered at the Figma desktop composition or a narrow viewport
- When a member inspects active, hover, disclosure, account, and nested-site states
- Then the composition matches node `2314:1151`, remains usable at 320 CSS pixels and 200% zoom, and introduces no horizontal page scrolling.

## Test strategy

- Update ApplicationShell characterization tests for the approved labels and destinations.
- Run focused shell, dashboard, Sites, and Library unit tests, then typecheck, formatting, lint, production build, Storybook build, and relevant design-system checks.
- Review the rendered shell at the Figma reference viewport and narrow viewport without changing unrelated application surfaces.

## UX and accessibility

The sidebar uses the Figma light neutral surface, compact rows, green organization badge, neutral icons, subtle active and hover surfaces, nested site rows, orange New site affordance, and account menu. Navigation remains a landmark with native links, visible focus, current-page state, and a real disclosure button. The Shared Sites label is presentation-only until its product semantics are specified.

## API and integrations

No new API or external integration is introduced. Existing dashboard, Sites, Library Files, logout, and site-creation seams remain authoritative.

## Data and migration

No schema, migration, seed, or persistence change is required. Existing siteNavigation data continues to drive My Sites rows.

## Security and privacy

Existing session, membership authorization, route, and logout boundaries remain unchanged. The sidebar does not accept or persist identity, organization, site, or shared-site authorization data from the browser.

## Reliability and observability

This update adds no network requests, telemetry, queues, workers, or operational dependencies. Existing retry and session behavior remains unchanged.

## Rollout and rollback

This is a frontend presentation change with no API or migration. Rollback restores the prior sidebar labels and theme classes.

## Open questions

- None for this bounded presentation update. Shared-site visibility and authorization require a separate approved specification.
