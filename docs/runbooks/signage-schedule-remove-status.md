# Remove Sign status

Specification: `signage-schedule-remove-status`, approved 2026-09-27.

## Release

1. Quiesce Sign reads and writes across the schedule and Allocation Plan APIs. Existing flags may cover some routes; stop affected traffic for the remaining routes.
2. Take a protected database backup and verify that it is usable. Do not commit backups or log record contents.
3. Apply Prisma migration `20260927000000_remove_sign_status`. It transactionally drops `Sign.status` and then `SignStatus`, without CASCADE. Keep historical migration files.
4. Deploy the API with its regenerated Prisma client and the matching frontend. Require a fresh frontend load so legacy bodies containing status cannot be submitted.
5. Confirm Sign counts, quantities, IDs, other attributes, timestamps and related records against the pre-migration snapshot. Confirm that the column and enum are absent.
6. Smoke-test schedule read/create/edit/reload, point and Linear Sign creation, shared edits across both views, Viewer access and stale-update protection. Legacy status writes must return 400 without mutation.
7. Confirm no Status header or filter, neutral map indicators, Comments after Content, quantity total alignment, keyboard operation, narrow-width local overflow and 200% zoom. Check categorical API failures and health before restoring traffic.

## Recovery

Keep traffic quiesced if migration or compatibility checks fail. Rolling back binaries alone is insufficient because the column and enum have been removed. Before writes resume, restore the verified pre-migration database backup together with its matching application version.

After writes resume, fix forward. Do not overwrite new changes with an old database snapshot. Reintroducing status requires a reviewed forward migration and a decision about status for newly created Signs. Feature flags can limit exposure but cannot recover deleted values.

## Verification

- `SIGN_STATUS_MIGRATION_INTEGRATION=true pnpm --filter @hansel/api exec vitest run src/sites/signage-status-migration.test.ts` exercises the migration in an isolated schema with all three legacy values and preserved references.
- `PLAN_SIGNS_INTEGRATION=true pnpm --filter @hansel/api exec vitest run src/sites/plan-signs.integration.test.ts` uses the configured local database and temporary Site fixtures to check point/Linear persistence, concurrency, permissions and shared schedule records.
- Replay all Prisma migrations against an isolated empty database before release.
- Run `pnpm verify`, relevant application E2E, and `pnpm --filter @hansel/infra cdk:synth`; record any failed gate explicitly.
