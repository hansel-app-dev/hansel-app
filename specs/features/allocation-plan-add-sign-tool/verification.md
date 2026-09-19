# Add sign tool verification

Verified 2026-09-19 against approved specification commit `b312588`.

## Passing checks

- 42 targeted UI tests across Add sign, mounting selection, toolbar, Hand, viewer, Sign surface and deletion. New tests cover menu-before-create, all five choices, captured coordinates, disabled New type, pending duplicate prevention, failure/retry identity, Move reset, keyboard navigation, outside/Escape/scroll/zoom/pan dismissal and edge bounds.
- 85 contract tests pass. Optional mounting accepts the five supported values and rejects unknown values.
- PostgreSQL integration test passes: all five values create and reload correctly, retries preserve identity, changed mounting conflicts with a reused key, omitted/explicit Wall-mounted requests remain compatible, updates preserve grouping, and existing access/concurrency/shared-record deletion checks pass. Test-created records are cleaned up. Storage is already a varchar; no migration or backfill is required.
- Repository ESLint, frontend/backend typechecks, production web build and Storybook build pass. Existing large-bundle warnings remain.
- New `AddSignMenu.tsx` has 100% statements, branches, functions and lines in targeted coverage. This is not a whole-application or whole-viewer coverage claim.
- Browser verification used the interactive Storybook API fixture: reference icon/text menu, Space selection of Floor, Enter selection of Freestanding, correct General value and Move reset, and existing-Sign selection without a duplicate. Checked desktop, 950px and 390px layouts. Final menu bounds reserve selector and bottom toolbar/zoom bands; narrow placement was rechecked after increasing bottom clearance. Viewport override was reset afterward. Database persistence was verified separately by integration tests, not by this browser fixture.

## Existing failures

- Full frontend run: 306 passed, 11 failed, six unhandled errors. Failures are the previously documented App routing/capability fixtures and SiteAllocationPlans relative-date fixture. Six additional Add sign cases passed in the final targeted run after the full-suite run.
- Full API run: 557 passed, one failed, 55 skipped. The existing dashboard prisma-session-store fixture fails reading a missing Organization name. The explicitly enabled plan-Sign database integration passes independently.
- Repository spec validation has previously documented legacy-spec errors unrelated to this amendment. No unrelated specifications or test fixtures were modified.

## Reviews

Standards: no non-tool-enforced coding findings. The requested domain-catalog amendment is included.

Specification: one edge-overlap finding resolved by reserving fixed-control bands and adding layout tests. Re-review found no remaining blocking findings; subsequent narrow browser verification increased the bottom band to 140px and confirmed clearance. New Storybook states cover cursor, menu, edge placement, pending/error and General Floor.
