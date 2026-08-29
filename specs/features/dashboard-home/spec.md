# Feature: Dashboard home

- ID: `dashboard-home`
- Status: `implemented`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-08-29`
- Design authority: `Figma Hansel App UI, Dashboard page frame 40:502, child frame 0.0 Dashboard`
- Design evidence: `Browser-inspected 2026-08-29; Figma structured connector was blocked by the Professional View-seat call limit`
- Product approval: `Acceptance criteria approved by user, 2026-08-29`

## Problem

Onboarding completes at `/dashboard`, but that route currently falls through to the centered Hansel landing placeholder. A completed organization owner needs a secure first application page that matches the approved Figma dashboard shell and establishes the reusable visual boundary for later dashboard, sites, library, document, notification, and settings features.

The approved Figma frame is deliberately a shell: it contains four empty placeholder widgets and sample identity text rather than defined dashboard data. This feature must therefore create the authenticated shell faithfully without inventing analytics, fake navigation destinations, or business behavior that is not present in the design or an approved specification.

## Outcome and success metrics

- Completing onboarding creates a Hansel-managed application session and opens the authenticated dashboard at `/dashboard`.
- The 1512×982 reference composition matches Figma frame `0.0 Dashboard`, including the Hansel Beta mark, application navigation, top utility bar, four placeholder cards, and signed-in identity block.
- The identity block displays the authenticated person's real profile name, initials, and active-tenant role; Figma's `John Smith` and `Admin` remain sample data only.
- Direct or expired unauthenticated access fails closed and returns to `/onboarding` until the separately specified login page exists.
- The frontend and backend retain 100% statement, branch, function, and line coverage, with PostgreSQL integration, Storybook cookbook, accessibility, deterministic visual-regression, and Playwright E2E checks passing.

## Non-goals

- Defining or implementing dashboard metrics, analytics, charts, summaries, recommendations, reports, or configurable widgets.
- Implementing Sites, Libraries, Styleguide, Documents, notifications, settings, profile menus, tenant switching, or their destination pages.
- Implementing login, logout UI, session-management UI, password recovery, OAuth/OIDC, invitations, billing, or role administration.
- Copying Figma's sample `John Smith` / `Admin` identity into application data.
- Adding editable dashboard state, mutations, background polling, WebSockets, or third-party integrations.
- Treating the Figma editor chrome, selection outline, comments, collaborator cursors, or annotations as application UI.

## Requirements

- REQ-001: Figma Dashboard page frame `40:502`, child frame `0.0 Dashboard`, MUST be the visual authority. At the 1512×982 reference viewport, the implementation MUST preserve the white canvas, fixed left application rail, bordered top utility bar, four equal placeholder cards, and bottom-aligned viewer identity composition. Browser-derived measurements MUST be replaced by structured Figma values if the connector becomes available before implementation is complete.
- REQ-002: The left rail MUST use the existing exported `/assets/hansel-logo-beta.svg` asset and display the Figma navigation labels in this order: `Dashboard`, `Sites`, `Libraries`, `Styleguide`, `Documents`. `Dashboard` MUST be the only active item and MUST expose the current-page state semantically. The other labels MUST be visibly present but non-interactive and exposed as unavailable, not linked to unimplemented routes.
- REQ-003: The top utility bar MUST reproduce the Figma notification and settings/tune symbols using the design's Material Symbol style and weights or exact exported assets. Because their behavior is outside this feature, they MUST be non-interactive and MUST not claim live unread-notification state to assistive technology.
- REQ-004: The main dashboard region MUST render exactly four equal cards in one desktop row. Each card MUST contain the exact placeholder heading `Widget title`, the Figma divider, and an otherwise empty body. Placeholder cards MUST not display fabricated values, loading skeletons that imply data is coming, or clickable affordances.
- REQ-005: The viewer identity block MUST show initials derived from the accepted personal profile, the normalized `firstName lastName` display name, and the label of the authenticated membership role in the active tenant. Figma's `JS`, `John Smith`, and `Admin` are examples only. Identity values MUST be server-derived and escaped as untrusted text.
- REQ-006: `/dashboard` MUST be an explicit route and MUST render a dedicated dashboard module rather than the public `Home` fallback. `/` MUST remain the existing centered Hansel landing page. Unknown paths MUST not silently render an authenticated dashboard.
- REQ-007: `GET /api/dashboard` MUST require a valid Hansel application access credential, derive the user, active tenant, membership, profile, and role entirely on the server, and return only a strict dashboard-viewer DTO containing `displayName`, one- or two-character `initials`, and `roleLabel`. It MUST not accept user, email, tenant, membership, role, journey, or organization identifiers from the caller.
- REQ-008: The accepted discovery-completion transaction MUST exchange the valid onboarding continuation for a Hansel-managed application session bound to the completed journey's user and tenant. It MUST create one session family, one short-lived access credential, and one single-use refresh credential, then clear both onboarding cookies. A failed application-session creation MUST roll back discovery completion rather than leave a completed owner stranded without authenticated dashboard access.
- REQ-009: Application credentials MUST follow the already approved onboarding security policy: cryptographically random opaque values; only keyed non-reversible digests persisted; production cookies marked `Secure`, `HttpOnly`, `SameSite=Lax`, scoped to the minimum useful path; access lifetime no longer than 15 minutes; refresh rotation on use; and a non-sliding session-family lifetime no longer than 30 days. Credential values MUST never be exposed to JavaScript, URLs, logs, metrics, analytics, or error reports.
- REQ-010: When a valid access credential is absent or expired, the dashboard read MAY use a valid refresh credential exactly once to rotate the refresh credential and issue a new access credential. Concurrent use of the same refresh credential MUST produce one winner; detected reuse MUST revoke the entire session family. A revoked, expired, malformed, replayed, wrong-tenant, or membership-ineligible session MUST fail closed without disclosing which condition failed.
- REQ-011: Dashboard authorization MUST require that the session's active tenant still exists and the user still has an active membership in it. The response MUST always use current profile and role data rather than session-cached authorization claims. Cross-tenant data access, caller-selected roles, and fallback to another membership are prohibited.
- REQ-012: A dashboard load that receives the stable unauthenticated response MUST clear safe client-only dashboard state and replace navigation with `/onboarding`; it MUST not render stale identity or a session-unavailable dead end. Recoverable network or server failure while the session may still be valid MUST retain the shell boundary and show a concise retryable page-level message without exposing database, credential, tenant, or provider details.
- REQ-013: Private dashboard responses MUST use `Cache-Control: private, no-store`, deny framing under the approved security-header policy, and vary correctly on cookie-derived authentication. No service worker, browser storage, query string, or client cache may persist the viewer DTO.
- REQ-014: The dashboard module MUST reuse the existing Figtree font, Hansel tokens, logo asset, and established Tailwind conventions. Design-specific shell values MAY be added as semantic tokens. It MUST not introduce an unrelated component library, remote runtime font, arbitrary icon family, or parallel styling system.
- REQ-015: At widths below the desktop composition, the layout MUST reflow without horizontal page scrolling: the rail becomes an in-flow application header/navigation region, unavailable navigation labels may wrap, the utility bar remains reachable, cards become a single column, and viewer identity remains legible. This responsive behavior is accessibility-derived because Figma supplies only the desktop dashboard frame; it MUST preserve the same content and order without inventing a mobile menu interaction.
- REQ-016: The page MUST meet WCAG 2.2 AA, provide one clear page-level `Dashboard` heading for assistive technology even if visually hidden to preserve Figma, use landmark and navigation semantics, expose the current page, maintain logical reading and focus order, retain visible focus for any available control, support keyboard-only use, and reflow at 320 CSS pixels and 200% zoom. Decorative symbols and repeated card structure MUST have appropriate accessible treatment.
- REQ-017: The dashboard page MUST have API-independent Storybook cookbook stories for authenticated Owner, long-name/long-role content, loading, retryable failure, and 320-pixel narrow states. Any new exported reusable component MUST receive its own normal, boundary, disabled/unavailable, and accessibility stories; internal implementation details do not become public design-system modules solely to increase component count.
- REQ-018: Frontend and backend unit suites MUST retain 100% statement, branch, function, and line coverage. Contract tests MUST cover the exact strict viewer DTO and rejection of unknown fields. PostgreSQL tests MUST prove atomic onboarding-to-session exchange, rollback, tenant isolation, current-membership authorization, access expiry, refresh rotation, one concurrent refresh winner, reuse-family revocation, and absolute expiry. Playwright MUST cover real discovery completion into the dashboard, authenticated refresh, direct unauthenticated access, expiry redirect, retryable failure, desktop Figma comparison, keyboard use, 320-pixel reflow, and deterministic screenshots.
- REQ-019: Structured events MUST record dashboard load success, unauthenticated rejection, refresh success, refresh race/reuse revocation, membership rejection, and unexpected load failure using correlation ID and non-sensitive categorical fields. Logs, traces, and metrics MUST never contain names, emails, initials, tenant names, role labels, raw or digested credentials, cookies, headers, or complete viewer responses. CloudWatch alerting MUST cover sustained unexpected dashboard-load and session-refresh failures.
- REQ-020: The additive application-session migration MUST deploy before the dashboard/session feature is enabled. Production rollout MUST be controlled by a server-side flag and fail closed if the migration, session secret/version, or dashboard authorization dependency is unavailable. Rollback MUST disable session issuance and the dashboard route, revoke or expire newly issued credentials safely, and preserve completed onboarding, tenant, membership, profile, plan, and discovery records.

## Acceptance scenarios

### AC-001 — Completed onboarding opens the authenticated Figma dashboard [REQ-001, REQ-005, REQ-006, REQ-008]

- Given a verified owner has completed the accepted organization and discovery journey
- When discovery completion commits
- Then Hansel atomically creates the approved application session, clears onboarding credentials, and opens `/dashboard`
- And the Figma dashboard shell shows that owner's real name, initials, and `Owner` role rather than the sample identity

### AC-002 — Dashboard shell matches the approved empty state [REQ-001, REQ-002, REQ-003, REQ-004, REQ-014]

- Given an authenticated member loads `/dashboard` at the reference viewport
- When the page renders
- Then the Hansel Beta rail, ordered labels, utility symbols, four `Widget title` cards, and identity block match frame `0.0 Dashboard`
- And no fake metric, destination, notification state, or unavailable interaction is introduced

### AC-003 — Private viewer context is server-derived [REQ-005, REQ-007, REQ-011, REQ-013]

- Given a valid session bound to one active tenant membership
- When the browser requests the dashboard, including with forged identity or tenant inputs
- Then the server ignores caller identity and returns only current profile and membership display values for the bound tenant
- And the response is private, no-store, strictly parsed, and contains no internal identifiers

### AC-004 — Access refresh is rotated safely [REQ-009, REQ-010]

- Given an expired access credential and one valid unused refresh credential
- When the dashboard is loaded once or concurrently
- Then one request rotates the refresh credential and receives a new access credential
- And replay or concurrent reuse revokes the session family without leaking session state

### AC-005 — Invalid sessions fail closed [REQ-010, REQ-011, REQ-012]

- Given credentials are absent, malformed, expired, revoked, replayed, cross-tenant, or no longer backed by an active membership
- When `/dashboard` or its API is requested
- Then no identity or dashboard content is disclosed
- And the browser replaces navigation with `/onboarding` without showing stale content or a dead session message

### AC-006 — Recoverable failure does not impersonate logout [REQ-012, REQ-019]

- Given a session may still be valid but the dashboard read fails unexpectedly
- When the page cannot load the viewer DTO
- Then a concise retry action is shown within the shell boundary
- And safe telemetry records only the categorical failure and correlation ID

### AC-007 — Responsive and assistive use remains understandable [REQ-015, REQ-016, REQ-017, REQ-018]

- Given the viewport is 320 pixels wide, text is zoomed to 200%, or a person uses keyboard or assistive technology
- When the dashboard loads or a retry is needed
- Then landmarks, current-page state, identity, unavailable navigation, cards, and retry remain ordered and understandable without horizontal page scrolling
- And Storybook, axe, deterministic visual, and Playwright checks pass

## UX and accessibility

The desktop reference is a 1512×982 white application canvas. A fixed left rail contains the Hansel Beta logo, active Dashboard item, Sites item, a `Libraries` section label with Styleguide and Documents beneath it, and the signed-in identity at the bottom. The content region has a shallow top utility bar with the two Figma symbols and a four-column card row beneath it. Each card has one `Widget title` header, divider, and empty body.

The Figma editor's left and right panels, dark canvas, frame label, selection border, comments, survey, collaborator markers, and editor toolbars are not application content. Figma's identity values are placeholders; application data is authoritative for the viewer block. The orange notification accent is visual design content only in this scope and must not be announced as a real unread notification.

On narrow screens, the same semantic order becomes logo, primary navigation, library labels, identity, utility symbols, and dashboard cards. No hamburger menu is introduced without a separate approved interaction design. Unavailable destinations remain visibly distinguishable without relying only on color.

The structured Figma connector could not return code, measurements, or downloadable assets because the Professional View seat had reached its tool-call limit. The frame was inspected through the signed-in browser. Before implementation is considered complete, deterministic comparison MUST use frame `40:502` / `0.0 Dashboard`; if structured context becomes available, its exact measurements, symbol metadata, and export assets take precedence over browser-derived approximation.

## API and integrations

The OpenAPI 3.1 contract will define:

- `GET /api/dashboard` for the authenticated viewer DTO;
- one stable generic unauthenticated response used for all credential, session-family, tenant, and membership failures;
- the strict success payload `{ viewer: { displayName, initials, roleLabel } }` with no unknown fields or internal identifiers;
- `Cache-Control: private, no-store` and protected session-cookie behavior.

The existing discovery completion endpoint remains the only transition into this dashboard for the current release. Its accepted transaction gains the application-session exchange and cookie response. The feature does not call Stripe, Resend, Figma, analytics, CRM, AI, file storage, queues, or other third-party services. Figma remains a design-time authority only.

## Data and migration

Add an application session family related to one user and one active tenant, with non-sliding absolute expiry, revocation timestamp/reason, creation and audit timestamps, and privacy-minimized optional device metadata only if the existing approved policy requires it. Add digest-backed access and refresh credentials with credential kind, unique keyed digest, expiry, consumption/replacement state, and ordinary audit timestamps. Raw credentials are never stored.

The accepted discovery transaction creates the session family and first credentials after verifying the completed journey's user, tenant, and protected Owner membership, then removes the onboarding continuation. Dashboard reads join the active tenant membership and personal profile on every authorization decision. Refresh rotation uses a transaction, unique constraints, and compare-and-swap so one credential has one accepted use.

The migration is additive. Existing completed test journeys receive no inferred sessions or backfill; they must authenticate through a future login flow or be recreated in controlled test environments. Rollback preserves users, profiles, tenants, memberships, onboarding selections, discovery answers, and completion timestamps.

## Security and privacy

Hansel owns the application session. Cookies, digests, rotation, expiry, family revocation, CSRF boundaries, and the five-family account limit remain governed by the already approved onboarding authentication policy. This page is read-only, so it adds no state-changing dashboard endpoint; future dashboard mutations require CSRF and origin validation under their own specs.

Authorization is membership-based and tenant-scoped. A valid credential without a current active-tenant membership is insufficient. Viewer data is private account data and must not enter logs, metrics, tracing attributes, URLs, storage, error tracking payloads, or external services. Error responses resist account, tenant, membership, and session enumeration.

## Reliability and observability

Onboarding completion, application-session creation, first credential creation, and onboarding-continuation deletion commit atomically. Refresh consumption, replacement issuance, and replay handling commit atomically. Dashboard reads are side-effect free except for an explicitly required credential refresh.

Emit approved structured outcomes and CloudWatch metrics for dashboard load, generic authentication rejection, refresh, replay/revocation, authorization rejection, and unexpected failure. Alert on sustained unexpected load or refresh failures. Synthetic production checks must use a dedicated non-production-data account and must never record viewer values.

## Test strategy and implementation plan

1. Add strict dashboard-viewer contracts and failing contract tests for exact success and generic failure shapes.
2. Add the application-session Prisma migration and a deep session module whose public interface covers onboarding exchange, dashboard authorization, and refresh; drive it through PostgreSQL tests for atomicity, rotation, replay, expiry, and tenant isolation.
3. Extend discovery completion with a failing integration test, then atomically exchange the continuation for application credentials and set/clear the required cookies.
4. Add the authenticated `GET /api/dashboard` route with failing API tests, current-membership authorization, strict response parsing, private cache headers, and safe events.
5. Add a prop-driven dashboard page and API-independent Storybook states, then implement the Figma shell using the existing logo, font, Tailwind tokens, and exact design labels/assets.
6. Route only `/dashboard` to the new page, implement load/retry/unauthenticated behavior, and keep `/` plus unknown routes outside the authenticated shell.
7. Add axe and deterministic desktop/narrow Storybook screenshots, then Playwright flows for real discovery-to-dashboard, refresh, rejection, retry, keyboard use, and 320-pixel reflow.
8. Run focused changed-package checks during each red-green slice, then run the full repository verification, PostgreSQL integration, Storybook, visual, and Playwright gates. Record evidence here only after every gate passes, then commit and push this complete spec before another spec begins.

## Rollout and rollback

Deploy the additive migration and session secrets/version first with dashboard session issuance disabled. Validate atomic exchange, cookie attributes, refresh/reuse behavior, authorization, cache headers, CloudWatch metrics, alarms, accessibility, and synthetic flows in non-production. Enable for internal/test tenants before staged production rollout.

Rollback disables dashboard session issuance and the authenticated route, clears or revokes credentials issued by the affected release where required, and restores the previous application artifact. It must not reverse completed onboarding or delete tenant, membership, profile, plan, or discovery data.

## Open questions

- None. Approval of this specification authorizes only the authenticated empty dashboard shell, required session exchange, and behavior listed above. Every real dashboard widget and currently unavailable destination requires its own approved specification.

## Implementation evidence

- The explicit `/dashboard` route, API-independent dashboard module, authenticated viewer contract, Figma-derived desktop shell, responsive 320-pixel composition, loading state, retry state, unavailable navigation semantics, local Figtree/Material Symbols assets, and Storybook cookbook states are implemented.
- Discovery completion now creates the session family plus initial access/refresh credentials in its PostgreSQL transaction; the additive migration was applied to PostgreSQL 16 before the feature tests. Current-membership authorization, access expiry, absolute expiry, tenant isolation, refresh rotation, concurrent use, replay-family revocation, and rollback were exercised by seven passing PostgreSQL integration tests.
- Session credentials are opaque and digest-only, use an independent production digest secret from AWS Secrets Manager, rotate through `HttpOnly`, `SameSite=Lax`, path-scoped cookies, and produce a strict private/no-store dashboard DTO with `Vary: Cookie` and no internal identifiers.
- `pnpm verify` passed on 2026-08-29: specification checks, formatting, lint, TypeScript, builds, 38 contract tests, 211 backend tests, 103 frontend tests, 100% statement/branch/function/line coverage for contracts/backend/frontend, Storybook build, and 31 axe-backed deterministic design-system visual tests.
- `pnpm test:e2e` passed all 19 Chromium journeys, including real discovery-to-session exchange, forced access expiry and refresh, authenticated dashboard loading, unauthenticated replacement navigation, retry/keyboard behavior, accessibility, and 320-pixel reflow. `pnpm --filter @hansel/infra cdk:synth` also passed with dashboard metrics, alarms, production-disabled rollout flag, and the session digest secret present.
- The structured Figma connector remained unavailable because its Professional View-seat tool-call limit was reached. The implementation and committed desktop/narrow screenshots were therefore compared against the signed-in browser inspection of frame `40:502`; no code or assets were copied from the legacy repository.
- Final standards/spec review against `HEAD` and this approved specification found no remaining blocking findings. The review added explicit cookie variance and refresh-exception telemetry before the final verification.
