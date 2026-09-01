# Feature: User login

- ID: `user-login`
- Status: `approved`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-01`

## Problem

Registered Hansel users cannot currently authenticate after their onboarding application session expires or after logout. The application has secure password hashes and Hansel-managed application sessions, but it has no login route, password-authentication transition, external-provider exchange, or login-specific recovery states. Figma frame `38:528` defines the approved visual composition, while the approved onboarding authentication policy defines the security contracts that this feature must reuse.

## Outcome and success metrics

An eligible registered user can authenticate with email/password or a previously linked Google, Microsoft, or Apple identity, receive a Hansel-managed application session, and reach the correct server-authoritative destination. Verified users with incomplete onboarding can resume their accepted progress instead of creating a duplicate account. Success is measured by login completion rate by method, generic rejection rate, lockout rate, provider callback failure rate, median and p95 authentication latency, session-issuance failure rate, and successful onboarding resumption. Metrics must not contain emails, passwords, provider subjects, tokens, session credentials, tenant identifiers, profile values, or raw network addresses.

## Non-goals

- Saved-recovery-code entry, multi-factor authentication, remembered-login duration controls, and compromised-password screening. Password reset is governed separately by the approved `password-recovery` specification.
- Account-linking or unlinking UI, provider-management UI, session-management UI, `Log out everywhere`, and ownership recovery.
- A multi-organization chooser. This release authenticates a completed account only when exactly one active eligible membership can be selected safely; a separate approved feature must define organization selection.
- Creating an account from `/login`. New external-provider accounts begin only from the existing onboarding entry and remain subject to the onboarding consent and state-machine contracts.
- Adding a show-password control, remember-me checkbox, password-policy helper, or other UI absent from the approved frame. The underlined forgot-password link is the narrowly approved addition governed by password-recovery REQ-001.

## Requirements

- REQ-001: `/login` MUST follow Figma frame `38:528`, retrieved through structured design context on 2026-09-01, and the product-approved authentication-form unification recorded that day. Login and onboarding account creation MUST render through the same design-system `AuthFormLayout` and `ProviderAction` interfaces with identical canvas, exported logo, 350-pixel upper-middle column, 27-pixel regular heading, 40-pixel section rhythm, labelled-field styling, content-width start-aligned primary action, provider divider treatment, and responsive positioning. Content order MUST be `Log in to your account`; labelled `Email` and `Password` fields with placeholders `your@email.com` and `Password`; the primary `Log in` action; the `or log in with` divider; Google, Microsoft, and Apple actions using the exact committed marks in a fixed 24-pixel icon area with a 16-pixel icon-to-label gap; and the corrected underlined footer `Don't have an account? Create an account` linking to `/onboarding`. Screen-local copies of the shared layout or provider styling are prohibited.
- REQ-002: The frame's reused account-creation statements `By creating an account...` and `Already have an account? Log in` MUST NOT appear on the login page because login neither creates an account nor records consent. This approved correction supersedes those contradictory strings while retaining the frame's layout, spacing, control dimensions, border treatment, provider-button wording, and underlined-link treatment.
- REQ-003: The React form MUST use React Hook Form and Yup, accept an email and password, normalize the email by trimming and lowercasing, require both fields, preserve the password exactly as entered, use `email` and `current-password` autocomplete, support paste and password managers, and disable duplicate submission while pending. Login validation MUST NOT enforce account-creation composition rules or expose password-policy detail.
- REQ-004: Express MUST validate the strict login request with Zod and accept no caller-selected user, journey, tenant, role, membership, destination, session lifetime, or provider identity. JSON and native-form login MUST use the same authoritative authentication module. A successful native form submission MUST use a `303` redirect; JavaScript enhancement MUST use the strict response destination.
- REQ-005: A valid password for an email-verified, completed account with exactly one active eligible tenant membership MUST create a new Hansel-managed application session family plus access and refresh credentials and return `/dashboard`. Credentials MUST reuse the approved opaque, random, digest-only, `Secure`, `HttpOnly`, `SameSite=Lax`, 15-minute access, rotating refresh, and non-sliding 30-day family contracts. Authentication MUST rotate away any pre-authentication session state so session fixation is impossible.
- REQ-006: An email-verified account with an incomplete supported onboarding journey MUST authenticate the password, issue only a short-lived onboarding continuation and paired CSRF proof, and return the canonical implemented route for its current server-authoritative step. It MUST preserve accepted profile, plan, payment, organization, and discovery data and MUST NOT create an application session, duplicate journey, user, consent record, organization, or membership.
- REQ-007: A correct password for an unverified eligible onboarding account MUST request a replacement verification challenge under the existing 60-second cooldown, five-sends-per-rolling-hour, replacement invalidation, 15-minute expiry, five-attempt, digest-storage, concurrency, and delivery policies, then return `/onboarding/verify-email`. The normalized destination MAY be placed only in same-tab session-scoped browser storage by the JavaScript client; it MUST NOT enter a URL, log, metric, trace, analytics event, or error report.
- REQ-008: Unknown email, incorrect password, locked password authentication, ineligible membership, ambiguous completed-account tenant selection, and unusable account state MUST return the same visible message `We couldn't log you in. Check your details and try again.`, the same public status class, and materially equivalent response timing. Unexpected dependency failure MUST instead show `Login is temporarily unavailable. Please try again.` without exposing account, database, provider, rate-limit, or credential details.
- REQ-009: Five consecutive failed password authentications for one normalized real account within 15 minutes MUST lock password authentication for 15 minutes from the fifth failure. Further attempts during the lock MUST neither verify the password nor extend the lock. A successful password authentication before the threshold MUST reset the window and count; expiry MUST restore password authentication automatically. Lock state MUST be enforced atomically across Express tasks and concurrent requests. Unknown accounts MUST still execute equivalent bounded password-verification work without creating an account-state row.
- REQ-010: Locking a real account MUST create one durable, idempotent security-email intent per lock window for Resend delivery outside the authentication transaction. Its subject MUST be `Your Hansel password login was temporarily locked`; its copy MUST state that password login is locked for 15 minutes after several unsuccessful attempts, that a linked provider or existing session still works, and that the user should contact `support@hanselapp.io` if the attempts were unexpected. Delivery failure MUST NOT alter the generic login response or extend the lock.
- REQ-011: Before issuing a new login family, Hansel MUST atomically enforce at most five active, unexpired session families for the user. When five already exist, the oldest active family MUST be revoked with a privacy-safe reason before the new family commits. Application-session creation and any onboarding-continuation replacement MUST be transactional with the accepted authentication result.
- REQ-012: A valid application session that opens `/login` MUST replace navigation with `/dashboard`. An unauthenticated or expired dashboard load and a successful dashboard logout MUST replace navigation with `/login`; this requirement supersedes the temporary `/onboarding` destination recorded before a login page existed. A recoverable dashboard infrastructure failure MUST retain the dashboard retry state.
- REQ-013: The Google, Microsoft, and Apple buttons MUST initiate functional server-owned authorization-code flows, not decorative or disabled controls. Login intent MUST authenticate only an already-bound external identity. Onboarding intent, initiated only from `/onboarding`, MAY create a new user and new-organization journey after verified provider identity and approved versioned action consent. A provider identity not bound during login MUST fail generically and direct the person to the ordinary onboarding link rather than silently create or email-link an account.
- REQ-014: Provider flows MUST reuse onboarding REQ-021, REQ-022, and REQ-029..REQ-032 plus REQ-075..REQ-078: immutable `(provider, subject)` identity keys; no automatic email-only linking; Google and Microsoft `openid email profile`; Apple `name email`; exact environment callbacks; authorization code, state, nonce, issuer, audience, signature, algorithm, time, redirect, and PKCE validation where supported; and no persistence of access, refresh, or identity tokens. Apple relay addresses remain distinct. Safe first-authorization name suggestions MAY be retained only for the incomplete onboarding journey and MUST be confirmed through the personal-profile step.
- REQ-015: Provider clients MUST be separate by environment. Production callbacks MUST be exactly `https://app.hanselapp.io/auth/callback/google`, `https://app.hanselapp.io/auth/callback/microsoft`, and `https://app.hanselapp.io/auth/callback/apple`. Provider secrets and Apple signing material MUST come from a stage-scoped AWS Secrets Manager secret with least-privilege ECS access. Production MUST fail closed when provider login is enabled with incomplete or cross-environment configuration. Apple local development MUST use a separately registered HTTPS development origin rather than localhost.
- REQ-016: Login and provider initiation MUST work without client JavaScript through server-rendered HTTPS forms and redirects. The progressive page MUST provide the same labels, order, generic errors, accessibility semantics, safe destinations, and provider actions. JavaScript MAY enhance validation, pending state, focus, announcements, and navigation but MUST NOT be the only authentication path.
- REQ-017: Account and source-network abuse controls MUST reuse onboarding REQ-025, REQ-080, and REQ-081. CloudFront/WAF MUST protect the aggregate authentication route group with the approved configurable 300-requests-per-five-minutes coarse threshold and managed reputation/bot protections where available. Application limits and lock state MUST use atomic shared server state; arbitrary client forwarding headers MUST never define the source key. Shared limiter failure MUST fail closed for credential verification without disclosing account existence.
- REQ-018: Every cookie response and private login response MUST use `Cache-Control: private, no-store` with correct `Vary` behavior. Passwords, raw or digested credentials, cookies, authorization codes, state, nonce, PKCE values, provider tokens, provider subjects, emails, tenant data, complete responses, and source addresses MUST NOT enter logs, traces, metrics, analytics, queues, URLs, browser persistence, or error tracking. Structured events MAY contain correlation ID, authentication method, categorical outcome, environment, and non-sensitive reason category.
- REQ-019: The page MUST meet WCAG 2.2 AA, use visible labels, a logical heading and focus order, keyboard-operable actions, accessible pending and error announcements, visible focus, 200% zoom support, and responsive reflow from 320 CSS pixels without horizontal page scrolling, clipped controls, or overlapping content. Provider icons MUST be hidden from assistive technology while provider names remain in the accessible button names.
- REQ-020: The strict OpenAPI contract MUST define login request and response, generic authentication failure, temporary unavailability, progressive redirects, provider initiation, and provider callback behavior. Redirect destinations MUST be a closed server-owned enum; arbitrary return URLs are prohibited. Terms and privacy versions for provider onboarding MUST be server-approved immutable versions rather than caller-selected document locations.
- REQ-021: Frontend and backend unit suites MUST retain 100% statement, branch, function, and line coverage. Contract tests MUST cover strict parsing and unknown-field rejection. PostgreSQL tests MUST cover successful session issuance, onboarding resumption, verification recovery, lock threshold/window/expiry, concurrent failures, success reset, one lock-email intent, five-family eviction, rollback, identity uniqueness, callback replay, tenant isolation, and ambiguous membership failure. Provider adapters MUST be tested against deterministic boundary fakes and provider test environments where available without real customer accounts.
- REQ-022: Playwright MUST cover password success, generic invalid and locked results, unverified verification handoff, incomplete-onboarding resumption, existing-session redirect, logout and expiry destinations, Google/Microsoft/Apple initiation, generic callback failure, native no-JavaScript login, keyboard and screen-reader semantics, 200% zoom, 320-pixel reflow, and deterministic desktop/narrow visual baselines. Storybook MUST include API-independent default, validation-error, authentication-error, temporary-failure, and submitting states.
- REQ-023: The additive migration, provider secrets, WAF rule changes, metrics, alarms, and server-side `LOGIN_ENABLED` and `EXTERNAL_AUTH_ENABLED` flags MUST deploy before routes are enabled. Login MUST be internal/test-only until PostgreSQL migration, trusted source metadata, dummy password hash, provider registrations, callbacks, sender domain, lock notification, security tests, and production-equivalent Argon2 benchmarks pass. Rollback MUST disable new login and provider initiation without deleting users, identities, lock evidence, onboarding progress, memberships, or existing application sessions.

