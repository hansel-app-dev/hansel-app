# Feature: Allocation Plan Add linear

- ID: `allocation-plan-add-linear`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-23`
- Domain references: `CONTEXT.md — Sign, Allocation Plan, Area, Site, Site Access, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Sign and Allocation Plan), Nesting map, Organization roles and permissions, Known ambiguities 7 and 10, How feature work must use this catalog (allocation-plan-signs, sign-function-options, sign-additional-type-options, allocation-plan-toolbar, allocation-plan-tool-cursors)`
- Design authority: `references/on-click.png and references/applied.png; explicit user decisions: Linear is a Sign in the Signage Schedule; creation drags one straight segment; Function remains editable; Type is Safety Decal and Colour is Orange for now.`
- Supersedes on approval: `The disabled fifth toolbar tool and point-only Sign placement contract. The existing Red-only Colour restriction is amended for Linear Signs only. The screenshot's extra menu types are excluded by the user's latest instruction. Existing point Sign and Area behavior remains unchanged.`

## Problem

Users cannot place the linear signage shown in the supplied design because the fifth toolbar tool is disabled and Sign placements store only a point.

## Outcome and success metrics

A manager can create, inspect, move, resize and delete a straight Linear Sign. Its geometry and metadata survive reload and its Signage Schedule row represents the same Sign. One completed creation produces exactly one shared Sign and one placement, including after retries.

## Non-goals

- Polylines, curves, freehand drawing, measurements, snapping, multi-selection or conversion between point and linear placement.
- Privacy Decal, Environmental or custom Linear types, additional Linear colours, new Site Sign Type groups or independent annotation records.
- Enabling the Comment toolbar tool, changing Area behavior or introducing notifications or new Activity event types.

## Requirements

- REQ-001: A Linear Sign MUST use the existing shared Sign record and Site-local Plan signs group. It appears in the Signage Schedule with existing quantity/state defaults. Linear describes placement geometry, not a new independent annotation or Site Sign Type. Existing Site Access governs reads and MANAGE_SIGNS governs creation, editing, movement, resizing and deletion. Viewers can inspect but cannot mutate.
- REQ-002: Enable the fifth toolbar button as Add linear for managers, using its existing supplied artwork and active blue treatment. Use the supplied Linear cursor at 3x asset density (one-third native dimensions), including its scaled hotspot. Move remains the initial mode. Successful creation and accepted existing-Sign selection switch to Move; drawing another Linear Sign requires re-entering Add linear. Hand and Space-pan take precedence. Comment remains disabled.
- REQ-003: In Add linear mode, a primary click on the drawing opens a bounded reference-style menu near that point, headed Add linear sign. Offer Safety Decal with its supplied icon and disabled New type. Choosing Safety Decal closes the menu and arms drawing; the next primary pointer-down sets the start, dragging previews one straight segment, and release sets the end. Opening/dismissing a menu or choosing a type alone creates nothing. Announce the drawing instruction.
- REQ-004: Allow any segment direction, including horizontal and vertical. Persist both endpoints in normalized source-drawing coordinates, finite and within [0,1], independent of zoom, scroll and drawer width. Require at least 4 CSS pixels of segment length at release; shorter gestures write nothing and remain armed. Clamp endpoints to drawing bounds. Submit once with an idempotency key; matching retries return the same Sign, changed-payload key reuse conflicts, and retry after deletion never recreates it.
- REQ-005: Escape, pointer cancellation/lost capture, window blur, tool/plan/file changes, permission loss or viewport/zoom changes cancel unfinished gestures without saving. Entering pan cancels drawing or transformation. Dismiss the menu on outside interaction, Escape, scroll or zoom. Suppress trailing drag/menu clicks, prevent overlapping writes and discard stale responses from an old plan/file. Existing dirty-draft and pending-write guards govern selection, drawer close and tool changes.
- REQ-006: Render a thin dashed Orange (#ff7a00) segment, endpoint handles when selected, and an Orange badge with white code just below its start as in the applied design. Keep the badge outside the line, clamped/flipped to stay reachable at drawing edges. Use a generous invisible hit target around the segment. Geometry scales with the drawing while badge text, stroke and handle hit targets remain legible. Keep point Signs and Areas selectable and permit only one details drawer at a time.
- REQ-007: Assign Pr.01, Pr.02 and subsequent codes, taking the first available positive suffix and enforcing existing case-insensitive Site-wide Sign code uniqueness under concurrent creation. Point Sign SG codes remain unchanged. Reuse existing code/content validation (nonempty code up to 40 Unicode characters and content up to 200), editable orientation (eight directions, default down) and save/concurrency behavior. Orientation is metadata and does not rotate the endpoints.
- REQ-008: The Linear drawer uses the shared Sign General UI with Type Safety Decal only and Colour Orange only, both shown in custom single-option dropdowns. Function is editable through the existing custom dropdown: Identification, Directional, Informational and Regulatory/Statutory, default Regulatory/Statutory. Type and Colour cannot be changed to other values through the API. Existing point Sign type/function/Red choices are unchanged. Fixed single-option selections do not issue writes. Code/content save on blur and changed Function/orientation save immediately with expectedUpdatedAt.
- REQ-009: Reuse existing Sign Docs, Photos and Comments capabilities and permissions, including feature flags, because this is a shared Sign. Doubleside remains disabled/off. The drawer uses Sign copy and Delete sign. Confirmed deletion from either the plan or Signage Schedule removes the same Sign, its placement and its owned media/discussion through existing cleanup rules. Allocation Plan deletion follows existing Sign placement lifecycle; this feature MUST NOT introduce a different parent-deletion policy for Linear Signs.
- REQ-010: In Move mode managers can drag a Linear Sign's segment or badge, preserving its vector and pointer offset, clamping the whole segment within the drawing, with a 3 CSS pixel movement threshold. Selected endpoint handles allow moving either endpoint while holding the other fixed, in any direction, with a minimum 4 CSS pixel length. Commit complete geometry once on release with optimistic concurrency; cancellation restores saved geometry. Failed transformations restore saved geometry and offer retry; conflicts require reload rather than overwriting another edit. Endpoint editing uses directional/precise editing cursor feedback instead of the drawing cursor.
- REQ-011: Provide keyboard creation: Enter on the drawing opens the menu at a keyboard cursor (center initially), Safety Decal arms drawing, arrows position the start in 1% steps, Enter fixes it, arrows position the end, and Enter submits a valid segment. Escape cancels. Alt+arrows on a focused saved Linear Sign translate it by 1% with bounds. Focusable, named endpoint handles support Enter/Space to begin editing, arrows to move in 1% steps, Enter to save and Escape to cancel; leaving an unfinished handle edit cancels it. Focus returns appropriately after dismissal, creation and save without stealing focus from the drawer.
- REQ-012: Add Storybook states for the active toolbar tool, menu, armed/drawing, selected drawer, endpoint editing, Viewer, pending and failure. Verify actual viewer integration with point Signs and Areas, the 1512 × 982 reference layout, narrow viewports and 200% zoom. Controls must remain reachable, visibly focused and named; announce saving, errors and drawing states without keyboard traps.

## Acceptance scenarios

### AC-001 — Draw a shared Sign [REQ-001..REQ-005, REQ-007]

- Given a manager, when Add linear → drawing click → Safety Decal → valid segment drag is completed, then exactly one Linear Sign is saved, selected in General and shown in the Signage Schedule, and Move becomes active.
- Given a reversed, vertical or horizontal drag, when saved and reloaded, then both endpoints match the drawing and the code is Site-unique.
- Given dismissal, a tiny/cancelled gesture, pan or repeated request, then no unintended or duplicate Sign is created.

### AC-002 — Shared metadata and appearance [REQ-006..REQ-009]

- Given a selected Linear Sign, then its dashed Orange line, outside Pr.01-style badge and reference drawer appear with Safety Decal, editable Function and Orange.
- Given changed code, content, Function or orientation, when saved and reloaded, then the shared Sign retains the edit and schedule fields agree wherever represented.
- Given available Sign media/discussion features or deletion in either view, then existing shared ownership and cleanup apply.
- Given a point Sign or Area, then its existing types, colours, permissions and behavior are unchanged.

### AC-003 — Transform and recover [REQ-005, REQ-010, REQ-011]

- Given a selected Linear Sign, when dragging its body/badge or an endpoint, then bounded preview and a single atomic save preserve the appropriate vector or opposite endpoint.
- Given cancellation, failure, stale data or a plan switch, then no partial geometry is saved, drafts remain recoverable and no response contaminates another plan.
- Given a Viewer or foreign Site/Organization, then mutation is unavailable in the UI and rejected by the API.

### AC-004 — Keyboard and layout [REQ-002, REQ-011, REQ-012]

- Given keyboard-only use, when defining two endpoints, translating or editing a handle, then the complete workflow saves or cancels predictably with visible focus.
- Given zoom, scroll, a narrow viewport or drawer opening, then geometry stays aligned and the toolbar, badge, handles and drawer remain usable.

## UX and accessibility

Use the supplied screenshots as visual evidence, with the user's latest Safety Decal/Orange scope overriding extra screenshot menu options. Use the existing Sign drawer, custom dropdowns and supplied tool cursor. Line selection must have an accessible code-based name and not depend on colour alone. Endpoint hit targets are at least 24 CSS pixels. Drawer keyboard interaction must never trigger canvas gestures.

## API and integrations

Extend existing Allocation Plan Sign GET/POST/PATCH contracts and OpenAPI rather than creating independent annotation endpoints. Preserve current x/y as the first endpoint; add an explicit point/linear placement discriminator and paired nullable endX/endY coordinates. Omitted creation discriminator means point for legacy requests. Linear creation requires both endpoints and Safety Decal; server assigns Orange and Regulatory/Statutory. Point creation retains existing defaults. Linear geometry updates require all four coordinates atomically; a legacy x/y-only update against a Linear placement must be rejected to prevent accidental reshaping. Reject zero-length segments, incomplete endpoints, non-finite/out-of-bounds coordinates and incompatible appearance values. Keep existing limits, exact Origin/session checks, private/no-store responses and error conventions. Preserve legacy idempotency digests for point requests; Linear digests include both endpoints and placement kind.

## Data and migration

Extend SignPlacement additively with placement kind (existing rows default point) and optional second endpoint coordinates, using database constraints to enforce point/null-endpoint or linear/complete-distinct-bounded-endpoint shape. Keep one placement per shared Sign and existing composite ownership relations. Appearance stays on Sign; add no duplicate Sign or annotation table. Amend affected appearance constraints to allow Orange on Linear Signs while retaining point behavior through validated service contracts. Backfill no existing Sign appearance. Update canonical domain/catalog documentation with the approved geometry distinction and explicit shared ownership decision during implementation.

## Security and privacy

Derive Organization identity from the authenticated session; validate Site Access and Allocation Plan/file ownership for every request. Mutations require MANAGE_SIGNS and expectedUpdatedAt for edits/deletion. Escape content/code as text, restrict payloads and enforce existing capacity limits. Do not log drawing coordinates, content, media or credentials. Schedule updates must not bypass placement invariants.

## Reliability and observability

Create Sign, placement and idempotency record transactionally with bounded uniqueness/serialization retries. Save endpoint changes and the shared Sign concurrency timestamp atomically. Reuse existing categorical request/error logs and accessible pending/retry/conflict states. Add a runbook for migration and creation/reload/transform/schedule/deletion smoke checks. No new infrastructure is required.

## Test strategy

After approval, write tests first against these requirement IDs. Cover contracts and database constraints, point backward compatibility, idempotency/deleted replay, concurrent codes, ownership/permissions, shared schedule/deletion/media behavior, complete geometry writes, appearance validation, pointer and keyboard creation, move/endpoint editing, cancellation/retry/conflict and plan-switch protection. Add Storybook/browser checks for supplied appearance, custom controls, cursor density, responsive/zoom behavior and existing Sign/Area/Hand regressions. Run relevant unit coverage, API integration, lint, typecheck, specification validation, builds and browser checks; report existing unrelated failures separately.

## Rollout and rollback

Commit and push this draft separately and obtain explicit approval before test-first application changes. Back up local data and apply the additive migration before deploying the API and enabling Add linear in the web client. New API accepts old point requests. Old strict clients are not compatible with new Linear responses: deploy API and web together and require a client refresh before use. Rollback disables new Linear creation while retaining the reader capable of existing Linear Signs and all saved data; do not deploy an old point-only API over active Linear data or destructively remove the new columns.

## Open questions

- None. Approval also accepts the proposed Pr.01 code allocation, endpoint editing, keyboard controls, shared media tabs and API compatibility plan detailed above.
