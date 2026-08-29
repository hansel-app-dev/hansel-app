# Feature: Dashboard logout

- ID: `dashboard-logout`
- Status: `implemented`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-08-29`
- Product approval: `Approved by user on 2026-08-29`
- Technical review: `Independent specification and repository-standards reviews completed on 2026-08-29 with no remaining code or specification findings; protected releases still require GitHub CODEOWNERS approval`
- Design authority: `Existing Figma dashboard shell 40:502; user-approved Codex-style account menu behavior`

## Implementation evidence

- `pnpm verify` passed specification validation, formatting, linting, type checking, production builds, 100% frontend/backend/contracts unit coverage, Storybook build, and all 32 design-system checks.
- Four focused PostgreSQL dashboard-session integration tests passed, including represented-family logout revocation and unrelated-family isolation.
- `pnpm test:e2e` passed all 20 Chromium journeys, including real keyboard-operated logout, PostgreSQL revocation, cookie clearing, onboarding replacement, Back behavior, accessibility, and 320-pixel reflow.
- The post-review OpenAPI and failure-state fixes passed focused specification validation, linting, 100% web coverage, and the Dashboard regression suite.
- Independent specification and repository-standards re-reviews found no remaining actionable implementation issues.

## Problem

An authenticated Hansel user can enter the dashboard but cannot deliberately end the current Hansel-managed application session. The signed-in account area in the left sidebar should expose a small account menu with a logout action without changing the surrounding dashboard design.

## Outcome and success metrics

- An authenticated user can open an accessible account menu from the dashboard profile area and log out.
- Logout revokes the server-side application-session family represented by the current credentials, clears both application cookies, and replaces the dashboard with `/onboarding`.
- Invalid, expired, repeated, or cookie-less logout requests remain safe and idempotent.
- Frontend, backend, and contracts retain 100% statement, branch, function, and line coverage; focused PostgreSQL, Storybook accessibility, and browser E2E checks pass.

## Non-goals

- Adding login, account switching, profile editing, settings, password reset, global logout from every device, or an account-menu framework.
- Changing session lifetimes, refresh rotation, cookie names, dashboard data, navigation, roles, or permissions.
- Adding a database migration or AWS infrastructure.
- Reproducing undocumented Codex menu items, dimensions, animation, or branding.

## Requirements

- REQ-001: After the private dashboard viewer has loaded, the signed-in account area in the left sidebar MUST be a button showing the existing initials, display name, and role. It MUST expose `aria-haspopup="menu"` and its expanded state without changing the existing dashboard identity content.
- REQ-002: Activating the account button MUST open a compact surface immediately above it containing one menu item labelled `Log out`. Activating the button again, pressing `Escape`, clicking outside the account menu, or completing logout MUST close it. Opening the menu MUST focus `Log out`; closing with `Escape` MUST return focus to the account button.
- REQ-003: The account menu and trigger MUST be operable with keyboard, pointer, zoom, and at a 320-pixel viewport; MUST use appropriate button/menu/menuitem semantics and visible focus; and MUST not introduce horizontal overflow. The surrounding Figma dashboard layout remains authoritative.
- REQ-004: Activating `Log out` MUST make exactly one `POST /api/dashboard/logout` request with cookies included and no request body. While it is pending, the action MUST prevent duplicate activation and visibly communicate `Logging out…`.
- REQ-005: An accepted logout MUST return `204 No Content`, revoke every active application-session family represented by the supplied access or refresh credential, and set `revokedAt` once with the bounded reason `user_logout`. Raw credentials MUST be digested before persistence access and MUST never be stored again, returned, logged, or included in metrics.
- REQ-006: The logout route MUST use the existing dashboard rollout boundary and accept only an exact trusted `Origin` matching the configured application origin. A missing, opaque, malformed, or different origin MUST return `403` without persistence access or cookie changes. No separate CSRF token is required because this JSON endpoint has no cross-origin exception and application cookies remain `SameSite=Lax`.
- REQ-007: After successful or idempotent revocation, the server MUST clear `hansel_access` at path `/` and `hansel_refresh` at path `/api/dashboard` with the existing HttpOnly, SameSite, Secure-by-origin policy. A request with no credentials, unknown credentials, expired credentials, or an already revoked family MUST still clear both cookies and return `204` without revealing session state.
- REQ-008: If persistence fails, the server MUST return a generic `503` response, record only `dashboard_logout_failed`, retain the cookies, and allow retry. It MUST not report whether either credential was valid. Accepted logout MUST record only `dashboard_logout_succeeded`.
- REQ-009: On `204`, the browser MUST replace history with `/onboarding` so Back does not reopen the authenticated dashboard. It MUST clear the verification-email session-storage hint. No user, tenant, membership, session, or redirect value may be accepted from or returned to the browser.
- REQ-010: On a rejected or unavailable logout response, the dashboard MUST remain visible, the menu MUST remain open, and a generic alert MUST say `We couldn't log you out. Please try again.` The action MUST become available for retry; authentication details MUST not be displayed.
- REQ-011: The existing Dashboard Storybook cookbook MUST add a deterministic open-account-menu example and verify its accessible behavior. No generic Popover or design-system primitive is introduced for this single use.
- REQ-012: Backend tests MUST cover trusted-origin enforcement, cookie paths/attributes, credential-free idempotency, access/refresh family revocation, already-revoked behavior, redacted success/failure events, and persistence failure. Frontend tests MUST cover request shape, success navigation, pending state, failure retry, outside click, toggle, and Escape focus restoration. PostgreSQL MUST prove matched families are revoked without affecting unrelated families. Playwright MUST cover real authenticated logout, cookie clearing, Back behavior, keyboard access, accessibility, and 320-pixel reflow.

