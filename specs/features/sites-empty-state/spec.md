# Feature: Sites empty state

- ID: `sites-empty-state`
- Status: `implemented`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-01`
- Product approval: `User confirmed on 2026-09-01 that the supplied frame is the Sites page when no sites are available`
- Technical review: `Independent specification and repository-standards reviews completed on 2026-09-01 with no remaining actionable findings; protected releases still require GitHub CODEOWNERS approval`
- Design authority: `Figma Hansel App UI, Sites frame 2024:9828`
- Design evidence: `Browser-inspected through the signed-in Figma prototype on 2026-09-01; the structured Figma connector was blocked by the Professional View-seat call limit`

## Implementation evidence

- Specification validation, formatting, linting, TypeScript checks, production builds, Storybook build, and all 40 design-system browser checks passed.
- Frontend and backend unit suites retained 100% statement, branch, function, and line coverage.
- All 29 Chromium E2E journeys passed, including direct authenticated `/sites`, generic unauthenticated replacement, Dashboard/Sites navigation, keyboard order, axe, and 320-pixel reflow.
- Deterministic Sites screenshots passed at the 1512×982 reference viewport and 320-pixel viewport; the repository-standard 640-pixel viewport at CSS zoom 2 passed without horizontal overflow.
- AWS CDK synthesis passed for the test stage and introduced no Sites-specific infrastructure changes.
- Independent specification and repository-standards re-reviews found no remaining actionable implementation findings.

## Problem

Hansel has an authenticated dashboard shell, but its Sites navigation item is unavailable and there is no `/sites` page. A signed-in organization with no sites needs the Figma-defined Sites empty state without introducing site records, permissions, invitations, or billing behavior that has not yet been specified.

## Outcome and success metrics

- An authenticated member can move between Dashboard and Sites using the application navigation.
- `/sites` renders the approved no-sites Figma state inside the existing authenticated application shell.
- The page uses the signed-in person's server-derived identity and preserves logout behavior.
- No site data or creation behavior is fabricated; the visible creation affordances remain explicitly unavailable until the site-creation specification is approved and implemented.
- Frontend unit coverage remains 100%, the Storybook cookbook contains deterministic Sites and shared-shell states, and focused accessibility, responsive, visual, and route tests pass.

## Non-goals

- Creating, persisting, listing, searching, sorting, filtering, editing, archiving, deleting, or opening a site.
- Implementing the Figma `Add new site` two-step workflow, organization-wide or invite-only access, site roles, invitations, external collaborators, or paid-seat rules.
- Defining site schemas, API endpoints, limits, quotas, billing enforcement, or authorization policies.
- Adding grid/list content states, pagination, optimistic updates, loading skeletons for site data, or fake example sites.
- Changing the dashboard widgets, viewer/session contract, logout behavior, notification behavior, libraries, documents, or settings.
- Treating the Figma prototype's laptop frame, editor controls, comments, cursors, or annotations as application UI.

## Requirements

- REQ-001: Figma frame `2024:9828` MUST be the visual and copy authority for the authenticated Sites empty state. The application MUST reproduce the existing Hansel Beta sidebar, bordered top utility bar, selected Sites navigation item, view toggles, centered folded-map symbol, `No sites`, `Create a new site to get started.`, and both `New site` affordances without reproducing Figma or laptop chrome.
- REQ-002: `/sites` MUST be an explicit authenticated application route. It MUST load the existing private viewer context through the established dashboard-session boundary before displaying the identity block. A generic authentication rejection MUST replace navigation with `/login`; a recoverable dependency failure MUST show the existing concise retry treatment without stale identity.
- REQ-003: The shared application navigation MUST expose `Dashboard` and `Sites` as real same-origin destinations. On `/sites`, Sites MUST be the sole item with semantic current-page state; on `/dashboard`, Dashboard MUST remain current. Existing unimplemented library destinations MUST remain unavailable.
- REQ-004: The sidebar MUST continue using the exported Hansel Beta logo, server-derived initials/display name/role, account-menu interaction, logout operation, Figtree typography, Material Symbol treatment, Hansel tokens, and established Tailwind conventions. The feature MUST deepen the existing shell rather than duplicate its navigation, identity, retry, or logout logic in a second page.
- REQ-005: The top-bar and centered `New site` affordances MUST match the supplied empty-state frame's copy, icon, size, spacing, and visual treatment. Because site creation is a separate unapproved feature, both MUST be exposed as unavailable controls, MUST not open the adjacent Figma wizard, navigate to an unimplemented route, mutate state, or make a network request, and MUST become active only under a later approved site-creation specification.
- REQ-006: The grid and list view symbols MUST appear in the Figma order and selected/unselected presentation. In this empty-only slice they MUST be unavailable, MUST not imply that any site data exists, and MUST not change layout or browser state.
- REQ-007: The empty-state symbol MUST use the exact exported Figma asset if an export becomes available; otherwise it MUST use the closest existing Material Symbol with browser-verified size, stroke weight, and neutral color. It is decorative and MUST not add a duplicate accessible name.
- REQ-008: The page MUST contain one `Sites` level-one heading for assistive technology, even if visually hidden to preserve Figma, and MUST use main, navigation, header, and status semantics with logical reading order. Current and unavailable states MUST not rely on color alone, and all available controls MUST retain visible keyboard focus.
- REQ-009: At 320 CSS pixels and 200% zoom, the shell and empty state MUST reflow without horizontal page scrolling. Navigation, identity, retry, view-state symbols, empty copy, and unavailable creation controls MUST remain legible and ordered without inventing a hamburger menu.
- REQ-010: The frontend MUST not persist viewer or page state in local storage, session storage, URLs, service workers, or client caches. Existing private `Cache-Control: private, no-store` behavior remains authoritative.
- REQ-011: Storybook MUST include the Sites Figma empty state, authenticated Owner, long identity, loading, retryable failure, and 320-pixel states. Any newly exported reusable application-shell component MUST receive normal, current-page, unavailable-action, boundary-content, and accessibility cookbook coverage.
- REQ-012: Unit tests MUST retain 100% statement, branch, function, and line coverage and cover routing, current navigation, viewer loading, generic authentication handling, retry, logout reuse, and unavailable controls. Focused Playwright checks MUST cover Dashboard-to-Sites and Sites-to-Dashboard navigation, direct authenticated and unauthenticated access, desktop comparison, keyboard behavior, axe, and 320-pixel reflow.
- REQ-013: This feature MUST introduce no new API, database table, migration, external integration, queue, scheduled job, AWS resource, log payload, metric dimension, or analytics event. Existing dashboard load/logout categorical telemetry MAY be reused unchanged.

## Acceptance scenarios

### AC-001 — Authenticated organization with no sites sees the Figma empty state [REQ-001, REQ-002, REQ-004, REQ-007]

- Given a signed-in member belongs to an organization for which site creation is not yet enabled
- When the member opens `/sites`
- Then the approved shell displays their current server-derived identity
- And the centered `No sites` state matches frame `2024:9828` without fake site records

### AC-002 — Application navigation changes the current page [REQ-003, REQ-008]

- Given an authenticated member is on Dashboard or Sites
- When they activate the other available navigation destination
- Then the browser opens that destination and only it is exposed as the current page
- And unimplemented library destinations remain unavailable

### AC-003 — Creation and view controls do not invent unfinished behavior [REQ-005, REQ-006, REQ-013]

- Given the Sites empty state is visible
- When a member encounters either `New site` affordance or the grid/list symbols
- Then each is visibly present with an unavailable semantic state
- And no wizard, route transition, mutation, request, billing check, or permission decision occurs

### AC-004 — Authentication and recoverable failure remain safe [REQ-002, REQ-004, REQ-010]

- Given the Sites viewer request is rejected as unauthenticated
- When the page loads
- Then no private shell identity is disclosed and navigation is replaced with `/login`
- But a recoverable server failure retains the page boundary and offers the existing retry action

### AC-005 — Narrow and assistive use remains understandable [REQ-008, REQ-009, REQ-011, REQ-012]

- Given a 320-pixel viewport, 200% zoom, keyboard-only operation, or assistive technology
- When the Sites page loads or is retried
- Then page, current navigation, identity, empty state, unavailable actions, and available controls remain ordered and understandable without horizontal page scrolling
- And Storybook, axe, deterministic screenshot, and focused Playwright checks pass

## UX and accessibility

The visual composition is the approved white authenticated shell. Sites is selected in the left rail. The top bar includes the Figma notification treatment and a dark `New site` affordance. Grid and list symbols sit at the upper-right of the content canvas. The empty state is centered in the remaining space with a neutral folded-map symbol, bold `No sites` heading, supporting sentence, and a second dark `New site` affordance.

Until site creation is specified, the creation affordances retain the reference composition but expose an unavailable state to assistive technology and do not accept focus or activation. The view symbols follow the same rule because there is no content to transform. Available Dashboard/Sites navigation, account menu, logout, and retry actions remain keyboard operable with visible focus.

The structured Figma connector could not supply inspectable measurements or exports because the connected Professional View seat had reached its MCP call limit. Browser inspection of the signed-in prototype is therefore the current evidence. If structured context or an exact exported empty-state symbol becomes available before completion, those values take precedence over browser-derived measurements.

## API and integrations

No new endpoint is introduced. The page reuses `GET /api/dashboard` solely as the established authenticated viewer/session boundary and reuses `POST /api/dashboard/logout` for the existing account action. No site, permission, invitation, billing, Stripe, Resend, Figma-runtime, analytics, or AWS integration is called.

## Data and migration

No Site model, seed record, migration, or backfill is introduced. The state is truthful for the current product because site creation and site persistence do not yet exist. A future site-listing specification must replace this bounded empty-only assumption with a tenant-scoped server contract before any site records can exist.

## Security and privacy

The page inherits the existing opaque-cookie application session, current-membership authorization, private no-store response policy, exact-origin logout protection, credential rotation, and redacted categorical telemetry. It accepts no user, tenant, membership, role, site, permission, or billing identifiers from the browser. Viewer values remain untrusted text and are never written to browser storage or logs.

Unavailable actions must be genuine non-actions: they do not create hidden requests, external navigation, analytics, or partial client state. Future site functionality requires tenant-scoped authorization and its own approved threat boundary.

## Reliability and observability

The feature adds no persistence or mutation, so its only operational dependency is the existing dashboard viewer/session read. Its retry and authentication outcomes reuse existing handling and fixed telemetry. No new alert, dashboard, metric, queue, worker, or AWS service is justified for this empty-only presentation slice.

## Test strategy

- First extract the authenticated shell behind failing characterization tests so Dashboard behavior, logout, failure handling, and narrow reflow remain unchanged.
- Add failing Sites page tests for exact copy, current navigation, unavailable controls, identity, loading, and retry states; then implement the minimum page composition.
- Add App routing tests for `/sites`, authentication replacement, and Dashboard/Sites navigation.
- Add Storybook cookbook states and focused Playwright screenshot, axe, keyboard, and narrow-viewport checks.
- Run focused web unit coverage and design-system browser checks while iterating, then the repository specification check, lint, typecheck, focused E2E, and full verification once before commit and push.

## Rollout and rollback

The route is an additive frontend view behind the existing dashboard/session availability boundary. Rollback restores the prior frontend artifact, returning Sites to an unavailable navigation label. There is no database, API, infrastructure, or data rollback.

## Open questions

- None for this bounded slice. Site creation, site persistence/list states, access models, invitations, roles, external collaborators, plan limits, and paid-seat behavior must be approved under a separate specification before either `New site` affordance is activated.
