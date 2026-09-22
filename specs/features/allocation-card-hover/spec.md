# Feature: Allocation Plan card hover

- ID: `allocation-card-hover`
- Status: `approved`
- Approval: User approved implementation on 2026-09-15.
- Follow-up: User requested a slight hover animation; use a 150ms ease-out shadow/opacity transition, disabled for reduced-motion preferences. No movement or new behavior.
- Owner: Hansel product
- Technical owner: Hansel engineering
- Last updated: 2026-09-15
- Domain references: `CONTEXT.md` — Site, Allocation Plan; `docs/domain/figjam-object-catalog.md` — Objects and data points (Site, Allocation Plan), Current implementation alignment.
- Design reference: User-supplied `Allcations_ Grid View.png`, 1512 × 982, showing First Floor hovered.

## Problem

Allocation Plan grid cards need the reference hover treatment.

## Outcome and success metrics

Normal and hovered cards visually match the reference: compact white cards, subtle borders, and a bottom shadow plus right-aligned overflow icon on hover, without layout shift.

## Non-goals

No overflow menu actions, data changes, tab lifecycle fixes, surrounding page redesign, or List view changes.

## Requirements

- REQ-001: Match the reference compact grid cards: approximately 275 × 73 CSS pixels on desktop, 16px gap, 1px light border, 3–4px corner radius, white fill, 16px horizontal inset, 20px blue Allocation Plan icon, 14px title, and 12px muted timestamp. Preserve actual names, timestamps, responsive wrapping and client-side plan navigation.
- REQ-002: On card hover or keyboard focus within, show a subtle gray bottom drop shadow and vertically centered three-dot icon at the right of the title row. Normal cards have no hover shadow and hide the icon. Reserve icon space to prevent title/layout shifts; long names truncate. Do not translate or resize the card.
- REQ-003: Keep the three-dot icon decorative and non-interactive, consistent with the approved collection scope. Do not invent menu actions. Preserve the link's accessible full name and visible keyboard focus.

## Acceptance scenarios

### AC-001 — Normal and hover [REQ-001, REQ-002]

Given populated Allocation Plans in Grid view, when hovering one card, then only that card gains the reference shadow and overflow icon, while its bounds and surrounding cards remain unchanged. Moving away restores the normal state.

### AC-002 — Keyboard and navigation [REQ-002, REQ-003]

Given keyboard navigation, when focusing a plan link, then the matching hover treatment and focus indicator appear. Activating the link retains existing client-side navigation. The decorative icon is not a separate focus target.

### AC-003 — Responsive [REQ-001]

Given narrow screens and long names, when showing Grid view, then cards fit the available width and titles truncate without horizontal page overflow.

## UX and accessibility

Use the supplied screenshot for the card states only. Retain existing accessible links and grid/list controls. Extend existing Storybook coverage with normal, hover, keyboard-focus and long-name examples.

## API and integrations

None; existing navigation and requests remain unchanged.

## Data and migration

None. Screenshot names are examples, not seed data.

## Security and privacy

Existing Site access remains unchanged. No new actions or telemetry.

## Reliability and observability

Existing loading, failure and empty states remain unchanged. Verify no layout shift on hover.

## Test strategy

Write regression checks before implementation. Browser tests compare normal/hover/focus computed styles, icon visibility, unchanged bounds and narrow layout. Run relevant unit tests, lint and type checks.

## Rollout and rollback

Ship with the web application after approval and verification; commit and push to main. Revert the implementation commit to roll back. No flag or migration required.

## Open questions

None. Overflow actions remain deferred under the existing approved scope.
