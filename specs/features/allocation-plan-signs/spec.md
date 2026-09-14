# Feature: Allocation Plan Signs and drawer

- ID: `allocation-plan-signs`
- Status: `approved`
- Approval: User approved this specification and its proposed defaults in conversation on 2026-09-14.
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-14`
- Domain references: `CONTEXT.md — Allocation Plan, Sign, Site, Site Access, Organization Role; docs/domain/figjam-object-catalog.md — Allocation Plan and Sign objects, Nesting map, Organization roles and permissions, Known ambiguities 7 and 10, Current implementation alignment`
- Design authority: User-supplied `Plan_ Populated with signs.png` and `Plan_ Plan dropdown.png`.
- Confirmed decisions: Clicking creates and auto-saves a Sign with an editable generated code. Plan and Site Signage Schedule use the same Sign record. Deleting the selected Sign deletes that record from both views. Type, Function and Colour are single-select dropdowns initially containing only Wall-mounted, Wayfinder and Red. Docs, Photos and Comments stay inactive.

## Problem

The Allocation Plan viewer cannot create, display or edit spatially placed Signs. The current approved viewer explicitly deferred this capability.

## Outcome and success metrics

An authorized manager can click a plan, see a saved Sign at that location, edit it in the reference drawer, and see the same record in the Site schedule after navigation/reload. Repeated requests never duplicate a Sign, and zoom/pan never displaces its attachment to the drawing.

## Non-goals

- Docs, Photos, Comments, custom option management, existing-Sign placement, multiple placements per Sign, marker dragging, multi-selection, bulk deletion, or undo.
- New permissions, billing flows, seeded screenshot Signs, PDF pages beyond the existing first-page preview, or changing existing schedule group classifications.

## Requirements

- REQ-001: Display persisted Signs for the selected Allocation Plan file, including legacy single-file plans. Store normalized x/y coordinates relative to the rendered drawing, not the viewport. Switching files must switch markers without leaking or duplicating Signs. Reject off-image clicks and out-of-range coordinates.
- REQ-002: For users with existing MANAGE_SIGNS permission, hovering a loaded drawing displays the crosshair and Add new hint. A primary click creates one Sign and opens its drawer after success. Ignore Space-pan gestures, drags, zoom controls, selector clicks, marker clicks and drawer interactions. Viewers may select/read existing Signs but never create, edit or delete.
- REQ-003: Creation atomically persists the Sign and its one placement. Generate a unique editable Site-wide code using `SG.001`, `SG.002`, etc., skipping occupied codes transactionally. Default quantity is 1, status UNSPECIFIED, location/content/comments empty, orientation down, mounting type Wall-mounted, function Wayfinder, marker colour Red. Codes and content retain existing schedule validation limits.
- REQ-004: Proposed schedule grouping: new plan-created Signs belong to a Site-local group named `Plan signs`, created atomically if absent, using existing group-color assignment rules. This is distinct from the drawer's mounting Type and does not reclassify existing Signs. This proposed default is subject to approval with this specification.
- REQ-005: Markers use a 24px direction circle beside a compact code label matching the reference, orange-red for the initially supported Red option. Labels remain screen-readable and constant in screen size as the drawing zooms. Selecting an existing marker opens its drawer without creating a Sign. The selected marker has the reference dashed blue selection outline.
- REQ-006: The right drawer is approximately 350px wide, overlays the plan beneath the site tabs, and extends to the bottom toolbar. Match the reference close button, code input, tabs, General attributes text, 40px dropdowns, eight-direction orientation strip, content textarea and bottom Delete sign button. Drawer opening must not change normalized placement coordinates. Use the selected plan's real name in the breadcrumb and retain the file selector.
- REQ-007: Type, Function and Colour are extensible single-select controls whose initial allowed values are respectively Wall-mounted, Wayfinder and Red. Reject unsupported values on both client and server. Eight orientation values select corresponding arrow directions. Docs, Photos and Comments remain visibly disabled and perform no navigation or request.
- REQ-008: Code/content save on changed valid blur or Enter (textarea Enter inserts a newline); dropdown/orientation changes save immediately. Show saving, saved and bounded retry/error states. Preserve unsaved input on failure; use updatedAt optimistic concurrency, reject stale edits and offer reload rather than overwrite. Closing while saving must not cancel a durable server change or silently discard unsaved failed edits.
- REQ-009: Delete sign requires confirmation identifying the selected code and explaining removal from the plan and Site schedule. Delete the shared Sign and its placement atomically, and close the drawer on success. Never delete other Signs, Sign Types, plan files or media. Failure retains the selected Sign with a retry message. No undo is promised.
- REQ-010: Both views load canonical Sign code/content and current records, so drawer changes appear in the schedule and schedule edits appear on the plan after refresh/navigation. No duplicate frontend-only Sign model. Existing schedule Signs without placements remain unchanged.
- REQ-011: All endpoints derive tenant and membership from the existing session and verify Site Access, plan/file membership and Sign ownership. Creation/update/deletion require MANAGE_SIGNS. Reuse exact-origin mutation protection, strict contracts, private/no-store responses, generic unavailable/not-found outcomes, existing Sign allowance enforcement and categorical logs without drawing coordinates, names or content.
- REQ-012: Creation uses a client-generated idempotency key scoped to tenant and request payload. Duplicate retries return the original Sign; changed payload under the same key conflicts. Prevent accidental repeated clicks while a creation is pending. Failed creation must not leave a misleading saved marker. File changes and unmounts must ignore stale responses.
- REQ-013: Preserve zoom, Space-pan and safe image/PDF rendering. Add the reference lower-right zoom pill and truthful Add sign toolbar hint. Keyboard users can focus the drawing, move a placement cursor with arrows and create with Enter; Escape cancels placement/closes the drawer with unsaved-change protection. Markers and drawer controls have accessible names, visible focus and appropriate status announcements. At narrow widths the drawer stays within the viewport with bounded vertical scrolling.

## Acceptance scenarios

### AC-001 — Create shared Sign [REQ-001..REQ-005, REQ-010, REQ-012]

Given a loaded file and an authorized manager, when they click within the drawing, then one saved Sign appears at the clicked coordinates and opens in the drawer. After navigation to the Site schedule the same Sign appears under Plan signs. Retrying creation does not add a second record.

### AC-002 — Edit and delete [REQ-006..REQ-010]

Given a selected Sign, when the manager edits its code/content/orientation, then changes persist and survive reload. When they confirm Delete sign, then only that shared Sign and placement disappear from both views. Failure or stale updates remain visible and recoverable.

### AC-003 — Coordinate and access safety [REQ-001, REQ-002, REQ-011..REQ-013]

Given zoomed/panned content, multiple files, a Viewer, a different Site, or another tenant, when interaction/read/mutation occurs, then placement stays attached to its drawing and no unauthorized read or write succeeds. Pan gestures never create Signs.

## UX and accessibility

Use existing Figtree, icon patterns and controls. Add Storybook hover, populated, selected drawer, read-only, pending, failure, empty, long-code, zoom/pan and narrow states. Disabled tabs remain truthful. Screenshot labels and sample Signs are not production seeds.

## API and integrations

Add strict GET/POST plan-file Sign endpoints and PATCH/DELETE selected Sign operations, documented in OpenAPI with existing authorization, errors, idempotency and concurrency conventions. Reuse the existing schedule Sign record and module validation. No external services or media uploads are added.

## Data and migration

Add a tenant/Site-bound placement relation uniquely attached to one Sign, referencing the Allocation Plan and optional completed file association (null only for legacy content), with normalized coordinates. Add mounting/function/marker-colour/orientation attributes using the accepted values. Add an idempotency record and constraints necessary for race-safe creation and deletion. Existing Signs remain unplaced; do not backfill sample markers or move existing groups. Use a forward additive migration; Sign deletion cascades only to its placement. Validate all related IDs within the same Site/tenant.

## Security and privacy

Authorization must precede object disclosure. Server checks are authoritative even with manipulated client state. Render labels/content as text; never execute uploaded drawing content. Log only categorical outcomes and existing internal correlation IDs.

## Reliability and observability

Atomic shared-record writes, idempotent creation and optimistic updates prevent duplicates and silent overwrites. Add bounded plan_sign_read/create/update/delete success/failure events using existing logging; retain API health and error monitoring. No new infrastructure.

## Test strategy

After approval, write failing contracts and module tests first, then database integration tests for placement ownership, atomic creation/deletion, group/code races, retries and stale edits. Add browser tests for click-to-create, shared schedule visibility, marker selection, drawer edits/deletion, file switching, zoom/pan alignment and Viewer restrictions. Verify desktop geometry, keyboard, narrow layouts and accessibility; run affected unit, types, lint, build and migration checks.

## Rollout and rollback

Gate reads and mutations behind allocationPlanSignsEnabled, default off in production. Apply the additive migration before enabling the UI/API. Disable the flag to roll back without deleting Signs or placements. Approval supersedes only the Sign-placement exclusions in allocation-details-design and site-signage-schedule; other viewer/schedule behavior remains unchanged.

## Open questions

- None beyond approving the explicitly proposed generated-code prefix and Plan signs grouping above.
