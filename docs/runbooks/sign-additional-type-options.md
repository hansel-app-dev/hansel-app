# Additional Sign Type options — validation

Feature: `sign-additional-type-options`, approved 2026-09-23 in specification commit `d131562` after draft `03c3c96`.

Safety Decal, Privacy Decal and Environmental are appended to Type and Add sign. The three local application PNGs match the supplied reference bytes exactly. Type reuses the custom attribute dropdown so the longer list scrolls within available viewport space. Existing Sign.mounting storage and creation defaults remain unchanged; no database migration is required.

## Validation on 2026-09-23

- Test-first: before implementation, the expanded contract test failed and 11 affected frontend tests failed because the new choices were absent.
- All 94 contracts tests passed; 27 focused frontend tests passed, including edit/reload for each new value, menu ordering, icons and one-request creation.
- The API route test passed. The opt-in PostgreSQL integration test passed, covering create/replay, edit/readback for all eight values, unchanged grouping, default mounting, permissions and concurrency. Temporary integration data was cleaned up by the test.
- SignMountingSelect and SignAttributeSelect each reached 100% statement, branch, function and line coverage in the focused coverage run.
- Three feature browser tests passed: all new choices/icons and keyboard operation at 320px with 100%/200% zoom, accessibility scans, and creating Environmental from the bounded Add sign menu. Two existing Function/Colour browser checks also passed.
- Repository lint, typecheck, specification validation, application builds and Storybook build passed. Final added tests also passed lint and web typecheck.
- Application icons were byte-compared against all three supplied references. Local API health returned `ok`.

## Repository-wide gate limitation

`pnpm verify` passed specification validation but stopped at formatting issues in 25 unrelated existing files. Later stages of that aggregate command were not executed; this is not a claim that every repository-wide suite passes. Feature checks and builds above were run separately. Existing build warnings about bundle sizes remain.

## Release and rollback

Deploy compatible API readers/validators before the frontend can write the new values. Use existing feature controls and permissions. If removing these choices from write menus after release, retain read support and selected-value rendering for saved Signs; do not roll back to an API that rejects persisted values. No data backfill or cleanup is needed.
