# Feature: Sites latest-first ordering

- ID: `sites-latest-first`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-05`
- Product approval: `Pending explicit approval after this change-control specification is committed and pushed`
- Domain references: `CONTEXT.md — Organization, Membership, Site, Site Access; docs/domain/figjam-object-catalog.md — Site object, Canonical interpretation notes, Nesting map, Known ambiguities 4, 5, and 10`
- Supersedes on implementation: `sites-populated-state REQ-004 ordering direction only; all other sites-populated-state requirements remain authoritative`
- Design authority: `Existing approved Sites populated grid and list frames 2025:11221 and 2043:3580; this specification does not infer sorting behavior from the decorative Figma arrow`

## Problem

The populated Sites page currently orders visible Sites by creation instant ascending, so the oldest Site appears first. Product requires the latest Site to appear first, making newly created Sites immediately visible at the top of every populated representation without requiring a separate client-side sort.

## Outcome and success metrics

- The most recently created visible Site appears first in the sidebar, grid, and list.
- All three representations continue to use one server-authored ordered collection and cannot disagree.
- Equal creation instants remain deterministic across requests and deployments.
- Existing empty, loading, retry, authorization, navigation, accessibility, visual, and plan-limit behavior remains unchanged.
- Frontend and backend unit coverage remains 100%, and focused application E2E confirms the ordering after Site creation.

## Non-goals

- Ordering by `updatedAt`, last activity, alphabetical name, member count, ownership, access scope, or a Figma sample position.
- Adding an interactive sort control, changing the decorative arrow beside `Last modified`, or persisting a sort preference.
- Allowing the browser to submit an ordering field or direction.
- Changing pagination, filtering, search, Site creation, Site Access, `Shared Sites`, Activity, permissions, billing, or Site Allowance behavior.
- Changing the `GET /api/sites` response shape, Site timestamps, database schema, or existing records.

## Requirements

- REQ-001: For this feature, `latest` MUST mean the visible Site with the greatest server-persisted `createdAt` instant. `updatedAt`, Activity, and the browser clock MUST NOT affect ordering.
- REQ-002: `GET /api/sites` MUST order authorized Sites by `createdAt` descending. When two Sites have the same creation instant, their opaque Site IDs MUST be ordered ascending as the stable tie-breaker.
- REQ-003: The server-authored collection from `GET /api/sites` MUST remain the only Sites collection used by the populated sidebar, default grid, and list view. The frontend MUST preserve that order when switching views and MUST NOT sort, refetch, persist, or place an ordering value in the URL.
- REQ-004: A newly created Site MUST appear before all older visible Sites on the next successful `/sites` load. This requirement does not add optimistic insertion or change the existing successful creation destination to Activity.
- REQ-005: Tenant derivation, Site visibility, member-preview minimization, private no-store responses, exact Activity destinations, empty/loading/error states, plan-limit handling, and authorization MUST remain unchanged from the approved Sites specifications.
- REQ-006: The ordering change MUST introduce no new API property, request parameter, database field, index, migration, seed record, client storage, external service, analytics event, log dimension, queue, scheduled job, or AWS resource.
- REQ-007: Backend tests MUST prove descending creation order and ascending Site-ID tie-breaking at the Prisma query boundary. Frontend tests MUST prove sidebar, grid, and list preserve the received order without another request. Application E2E MUST prove that a newly created Site appears before an older Site on the next Sites load. Frontend and backend unit suites MUST retain 100% statement, branch, function, and line coverage.

## Acceptance scenarios

### AC-001 — Newest created Site appears first everywhere [REQ-001, REQ-002, REQ-003]

- Given an authenticated Membership can see three Sites created at different instants
- When the member opens `/sites`
- Then the Site with the greatest `createdAt` instant appears first in the expanded Sites navigation
- And it appears first in the default grid
- And switching to list view keeps the same descending creation order without another Sites request

### AC-002 — Equal creation instants remain deterministic [REQ-002, REQ-007]

- Given two visible Sites have the same `createdAt` instant
- When `GET /api/sites` is loaded repeatedly
- Then those two Sites are ordered by Site ID ascending on every response
- And the sidebar, grid, and list preserve that order

### AC-003 — Creation is visible on the next load without changing creation flow [REQ-004, REQ-005]

- Given an Organization has an older Site
- When an authorized member creates another Site and later loads `/sites`
- Then the newly created Site appears before the older Site
- And the original creation still opens the new Site's Activity destination

### AC-004 — Existing boundaries remain unchanged [REQ-003, REQ-005, REQ-006]

- Given the Sites request returns no Sites, fails, is unauthorized, or reports that the Site Allowance is reached
- When `/sites` renders or retries
- Then its existing empty, failure, login-replacement, retry, and limit behavior is unchanged
- And no client sort state, new request input, or new infrastructure is introduced

## UX and accessibility

This change has no new visual control or copy. It changes only the order of the existing populated Site rows, cards, and table rows. Existing semantic navigation, list, table, current-page, disclosure, focus, truncation, responsive, zoom, and screen-reader behavior remains authoritative.

The arrow beside `Last modified` in Figma frame `2043:3580` remains decorative and hidden from assistive technology. It does not become an interactive sort control and is not evidence that `updatedAt` controls the default order.

## API and integrations

`GET /api/sites` remains the only page-data boundary, with its existing strict response shape. The ordering is applied inside the tenant-scoped Prisma read. No request parameter is accepted and no integration is added or changed.

## Data and migration

The existing `Site.createdAt` and `Site.id` fields provide the complete ordering key. No schema migration, data migration, backfill, index, or seed change is required for the current bounded Site collection.

## Security and privacy

Ordering occurs only after the existing server-derived tenant and visibility rules are applied. It MUST NOT reveal inaccessible Sites, exact timestamps beyond the already approved response, or a distinguishable cross-tenant count. Site IDs remain opaque identifiers and do not grant access.

## Reliability and observability

The stable tie-breaker prevents records with equal creation instants from changing position across requests. The operation remains part of the existing single Sites query, with no client/server ordering disagreement and no N+1 query. Existing categorical API latency and failure telemetry remains sufficient; no new metric or alarm is justified.

## Test strategy

- Update the Prisma adapter expectation first so it fails while the query still orders `createdAt` ascending.
- Change only the query ordering to `createdAt` descending with Site ID ascending, then run focused backend coverage.
- Add or refine frontend preservation tests using deliberately non-alphabetical Sites whose response order is newest-first; do not add frontend sorting.
- Extend the existing Sites application E2E creation journey with an older Site and assert the newly created Site is first after returning to `/sites`.
- Run specification validation, formatting, lint, typecheck, frontend/backend coverage, production builds, Storybook build, design-system tests, focused Sites E2E, and CDK synthesis once before committing and pushing implementation.

## Rollout and rollback

Deploy the backward-compatible API ordering change with the normal immutable application release. Rollback restores `createdAt` ascending ordering in the Prisma query; there is no data, API, or infrastructure rollback.

## Open questions

- None. Product wording is resolved here as newest-created first, not most-recently-modified first.