## Acceptance scenarios

### AC-001 — Password login reaches the dashboard [REQ-003, REQ-005, REQ-011]

- Given a verified completed user has one active eligible membership and a valid password
- When the user submits the login form
- Then Hansel atomically enforces the five-family limit, issues fresh application credentials, and opens `/dashboard`

### AC-002 — Invalid and locked credentials remain indistinguishable [REQ-008, REQ-009]

- Given the identifier is unknown, the password is wrong, or password authentication is locked
- When login is attempted
- Then the same generic message, status class, and materially equivalent verification work are used without revealing the condition
- And the fifth consecutive real-account failure locks password login for exactly 15 minutes without later attempts extending it

### AC-003 — Incomplete onboarding resumes safely [REQ-006, REQ-007]

- Given valid credentials belong to an incomplete onboarding journey
- When login succeeds
- Then a verified account resumes its canonical accepted step with an onboarding continuation
- And an unverified eligible account returns to the generic verification flow without losing or duplicating progress

### AC-004 — External identities authenticate without email linking [REQ-013, REQ-014, REQ-015]

- Given a Google, Microsoft, or Apple immutable subject is already bound to one eligible Hansel user
- When the provider callback passes every state, nonce, code, issuer, audience, signature, time, redirect, and PKCE check
- Then Hansel discards transient provider tokens, issues its own application session, and opens `/dashboard`
- And an unbound or email-conflicting login identity receives a generic result without account creation or automatic linking

