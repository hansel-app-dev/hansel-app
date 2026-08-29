# Feature: Onboarding welcome email

- ID: `onboarding-welcome-email`
- Status: `implemented`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-08-29`
- Design authority: `Figma Hansel App UI, Emails frame 131:549 (Welcome)`
- Design evidence: `Browser-inspected 2026-08-29; Figma structured connector was blocked by the Professional View-seat call limit`
- Product approval: `Approved by user on 2026-08-29`
- Technical review: `Independent specification and repository-standards reviews completed on 2026-08-29 with no remaining code or specification findings; protected releases still require the repository's GitHub CODEOWNERS approval`

## Implementation evidence

- `pnpm verify` passed, including specification validation, formatting, linting, type checking, production builds, 100% frontend/backend/contracts unit coverage, Storybook build, and 31 design-system checks.
- Eight focused PostgreSQL Welcome/discovery integration tests and all 19 onboarding-to-dashboard E2E tests passed.
- The production API container built successfully, contained the Prisma migration runner and approved Hansel logo asset, and executed `prisma migrate deploy` successfully against PostgreSQL.
- AWS CDK synthesis and infrastructure tests passed, including the migration-before-traffic bootstrap path.
- Independent specification and repository-standards reviews completed with no remaining actionable implementation findings.

## Problem

Hansel completes a new-organization onboarding journey and opens the authenticated dashboard, but it does not acknowledge that completion outside the browser. The new Owner needs one transactional Welcome email confirming that the account and organization are ready and pointing back to Hansel.

The final onboarding request is idempotent and commits critical account, organization, and application-session state in PostgreSQL. Email delivery through Resend is an external side effect, so it must not run inside that transaction, roll back a completed journey, delay dashboard access, or produce duplicate Welcome messages when a completion request or delivery attempt is retried.

## Outcome and success metrics

- Every newly completed `NEW_ORGANIZATION` journey creates one durable Welcome-email delivery intent in the same transaction as onboarding completion.
- The existing application service sends the Figma-approved transactional email through Resend without blocking the completed Owner from reaching `/dashboard`.
- Successful delivery is recorded once; transient failures retry safely; duplicate completion requests and concurrent workers do not create duplicate logical deliveries.
- The rendered HTML and plain-text alternatives use the approved first name and exact Figma wording.
- Frontend, backend, and contracts retain 100% statement, branch, function, and line coverage, and the focused PostgreSQL and email-rendering checks pass.

## Non-goals

- Implementing a login screen, password-login endpoint, password recovery, session changes, or a new dashboard state.
- Sending Welcome email before the new-organization journey reaches `COMPLETE`, or sending it for incomplete, rejected, Enterprise-pending, invitation, or site-invitation journeys.
- Sending marketing campaigns, adding recipients to a Resend audience, collecting marketing consent, or adding unsubscribe behavior to this transactional message.
- Inventing a product-tour video, media URL, poster image, tracking pixel, or analytics event not present in the approved product behavior.
- Introducing SQS, Lambda, Step Functions, EventBridge, or a separate worker deployment for this single message; the existing multi-task ECS service and PostgreSQL lease are sufficient for the first release.
- Changing the existing verification-email design or delivery policy.
- Creating a new frontend component; this feature produces an email document rather than application UI, so it adds no Storybook component obligation.

## Requirements

