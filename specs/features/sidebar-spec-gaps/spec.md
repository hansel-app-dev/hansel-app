# Feature: Sidebar specification gaps 1–4

- ID: `sidebar-spec-gaps`
- Status: `draft`
- Owner: `Product`
- Technical owner: `Web platform`
- Last updated: `2026-10-11`
- Domain references: `CONTEXT.md` — Organization, Membership, Organization Role, Site, Site Access; `docs/domain/figjam-object-catalog.md` — Objects and data points (Organization, User, Site), Organization roles and permissions, Known ambiguities requiring specification. The approved Main Sidebar Notion page is the product source for navigation behavior and workspace-menu actions; the catalog is discovery evidence only.

## Problem

The shared sidebar currently has four gaps against the approved Main Sidebar specification: Invite members is rendered as a disabled placeholder, Free plans have no upgrade action, Shared Sites routes to the owned-sites view, and the sidebar New site action disappears in an empty workspace for users who can create Sites.

## Outcome and success metrics

Users see only actions available to their Organization Role, can reach the specified empty and populated My Sites and Shared Sites views, and can begin the specified Invite members and Free-plan upgrade flows without a full-page reload. Automated acceptance coverage exercises each behavior.

## Non-goals

- Do not add whole-sidebar collapse, mobile/narrow-screen behavior, or pinned Sites.
- Do not change Site Access authorization rules or introduce new Organization Roles.
- Do not implement billing or upgrade checkout; the Free-plan action only enters the existing upgrade flow boundary.
- Do not infer additional shared-site semantics from the FigJam catalog. A Shared Site is a Site in the current accessible-site result that the current Membership did not create.

## Requirements

- REQ-001: For a Membership authorized to invite members, the Organization menu MUST render Invite members as an enabled menu item that opens the existing Invite members modal flow. For a Membership not authorized to invite members, the item MUST be absent rather than disabled.
- REQ-002: When the Organization plan is Free, the Organization menu MUST show an enabled Upgrade action adjacent to the non-clickable plan badge. Selecting it MUST invoke the existing upgrade-flow boundary. Non-Free plans MUST not show the Upgrade action.
- REQ-003: Selecting Shared Sites MUST navigate to a distinct Shared Sites view. That view MUST contain only accessible Sites not created by the current Membership and MUST show the approved Shared Sites empty state when the filtered result is empty. Selecting My Sites MUST continue to show Sites created by the current Membership.
- REQ-004: The sidebar MUST show New site for roles authorized to create Sites even when the current My Sites result is empty, and MUST hide it for Editors and Viewers according to the approved sidebar role policy. The action MUST retain the existing site-limit disabled state when the role is authorized but the allowance is exhausted.
- REQ-005: Existing Home, My Sites count, five-site display limit, nested Site indentation, truncation, tooltip, active-state, keyboard, and focus behavior MUST remain unchanged.

## Acceptance scenarios

### AC-001 — Invite members action [REQ-001]

- Given an Owner or Administrator with the Organization menu open
- When the user selects Invite members
- Then the Invite members modal opens and the menu closes

### AC-002 — Restricted invite action [REQ-001]

- Given a role without invite permission
- When the Organization menu opens
- Then Invite members is not present in the menu

### AC-003 — Free plan upgrade [REQ-002]

- Given a Free-plan Organization with the Organization menu open
- When the user selects Upgrade
- Then the upgrade-flow boundary is invoked

### AC-004 — Shared Sites filtering [REQ-003]

- Given accessible Sites created by the current Membership and Sites shared to that Membership
- When the user selects Shared Sites
- Then only shared Sites are shown, and selecting My Sites shows only Sites created by the current Membership

### AC-005 — Shared Sites empty state [REQ-003]

- Given no accessible shared Sites
- When the user selects Shared Sites
- Then the approved Shared Sites empty state is shown

### AC-006 — Empty-workspace New site [REQ-004]

- Given an Owner or Administrator with zero My Sites
- When the sidebar renders
- Then New site is visible under My Sites and opens the existing create-site flow

### AC-007 — Role-hidden New site [REQ-004]

- Given an Editor or Viewer
- When the sidebar renders
- Then New site is absent

## UX and accessibility

The menu items remain keyboard reachable, expose menuitem semantics, and announce state through accessible names. Hidden actions are omitted from the accessibility tree. Empty states use the existing Site empty-state visual language. The shared sidebar remains the single component rendered by `ApplicationShell`.

## API and integrations

Extend the sites-navigation contract so the server returns the current Membership's created Sites and shared Sites without weakening existing Site Access checks. Preserve backward-compatible response parsing during rollout. Wire Invite members and Upgrade to the existing application callbacks or explicit deferred boundaries; no external billing or invitation provider is introduced by this feature.

## Data and migration

No schema migration is required. The server classifies accessible Sites using existing `createdByMembershipId` ownership and Site Access predicates.

## Security and privacy

Shared Sites MUST be filtered server-side from the authenticated Membership's accessible Sites. The client MUST NOT receive or expose inaccessible Sites. Invite member visibility MUST use the existing Organization Role capability checks.

## Reliability and observability

Navigation and modal callbacks preserve existing error handling. Failed Site navigation retains the current retry/error boundary. No new persistent telemetry is required; existing request/error logging remains sufficient.

## Test strategy

Add contract tests for the navigation response, API tests for server-side My Sites/Shared Sites filtering, and web tests for menu visibility, upgrade callback, empty Shared Sites, empty-workspace New site, and role-hidden actions. Each test references the applicable requirement ID.

## Rollout and rollback

Deploy the contract/API changes before the web change. The web client must tolerate the previous response shape during the compatibility window. Rollback is a normal application rollback; no migration reversal is required.

## Open questions

- None.
