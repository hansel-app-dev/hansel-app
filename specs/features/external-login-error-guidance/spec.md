# Feature: Actionable external login error guidance

- ID: `external-login-error-guidance`
- Status: `draft`
- Owner: Hansel product
- Technical owner: Hansel engineering
- Last updated: 2026-09-16
- Domain references: `CONTEXT.md` — User; `docs/domain/figjam-object-catalog.md` — Objects and data points (User), Known ambiguities 3 and 10. Authentication behavior is governed by `google-local-auth`, not inferred from board labels.

## Problem

The external callback's `authentication_failed` message tells users to check their details even when they need their original sign-in method. It provides no explanation of the current account-linking limitation.

## Outcome and success metrics

Both native and React login pages present identical actionable guidance after an external authentication rejection, without revealing account existence. Automated tests assert the copy and unchanged password-login failure behavior.

## Non-goals

Account linking, automatic merging, new authentication outcomes, account creation during login, changes to provider validation or password-login errors.

## Requirements

- REQ-001: For the existing external callback `authentication_failed` query value, show: “We couldn't sign you in with this provider. Use the sign-in method you used to create your account. If you signed up with email and password, use those details below—linking Google to an existing account isn't supported yet. New to Hansel? Choose Create an account.” Apply identical copy in native and React login.
- REQ-002: Preserve the visible email/password form, Forgot password link, provider retry controls and Create an account link. Present the guidance in the existing accessible error alert; allow wrapping without clipping on small screens.
- REQ-003: Show the same guidance for all existing external `authentication_failed` outcomes. Do not claim that the supplied email exists, that a particular identity is linked/unlinked, or that a specific cause was proven. Do not render arbitrary query text. Keep password submission errors and `provider_unavailable` copy unchanged.

## Acceptance scenarios

### AC-001 — External rejection [REQ-001, REQ-002]

Given either login renderer, when loaded with `error=authentication_failed`, then the exact guidance appears in an alert alongside the existing recovery controls.

### AC-002 — Privacy and other failures [REQ-003]

Given an unknown error query, a provider outage, or a rejected password submission, when rendered, then arbitrary query text is not echoed and existing non-callback error behavior is preserved. No account-specific detail is exposed.

## UX and accessibility

Reuse the current error alert and layout. Add or update the external authentication failure Storybook state. Check wrapping at mobile and desktop widths and keyboard access to recovery links.

## API and integrations

No route, callback result, redirect, HTTP status or OpenAPI schema changes.

## Data and migration

No persistence changes or migrations.

## Security and privacy

Preserve the generic rejection required by `google-local-auth` REQ-002 and REQ-004. This is conditional guidance, not account enumeration. Never show provider payloads, tokens, email addresses or internal errors.

## Reliability and observability

No new network dependencies or logging. Existing authentication outcome logging remains unchanged.

## Test strategy

Test-first native route and React rendering assertions for exact copy and safe unknown-query handling; retain password/outage regressions. Verify the Storybook failure state, relevant lint/types/tests, and the running native login page.

## Rollout and rollback

Commit and push this specification separately for approval. After approval, implement and verify the UI-only change, commit and push to main, and verify the remote commit. Roll back the implementation commit if guidance or layout regresses; authentication policy remains unchanged.

## Open questions

None.
