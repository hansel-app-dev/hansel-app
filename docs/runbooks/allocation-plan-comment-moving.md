# Allocation Plan comment movement

Feature: `allocation-plan-comment-moving`. Domain: Allocation Plan Comment, Allocation Plan/file, Site Access and COMMENT capability.

## Operation

In Move or Add comment, drag an open comment pin within its drawing. A focused saved pin also supports Alt+arrow in 1% steps. Focus the draft comment card and use Alt+arrow to reposition its temporary pin without publishing it. Escape cancels an active drag; Hand and Space-pan take precedence. Open and resolved pins remain visible together without a visibility checkbox; resolved pins must be reopened before moving.

Draft movement preserves unsent content and attachments. Once root submission has been attempted, coordinates stay locked for retries until the draft is published or discarded. Saved movement preserves discussion ownership and content, writes only x/y and updatedAt, and uses the original concurrency timestamp. The existing Allocation Plan Comments feature flag controls the endpoint and UI; no migration is needed.

## Failure recovery

A failed move restores canonical coordinates and offers Retry comment move using the same desired position and timestamp. A 409 requires Reload comment before another move. An uncertain successful update may replay without another timestamp change only while the thread is open and coordinates already match. Deleted parents, revoked access and foreign plan/files remain inaccessible.

Inspect existing categorical `plan_comment_request_success` / `plan_comment_request_failure` events and HTTP status without logging discussion, coordinates or identifiers. Check session, exact Origin, feature flag and current Site Access when diagnosing 401/403/404. A 503 is retryable; repeated 409 requires canonical reload rather than bypassing the token.

## Verification and rollback

Run the requirement-linked contract, position service/route, client/component and Plan Comments browser tests. Enable `PLAN_COMMENTS_INTEGRATION=true` against an isolated or local development database for the persistence/isolation/race test; it creates and deletes its own Site and Viewer fixtures.

Rollback the application commit to restore fixed-pin interaction. Retain the latest saved coordinates and all discussion data. Do not reset pins or delete threads. This change does not deploy production infrastructure.