### AC-005 — Login remains usable and faithful [REQ-001, REQ-002, REQ-016, REQ-019]

- Given JavaScript is enabled or disabled and the viewport is desktop, 320 pixels wide, or zoomed to 200%
- When the login page is used by keyboard or assistive technology
- Then the approved Figma composition, corrected login copy, reading order, labels, provider names, errors, focus, and actions remain perceivable and operable without horizontal overflow

### AC-006 — Existing and expired sessions use the login destination [REQ-012]

- Given a valid session opens `/login`
- When Hansel privately validates it
- Then the browser replaces navigation with `/dashboard`
- And dashboard logout or unauthenticated expiry replaces navigation with `/login`

## UX and accessibility

Figma frame `38:528` is visual authority except for the approved copy correction in REQ-002. Existing `Button`, `TextField`, Hansel logo, Figtree font, design tokens, and provider marks must be reused. The form does not expose which credential failed, why an account is locked, or whether an external identity exists. Client validation focuses the first invalid field; server errors use a live region without moving unexpectedly; pending state retains entered email while the password remains only in the controlled form lifecycle and is never persisted. Narrow layout places the logo in document flow and preserves the desktop reading order.

## API and integrations

Add strict JSON/native-form password login, provider initiation, and exact provider callback operations to `specs/openapi.yaml`. Password login returns only a closed destination and sets either application-session cookies or onboarding cookies. Provider initiation stores a one-time, short-lived transaction and redirects to the configured authorization endpoint. Callbacks consume that transaction once and set Hansel cookies before a closed redirect. Google, Microsoft, and Apple are authentication providers only; Resend sends the durable lock notification; no Cognito, provider downstream API, offline scope, or provider-token persistence is permitted.

