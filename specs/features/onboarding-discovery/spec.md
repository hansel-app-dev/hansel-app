# Feature: Onboarding discovery

- ID: `onboarding-discovery`
- Status: `implemented`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-08-29`
- Design authority: `Figma Hansel App UI, Onboarding frame 37:649`
- Design evidence: `Browser-inspected 2026-08-28; Figma structured connector was blocked by the Professional View-seat call limit`
- Product approval: `Acceptance criteria approved by user, 2026-08-28`

## Problem

After a new owner completes the organization profile, Hansel currently navigates to `/onboarding/discovery` without rendering the Figma discovery screen. The owner needs a brief, optional way to tell Hansel how the organization manages signage and what challenges the team faces, or skip the questions without delaying access to the organization dashboard.

This is the final onboarding transition. It must distinguish an intentional skip from submitted answers, preserve tenant isolation, complete the journey exactly once, and derive the dashboard destination on the server rather than trusting browser-supplied identifiers.

## Outcome and success metrics

- Organization-profile completion opens the Figma discovery screen at `/onboarding/discovery`.
- The owner can submit an approved signage-management method and optional challenges, or intentionally skip the entire step.
- One accepted submit or skip atomically records the outcome, completes onboarding once, and returns the server-owned organization-dashboard destination.
- Back navigation preserves the already accepted organization profile and returns safely to discovery without creating another organization or Owner membership.
- Frontend and backend retain 100% statement, branch, function, and line coverage.
- Contract, PostgreSQL integration, Storybook cookbook, accessibility, deterministic visual-regression, and Playwright E2E checks pass.

## Non-goals

- Building the dashboard, dashboard widgets, sites, signage import, document upload, analytics, recommendations, or follow-up questionnaires.
- Accepting arbitrary management-method identifiers beyond the approved values.
- Requiring discovery answers before dashboard access.
- Changing the accepted plan, payment state, organization ownership, membership role, or tenant authorization.
- Sending discovery answers to an analytics, CRM, email, AI, or other third-party service.
- Adding a new reusable design-system primitive when the existing `SelectField`, `TextField`, and `Button` interfaces are sufficient.

## Requirements

- REQ-001: Figma frame `37:649` MUST be the visual authority. The 1728×1117 desktop composition MUST show the exported Hansel logo at the upper left, the exact heading `Could you tell us more?`, a narrow form ordered `How do you manage your signage currently?` and `Biggest challenges your team faces`, a `Back` action at the lower left, and `Next` followed by `Skip for now` at the lower right. The challenges placeholder MUST be `Challenges`. The implementation MUST reuse Hansel tokens, `SelectField`, `TextField`, `Button`, typography, and spacing rather than introducing a parallel visual system.
- REQ-002: The management-method select MUST use exactly the stable identifiers `pdf`, `spreadsheet`, and `other`, displayed as `PDF`, `Spreadsheet`, and `Other`. Its unselected placeholder MUST be `Select`. Display labels MUST never be persisted as identifiers.
- REQ-003: Selecting `other` MUST reveal a text field labelled `Other tools`. That value MUST contain 1–100 Unicode characters after trimming and NFC normalization. The field MUST be absent from the accepted payload for `pdf` and `spreadsheet`, and changing away from `other` MUST clear its value and stale validation error.
- REQ-004: An answer submitted with `Next` MUST include one approved management-method identifier. `Biggest challenges your team faces` MUST remain optional and MUST accept at most 1,000 Unicode characters after trimming and NFC normalization. Empty optional challenges MUST be persisted as null, not an empty or whitespace-only string. Invalid or overlong input MUST not modify discovery or journey state.
- REQ-005: `Skip for now` MUST skip the entire discovery step without requiring or submitting any visible field value. The server MUST persist an explicit `skipped` outcome with null answer fields, distinct from a `submitted` outcome whose optional challenges are empty. A skip MUST never fabricate a management method, Other value, or challenge.
- REQ-006: `GET /api/onboarding/discovery` MUST derive the user, new-organization journey, tenant, and protected Owner membership from a valid, unexpired continuation credential at `DISCOVERY`. It MUST return the approved management-method catalog and a short-lived, cryptographically random, server-issued submission key. It MUST not accept caller-supplied user, email, journey, tenant, membership, role, plan, price, or destination identifiers.
- REQ-007: `POST /api/onboarding/discovery` MUST accept a strict discriminated request: either `submit` with the approved answer fields and submission key, or `skip` with only the submission key. JSON requests MUST require the credential-bound CSRF header and exact same-origin checks. Native forms MUST require the credential-bound CSRF cookie and same-origin checks. Missing, expired, malformed, replay-incompatible, wrong-path, wrong-step, forged, or unauthorized requests MUST return stable generic errors without disclosing account, organization, membership, plan, or subscription state.
- REQ-008: One accepted submit or skip MUST atomically create exactly one discovery response for the journey, record `submitted` or `skipped`, advance the journey from `DISCOVERY` to `COMPLETE`, set its completion time once, consume the submission key, and finalize or rotate continuation security according to the approved session policy. It MUST not create or modify a tenant, membership, role, site, invitation, plan selection, subscription, or payment.
- REQ-009: Repeating an accepted request with the same valid submission key and canonical payload MUST return the original successful dashboard outcome without creating or changing state again. Reusing that key with a different action or answer payload MUST be rejected as a conflict. Raw submission keys, continuation credentials, and CSRF proofs MUST never be stored; only keyed non-reversible digests may be persisted.
- REQ-010: An accepted response MUST be exactly a server-owned completion result containing `nextStep: dashboard` and the relative destination `/dashboard`. The browser MUST navigate only to the parsed response destination and MUST not construct a destination from a tenant, organization, membership, or caller-controlled value. The progressive form response MUST use a `303` redirect to the same approved destination.
- REQ-011: The screen MUST work without JavaScript through server-rendered HTML and ordinary HTTPS form submissions. `Next`, `Skip for now`, and `Back` MUST be distinct successful controls in that path. JavaScript MAY progressively enhance conditional fields, validation, pending states, focus, and navigation, but MUST NOT be the sole mechanism for completion or recovery.
- REQ-012: `Back` MUST return to `/onboarding/organization-profile` without deleting the accepted organization, Owner membership, plan selection, or discovery progress. Before onboarding completion, organization profile MUST load its saved values for the same authorized journey and permit a safe correction using a fresh submission key; the accepted correction MUST update only the five organization-profile values and return to discovery without creating another tenant or membership. Browser Back and direct navigation MUST remain server-authorized and tenant-scoped.
- REQ-013: Recoverable load, validation, correction, submit, skip, replay, and transition failures MUST retain all safe non-secret form values, expose field-specific validation where safe, provide a concise page-level message for server failures, and never expose database, credential, or provider details. If the onboarding continuation is absent, expired, invalid, or incompatible, the JavaScript client MUST clear the local onboarding state and replace navigation with `/onboarding` rather than leaving a dead discovery screen.
- REQ-014: The discovery response MUST belong to the onboarding journey rather than directly trusting a user or tenant identifier. It MUST retain the approved submitted or skipped outcome until the organization is deleted or an authorized organization administrator removes the answers under the parent retention policy. Application logs, metrics, URLs, browser storage, and analytics MUST never contain the free-text Other or challenges values.
- REQ-015: The page MUST have API-independent Storybook cookbook stories for normal, Other selected, validation error, submitting/disabled, load failure, server failure, and narrow states. Existing design-system modules MUST be reused. No new design-system story is required unless implementation introduces a genuinely reusable public module.
- REQ-016: The page MUST meet WCAG 2.2 AA, associate labels and errors with controls, announce load and submission failures, move focus predictably to the first invalid field or page-level error, support keyboard-only use, preserve a logical heading and form order, and reflow without horizontal page scrolling at 320 CSS pixels and 200% zoom. Revealing or hiding `Other tools` MUST not trap or unexpectedly move focus.
- REQ-017: Frontend and backend unit suites MUST retain 100% statement, branch, function, and line coverage. Contract tests MUST cover every strict submit/skip request and response variant. PostgreSQL tests MUST prove atomic completion, rollback, tenant isolation, one concurrent winner, idempotent equivalent retry, conflicting retry rejection, explicit skip persistence, and null normalization. Playwright MUST cover the Figma layout, conditional Other field, validation, Back with saved organization values, Next, Skip, refresh, session expiry, keyboard operation, 320-pixel reflow, deterministic screenshots, and a real no-JavaScript Express/PostgreSQL completion.
- REQ-018: Structured events MUST record discovery page load, validation rejection, transition rejection, submitted completion, skipped completion, idempotent replay, conflict, and unexpected failure using correlation ID and non-sensitive stable outcome fields. Logs and metrics MUST never include answers, submission keys, credentials, CSRF values, cookies, organization names, or headers. Alerting MUST cover sustained unexpected completion failures.
- REQ-019: Deployment MUST apply the additive discovery migration before enabling the route. Production rollout MUST be server-flag-controlled and fail closed if the migration or approved catalog is unavailable. Rollback MUST disable the route while preserving every accepted discovery response and completed journey.

## Acceptance scenarios

### AC-001 — Organization profile continues to the Figma discovery page [REQ-001, REQ-002, REQ-006]

- Given a verified new owner has accepted an organization profile and the journey is at `DISCOVERY`
- When `/onboarding/discovery` loads
- Then the exact Figma heading, field wording, order, placeholders, logo, Back, Next, and Skip actions are shown
- And the management-method options are PDF, Spreadsheet, and Other backed by their approved stable identifiers

### AC-002 — Approved answers complete onboarding [REQ-002, REQ-003, REQ-004, REQ-007, REQ-008, REQ-010]

- Given the journey is authorized at `DISCOVERY`
- When the owner submits PDF or Spreadsheet and optional valid challenges
- Then one submitted discovery response and one journey completion commit atomically
- And the server returns the approved `/dashboard` destination

### AC-003 — Other requires its matching explanation [REQ-003, REQ-004]

- Given the owner selects Other
- When the matching value is empty, whitespace-only, or longer than 100 characters
- Then client and server reject the submission without modifying state
- And when the owner selects another method, the hidden Other value and error are cleared and omitted

### AC-004 — Skip is explicit and does not fabricate answers [REQ-005, REQ-007, REQ-008, REQ-010]

- Given the discovery form is empty or contains unsaved values
- When the owner activates `Skip for now`
- Then the server records `skipped` with every answer field null, completes onboarding once, and returns `/dashboard`
- And the skip remains distinguishable from a submitted response with empty optional challenges

### AC-005 — Replay and concurrency cannot duplicate completion [REQ-008, REQ-009]

- Given an accepted submit or skip is retried or submitted concurrently
- When requests use the same server-issued submission key
- Then exactly one transaction completes the journey and equivalent retries receive the original dashboard outcome
- And a changed action or payload is rejected without mutation

### AC-006 — Back safely restores organization details [REQ-011, REQ-012]

- Given the owner is on discovery before completion
- When they activate Back
- Then the organization-profile screen loads the accepted five values for the same authorized journey
- And a correction updates that organization and returns to discovery without creating another tenant or Owner membership

### AC-007 — Invalid or expired state fails closed [REQ-004, REQ-006, REQ-007, REQ-013]

- Given invalid text, an unknown method, missing security proof, stale submission key, wrong path or step, forged identity, or expired continuation
- When the page loads or a transition is attempted
- Then the server rejects the request without discovery or completion mutation and without disclosing private state
- And an expired browser session returns to `/onboarding`

### AC-008 — Progressive, accessible, and observable use is preserved [REQ-011, REQ-014, REQ-015, REQ-016, REQ-017, REQ-018]

- Given JavaScript is disabled, the viewport is 320 pixels wide, text is zoomed, or the person uses only a keyboard or assistive technology
- When they answer, correct, go Back, submit, or skip
- Then every transition remains understandable and functional without horizontal page scrolling
- And safe events identify outcomes without exposing the answers or credentials

## UX and accessibility

The desktop layout follows Figma frame `37:649`: the Hansel mark is at the upper left; a narrow form is visually centered in the canvas; the heading is `Could you tell us more?`; the select and challenges field appear in the exact Figma order; Back sits at the lower left; and Next followed by Skip for now sits at the lower right. The Figma editor, comments, collaborator cursors, frame outline, and Dashboard annotation are design-workspace metadata and are not application UI.

`Other tools` appears immediately after the select only while Other is selected. The additional field uses existing field spacing and must not cause the fixed desktop action row to overlap content. On narrow screens, the form and actions become one logical column after the fields. The visual order and keyboard order must agree; Skip must not be styled as a destructive action.

The structured Figma connector could not return context because the Professional View seat had reached its tool-call limit. The exact frame was therefore inspected in the signed-in browser. Before implementation is considered complete, deterministic comparison MUST use frame `37:649`; if structured context becomes available, its exact measurements and exported assets MUST replace any browser-derived approximation.

## API and integrations

The OpenAPI 3.1 contract will define:

- `GET /onboarding/discovery` for the private progressive HTML page;
- `GET /api/onboarding/discovery` for the approved method catalog and server-issued submission key;
- `POST /api/onboarding/discovery` for strict JSON and `application/x-www-form-urlencoded` submit or skip requests;
- a successful result containing only `nextStep: dashboard` and the server-owned `/dashboard` destination;
- a `303` redirect to `/dashboard` for the progressive form after accepted submit or skip.

The feature calls no Stripe, email, Figma, analytics, CRM, AI, storage, upload, or enrichment service. Figma is a design-time authority only.

## Data and migration

Add one discovery response per onboarding journey with a unique journey relation, an outcome enum or constrained identifier (`submitted` or `skipped`), nullable stable management-method identifier, nullable normalized Other value, nullable normalized challenges value, completion timestamp, and ordinary audit timestamps. Skipped rows require all answer columns to be null; submitted rows require one approved method, require Other text only for `other`, and prohibit Other text otherwise. Enforce these invariants in application validation and database constraints where Prisma/PostgreSQL can express them safely.

Add a submission record or equivalent fields that support one short-lived keyed submission-key digest, a canonical keyed request digest, the recorded dashboard outcome, consumption timestamp, and idempotent replay without retaining a raw key. The accepted transaction writes the response, marks the journey complete once, consumes the submission key, and finalizes continuation security.

The migration is additive. No backfill is required because discovery completion is not implemented. Rollback must preserve accepted discovery and completion data.

## Security and privacy

Identity, journey, tenant, protected Owner membership, accepted plan/payment state, and dashboard destination are server-derived. The request cannot select any of them. The server authorizes the new-organization path at `DISCOVERY`, validates CSRF and origin, normalizes untrusted text, and rejects cross-tenant or wrong-step access.

Other tools and challenges are private organization discovery data. They must not enter logs, metrics, tracing attributes, URLs, browser storage, error tracking payloads, or external services. Private responses use `Cache-Control: private, no-store`. Raw continuation, CSRF, and submission credentials are never persisted or exposed to JavaScript when their cookie policy marks them HttpOnly.

## Reliability and observability

Discovery persistence, explicit outcome, journey completion, submission consumption, and continuation finalization occur in one PostgreSQL transaction. Database uniqueness and compare-and-swap enforce one winner. Equivalent retries return the recorded result; conflicts and unexpected failures preserve pre-transition state.

Emit structured events and CloudWatch metrics for page load, validation rejection, transition rejection, submitted completion, skipped completion, replay, conflict, and unexpected failure. Only correlation ID and approved categorical outcome fields may be attached. Alert on sustained unexpected completion failures.

## Test strategy

- Validate the three stable method values, exact display labels, strict submit/skip union, trimming/NFC rules, conditional Other boundary, challenge boundary, null normalization, and exact completion response.
- Use vertical TDD slices through the public discovery module: load catalog, submit PDF/Spreadsheet, reveal and validate Other, skip, complete atomically, replay idempotently, reject conflict, and recover from failure.
- Add PostgreSQL tests for accepted submit and skip, rollback, wrong path/step, tenant isolation, concurrent single winner, same-payload replay, changed-payload conflict, check constraints, and completion time written once.
- Extend organization-profile tests for authorized pre-completion Back, saved-value load, safe correction, and no duplicate tenant or Owner membership.
- Add API-independent Storybook stories for normal, Other selected, validation, submitting, failure, and narrow discovery states, with axe and deterministic screenshots.
- Add Playwright E2E for organization profile to discovery, exact Figma wording/layout, conditional Other, Back with restored organization data, Next, Skip, refresh, expired session, keyboard operation, 320-pixel reflow, and real no-JavaScript Express/PostgreSQL completion.
- Run focused changed-package suites while iterating, then the complete repository verification gate before commit and push.

## Rollout and rollback

Apply the additive migration, deploy with discovery disabled, validate the catalog, progressive route, constraints, and alarms in non-production, then enable for internal/test tenants. Production enablement requires the same checks and successful synthetic submit/skip journeys. Rollback disables the route and restores the previous artifact while preserving accepted discovery responses and completed journeys.

## Open questions

- None. Approval of this specification authorizes only the behavior listed above.

## Implementation evidence

- Implemented and verified on `2026-08-29` after product approval.
- `pnpm verify` passed: specification validation, formatting, lint, TypeScript, 100% statement/branch/function/line coverage for contracts, frontend, and backend, production builds, Storybook build, and all 29 accessibility/visual-regression checks.
- PostgreSQL discovery and organization-correction integration suites passed against PostgreSQL 16 after applying migration `20260828140000_onboarding_discovery`: 7 tests passed.
- `pnpm test:e2e` passed: all 17 Chromium E2E tests, including conditional Other, Back with restored organization data, explicit skip, server-owned dashboard completion, 320-pixel reflow, and real no-JavaScript Express/PostgreSQL completion.
- AWS CDK assertions passed for the production-disabled discovery rollout flag, CloudFront progressive route, CloudWatch failure metric, and sustained-failure alarm.
- The structured Figma connector remained unavailable due its Professional View-seat limit; deterministic screenshots were compared with the browser-inspected Figma frame `37:649` and committed as the approved regression baseline.
