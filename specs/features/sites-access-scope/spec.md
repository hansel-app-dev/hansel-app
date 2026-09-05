# Feature: Site access scope selection

- ID: `sites-access-scope`
- Status: `implemented`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-05`
- Product approval: `Approved by product owner in the Codex task on 2026-09-05`
- Domain references: `CONTEXT.md — Organization, Membership, Organization Role, Owner, Site, Site Access, Site Access Scope; docs/domain/figjam-object-catalog.md — Site and User objects, Organization roles and permissions, Known ambiguity 4`
- Supersedes: `sites-add-new REQ-002, REQ-004..REQ-008, REQ-011..REQ-014, REQ-017..REQ-023 where access selection, invitations, persistence, or site visibility is affected`
- Design authority: `Figma Hansel App UI frames 2029:1630, 2097:6260, 2130:1285, and 2151:1744`
- Design evidence: `Browser-inspected through the signed-in Figma file on 2026-09-05; the structured Figma connector was blocked by the Professional View-seat MCP call limit`

## Implementation evidence

- `pnpm verify` passed specification validation, formatting, linting, type checking, production builds, 100% frontend/backend/contracts unit coverage, Storybook build, and all 51 visual/accessibility checks.
- The forward Prisma migration applied successfully to local PostgreSQL; four focused integration tests passed atomic persistence, idempotency, plan limits, scope-aware listing and Activity access, Owner and creator overrides, tenant isolation, and the database scope/capability constraint.
- All 35 Chromium E2E journeys passed, including Organization, People You Invite, Private, Free-plan restrictions, responsive reflow, session expiry, and the existing authentication and onboarding journeys.
- AWS CDK synthesis passed for the test stage without adding infrastructure outside the approved platform boundary.

## Problem

The implemented Add New Site modal treats the current Organization as a fixed access target and asks only what its members can do. The approved design actually presents `Who has access` as a selector with three distinct audience rules: the current Organization, `People you invite`, and `Private`. Without an explicit access scope, Hansel cannot represent invite-only or private sites truthfully, and the creation flow can grant broader Organization access than the creator selected.

## Outcome and success metrics

- An authorized creator chooses exactly one access scope from the Figma-defined selector before a site is created.
- Organization, People You Invite, and Private produce distinct, server-enforced visibility rules rather than cosmetic client states.
- Only Organization scope asks what all Organization members can do; only People You Invite opens the invitation step.
- Existing sites retain their current Organization-wide behavior through a deterministic migration and backward-compatible deployment sequence.
- Frontend and backend unit suites retain 100% statement, branch, function, and line coverage; contract, integration, Storybook, accessibility, responsive, visual, and end-to-end checks pass.

## Non-goals

- Implementing the Figma `Add a cover image` screen, file drag-and-drop, image validation, storage, processing, moderation, or deletion. The inspected cover frame `2211:15810` has inconsistent progress numbering and requires a separate approved upload specification.
- Accepting a site invitation, onboarding an invited external User, resending or revoking an invitation, purchasing a paid seat, or changing an Organization Plan.
- Creating custom roles, changing the approved Owner, Administrator, Editor, and Viewer capabilities, transferring ownership, or adding multiple-Owner management.
- Sharing a site after creation, changing its access scope, changing Organization-wide permissions, or editing direct Site Access from a settings page.
- Public or anonymous access, link sharing, discoverability outside the authenticated Organization, or cross-Organization search.
- Changing site naming, plan site limits, idempotency, the populated Sites view, or full Activity functionality except where visibility enforcement must honor the new scope.

## Requirements

- REQ-001: Figma frames `2029:1630`, `2097:6260`, `2130:1285`, and `2151:1744` MUST be the visual and copy authority for the access selector and the conditional invitation step. The implementation MUST reuse the existing Add New Site modal, shared controls, typography, tokens, icons, and dialog behavior rather than introduce a parallel creation flow.
- REQ-002: Hansel's canonical product term is `Organization`, not `Workspace`. In the selector, the Organization option MUST display the authenticated Organization's real name with the Figma Organization icon; it MUST NOT display the literal placeholder `[workspace]`, an internal tenant ID, or a browser-supplied name.
- REQ-003: `Who has access` MUST be an accessible single-select dropdown with options in this order: the current Organization name, `People you invite`, and `Private`. Each option MUST use the matching Figma icon and remain distinguishable without color. The current Organization MUST be selected initially for a new modal session.
- REQ-004: The selected scope MUST show one helper line beneath the dropdown. Organization uses `Only people in your organization`; People You Invite uses `Only people you directly invite`; Private uses `Only you and organization owners`. The implementation MUST use `organization owners` instead of the Figma term `Superadmin`, because Owner is Hansel's approved highest Organization Role and Superadmin is not a domain role.
- REQ-005: When Organization is selected, the modal MUST show `What they can do` with exactly `View and comment` and `Edit sites, invite people, and change their permissions`. These values continue to map to `VIEW_COMMENT` and `EDIT_MANAGE`. This field MUST be hidden and omitted from the request for People You Invite and Private.
- REQ-006: Organization scope MUST make the Site visible to every current and future Membership in the same Organization. The chosen Organization-wide capability is the default Site Access for those memberships. The creator retains an explicit Administrator Site Access grant, and an Owner retains full management access regardless of the default capability.
- REQ-007: People You Invite scope MUST make the Site visible only to its creator, Organization Owners, accepted direct Site Access grantees, and an external User after a valid invitation is accepted. Other Organization Administrators, Editors, and Viewers MUST not discover or open the Site unless directly granted access.
- REQ-008: Selecting People You Invite MUST make `Next` open the Figma `Invite team members` step. At least one person other than the creator MUST be staged before `Create site` succeeds; choosing this scope without an assignment MUST present a field-associated validation message and MUST not issue a creation request.
- REQ-009: The invitation step MUST preserve the existing approved internal/external classification and role rules. Internal members MAY receive Administrator, Editor, or Viewer Site Access; an external address MAY be invited only as Viewer in this specification; an external Administrator or Editor remains blocked by the paid-seat requirement without a silent downgrade or Stripe request.
- REQ-010: Private scope MUST make the Site visible only to the creator and Organization Owners. No other membership, existing direct grant, staged assignment, or pending invitation may be included in a new Private request. An authorized Administrator creating a Private Site remains its explicit Administrator; other Administrators do not gain access merely from their Organization Role.
- REQ-011: Switching away from People You Invite after staging assignments MUST retain those values only in the current modal session so switching back restores them. Submitting Organization or Private MUST omit the retained assignments. Closing or successfully completing the modal MUST discard all scope-specific client state.
- REQ-012: The reachable flow and its progress text MUST remain truthful within this bounded feature. Organization and Private complete without an invitation step; People You Invite alone includes the invitation step. Progress labels MUST count only reachable implemented steps and MUST NOT copy Figma numbering that includes the separately unapproved cover-image screen.
- REQ-013: The primary action MUST be `Add new site` when the selected scope can complete on the first screen and `Next` when People You Invite requires the invitation screen. The invitation screen MUST use `Back` and `Create site`. Back MUST preserve the site name, selected scope, Organization capability, and staged assignments.
- REQ-014: Free-plan creators MUST be able to choose Organization or Private subject to the existing one-Site limit. People You Invite MUST be unavailable with an accessible upgrade explanation because the approved Free plan does not include user-management invitations. The server MUST independently reject a manipulated Free-plan invite-only request.
- REQ-015: The shared request contract MUST model access as a strict discriminated union: `ORGANIZATION` requires `organizationAccess` and prohibits assignments; `PEOPLE_INVITED` requires one through 100 assignments and prohibits `organizationAccess`; `PRIVATE` prohibits both fields. Every branch also requires the existing normalized site name and opaque idempotency key. Unknown and contradictory fields MUST be rejected.
- REQ-016: The server MUST derive the Organization, creator Membership, Organization Role, Plan, member classification, and Owner override from the authenticated session and database. The browser MUST NOT choose an Organization ID, designate an Owner, mark an address Internal, or broaden Site Access through request fields.
- REQ-017: Creation MUST atomically persist the Site scope, conditional Organization capability, creator grant, valid internal grants, external Viewer invitations, delivery intents, and idempotency record. Organization and Private requests MUST create no invitation or invitee grant. Any failure before commit MUST leave none of those records behind.
- REQ-018: Idempotency MUST bind the normalized access-scope branch and all of its selected values. Repeating an identical request under the same key returns the original Site; changing scope, Organization capability, or assignments under that key returns the existing generic conflict without mutating the Site.
- REQ-019: Site listing and Activity reads MUST enforce access scope on the server. Organization scope admits same-Organization memberships under its default capability; People You Invite admits direct accepted access plus Owner and creator overrides; Private admits only Owner and creator. Inaccessible and cross-Organization Site IDs MUST return the same generic not-found outcome.
- REQ-020: The database MUST introduce a required Site access-scope value and make the Organization-wide capability conditional. Existing Sites MUST migrate to Organization scope while preserving their current `VIEW_COMMENT` or `EDIT_MANAGE` value, grants, invitations, creator, timestamps, and IDs. No existing Site may become Private or People You Invite by inference.
- REQ-021: The API rollout MUST be backward compatible with the currently deployed client during one deployment window. A legacy request containing `organizationAccess` without `accessScope` MUST be interpreted as Organization scope only during that window, validated under the old strict shape, and recorded categorically. The compatibility path MUST have an explicit removal follow-up and MUST never interpret legacy input as Private or People You Invite.
- REQ-022: The access dropdown MUST support keyboard opening, Arrow navigation, Home/End, selection, Escape dismissal, and focus return with correct combobox/listbox semantics. Conditional fields, helper text, validation, disabled Free-plan option, progress, and submission errors MUST be announced and associated with their controls.
- REQ-023: At 320 CSS pixels and 200% zoom, the dropdown, option content, Organization capability radios, invitation rows, warnings, progress, and actions MUST remain readable and operable without horizontal page scrolling. The modal MUST retain its existing focus trap, Escape/close confirmation, and focus restoration behavior.
- REQ-024: The access selector MUST be added to Storybook with Organization open/closed, People You Invite, Private, long Organization name, Free-plan-disabled invite option, keyboard interaction, validation, narrow viewport, and 200%-zoom states. If a reusable icon-bearing select/listbox component is introduced, it MUST be exported to the design-system cookbook with disabled, error, focus, long-label, and boundary states.
- REQ-025: Frontend and backend unit suites MUST retain 100% statement, branch, function, and line coverage. Tests MUST cover every union branch and invalid combination, migration mapping, legacy compatibility, Plan and role enforcement, atomic records, idempotency, visibility resolution, selector keyboard behavior, scope switching, retained-but-omitted assignments, both completion paths, session expiry, axe, and responsive layout.
- REQ-026: OpenAPI, shared Zod schemas, Prisma schema and forward migration, specification traceability, Storybook stories, and deterministic browser screenshots MUST remain version controlled. This amendment introduces no new AWS service: PostgreSQL/RDS, the current API compute, existing Resend invitation delivery, Secrets Manager, logging, alarms, and deployment pipeline remain sufficient.

## Acceptance scenarios

### AC-001 — Creator can choose all three Figma access scopes [REQ-001..REQ-005, REQ-022]

- Given an authorized paid-plan creator opens Add New Site
- When they open `Who has access`
- Then the current Organization name, `People you invite`, and `Private` appear in the approved order with their icons
- And selecting each option updates its helper text and conditional fields using accessible combobox behavior

### AC-002 — Organization access is explicit and tenant-scoped [REQ-005, REQ-006, REQ-015..REQ-019]

- Given the creator selects the current Organization and `View and comment`
- When they add the Site
- Then the Site is created once with Organization scope and the selected Organization-wide capability
- And same-Organization memberships can view it while another Organization cannot discover it

### AC-003 — People You Invite requires an invitation [REQ-007..REQ-009, REQ-013..REQ-019]

- Given the creator selects `People you invite`
- When they continue without staging another person
- Then creation is blocked with an associated validation message
- But when they add a permitted internal member or external Viewer and create the Site, only the creator, Organization Owners, and accepted direct grantees can open it

### AC-004 — Private does not leak Organization-wide access [REQ-004, REQ-010, REQ-015..REQ-019]

- Given an Administrator selects `Private`
- When the Site is created
- Then no Organization-wide capability, invitee grant, or invitation is stored
- And only that creator and Organization Owners can list or open the Site

### AC-005 — Free-plan and manipulated requests fail closed [REQ-014..REQ-019]

- Given a Free-plan creator or a client that sends contradictory scope fields
- When they try to create an invite-only Site or bypass the visible controls
- Then the client explains the unavailable option and the server independently rejects the invalid or upgrade-required request
- And no Site, grant, invitation, delivery intent, or Stripe request is created

### AC-006 — Existing Sites retain their access [REQ-020, REQ-021]

- Given Sites created before this amendment contain a valid Organization-wide capability
- When the migration and compatibility deployment complete
- Then every existing Site is Organization scope with its capability, grants, invitations, identity, and timestamps unchanged
- And a legacy in-flight client can create only an Organization-scoped Site during the bounded compatibility window

### AC-007 — The conditional flow remains accessible and responsive [REQ-011..REQ-013, REQ-022..REQ-025]

- Given keyboard-only use, assistive technology, a long Organization name, 320 CSS pixels, or 200% zoom
- When the creator changes scope, goes forward or back, encounters validation, and creates or closes the Site
- Then selection, helper text, conditional steps, retained values, progress, errors, and actions remain understandable and operable without horizontal page scrolling or serious axe violations

## UX and accessibility

The first screen retains the approved compact Add New Site dialog and site-name field. `Who has access` becomes the bordered Figma dropdown with a leading scope icon and trailing chevron. Its default value is the actual Organization name. The open option list uses the same surface, border, typography, spacing, selected treatment, and icon family as the supplied frames.

Organization shows the existing `What they can do` radios. People You Invite hides that field and continues to the `Invite team members` composition shown in frame `2151:1744`. Private hides both Organization capability and invitation controls and can complete immediately. The Figma word `Superadmin` is replaced by the canonical Owner concept because no such role exists in the approved Hansel model.

The selector is one labelled form control with combobox/listbox semantics, a programmatically associated helper line, visible focus, non-color selected and disabled states, and predictable keyboard operation. Switching options must not cause focus loss. Narrow layouts wrap helper and option text without clipping icons or actions.

## API and integrations

`POST /api/sites` changes from one flat request to the strict access-scope discriminated union in REQ-015. The endpoint retains cookie authentication, exact-origin mutation proof, idempotency semantics, private no-store responses, bounded categorical errors, and the successful Activity destination. `GET /api/sites` and `GET /api/sites/{siteId}` keep their routes but filter results through the scope-aware visibility decision.

During one deployment window the API accepts the previous flat Organization request as specified by REQ-021. OpenAPI documents both branches and marks the legacy branch deprecated. A follow-up removal must be tracked before compatibility code is deleted.

Resend is used only for external Viewer invitations created under People You Invite. Organization and Private make no email request. Stripe is never called by this feature; an unavailable Free-plan invitation and an external paid-seat role fail before persistence.

## Data and migration

A forward Prisma migration introduces `SiteAccessScope` with `ORGANIZATION`, `PEOPLE_INVITED`, and `PRIVATE`, adds a required scope to Site, and makes its Organization capability nullable. A database constraint MUST enforce that Organization scope has a capability while People You Invite and Private do not. Existing rows map only to Organization using their current capability.

Existing Site grants and invitations are preserved. New Organization and Private requests store no invitee grants or invitations; the creator grant remains explicit. People You Invite persists only validated direct grants and invitations. The request digest includes the normalized discriminated branch so idempotent replay cannot cross scopes.

## Security and privacy

Site scope is an authorization input and is therefore enforced independently on every server read and write. The session determines the creator, Organization, Plan, and Organization Role. Owner override is explicit and tested; `Private` never means anonymous secret-link access. Site IDs remain identifiers rather than authorization credentials.

The API returns generic forbidden, upgrade-required, conflict, validation, dependency, and not-found outcomes without revealing whether an inaccessible Site, Membership, or external email exists. Responses and logs exclude invitation tokens, raw credentials, provider data, and unbounded personal identifiers. Scope names and categorical outcomes may be logged; Site names and email addresses may not.

## Reliability and observability

Creation remains one serializable PostgreSQL transaction and uses the current durable invitation-delivery worker. Scope-aware list and Activity queries must avoid post-query filtering that could cause pagination or count leaks. Database constraints protect against impossible scope/capability combinations even if application validation regresses.

Existing API and worker availability objectives apply. Add bounded counters for creation outcomes by access scope and categorical rejection reason without Site, User, or Organization identifiers. Alerting continues through existing API error and invitation terminal-failure signals; no new AWS resource is justified.

## Test strategy

- Begin with failing shared-contract tests for the three strict request branches and every contradictory field combination.
- Add failing domain tests for scope visibility, Owner and creator overrides, Organization defaults, invitation requirements, Free-plan rejection, idempotency conflicts, and atomic persistence.
- Add PostgreSQL integration tests for migration mapping, database constraints, tenant isolation, grants/invitations per scope, generic inaccessible reads, and rollback.
- Add frontend tests one behavior at a time: default Organization, open selector, keyboard selection, conditional radios, invite-only validation, Private completion, Back retention, omitted inactive values, pending/error/retry, and close confirmation.
- Add Storybook states for every selector and flow state, then deterministic desktop, narrow, and 200%-zoom screenshots plus interaction and axe checks.
- Add Playwright journeys for all three scopes, Free-plan restrictions, direct Activity access, cross-membership visibility, session expiry, keyboard focus, and responsive reflow.
- Run focused checks during red-green-refactor cycles, then the full specification, formatting, lint, typecheck, unit coverage, integration, build, Storybook, visual/accessibility, E2E, Prisma, OpenAPI, and CDK synthesis gates once before implementation commit and push.

## Rollout and rollback

Deploy the additive enum/column migration and compatibility-capable API before the new frontend. Verify existing-site mapping and categorical legacy-request counts, then deploy the selector UI. Remove legacy request support only in a separately reviewed cleanup after the old client is no longer active.

Rollback first restores the previous frontend, then uses the compatibility-capable API to serve legacy Organization requests. The nullable capability and access-scope column remain in place; no destructive down migration is run. Sites created as People You Invite or Private must retain their restrictive scope during rollback, so the API artifact MUST NOT be rolled back to a version that ignores scope-aware reads.

## Open questions

- None for the access-scope amendment. Cover image upload, changing scope after creation, invitation acceptance, custom roles, and ownership transfer remain separate specifications.