## Acceptance scenarios

### AC-001 — Profile menu opens accessibly [REQ-001, REQ-002, REQ-003]

- Given the authenticated dashboard has loaded the viewer
- When the user activates the signed-in account button
- Then a menu opens immediately above it with `Log out` focused
- And Escape or an outside click closes it without changing dashboard state

### AC-002 — Logout ends the current session [REQ-004, REQ-005, REQ-007, REQ-009]

- Given the browser holds a valid application access or refresh credential
- When the user chooses `Log out`
- Then the server revokes the represented session family, clears both cookies, and returns `204`
- And the browser replaces navigation with `/onboarding`

### AC-003 — Logout is private and idempotent [REQ-005, REQ-006, REQ-007, REQ-008]

- Given credentials are absent, unknown, expired, or already revoked
- When a trusted-origin logout is requested
- Then the response is the same successful `204`, both cookies are cleared, and no session state is disclosed
- But an untrusted origin is rejected before persistence access

### AC-004 — A recoverable failure stays on the dashboard [REQ-008, REQ-010]

- Given session revocation persistence is unavailable
- When logout is attempted
- Then the dashboard remains visible with the menu open and the approved generic retry message
- And the session cookies are not cleared

## UX and accessibility

The existing account identity becomes one full-width trigger without changing its visible initials, name, or role. The compact menu is anchored above that trigger inside the sidebar, uses the dashboard's existing neutral surface, border, radius, typography, and focus treatment, and contains only `Log out`. It remains within the viewport at desktop and 320-pixel widths. Focus moves into the menu when it opens and returns predictably when it closes with Escape.

## API and integrations

Add one private same-origin operation: `POST /api/dashboard/logout`. It accepts no body, uses the existing HttpOnly application cookies, returns no success document, and introduces no external integration. The endpoint is mounted only with the existing dashboard module and respects the dashboard rollout flag.

## Data and migration

No schema or migration is required. Logout updates `ApplicationSessionFamily.revokedAt` and `revocationReason` on families found through digests of the supplied application credentials. It does not delete session audit records, alter credential expiry, or affect unrelated families.

## Reliability and observability

Logout succeeds idempotently when there is nothing active to revoke. A database failure returns a retryable generic result without clearing cookies. Emit the fixed structured events `dashboard_logout_succeeded` and `dashboard_logout_failed`; neither event has personal-data or credential dimensions. No new metric, alarm, queue, background worker, or AWS resource is needed for this interaction.

## Interface and module design

The existing dashboard session module remains the single authentication seam. Its interface gains `logout`, accepting only nullable access and refresh credentials. The implementation digests present credentials and asks the existing PostgreSQL adapter to revoke represented families. Callers never handle family identifiers or revocation mechanics.

The private browser interface is `POST /api/dashboard/logout` with no body and no success document. The web client exposes one focused `logoutDashboard` operation. The Dashboard receives that operation as a dependency so Storybook and frontend behavior tests do not need a network server.

## Security and privacy

Logout is a state-changing authentication operation. Exact trusted-origin validation and existing SameSite cookies prevent cross-site logout requests. Database lookup uses only credential digests, response behavior does not distinguish session validity, and operational events contain fixed categorical names without identity or credential data.

Revocation is server-authoritative: clearing browser cookies alone is insufficient. Any matched family is marked revoked before the response clears cookies. A persistence error therefore leaves cookies untouched and returns a retryable generic failure.

## Test strategy

- Work vertically: first session revocation behavior, then the route, browser operation, menu interaction, Storybook state, and real E2E journey.
- Test through the session module, HTTP route, Dashboard props, and browser-visible behavior rather than private helpers.
- Run focused files while iterating, then run `pnpm verify`, focused PostgreSQL integration, `pnpm test:e2e`, and the independent specification/standards review once before commit.

## Rollout and rollback

This is an additive endpoint and dashboard interaction under the existing dashboard rollout flag. Rollback restores the previous application artifact; already revoked sessions remain correctly logged out. No database or infrastructure rollback is required.

## Open questions

- None. Approval accepts `/onboarding` as the post-logout destination, a one-item Codex-style account menu, exact trusted-origin protection, current-session-family revocation, and retry-on-persistence-failure behavior.
