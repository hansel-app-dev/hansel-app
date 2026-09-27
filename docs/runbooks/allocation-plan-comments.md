# Allocation Plan Comments

Specification: [allocation-plan-comments](../../specs/features/allocation-plan-comments/spec.md).

Apply additive migration `20260923030000_allocation_plan_comments` before enabling `PLAN_COMMENTS_ENABLED=true`. It defaults off. The Allocation Plan viewer must already be enabled; Comment participation does not require MANAGE_SIGNS or the Sign Comments flag. Local backup: `/tmp/hansel-before-plan-comments.dump`. No production deployment is included.

Private storage requires read/write/delete for `plan-comments/*` and `quarantine/plan-comments/*` in the configured Allocation Plans bucket, using its existing signed PUT CORS/checksum configuration. No new public object access. Draft attachments expire after 15 minutes unverified or 24 hours verified; cleanup runs every minute in batches of 100 with a one-minute grace. Durable ledgers survive plan/Site deletion and flag rollback. Watch `plan_comment_cleanup_failed` and categorical `plan_comment_request_failure`; logs must never contain discussion text, coordinates, filenames or signed URLs.

Smoke checks:

1. As Viewer, select Add comment, click the drawing, submit text, and confirm Move plus an initials pin and floating thread. Reload and verify the same position. No Sign/Schedule row should appear.
2. Reply, attach PNG/JPEG/PDF (5 MiB maximum each), mention a current Site member and insert emoji. Check thumbnails/downloads, uploader-private drafts, and retry without duplicates. Invalid/revoked inputs preserve the draft.
3. Resolve and confirm the pin remains visible; reload, select its retained history and reopen. Open and resolved pins are listed together without a visibility control. All Site-access roles can do this; resolved threads cannot accept new replies. A 409 requires closing/reopening to reload, with the unsent-draft guard.
4. Verify keyboard arrows/Enter placement, Escape picker/card handling, narrow/zoomed views, Site/plan navigation guards and the other five tools.
5. Verify foreign plan/file/user rejection and plan deletion with retained cleanup ledgers. At 5,000 threads, creation returns `comment_capacity_reached`; existing paginated history remains readable.

Recovery: restore storage access and let cleanup retry, retaining ledgers until all object removals succeed. On rollback disable `PLAN_COMMENTS_ENABLED`; keep the additive schema and records, and keep cleanup running. Never drop discussion data or make private attachments public to recover service.

## Validation and current limits

The focused contract/client tests, component scenarios, real-database thread/attachment tests and API route tests pass. Browser tests cover Viewer creation, replies, resolve/reopen, mentions, emoji, draft protection and narrow/zoomed cards; existing Sign Comment, Linear and cursor scenarios also pass. App and Storybook builds, spec checks, lint, typecheck, infrastructure assertions and CDK synthesis pass. Local API health and access to the configured private bucket were checked. The IAM change grants the API only the additional `plan-comments/*` namespace; deployment is not part of this change.

Full verification is **not green**. New contracts and the browser API client each have 100% focused unit coverage. The backend has 99.2% lines/statements, 100% functions and 96.83% branches; the floating controller has 95.76% lines/statements, 68.57% functions and 81.36% branches, below the mandated 100% gate. Browser coverage is not counted as unit coverage. Complete these coverage gaps before production release.

Repository `pnpm verify` stops at unrelated formatting failures (20 files after formatting the touched infrastructure file). The full web test run has 12 failures and six errors in `App.test.tsx` and `SiteAllocationPlans.test.tsx`; the same 12 failures/six errors reproduce against the pre-implementation `ddf3521` source in an isolated temporary copy. These failures were left untouched. One parallel Linear creation check timed out during concurrent builds; all 10 selected browser checks passed on the serial rerun. The existing bundle-size warning also remains.