- REQ-001: A successful first transition of a `NEW_ORGANIZATION` onboarding journey from `DISCOVERY` to `COMPLETE` MUST atomically create exactly one durable `ONBOARDING_WELCOME` email-delivery intent for that journey. An idempotent completion replay, conflicting replay, rejected transition, rolled-back transaction, incomplete journey, Enterprise activation boundary, invitation path, or site-invitation path MUST NOT create another intent.
- REQ-002: The delivery intent MUST identify the server-derived onboarding journey and user without accepting a recipient, user, tenant, organization, membership, role, name, template, subject, or destination from the browser. A database uniqueness constraint on journey and message kind MUST enforce one logical Welcome delivery under concurrency.
- REQ-003: Journey completion, discovery persistence, application-session creation, and Welcome-delivery intent creation MUST commit in one PostgreSQL transaction. Resend MUST NOT be called from inside that transaction. Failure to persist the delivery intent MUST roll back that first completion transaction; a Resend outage or delivery failure after commit MUST NOT roll back completion, revoke the new application session, alter the successful response, or prevent navigation to `/dashboard`.
- REQ-004: A background dispatcher in the existing API/ECS process MUST claim pending intents with an atomic, expiring PostgreSQL lease, derive the current primary email and accepted personal-profile first name for the same user, and call Resend outside the claim transaction. Multiple ECS tasks and concurrent polling MUST yield one active claimant. A missing or deleted user/profile, invalid destination, permanent provider rejection, or exhausted delivery policy MUST be recorded as a terminal safe failure without sending to a substituted recipient.
- REQ-005: Resend requests MUST use the existing `RESEND_API_KEY` and `RESEND_FROM_EMAIL` configuration and a stable provider idempotency key derived from the non-secret message kind and delivery-intent UUID. The key MUST be reused for every retry of the same payload and MUST never contain an email address, name, tenant name, credential, or other personal or secret value. The dispatcher MUST record the Resend message identifier after success. Because Resend retains idempotency keys for 24 hours, an unresolved ambiguous provider result MUST stop automated retries before that window expires and require safe operator review rather than risk a later duplicate.
- REQ-006: Transient network, rate-limit, and provider failures MUST use bounded exponential backoff with jitter and a maximum of five automated attempts within 23 hours. Provider retry guidance MAY increase the delay. Permanent validation or authorization failures MUST not be retried automatically. A claimed intent whose worker terminates MUST become eligible after its lease expires. The dispatcher MUST resume pending eligible work after process restart.
- REQ-007: Figma frame `131:549` (`Welcome`) MUST be the visual and copy authority. The HTML email MUST use an 800-pixel maximum-width off-white `#F7F5EB` canvas with 64-pixel top and bottom padding, a centered white content card, 32-pixel content rhythm, the orange Hansel wordmark with Beta badge, the personalized heading `Welcome {firstName}!`, the approved body and bullets, the large gray play-panel shown in the frame, the closing line, orange `Log in` button, and centered Hansel footer. The play-panel MUST remain a non-interactive, decorative placeholder in this release because no approved media asset or destination exists; it MUST have no false link or accessible claim that a video is available.
- REQ-008: Visible HTML copy MUST be exactly: `Welcome {firstName}!`; `You're in! Thanks for completing your setup — your account and organization are ready to go.`; `Here's what you can do next:`; `Start managing your signage`; `Invite your team or collaborators`; `Explore to get the most value right away`; `We're excited to have you with us.`; `Log in`; `Hansel`; and `This email was sent by Hansel App as a result of your account creation.` Curly punctuation and capitalization MUST match the design. The subject MUST be `Welcome to Hansel`.
- REQ-009: The `Log in` button MUST use an absolute HTTPS URL formed only from the trusted production application origin and the server-owned `/dashboard` path. In local/test environments, the configured HTTP loopback application origin MAY be used. The recipient, journey, tenant, organization, or session MUST never appear in the URL. Existing dashboard authentication behavior remains authoritative when the link is opened without a valid session.
- REQ-010: The first name MUST come from the accepted `PersonalProfile`, be trimmed and normalized under the existing profile policy, and be escaped for its HTML context. It MUST not be accepted from the completion request, placed in an email header, URL, log, metric, trace attribute, provider idempotency key, or error. The plain-text alternative MUST contain semantically equivalent approved copy, bullets, the absolute dashboard URL, footer, and personalization without HTML syntax.
- REQ-011: The email MUST use email-client-compatible table layout and inline styles, remain readable without images, at narrow widths, in light or dark client environments, and at 200% zoom, and preserve meaningful document order. The heading MUST be a real heading, bullets MUST be semantic list content where supported, the button MUST remain an ordinary HTTPS link, and color contrast MUST meet WCAG 2.2 AA. Decorative logo treatment, Beta badge, and play-panel icon MUST not produce confusing alternative text.
- REQ-012: No remote font, executable script, form, credential, cookie, attachment, hidden tracking pixel, third-party analytics beacon, or user-controlled raw HTML may appear in the email. Email clients MAY fall back from Figtree to approved system sans-serif fonts. Resend receives only the minimum transactional fields required to deliver the message.
- REQ-013: Console delivery mode MUST remain available for local/test use and MUST emit a privacy-safe structured event that identifies the Welcome template and delivery-intent ID without printing the recipient, first name, full HTML/text body, session data, or provider credentials. Production MUST fail closed at startup when Resend configuration is absent or invalid, as governed by the platform configuration policy.
- REQ-014: Structured events and CloudWatch metrics MUST record intent creation, claim, delivered, transient failure, terminal failure, lease recovery, and retry exhaustion using correlation ID plus non-sensitive categorical fields. Logs, traces, alarms, and metrics MUST not contain email addresses, names, organization data, template bodies, provider responses, URLs with query data, API keys, application credentials, cookies, or raw database payloads. Alerting MUST cover sustained terminal failure or retry exhaustion and an oldest-pending age above 15 minutes.
- REQ-015: Delivery-intent records MUST retain message kind, journey relation, status, attempt count, next-attempt time, lease expiry, provider message identifier, delivered time, terminal-failure category, and ordinary audit timestamps. They MUST not duplicate the recipient or first name. Provider identifiers and failure categories MUST be bounded and sanitized. Records follow the parent account/journey retention policy and are deleted on account deletion unless a stricter legal audit policy is approved later.
- REQ-016: The additive database migration and dispatcher MUST be production-disabled behind a server-side Welcome-email flag until the schema, Resend domain, sender address, secrets, alarms, and non-production delivery checks pass. Disabling the flag MUST stop new intent creation and claims without deleting pending or delivered records. Rollback MUST preserve onboarding, sessions, delivery evidence, and retry state.
- REQ-017: Backend unit coverage MUST retain 100% statement, branch, function, and line coverage. Tests MUST prove exact HTML/text copy and subject, HTML escaping, trusted absolute URL construction, the Figma layout invariants, console behavior, Resend payload and idempotency options, error classification, bounded retry timing, lease recovery, graceful start/stop, and log redaction. PostgreSQL tests MUST prove transactional intent creation and rollback, unique creation under completion replay/concurrency, one worker claim, restart recovery, tenant/user derivation, and delivered/terminal state transitions. Existing onboarding-to-dashboard and E2E journeys MUST remain green; no browser E2E or Storybook story is required solely to test an external email client.

