# Single-file Allocation Plans

Specification: [allocation-plan-single-file](../../specs/features/allocation-plan-single-file/spec.md).

## Deployment and recovery

Back up the database and quiesce API/background allocation and Sign writers before applying `20260923000000_allocation_plan_single_file`. Deploy the compatible API and web application together, then restore writers. Existing feature flags and private storage permissions remain unchanged.

The migration locks the affected tables, checks finalized file associations and ambiguous legacy Sign placements, records an identifier-only `AllocationPlanFileSplit` mapping, and splits grouped plans transactionally. The first file retains its plan ID/name. Additional files receive new plan IDs and names composed from the old name and original filename, capped at 200 Unicode characters. The file foreign key cascades the new plan ID to its Sign placements. Shared Signs and their media/discussion remain untouched, as do historical Activity records.

The existing unique `(groupedPlanId, position)` index plus the new `position = 0` check prevents attaching a second file. Creation contracts require exactly one verified file; zero/multiple-file commits fail before mutation. Previously committed multi-file request bodies now receive validation failure; their creation keys and original plan identities remain stored, so retrying cannot recreate grouped plans. Clients must reload canonical collection metadata after migration. Legacy upload batching may still stage separate files, but each legacy finalization creates its own single-file plan.

Verify file and Sign counts, byte metadata, placement coordinates and file associations before restoring traffic. Abort on any discrepancy. Do not rerun old code that creates grouped plans. Before writes resume, restore the database backup on failure; afterwards, fix forward using the mapping and preserve subsequent edits. Never remove stored objects to resolve cardinality.

## Validation on 2026-09-23

- Contract suite: 94 tests passed; the single-file request schema has 100% coverage.
- Focused API suite: 21 tests passed, including real PostgreSQL creation/idempotency and migration tests. Migration tests use an isolated schema, exercise rollback on ambiguous placements, compare all file metadata and Sign coordinates before/after, verify retry stability, and reject second-file attachment.
- Viewer/upload/Hand unit tests: 29 passed. The application route test verifies switching and history-selected content.
- Browser checks: seven upload/viewer layout/accessibility checks passed; one application E2E passed for client navigation, Back, Forward and reload/direct-link selection.
- Specification validation, lint, TypeScript, application builds, Storybook build and CDK synthesis passed.
- Local migration: seven plans became eight single-file plans; grouped-plan count became zero. All file metadata, shared Sign records and 25 Sign placements matched pre-migration snapshots exactly, excluding only the intended parent-plan/position reassignment. The API, web and Storybook responded successfully afterwards. The local database backup is outside the repository.

The complete repository gates are not green. `pnpm verify` stops on existing formatting debt in unrelated files. Full API tests have one failure in the dashboard refresh-credential store; full web tests have ten authentication/onboarding failures (including six unhandled mock errors) and one date-dependent collection assertion. The whole design-system suite reports 27 failures in other layout/snapshot/Sign scenarios; the seven affected upload/viewer checks pass. Contract coverage remains below the global 100% threshold in untouched cover-image, index and sign-comment code. These failures are not waived by the focused feature checks, and this local validation is not a production deployment certification.

## Repeat focused database checks

With local Docker PostgreSQL running and the API's development environment loaded, run Vitest for `allocation-plan-drafts.integration.test.ts` with `ALLOCATION_DRAFT_INTEGRATION=true`, and `allocation-plan-single-file-migration.test.ts` with `ALLOCATION_MIGRATION_INTEGRATION=true`. The migration test creates and drops its own schema in the local `hansel` database. The creation test creates and cleans its own Site fixtures and uses an existing local Owner Membership.
