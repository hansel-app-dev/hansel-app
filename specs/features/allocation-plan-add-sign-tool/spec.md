# Feature: Allocation Plan Add sign type menu

- ID: `allocation-plan-add-sign-tool`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-19`
- Domain references: `CONTEXT.md — Sign, Allocation Plan, Site, Site Access, Viewer; docs/domain/figjam-object-catalog.md — Objects and data points (Sign and Allocation Plan), Organization roles and permissions, Current implementation alignment, How feature work must use this catalog (sign-mounting-options, allocation-plan-signs, allocation-plan-toolbar, allocation-plan-hand-tool)`
- Design authority: User-supplied `/Users/nsingh/Downloads/Toolbar/Add Sign.png` and `Add Sign_ on click.png`.
- Product decisions: User confirmed menu-before-creation, Floor in both menus, disabled New type, and automatic switch to Move after successful creation.

## Problem

Add sign currently creates a Wall-mounted Sign immediately on drawing click. The supplied design requires choosing a mounting type at the intended placement before saving.

## Outcome and success metrics

One placement click and one type choice create exactly one shared Sign at the chosen drawing position, with the selected mounting value, an open drawer and Move active. Opening or dismissing the menu creates no records.

## Non-goals

- Custom mounting types or an enabled New type action.
- New Signage Schedule groups, Function/Colour choices, marker shapes or permissions.
- Changes to Move/Hand behavior, other deferred tools, media or comments.

## Requirements

- REQ-001: Preserve the third toolbar button's Add sign name, circle-plus icon and blue/white active styling. In Add mode show the reference circle-plus cursor over eligible drawing content instead of the existing crosshair/Add new label. Move remains the initial tool; users without MANAGE_SIGNS cannot activate Add.
- REQ-002: Clicking blank drawing content in Add mode captures normalized coordinates on the current Allocation Plan file and opens a nearby menu without creating a Sign. The menu has an Add sign heading, then Freestanding, Wall-mounted, Overhead, Cantilevered and Floor in that order, each with its icon and text; New type is visible but disabled. These are mounting values, not Site Sign Type groups. Reuse the four supplied mounting PNGs unchanged; provide a matching neutral Floor illustration based on the new reference.
- REQ-003: Match the reference menu's approximately 160px width, 40px option rows, white background, neutral borders/dividers, small corner radius and shadow. Anchor beside the clicked point and flip/clamp into the visible drawing area near edges. Opening the drawer, zooming, scrolling/panning, changing file or switching tools dismisses an unsubmitted menu so stale placement cannot be submitted. An outside click or Escape dismisses without creating; the dismissing click must not also create or open another menu.
- REQ-004: Choosing an enabled mounting option creates one Sign atomically with that mounting at the captured position through the existing idempotent create flow. Keep automatic editable code generation, existing defaults for other attributes, Site-local Plan signs grouping and shared Signage Schedule data. On success close the menu, select the created Sign, open General and switch to Move. Clicking an existing Sign must not create a duplicate.
- REQ-005: While creation is pending, prevent repeated submission and preserve existing mutation/unsaved-edit guards. On failure retain the intended placement and mounting for retry, show the existing recoverable creation error, and remain in Add rather than switching to Move. Retry the same operation with the same idempotency key; cancellation does not falsely report success or undo a completed server write.
- REQ-006: Add Floor as the fifth General → Type choice with the same icon. Client/server read, create and update validation accept all five values and reject unsupported values. Existing records keep their mounting. Make mounting optional in the create contract with Wall-mounted as the backward-compatible default for callers that omit it; supplied choices must persist in the initial create, not a second patch.
- REQ-007: Provide accessible menu/item names, disabled New type state, visible focus, arrow/Home/End navigation, Enter/Space selection and Escape dismissal with focus returned to the drawing. Keyboard activation of the focused drawing in Add mode opens the menu at the existing keyboard placement point (last eligible pointer position or center). Menu/control events do not bubble into drawing creation or panning. Temporary Space-pan must not open a menu or create a Sign on release.
- REQ-008: Add Storybook states for the cursor, open type menu, edge positioning, disabled New type, pending/failure and Floor in General. Keep toolbar, zoom and drawer usable without overlap at desktop, intermediate and narrow widths. No new telemetry or external services.

## Acceptance scenarios

### AC-001 — Choose before creation [REQ-001..004]

- Given an editor in Add mode, when they click blank drawing content, then the illustrated menu appears and no create request is sent.
- Given each mounting option, when selected, then one Sign is saved at the original point with that mounting, General opens and Move becomes active.

### AC-002 — Dismiss and protect [REQ-003,005,007]

- Given an open menu, when Escape, outside click, viewport navigation, file change or tool change occurs, then the unsubmitted menu closes without creating a Sign.
- Given Space-pan or a click on an existing Sign/control, when it ends, then no new Sign is created.
- Given pending or failed creation, when repeated input or retry occurs, then the existing guards/idempotency prevent duplicate Signs; failure remains recoverable without switching to Move.

### AC-003 — Shared values and permissions [REQ-004,006]

- Given a Floor Sign, when reloaded or viewed in General, then Floor and its icon remain selected and the shared Sign exists in the Site Signage Schedule.
- Given a legacy create request without mounting, then Wall-mounted remains the default; unsupported mounting and unauthorized writes are rejected.

### AC-004 — Keyboard and layout [REQ-002,003,007,008]

- Given keyboard-only interaction, when Add and then the drawing are activated, then the menu supports navigation, selection and dismissal without unintended Sign actions.
- Given an edge placement or a narrow viewport, then the menu remains visible and its controls remain usable.

## UX and accessibility

Use the existing font and mounting icons; do not infer black backgrounds from transparent assets. Decorative icons supplement text. Retain the canonical Cantilevered spelling. New type has no action. Preserve ordinary tab focus and distinguish pending/error states without colour alone.

## API and integrations

Extend the existing plan Sign create payload with optional validated mounting; expand read/update contracts and OpenAPI to include Floor. Preserve exact-Origin/session checks, idempotency semantics and existing endpoints. Release compatible readers and API before or with the new UI.

## Data and migration

Reuse Sign.mounting and existing normalized placement. No new domain object, custom-type table or backfill. Inspect storage constraints and expand additively only if necessary. Creation persists mounting with the Sign/placement in the existing transaction. Signage Schedule and plan continue sharing the same record.

## Security and privacy

Retain tenant/Site ownership and MANAGE_SIGNS authorization on the server. Viewers may inspect mounting but not create/edit. Render fixed labels as text; do not log plan coordinates or content. No access expansion.

## Reliability and observability

Reuse existing request errors, idempotency, concurrency protections and categorical logging. Never perform create-then-patch for mounting. Pending operations retain existing navigation protections; no timers, retries in the background or new infrastructure.

## Test strategy

After approval, write failing contract, API and UI tests for all five create/read/update values, omitted default, invalid/unauthorized requests, exact placement, no request on menu open/dismiss, duplicate protection, failure/retry, switch-to-Move and keyboard/Space/portal regressions. Add Storybook states and browser-check menu/cursor fidelity, edge positions and responsive layouts. Run affected tests, lint, typecheck, production and Storybook builds; report existing unrelated failures separately.

## Rollout and rollback

This specification supersedes the immediate Add-mode creation behavior in allocation-plan-toolbar and the four-value mounting limit/default-only creation UI in sign-mounting-options. It leaves Move/Hand and shared Sign ownership unchanged. Deploy expanded readers/writers before the UI; rollback may disable the new menu but must retain Floor-compatible readers once Floor records exist. No record deletion or value rewriting.

## Open questions

- None.