## Acceptance scenarios

### AC-001 — First completion queues one Welcome email [REQ-001, REQ-002, REQ-003]

- Given an authorized new Owner has a valid discovery submission and the journey is at `DISCOVERY`
- When the first completion transaction succeeds
- Then discovery, journey completion, application session, and one `ONBOARDING_WELCOME` delivery intent commit together
- And the response still sends the Owner to `/dashboard` without waiting for Resend

### AC-002 — Replay and concurrency cannot create another logical delivery [REQ-001, REQ-002, REQ-005]

- Given that completion has already been accepted or equivalent requests race
- When completion or delivery is retried
- Then the database contains one Welcome intent for the journey
- And every Resend attempt for that intent uses the same non-personal idempotency key and unchanged payload

### AC-003 — The Figma Welcome message is rendered safely [REQ-007, REQ-008, REQ-009, REQ-010, REQ-011, REQ-012]

- Given the accepted personal profile has first name `Ava`
- When the Welcome email is rendered
- Then its subject is `Welcome to Hansel`, its heading is `Welcome Ava!`, and all approved Figma copy, order, styling boundaries, button, decorative play-panel, and footer are present
- And the equivalent plain-text part includes the trusted dashboard URL while neither version contains executable, tracking, credential, or unescaped user-controlled content

