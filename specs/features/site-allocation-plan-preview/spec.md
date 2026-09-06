# Feature: Preview a Site Allocation Plan

- ID: `site-allocation-plan-preview`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-06`
- Product and technical approval: `Pending approval in the Codex task`
- Domain references: `CONTEXT.md — Organization, Membership, Organization Role, Site, Site Access, Allocation Plan, Document, and Image; docs/domain/figjam-object-catalog.md — Allocation Plan, Site, Organization, Document, and Image objects; Canonical interpretation notes; Nesting map; Current implementation alignment; and Known ambiguities 7, 8, and 10`
- Design authority: `User-supplied screenshot 03.png, corresponding to the Hansel App UI Allocation Plan viewer`
- Design evidence: `The supplied 1512×982 screenshot establishes the existing Site shell, current Allocations tab, and a large centered plan image occupying the remaining content canvas. It shows no approved editing, signage, page-navigation, download, comment, or metadata controls.`

## Problem

Authorized Site members can see finalized Allocation Plans but cannot open one. The original files remain in private S3 storage and the approved add/list slice intentionally exposes no object key, download URL, or preview behavior. Hansel needs a tenant-isolated viewer that presents image plans and the first page of PDF plans as a zoomable image without making stored objects public or inventing editing behavior from the design.

## Outcome and success metrics

- An authorized member can activate a finalized Allocation Plan from Grid or List view and see it in the supplied Site-shell viewer.
- PNG and JPEG plans render directly; PDF plans render page 1 only into the same non-interactive image surface.
- Members can zoom in, zoom out, and reset to fit using visible controls and keyboard equivalents.
- Unauthorized, unavailable, malformed, cross-Organization, or cross-Site requests reveal no plan or storage metadata.
- At least 99% of valid previews of approved files at or below the existing 5 MiB upload limit become visible without an application error, excluding client disconnects and AWS regional incidents.

## Non-goals

- PDF page navigation or rendering any PDF page after page 1.
- Downloading, printing, sharing, replacing, renaming, editing, deleting, annotating, rotating, cropping, or persisting a zoom level.
- Creating, positioning, editing, or displaying Signs, markers, comments, measurements, layers, or plan metadata.
- OCR, thumbnails, permanent raster derivatives, image transformation pipelines, malware scanning, or Storage Allowance enforcement.
- Public S3 access, presigned read URLs in browser-visible contracts, or direct browser access to S3.

## Requirements

- REQ-001: Grid cards and List rows for finalized Allocation Plans MUST expose keyboard-operable links to `/sites/{siteId}/allocations/{allocationPlanId}`. The full filename MUST remain the accessible link name. Activating a plan MUST use the established client-navigation seam without a full document reload.
- REQ-002: The preview route MUST load the existing authenticated Site shell, real Organization and Site identity, and current `Allocations` Site-section state before requesting content. A missing, malformed, inaccessible, cross-Organization, cross-Site, pending, rejected, expired, or deleted identifier MUST use the existing generic authentication/failure boundary without disclosing whether the Site or Allocation Plan exists.
- REQ-003: `GET /api/sites/{siteId}/allocation-plans/{allocationPlanId}/content` MUST require the current application session, authorize Site Access independently, and resolve the finalized Allocation Plan by Organization, Site, and Allocation Plan identifiers. It MUST return only the stored bytes for that finalized plan and MUST never expose the bucket name, object key, checksum, uploader identity, AWS credential, or presigned URL.
- REQ-004: The content response MUST be same-origin, private, `no-store`, `nosniff`, bounded to the existing 5 MiB Allocation Plan limit, and use the persisted canonical media type. It MUST permit only `image/png`, `image/jpeg`, or `application/pdf`; all other stored types and storage failures MUST fail generically. It MUST set a restrictive Content Security Policy suitable for non-HTML bytes and MUST NOT use user-controlled content as a response header value.
- REQ-005: PNG and JPEG bytes MUST be decoded into the viewer as an image. PDF bytes MUST be decoded with the repository-pinned PDF renderer and render page 1 only into a canvas or raster image; document scripts, forms, attachments, annotations, external links, embedded navigation, and subsequent pages MUST never be executed or presented. Rendering MUST occur from in-memory response bytes without creating a persistent derivative or third-party request.
- REQ-006: The viewer MUST match screenshot 03.png at desktop widths: retain the Site shell and Site-section navigation, remove the collection controls from the content area, and use the remaining area as a clipped neutral canvas containing the plan image centered at its initial fit-to-view scale. The image MUST preserve its intrinsic aspect ratio and MUST never be stretched.
- REQ-007: The viewer MUST expose visible `Zoom out`, `Reset zoom`, and `Zoom in` controls. Initial and reset scale MUST fit the entire plan within the available canvas. Zoom steps MUST be deterministic 25-percentage-point increments bounded from 25% through 400%; controls MUST be disabled at their applicable bound and the current percentage MUST be exposed as text.
- REQ-008: When zoomed beyond the available canvas, the member MUST be able to pan using native two-dimensional scrolling without moving or obscuring the Site shell. Zoom MUST remain centered on the plan when practical and MUST not cause document-level horizontal scrolling.
- REQ-009: While focus is within the viewer, `+` or `=` MUST zoom in, `-` MUST zoom out, and `0` MUST reset to fit. Browser and assistive-technology shortcuts MUST not be intercepted when a modifier key is held. Every zoom action MUST announce the resulting percentage through a polite live region without moving focus.
- REQ-010: The canvas MUST expose the full Allocation Plan filename as its accessible name and a concise loading state while shell/content requests are pending. Decode, render, network, or storage failure MUST replace the loading state with one generic retryable message; it MUST not display partial bytes, stack traces, S3 details, or a broken-image placeholder.
- REQ-011: The preview MUST reflow at 320 CSS pixels and 200% zoom. Controls MUST remain reachable, meet WCAG 2.2 AA target/focus/contrast requirements, and the plan canvas MUST retain a useful minimum height without overlapping the shell. Motion MUST not be required to understand zoom state.
- REQ-012: Object URLs, PDF documents, render tasks, canvases, and byte buffers created by the client MUST be cancelled or released when the route changes, a retry replaces them, or the module unmounts. The browser MUST make at most one active content request and one active PDF page render for the selected plan.
- REQ-013: The preview route, zoom states, loading, PNG/JPEG, PDF-first-page, decode failure, unavailable content, narrow width, and 200%-zoom states MUST be represented in Storybook using API-independent fixtures. Tests MUST prove link navigation, tenant-safe API behavior, strict headers, first-page-only PDF rendering, zoom bounds, reset, keyboard controls, cleanup, responsive behavior, axe results, and absence of storage identifiers without live AWS.
- REQ-014: The feature MUST be guarded by the existing `allocationPlansEnabled` runtime flag and default off in production. The rollout MUST not change the bucket's public access, CORS, retention, upload permissions, or lifecycle configuration. The API task role MAY receive only the existing exact-prefix read permission needed to fetch finalized plan objects.
- REQ-015: Telemetry MUST use bounded event names for preview requested, succeeded, failed, PDF decoded, and decode failed. Logs, metrics, and traces MUST NOT contain filenames, content bytes, bucket names, object keys, checksums, Site or Organization names, or other unbounded/personal dimensions.

## Acceptance scenarios

### AC-001 — An authorized member opens and zooms an image plan [REQ-001..REQ-012]

- Given an authenticated member can access a Site containing a finalized PNG or JPEG Allocation Plan
- When the member activates its Grid card or List row
- Then the client navigates to the plan route and displays the full image fitted within the screenshot-derived viewer
- And visible controls and unmodified keyboard keys zoom from 25% through 400%, reset to fit, announce the percentage, and permit native panning without moving the Site shell

### AC-002 — A PDF presents only its first page [REQ-003..REQ-006, REQ-010, REQ-012]

- Given an authorized Site member opens a finalized multi-page PDF Allocation Plan
- When the private bytes are decoded
- Then only page 1 is rendered into the image viewer
- And scripts, links, annotations, forms, attachments, and later pages are neither executed nor presented

### AC-003 — Access and content failures remain private [REQ-002..REQ-005, REQ-010, REQ-014, REQ-015]

- Given an expired session, unauthorized member, manipulated identifier, cross-Organization or wrong-Site plan, unavailable object, unsupported stored type, or decode failure
- When the shell or content endpoint is requested
- Then Hansel fails through the generic authentication or retryable preview boundary
- And no plan existence, filename, content bytes, storage identifier, credential, or internal error is disclosed

### AC-004 — The viewer is accessible and resource-bounded [REQ-007..REQ-013]

- Given keyboard-only use, a screen reader, 320 CSS pixels, 200% zoom, repeated retries, or rapid route changes
- When the member operates or leaves the viewer
- Then controls, scale, loading, failure, panning, and focus remain understandable and reachable
- And obsolete requests, object URLs, PDF tasks, canvases, and buffers are cancelled or released

## UX and accessibility

The route preserves the existing Site shell and current Allocations tab shown in screenshot 03.png. The content below the Site-section navigation becomes a neutral clipped canvas. The plan is centered and fit fully into the available area on first render. Compact zoom controls overlay the lower-right edge of the canvas without covering the primary plan content; their labels remain available to assistive technology and the current percentage is visible.

The image/canvas has the filename as its accessible name. Loading and failure states occupy the same canvas so layout does not jump. Native scrolling provides panning at large scales. Keyboard zoom applies only while focus is within the viewer, does not override modified browser shortcuts, and announces bounded changes without stealing focus.

## API and integrations

- Add `GET /api/sites/{siteId}/allocation-plans/{allocationPlanId}/content` as an authenticated same-origin binary response.
- Extend the Allocation Plan store with a tenant- and Site-scoped finalized-record lookup that returns the internal object key only inside the API module.
- Extend the private S3 adapter with a bounded object-body read. No read URL or object key enters an application response.
- Add a pinned client PDF-rendering dependency that accepts in-memory bytes and is configured only to load and render page 1.

The endpoint has no query-controlled object key, filename header, or remote URL. It returns a categorical 401/404/503 boundary consistent with existing Site routes. OpenAPI documents the strict identifiers, media responses, private caching headers, and categorical failures.

## Data and migration

No schema migration is required. The route reads only finalized `AllocationPlan` rows and their existing private object keys. It creates no preview, thumbnail, derivative, zoom-preference, activity, or last-viewed record.

## Security and privacy

Authorization is derived from the application session and existing Site Access rules on every content request. Same-origin proxying prevents S3 capabilities and identifiers from reaching the browser. The response is bounded by the already enforced upload size and stored canonical media type, and cannot be interpreted as HTML.

Malware scanning remains out of scope, so the viewer does not execute or expose document behavior: images are decoded as pixels, PDFs are supplied to a pinned renderer from in-memory bytes, and only page 1 is rasterized. No links, forms, attachments, annotations, JavaScript, font/network fetches, download affordance, or native PDF plugin is enabled. Dependency review and lockfile integrity checks are required before rollout.

## Reliability and observability

Shell and content failures are independently retryable and generic. The client cancels obsolete work and bounds simultaneous decoding. The API reads no more than 5 MiB and treats truncation, missing data, type mismatch, and S3 unavailability categorically. Existing API availability targets apply; preview failure rate is monitored with bounded dimensions.

## Test strategy

- Add contract and route tests for authentication, Site/Organization scoping, finalized-only lookup, identifiers, media types, body bounds, exact security/cache headers, and generic failures.
- Add store and S3-adapter tests for exact finalized lookup and bounded body reads without exposing internal identifiers.
- Add client tests with PNG/JPEG fixtures and a deterministic multi-page PDF fixture proving that only page 1 is requested and rendered.
- Add integration tests for card/row navigation, shell state, initial fit, button and keyboard zoom, bounds, reset, percentage announcement, panning containment, cleanup, retry, and route changes.
- Add Storybook visual/axe checks for normal, loading, error, bounds, narrow width, and 200%-zoom states without live API or S3.
- Run specification validation, formatting, lint, type checks, 100% unit coverage, production builds, Storybook, OpenAPI checks, CDK synthesis, and application E2E.

## Rollout and rollback

Deploy the additive API route and frontend behind the existing `allocationPlansEnabled=false` production default. Verify private headers, cross-Organization rejection, image decoding, PDF page-1 rendering, zoom controls, and cleanup in the protected environment before enabling. Rollback removes the preview links and route while leaving upload/list behavior, database rows, and retained S3 objects unchanged.

## Open questions

- None. Approval accepts first-page-only PDF rendering, same-origin authenticated byte delivery, no direct S3 reads, visible 25%–400% zoom controls, native scroll panning, no persistent derivatives, and no download or document-interaction behavior.
