# Sign Function options verification — 2026-09-22

- Specification approval was committed and pushed separately as `4568200` before application changes.
- New contract and UI tests failed against Wayfinder-only behavior before implementation. The Space-key regression also failed before the select exclusion was applied.
- All 94 contract tests pass; `plan-signs.ts` has 100% coverage for statements, branches, functions and lines.
- All 43 relevant frontend tests pass, covering Function selection/reload, failure/retry, Viewer state, native-select Space handling, placement, toolbar, panning and deletion.
- Three API/database suites pass with `PLAN_SIGNS_INTEGRATION=true`, covering persisted values, defaults, permissions, stale revisions, legacy reads and migration repeatability/preservation.
- Two Playwright checks pass for keyboard type-ahead, exact option order, selection when reopening, Viewer state and Regulatory/Statutory text width.
- `pnpm spec:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` and the Storybook build pass. Storybook includes all four selected values and the disabled Viewer state.
- Local PostgreSQL migration `20260922120000_sign_function_options` applied successfully; zero Wayfinder rows remain. This does not deploy or migrate a remote environment.

## Existing repository check failures

- `pnpm format:check` reports 35 files. Each was independently checked from the pre-implementation HEAD and already failed formatting there; this change introduces no newly failing file.
- `pnpm test:coverage` stops at the contracts package's global 100% threshold: lines/statements 98.75%, branches 96.96%. Uncovered code is in unchanged `cover-image.ts`, `index.ts` and `sign-comments.ts`. The changed Sign contract is fully covered. API/web global coverage and the full design-system suite are not certified by these targeted checks.