## Data and migration

Add password-authentication failure-window and lock state associated one-to-one with the password credential; an `ExternalIdentity` uniquely constrained by provider plus immutable subject and by provider identity ownership; a short-lived digest-backed `ExternalAuthorizationTransaction` with intent, provider, state/nonce/PKCE digests, exact callback, expiry, single-use state, approved policy versions when onboarding, and optional safe first-name/last-name suggestions; and a unique durable security-email intent for each lock window. Add indexes for expiry cleanup and active lookup. Migration is additive with no backfill: existing password users remain eligible; external identities arise only from validated callbacks. Expired authorization transactions are deleted promptly and lock/security evidence follows the approved seven-year security-audit policy without retaining password attempts or source addresses beyond the minimum approved abuse window.

## Security and privacy

Hansel remains the password and session authority. Password comparison uses the existing Argon2id hash plus versioned pepper and a startup-prepared dummy hash for unknown-account timing. Login never re-applies account-creation password composition. Database transactions and constraints control failure counting, lock creation, session-family eviction, identity binding, callback consumption, and session issuance. CSRF, origin validation, OAuth login CSRF, session fixation, code/state/nonce/PKCE replay, open redirect, token substitution, account enumeration, brute force, mass assignment, and cross-tenant access are explicit test targets. Secrets remain in Secrets Manager; all public production traffic uses HTTPS.

## Reliability and observability

Authentication state changes must be atomic or return a generic retryable failure. Security-email dispatch uses the durable outbox pattern and cannot roll back a lock or alter the public response. Provider and Resend outages do not corrupt identity, lock, journey, membership, or session state. CloudWatch metrics and alarms cover unexpected login failures, lock spikes, provider callback rejection, provider dependency failure, limiter unavailability, session-issuance failure, security-email terminal failure, and p95 authentication latency using only categorical dimensions.

## Test strategy

Use vertical red-green slices through the public authentication module, Express routes, React page, and real PostgreSQL adapter. Mock only provider, email, clock/randomness, and other true system boundaries. Keep focused typechecks and single suites during implementation, then run spec validation, formatting, lint, all typechecks, 100% coverage, builds, Storybook, deterministic visual tests, Playwright E2E, PostgreSQL integration, CDK tests/synthesis, and the repository's full verification gate once. Review final changes against both repository standards and this specification before commit.

## Rollout and rollback

Deploy additive schema and Secrets Manager references first with both flags disabled. Register exact development/staging/production provider clients and callbacks, validate WAF trust and limits, benchmark Argon2 on the production-equivalent Fargate task, test synthetic accounts and provider tenants, then enable internal/test password login before external providers and staged production traffic. Rollback disables initiation and login routes while leaving the additive schema, users, identities, lock evidence, outbox state, onboarding progress, and existing sessions intact; it must not destructively reverse authentication data.

## Open questions

- None.
