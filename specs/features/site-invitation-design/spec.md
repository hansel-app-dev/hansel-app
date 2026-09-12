# Feature: Site invitation design refresh

- ID: `site-invitation-design`
- Status: `approved`
- Approval: User approved in conversation on 2026-09-12; direct-main workflow without a PR as requested.
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-12`
- Domain references: `CONTEXT.md — Site, Site Access, Membership, Organization Role, Administrator; docs/domain/figjam-object-catalog.md — Site and User objects, Organization roles and permissions, Known ambiguities 4, 6, 7`
- Design authority: User-supplied `Invitation.png`, 1512×982, received 2026-09-12.

## Problem

The invitation step uses an oversized dialog, duplicate section heading, and large member rows instead of the supplied compact design.

## Outcome and success metrics

Match the reference geometry within 2 CSS pixels at 1512×982 with four rows, retaining working invitation controls and existing authorization.

## Non-goals

No new invitation delivery, billing, directory lookup, creator removal, permissions, or API behavior. No changes to other modal steps or Site listing membership previews.

## Requirements

- REQ-001: Use a centered 500px-wide white dialog, 6px corners, blurred gray backdrop, and 50px header titled `Invite team members`. At four rows without wrapped text the dialog is approximately 558px high (x506/y212). Keep the close control and accessible dialog title synchronized.
- REQ-002: Below the header, use 24px horizontal padding and the text `Invite people to access the site and collaborate`. Place the email/member input, role selector, and Add button on one 40px-high row, with 8px gaps and desktop widths 266px, 110px, and 60px. Retain accessible labels, validation and existing input behavior; do not add a nonfunctional email dropdown. Show Administrator as `Admin` in compact visible controls, retaining the existing role value and accessible full name.
- REQ-003: Separate the invitation controls from Who has access with a full-width divider. Use 24px horizontal padding; rows are 452px wide, at least 56px high, with 8px gaps, 6px corners, and 32px initials avatars. Names/status appear on the first line and internal email on the second. Use real creator and staged assignment data, not sample names.
- REQ-004: Internal rows use blue borders and a pale blue surface; external Viewer rows use purple borders and a pale purple surface. External paid-seat-role warnings use orange borders, pale orange surfaces, red explanatory text and role badge. Keep Internal/External text visible so color is not the only signal. Match the screenshot palette subject to readable text contrast.
- REQ-005: Place compact editable role badges and circle-X removal controls at the right of staged rows. Preserve role changes and removal behavior. The creator remains an unremovable Internal Administrator: omit its removal control despite the sample screenshot. Preserve duplicate handling, Free-plan restrictions and external paid-seat blocking; Create site remains disabled while a paid-seat warning exists despite its active appearance in the screenshot.
- REQ-006: Use a 72px pale footer with 24px horizontal padding, progress on the left, and Back/Create site on the right with a 16px gap and 40px height. Keep truthful Step 2 of 3 when cover images are enabled and Step 2 of 2 otherwise. Preserve Back state, idempotency, pending/failure states, and cover progression.
- REQ-007: Retain focus trapping, Escape/dismissal confirmation, labelled form controls, announced errors and visible focus. Allow longer identities, warnings and errors to expand rows/dialog without overlap. At 320px and 200% zoom, wrap controls and bound dialog scrolling without horizontal page overflow.

## Acceptance scenarios

### AC-001 — Reference layout [REQ-001..REQ-004, REQ-006]

Given a creator and three staged assignments covering Internal, External Viewer and external paid-seat warning states, when the invitation step opens, then header, controls, rows and footer match the supplied reference geometry with real fixture data.

### AC-002 — Preserve behavior [REQ-002, REQ-005, REQ-006]

Given staged assignments, when the user changes roles, removes an assignment, goes Back, or submits, then existing validation, preservation and creation behavior remains unchanged. The creator cannot be removed and paid-seat warnings prevent submission.

### AC-003 — Accessible layout [REQ-007]

Given keyboard use, long identities, errors, narrow width or zoom, when the user operates the dialog, then all controls and content remain accessible without overlap or page overflow.

## UX and accessibility

Reuse the existing modal and controls. Style only the invitation step. Document normal, mixed members, warning, pending, error and narrow states in Storybook. Sample screenshot values are visual reference data only.

## API and integrations

Unchanged. No new network requests or external side effects.

## Data and migration

None. No persistence or domain-model changes.

## Security and privacy

Preserve existing tenant-derived member choices, creator protection, role validation and invitation restrictions. Never infer new authority from the screenshot.

## Reliability and observability

Preserve existing bounded errors and duplicate-submission guards. No new telemetry.

## Test strategy

Before application edits, add failing browser geometry checks for four-row desktop, narrow and long-content states. Retain and run invitation unit tests for roles, warning blocking, creator protection, Back, creation and errors; run accessibility, types and focused lint checks.

## Rollout and rollback

Frontend-only change on the existing flow; revert the scoped presentation changes to roll back. On approval this supersedes the invitation-redesign exclusion in add-site-design-refresh and compact visible Administrator wording only. No other behavior changes.

## Open questions

- None. Existing security/permission rules govern screenshot inconsistencies.
