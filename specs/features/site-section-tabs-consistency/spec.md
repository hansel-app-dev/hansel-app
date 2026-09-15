# Feature: Consistent Site section tabs

- ID: `site-section-tabs-consistency`
- Status: draft
- Owner: Hansel product
- Technical owner: Hansel engineering
- Last updated: 2026-09-15
- Domain references: `CONTEXT.md` — Site, Allocation Plan, Sign, Activity; `docs/domain/figjam-object-catalog.md` — Objects and data points (Site, Allocation Plan, Sign), Current implementation alignment. This is presentation only; no catalog labels introduce behavior.

## Problem

Activity, the Allocation Plan listing, and Signage Schedule display inset, rounded section navigation, unlike the flat, full-width navigation on Allocation Plan details.

## Outcome and success metrics

All four Site views render the same section-tab geometry and styling, using current Allocation Plan details as the reference. Browser checks verify identical navigation bounds at equal viewport sizes.

## Non-goals

No changes to page contents, Sign placement, sharing, routing destinations, permissions, or data. Do not add tab menus or change sticky-scroll behavior.

## Requirements

- REQ-001: Activity, Allocation Plan listing, Allocation Plan details, and Signage Schedule use one consistent tab bar directly below the Site header. Match existing Allocation Plan details: full content-column width, white background, bottom border, no outer top gap, rounded card, side/top borders, or shadow; retain its existing tab heights, horizontal padding, spacing, labels and icons.
- REQ-002: Highlight the current section with the existing bottom underline and preserve accessible link names, keyboard focus, `aria-current`, and client-side navigation. Allocation Plan details keeps Allocations active.
- REQ-003: Preserve each view's content and content-side padding; keep separation between the tab bar and listing/activity/schedule content. At narrow widths, the bar remains within the content column and supports horizontal overflow without clipping links.

## Acceptance scenarios

### AC-001 — Consistent geometry [REQ-001]

Given equal desktop viewport sizes, when viewing each of the four Site views, then navigation has identical position, width, height and styling, matching Allocation Plan details.

### AC-002 — Navigation [REQ-002]

Given any Site view, when a section link is activated by pointer or keyboard, then its existing destination opens without a full page reload and only the current section is marked active.

### AC-003 — Content and responsive layout [REQ-003]

Given desktop and narrow viewports, when switching Site sections, then their content remains available with existing side padding and every tab remains reachable without causing page-width overflow.

## UX and accessibility

Reuse the existing navigation landmark and link semantics. Preserve visible keyboard focus and horizontal scrolling. This specification supersedes prior inset-card tab presentation only; other approved view designs remain unchanged.

## API and integrations

None; existing routes and requests are unchanged.

## Data and migration

None.

## Security and privacy

Existing Site access enforcement remains unchanged. No new data collection.

## Reliability and observability

Existing loading and error states remain unchanged. No new telemetry is needed for this visual change.

## Test strategy

Add regression checks before application changes for shared layout, active states and navigation. Verify desktop/narrow browser geometry across all four views. If extracting a reusable navigation component, add Storybook states for each active section and narrow layout. Run relevant tests, lint and type checks.

## Rollout and rollback

Ship with the web application; no feature flag or migration. Revert the implementation commit to restore previous presentation. Commit and push implementation to main after verification.

## Open questions

None.
