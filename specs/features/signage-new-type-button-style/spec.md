# Feature: New sign type primary button

- ID: `signage-new-type-button-style`
- Status: `approved`
- Approval: User explicitly approved this specification in the Codex task on 2026-09-27.
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-27`
- Domain references: `CONTEXT.md — Sign, Site, Site Access, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Sign, Sign Type), Organization roles and permissions, Current implementation alignment (Sign)`
- Design authority: Existing Log in button and shared Button primary variant.

## Problem

The Signage Schedule's New sign type action uses the secondary button style. The user requests styling similar to Log in, which uses the shared Button primary variant.

## Outcome and success metrics

New sign type uses the same primary background, white text, border, typography, corner radius, shadow, hover and focus styling as Log in.

## Non-goals

- Changing button copy, plus icon, placement, intrinsic width, permissions or creation behavior.
- Changing shared Button tokens, the Log in button, backend, API or database.

## Requirements

- REQ-001: New sign type MUST use the existing shared Button primary variant, including its hover, focus and disabled styles, retaining the existing label, plus icon, margin and content-sized width.
- REQ-002: Activating the button MUST retain the existing inline draft and focus behavior. Viewer visibility and creation/save/error behavior MUST remain unchanged.
- REQ-003: Existing Signage Schedule Storybook states MUST render the updated style. Verify the normal, hover and keyboard-focus appearance and existing create flow using the current tests and stories.

## Acceptance scenarios

### AC-001 — Match Log in styling [REQ-001, REQ-003]

- Given an authorized manager opens the Signage Schedule
- When New sign type is rendered, hovered or keyboard-focused
- Then it uses the shared primary style used by Log in, keeping its current icon, label, position and content-sized width.

### AC-002 — Preserve interaction [REQ-002, REQ-003]

- Given a manager or Viewer opens the schedule
- When the manager activates New sign type
- Then the existing focused inline draft appears and creation still works
- And the Viewer has no creation control.

## UX and accessibility

Reuse the existing primary button's contrast, minimum target size, visible focus and native keyboard operation. Preserve the accessible name and draft focus. Retain the existing reusable component and Storybook schedule states.

## API and integrations

No changes.

## Data and migration

No changes or migration.

## Security and privacy

Existing permissions and server authorization remain unchanged.

## Reliability and observability

Existing creation failure feedback and telemetry remain unchanged.

## Test strategy

After approval, run the existing schedule component tests and browser creation check. Inspect normal, hover and focus styles in Storybook and compare their shared primary tokens to Log in. Run specification checks, relevant formatting, lint and TypeScript. This reversible presentation change does not require new tests that repeat the Button implementation.

## Rollout and rollback

Commit and push this specification separately and obtain explicit approval before editing application code. Implement by switching the existing button variant; verify, review the staged diff, commit and push to origin/main and verify the remote commit. Roll back by restoring the secondary variant. No deployment or database operation is needed locally.

## Open questions

- None.
