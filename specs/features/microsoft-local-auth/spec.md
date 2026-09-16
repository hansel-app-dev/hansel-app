# Feature: Microsoft login and onboarding on localhost

- ID: `microsoft-local-auth`
- Status: `approved`
- Approval: User explicitly approved this specification on 2026-09-16.
- Owner: Hansel product
- Technical owner: Hansel engineering
- Last updated: 2026-09-16
- Domain references: `CONTEXT.md` — User, Organization, Membership; `docs/domain/figjam-object-catalog.md` — Objects and data points (User, Organization), Known ambiguities 2, 3, 10. Microsoft directory membership does not grant Hansel Organization access.
- Confirmed scope: Personal Microsoft and work/school accounts, login and onboarding, localhost only. User approved one-time Hansel email verification preserving the Microsoft identity and creation of a new Entra app registration.

## Problem

Microsoft has an existing adapter and disabled UI controls but localhost configuration currently allows only Google. Microsoft email claims cannot be treated as verified contact addresses, and the existing fallback to email/password signup loses the external identity.

## Outcome and success metrics

Both Microsoft account audiences can create a new Hansel identity after explicit policy consent and Hansel email verification, then return using Microsoft without repeating email verification. Automated security and persistence tests cover both audiences; live checks are recorded separately with any account or tenant-policy blockers.

## Non-goals

Production deployment, Microsoft Graph access, offline access, directory synchronization, tenant-admin permission grants, automatic linking/merging with existing accounts, and changes to Google onboarding's approved email fallback.

## Requirements

- REQ-001: Enable Microsoft independently through existing external-provider configuration. Accept personal and work/school accounts using the Microsoft public-cloud v2 common authority and an app registration supporting both audiences. Keep Google and email/password working and unconfigured providers disabled. Missing or malformed enabled-provider configuration fails safely.
- REQ-002: Permit only the explicit development origin `http://localhost:5173` and exact callback `http://localhost:5173/auth/callback/microsoft` for this localhost exception. Retain production/staging HTTPS restrictions. Register a confidential Web application with authorization-code flow, S256 PKCE, and only `openid profile email` scopes. No implicit flow, Graph permissions, or offline access.
- REQ-003: Validate Microsoft signature, allowed algorithm, audience, expiry, nonce, state, browser binding and redirect. Validate the tenant-specific issuer against Microsoft's trusted metadata and the token's validated tenant ID, including the personal-account tenant. Never disable issuer validation or fetch an arbitrary token-supplied host. Identify Users by provider and immutable issuer/subject identity, not email, preferred username, display name or directory role. Preserve any existing Microsoft identity records without silently reassigning ownership.
- REQ-004: Require explicit current policy consent through same-origin onboarding initiation. On a valid callback for a new Microsoft identity, issue only a browser-bound, purpose-limited pending signup credential with a 30-minute absolute lifetime. Store its digest and minimum validated identity/consent data server-side; do not create a usable account, application session or Organization yet. Existing bound identities follow the established eligible login or onboarding-resumption flow instead.
- REQ-005: Present a contact-email form after Microsoft signup. A syntactically valid Microsoft email claim may be an editable suggestion, never proof of ownership; missing email leaves an empty required field. Explain: “Confirm your email to finish signing up with Microsoft. You only need to do this once.” No password is required. After explicit submission, send a Hansel verification code using the existing email-validation and delivery infrastructure. Preserve the pending Microsoft identity throughout this flow rather than redirecting to ordinary email/password signup.
- REQ-006: Use six-digit random verification codes, 15-minute expiry, five failed attempts, single-use digest storage, 60-second resend delay and five sends per normalized email per rolling hour, with existing layered abuse controls. Bind challenges to the pending signup and chosen email. Changing email or resending invalidates earlier challenges; neither extends the pending signup's absolute expiry. Verification requires the browser-bound pending credential, and cannot be completed with an ordinary onboarding code from another flow.
- REQ-007: On successful verification, atomically create exactly one User with verified contact email, Microsoft identity, consent record and onboarding journey, consume pending credentials/challenges, and issue the existing restricted continuation to personal profile. Database uniqueness and transactional handling prevent duplicate or conflicting identities under concurrency. No password credential is created. Later Microsoft login resumes the existing journey or eligible dashboard without another email code.
- REQ-008: Existing-email or identity collisions never overwrite credentials, bind to another account, reset a journey or merge Users. Reject safely with the same actionable sign-in guidance, without revealing which account exists. Unbound login never silently creates a User. Expired pending signup offers restarting Microsoft signup; invalid codes support retry/resend under the above limits. Verification delivery failure must not advance the journey.
- REQ-009: Replace generic external `authentication_failed` copy in both native and React login with: “We couldn't sign you in with this provider. Use the sign-in method you used to create your account. If you signed up with email and password, use those details below—linking Google or Microsoft to an existing account isn't supported yet. New to Hansel? Choose Create an account.” Preserve recovery links, password errors and provider-outage messages. Do not echo arbitrary query strings or provider errors. This incorporates and supersedes the pending `external-login-error-guidance` draft upon approval.
- REQ-010: Create a new localhost-only Entra registration in a user-confirmed directory. Do not guess its owner, create a paid subscription, change tenant security policy, or grant organization-wide consent. Store credentials only in ignored server-side configuration or a secret manager, never Git, browser frontend configuration, logs or responses. Record expiry and rotation instructions without the secret. Stop for user sign-in, required security confirmations, or insufficient tenant permissions.
- REQ-011: Document local setup, account-audience settings, verification flow, limitations, smoke tests and a future production cutover checklist. Production requires a separate reviewed HTTPS registration/configuration; no production URL is added now. Keep Microsoft disabled until configuration is valid and automated checks pass.

