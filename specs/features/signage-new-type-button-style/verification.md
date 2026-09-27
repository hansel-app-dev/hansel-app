# Verification — 2026-09-27

- Approval was committed and pushed separately in `5240e1a`.
- New sign type now uses the shared Button primary variant, as Log in does. Its label, plus icon, spacing, permissions and draft behavior are preserved.
- Existing Button and Signage Schedule tests pass before and after the change: six tests.
- Specification checks, relevant formatting, ESLint and frontend TypeScript pass.
- The existing Signage Schedule application browser creation/edit/reload check passes.
- Chromium Storybook verification confirms the primary background `#485463`, white text, hover background `#3d4855`, keyboard focus with a solid 2 px outline and Enter opening the focused inline draft.
- Existing schedule stories inherit the new style through the same component. No new reusable component, API or database change is introduced.

The prior status-removal verification documents existing broader repository gate failures. This presentation-only change was verified with the relevant checks above.
