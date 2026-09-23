# Feature: Allocation Plan Add area

- ID: `allocation-plan-add-area`
- Status: `approved`
- Approval: `User approved this published specification in the Codex task on 2026-09-23.`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-23`
- Domain references: `CONTEXT.md — Allocation Plan, Sign, Site, Site Access, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Allocation Plan and Sign), Nesting map, Organization roles and permissions, Known ambiguities 7 and 10, Current implementation alignment, How feature work must use this catalog (allocation-plan-toolbar, allocation-plan-hand-tool, allocation-plan-single-file and allocation-plan-toolbar-icons amendments)`
- Design authority: `User-supplied references/on-click.png and references/applied.png, plus explicit clarification: Area is a separate annotation, creation is click → choose Floor → drag rectangle, and Environmental/Blue are fixed for now.`
- Supersedes on approval: `The fourth toolbar tool being disabled. No change to Sign type/function/colour options, Sign ownership or Signage Schedule behavior.`

## Problem

The fourth toolbar button is disabled. Users need to mark a rectangular floor area on an Allocation Plan and inspect its details using the supplied design.

## Outcome and success metrics

An authorized user creates a blue rectangular Area annotation, sees its code and drawer, and reloads the same saved geometry and metadata. Creation, editing and deletion never create or modify a Sign or Signage Schedule row.

## Non-goals

- Polygon/freehand shapes, lines, measurement or calculated floor area, resizing existing rectangles, rotation of geometry, multi-selection, bulk changes or cross-plan movement.
- Custom types, additional Function/Colour values, Area documents/photos/comments, double-sided behavior or new notifications/Activity events.
- Implementing the fifth or sixth toolbar tool or changing existing Sign behavior.

## Requirements

- REQ-001: Introduce an Area as a separate annotation owned by one Allocation Plan and its file, within the same Site and Organization. It MUST NOT be a Sign, belong to a Site Sign Type group, appear in the Signage Schedule or reuse Sign media/discussion ownership. Use the existing MANAGE_SIGNS capability for Area create/edit/delete and existing Site Access for reads; Viewers can inspect but cannot mutate Areas.
- REQ-002: Enable the fourth toolbar button for authorized managers, name it Add area and use the supplied area toolbar icon and blue active treatment. Move remains the initial mode. Add area stays active after successful creation, matching the applied reference. Move and Hand remain available with existing pending/unsaved-change guards; Line and Comment remain disabled. Changing Allocation Plan/file resets to Move.
- REQ-003: In Add area mode, a primary click on eligible drawing content opens the reference-style menu near that point: Add area heading, Floor with the existing Floor icon, and disabled New type. Fit/flip the menu within the visible drawing. Merely opening or dismissing the menu creates nothing. Choosing Floor closes the menu and arms rectangle drawing; the next primary pointer-down on the drawing starts the first corner, dragging previews the rectangle, and release completes the opposite corner. Show a brief accessible instruction while armed. A second click is not required after release.
- REQ-004: Support dragging in any direction, normalize to top-left x/y and positive width/height, and clamp the complete rectangle within drawing bounds. Coordinates MUST be relative to the source drawing, independent of zoom, scrolling and drawer width. Require at least 4 CSS pixels in both directions at release; smaller gestures create nothing and stay armed for another attempt. Persist once on valid release with a client-generated idempotency key. Replay of the same request MUST return the same Area; key reuse with different content MUST conflict. Do not show a successful saved annotation until the server acknowledges it.
- REQ-005: Escape, pointer cancellation, switching tool/plan/file, losing permission, window blur, or a zoom/viewport change during an unfinished gesture MUST cancel its preview without a write. Menu outside interaction, Escape, scrolling, zooming or tool changes dismiss the menu. Hand/Space-pan MUST never create or move an Area; entering pan during drawing cancels the preview. Suppress trailing clicks after drag and toolbar/menu interaction. Prevent overlapping writes and prevent unfinished gestures or responses from appearing on another plan/file.
- REQ-006: Render saved Areas with a translucent blue fill (#4096ff at approximately 28% opacity), a thin dashed blue border and a blue badge with white code at the top-right, matching the applied reference. Keep code text legible and reachable near drawing edges. Rectangle dimensions scale with the plan; badge text and border thickness remain legible at supported zoom levels. Keep point Signs above Area fills and interactive. For overlapping Areas use stable creation order, newest on top. Selecting an Area opens only its drawer; selecting a Sign closes the Area drawer through unsaved-change protection, and vice versa.
- REQ-007: Assign Area codes Ar.01, Ar.02 and so on, unique case-insensitively within the Allocation Plan; use the next available number after the highest existing auto-code and retry allocation safely under concurrent creation. Allow editing the code (trimmed, nonempty, at most 40 Unicode characters), content (at most 200 characters) and orientation (the existing eight direction choices, default down). Orientation is metadata and does not rotate the rectangle. Keep Type Floor, Function Environmental and Colour Blue fixed, displayed in custom single-option controls with existing field styling; their menus perform no mutations. These values MUST NOT expand Sign contracts. Show General as active; Docs, Photos and Comments remain visible but disabled. The reference's Doubleside control is disabled/off. Use Area attributes copy and Delete area, replacing the screenshot's Sign-specific copy to reflect the confirmed domain distinction.
- REQ-008: Code/content edits save on blur and orientation commits immediately, using an expectedUpdatedAt concurrency token. Selecting the same value or dismissing controls MUST NOT write. Keep the current draft on failed text saves with retry; conflicts require reload without overwriting server changes. Guard drawer close, selection and tool changes against unsaved edits. On success update the badge and drawer and preserve values after reload.
- REQ-009: In Move mode managers can reposition an Area by dragging its body or badge, preserving width/height and pointer offset, with a 3 CSS pixel movement threshold and bounded preview. Save once on release with optimistic concurrency; failed moves restore the saved rectangle and offer retry. Escape/pointer cancellation restores the original geometry. Alt+arrow on the focused Area moves it by 1% of drawing dimensions, clamped to keep the whole rectangle inside. Viewers can select but not move. Resizing is deferred.
- REQ-010: Delete area requires confirmation and expectedUpdatedAt. Successful deletion removes only that Area and closes its drawer; failure retains it and offers recovery. Area lifecycle follows its parent: deleting an Allocation Plan or Site also deletes its Areas transactionally. It MUST NOT block the existing parent deletion flow or affect Signs. There is no standalone Area attachment cleanup in this version.
- REQ-011: Provide accessible names for menu items, toolbar, saved Area controls and drawer fields; retain visible focus and announce armed/saving/failure states. Provide keyboard creation: Enter on the focused drawing in Add area opens the menu at the keyboard cursor (center initially), Floor selection arms drawing, arrows position the first corner in 1% steps, Enter sets it, arrows position the second corner, and Enter submits a nonzero bounded rectangle. Escape cancels either stage. Focus returns to the drawing after menu dismissal and moves to the new Area after successful keyboard creation. No keyboard trap or accidental drawing action from drawer keys.
- REQ-012: Add Storybook states for the active fourth tool, menu, armed/drawing preview, saved selected Area/drawer, Viewer, pending, failure and overlap with point Signs. Match the reference 1512 × 982 layout and verify narrow viewports and 200% zoom without newly overlapping toolbar/zoom controls or inaccessible drawer content.

## Acceptance scenarios

### AC-001 — Menu and rectangle creation [REQ-001..REQ-005]

- Given a manager, when Add area is selected and the drawing clicked, then the Floor-only menu appears and no record exists yet.
- Given Floor was chosen, when the next drag produces a valid rectangle in any direction, then one independent Area is saved, selected and shown in General while Add area stays active.
- Given a tiny/cancelled gesture, pan or a menu dismissal, then no record or Sign is created.
- Given a failed request and retry, then one Area is ultimately created with the original geometry and idempotency key.

### AC-002 — Appearance and independent details [REQ-006..REQ-008, REQ-012]

- Given a saved Area, when selected, then blue fill, dashed boundary, Ar.01-style badge and the reference drawer appear with Floor, Environmental and Blue.
- Given editable code/content/orientation, when changed and reloaded, then the saved metadata and badge agree; existing Sign values and schedule rows remain unchanged.
- Given a second Area or Sign selection with unsaved content, then existing-style discard protection is honored and only one details drawer is visible.
- Given deferred tabs or Doubleside, when interacted with, then no unsupported action occurs.

### AC-003 — Move, permissions and deletion [REQ-001, REQ-009, REQ-010]

- Given a manager in Move mode, when dragging or using Alt+arrows, then the entire rectangle stays within the file and its saved dimensions remain unchanged.
- Given stale data, failed save, Viewer or foreign Site/Organization, then mutation is rejected and the annotation remains recoverable without affecting Signs.
- Given confirmed deletion, then only the selected Area disappears; deleting the parent removes its Areas without breaking the existing parent lifecycle.

### AC-004 — Keyboard, layout and regressions [REQ-005, REQ-011, REQ-012]

- Given keyboard-only use, when opening Floor, defining two corners and submitting, then one Area is created; Escape cancels without saving.
- Given zoom, scroll, drawer opening and narrow layout, then saved geometry stays aligned with the drawing and controls remain reachable.
- Given existing Add sign/Move/Hand workflows, then their creation, movement, panning, permissions and error protections continue to work.

## UX and accessibility

Use the supplied screenshots for menu, overlay, badge, drawer and active-tool appearance. The confirmed separate-annotation decision governs wording and ownership. Fixed dropdowns use custom styling consistent with Type/Function/Colour. Labels carry meaning independently of colour; disabled tabs expose unavailability. Canvas Areas are individually focusable controls with code-based accessible names. Keep code editing conflicts and save errors accessible. Creation and moving use drawing coordinates, not viewport pixels.

## API and integrations

Add Site/Allocation Plan-scoped Area collection GET/POST and item PATCH/DELETE endpoints alongside the existing plan routes, with separate shared contracts and OpenAPI definitions. GET is scoped to the plan's file and returns Areas plus edit capability. POST accepts fileId, x/y/width/height and idempotencyKey; the server assigns code, defaults and timestamps. PATCH accepts expectedUpdatedAt plus code/content/orientation or paired x/y; dimensions are immutable after creation. DELETE accepts expectedUpdatedAt. Strictly reject unknown fields, non-finite coordinates, nonpositive dimensions, out-of-bounds extents and unsupported values. Use the repository's existing unauthorized/not-found/conflict/validation response conventions, private/no-store responses, exact Origin checks and request limits. No external service integration.

## Data and migration

Add an Area table with UUID identity, Organization/Site/Allocation Plan/file ownership, code and normalized code, normalized rectangle geometry, content, orientation and timestamps. Fixed Type/Function/Colour are server-defined constants rather than user-editable persisted choices. Add plan-local code uniqueness and indexes for tenant/plan/file reads. Preserve composite ownership constraints and support the current legacy null-file plan shape where supported by the viewer. Add an Area idempotency ledger keyed by Organization and request key, including payload digest and associated Area identity; a replay after deletion must not recreate the annotation. Apply additive migrations with constraints for finite bounded geometry, and ensure parent deletion cleans up both tables. Existing Signs and files require no backfill. Update CONTEXT.md and the object catalog with the approved Area definition during implementation.

## Security and privacy

Authenticate all reads/writes and derive Organization identity from the session. Require current Site Access and validated parent/file ownership. Mutations use MANAGE_SIGNS as an explicit initial permission decision, without granting new capabilities to Viewers. Never allow client-supplied tenant ownership or attachment access. Escape code/content as text. Do not log floorplan content, annotation text, pointer coordinates or authentication material.

## Reliability and observability

Use transactional creation/code assignment/idempotency, guarded updates/deletion, bounded retries for database conflicts and stale-response cancellation. Failures MUST retain enough local context for retry without duplicating records. Announce status and use existing categorical request/error logging. No new infrastructure or telemetry containing annotation content. Verify migration, parent deletion and API health in the implementation runbook.

## Test strategy

After separate approval, implement test-first with requirements referenced in contracts, unit, integration and browser tests. Cover independent ownership and absence from the schedule; finite geometry and boundary constraints; concurrent codes, duplicate requests and deleted-request replay; permissions and foreign-file rejection; parent deletion; drawing in all directions under zoom; tiny/cancelled drags and trailing clicks; keyboard creation/movement; drawer metadata persistence; conflict/retry; selection with Signs; and toolbar regressions. Add Storybook states and browser comparisons against both references, plus narrow/zoomed and accessibility checks. Run relevant coverage, lint, types, specification checks, builds and migrations; report unrelated existing failures separately.

## Rollout and rollback

Publish this specification separately for approval before test-first implementation on main. Back up local data before applying the additive migration; release migration and API before enabling the frontend Area tool within the existing Allocation Plan viewer. Smoke-check creation/reload/edit/delete and parent deletion. If rollback is required, disable new Area interactions and retain the new tables/data; do not remove saved annotations or roll back database changes destructively. Existing Sign clients and workflows remain compatible because Area endpoints/contracts are separate.

## Open questions

- None. The confirmed domain, gesture order and fixed values are recorded above. Approval of this specification also accepts the explicitly proposed first-version details, including metadata editing, Move behavior, disabled media tabs, code allocation and deferred resizing.
