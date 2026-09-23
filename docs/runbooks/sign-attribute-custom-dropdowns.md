# Custom Sign attribute dropdowns

Specification: [sign-attribute-custom-dropdowns](../../specs/features/sign-attribute-custom-dropdowns/spec.md).

Function and Colour use `SignAttributeSelect`, matching the existing Type field. Function retains the four approved values; Colour retains Red and its existing swatch. Changes use the existing Sign save flow, permissions and concurrency checks. Choosing the current value performs no update.

The menu is portaled to the document body to avoid the drawer's scroll clipping. It anchors above or below the field according to available space, adjusts for document CSS zoom and scroll, and exposes combobox/listbox semantics. Escape stops at the open dropdown; Tab and outside interaction dismiss without saving. Disablement and keyed Sign/tab unmounting remove stale menus.

No API, database, storage or feature-flag change is required. Reverting the frontend controls leaves all saved values intact. Storybook contains a reusable component showcase and integrated Function/Colour drawer examples.

## Validation on 2026-09-23

- 46 focused Sign/viewer tests passed, including selection/reload, failed-save retry, permissions, no-op selection, menu lifecycle, keyboard/pan isolation and viewport positioning.
- The new component has 100% lines, statements, functions and branches in its focused coverage run.
- Four browser tests passed for exact Function options, keyboard selection, Viewer state, matching Type geometry, Colour swatch, dropdown accessibility, 320px layout and 200% zoom. Accessibility assertions cover the controls and open listbox.
- Specification checks, TypeScript, lint, application builds and Storybook build passed.
- `pnpm verify` remains blocked by formatting in 29 unrelated files. The full frontend coverage run has 319 passing tests and the same 11 existing failures: ten authentication/onboarding tests (with six unhandled mock errors) and the date-dependent Allocation Plan collection assertion. These failures prevent the complete repository gate from passing; they are not covered by the focused component coverage result.
