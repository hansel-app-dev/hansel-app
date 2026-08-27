# Feature: Onboarding plan selection

- ID: `onboarding-plan-selection`
- Status: `implemented`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-08-27`
- Product decision: `No trials; Free is limited to one site, 2026-08-27`
- Product approval: `Acceptance criteria approved by user, 2026-08-27`
- Implementation evidence: `Full verification, PostgreSQL integration, Playwright E2E, and independent specification/standards reviews passed, 2026-08-27`
- Design authority: `Figma Hansel App UI, Onboarding frame 52:608`

## Problem

After completing the personal-profile step, a new organization owner needs to choose a Hansel plan. The approved Figma composition contains Plus, Pro, Enterprise, monthly and annual billing controls, and an `Or try it for free` action, but its descriptions are placeholders and its prices do not fully express the approved server-authoritative commercial rules.

Hansel needs a plan-selection step that preserves the Figma composition while preventing the browser from inventing plan identifiers, prices, billing intervals, payment requirements, or entitlements. Earlier onboarding decisions that applied a three-month trial to Plus and Pro are superseded: no plan has a trial, and Free is a distinct zero-price plan limited to one site.

## Outcome and success metrics

- A verified new owner can choose Free, Plus, Pro, or the Enterprise contact-sales path from the Figma-derived screen.
- Free bypasses payment and is persistently limited to one site.
- Plus and Pro proceed to payment with no trial; Enterprise proceeds to the configured sales-contact action.
- All visible catalog data comes from one version-controlled, schema-validated JSON catalog.
- The server derives the user and current onboarding step from a rotated continuation credential and rejects forged or stale transitions.
- Frontend and backend retain 100% statement, branch, function, and line coverage.
- Unit, contract, PostgreSQL integration, accessibility, deterministic visual-regression, Storybook cookbook, and Playwright E2E checks pass.

## Non-goals

- Implementing Stripe Checkout, webhook reconciliation, invoices, taxes, refunds, dunning, disputes, cancellation, payment-method management, or subscription lifecycle behavior. Those begin in the payment specification.
- Defining production prices or real Plus, Pro, Enterprise, or Free feature entitlements beyond Free's one-site maximum.
- Allowing an invitation onboarding path to select a plan.
- Implementing plan upgrades, downgrades, proration, coupons, promotions, regional currencies, or seat-based pricing.
- Treating Figma placeholder descriptions or feature bullets as real entitlements.
- Creating an organization or site during plan selection.

## Requirements

- REQ-001: Figma frame `52:608` MUST be the visual authority. The screen MUST display the exported Hansel logo, the exact heading `Welcome {first name}, choose your plan`, a Monthly/Annual segmented control with Annual initially selected, `Save 35%`, Plus, Pro, and Enterprise cards, an underlined `Or try it for free` action, and Back navigation. `{first name}` MUST come from the authenticated server-side personal profile and MUST be escaped as text.
- REQ-002: One version-controlled, schema-validated JSON catalog MUST define stable plan and price identifiers, display order, display name, clearly marked dummy description and feature copy, currency, billing interval, amount in minor units, monthly-equivalent display amount, additional-site amount, payment requirement, maximum sites when bounded, active state, contact-sales behavior, and environment-specific Stripe Price lookup key. React components MUST NOT embed catalog values.
- REQ-003: The approved non-production catalog MUST contain `free`, `plus_monthly`, `plus_annual`, `pro_monthly`, `pro_annual`, and `enterprise`. Free MUST cost zero USD, require no payment, have no expiry, and set `maximumSites` to `1`. Plus monthly MUST be USD 50 per month; Plus annual MUST be USD 390 per year and display USD 32.50 per month equivalent. Pro monthly MUST be USD 150 per month; Pro annual MUST be USD 1,170 per year and display USD 97.50 per month equivalent. Annual Plus and Pro MUST display the approved 35% dummy saving. Paid plans MAY display the approved USD 15 monthly additional-site dummy amount. Enterprise MUST use custom pricing and contact sales.
- REQ-004: Free, Plus, Pro, and Enterprise MUST have no trial. The catalog and API MUST NOT expose a trial duration, trial eligibility, trial end, or trial activation action. `Or try it for free` MUST select the distinct Free plan; it MUST NOT start a Plus, Pro, or Enterprise trial.
- REQ-005: Monthly and Annual MUST change only the visible Plus and Pro price variants. The selected interval MUST remain visible and keyboard operable, and Annual MUST be the initial selection on first render as shown in Figma. Enterprise and Free behavior MUST NOT vary by billing interval.
- REQ-006: Choosing Plus or Pro MUST submit only the selected stable price identifier to the server. The server MUST validate that the identifier is active and self-service, persist the server-resolved selection, atomically advance the onboarding journey from `PLAN_SELECTION` to `PAYMENT`, rotate the continuation credential and CSRF proof, and return `payment`. It MUST NOT create a Stripe Customer, Checkout Session, subscription, invoice, or charge in this feature.
- REQ-007: Choosing Free MUST submit only the stable `free` identifier. The server MUST persist the one-site maximum with the selection, atomically advance the journey from `PLAN_SELECTION` to `ORGANIZATION_PROFILE`, rotate the continuation credential and CSRF proof, and return `organization-profile` without invoking Stripe.
- REQ-008: Choosing Enterprise MUST persist the `enterprise` selection and return a server-configured HTTPS contact-sales destination. The destination MUST not be caller supplied. Enterprise MUST not create a payment or trial, and the journey MUST remain resumable from `PLAN_SELECTION` until a separately approved sales-assisted transition occurs.
- REQ-009: The plan-selection endpoint MUST derive the user from a valid, unexpired, single-use-compatible onboarding continuation credential. It MUST reject missing, expired, malformed, replay-incompatible, invitation-path, or wrong-step credentials without accepting a caller-supplied user, email, amount, currency, interval, maximum-sites value, Stripe identifier, or destination URL.
- REQ-010: The personal-profile transition into `PLAN_SELECTION` MUST rotate rather than discard the onboarding continuation credential and its credential-bound CSRF proof. Each accepted plan-selection transition MUST rotate the credential again; only keyed non-reversible credential digests may be stored.
- REQ-011: JSON requests MUST require the credential-bound CSRF header and same-origin checks. Native form submissions MUST use the credential-bound CSRF cookie and same-origin checks. Responses containing the person's first name or onboarding state MUST use private, no-store cache controls.
- REQ-012: The screen MUST work without JavaScript through server-rendered HTML forms and redirects. A recoverable validation or transition failure MUST retain the selected billing interval and plan choice without exposing internal identifiers or provider errors.
- REQ-013: Back MUST return to `/onboarding/about-you` without deleting an already accepted personal profile or weakening server-authoritative journey order. Resuming the plan step MUST read the current server selection and journey state rather than trusting browser storage.
- REQ-014: Free's one-site maximum MUST be stored as an immutable selection snapshot and enforced by every later site-creation authorization path. No other Free entitlement may be inferred by this feature.
- REQ-015: The page and every new reusable component MUST have API-independent Storybook cookbook stories for normal, selected, error, disabled, monthly, annual, Free, and Enterprise/contact states as applicable. Components MUST reuse the existing Hansel tokens, Button, and link treatment.
- REQ-016: The implementation MUST meet WCAG 2.2 AA, preserve logical heading and card structure, expose the billing control and current selection accessibly, support keyboard-only operation, reflow at 200% zoom and a 320-pixel viewport, and never rely on color alone for selection or saving information.
- REQ-017: Frontend and backend unit suites MUST retain 100% statement, branch, function, and line coverage. Contract tests MUST validate every catalog record and server response; PostgreSQL tests MUST prove atomic transition, rollback, and a single winner under concurrent submission; Playwright MUST cover paid, Free, Enterprise, Back, no-JavaScript, accessibility, and deterministic visual states.
- REQ-018: Dummy catalog data and Stripe test lookup keys MUST be rejected by production deployment validation. Production enablement requires a separately approved commercial catalog and Stripe configuration.

## Acceptance scenarios

### AC-001 — Figma-derived catalog is rendered safely [REQ-001, REQ-002, REQ-003, REQ-005]

- Given a verified new owner has completed their personal profile
- When the server renders `/onboarding/plan-selection`
- Then the Figma-derived heading uses the stored first name, Annual is selected, Plus, Pro, Enterprise, and the underlined Free action are visible, and all plan content comes from the validated catalog

### AC-002 — Paid selection advances only to payment [REQ-004, REQ-006, REQ-009, REQ-010]

- Given the journey is at `PLAN_SELECTION`
- When the owner selects an active Plus or Pro price
- Then the server persists the resolved selection, advances atomically to `PAYMENT`, rotates continuation security, and returns `payment`
- And it creates no trial or Stripe payment resource

### AC-003 — Free bypasses payment and is limited to one site [REQ-004, REQ-007, REQ-014]

- Given the owner activates `Or try it for free`
- When the server accepts the `free` selection
- Then it persists a zero-price, no-expiry selection snapshot with a one-site maximum and advances atomically to `ORGANIZATION_PROFILE`
- And Stripe is not invoked

### AC-004 — Enterprise uses controlled contact sales [REQ-008, REQ-009]

- Given Enterprise is visible
- When the owner activates `Schedule a call`
- Then the selection is recorded and the server returns the configured HTTPS sales destination
- And no caller-controlled destination, payment, or trial is created

### AC-005 — Forged and concurrent transitions are rejected [REQ-009, REQ-010, REQ-011, REQ-017]

- Given a missing, stale, wrong-step, invitation-path, cross-origin, or replayed request, or two concurrent valid submissions
- When plan selection is attempted
- Then forged requests are rejected generically, exactly one concurrent valid transition wins, and failed work rolls back without partial selection or journey changes

### AC-006 — Progressive and accessible interaction is preserved [REQ-012, REQ-013, REQ-015, REQ-016]

- Given JavaScript is unavailable or the viewport is narrow
- When the owner changes interval, chooses a plan, follows Free, uses Back, or encounters a recoverable failure
- Then the workflow remains keyboard and assistive-technology usable, retains valid state, reflows without horizontal overflow, and follows server-authoritative navigation

### AC-007 — Production cannot ship dummy commerce data [REQ-018]

- Given a production deployment is validated
- When the dummy catalog or Stripe test lookup keys are enabled
- Then deployment validation fails before release

## UX and accessibility

The desktop composition follows Figma frame `52:608`: logo at upper left, centered heading and billing control, three horizontally arranged plan cards, Free link below the cards, and Back at lower left. Responsive layouts stack cards in catalog display order without changing their meaning. Plus and Pro card content changes with the billing interval; Enterprise remains unchanged. Free remains an underlined action as designed and must have an accessible name explaining that it chooses the Free plan.

The billing interval is a single labelled control with exactly one selected value. Selection state must be communicated programmatically and visually beyond color. Cards use headings, lists for feature copy, correctly associated price descriptions, and buttons with unambiguous accessible names. Focus order follows heading, billing interval, Plus, Pro, Enterprise, Free, and Back. Loading, submission, validation, and server failure states must announce status without moving focus unpredictably.

## API and integrations

The OpenAPI 3.1 contract will define:

- `GET /onboarding/plan-selection` for the private, no-store progressive HTML page;
- `GET /api/onboarding/plan-selection` for the authenticated first name, current interval/selection, and validated display catalog;
- `POST /api/onboarding/plan-selection` accepting JSON or `application/x-www-form-urlencoded` with only `{ "priceId": "<stable identifier>" }` and returning a discriminated result for `payment`, `organization-profile`, or `contact-sales`;
- rotated continuation and CSRF cookies on accepted state transitions.

Stripe is not called in this feature. The catalog contains server-only lookup keys rather than raw Stripe Price identifiers; lookup resolution and Checkout creation belong to the next payment specification. The Enterprise destination is an environment configuration validated as HTTPS and returned only after an accepted Enterprise selection.

## Data and migration

Add a one-to-one `OnboardingPlanSelection` owned by `User` with a generated identifier, stable plan identifier, nullable stable price identifier, selected billing interval, amount and currency snapshot where applicable, payment-required flag, nullable maximum-sites snapshot, catalog version, selected timestamp, and updated timestamp. The database must constrain one selection per user. Re-selection while the journey remains at `PLAN_SELECTION` updates that record; an accepted transition out of the step makes the commercial snapshot immutable for this onboarding journey.

Extend the onboarding-step enum with `PAYMENT` and `ORGANIZATION_PROFILE` if absent. The migration adds nullable/new data only and requires no backfill because no production plan selections exist. Rollback is safe before production data exists; after selection data exists, rollback must preserve the table until a forward-compatible reader or export exists.

## Security and privacy

The continuation credential and CSRF proof remain short lived, scoped to onboarding, stored as keyed digests where secret, rotated after accepted transitions, and transported only in Secure cookies in production. The server derives identity and journey state and performs catalog resolution; client prices and commercial attributes are untrusted. First name and selection responses are private and `Cache-Control: no-store`. Logs may include correlation ID, stable plan ID, catalog version, and transition outcome, but never continuation credentials, CSRF proofs, full names, raw Stripe identifiers, or cookie/header values.

Enterprise contact configuration must be HTTPS and controlled by deployment configuration. Free's one-site bound is authorization data, not presentation-only metadata, and later site creation must fail closed when the maximum is reached.

## Reliability and observability

Plan selection is one database transaction containing selection persistence, journey compare-and-swap, and continuation rotation. Concurrency permits one winning transition. Recoverable rejections return stable generic codes; unexpected failures include a correlation identifier and preserve the prior journey state.

Emit structured metrics for catalog-load failure, page load, selection by stable plan ID, transition success/rejection, Free selection, Enterprise contact selection, and unexpected failure. Alert on catalog validation failure and sustained unexpected-error rate. Catalog validation failure fails startup and deployment rather than serving a partial plan list.

## Test strategy

- Validate the JSON catalog schema, exact approved identifiers and amounts, display ordering, no-trial invariant, Free one-site maximum, HTTPS Enterprise configuration, and production rejection of dummy/test configuration.
- Unit-test billing control, plan cards, Free action, Enterprise action, loading, error, disabled, interval changes, retained selection, and responsive semantics with 100% frontend coverage.
- Unit-test authoritative catalog resolution, origin/CSRF checks, state-machine decisions, credential rotation, generic errors, and all response variants with 100% backend coverage.
- Run PostgreSQL integration tests for paid, Free, Enterprise, wrong-step rollback, immutable accepted snapshot, and concurrent single-winner behavior.
- Add API-independent Storybook stories and axe plus deterministic visual snapshots for every new component and the complete desktop and narrow plan-selection page.
- Add Playwright E2E for Annual default, Monthly switch, Plus/Pro payment routing, Free payment bypass, Enterprise contact routing, Back, recoverable failure retention, no-JavaScript forms, keyboard use, accessibility, and 320-pixel reflow.
- Run the full repository verification gate and require independent specification and standards reviews with no unresolved high- or medium-severity findings before commit.

## Rollout and rollback

Roll out behind a non-production onboarding-plan-selection flag with the dummy catalog and Stripe test configuration only. Apply the additive database migration before deploying code, then enable the route after catalog validation passes. Production remains blocked until a real commercial catalog and the payment specification are approved.

Rollback disables the route flag and restores the previous application artifact. The additive selection table remains during rollback to avoid destroying accepted state. No irreversible external payment side effect exists in this feature.

## Open questions

- None.
