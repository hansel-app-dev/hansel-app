# Feature: Google login and onboarding on localhost

- ID: `google-local-auth`
- Status: draft
- Owner: Hansel product
- Technical owner: Hansel engineering
- Last updated: 2026-09-16
- Domain references: `CONTEXT.md` — User, Organization, Membership, Organization Role; `docs/domain/figjam-object-catalog.md` — Objects and data points (User, Organization), Organization roles and permissions, Known ambiguities 2, 3, 10. Provider identity does not grant Organization access.

## Problem

Google OAuth credentials are provisioned, but external authentication configuration requires all providers and the callback implements login only. Google must work for both returning users and new-user onboarding.

## Outcome and success metrics

Local users can complete Google onboarding and subsequently log in with the same immutable Google identity. Existing email/password authentication remains functional. Automated tests cover successful and rejected flows; a live localhost smoke test is recorded separately from automated results.

## Non-goals

No production deployment, Microsoft/Apple provisioning, downstream Google API access, account linking/unlinking UI, or automatic merging by email. Do not bypass current onboarding steps, policy consent, Membership eligibility or billing rules.

## Requirements

- REQ-001: Allow Google to be configured independently behind the existing external-auth master flag, with an explicit server-side enabled-provider list. Validate required credentials only for enabled providers; reject partial configuration and unknown providers. Disabled-provider initiation/callback fails safely without constructing adapters or requiring their secrets. UI and progressive forms must not present disabled providers as usable; preserve their current placement as disabled controls. Default external authentication remains off.
- REQ-002: Existing bound Google identities use the established login/session flow. Incomplete journeys resume at their server-authoritative step. Unbound login identities fail generically with the ordinary onboarding link; login never silently creates a User.
- REQ-003: Onboarding initiation captures the approved server-owned terms/privacy versions and explicit user action consent in the one-time authorization transaction. A validated new Google identity atomically creates one User, external identity, consent record and onboarding journey, issuing only the appropriate short-lived onboarding continuation. Repeated/racing callbacks cannot duplicate records. Existing bound identities resume their established eligible journey/session without duplicate Users or Organizations.
- REQ-004: Key identity by provider plus immutable subject, never email. A provider email matching another account must fail generically without signing in, linking, merging or creating a duplicate conflicting account. Linking remains deferred. An explicitly verified usable provider email may skip Hansel email verification; missing or unverified email must use the existing usable-email/verification requirement before progressing, not be treated as verified. Optional profile names are editable suggestions only.
- REQ-005: Preserve authorization-code, issuer, audience, signature/algorithm, expiry, state, nonce, exact redirect and PKCE checks. Bind initiation/callback to the initiating browser with a short-lived HttpOnly transaction cookie in addition to one-time server state; reject absent/mismatched browser binding, expired, tampered, replayed or wrong-intent transactions. Discard provider tokens; never persist or log them. Cancellation/outage has a safe retry path and no partial identity/session creation.
- REQ-006: Permit the explicit development-only Google origin `http://localhost:5173` and callback `http://localhost:5173/auth/callback/google`. Keep production/staging HTTPS and exact callback restrictions. Use the provisioned Hansel Localhost client only locally; load its credentials from ignored server-only local configuration. Never expose secrets through public capability responses, frontend variables, logs, tests or Git. Keep Google scopes `openid email profile`, without offline access.
- REQ-007: Enable and verify local configuration only after automated checks. Keep email/password working. Document provider availability, local setup, safe secret handling, test-user requirements, and production client/domain/secret-manager cutover in `docs/google-auth-setup.md`. Do not change Google audience publishing or grant IAM access as part of application implementation.

## Acceptance scenarios

### AC-001 — Google-only configuration [REQ-001, REQ-006]

Given only valid Google credentials and an enabled Google provider, when the API starts, then it starts without Microsoft/Apple secrets, advertises only Google availability and rejects other provider routes safely. Missing Google credentials fail configuration validation.

### AC-002 — New user [REQ-003, REQ-004]

Given a new Google identity and accepted current policy versions, when a valid browser-bound onboarding callback completes, then exactly one identity and journey exist, a verified usable email advances to the existing profile step, and no completed application access is granted early.

### AC-003 — Returning user [REQ-002, REQ-004]

Given an existing bound identity, when Google login succeeds, then the existing eligible dashboard or onboarding destination is used without duplicates. An unbound or email-conflicting identity receives a generic rejection without account linking.

### AC-004 — Security and failure [REQ-004, REQ-005]

Given an invalid, expired, replayed, cancelled, wrong-browser or mismatched callback, when it is processed, then no unauthorized session or partial User is created, no sensitive details leak, and the user can retry safely. Unverified email never bypasses verification.

### AC-005 — Local release [REQ-006, REQ-007]

Given the localhost environment, when the documented smoke test runs, then Google onboarding and returning login use the exact local callback and email/password still works. Production configuration cannot use the localhost client/origin exception.

## UX and accessibility

Reuse approved login/onboarding layouts and Google branding. Preserve keyboard focus, accessible pending/error announcements, consent copy and links. Add enabled/disabled/pending/failure provider states to existing Storybook stories. Support progressive native forms as required by the existing authentication specifications.

## API and integrations

Reuse `/auth/start/google` and `/auth/callback/google`, existing intent validation, session/continuation cookies and closed destination enums. Expose a public enabled-provider capability list without private configuration if needed by React; document its strict response in OpenAPI. Use the existing OpenID adapter rather than a second authentication system.

## Data and migration

Reuse ExternalIdentity and ExternalAuthorizationTransaction, approved consent and onboarding records. If consent/version or browser-binding fields are absent, add backward-compatible fields/indexes and reject legacy transactions missing required validation evidence. Preserve existing identities, password credentials and session records. Enforce uniqueness and atomicity in PostgreSQL, not only in memory.

## Security and privacy

Existing `user-login` and `onboarding` security requirements remain authoritative. This amendment explicitly supersedes the all-providers-at-once activation requirement and HTTPS-only development registration for this Google localhost client only. The user approved development project ownership under `nabinsingh.me`; production ownership and registrations remain subject to the existing Hansel policy. No Organization permissions are inferred from Google claims. Retain rate limits, private/no-store responses, CSRF defenses and privacy-safe categorical logging.

## Reliability and observability

Preserve existing external-auth success/rejection/dependency-failure events without identifiers or tokens. Bound provider requests and return generic dependency failures. Atomic database operations prevent partially completed onboarding. Record live verification blockers truthfully rather than claiming untested Google success.

## Test strategy

Write failing configuration, provider capability, callback-intent and browser-binding tests first. Cover mocked OpenID boundaries, cookie/routes, strict contracts, consent, verified/unverified claims, uniqueness/concurrency, account collisions, login/resume and replay in PostgreSQL integration tests. Browser tests cover both entry points, disabled providers, cancellation and accessible errors. Run relevant lint/types/build/tests and document any pre-existing failures. Live Google testing uses only an explicitly authorized test account; report if user interaction is needed.

## Rollout and rollback

Commit and push this specification separately for approval before test-first application changes. Apply additive migrations locally, store downloaded credentials in ignored configuration, enable Google locally and restart affected services. Do not deploy production. Roll back by disabling external authentication or Google initiation, retaining existing users and data. Commit/push verified implementation to main with no credentials.

## Open questions

None for implementation scope. Live test-account interaction may require user participation; it is not permission to modify existing real accounts.
