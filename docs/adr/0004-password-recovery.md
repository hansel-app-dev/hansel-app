# ADR 0004: Password recovery authority and delivery

- Status: Accepted
- Date: 2026-08-31
- Spec: `password-recovery`

## Context

Hansel manages passwords and sessions. Recovery therefore needs to replace a password without disclosing account existence, placing secrets in URLs, leaving existing sessions active, or coupling a completed security change to email-provider availability. The approved Figma email depicts a reset link, while the existing security policy requires a six-digit code that expires after 15 minutes.

## Decision

Use a server-generated six-digit code delivered only to a verified primary email for an account with a Hansel password. Store only keyed digests, allow five failures, expire codes after 15 minutes, and make challenge consumption plus password replacement, lock clearing, session/onboarding revocation, and notification-intent creation one serializable PostgreSQL transaction. Recovery initiation always returns a generic outcome and uses a keyed normalized-identifier limiter. Retain its privacy-preserving evidence for 30 days.

Keep codes, email addresses, and passwords out of URLs, logs, metrics, provider idempotency keys, and browser persistence. The email button opens the trusted reset page without a secret. Resend sends recovery and post-change email; the durable post-change notification is claimed outside the reset transaction with leases and bounded retries. Successful reset returns to ordinary login and creates no session.

## Threat model and mitigations

- Account enumeration: identical initiation and reset failure classes, bounded work, and no eligibility detail.
- Brute force and replay: cryptographic code generation, keyed digests, five failures, 15-minute expiry, replacement consumption, subject limiting, WAF coverage, and a single transactional winner.
- CSRF and mass assignment: trusted-origin enforcement and strict closed Zod/OpenAPI requests, including exact native-form confirmation.
- Session theft or fixation: revoke all session families and onboarding continuations; do not issue a session after reset.
- Cross-tenant mutation: derive the user from the verified challenge and mutate no tenant, membership, role, organization, profile, or billing records.
- Provider ambiguity: generic initiation, stable non-secret idempotency keys, durable post-change notification, sanitized failure categories, and no rollback of a completed reset.
- Secret leakage and cache reuse: private no-store responses with safe Vary, no secret URL or storage, escaped email content, and privacy-safe operational dimensions.

## Consequences

Users enter a code rather than following the Figma frame's secret link. Recovery remains available for locked password accounts but not provider-only or unverified accounts. PostgreSQL becomes the concurrency and abuse-limit authority. Production enablement remains gated on migration, Resend, WAF/application limiting, alarms, and production-equivalent tests.

## Rollback

Disable `PASSWORD_RECOVERY_ENABLED` and notification claims, then deploy the previous artifact. Preserve additive tables and evidence. Never reverse a completed password change, reactivate revoked sessions, unconsume challenges, or discard pending notification evidence.
