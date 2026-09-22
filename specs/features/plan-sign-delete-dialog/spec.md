# Feature: Plan Sign delete confirmation design

- ID: `plan-sign-delete-dialog`
- Status: `approved`
- Approval: User approved in conversation on 2026-09-15.
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-15`
- Domain references: `CONTEXT.md — Sign, Allocation Plan, Sign Comment, Site Access; docs/domain/figjam-object-catalog.md — Objects and data points (Sign, Allocation Plan, Sign Comment), Nesting map, Organization roles and permissions, Known ambiguities 7 and 10`
- Design authority: User-supplied `Workspace 8/Sites/Allcations/Plan_ Plan dropdown.png`.

## Problem

The existing Delete sign action uses browser-native confirmation. Replace it with the supplied in-app design while preserving the approved shared-record deletion behavior in `allocation-plan-signs` REQ-009.

## Outcome and success metrics

The in-app confirmation matches the supplied design and deletes only the captured shared Sign after confirmation. Cancellation preserves data and failures remain recoverable.

## Non-goals

No new deletion endpoint, database migration, soft-delete, undo, bulk delete or comment feature. Existing shared-record deletion semantics remain unchanged.

## Requirements

- REQ-001: Delete sign in the selected Sign drawer opens a custom confirmation, without making a delete request. Include the reference trash icon in the drawer action. Only users with existing MANAGE_SIGNS permission can open it.
- REQ-002: At the reference desktop size, the dialog is 350px wide and approximately 212px tall, centered within the visible plan region to the left of the drawer. Match the white surface, 6px corners, shadow, 52px header, dividing line, 24px body padding, pale 72px footer and 40px action buttons. On small screens constrain the dialog within the viewport.
- REQ-003: Title is `Delete sign {saved code}`, with a close icon. Body copy is `The sign and any comments will be permanently deleted.` Footer has outlined Cancel and red Delete buttons. Use the actual saved code, never the screenshot's example. Long codes wrap without overflow; the dialog may grow vertically.
- REQ-004: Dim and blur only the plan region beneath the site tabs and above the bottom toolbar. Keep the sidebar, header, tabs, toolbar and Sign drawer visually unchanged. While confirmation is open, background controls are non-interactive, including the visible drawer.
- REQ-005: Cancel, close or Escape dismiss without mutation and return focus to Delete sign. Outside clicks do not delete or dismiss. Use an accessible modal dialog, labelled title/description, trapped focus and initial focus on Cancel.
- REQ-006: Confirm calls the existing selected-Sign DELETE API once with its captured id and updatedAt. While pending show `Deleting…`, disable repeated submission and dismissal, and retain the dialog. Success removes that Sign from plan and schedule and closes dialog and drawer. Failure retains the Sign and dialog with an inline error and retry; stale conflicts require reload rather than overwriting.
- REQ-007: Do not allow selection changes, dragging, editing, navigation or another write to change the deletion target while confirmation is open. Reuse existing server authorization, exact-Origin checks, optimistic concurrency and atomic deletion.

## Data and migration

No new deletion endpoint, database migration, soft-delete, undo, bulk delete or comment feature. Existing Sign comments text is deleted with the same Sign record. The inactive Comments tab and currently unimplemented Sign Comment object stay unchanged; the screenshot is not authorization to create a comment model or delete unrelated Site Activity/comments. Existing Sign attributes, other Signs, plan files and groups remain untouched.

## Acceptance scenarios

### AC-001 — Confirmation and cancellation [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005]

Given a selected Sign, opening Delete sign shows the reference dialog and plan-only backdrop; Cancel, close and Escape leave all records unchanged and restore focus.

### AC-002 — Guarded deletion [REQ-006, REQ-007]

Confirm removes only the captured shared Sign. Repeated clicks send one request. Failure/stale requests retain recoverable UI and never delete another Sign.

### AC-003 — Layout and accessibility [REQ-002, REQ-003, REQ-004, REQ-005]

Desktop geometry matches the supplied design; keyboard focus stays inside the dialog, background controls cannot be activated, and narrow/long-code states remain usable.

## UX and accessibility

Use the reference dialog geometry and plan-only backdrop. Label the modal with its title and description, initially focus Cancel, trap focus, block background interaction and restore focus on cancellation. Support narrow viewports and long saved codes.

## API and integrations

Use the existing selected-Sign DELETE API with the captured id and updatedAt. No new endpoint or integration.

## Security and privacy

Retain MANAGE_SIGNS, existing server authorization, exact-Origin checks and optimistic concurrency. Keep the deletion target fixed while the dialog is open.

## Reliability and observability

Submit once, disable repeated submission and dismissal while pending, and preserve the dialog and Sign on failure with an inline error and retry. Stale conflicts require reload. Reuse existing deletion error handling without adding telemetry.

## Test strategy

After approval, write failing interaction tests first. Add reusable dialog and confirmation/pending/error/long-code/narrow states to Storybook. Run affected unit, browser geometry/accessibility, deletion integration, type, lint and build checks.

## Rollout and rollback

Reuse allocationPlanSignsEnabled. Rollback restores the prior confirmation UI without changing data or deletion semantics.

## Open questions

- None.
