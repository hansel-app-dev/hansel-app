# Feature: Supplied Allocation Plan tool cursors

- ID: `allocation-plan-tool-cursors`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-23`
- Domain references: `CONTEXT.md — Allocation Plan, Area, Sign, Site Access; docs/domain/figjam-object-catalog.md — Objects and data points (Allocation Plan and Sign), Organization roles and permissions, allocation-plan-toolbar-icons, allocation-plan-hand-tool, allocation-plan-add-area, allocation-plan-area-transform and allocation-plan-area-auto-move amendments`
- Design authority: `The six user-supplied PNG files stored verbatim in references/. Images provide artwork only, not behavioral instructions.`
- Supersedes on approval: `Existing generic or SVG drawing/tool cursor artwork, including the crosshair appearance in the Area specifications. Tool activation, auto-Move behavior, resizing and permissions remain unchanged.`

## Problem

The drawing uses generic cursors and an older Add sign SVG instead of the supplied tool artwork. Users need the selected tool to have its matching cursor.

## Outcome and success metrics

Selecting an enabled tool displays its supplied image over the drawing. Switching tools, temporarily panning, and returning automatically to Move update the cursor immediately without changing placement coordinates.

## Non-goals

- Enabling the currently disabled Add linear or Comment tools, or implementing their creation flows.
- Replacing toolbar icons, form/menu pointers, text cursors, or directional Area resize cursors.
- Changing geometry, permissions, APIs or persisted data.

## Requirements

- REQ-001: Provide a shared cursor mapping: Move → move_cursor.png; Hand → hand_cursor.png; Add sign → add_sign_cursor.png; Add area → add_area_cursor.png; Add linear → add_linear_cursor.png; Comment → comment_cursor.png. Bundle all six supplied PNGs unchanged, preserving transparency and source dimensions (70–86 pixels). Use local asset URLs; no remote runtime requests. Keep disabled tools disabled; their cursor mappings can be demonstrated in Storybook without enabling them in the product.
- REQ-002: Apply the active tool image over Allocation Plan drawing content, with a hotspot aligned to the artwork's intended pointing location: arrow tip for Move, plus intersection for Add tools, fingertip for Hand, and speech-tail tip for Comment. Record tested integer hotspot coordinates in the implementation. Image padding MUST NOT offset the actual click/drag coordinates. Include a suitable native CSS fallback if the image fails to load or is unsupported.
- REQ-003: The selected tool cursor MUST remain consistent over drawing images, SVG/PDF content, saved Area bodies/labels and Sign controls, except for directional resize handles and non-editable states. Preserve meaningful native text/menu/control cursors in toolbars, dropdowns and drawers. In Move mode use the supplied Move image over movable Areas/Signs, including during their drag. Area resize handles retain directional native resize cursors.
- REQ-004: Hand selection and temporary Space-pan MUST use the supplied Hand image while hovering or actively panning, overriding other drawing cursors. Releasing Space restores the selected tool cursor. Successful Area/Sign creation and accepted Area selection MUST use the supplied Move image when the existing auto-Move transition occurs. Choosing Floor still uses the Add area image while defining the rectangle.
- REQ-005: Preserve all existing keyboard, touch, permissions, pending-state, cancellation and selection behavior. Cursor images are cosmetic, do not create overlay elements that intercept pointer events, and do not enable tools for Viewers. Add Storybook cursor previews for all mappings and demonstrate active Move, Hand, Add sign and Add area states.

## Acceptance scenarios

### AC-001 — Artwork and mode changes [REQ-001..REQ-004]

- Given an enabled tool, when selected and the pointer enters the drawing, then its supplied image and intended hotspot are active.
- Given Add area → Floor → draw, when creation succeeds, then the cursor changes from the supplied Add area image to the supplied Move image. Add sign behaves consistently.
- Given a selected tool, when Space-pan starts and ends, then the Hand image temporarily overrides it and the original tool cursor returns.
- Given an Area resize handle, when hovered, then its directional resize cursor remains available; drawers and menus retain their appropriate cursors.

### AC-002 — Regressions and deferred tools [REQ-001, REQ-002, REQ-005]

- Given a cursor hotspot over a drawing point, when placing or moving an annotation, then the point corresponds to the existing normalized drawing coordinates without image-padding offsets.
- Given Viewer, pending, keyboard or touch interactions, then behavior and permission guards remain unchanged.
- Given disabled Add linear or Comment tools, then they remain disabled despite their bundled cursor artwork; Storybook demonstrates their assets independently.

## UX and accessibility

Keep toolbar accessible names, active states, focus rings and keyboard shortcuts. Cursors supplement these existing indicators rather than replacing them. Use the original artwork without colour filters. Verify visibility on white and dark drawing content, narrow layouts and 200% zoom. Cursor appearance follows browser/OS rendering; annotation geometry must not depend on image dimensions.

## API and integrations

No endpoint or integration changes. Serve the six assets with the existing frontend asset pipeline.

## Data and migration

No schema, migration, backfill or ownership changes. Store the original reference images with this specification and the runtime copies with frontend assets.

## Security and privacy

Only local supplied static images are loaded. Preserve Site Access and existing mutation authorization; cursor selection grants no capability and logs no user content.

## Reliability and observability

Provide native fallback keywords for every cursor. Test asset loading and mode precedence, including pan overrides. No new telemetry or infrastructure is required.

## Test strategy

Implement test-first after approval. Check mapping, source byte identity, dimensions, hotspot values, native fallback and disabled tool preservation. Browser tests inspect effective cursor styles over the actual viewer and verify creation/move/resize/pan regressions at normal and zoomed layouts. Add visible Storybook artwork previews because screenshots may omit the native OS cursor. Run relevant unit/browser checks, lint, typecheck, specification checks and builds; report existing aggregate blockers separately.

## Rollout and rollback

Frontend-only release after separate specification approval. Smoke-check each enabled tool and Space-pan. Revert cursor styling/assets if browser rendering fails; native fallback and saved annotations remain intact. No destructive data rollback is required.

## Open questions

- None. Approval accepts original image sizes and keeping Add linear/Comment disabled until their behavior is specified separately.