## Acceptance scenarios

### AC-001 — Audiences and configuration [REQ-001, REQ-002, REQ-003]

Given either personal or work/school Microsoft credentials, when a valid localhost authorization flow completes, then the appropriate issuer is validated and the provider is usable. Forged issuer/tenant, wrong audience, invalid signature, expired token, nonce/state mismatch, replay and wrong-browser callbacks grant no access.

### AC-002 — New Microsoft signup [REQ-004, REQ-005, REQ-006, REQ-007]

Given a new identity and accepted policies, when the user supplies and verifies a contact email, then one Microsoft-bound User and journey are created and personal-profile onboarding opens without a password. A provider email claim alone never skips verification. Missing email still permits entering one.

### AC-003 — Recovery and concurrency [REQ-006, REQ-007, REQ-008]

Given pending signup, when a code is wrong, expired, exhausted, superseded or replayed, then it cannot create an account. Resend/email changes invalidate prior codes. Concurrent completion creates at most one identity; an existing email never gains a new Microsoft binding. Expired pending signup requires restarting Microsoft authentication.

### AC-004 — Returning user and errors [REQ-007, REQ-008, REQ-009]

Given a verified bound identity, when Microsoft login succeeds, then the established authorized destination opens without email verification. Given an unbound identity or collision, then safe actionable guidance appears in both renderers with recovery controls and no account-specific disclosures.

### AC-005 — Release and regression [REQ-001, REQ-010, REQ-011]

Given valid local configuration, when automated and authorized live smoke tests run, then both Microsoft audiences are covered or their live blockers are explicitly recorded; Google and password flows remain functional. No production registration or secret is committed.

## UX and accessibility

Reuse existing Microsoft branding, onboarding layouts and verification controls. Support native form submission and React progressive enhancement. Provide labels, keyboard focus, accessible pending/error announcements, masked verification destination and responsive wrapping. Add new email-confirmation, verification and error states to Storybook. Keep Microsoft account selection and tenant consent within Microsoft's UI.

## API and integrations

Reuse `/auth/start/microsoft`, `/auth/callback/microsoft` and provider-capability endpoints. Add purpose-specific native/API endpoints for pending Microsoft email collection, send/resend and verify, with strict request contracts, same-origin/CSRF defenses, private/no-store responses and closed server-selected destinations. Update OpenAPI before implementing these endpoints. Microsoft authentication uses a maintained standards library with tenant-aware validation, not custom cryptographic verification.

## Data and migration

Add an additive pending-signup model and purpose-scoped verification storage where existing models cannot enforce these constraints. Persist only validated issuer/subject identity, consent versions/time, contact email as needed, digest credentials, expiry and abuse counters. No provider tokens are retained. Purge expired pending signup/challenges within 24 hours; retain required audit events under existing policy. Do not mutate unrelated Users. Any incompatible pre-existing Microsoft identity data blocks migration for explicit review rather than guessed relinking.

## Security and privacy

This specification extends the localhost exception and introduces Microsoft-specific contact verification; Google's approved fallback remains unchanged. Follow existing login/session, policy-consent, email-verification and Organization authorization rules. Mailbox proof plus validated Microsoft authentication authorizes only creation of a new identity, not takeover of an existing email/password or Google account. Bound challenges and atomic consumption prevent cross-flow identity substitution. Log categorical outcomes only, with no codes, tokens, credential values or identifying claims.

## Reliability and observability

Use bounded provider requests and the existing verification delivery/retry mechanism. Handle dependency outages without partial authenticated state. Record privacy-safe start, rejection, verification, completion and dependency-failure categories. Expiry cleanup and send/attempt throttles operate durably under concurrency.

## Test strategy

Test-first configuration, real validation seams for tenant-aware tokens, routes/browser binding, consent, pending-signup expiry, mailbox proof, collision/replay/concurrency and database uniqueness. Include PostgreSQL integration tests, native and React form/error tests, Storybook states and browser journeys. Run relevant lint, types, builds, coverage and migrations. Live tests require user-authorized personal and work/school accounts; mocks alone do not establish live success.

## Rollout and rollback

Commit/push this draft separately and obtain explicit approval before application changes. Confirm the Entra directory during provisioning. Apply additive migrations locally, configure secrets privately, run checks and enable Microsoft locally. Document a distinct production checklist (HTTPS redirects, separate app/client, secrets, consent/publisher requirements, rotation and smoke tests). Commit/push verified implementation directly to main and verify the remote. Roll back by disabling Microsoft while preserving account data and Google/password access.

## Open questions

No unresolved behavior choices. Entra directory ownership and live test-account availability must be confirmed during provisioning; lack of access is a reported setup blocker, not permission to expand privileges.

## References

- Microsoft ID token claims: https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference
- Microsoft OpenID Connect: https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc
- Existing specifications: `google-local-auth`, `user-login`, `onboarding`, and the draft `external-login-error-guidance`.
