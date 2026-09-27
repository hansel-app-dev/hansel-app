# Verification — Allocation Plan comment movement

Date: 2026-09-27. Specification proposal: `5768f3c`. Explicit user approval recorded separately in `f287d12`. Implementation is committed directly to main and verified against origin/main after review.

## Implemented behavior

Temporary and saved open-thread pins drag in Move/Add comment with a 3 CSS pixel threshold, pointer capture, pointer offset, live pin/card preview, drawing-relative bounded coordinates and cancellation. A completed saved gesture sends one guarded position request; no-op gestures send none. Current Site COMMENT participants, including Viewers, can move another author’s open thread. Resolved threads must be reopened first.

Draft ID/content/attachments/mentions remain in the existing composer. A root submission attempt locks its coordinates for exact-payload retry. Saved moves preserve unsent replies on the selected thread; another pin uses the discard guard once per pointer click. Pending moves guard conflicting writes/navigation. Failed saves roll back with exact-intent retry; conflicts require canonical reload. Obsolete responses cannot reconcile into a different file. Alt+arrows move saved pins 1%; draft composer controls offer keyboard positioning. Focus returns to a keyboard-moved pin after saving when the user has not focused another control.

Backend access, plan/file/thread ownership, open state and optimistic timestamp are checked under the existing parent transaction lock. Only x/y/updatedAt change; already-applied open coordinates replay without another timestamp update. Strict contracts, scoped transport, OpenAPI, domain references, historical supersession, Storybook states and runbook are updated. Existing fields suffice; no migration is required.

## Evidence

- Test first: the new contract/service tests failed for the absent position schema/operation; initial component tests failed for missing drag preview, keyboard draft controls and retry behavior before implementation.
- Contract suite: 108 tests pass. `plan-comments.ts` reaches 100% lines/statements/branches/functions.
- API position/route unit tests: 4 pass, covering access, scoped lookup, update field whitelist, stale/resolved rejection, idempotent replay, validation, Origin/session/feature flag, private no-store, method dispatch and categorical failures.
- Real PostgreSQL: 3 integration tests pass (discussion, attachments, position). New test verifies a Viewer moving another author’s thread, reload through marker reads, unchanged authorship/creation/resolution metadata, replies, mentions and a published attachment; stale/foreign/revoked/deleted rejection; no-op replay; competing move/resolve serialization; cleanup.
- Relevant viewer/component/client tests: 52 pass, including movement and existing Sign/Area selection, deletion, Hand behavior and plan switching.
- Plan Comments browser suite: 6 pass. Includes saved/draft pointer dragging, preview/card following, unsent reply preservation, final publication coordinates, keyboard/focus, Escape, failure/retry/conflict/reload, resolved/reopen, 320px card layout, 200% drawing zoom, scrolling, Hand and Space-pan. Browser transport uses Storybook fixtures; real persistence is separately verified against PostgreSQL.
- Specification/runtime/Tailwind/design-source/design-system validation, repository lint and workspace type checks pass.
- Workspace builds and Storybook build pass; production CSS validation passes. Existing chunk-size warnings remain.
- Changed files pass Prettier and git diff whitespace checks. Desktop movement screenshot inspected at `/tmp/hansel-comment-move-viewer.png`.

## Remaining verification limits

The repository’s 100% coverage gate does not pass. The focused frontend coverage run had all 51 tests passing at that time, but reported 95.43% lines/statements, 81.48% branches and 80% functions across PlanComments/client; client coverage is 100%. Later guard/focus checks increased the relevant passing test count to 52; no claim of 100% component coverage is made. Focused API unit coverage across the entire existing comments service/routes was 44.68% lines/statements, 96.42% branches and 30.76% functions; broader existing discussion operations are tested with real-database integration, which is not unit coverage. The contract suite’s global gate remains 98.94% lines/statements and 98.21% branches due to existing cover-image, Site collection and Sign Comment gaps.

Repository-wide formatting still fails on 19 previously identified unrelated files. Those files were preserved. Broader previously recorded App/SiteAllocationPlans auth/mock failures, session-refresh API mock failure, unrelated design-system browser failures and the allocation-plan single-file routing E2E failure were not rerun or changed for this feature. No production deployment or realtime multi-user synchronization was performed.
