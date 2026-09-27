# Library Files

Feature: `library-files`, approved 2026-09-27.

## Release

1. Deploy the additive `20260927160000_library_files` Prisma migration before the API. Generate the Prisma client when building.
2. Grant runtime storage access to `library/*` for generated Photo thumbnails, alongside the existing upload prefixes. Originals stay at their verified keys.
3. Deploy the API with `LIBRARY_FILES_ENABLED=false` (CDK context `libraryFilesEnabled=false`). Registration and retained-object protection run independently of this switch.
4. Run `node scripts/library-files-backfill.mjs` from the API runtime directory (or `pnpm --filter @hansel/api backfill:library-files` from a built monorepo) in the release environment with `DATABASE_URL`, `ALLOCATION_PLANS_BUCKET_NAME` and the normal storage credentials. Set `LIBRARY_BACKFILL_REPORT` to a persistent private JSONL report path. For local use, build Contracts and API, then load the root `.env.local` before invoking the command. The runner uses the compiled, unit-tested backfill module and requires no TypeScript runtime in production.
5. Review the report. `registered` records have verified byte length, SHA-256 and file signature. `missing` records have unavailable or invalid originals/thumbnails; restore the original from backup and rerun. `changed` records lost their completed parent while being processed; inspect their current state. No placeholder asset is created. Pages resume from unmapped completed records, so reruns are safe.
6. Enable `LIBRARY_FILES_ENABLED=true` (CDK context `libraryFilesEnabled=true`), then verify Files discovery, private downloads and reuse into a separate Site. Verify a Viewer cannot attach files and a Membership without source Site Access cannot list or download them.

## Retention and rollback

Deleting a Photo or Sign removes destination associations. Library Files and other links retain their bytes. Expired upload cleanup removes temporary objects and ledger records but checks library retention before deleting originals or thumbnails.

To disable reads and reuse, set `LIBRARY_FILES_ENABLED=false` and redeploy the current API. Keep the schema, registration hooks and retention checks. Do not roll back to an older cleanup worker that can delete registered assets. Do not remove shared originals manually. Direct library deletion is outside the accepted scope.

## Observability

The API emits `library_file_link_success`, `library_plan_create_success` and `library_file_request_failed` without filenames or object keys. Existing request logs provide route and response status. Review failures after enabling the feature and verify retries preserve the same idempotency key. A reused key with different payload returns 409; permission is checked again on every request. Private responses use `Cache-Control: private, no-store` and `nosniff`.

## Local evidence

The migration applied successfully to the local database. The first backfill registered 17 verified files: 8 Allocation Plan files, 3 Documents and 6 Photos. The private report is stored outside the repository. The isolated database integration test exercises concurrent retries, independent plan creation, source access revocation, cross-Organization denial, unlink retention, parent deletion cleanup and idempotent backfill:

```sh
LIBRARY_FILES_INTEGRATION=true pnpm --filter @hansel/api exec vitest run src/sites/library-files.integration.test.ts
```

Run with the test database URL already loaded. The test creates and removes its own Organization, Users and Sites.

## Verification on 27 September 2026

Specifications, global formatting, lint, types, application builds and the Storybook build pass. Coverage thresholds are unchanged:

| Package        | Passing tests | Statements | Branches | Functions |  Lines |
| -------------- | ------------: | ---------: | -------: | --------: | -----: |
| API            |           662 |       100% |     100% |      100% |   100% |
| Web            |           515 |       100% |     100% |      100% |   100% |
| Contracts      |           112 |       100% |     100% |      100% |   100% |
| Infrastructure |            18 |     98.65% |    90.8% |      100% | 98.65% |

The isolated database integration test passes, as does the compiled backfill runner on a second local run with the report still at 17 registered entries. The normal API coverage run skips 63 database/live tests under their existing opt-in configuration.

All seven Library Files browser tests pass, including keyboard use, cancellation/retry, source metadata, Photos compatibility, independent plan selection, focus restoration, 320px reflow and 200% zoom. The full design-system browser suite reports 113 passes and the same 28 previously recorded failures described in [the coverage/formatting runbook](coverage-formatting-gates.md). These existing failures keep the aggregate browser gate red; they are not new Library Files failures.

The coverage fixtures explicitly run deferred comment focus/scroll callbacks after their views unmount, and HTTP fixtures retain their listeners through each test to avoid ephemeral port reuse. CDK image staging excludes local environment files and generated browser/build reports.
