# Feature: Site header Share and member hover design

- ID: `site-share-hover-design`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-10`
- Domain references: `CONTEXT.md — Site, Site Access, User, Membership, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Site and User), Canonical interpretation notes (Users with access), Organization roles and permissions, Known ambiguities 4 and 10, Current implementation alignment`
- Design authority: User-supplied `Workspace 8/Sites/Site.png` and `Workspace 9/Sites/Site_ Hover on users with access.png`, 1512×982.
- Scope clarification: User requested hover designs only, with no sharing/access dialog on 2026-09-10.

## Problem

The Site header uses small member avatars and oversized Share controls, and lacks the reference's expanding member-access hover treatment.

## Outcome and success metrics

Normal and hovered header controls reproduce the reference geometry within 2 CSS pixels at 1512×982. No new sharing or access behavior is exposed.

## Non-goals

- Sharing/access dialogs, invitations, permission changes, Share dropdown contents, or new API calls.
- Changing Site collection avatars, sidebar, page content, or notification/settings functionality.
- Fake sample members, inferred access grants, profile photos, or unread notification dots.

## Requirements

- REQ-001: The Site-details header MUST use the existing authorized member preview, showing at most three real accepted direct members in existing order. Header avatars MUST be 32px circles with white outlines, 12px initials, blue backgrounds, and 12px overlap. No sample identities or pending invitees may appear. Preserve a truthful accessible member summary and remaining count; zero members MUST show no fabricated avatars.
- REQ-002: At rest, the avatar group MUST end with the reference's pale-gray rounded end cap and decorative circled plus. With three preview members and no remainder, the group MUST be approximately 88px wide and 32px high. The plus MUST NOT be an enabled action. Preserve any real +N remainder as text separate from the decorative plus, allowing the group to grow when needed.
- REQ-003: Pointer hover or keyboard focus within the member group MUST replace the plus end cap with `Manage access` in 12px type on a pale-gray pill. With three members and no remainder, the group MUST expand leftward to approximately 175px, preserving its right edge and the Share control's position. Pointer leave/focus departure MUST restore the resting appearance. No animation is required; reduced motion MUST be respected.
- REQ-004: The Share split control MUST be 96×32px, with a 64px Share segment, 32px chevron segment, 14px type, 1px subtle border, and 4px corners. The member group MUST sit 8px before Share. At the reference desktop width, Share MUST begin near x1264 and y16; the adjacent divider MUST sit near x1384 and span 32px. Align the neighboring notification/settings icons vertically without enabling them or fabricating unread state.
- REQ-005: Share, Share options, and access management MUST remain unavailable. Share buttons MUST retain native disabled semantics; the member-hover group MAY be focusable for an equivalent keyboard preview but MUST communicate that access management is unavailable. Clicks, Enter, and Space MUST open no dialog/menu, navigate nowhere, issue no request, and change no access. Use a default cursor rather than implying an active management action.
- REQ-006: Apply this header treatment consistently across Site Activity, Allocations (including details), and Signage Schedule. Keep other header consumers and collection avatars unchanged. At narrow widths and 200% zoom, controls MUST remain within the existing wrapping header without horizontal document overflow or overlap with the breadcrumb.

## Acceptance scenarios

### AC-001 — Normal and hovered presentation [REQ-001..REQ-004, REQ-006]

- Given a Site with three authorized preview members
- When the header renders, then avatar overlap and Share sizing match the resting reference.
- When the member group is hovered or focused, then Manage access appears and expands the group leftward without shifting Share.
- When hover/focus ends, then the resting appearance returns.

### AC-002 — Truthful unavailable actions [REQ-001, REQ-002, REQ-005]

- Given zero members, one member, three members, or a remaining member count
- When the header renders, then only real authorized membership data is displayed and counts remain accurate.
- When a member clicks or keyboard-activates the controls, then no dialog, request, navigation, or access mutation occurs.

### AC-003 — Accessible and isolated styling [REQ-005, REQ-006]

- Given keyboard use, narrow width, or 200% zoom
- When the header is inspected, then hover-equivalent content and unavailable semantics are understandable without overflow.
- Existing collection avatar styling remains unchanged.

## UX and accessibility

Use Figtree and existing icon assets. Decorative initials/icons are hidden from assistive technology; the group exposes member names/count once. Provide visible focus and an accessible unavailable explanation. The reference's appearance does not authorize working Share controls. A Site-only header sizing option may be added to the shared shell to achieve the 64px reference header without changing other pages; adjust the allocation viewer's existing top-padding compensation so its canvas stays at y151.

## API and integrations

None. Reuse existing Site-summary membership data. Do not fetch expanded member lists or profile images on hover.

## Data and migration

None. No changes to membership, grants, invitation state, ordering, retention, or Site Access.

## Security and privacy

Display only currently authorized preview data. No email disclosure, role-based permission expansion, or new capabilities. All existing server authorization remains unchanged.

## Reliability and observability

Pure local presentation with no new network dependencies, telemetry, timers, or persistence. Existing shell loading/error behavior remains unchanged.

## Test strategy

After approval, add failing tests for normal/hover/focus/unavailable behavior before implementation. Add reusable component Storybook states for zero, one, three, overflow, hover, and narrow cases. Browser tests verify exact geometry, stable Share position, keyboard equivalence, no dialogs/navigation, contrast/axe, and no narrow/200% overflow. Run relevant tests, lint, types, and builds; report unrelated baseline failures separately.

## Rollout and rollback

Ship within the existing Site shell feature boundaries; no new flag or backend deployment required. Revert the presentation component/header integration if visual regressions occur; no data changes need reversal.

## Compatibility and approval

Upon approval, this supersedes the member-hover exclusion and header avatar styling in `site-details-activity-shell` and dependent Site-section specs only. Native disabled Share behavior, membership disclosure limits, and unavailable notification/settings behavior remain in force. Await approval before application changes.

## Open questions

- None. This is a presentation-only amendment; management dialogs remain deferred.