### AC-004 — Resend failure never strands the completed Owner [REQ-003, REQ-004, REQ-006]

- Given onboarding completion and the Welcome intent have committed
- When Resend is unavailable, rate-limits, rejects permanently, or a worker terminates while holding a claim
- Then the Owner retains the application session and dashboard result
- And the intent is retried safely, recovered after lease expiry, or marked terminal according to the bounded policy without silently changing recipients

### AC-005 — Concurrent ECS tasks send through one claimant [REQ-004, REQ-005, REQ-006]

- Given two or more API tasks poll the same eligible intent
- When they attempt to claim and dispatch it concurrently
- Then one task owns the active lease and the others do not send
- And success records one sanitized provider identifier and delivered timestamp

### AC-006 — Operations can detect failure without seeing personal data [REQ-013, REQ-014, REQ-015]

- Given delivery succeeds, retries, exhausts retries, or terminates permanently
- When operational events, metrics, traces, and alarms are emitted
- Then operators can identify the template, state, attempt category, and age using non-sensitive identifiers
- And no recipient, first name, organization data, message body, credential, API key, cookie, or raw provider response is present

### AC-007 — Safe rollout and rollback preserve accepted work [REQ-016]

- Given the additive migration is deployed before the feature is enabled
- When the feature is enabled, disabled, or rolled back
- Then intent creation and dispatch follow the server-side flag
- And accepted onboarding, application sessions, pending intents, and delivery evidence are preserved

## UX and accessibility

The browser-inspected Figma `Welcome` frame is an 800-pixel-wide, 1,061.05-pixel-high off-white composition using `#F7F5EB`, 64-pixel outer vertical padding, a white inner panel, and 32-pixel rhythm. The orange Hansel Beta mark leads the card. The personalized heading, confirmation paragraph, next-actions heading and three bullets, gray play-panel, closing line, and orange `Log in` button follow in that order. A muted Hansel mark and account-creation notice form the centered footer.

The Figma connector could not provide structured subnode values or exported assets because the Professional View seat had reached its tool-call limit. The frame was inspected in the signed-in browser instead. Implementation MUST use the existing approved Hansel wordmark treatment and browser-observed values; if structured Figma context becomes available before completion, its exact measurements and exportable assets replace browser-derived approximations without changing the approved copy or behavior.

The gray play-panel is preserved to match the approved frame but is decorative in this release. It is not focusable or announced as a playable video, because no content or destination was supplied. Activating the `Log in` link opens the trusted dashboard entry; ordinary browser authentication and redirect behavior applies.

## API and integrations

No public browser API or contract is added. The existing accepted `POST /api/onboarding/discovery` response remains unchanged and does not expose email-delivery state.

The private delivery boundary has one operation: send the `ONBOARDING_WELCOME` template to the server-derived primary email with the accepted first name, trusted dashboard URL, and stable delivery-intent idempotency key. Resend's Node.js SDK supports an `idempotencyKey` option for email sends; Resend retains a key for 24 hours, so Hansel's bounded retry window ends before that provider guarantee expires. See the official Resend Send Email and Idempotency Keys documentation.

The Resend API key and sender remain in environment-backed AWS Secrets Manager/ECS secret injection under the existing platform policy. Figma is a design-time authority only and is never called at runtime.

## Data and migration

Add an email-delivery-intent model with a UUID identifier, message-kind enum, unique journey/message-kind ownership, status enum, attempt count, next-attempt time, lease owner/expiry, bounded provider message identifier, bounded terminal-failure category, delivered time, and timestamps. Relate it to the onboarding journey or user with the same deletion and retention boundary; do not store a second copy of the destination or first name.

