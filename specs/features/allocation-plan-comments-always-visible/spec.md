# Feature: Keep Allocation Plan comment pins visible

- ID: `allocation-plan-comments-always-visible`
- Status: `approved`
- Approval: User explicitly approved this specification in the Codex task on 2026-09-27.
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-27`
- Domain references: `CONTEXT.md — Allocation Plan Comment, Allocation Plan, Site Access, Membership, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Allocation Plan Comment, Allocation Plan), Nesting map, Organization roles and permissions, Known ambiguities 7–10, Current implementation alignment (Allocation Plan Comment), How feature work must use this catalog (allocation-plan-comments and allocation-plan-comment-moving amendments)`
- Design authority: User correction that the Allocation Details Show resolved checkbox and hiding resolved comments were not required; existing comment card and pin appearance.
- Supersedes on approval: `allocation-plan-comments REQ-006, AC-003, UX and accessibility and Open questions only where they require the Show resolved control or default hiding; allocation-plan-comment-moving AC-005 only where it assumes Show resolved; the catalog's Show resolved wording. Resolution, reopening, discussion retention, read-only resolved history and open-only movement remain authoritative.`

## Problem

Allocation Details adds a Show resolved checkbox and hides resolved pins by default. This visibility workflow was an addition to the supplied design and the user has questioned its scope. It adds a control and makes retained discussions disappear from the drawing.

## Outcome and success metrics

Allocation Details displays open and resolved comment pins together without a visibility checkbox. Resolving a thread keeps its pin on the same drawing; a reload restores it and its retained discussion. There is no new filter or replacement visibility control.

## Non-goals

- Removing Resolve/Reopen or stored resolution metadata; changing participation, attachments, mentions or discussion retention.
- Moving resolved pins before reopening, changing Sign/Area/Linear behavior or adding new navigation, controls, notifications or realtime updates.

## Requirements

- REQ-001: Remove the Show resolved checkbox and its visibility-filter state from Allocation Details. Do not replace it with another filter/control. Request and render open and resolved threads together; do not hide a thread because it is resolved.
- REQ-002: Resolving a thread MUST retain its pin at its existing coordinates with the existing distinguishable resolved appearance and accessible label. Preserve the existing card-close behavior after successful resolution. Selecting the visible resolved pin MUST open its retained read-only history and Reopen action; reopening restores replies and open-pin appearance. All existing current Site-access COMMENT participants, including Viewers, retain their accepted permissions. Only open threads can move.
- REQ-003: The marker listing MUST include open and resolved threads in the same deterministic createdAt/ID pagination, with the existing page size and capacity limit. Make the default server listing inclusive and remove the visibility option from the web client transport and documented OpenAPI query. For compatibility, the server MAY accept the former valid resolved=true/false query, but it MUST no longer exclude resolved threads; invalid legacy values still return 400. Root, reply, state, position, history and attachment contracts remain unchanged. No filtering by resolution may remain in the marker service.
- REQ-004: Reloading the drawing or switching away and back MUST restore resolved pins and allow their history to open without enabling a control. A page containing only resolved threads MUST not show No comments. Preserve Load more comments, loading/retry feedback, obsolete-response protection, pending/dirty guards and normalized plan/file ownership.
- REQ-005: Add requirement-linked tests and update existing Storybook states, browser scenarios, client/service/route expectations, OpenAPI, domain/catalog supersession notes and runbooks to match inclusive visibility. Verify unchanged resolution/reopen and movement safeguards, including Viewer participation, retained content, resolved immovability, narrow layouts and pagination. Commit and verify implementation on origin/main after separate specification approval.

## Acceptance scenarios

### AC-001 — No visibility checkbox [REQ-001, REQ-003]

- Given an accessible drawing containing open and resolved threads
- When Allocation Details loads
- Then both types of pins are visible and no Show resolved checkbox or replacement filter exists.

### AC-002 — Resolve, reload and reopen [REQ-002, REQ-004]

- Given an open discussion containing replies, mentions or attachments
- When a participant resolves it
- Then its card closes and its pin remains visible in the resolved appearance at the same coordinates.
- When they reload and select that pin
- Then its retained history and Reopen action are available, while replies and movement remain disabled until reopened.

### AC-003 — Resolved-only drawing and pagination [REQ-003..005]

- Given only resolved threads, or enough mixed threads to require pagination
- When the marker pages load
- Then resolved threads remain selectable without a filter, No comments appears only when the loaded collection is empty, and Load more preserves stable ordering without duplicates.

### AC-004 — Compatibility and isolation [REQ-002..005]

- Given current, legacy or unauthorized clients and different Sites/Allocation Plans/files
- When marker reads or resolution/position writes occur
- Then valid legacy visibility parameters never hide resolved pins, access isolation and private responses remain enforced, and existing stale/resolved movement guards still reject invalid writes.

## UX and accessibility

Remove the visibility row's checkbox. Keep existing loading, empty, retry, pagination and movement failure feedback where needed. Display the existing resolved pin appearance and Resolved accessible label, without introducing extra explanatory text or controls. Retain pin activation, card focus, Resolve/Reopen actions and the accepted keyboard movement behavior. Verify 320 CSS pixels and 200% drawing zoom.

## API and integrations

Update the existing marker GET endpoint, web client and OpenAPI to list all threads by default. Remove the resolution visibility argument from the internal marker-service API. During compatibility, validate any legacy resolved query as true/false but ignore it for visibility. Preserve sessions, exact Origin for writes, existing error categories, feature gating and private no-store/nosniff responses. No external integration is added.

## Data and migration

No migration, backfill or deletion is needed. Reuse thread coordinates, resolution metadata, createdAt/ID ordering, comments, mentions and attachments. Existing resolved records become visible through reads; their stored state does not change.

## Security and privacy

Showing resolved pins does not expand access. Revalidate current Organization, Site, Allocation Plan/file and COMMENT participation under existing policies. Preserve private attachment access, safe text rendering and categorical telemetry without discussion content, coordinates or identifiers.

## Reliability and observability

Use the existing bounded marker pagination, loading/error handling, guards and obsolete-response protection. Preserve retry-safe resolution and position writes. No new polling or telemetry is required. Mixed-thread pagination remains creation-order based.

## Test strategy

After approval, first write failing tests for absence of the checkbox, inclusive initial load, resolving without disappearance, resolved-only empty handling, reload/reopen and inclusive legacy-query handling. Update client/service/route and real PostgreSQL assertions, Storybook Resolved/Viewer states and browser flows. Run relevant unit/integration/browser checks, specification validation, changed-file formatting, lint, types and builds; explicitly report remaining global gates.

## Rollout and rollback

Commit and push this specification separately and obtain explicit approval before application changes, as required by AGENTS.md. Then implement test first and push directly to main after reviewing the staged diff, preserving unrelated work and verifying the commit on origin/main. Use the existing feature flag; no production deployment is authorized. Rollback restores the prior visibility workflow while preserving every thread and its stored resolution state.

## Open questions

- None. Approval selects removal of the checkbox and default hiding while retaining Resolve/Reopen, read-only resolved history and movement only after reopening.
