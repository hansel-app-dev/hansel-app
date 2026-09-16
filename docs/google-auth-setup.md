# Google authentication setup

## Local setup status (2026-09-16)

- Google Cloud project: `hansel-authentication` (Hansel Authentication).
- Organization: `nabinsingh.me`; project number: `877380012870`.
- Created using the approved selected My Maps Billing Account.
- OAuth branding draft: Hansel Local; support/contact: `hello@nabinsingh.me`; External audience in Testing mode.
- Setup is pending explicit acceptance of Google's API Services User Data Policy. No OAuth client or secret has been created yet.

## Intended localhost client

Create a Web application OAuth client with origin `http://localhost:5173` and exact redirect URI `http://localhost:5173/auth/callback/google`. The existing API derives that callback from `ALLOWED_ORIGIN`. Use only `openid`, `email`, and `profile` scopes. Do not enable unrelated APIs or grant service-account access for sign-in.

Store `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` only in ignored local configuration or a secret manager. Never commit downloaded credentials, log the secret, or put it in frontend environment variables. The existing `EXTERNAL_AUTH_ENABLED` configuration currently requires Google, Microsoft and Apple together; Google-only configuration must be implemented and tested before enabling it. This document does not mean sign-in is ready.

## Adding production later

1. Confirm the production frontend origin and backend routing. Use HTTPS; do not guess the domain.
2. Prefer a separate production OAuth client, keeping localhost credentials isolated. Register the exact production origin and `https://<production-host>/auth/callback/google`; no wildcard callback URLs.
3. Set production `ALLOWED_ORIGIN` to that origin and supply the production client credentials through the deployment secret manager. Confirm the callback reaches the backend handler through the application's routing/proxy.
4. Complete Google Auth Platform branding, authorized domains, support details, homepage, privacy policy and terms URLs as applicable. Verify domain ownership and complete any verification Google requires before changing the audience publishing status. Review current Google requirements at cutover.
5. Review Testing versus production audience settings and test-user access. Do not broaden scopes beyond basic sign-in without a separate approval.
6. Test new-user onboarding, returning login, cancellation, expired/replayed callbacks, session cookies, and existing-account linking protections. Do not silently link accounts solely by matching email.
7. Deploy configuration separately from secrets; confirm no localhost redirect is used by production. Keep the previous working client/configuration available for rollback, then retire unused credentials deliberately.

No production client, domain or redirect is configured by the current localhost setup.
