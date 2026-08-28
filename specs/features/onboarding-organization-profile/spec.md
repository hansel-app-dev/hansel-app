# Feature: Onboarding organization profile

- ID: `onboarding-organization-profile`
- Status: `implemented`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-08-28`
- Design authority: `Figma Hansel App UI, Onboarding frame 11:409`
- Design evidence: `Browser-inspected 2026-08-27; Figma structured connector was rate-limited`
- Product approval: `Acceptance criteria approved by user, 2026-08-28`
- Implementation evidence: `100% frontend/backend unit coverage; PostgreSQL integration; JavaScript and no-JavaScript Playwright; Storybook axe and deterministic desktop/narrow screenshots; independent spec and standards reviews passed, 2026-08-28`

## Problem

After a new owner selects Free, or completes an approved paid-plan payment transition, Hansel must collect the organization profile shown in Figma and create the tenant safely. The form values are required business data: country, industry, place or service, and organization size must use approved stable identifiers, while the selected place or service must belong to the selected industry.

Organization creation is also an authorization transition. The verified creator must become the organization's sole initial protected Owner, and a replay, concurrent request, stale browser, or forged identifier must not create a second organization or membership.

## Outcome and success metrics

- The screen visually follows Figma frame `11:409` and uses its exact visible wording and field order.
- Every submitted value is normalized and validated by the server against approved, versioned taxonomies.
- One accepted transition atomically creates one organization and one Owner membership, advances onboarding to `DISCOVERY`, and rotates continuation security.
- A repeated submission with the same server-issued submission key returns the original successful outcome without duplicate state.
- Frontend and backend retain 100% statement, branch, function, and line coverage.
- Contract, PostgreSQL integration, Storybook cookbook, accessibility, deterministic visual-regression, and Playwright E2E checks pass.

## Non-goals

- Implementing payment, Stripe webhook processing, Enterprise activation, invitations, role management, ownership transfer, organization editing, organization deletion, sites, or dashboard behavior.
- Collecting an address, website, phone number, tax identifier, billing contact, logo, slug, custom domain, or marketing metadata.
- Adding `Other` to country, industry, place or service, or organization size.
- Implementing the following optional discovery screen beyond returning and navigating to `discovery`.
- Inferring organization entitlements beyond the accepted immutable plan-selection snapshot.

## Requirements

- REQ-001: Figma frame `11:409` MUST be the visual authority. The 1728×1117 desktop composition MUST show the exported Hansel logo at the upper left, the exact heading `Now your organization`, a narrow form ordered `Organization`, `Country`, `Industry or sector`, `Type of place or service`, and `Size`, and the named primary action `Next` at the lower right. The implementation MUST reuse existing Hansel tokens, `TextField`, `SelectField`, `Button`, typography, and form spacing rather than introducing a parallel visual system.
- REQ-002: All five fields MUST be required. Organization name MUST contain 1–200 Unicode characters after trimming and NFC normalization. The server and client MUST reject an empty, whitespace-only, overlong, or invalidly encoded name without modifying accepted onboarding state.
- REQ-003: Country MUST use an ISO 3166-1 alpha-2 identifier from one versioned catalog containing the complete currently assigned country set and approved English display labels. Australia MAY be suggested first when the browser locale indicates Australia, but MUST remain an ordinary selectable `AU` value and MUST NOT restrict the catalog. The browser MUST submit only the stable alpha-2 identifier.
- REQ-004: Industry and place or service MUST use the stable identifiers and exact English labels in the parent onboarding specification's Approved product taxonomies. The visible place/service options MUST update when industry changes. The browser MUST clear an incompatible prior place/service selection, and the server MUST reject any place/service identifier that does not belong to the submitted industry even when both identifiers independently exist.
- REQ-005: Organization size MUST use exactly `employees_1_10`, `employees_11_50`, `employees_51_100`, and `employees_over_100` with the approved labels `1–10`, `11–50`, `51–100`, and `More than 100`. Display labels MUST never be accepted as persistence values.
- REQ-006: `GET /api/onboarding/organization-profile` MUST derive the user and journey from a valid, unexpired continuation credential at `ORGANIZATION_PROFILE` on the `NEW_ORGANIZATION` path. It MUST return the versioned display catalogs and a short-lived, cryptographically random, server-issued submission key. It MUST not accept caller-supplied user, email, journey, tenant, membership, role, plan, price, or entitlement identifiers.
- REQ-007: `POST /api/onboarding/organization-profile` MUST accept only organization name, country, industry, place/service, organization size, and the server-issued submission key. JSON requests MUST require the credential-bound CSRF header and exact same-origin checks. Native forms MUST require the credential-bound CSRF cookie and same-origin checks. Missing, expired, malformed, replay-incompatible, invitation-path, wrong-step, or forged requests MUST return stable generic errors without revealing whether an organization, user, membership, or plan exists.
- REQ-008: One accepted submission MUST atomically create exactly one organization record with the normalized profile, create exactly one protected `Owner` membership for the verified creator, bind that organization to the onboarding journey, advance the journey from `ORGANIZATION_PROFILE` to `DISCOVERY`, consume the submission key, and rotate the continuation credential and CSRF proof. The transaction MUST create no site, invitation, subscription, payment, custom role, or additional membership.
- REQ-009: The creator MUST be the sole initial Owner. `owner` MUST be the stable protected role identifier. Caller input MUST NOT select, downgrade, duplicate, or omit the Owner role. A database constraint and transactional checks MUST prevent one onboarding journey from creating or binding more than one organization and prevent concurrent submissions from producing multiple winners.
- REQ-010: Repeating a completed request with the same valid submission key MUST return the original `discovery` outcome and organization reference without creating or changing organization, membership, journey, or continuation state a second time. Reusing that key with different field values MUST be rejected as a conflict. Raw submission keys, continuation credentials, and CSRF proofs MUST never be stored; only keyed non-reversible digests may be persisted.
- REQ-011: An accepted response MUST contain only `{ "nextStep": "discovery" }` plus any opaque server-owned navigation information required by the application. The public response MUST not expose the Owner role, internal membership identifier, plan snapshot, tenant database identifier, or authorization data. Private onboarding reads and rendered pages MUST use `Cache-Control: private, no-store`.
- REQ-012: The screen MUST work without JavaScript through server-rendered HTML and an ordinary form POST followed by a `303` redirect to `/onboarding/discovery`. JavaScript MAY progressively filter place/service options and improve focus management, but the server remains authoritative. Recoverable validation and transition failures MUST retain all valid non-secret values, show field-specific validation where safe, and never expose database or provider errors.
- REQ-013: Figma does not show a Back action on frame `11:409`; this feature MUST NOT add one. Browser Back or direct navigation MUST not delete the accepted plan, organization profile, or membership, reopen an already consumed transition, or permit plan mutation after organization creation.
- REQ-014: The page and each new reusable module MUST have API-independent Storybook cookbook stories for normal, validation-error, industry-dependent options, loading, submitting/disabled, server-error, and narrow states as applicable. Existing design-system modules MUST be reused; a new reusable module is permitted only where it makes the interface deeper rather than wrapping one existing control.
- REQ-015: The implementation MUST meet WCAG 2.2 AA, associate every label and error, expose required state, announce loading and submission failures, move focus predictably to an error summary or heading, support keyboard-only use, reflow without horizontal page scrolling at 320 CSS pixels and 200% zoom, and preserve a logical heading and form order. A disabled place/service control MUST explain that industry must be selected first.
- REQ-016: Frontend and backend unit suites MUST retain 100% statement, branch, function, and line coverage. Contract tests MUST validate every request, response, country, industry, place/service relationship, and size identifier. PostgreSQL tests MUST prove atomic organization/Owner/journey creation, rollback, one concurrent winner, idempotent same-payload retry, and conflicting-payload rejection. Playwright MUST cover successful Free-plan progression, dependent options, validation retention, no JavaScript, accessibility, keyboard use, deterministic desktop and 320-pixel visual states, and forbidden Back mutation.
- REQ-017: Structured events MUST record page load, validation rejection, transition rejection, successful organization creation, idempotent replay, conflict, and unexpected failure using correlation ID and non-sensitive stable outcome fields. Logs and metrics MUST never include organization name, country combined with identity, continuation or submission keys, CSRF values, cookies, or headers. Alerting MUST cover sustained unexpected organization-creation failures.
- REQ-018: Deployment MUST apply the additive database migration before enabling the route. Production rollout MUST be flag-controlled, fail closed when catalog validation fails, and allow rollback by disabling the route while preserving created organizations and memberships.
- REQ-019: The `Type of place or service` select MUST retain the approved white surface while disabled waiting for an industry selection. It MUST remain semantically disabled and continue to expose the instruction to select an industry first.

## Acceptance scenarios

### AC-001 — Figma form uses approved catalogs [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005]

- Given a verified new owner has reached organization profile
- When the page loads
- Then the exact Figma heading, five fields, ordering, and Next action are shown
- And every selectable value comes from the approved versioned country, industry/place, and size catalogs
- And the disabled `Type of place or service` select retains a white background while explaining that an industry must be selected first

### AC-002 — Dependent place values remain valid [REQ-004]

- Given an owner selects an industry and a permitted place or service
- When the industry changes
- Then the incompatible place selection is cleared and only values permitted for the new industry remain visible
- And a forged mismatched pair is rejected by the server

### AC-003 — Organization and sole Owner are created atomically [REQ-006, REQ-007, REQ-008, REQ-009]

- Given a valid new-organization journey at `ORGANIZATION_PROFILE`
- When the owner submits valid values and the server-issued submission key
- Then one organization, one protected Owner membership, the journey binding, the transition to `DISCOVERY`, key consumption, and continuation rotation commit together
- And no unrelated resource is created

### AC-004 — Replay and concurrency cannot duplicate ownership [REQ-009, REQ-010]

- Given the same valid submission is retried or submitted concurrently
- When requests use the same server-issued submission key
- Then exactly one transition creates state and equivalent retries receive the original `discovery` outcome
- And a changed payload using the consumed key is rejected without mutation

### AC-005 — Invalid transitions fail closed [REQ-002, REQ-003, REQ-004, REQ-005, REQ-007]

- Given invalid text, unknown taxonomy values, a mismatched industry/place pair, missing security proof, a stale credential, an invitation path, or a wrong journey step
- When submission is attempted
- Then the request is rejected generically where disclosure would be unsafe, valid form values are retained where safe, and no organization or membership is created

### AC-006 — Progressive and accessible use is preserved [REQ-012, REQ-013, REQ-014, REQ-015, REQ-016]

- Given JavaScript is disabled, the viewport is 320 pixels wide, text is zoomed, or the person uses only a keyboard or assistive technology
- When they complete or correct the form
- Then the dependent fields, errors, submission, and redirect remain understandable and functional without horizontal page scrolling
- And Back navigation cannot mutate accepted server state

### AC-007 — Operations are observable without leaking profile data [REQ-017, REQ-018]

- Given catalog validation or organization creation fails unexpectedly
- When telemetry and deployment controls run
- Then safe structured events and alarms identify the failing outcome without profile or credential data
- And the route can be disabled without deleting accepted state

## UX and accessibility

The desktop layout follows Figma frame `11:409`: the Hansel mark is positioned at the upper left; a narrow form sits in the upper-middle of the 1728×1117 canvas; the heading is `Now your organization`; labels and controls appear in the exact approved order; and `Next` sits at the lower right. The prototype laptop shell and editor canvas are not application UI.

On narrow screens the form becomes one logical column with the Next action after the fields. Select placeholders must be instructions rather than valid values. Industry controls the available place/service choices; until industry is selected, the place/service control is disabled with accessible explanatory text. Changing industry clears an incompatible place/service value and its stale error.

The structured Figma design connector was rate-limited during specification drafting. The frame was inspected in the signed-in browser. Before implementation is considered complete, visual comparison MUST use frame `11:409`; if structured Figma context becomes available, exported assets and metadata MUST replace any browser-derived approximation.

## API and integrations

The OpenAPI 3.1 contract will define:

- `GET /onboarding/organization-profile` for the private progressive HTML page;
- `GET /api/onboarding/organization-profile` for versioned display catalogs and a server-issued submission key;
- `POST /api/onboarding/organization-profile` for JSON and `application/x-www-form-urlencoded` requests containing only the approved five values and submission key;
- rotated continuation and CSRF cookies on first accepted transition;
- a discriminated successful result containing `nextStep: discovery`.

The feature calls no Stripe, email, invitation, analytics-vendor, geolocation, address-lookup, or enrichment API. Browser locale may influence only the initial country ordering; it cannot select or persist country without user submission.

## Data and migration

Extend the existing tenant/organization record with country code, industry identifier, place/service identifier, organization-size identifier, and a unique nullable onboarding-journey binding. Preserve organization name as normalized text. Create or extend the organization relation on `OnboardingJourney` so one new-organization journey binds to at most one created organization.

Add a submission record containing user/journey relation, keyed submission-key digest, canonical request digest, stable outcome, consumed timestamp, and timestamps. It must support idempotent replay without storing raw form text redundantly or any raw credential. The transaction creates the organization and `owner` membership, binds the journey, advances it, consumes the submission key, and rotates continuation security.

The migration is additive. No backfill is required because no organization-profile completion exists in production. Rollback must retain organization, membership, and submission records after any accepted transition.

## Security and privacy

Identity, journey, accepted plan, and Owner authority are server-derived. Text and taxonomy values are untrusted input. Organization name is personal/business profile data and must not enter logs, metrics, URLs, cacheable responses, or client persistence. Country must not be logged together with user identity. Cookies remain Secure in production with the approved SameSite and HttpOnly properties.

Submission and continuation keys are short-lived random values stored only as keyed digests. Canonical request comparison must use a keyed digest so an idempotency record cannot reveal the submitted profile. Authorization fails closed for every wrong path or step.

## Reliability and observability

Organization creation, sole Owner membership, journey binding/transition, submission consumption, and continuation rotation occur in one PostgreSQL transaction. Database uniqueness and compare-and-swap enforce one winner. Equivalent retries return the recorded result; conflicts and unexpected failures preserve the pre-transition state.

Emit structured events and CloudWatch metrics for page load, validation rejection, transition rejection, creation success, idempotent replay, conflict, catalog failure, and unexpected failure. Alert on catalog startup failure and sustained unexpected failures. Correlation identifiers must be generated or accepted only under the existing safe correlation policy.

## Test strategy

- Validate all stable taxonomies, every country code/label, industry/place relationship, size band, normalization boundary, and strict request/response schema.
- Use vertical TDD slices through the public organization-profile module: load page, validate dependent choices, commit organization and Owner, retry idempotently, reject conflict, and recover from failure.
- Add PostgreSQL tests for successful atomic creation, rollback, wrong step/path, concurrent single winner, same-payload replay, and changed-payload conflict.
- Add API-independent Storybook stories for the page and every genuinely reusable new module, with axe and deterministic desktop/narrow screenshots for all applicable states.
- Add Playwright E2E for the Figma layout, dependent selects, validation retention, Free-plan progression, successful redirect, keyboard operation, 320-pixel reflow, browser Back safety, and a real no-JavaScript Express/PostgreSQL submission.
- Run the complete repository verification gate and require independent specification and standards reviews with no unresolved high- or medium-severity findings before the implementation commit.

## Rollout and rollback

Apply the additive migration, deploy code with organization profile disabled, validate catalogs and alarms, then enable the route in non-production. Production enablement requires the same catalog and migration checks. Rollback disables the route and restores the previous artifact while preserving all accepted organization and membership state.

## Open questions

- None. Approval of this specification authorizes only the behavior listed above.
