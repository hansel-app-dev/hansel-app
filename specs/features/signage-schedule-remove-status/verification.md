# Verification — 2026-09-27

Specification approval is recorded separately in commit `462f10b`.

## Passed

- Test-first checks demonstrated the old contracts rejecting status-free creates, accepting legacy status writes, retaining status in responses/UI and lacking the removal migration.
- All 107 shared-contract tests pass, including all three legacy status rejection cases.
- All 106 targeted API, schedule persistence and isolated migration tests pass.
- All 56 targeted schedule, Site Activity shell and client API tests pass; the application Signage Schedule route test also passes.
- Real PostgreSQL integration passes for schedule create/edit/reload, point and Linear creation, shared records, permissions, concurrency, retries and deletion.
- All 32 migrations replay successfully against an isolated empty database; Sign.status and SignStatus are absent.
- The local database was backed up with owner-only filesystem permissions before migration. The migration was applied and the API restarted successfully. Comparison against the restored backup confirms 37 Signs, 7 Sign Types, 28 placements, 3 Documents, 6 Images, 9 Sign Comments, 6 reactions and 4 comment attachments retain their other values and timestamps. Storage ledger row counts are unchanged; their expiry timestamps were renewed by the existing API cleanup worker after restart, independently of this migration.
- Three schedule browser checks pass: desktop geometry/columns/filter, 320 CSS pixel local table overflow and desktop 200% zoom. Axe finds no serious or critical violations in the changed table and toolbar.
- The new application browser test passes for status-free creation, edit and reload. It mocks API persistence to inspect exact client bodies; the PostgreSQL integration test separately proves real persistence.
- Storybook searching, Sign Type filtering, cell editing, new-type/sign errors, conflict and saving states were exercised successfully in Chromium.
- Specification checks, TypeScript, lint, production builds, Storybook build and CDK synthesis pass.

## Broader verification blockers

- `pnpm verify` stops at existing repository formatting failures. Unrelated files were preserved.
- Full API tests/coverage fail on the existing session-refresh mock in `prisma-session-store.test.ts` (`tenant.name` is missing). This failure was observed before implementation.
- Full frontend tests/coverage report 12 failures in `App.test.tsx` and `SiteAllocationPlans.test.tsx`, including external-provider/onboarding mocks and plan selection. Authentication failures were observed before implementation. The targeted Signage Schedule application test passes.
- Contract coverage misses the repository's 100% threshold: statements/lines 98.93%, branches 98.21%; the reported uncovered paths are in existing cover-image, Site collection and Sign Comment contracts.
- The existing Allocation Plan selector application E2E fails its expected route change; the new schedule E2E passes.
- The existing red Sign Type heading has a serious color-contrast violation (3.23:1 in the tested Storybook background). The targeted accessibility assertion covers the changed grid and toolbar and does not claim full-page accessibility.

The full design-system browser suite reports 103 passes and 26 failures in other screens and controls, including existing snapshots, accessibility, allocation layout and mounting controls. The three schedule checks pass within the full run. These broader failures prevent a claim that every repository release gate is green.

## Release scope

This task applies the migration to the local development database and pushes source changes to origin/main. It does not deploy a production database or application. See `docs/runbooks/signage-schedule-remove-status.md` for the coordinated deployment and recovery procedure.
