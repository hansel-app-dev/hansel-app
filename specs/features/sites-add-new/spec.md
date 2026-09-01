# Feature: Add new site

- ID: `sites-add-new`
- Status: `approved`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-01`
- Product approval: `User approved the two-step site-creation acceptance criteria and invitation/billing boundary on 2026-09-01`
- Design authority: `Figma Hansel App UI frame 2029:1630 and its linked two-step prototype`
- Permission authority: `FigJam Software Structure node 1:12, reconciled with the previously approved Owner, Administrator, Editor, and Viewer product terminology`
- Design evidence: `Browser-inspected through the signed-in Figma and FigJam experiences on 2026-09-01; the structured Figma connector was blocked by the Professional View-seat call limit`

## Problem

Hansel's authenticated Sites page truthfully shows an empty state, but both `New site` actions are unavailable. Authorized organization members need to create their first or an additional tenant-owned site, choose the organization's default access, optionally grant existing members access or invite external viewers, and land in the new site's Activity view without weakening tenant isolation or silently creating paid seats.

## Outcome and success metrics

- An authenticated Owner or Administrator can complete the approved two-step modal from either `New site` action.
- A valid request atomically creates one tenant-owned site, its creator access, direct internal grants, and durable pending external invitations exactly once.
- The Free plan is limited to one site and cannot use user-management invitations; paid plans follow their configured site allowance without an unapproved automatic charge.
- Successful creation navigates to `/sites/:siteId/activity`, and a later visit to `/sites` never presents a populated tenant as empty.
- Resend delivers external Viewer invitations from a durable retryable intent without delaying the site-creation response.
- Frontend and backend unit coverage remain 100%; contract, integration, accessibility, visual, responsive, and end-to-end checks pass.

## Non-goals

- Automatically purchasing, changing, or charging for a subscription, additional site, or paid user seat.
- Allowing an external person to become an Administrator or Editor before paid-seat behavior is separately specified.
- Creating custom roles, changing organization roles, transferring ownership, or implementing the future roles-and-permissions management view.
- Accepting invitations, onboarding invited users, revoking delivered invitations, resending invitations manually, or exposing invitation tokens in application responses or logs.
- Implementing site deletion, archiving, duplication, folders, search, sorting, filtering, pagination, grid/list switching, allocations, signage schedules, or sign CRUD.
- Reproducing Figma editor chrome, prototype laptop chrome, comments, example identities, example email addresses, cursor markers, or annotations.

## Requirements

- REQ-001: Figma frame `2029:1630` and its linked prototype MUST be the visual and copy authority for the two-step `Add new site` modal. Both existing `New site` actions MUST open the same modal module over the authenticated Sites page.
- REQ-002: Step 1 MUST show `Add new site`, a site-name field, `Who has access`, the current organization, `Only people in your organization`, `What they can do`, `View and comment`, `Edit sites, invite people, and change their permissions`, `Step 1 of 2`, `Cancel`, and `Next` with the reference hierarchy and shared Hansel controls.
- REQ-003: The site name MUST be required, NFC-normalized, trimmed, and contain 1 through 100 Unicode characters. Client validation MUST use React Hook Form with Yup; the shared Zod contract and backend MUST independently enforce the same observable rule.
- REQ-004: The organization selector MUST be fixed to the authenticated membership's tenant. The browser MUST NOT submit or choose a tenant identifier, and no cross-tenant organization lookup or creation is permitted.
- REQ-005: Step 1 MUST persist its values when moving forward and back. `View and comment` maps to the tenant-wide Viewer capability for this site; `Edit sites, invite people, and change their permissions` maps to the tenant-wide Administrator capability. The Viewer option is selected initially as shown in Figma.
- REQ-006: Step 2 MUST show `Invite team members`, an email/member input, role selection, `Add`, `Who has access`, member rows with identity, Internal/External status, role, removal control, `Step 2 of 2`, `Back`, and `Create site` using the reference composition.
- REQ-007: Step 2 roles MUST be `Administrator`, `Editor`, and `Viewer`. The authenticated creator MUST be present as an unremovable Internal Administrator. Existing tenant members MAY be assigned any of the three site roles; duplicate email entries MUST collapse to one latest staged assignment.
- REQ-008: External email addresses MAY be invited only as Viewer in this specification. Selecting Administrator or Editor for an external address MUST retain the staged row and display the Figma paid-seat warning, but MUST block creation until the role is changed or the row is removed. No billing request or hidden downgrade is permitted.
- REQ-009: A Free Owner MUST be limited to one site, ten signs per the permission authority, and no user-management invitations. This feature MUST enforce the one-site and invitation limits on the server and communicate an upgrade-required state without opening checkout. Sign-limit enforcement is recorded for future sign creation and does not create sign behavior here.
- REQ-010: Organization Owners and Administrators MAY create sites. Editors and Viewers MUST receive a generic forbidden response even if they manipulate client state. Owner remains the highest organization role; the site creator receives an Administrator site grant rather than a second Owner role.
- REQ-011: The Administrator capability MUST permit creating, managing, and sharing sites, managing signs, and inviting members or viewers to sites. Editor MUST permit managing signs and sharing sites but not creating sites, managing users, or changing roles. Viewer MUST permit viewing shared sites and commenting. These rules MUST be centralized as data and tested through the authorization interface.
- REQ-012: `GET /api/sites` MUST return the authenticated tenant's creation context and ordered site summaries only: organization name, viewer creation capability, plan-limit state, member choices required by the modal, and sites belonging to that tenant. It MUST NOT return invitation tokens, password data, provider identifiers, billing identifiers, or another tenant's data.
- REQ-013: `POST /api/sites` MUST accept the approved name, organization access level, staged member assignments, and an opaque idempotency key. A successful response MUST contain the created site ID and same-origin Activity destination. Reusing the key with the identical request MUST return the original result; reuse with different content MUST return a conflict.
- REQ-014: Site, creator grant, internal grants, external invitations, and delivery intents MUST be created in one PostgreSQL transaction. Site-count enforcement MUST occur inside the same serializable operation so concurrent requests cannot exceed the configured maximum.
- REQ-015: External Viewer invitations MUST use a random single-use token whose digest alone is stored, expire after seven days, and be delivered by Resend through a durable, retryable intent. Provider failures MUST not roll back an already-created site or expose provider details. Logs MUST contain categorical outcomes, correlation IDs, and internal record IDs only—never email addresses or tokens.
- REQ-016: The mutation MUST require an authenticated, unexpired application session plus the existing exact-origin mutation proof. Responses MUST be private and `no-store`; authentication, authorization, tenant, plan, conflict, validation, and dependency failures MUST use bounded categorical responses.
- REQ-017: Close, Escape, backdrop, and Cancel MUST dismiss the modal without a request after confirmation when staged values would be lost; this initial version MAY dismiss immediately before any valid value is staged. Focus MUST enter the dialog, remain trapped, return to the invoking action, and expose the title, progress, validation, warning, loading, and failure states to assistive technology.
- REQ-018: `Create site` MUST submit at most once while pending. On success the client MUST clear modal state and navigate to `/sites/:siteId/activity`; retry after an ambiguous client failure MUST reuse the same idempotency key. On recoverable failure the modal MUST retain all entered values and present a concise retryable message.
- REQ-019: `/sites/:siteId/activity` MUST be an authenticated tenant-scoped route that confirms the created site's name and Activity context inside the existing shell. Full Activity functionality remains out of scope. Returning to `/sites` MUST show a truthful populated summary rather than the empty state.
- REQ-020: The implementation MUST reuse `ApplicationShell`, `Button`, `TextField`, `SelectField`, Figtree, Material Symbols, semantic action tokens, and established API/session seams. A reusable accessible `Modal` module MAY be added and MUST be exported and documented in Storybook; page-specific color overrides are prohibited.
- REQ-021: The modal and populated result MUST reflow without horizontal page scrolling at 320 CSS pixels and 200% zoom. Available operations require visible keyboard focus; warnings and roles must not rely on color alone; dynamic changes require appropriate status or alert semantics; axe checks MUST report no serious violations.
- REQ-022: Frontend and backend unit suites MUST retain 100% statement, branch, function, and line coverage. Tests MUST cover contracts, permission decisions, tenant isolation, plan limits, idempotency, transactional persistence, invitation delivery retry, both modal steps, validation, Back/Cancel/Close, internal/external assignments, paid-seat blocking, pending/success/failure, populated Sites, Activity routing, session expiry, keyboard behavior, axe, and responsive visual states.
- REQ-023: The OpenAPI document, Prisma schema and forward migration, Storybook cookbook, deterministic visual baselines, and AWS/runtime documentation MUST remain version controlled. This slice introduces no new AWS resource: the API process reuses PostgreSQL/RDS, Resend configuration, existing ECS compute, Secrets Manager values, logs, alarms, and deployment pipeline.

## Acceptance scenarios

### AC-001 — Authorized member completes the two-step Figma flow [REQ-001..REQ-007, REQ-017, REQ-018]

- Given an authenticated paid-plan Owner or Administrator is on the Sites page
- When they open either `New site` action, enter a valid name, choose organization access, move forward, optionally assign internal members, and create the site
- Then both steps match the supplied Figma flow and preserve values when moving Back
- And one site is created and the browser opens its Activity route

### AC-002 — Site creation is tenant-safe and role-authorized [REQ-004, REQ-010..REQ-014, REQ-016]

- Given a request contains manipulated tenant data, another tenant's member, an unauthorized Editor or Viewer session, or concurrent requests at the site limit
- When the request reaches the server
- Then the server derives the tenant from the session, rejects unauthorized or out-of-scope data generically, and never creates or discloses a cross-tenant record

### AC-003 — Free-plan and paid-seat limits fail closed [REQ-008, REQ-009, REQ-14]

- Given a Free Owner already has one site or stages an invitation, or any creator stages an external Administrator or Editor
- When they attempt creation
- Then the UI explains the applicable upgrade or paid-seat requirement and the server independently rejects bypass attempts
- And Hansel does not open checkout, charge Stripe, silently change the role, or partially create data

### AC-004 — External Viewer invitation is durable and private [REQ-008, REQ-013..REQ-016]

- Given an authorized paid-plan creator adds a valid external Viewer email
- When the site is created
- Then a pending invitation and delivery intent are committed with the site and a digest of a seven-day token
- And Resend delivery is retried independently without exposing the address, token, or provider failure in logs or API responses

### AC-005 — Retrying does not duplicate the site [REQ-013, REQ-014, REQ-018]

- Given the client cannot determine whether a creation request succeeded
- When it retries with the same idempotency key and identical input
- Then it receives the original site and destination without duplicate grants or invitations
- But changing the input under that key produces a conflict

### AC-006 — Sites remains truthful after creation [REQ-012, REQ-019]

- Given a tenant has created at least one site
- When a member opens `/sites` or the created Activity destination
- Then only tenant-owned site information is shown and the empty state is absent
- And inaccessible site IDs return a generic not-found result without disclosing whether another tenant owns them

### AC-007 — Modal remains usable across assistive and narrow contexts [REQ-017, REQ-020..REQ-022]

- Given keyboard-only use, a screen reader, 320 CSS pixels, or 200% zoom
- When the member opens, completes, backs through, fails, retries, or closes the modal
- Then focus, progress, labels, roles, warnings, errors, and actions remain ordered and understandable without horizontal page scrolling
- And Storybook, axe, deterministic screenshots, and focused browser journeys pass

## UX and accessibility

The modal sits over the authenticated Sites view with the page visually muted. It uses a white card, compact header and close control, clear section spacing, a bordered footer, shared primary/secondary buttons, and the exact two-step wording listed above. Example people and addresses in Figma are reference data only; production rows come from the authenticated tenant and staged input.

The dialog is labelled by `Add new site`, exposes `Step 1 of 2` or `Step 2 of 2`, traps focus, closes with Escape, and restores focus to the exact button that opened it. Errors are associated with their fields. The paid-seat and upgrade warnings use text plus alert/status semantics, not border color alone. On narrow screens the dialog becomes a vertically scrollable inset sheet while its header and footer remain reachable.

## API and integrations

- `GET /api/sites` loads the tenant-scoped list and creation context through the application-session interface.
- `POST /api/sites` creates the site and access records under the idempotency contract.
- `GET /api/sites/{siteId}` loads the minimal Activity context and returns generic not-found for inaccessible IDs.
- Resend sends external Viewer invitations from the durable delivery worker. The invitation URL uses the configured application origin and a future acceptance route; acceptance itself remains out of scope.
- Stripe is not called. A paid-seat requirement blocks creation until a separately specified billing flow exists.

All operations are added to `specs/openapi.yaml` with strict request and response schemas, categorical errors, cookie authentication, exact-origin mutation requirements, and idempotency semantics.

## Data and migration

The forward Prisma migration introduces tenant-owned `Site`, site access policy, internal site grants, pending external site invitations, idempotent creation requests, and invitation delivery intents. Foreign keys use restrictive or cascading behavior intentionally so tenant deletion removes its sites while users cannot delete another tenant's grants. Unique constraints prevent duplicate internal grants, duplicate invitation addresses per site, and duplicate idempotency keys per tenant.

Site names and email addresses are normalized before persistence. The request digest binds every normalized creation input to its idempotency key. No backfill is required because the database currently contains no Site model in this implementation; existing tenants begin with zero sites.

## Security and privacy

The server—not the browser—derives user, membership, tenant, organization role, plan, existing members, site count, and internal/external classification. Authorization follows the approved role matrix and fails closed. Site identifiers are UUIDs but are not treated as authorization secrets. Cross-tenant site reads use indistinguishable not-found behavior.

Invitation tokens use cryptographically secure randomness, are never returned after creation, and are stored only as digests. Email addresses are operational personal data: responses expose only tenant-member choices needed by authorized user managers, logging is redacted, and private responses are not cached. The invitation email contains no sensitive site content beyond the site and organization names required to understand the invitation.

## Reliability and observability

The site write is one serializable PostgreSQL transaction. Invitation delivery follows an outbox-style worker with bounded leases, retries, jittered backoff, terminal handling, and categorical telemetry. Creation success does not depend on immediate Resend availability. Metrics and logs avoid unbounded email, name, token, or tenant dimensions.

Existing API availability objectives apply. Alerts continue through the shared API error and worker-failure signals; no new AWS service is justified for this workload. A later scale review may move delivery to SQS/Lambda without changing the creation interface.

## Test strategy

- Start with one contract test for normalized creation input, then add one backend authorization/idempotency behavior at a time through the public module interface.
- Exercise the Prisma adapter against PostgreSQL for tenant scoping, serializable site limits, atomic grants/invitations, duplicate keys, and rollback.
- Add route tests for session rotation, exact-origin mutation checks, strict schemas, no-store responses, categorical errors, and destination safety.
- Add one frontend behavior at a time: open Step 1, validate, proceed, preserve Back state, stage members, block paid-seat roles, submit once, retry, and navigate.
- Add Storybook states for both steps, Free-plan restriction, internal/external access, paid-seat warning, pending, server failure, narrow layout, and populated Sites/Activity boundaries.
- Add Playwright journeys for both invokers, keyboard/focus return, axe, desktop comparison, 320 pixels, 200% zoom, successful creation, idempotent retry, forbidden role, plan limit, session expiry, and tenant-safe Activity loading.
- Run focused checks while iterating, then the complete contracts, API, web, integration, E2E, Storybook visual/accessibility, OpenAPI, Prisma, build, CDK synthesis, and repository policy suites once before review and commit.

## Rollout and rollback

Deploy the additive migration before the API and frontend artifact. The feature remains behind the existing authenticated Sites route and can be disabled with a runtime feature flag if the migration is present but behavior must be withdrawn. Rollback disables creation first, then restores the previous application artifact; additive tables remain until a later reviewed cleanup migration so created sites and invitations are not destroyed.

## Open questions

- None for this approved slice. Paid-seat checkout, invitation acceptance/onboarding, sign creation and the ten-sign Free limit, custom roles, and full Activity functionality require later specifications.
