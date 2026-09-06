# Feature: Organization Tray and Settings

- ID: `organization-tray-settings`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-07`
- Domain references: `CONTEXT.md — Organization, User, Membership, Organization Role, Owner, Administrator, Editor, Viewer, Plan, Seat Allowance; docs/domain/figjam-object-catalog.md — Objects and data points (Organization and User); Canonical interpretation notes; Organization roles and permissions; Known ambiguities 2, 3, 6, and 10; Current implementation alignment`
- Design authority: `User-supplied Dashboard_ Open Organization Tray.png (1512×982) and Settings.png (1512×982)`
- Design evidence: `The Organization-tray design establishes a three-dot trigger beside the Organization name, an anchored menu with Plan, Settings, Invite members, account identity, Organization Role, and Log out. The Settings design establishes a centred modal, dimmed application backdrop, left settings navigation, close control, and an Account overview. “Workspace”, John Smith, john.s@hanselapp.com, Superadmin, Pro Plan, and every sample value are reference content only.`
- Supersedes on implementation: `dashboard-logout REQ-001..REQ-003, REQ-010, and related UX/Storybook text only where they place the account trigger and menu at the bottom of the sidebar; logout request, revocation, failure, security, and navigation behavior remain authoritative`

## Problem

The shared application sidebar currently separates the Organization name at the top from an account-only menu at the bottom. Members cannot open the Organization-level tray shown by the supplied design, and Hansel has no approved Settings surface that truthfully presents the signed-in account without implying unsupported account-management workflows.

## Outcome and success metrics

- Every authenticated application shell shows the real Organization name with one Organization-tray trigger at the top of the sidebar.
- Owner, Administrator, and Editor Memberships can open Settings from the tray; Viewers cannot see Settings or Invite members.
- Settings opens the approved Account overview using real signed-in User and Membership data and no sample values.
- Existing logout behavior remains unchanged after moving into the Organization tray.
- No unsupported Settings, invitation, billing, security, deletion, or profile mutation is implied as available.

## Non-goals

- Implementing the Invite members modal or any Organization invitation API. The tray item is present but unavailable in this increment.
- Enforcing the Free Plan one-invited-member rule before Organization invitations are implemented. The accepted future rule is recorded as one invite for Free Plan; other Plan behavior is unchanged.
- Implementing Preferences, General, Members, or Billing settings content.
- Editing the User name, changing email or password, enabling two-step verification, deleting an account, changing Organization Roles, changing Plan, or account switching.
- Custom arrow-key/roving-focus menu navigation or design-specific responsive tray placement. Baseline native keyboard access and existing sidebar reflow remain required.
- Copying `Workspace`, `Superadmin`, `Pro Plan`, John Smith, the sample email, or any other sample value from the designs.

## Requirements

- REQ-001: The shared `ApplicationShell` MUST render the authenticated Organization’s canonical name at the top-left on Dashboard, Sites, and Site-detail routes. It MUST use `Organization` in accessible/product language and MUST NOT display `Workspace` or an inferred/sample name.
- REQ-002: Beside the Organization name, the shell MUST render one minimum-24×24 button labelled `Open Organization menu`, using the supplied vertical-three-dots treatment and exposing its expanded state and menu relationship. The previous bottom account trigger and duplicate identity block MUST be removed.
- REQ-003: Activating the trigger MUST open one anchored Organization menu beneath the header with this order: current Plan summary; `Settings`; `Invite members`; divider; signed-in User summary with Organization Role badge; `Log out`. Activating the trigger again, pressing Escape, selecting an action, or clicking outside MUST close it. Escape MUST return focus to the trigger.
- REQ-004: The Plan summary MUST use the server-authoritative selected Plan display name and a crown symbol. It MUST be presentation-only and MUST NOT navigate, mutate billing, expose provider price identifiers, or infer `Pro Plan` from the design.
- REQ-005: `Settings` and `Invite members` MUST be visible only for Owner, Administrator, and Editor Memberships. A Viewer MUST see neither item in markup or the accessibility tree. The API-provided Organization Role remains the authorization source; hiding controls is not a server authorization boundary.
- REQ-006: `Invite members` MUST be visibly unavailable and expose `aria-disabled="true"` in this increment; activating it MUST create no modal, request, navigation, or local state. Future invitation work MUST enforce at most one invited Membership for the Free Plan and requires a separately approved specification.
- REQ-007: Activating `Settings` MUST close the Organization menu and open one modal dialog labelled `Settings`. The dialog MUST dim the application, retain the existing visible page underneath, move focus into the dialog, contain an accessible close button, close on Escape or that button, and restore focus to the Organization-menu trigger.
- REQ-008: The Settings modal MUST match the supplied desktop hierarchy: a muted left navigation column and a white content column. The left column MUST contain `Account`, the signed-in User row, `Preferences`, an `Organization` group, `General`, `Members`, and `Billing`. `Account` MUST be the selected view; every unimplemented entry MUST be visibly unavailable, use `aria-disabled="true"`, and cause no navigation or request.
- REQ-009: The Account view MUST show heading `Account`, supporting text `Manage your profile and login information`, a Profile section with deterministic initials, real display name, and canonical Organization Role, plus rows for Email, Password, Two-step verification, and Delete my account. It MUST use `Owner`, `Administrator`, `Editor`, or `Viewer` and MUST never display `Superadmin`.
- REQ-010: The Account view MAY display the signed-in User’s own normalized email returned by the private dashboard response. `Manage email`, `Manage password`, `Enable 2FA`, and `Delete account` MUST be visibly unavailable with `aria-disabled="true"`; they MUST create no request, navigation, prompt, or mutation. Passwords, credential state, authentication-provider identifiers, and two-step-verification state MUST NOT be returned or inferred.
- REQ-011: `Log out` in the Organization menu MUST preserve every approved `dashboard-logout` behavior: one trusted-origin request, duplicate prevention, `Logging out…`, retryable in-menu failure, cookie clearing and session-family revocation on success, and history replacement with `/onboarding`.
- REQ-012: The private Dashboard response MUST add exactly one Organization summary containing bounded canonical name and selected Plan display name, and MAY add the signed-in User’s normalized email to the viewer. It MUST derive visibility from the existing Organization Role, expose no tenant key, Membership/User key, Plan price/provider key, allowance count, password/security state, or other member data, and remain private and `no-store`.
- REQ-013: Organization name, Plan display name, User display name, email, and Organization Role MUST render as untrusted escaped text and truncate or wrap without overlapping controls. Neither browser storage nor analytics may retain these values.
- REQ-014: The Organization menu and Settings dialog MUST meet WCAG 2.2 AA using button/menu/menuitem/dialog semantics as applicable, visible focus, logical Tab order, labelled regions, focus containment for the modal, and at least 24×24 targets. No custom arrow-key navigation is required. Existing 320-pixel sidebar reflow MUST remain usable without document-level horizontal scrolling; no new responsive placement design is introduced.
- REQ-015: The menu, Account view, Viewer variant, unavailable controls, Settings-open modal, logout pending/failure, narrow shell, and 200%-zoom states MUST be represented API-independently in Storybook. Reusable Organization-menu or Settings components and their important states MUST be included.
- REQ-016: Tests MUST cover Organization/Plan response privacy, all four role variants, menu ordering/dismissal/focus, Viewer omission, unavailable Invite members and settings actions, modal focus/close/restore, escaped values, moved logout success/pending/failure, no duplicate bottom account trigger, narrow reflow, 200% zoom, and serious axe violations. Existing logout backend and integration tests MUST remain green.
- REQ-017: Rollout MUST use `organizationTraySettingsEnabled`, default off in production. When disabled, the current approved bottom account menu and logout remain intact and no new Organization/Plan/email fields are required by the browser. Rollback disables the new tray and Settings modal without changing sessions or persisted data.

## Acceptance scenarios

### AC-001 — Authorized member opens the Organization tray [REQ-001..REQ-005, REQ-013, REQ-014]

- Given an authenticated Owner, Administrator, or Editor is using an application-shell route
- When they activate the three-dot Organization-menu trigger
- Then the anchored menu shows the real Plan, Settings, unavailable Invite members, their real identity and Organization Role, and Log out in the approved order
- And the old bottom account trigger and all design sample values are absent

### AC-002 — Viewer receives a constrained tray [REQ-003..REQ-005, REQ-011]

- Given an authenticated Viewer opens the Organization tray
- Then Settings and Invite members are absent from markup and the accessibility tree
- And Plan, the Viewer’s identity and role, and working Log out remain available

### AC-003 — Settings opens a truthful Account overview [REQ-007..REQ-010, REQ-013, REQ-014]

- Given a permitted Membership has opened the Organization tray
- When they choose Settings
- Then the tray closes and a focused Settings dialog presents only the real Account overview
- And all unimplemented navigation and account-management actions are visibly unavailable and inert

### AC-004 — Modal and menu dismiss predictably [REQ-003, REQ-007, REQ-014]

- Given the Organization menu or Settings modal is open
- When the user uses the trigger, outside click, close button, or Escape as applicable
- Then the surface closes without changing application data or route
- And focus returns to the Organization-menu trigger after Escape or modal close

### AC-005 — Logout retains its established contract [REQ-011]

- Given any authenticated Membership opens the Organization tray
- When they choose Log out
- Then the existing pending, success, revocation, cookie, navigation, and retry behavior is unchanged

### AC-006 — Rollout is reversible [REQ-012, REQ-017]

- Given the Organization-tray rollout flag is disabled
- When an authenticated application shell loads
- Then the previously approved bottom account menu remains available
- And the new tray, Settings modal, and expanded browser contract are not required

## UX and accessibility

The Organization tray is visually anchored below the Organization header and uses the supplied neutral surface, border, radius, dividers, icon rhythm, role badge, and compact row spacing. The modal follows the supplied two-column desktop hierarchy while using canonical Hansel language: `Organization` replaces `Workspace`, and the actual Organization Role replaces `Superadmin`.

The designs do not authorize the sample people, Plan, email, role, or destructive behavior. Unshown settings views and unsupported actions remain inert and explicitly unavailable. Native Tab order, Enter/Space activation, Escape dismissal, modal focus containment, focus restoration, visible focus, and screen-reader semantics remain required even though bespoke keyboard navigation and responsive placement are deferred.

## API and integrations

Extend the existing private Dashboard response rather than add a second shell bootstrap request. The additive Organization summary contains only `name` and `planDisplayName`; the existing viewer may add `email`. Existing cookies, authentication replacement, cache headers, and logout operation remain unchanged. No Settings mutation or invitation endpoint is added.

## Data and migration

No Prisma model or migration is required. Organization name, selected Plan display name, User email/profile, and Membership role already exist and are projected through a bounded private DTO. No Settings preferences, menu state, or modal state is persisted.

## Security and privacy

The server resolves the Dashboard response from the authenticated application session and returns only the represented Membership’s User email and Organization summary. Role-based visibility is computed from the server-provided role. This increment introduces no settings mutations, invitation mutations, destructive operations, credential reads, or account-state inference.

## Reliability and observability

The feature adds no database write, queue, third-party integration, or background work. Existing Dashboard loading and retry boundaries cover Organization-summary failures. UI dismissal and unavailable actions remain local. Operational events remain the existing bounded Dashboard/logout events and contain none of the rendered values.

## Test strategy

- Start with strict shared-contract tests for the additive private Dashboard DTO and its bounds.
- Add dashboard adapter tests proving Organization/Plan/email projection and response privacy for each role.
- Add `ApplicationShell` component tests for role visibility, menu behavior, modal focus/dismissal, inert controls, moved logout, hostile text, and rollout-off compatibility.
- Add API-independent Storybook states from REQ-015 and browser checks for keyboard use, focus containment, axe, narrow reflow, and 200% zoom.
- Run focused tests while iterating, then `pnpm verify`, Dashboard PostgreSQL integration, and the relevant authenticated E2E journey.

## Rollout and rollback

Deploy the additive server response and client behind `organizationTraySettingsEnabled=false`, validate all four Organization Roles in the protected environment, then enable deliberately. Rollback disables the flag and restores the existing bottom account menu; logout and server-side sessions are unaffected.

## Open questions

- None. Scope acceptance includes role visibility for Owner, Administrator, and Editor; Viewer omission; a presentation-only current Plan row; unavailable Invite members with the accepted future Free Plan limit of one; replacement of the bottom account menu; the shown Account settings view with unavailable mutation actions; no unshown settings content; baseline accessibility without custom arrow navigation; and no new responsive placement design.
