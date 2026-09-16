# Microsoft login and onboarding

Implements `microsoft-local-auth`. This is a localhost integration, not a production rollout.

## Local registration

- Entra app: **Hansel Localhost**; supported account types: personal Microsoft accounts and accounts in any organizational directory.
- Authority: `https://login.microsoftonline.com/common/v2.0`.
- Confidential **Web** redirect: `http://localhost:5173/auth/callback/microsoft`.
- Authorization code + S256 PKCE; scopes are only `openid profile email`. Do not enable implicit grants or request Graph/offline access or organization-wide admin consent.
- Keep credentials in ignored, mode-0600 `.env.local`, never frontend/VITE variables. Set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` (the value, not secret ID), and `MICROSOFT_TENANT_ID=common`.
- Set `EXTERNAL_AUTH_ENABLED=true` and `EXTERNAL_AUTH_PROVIDERS=google,microsoft` only after migrations and relevant automated checks. Restart the API after environment changes.
- The development secret expires **2027-03-15**. Before expiry, create a replacement in the same registration, update the private backend configuration, restart, verify sign-in, then revoke the old secret. Never paste values into issue trackers, screenshots, logs, or commits.

## Identity and email verification

Microsoft issuer and subject identify the User; email is only an editable suggestion. New signup first requires policy consent, then a browser-bound 30-minute pending credential. A six-digit Hansel code proves mailbox ownership: 15-minute code expiry, five failed attempts, 60-second resend cooldown, five sends per normalized mailbox per rolling hour. Resend replaces the old code and cannot extend pending expiry. Delivery failure never creates an account.

Completion atomically creates the verified User, Microsoft identity, consent and personal-profile journey without a password. Returning Users resume onboarding or their eligible dashboard. Existing email/password or Google accounts are not linked: use the original sign-in method. An unbound Microsoft login does not create an account; choose Create an account first.

Pending records are removed hourly, with startup cleanup, even when the provider is disabled. Digest-only send evidence is retained for the one-hour limiter window. Keep the API running or schedule database expiry cleanup independently; never delete identity records during rollback.

The additive migration intentionally stops if pre-existing Microsoft identities exist. Review their issuer/subject ownership explicitly; do not guess or automatically reassign them. This localhost database had none before migration.

## Smoke tests

1. Confirm `/api/auth/providers` advertises Google and Microsoft; Apple remains disabled.
2. New signup: accept current policies, choose Microsoft, verify the email explicitly, and reach personal profile. Try changing email, resend, expired and wrong codes, and duplicate submissions.
3. Existing bound identity: sign in again and resume without another email code.
4. Existing-email collision: confirm generic guidance and no account linking.
5. Test a personal account and a work/school account separately. Tenant consent policy or an unverified publisher may block an organizational account; record this, do not bypass tenant policy or grant admin consent.
6. Verify Google and password login remain available.

Automated signed-token tests exercise the real OpenID library for both account audiences, bad signature, issuer/tenant mismatch, audience, nonce, state and expiration. PostgreSQL integration tests exercise single-use completion, collisions and concurrent verification. Automated coverage is not proof that both live account audiences succeeded.

## Verification record — 2026-09-17

- New Microsoft backend tests: 25 passing; new email-screen tests: 12 passing. Each new production module reached 100% statement, branch, function and line coverage in targeted runs.
- Related backend regression tests: 71 passing. API/web typechecks, builds, changed-source lint and Storybook build passed.
- Live personal-account consent and callback succeeded. The existing password account was correctly rejected as an unbound Microsoft login, without linking it. Full new-account signup and live work/school sign-in have not been completed.
- Removed the registration's unused default Graph `User.Read` permission; only OIDC scopes are requested at runtime.
- Full suites retain baseline failures reproduced against the pre-change commit: one API dashboard-session test and eleven web tests (ten App routing fixtures and one allocation relative-date fixture). Specification validation also reports pre-existing errors in allocation-card-hover, allocation-plan-sign-moving, plan-sign-delete-dialog and site-section-tabs-consistency; none concern this feature.
- Run database tests against a dedicated migrated schema, not the interactive development schema: `TEST_DATABASE_URL=postgresql://hansel:hansel@localhost:5433/hansel?schema=microsoft_auth_test`. Expiry tests advance the cleanup clock.

## Production URL cutover (later)

Create a separate reviewed production registration and client secret. Confirm the real HTTPS origin, exact `/auth/callback/microsoft` callback and both account audiences. Configure backend secrets in Secrets Manager, verified sender/domain, publisher and tenant consent requirements, bounded requests, trusted source metadata, existing WAF authentication-route limits and monitoring. Confirm the new `/api/auth/microsoft/*` routes remain covered by those controls. Run migrations, identity compatibility review, both-account live smoke tests and rollback checks before enabling. Never add a guessed production URL or reuse this localhost secret. Staging/production HTTP remains prohibited.

Rollback: remove `microsoft` from the enabled provider list and restart, preserving existing Users, identities and other sign-in methods. Keep expiry cleanup running for pending signup data.
