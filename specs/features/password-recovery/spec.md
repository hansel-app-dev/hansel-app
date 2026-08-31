# Feature: Password recovery

- ID: `password-recovery`
- Status: `approved`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-08-31`
- Design authority: `Figma Hansel App UI, Emails node 132:961 (Reset your password)`
- Design evidence: `Browser-inspected 2026-08-31 after the structured Figma connector reached the Professional View-seat call limit`
- Product approval: `Approved by user on 2026-08-31, including the 15-minute six-digit-code adaptation described in REQ-012`

## Problem

Hansel users who forget a Hansel-managed password cannot currently recover access. The login page deliberately shipped without recovery until the recovery security policy, email design, database transition, session consequences, and abuse controls could be specified together. An unsafe implementation could disclose account existence, put reusable secrets in URLs, leave stolen sessions active after a password change, or let concurrent requests reuse a challenge.

The approved onboarding security policy already defines the recovery authority: Hansel sends a six-digit code only to a verified primary email; the code expires after 15 minutes, permits five failures, observes the resend policy, and authorizes exactly one bounded password reset. Figma node `132:961` defines the Reset-password email composition, but its secret-link and 60-minute wording conflict with that approved security policy. This specification records the approved adaptation rather than silently weakening the security contract.

## Outcome and success metrics

- A signed-out user can initiate recovery from login, receive a Figma-aligned Resend email, submit the current six-digit code with a compliant new password, and return to login.
- Initiation and resend remain generic for existing, unknown, unverified, provider-only, locked, disabled, and otherwise ineligible identifiers.
- A successful reset atomically changes only the password credential, consumes recovery authority, clears password lock state, revokes existing Hansel sessions and onboarding continuations, and queues a verified-channel security notification.
- Frontend, backend, contracts, and infrastructure retain their required checks; frontend, backend, and contracts retain 100% statement, branch, function, and line coverage.
- Operational measures include generic initiation rate, delivery outcome, invalid/expired/exhausted reset rate, successful reset rate, session-revocation failure, notification age, and p50/p95 recovery latency without personal or secret dimensions.

## Non-goals

- Recovering an account through Google, Microsoft, Apple, support override, security questions, SMS, ownership transfer, tenant administration, invitation changes, manual identity proofing, or saved recovery codes.
- Changing the primary email, external identities, user profile, organization, tenant, membership, role, invitation, ownership, billing, or onboarding answers.
- Automatically signing the user in after reset, issuing a replacement session, accepting a caller-selected destination, or supporting arbitrary return URLs.
- Compromised-password or common-password screening, which remains explicitly excluded by the approved password policy.
- Adding password visibility controls, persistent password-policy helper copy, remembered-email persistence, or a password-strength meter without an approved design.
- Claiming full completion of the pre-existing onboarding REQ-025/REQ-080 trusted-source application limiter. The subject limiter and existing `/api/auth` AWS WAF layer are required here; production enablement remains blocked until the trusted-source application limiter is approved and complete.

## Requirements

- REQ-001: The login page MUST add one visibly underlined `Forgot password?` link associated with the password area and targeting the closed route `/forgot-password`. This requirement supersedes the forgot-password-link exclusion in user-login Non-goals while preserving the rest of Figma login frame `38:528`, its labels, providers, responsive behavior, and corrected account-creation link.
- REQ-002: `/forgot-password` MUST use the existing Hansel Beta logo, Figtree typography, white canvas, approximately 352-pixel upper-middle single-column layout, `TextField`, `Button`, link, focus, and responsive conventions from login. It MUST show heading `Forgot your password?`, instruction `Enter your email and we'll send you a code to reset your password.`, labelled `Email` field with `your@email.com`, primary action `Send reset code`, and an underlined `Back to log in` link.
- REQ-003: The React forgot-password form MUST use React Hook Form and Yup, normalize the email by trimming and lowercasing, require a syntactically valid email, use `email` autocomplete, focus the first invalid field, and disable duplicate submission while pending. Express MUST validate a strict Zod request and reject unknown fields. The server MUST accept no caller-selected user, verification state, eligibility, tenant, role, challenge properties, template, session, or destination.
- REQ-004: `POST /api/auth/password-recovery/request` MUST return the same `202` status and strict `{ "status": "accepted" }` JSON for every syntactically valid email regardless of account existence, verification, credential type, lock, eligibility, rate-limit suppression, cooldown, or email-provider result. Native-form initiation MUST use a `303` redirect to `/reset-password?requested=1`. Visible copy MUST be `If an eligible Hansel account exists for that email, we've sent a reset code. Check your inbox and spam folder.` and MUST not state that a particular account or message exists.
- REQ-005: Recovery initiation for one normalized email representation MUST be limited atomically in shared PostgreSQL state to at most three accepted attempts per rolling hour, including unknown and ineligible identifiers. Equivalent case and surrounding-whitespace representations MUST share one HMAC identifier bucket. A real eligible account additionally MUST observe a 60-second resend cooldown; replacing a code MUST consume every prior outstanding `PASSWORD_RECOVERY` challenge. Suppression MUST retain the generic response and materially equivalent bounded work. Initiation evidence MUST expire after 30 days and be removed through the normal recovery maintenance path without retaining the raw email.
- REQ-006: Only a user with a Hansel password and verified primary email is eligible for an emailed recovery challenge. Linked-provider-only, unverified, deleted, or unusable accounts MUST receive no recovery code. Password-authentication lock MUST NOT prevent the approved recovery flow. The browser and caller MUST never learn which eligibility condition applied.
- REQ-007: Each issued recovery challenge MUST contain a cryptographically random six-digit numeric code, store only its keyed digest, expire 15 minutes after issuance, allow at most five failed submissions, and be single-use. The fifth failed submission MUST exhaust it. Expired, superseded, consumed, malformed, unknown, ineligible, or exhausted challenges MUST produce the same visible reset failure and public status class. Code comparison and consume/reset decisions MUST be concurrency-safe and timing-safe where digests are compared.
- REQ-008: `/reset-password` MUST reuse the approved auth layout and display heading `Reset your password`, the generic requested message when applicable, labelled `Email`, `Reset code`, `New password`, and `Confirm new password` fields, primary action `Reset password`, an underlined `Request a new code` action, and an underlined `Back to log in` link. The code field MUST accept exactly six digits, support paste and `one-time-code` autocomplete, and never auto-submit. New-password fields MUST support paste, password managers, and `new-password` autocomplete.
- REQ-009: The React reset form MUST use React Hook Form and Yup. The email MUST normalize as in REQ-003; the code MUST contain exactly six ASCII digits; the new password MUST follow onboarding REQ-023's 15–128 Unicode-character boundary and uppercase, lowercase, Unicode-number, and punctuation-or-symbol rules; confirmation MUST match exactly. Policy errors MUST appear only after invalid submission rather than as persistent helper copy. Express MUST revalidate the same authoritative rules using strict Zod contracts and reject unknown fields.
- REQ-010: `POST /api/auth/password-recovery/reset` MUST accept only normalized email, six-digit code, and new password. Invalid public outcomes MUST use one generic `400` response `{ "error": "password_reset_rejected" }` and visible message `We couldn't reset your password. Request a new code and try again.` Unexpected dependency failure MUST use `503` `{ "error": "password_reset_unavailable" }` and visible message `Password reset is temporarily unavailable. Please try again.` Neither response may expose account, code, expiry, attempt, lock, session, database, or provider state.
- REQ-011: A successful reset MUST atomically verify and consume the current challenge, hash the new password with the current Argon2id configuration and pepper version, replace only that user's password credential, clear the password-authentication failure window and lock, revoke every active application-session family with a bounded recovery reason, delete every onboarding continuation, invalidate every outstanding `PASSWORD_RECOVERY` challenge, create one durable password-changed notification intent, and emit a privacy-safe success event. Any failure MUST leave the prior password, sessions, lock state, challenges, and notification state consistent; concurrent valid submissions MUST have one winner.
- REQ-012: Reset-email Figma node `132:961` MUST be the visual authority: an 800-pixel fixed design canvas represented responsively as a maximum-width off-white `#F7F5EB` shell with 64-pixel top/bottom padding, centered white card, orange Hansel Beta mark, 32-pixel content rhythm, prominent `Reset your password.` heading, dark slate action button, and centered muted Hansel footer. The approved security adaptation MUST replace the frame's secret-link-only flow and 60-minute statement with a separately displayed six-digit code valid for 15 minutes. The button MUST open the trusted absolute `/reset-password` route without a secret, email, code, user, tenant, or tracking value in the URL.
- REQ-013: Reset-email visible copy MUST be: `Reset your password.`; `Hi {firstName},`; `We received a request to reset the password for your account.`; `If you made this request, use the code below to set a new password:`; the six-digit code; `Reset your password`; `If you didn't request a password reset, you can safely ignore this email — your current password will remain unchanged. For security, this code will expire in 15 minutes.`; `Need help? Just reply to this email or contact our support team.`; `Hansel`; and `This email was sent by Hansel App because a password reset was requested for your account.` The subject MUST be `Reset your Hansel password`. The accepted personal-profile first name MAY personalize the greeting; when absent, the safe greeting MUST be `Hi,`.
- REQ-014: The reset email MUST have semantically equivalent plain text, use email-client-compatible tables and inline styles, remain readable without images and at narrow widths/200% zoom, and meet WCAG 2.2 AA. It MUST contain no script, form, remote font, attachment, tracking pixel, cookie, executable content, raw provider response, or secret URL. Dynamic name, code, and URL values MUST be context-escaped. The code MUST not appear in a URL, log, metric, trace, analytics event, idempotency key, or error.
- REQ-015: Resend delivery MUST reuse `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Each real issued challenge MUST use a stable provider idempotency key derived only from `PASSWORD_RECOVERY` plus the challenge UUID; retries of that same payload MUST reuse the key. Delivery failure or ambiguity MUST not change the generic initiation response or disclose existence. Console mode MUST emit only a privacy-safe event and MUST NOT print recipient, first name, raw code, email body, or URL; deterministic tests MAY capture a code only through injected test adapters.
- REQ-016: A successful reset MUST not create a session. JSON success MUST return strict `{ "destination": "/login" }`; native-form success MUST use a `303` redirect to `/login?password_reset=success`. The login page MUST show `Your password has been reset. Log in with your new password.` without displaying email or reset data. The prior password MUST fail and the new password MUST authenticate only through the ordinary login policy.
- REQ-017: The password-changed security notification MUST be created durably in the reset transaction, sent outside that transaction, and state `Your Hansel password was changed`; `The password for your Hansel account was changed using account recovery.`; `If you made this change, no further action is required.`; and `If you did not make this change, contact support@hanselapp.io immediately.` Delivery failure MUST not undo the reset. The existing API/ECS worker pattern MUST use an expiring PostgreSQL lease, stable non-personal Resend idempotency key, bounded retry, sanitized provider identifiers, and one logical notification per successful reset.
- REQ-018: The normalized recovery email MAY be retained only in same-tab `sessionStorage` to prefill `/reset-password`, MUST be editable, and MUST be removed after success or navigation back to login. The code and new password MUST never be placed in browser storage, URL, history state, log, analytics, error tracking, or persistence outside the controlled form lifecycle. Native forms MUST never put email, code, or password in a URL.
- REQ-019: Forgot/reset pages and server-rendered progressive forms MUST remain operable without JavaScript. Native and JSON routes MUST share the same recovery module, validation, generic outcomes, rate limits, challenge policy, and atomic reset. Private responses and all pages that reflect recovery state MUST use `Cache-Control: private, no-store` and safe `Vary`; state-changing requests MUST enforce the trusted-origin policy without treating arbitrary forwarding headers as source identity.
- REQ-020: The feature MUST meet WCAG 2.2 AA with real labels, logical headings and focus order, keyboard-operable actions, visible focus, accessible pending/error/status announcements, 200% zoom, and responsive reflow from 320 CSS pixels without horizontal scrolling or clipped controls. The approved Hansel logo asset and existing design tokens/components MUST be reused. Every new reusable UI module and complete screen MUST have API-independent Storybook cookbook stories for default, validation, server rejection, temporary failure, requested, and submitting/success states as applicable.
- REQ-021: The strict OpenAPI contract MUST define the request, reset, progressive redirect, generic rejection, temporary failure, and closed success destination. Recovery routes MUST remain within the existing `/api/auth` and `/auth` AWS WAF authentication group. CDK MUST expose a server-side `PASSWORD_RECOVERY_ENABLED` flag, privacy-safe CloudWatch metrics/alarms for unexpected failure and notification backlog, and no new public data store or secret. Production MUST remain disabled until the additive migration, Resend sender/domain, WAF, trusted-source application limiter, alarms, and production-equivalent security tests pass.
- REQ-022: Frontend, backend, and contract unit suites MUST retain 100% statement, branch, function, and line coverage. PostgreSQL tests MUST cover known/unknown and normalized identifier limits, cooldown, replacement, expiry, five failures, single use, concurrent reset, Argon2 replacement, lock clearing, session/onboarding revocation, notification atomicity/rollback, and tenant/profile non-mutation. Email tests MUST prove exact adapted Figma copy/layout, escaping, safe URL, plain text, Resend idempotency, redaction, retry, and lease recovery. Playwright MUST cover request-to-reset success, generic unknown request, invalid code, resend, old-password rejection/new-password login, session revocation, no-JavaScript operation, keyboard/accessibility, 320-pixel reflow, 200% zoom, and deterministic visual baselines.
- REQ-023: Implementation MUST proceed in vertical RED-to-GREEN slices through public module and HTTP interfaces. The additive migration and disabled flag deploy before enablement. Rollback MUST disable request/reset routes and notification claims without deleting users, password credentials, challenges, attempt evidence, sessions, notification evidence, or audit events. No password, code, recipient, body, provider error, identifier digest, source address, session credential, or cookie may enter logs or operational dimensions.

## Acceptance scenarios

### AC-001 — Recovery initiation remains private [REQ-003, REQ-004, REQ-005, REQ-006]

- Given the submitted email belongs to an eligible account, an unknown account, an unverified account, or a provider-only account
- When recovery is requested with a syntactically valid email
- Then every request receives the same accepted response and visible generic copy
- And only the eligible account may receive a current code while normalized subject limits and cooldown are enforced without disclosure

### AC-002 — The Figma-aligned reset email carries no URL secret [REQ-012, REQ-013, REQ-014, REQ-015]

- Given an eligible verified password account receives a recovery challenge
- When Hansel renders and sends the Reset-password email
- Then the approved Figma shell, adapted copy, six-digit code, 15-minute statement, safe action, and footer are present in HTML and plain text
- And no code, email, account identifier, tenant value, credential, or tracking value appears in the action URL, logs, or idempotency key

### AC-003 — One current code authorizes one reset [REQ-007, REQ-009, REQ-010, REQ-011]

- Given the current code has not expired, been superseded, been consumed, or reached five failed attempts
- When the matching email, code, and compliant new password are submitted
- Then one atomic winner replaces the password and consumes all reset authority
- And invalid, expired, superseded, consumed, exhausted, unknown, and concurrent-loser submissions receive the same rejection

### AC-004 — Recovery removes prior access [REQ-011, REQ-016, REQ-017]

- Given the user has active application sessions, an onboarding continuation, password lock state, and outstanding recovery challenges
- When reset succeeds
- Then every existing session is revoked, the continuation and challenges are invalidated, the lock is cleared, and one durable password-changed notification is created
- And the user returns to login without an automatic session; the old password fails and the new password follows ordinary login

### AC-005 — Recovery remains usable and accessible [REQ-001, REQ-002, REQ-008, REQ-018, REQ-019, REQ-020]

- Given JavaScript is enabled or disabled and the viewport is desktop, 320 pixels wide, or zoomed to 200%
- When the user initiates recovery, resends, corrects validation, submits a code, or returns to login by keyboard or assistive technology
- Then the approved auth composition, reading order, labels, generic states, focus, and actions remain perceivable and operable without horizontal overflow
- And only the normalized email may survive temporarily in same-tab storage while the code and passwords never do

### AC-006 — Delivery and operations fail safely [REQ-015, REQ-017, REQ-021, REQ-023]

- Given Resend, PostgreSQL, or a worker is unavailable, ambiguous, rate-limited, or restarted
- When initiation, reset, or password-changed notification work occurs
- Then public responses remain generic, accepted password changes are not rolled back by notification failure, and durable work recovers or terminates according to policy
- And operators see only privacy-safe categories, counts, and ages rather than personal or secret data

### AC-007 — Rollout cannot expose a partial production flow [REQ-021, REQ-022, REQ-023]

- Given the migration and application artifact are deployed with password recovery disabled
- When prerequisites pass and the flag is enabled, or the release is rolled back
- Then routes, notification claims, WAF coverage, alarms, schema, and tests move through the approved order
- And disabling the flag preserves credentials, sessions, challenges, rate evidence, and notification evidence without accepting new recovery operations

## UX and accessibility

No dedicated forgot/reset application screens exist in the supplied Figma file. The user approved reusing the implemented login composition and design system for those screens rather than inventing a second auth language. The Figma Reset-password email node is authoritative for the email shell and content order, subject to the approved code/expiry/footer corrections in REQ-012 and REQ-013.

The forgot screen moves from email entry to the reset screen regardless of account state. The reset screen keeps the email visible and editable so direct visits, native forms, password managers, and assistive technology work without hidden state. Requested, rejected, unavailable, and success messages are concise live/status regions that never identify the account condition. Validation moves focus to the first invalid field and does not erase a valid email; server rejection clears neither the code field nor password through persistent storage, and passwords remain only in live form state.

At narrow widths the logo joins normal document flow, controls remain full width, and links remain underlined. At desktop widths the 114-by-20 approved Hansel Beta asset sits at the upper left and the form aligns with login's upper-middle 352-pixel column.

## API and integrations

- `POST /api/auth/password-recovery/request` accepts strict `{ email }` JSON or the equivalent native form and returns generic accepted behavior.
- `POST /api/auth/password-recovery/reset` accepts strict `{ email, code, password }` JSON or native form and returns only the closed login destination on success.
- `GET /forgot-password` and `GET /reset-password` provide progressive HTML. `GET /login` owns the safe post-reset confirmation.
- The React client uses the same operations and parses responses from `@hansel/contracts`; Yup is client-only guidance and Zod remains authoritative.
- Resend sends the reset-code message and durable password-changed notification using existing secret injection and sender configuration. Figma remains a design-time authority and is never called at runtime.

## Data and migration

Reuse `VerificationChallenge` with purpose `PASSWORD_RECOVERY`; that enum already exists. Add a privacy-preserving recovery-initiation record containing UUID, HMAC normalized-identifier digest, request time, and expiry/cleanup index so known and unknown identifiers share the same atomic three-per-hour limit without raw email persistence.

Add a password-changed notification-intent child of `User` containing UUID, reset/challenge correlation identifier or unique reset event key, delivery status, attempts, next-attempt time, lease owner/expiry, delivered/terminal timestamps, bounded provider identifier, bounded failure category, and ordinary timestamps. It must not duplicate recipient, first name, email body, password, or code. A uniqueness constraint must prevent more than one logical notification for one successful reset.

The reset transaction updates the existing `PasswordCredential`, `PasswordAuthenticationState`, `ApplicationSessionFamily`, `OnboardingContinuation`, and `VerificationChallenge` records and creates the notification intent. No tenant, membership, organization, journey, profile, consent, billing, invitation, or external identity row may change.

The migration is additive and requires no account backfill. Recovery-attempt evidence is retained for 30 days and deleted through the normal recovery maintenance path; notification evidence follows the account/security-audit retention policy and cascades on account deletion unless legal policy later requires a different approved relation.

## Security and privacy

Hansel remains the password authority. New passwords use the existing Argon2id implementation, unique salt, AWS Secrets Manager pepper, stored parameters, bounded hashing behavior, and pepper-version policy. The reset endpoint never authenticates through the old password and never trusts caller-selected authorization state.

Recovery initiation is deliberately generic and stores only a keyed normalized-identifier digest for subject limiting. AWS WAF supplies the existing coarse `/api/auth` source-network layer. Because the trusted-source application limiter is pre-existing debt, production remains disabled until that layer is implemented and tested; local and controlled test enablement does not claim completion of onboarding REQ-025/REQ-080.

The code is a short-lived authenticator, not a session or authorization to change any other account property. No secret enters a URL. Successful recovery revokes application sessions and onboarding continuation before returning to login. CSRF/origin, brute force, enumeration, challenge replay, concurrent double submission, timing disclosure, session fixation, mass assignment, IDOR, cross-tenant mutation, log leakage, and provider error leakage are explicit test targets.

## Reliability and observability

Challenge creation and replacement are transactional; Resend is called afterward so an email outage cannot disclose account existence or corrupt the database transition. A new request after cooldown can replace an undelivered code. Reset plus credential/session/challenge/notification mutation is one serializable transaction with database predicates providing a single winner.

The password-changed notification uses the existing PostgreSQL lease/worker pattern so a provider outage does not undo a password reset. Bounded exponential retry, stable idempotency, expiring leases, restart recovery, sanitized provider identifiers, and terminal categories apply.

Emit privacy-safe counters for initiation accepted/suppressed, recovery email attempted/delivered/failed, reset rejected/succeeded/unavailable, sessions revoked, notification created/claimed/delivered/retried/terminal, and oldest pending notification. Alarm on unexpected reset failure, sustained email/notification terminal failure, and notification age above 15 minutes. No metric or log dimension may contain identifier digests, emails, names, codes, passwords, URLs with query data, source addresses, session data, provider bodies, or database payloads.

## Test strategy

- Drive strict Zod contracts and matching Yup examples through one behavior at a time; prove normalization, Unicode password rules, confirmation, code shape, closed responses, and unknown-field rejection.
- Drive the recovery module through its small request/reset interface using injected clock, code generator, digest, hasher, sender, and record adapter. Verify generic initiation, eligibility, normalized limit, cooldown, send suppression, exact failures, and reset success before adding the next behavior.
- Add PostgreSQL tests for known/unknown buckets, three-per-hour boundary and expiry, code replacement, 15-minute expiry, five failures, single use, concurrency, transactional password/session/continuation/challenge/notification mutation, rollback, and non-mutation of tenant/profile/role data.
- Test the reset and password-changed email renderers for every approved sentence, punctuation, Figma layout invariant, HTML escaping, absent-name fallback, plain-text equivalence, safe URL, no secret URL, Resend payload/idempotency, provider redaction, retry, lease recovery, and console redaction.
- Add React/API/App tests for login link, default/validation/requested/rejected/unavailable/submitting/success states, sessionStorage boundaries, closed navigation, and post-reset login confirmation. Add API-independent Storybook cookbook stories for the two screens.
- Add Playwright for eligible success, generic unknown initiation, invalid and exhausted code, resend/replacement, old/new password behavior, active-session revocation, native no-JavaScript flow, keyboard/accessibility, 320-pixel reflow, 200% zoom, and visual baselines.
- Run focused file/type/coverage/PostgreSQL checks while iterating. At completion run `pnpm verify`, the full PostgreSQL integration set, `pnpm test:e2e`, CDK tests/synth, specification review, repository-standards review, then commit and push.

## Rollout and rollback

Deploy the additive migration, disabled `PASSWORD_RECOVERY_ENABLED` configuration, worker code, WAF route coverage, metrics, and alarms before enabling routes. Validate Resend sender/domain, a controlled non-production reset email, exact HTML/plain text, generic unknown behavior, concurrent boundaries, session revocation, and production-equivalent Argon2 capacity. Complete the trusted-source application limiter before production enablement.

Rollback disables initiation/reset routes and notification claims, then restores the prior application artifact while leaving additive schema and evidence intact. It must not revert a completed password change, reactivate sessions, unconsume a challenge, remove lock/reset audit evidence, or retry a terminal notification without an approved corrected release.

## Open questions

- None. Approval accepts the six-digit code and 15-minute policy over the Figma frame's secret-link/60-minute wording; the corrected recovery-specific footer; `/forgot-password`, `/reset-password`, and `/login` as the only browser destinations; no automatic sign-in; the existing login visual language for screens; subject-limited controlled/test rollout now; and production enablement only after the pre-existing trusted-source application limiter is complete.
