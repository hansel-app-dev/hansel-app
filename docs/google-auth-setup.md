# Google authentication setup

## Local setup status (2026-09-16)

- Google Cloud project: `hansel-authentication` (Hansel Authentication).
- Organization: `nabinsingh.me`; project number: `877380012870`.
- Created using the approved selected My Maps Billing Account.
- OAuth branding saved: Hansel Local; support/contact: `hello@nabinsingh.me`; External audience in Testing mode. Google's API Services User Data Policy was accepted with user confirmation.
- Web OAuth client created: Hansel Localhost, client ID `877380012870-i4mseg7niu427bt940fb23r6rraq1m4j.apps.googleusercontent.com`.
- Credentials JSON downloaded outside the repository to the user's Downloads folder and restricted to owner read/write (0600). The secret is not recorded here or committed. No additional test users or IAM grants have been configured.
- Google-only application configuration is enabled in ignored, owner-only `.env.local`. Automated checks cover onboarding, returning login, browser binding, consent, disabled providers and PostgreSQL concurrency. A real Google account smoke test remains separate from these automated checks.
- Live initiation verified: localhost Login reaches Google's Hansel Local account chooser using the registered callback, `openid email profile`, state, nonce and S256 PKCE. Account selection/consent and a completed live callback still require user participation.

## Configured localhost client

The Web application OAuth client has origin `http://localhost:5173` and exact redirect URI `http://localhost:5173/auth/callback/google`. The existing API derives that callback from `ALLOWED_ORIGIN`. Use only `openid`, `email`, and `profile` scopes. Do not enable unrelated APIs or grant service-account access for sign-in.

Store `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` only in ignored local configuration or a secret manager. Never commit downloaded credentials, log the secret, or put it in frontend environment variables.

Set `EXTERNAL_AUTH_ENABLED=true`, `EXTERNAL_AUTH_PROVIDERS=google`, `ALLOWED_ORIGIN=http://localhost:5173`, and a random server-only `EXTERNAL_AUTH_TRANSACTION_KEY` of at least 32 characters. Restart the API after configuration changes. Microsoft and Apple credentials are not required when disabled. `/api/auth/providers` exposes names only; unavailable providers remain disabled in the UI. Without an explicit provider list the legacy all-provider configuration still applies.

Onboarding uses a same-origin native POST to `/auth/start/google`, recording current policy versions. Login uses `/auth/start/google?intent=login`. Both set a ten-minute HttpOnly transaction cookie, matched on callback before consuming one-time server state. Google onboarding creates a new account only for a verified usable email; otherwise the user is returned to ordinary email signup. Matching an existing account's email never links accounts. An unbound identity cannot create an account through Login: use onboarding first.

### Local smoke test

Automated verification (2026-09-16): backend and frontend type checks, lint, production builds, Storybook build, targeted browser checks and PostgreSQL login integration tests passed. Scoped unit coverage is 100% (lines, statements, branches and functions) for `config`, `external-login`, `openid-provider`, `prisma-external-login-store`, `ExternalProviderActions`, `Login` and `OnboardingStart`; this is not a repository-wide coverage claim. Repository-wide spec validation is still blocked by older allocation-card-hover, allocation-plan-sign-moving, plan-sign-delete-dialog and site-section-tabs-consistency specification formatting/section errors.

1. Start PostgreSQL, the API (3000), and web (5173). Open the exact localhost origin, not its IP alias.
2. Check `/api/auth/providers` returns only Google and disabled-provider routes return 404.
3. From onboarding, choose Google with an authorized test identity. Confirm Google redirects to the exact local callback and a new identity reaches the existing personal-profile step.
4. Sign in again through Login: an incomplete account resumes its current step; a completed eligible account opens Dashboard. Verify email/password login separately.
5. Cancel at Google and check the generic retry message. Replaying a callback or opening it in another browser must not grant access.

The Cloud project remains External/Testing. If Google requires a test-user entry, obtain approval before adding it; do not publish the audience to bypass this. No IAM grant is needed for end-user sign-in. Disable `EXTERNAL_AUTH_ENABLED` to roll back without removing account data.

## Callback troubleshooting

Callback troubleshooting: preserve Google's `iss` authorization-response parameter
when forwarding the callback to the OpenID client. Google's discovery metadata
requires this issuer value; dropping it causes `OAUTH_INVALID_RESPONSE` and a
`provider_unavailable` redirect. Keep the client's issuer validation enabled.
The native login page displays a generic retry message for provider failures.

Live localhost verification after this fix reached Hansel's account checks
(`authentication_failed`) instead of failing OpenID processing
(`provider_unavailable`). This is not a completed sign-in: login requires an
existing Google identity established through Google onboarding, and must not
silently link an existing email/password account.

## Adding production later

1. Confirm the production frontend origin and backend routing. Use HTTPS; do not guess the domain.
2. Prefer a separate production OAuth client, keeping localhost credentials isolated. Register the exact production origin and `https://<production-host>/auth/callback/google`; no wildcard callback URLs.
3. Set production `ALLOWED_ORIGIN` to that origin and supply the production client credentials and transaction key through the deployment secret manager. Current production code allows exactly `https://app.hanselapp.io`; any different domain needs a separately approved restriction change. Confirm the callback reaches the backend handler through the application's routing/proxy. Never reuse the localhost client in production.
4. Complete Google Auth Platform branding, authorized domains, support details, homepage, privacy policy and terms URLs as applicable. Verify domain ownership and complete any verification Google requires before changing the audience publishing status. Review current Google requirements at cutover.
5. Review Testing versus production audience settings and test-user access. Do not broaden scopes beyond basic sign-in without a separate approval.
6. Test new-user onboarding, returning login, cancellation, expired/replayed callbacks, session cookies, and existing-account linking protections. Do not silently link accounts solely by matching email.
7. Deploy configuration separately from secrets; confirm no localhost redirect is used by production. Keep the previous working client/configuration available for rollback, then retire unused credentials deliberately.

No production client, domain or redirect is configured by the current localhost setup.
