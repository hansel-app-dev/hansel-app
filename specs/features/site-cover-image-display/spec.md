# Feature: Display Site cover Images

- ID: `site-cover-image-display`
- Status: `approved`
- Product approval: `Approved explicitly by the user in the Codex task on 2026-09-07`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-07`
- Domain references: `CONTEXT.md — Site, Image, Membership, Organization, Site Access; docs/domain/figjam-object-catalog.md — Objects and data points (Site Photo / Cover and Image), Canonical interpretation notes, Known ambiguities 8 and 10, Current implementation alignment`
- Extends: `site-cover-image-add; upon approval supersedes the placeholder-only treatment and no-S3-read restriction in sites-populated-state REQ-009, REQ-010, REQ-024 and API and integrations, only for grid cover display`

## Problem

The Sites grid always renders a pale placeholder even when a Site has a finalized cover Image. The user requests showing that saved cover on the Sites page. Uploading an Image does not currently provide a read endpoint or a cover indicator in Site summaries.

## Outcome and success metrics

Every visible Site with a finalized, available cover displays it in its existing grid cover region on returning to or reloading Sites. Sites without a cover retain the existing appearance. Cover failures never prevent Site navigation or loading other cards.

## Non-goals

- Changing list rows, sidebar symbols, Activity headers, card dimensions, sorting, or Site Access.
- Upload changes, editing, replacement, cropping controls, thumbnails, CDN infrastructure, public URLs, galleries, or data migrations.

## Requirements

- REQ-001: Grid cards MUST display the finalized cover when present, using the existing 188-pixel-high cover region with centered object-fit cover, no image stretching, and no change to card text or navigation.
- REQ-002: Missing, pending, failed, unavailable, or undecodable covers MUST retain the existing pale placeholder without a broken-image icon, layout shift, blocking page error, or automatic retry loop. Returning to Sites MAY retry image loading.
- REQ-003: GET /api/sites MUST expose an optional boolean hasCoverImage in each existing authorized Site summary, true only for a finalized cover. Absence means false for compatibility. The projection MUST avoid per-Site database queries and MUST disclose no filename, storage key, bucket, or signed URL.
- REQ-004: GET /api/sites/{siteId}/cover-image MUST return only the finalized stored PNG/JPEG bytes after application-session authentication and the same tenant and Site-visibility checks used by Site Activity. Every Membership that can view the Site, including a Viewer, MAY read its cover; uploading-creator restrictions MUST NOT restrict this read. Missing, inaccessible, cross-tenant, or unfinalized covers MUST return generic 404; unauthenticated requests return 401; storage failures return a categorical 503.
- REQ-005: Cover responses and errors MUST use Cache-Control: private, no-store. Successful responses MUST declare the stored verified image media type and X-Content-Type-Options: nosniff. Storage remains private; no public ACL, redirect to S3, infrastructure identifier, or browser-supplied object key is allowed.
- REQ-006: The frontend MUST use its configured API base and existing authenticated request handling, load only covers indicated by the summary, and release temporary object URLs on replacement or unmount. It MUST not persist cover bytes in browser storage or render an old Site's image after the Site identifier changes.
- REQ-007: Cover imagery MUST remain decorative alongside the existing accessible Site link name. Card focus, keyboard navigation, client-side routing, responsive layouts, and grid/list switching MUST remain unchanged. Storybook MUST cover saved, absent, pending-load, and failed-cover states.

## Acceptance scenarios

### AC-001 — Saved cover appears [REQ-001, REQ-003, REQ-006, REQ-007]

- Given a visible Site has a finalized PNG or JPEG cover
- When the User opens or returns to the Sites grid
- Then that Image fills the existing card cover area and the card still navigates to that Site's Activity page without a full reload.

### AC-002 — Safe placeholder fallback [REQ-002, REQ-003, REQ-006]

- Given a Site has no finalized cover, or its cover request or decoding fails
- When the Sites grid renders
- Then the pale placeholder remains, other cards work, and no broken-image icon or repeated request loop appears.

### AC-003 — Access follows the Site [REQ-004, REQ-005]

- Given authorized and unauthorized Memberships, including a Viewer and a Membership in another Organization
- When they request cover bytes directly
- Then authorized Site viewers receive the private Image while unauthorized callers receive the prescribed generic error without storage details.

### AC-004 — Existing UI remains intact [REQ-001, REQ-006, REQ-007]

- Given keyboard use, grid/list switching, a narrow viewport, or a cover still loading
- When the User interacts with Sites or navigates away
- Then card dimensions, names, focus and destinations remain unchanged, list view retains its existing symbols, and pending resources and object URLs are cleaned up.

## UX and accessibility

Use the existing card cover area, not a new thumbnail or control. Center-crop visually with object-fit cover. Decorative images have empty alternative text because the enclosing link already names the Site. Preserve the placeholder throughout loading and failure. Verify 320 CSS pixels, 200% zoom, and absence of serious axe violations.

## API and integrations

Extend the strict SiteSummary Zod/OpenAPI schemas with optional hasCoverImage. Add the authenticated binary read endpoint above, reusing the existing private S3 client and Site authorization boundary. No storage fetch occurs during the Sites summary query. Bound image reads and network timeouts according to the existing maximum stored cover size; cancel browser fetches when cards unmount.

## Data and migration

Read the existing SiteCoverImage association and completedAt state introduced by site-cover-image-add. No new fields, backfill, seed records, or migration. The catalog's older source-only Image alignment note is superseded for this bounded SiteCoverImage usage by the approved upload specification; this change does not introduce a general Image library.

## Security and privacy

Derive Organization and Membership from the application session, and authorize each image request independently of the list response. Site UUIDs are not authorization. Never expose private object keys or grant public storage access. Session revocation and Site Access changes take effect on subsequent reads. Do not log Image bytes, filenames, Site names, or credentials.

## Reliability and observability

Cover failure is isolated to its card. Keep page-data failure handling unchanged. Use existing categorical server error logging and request monitoring for dependency failures; no new queues, alarms, analytics, or metric dimensions. Avoid N+1 summary queries and do not repeatedly retry failed covers during a render.

## Test strategy

Write failing tests first for summary flags, completed-only filtering, authorized Viewer and creator reads, cross-tenant/inaccessible/expired-session rejection, headers, PNG/JPEG media types, missing objects, and storage errors. Add frontend tests for present/absent/loading/error covers, object URL cleanup, navigation and grid/list regressions. Add Storybook states and an authenticated browser journey from a saved cover to the Sites grid. Run contract, API, web, type, lint and build checks; verify the real private-storage path without retaining test fixtures.

## Rollout and rollback

Deploy the compatible read endpoint and optional summary field before or with the consuming frontend. Cover display is independent of whether new uploads are enabled: previously finalized covers remain readable. Rollback restores the placeholder frontend without deleting uploaded data. No infrastructure or database rollback is needed.

## Open questions

- None. This proposal limits display to the existing grid cover region and preserves list view.
