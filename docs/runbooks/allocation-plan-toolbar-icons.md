# Supplied toolbar icons — validation

Feature: `allocation-plan-toolbar-icons`; draft `eea2f10`, approval `804bb81` (2026-09-23).

All six toolbar buttons use the supplied PNGs, copied without byte changes. Each full 102px canvas displays at 34 CSS pixels, preserving transparency and padding. Active tools apply a white CSS filter on the existing blue button. Tool labels, behavior, permissions, disabled states and layout remain unchanged.

## Validation

- Test-first mapping checks failed for the three active tool cases before replacing the SVG artwork.
- All 22 focused toolbar, interaction and Add sign tests passed. PlanToolbar reached 100% statements, branches, functions and lines coverage.
- Four browser tests passed for supplied image loading, dimensions, active styling, keyboard activation, accessible names, Viewer/pending states and accessibility scans. Layout checks passed at 1024px, 320px, and 640px with 200% CSS zoom (320px effective width).
- Visually inspected the rendered toolbar. All six application PNGs match the committed supplied references byte-for-byte.
- Repository lint, typecheck and specification validation, frontend production build and Storybook build passed.

## Aggregate gate limitation

`pnpm verify` stopped at 25 unrelated existing formatting failures after passing specification checks. Its later aggregate stages were not reached; the focused validation and builds above ran separately. Existing bundle-size warnings remain.

## Rollback

Revert the frontend icon mapping/assets to restore previous illustrations. No database migration, data cleanup or API rollback is needed.
