# Supplied tool cursors

Feature: `allocation-plan-tool-cursors`; specification `c616550`, approval `6a29710` (2026-09-23).

The Allocation Plan drawing uses the six supplied PNG cursor images without resizing, recolouring or changes to their bytes. Move, Hand, Add sign and Add area use their corresponding artwork. Linear and Comment remain disabled in the product; their assets appear in the Storybook cursor gallery only. Toolbar icons are unchanged.

## Mapping and precedence

| Tool       | Source size | Hotspot (x, y) | Native fallback |
| ---------- | ----------- | -------------- | --------------- |
| Move       | 77 × 79     | 24, 17         | default         |
| Hand       | 70 × 81     | 35, 12         | grab            |
| Add sign   | 86 × 86     | 20, 20         | crosshair       |
| Add area   | 84 × 84     | 20, 20         | crosshair       |
| Add linear | 85 × 84     | 20, 20         | crosshair       |
| Comment    | 78 × 82     | 10, 72         | crosshair       |

Hotspots use source pixels at the arrow tip, fingertip, plus intersection or bubble tail. Pointer event coordinates are not modified. Native browser cursor handling provides the supplied image or its fallback; no pointer-following overlay is created.

Hand and Space-pan override the drawing and annotation cursors during hover and dragging. Releasing Space restores the selected tool. The existing automatic Move transition after creation/Area selection also updates the cursor. Area resize handles retain directional cursors. Cursor styling is confined to drawing surfaces so drawers, menus and text inputs retain native control cursors. Read-only annotation controls retain their non-editable pointer treatment.

## Validation

- Mapping tests failed before implementation and then passed with byte identity, dimensions, hotspots, fallback and Hand precedence assertions. The mapping module reached 100% statements, branches, functions and lines coverage.
- All 53 focused unit tests passed across cursor mapping, toolbar, Hand, viewer, Add sign and Areas.
- Eleven browser checks passed across cursor selection, pan override, creation/auto-Move, normal and 200% zoom, Sign movement and Area resizing. Two cursor-specific tests also passed after adding an active pan gesture and the visual gallery capture.
- All original images load in Storybook previews on white and dark backgrounds. The native OS cursor itself may be omitted from browser screenshots; tests inspect effective CSS and image loading, while the gallery exposes the exact artwork for visual review.
- Repository lint, typecheck, specification validation, frontend production build and Storybook build passed.

## Verification limitations

`pnpm verify` passes specification validation and stops at the same 22 existing formatting failures outside this feature. Later aggregate stages were not reached. Prior Area controller coverage remains below the repository's 100% requirement; this change does not claim to resolve that broader gate. Remote CI, production deployment and production smoke checks were not performed.

## Rollout and rollback

Frontend-only change; no migration or API change. Smoke-check Move/Hand/Add sign/Add area, temporary Space-pan, automatic Move and directional resize handles. Revert the cursor mapping and styling if rendering fails; native CSS fallbacks remain available and saved annotations are unaffected.