The first accepted completion transaction creates the intent alongside discovery completion and the application session. The dispatcher claims eligible records with database compare-and-swap or row locking and an expiring lease, reads recipient and profile data server-side, sends outside the transaction, and records success or the next bounded retry in a second transaction. A unique constraint supplies the final concurrency guard.

The migration is additive and requires no backfill: already completed journeys do not receive a retroactive Welcome email because the user requested sending after future onboarding completion, and bulk historical mail has separate product, consent, support, and deliverability implications.

## Security and privacy

The recipient, first name, journey, and dashboard destination are server-derived. The email is transactional account communication, not marketing. Only the recipient, sender, subject, HTML, plain text, and non-personal idempotency key are sent to Resend. The renderer context-escapes the accepted first name and never interprets it as HTML.

No credential or tenant identifier appears in the button URL. The email cannot authenticate a user, confer membership, or reveal organization details. Opening `/dashboard` remains subject to the existing Hansel-managed application-session authorization and unauthenticated redirect behavior.

Operational records contain delivery mechanics rather than duplicated message PII. IAM keeps the ECS task at least privilege for the existing Resend secret, database access remains private to the VPC service boundary, and CloudWatch receives only approved redacted categories.

## Reliability and observability

The database outbox separates the atomic onboarding state change from the external provider call. The API responds from committed application state; the dispatcher provides durable retry with a short lease and database-enforced single claimant across ECS tasks. Resend's stable idempotency key suppresses provider duplicates throughout the bounded automated retry window.

The delivery target is 99% of eligible intents delivered or terminally classified within 15 minutes, excluding a declared Resend outage. Emit counters for created, claimed, delivered, transient failure, terminal failure, exhausted, and lease recovered, plus pending-age and attempt-count distributions. Alarm on terminal/exhausted results and oldest pending age above 15 minutes. Provider bodies and personal data are never observability dimensions.

## Test strategy

- Drive the email renderer test-first for exact subject, every Figma sentence and bullet, punctuation, heading personalization, footer, table/inline-style constraints, decorative panel semantics, narrow compatibility, plain-text equivalence, and hostile first-name escaping.
- Drive the Resend adapter test-first for the exact recipient/payload, stable SDK `idempotencyKey` option, sanitized success identifier, transient/permanent/ambiguous error classification, and provider-detail redaction.
- Drive the dispatcher as a deep module through a fake clock and sender: claim, success, exponential retry with deterministic jitter injection, five-attempt exhaustion before 24 hours, permanent failure, expired-lease recovery, multiple-worker exclusion, missing data, start, graceful stop, and console mode.
- Add PostgreSQL integration tests for atomic completion plus intent, rollback when intent persistence fails, idempotent completion replay, concurrent completion, unique journey/kind enforcement, one worker claim, retry persistence, restart recovery, delivered state, terminal state, and tenant/user/profile derivation.
- Retain the exact existing discovery response/cookies and all onboarding-to-dashboard E2E behavior. Run focused API/template/PostgreSQL checks while iterating, then the complete `pnpm verify`, PostgreSQL integration suites, `pnpm test:e2e`, and CDK synth before commit and push.

## Rollout and rollback

Deploy the additive migration first with Welcome email disabled. Validate Resend domain and sender configuration, secret injection, a real non-production delivery to a controlled inbox, HTML/plain-text rendering, multi-task leasing, metrics, and alarms. Enable intent creation and dispatch for internal/test journeys before staged production enablement.

Rollback disables new intent creation and dispatcher claims, then restores the previous application artifact while leaving schema and records in place. It must never undo completed onboarding or revoke application sessions. Pending records may be resumed only after the corrected release is deployed and approved.

## Open questions

- None. Approval of this draft accepts `Welcome to Hansel` as the subject, `/dashboard` as the trusted `Log in` destination, the Figma play-panel as decorative until a real media asset and URL receive their own approval, non-retroactive delivery, and the PostgreSQL/ECS dispatcher design above.
