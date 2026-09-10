# Feature: Allocation details viewer and file selector

- ID: `allocation-details-design`
- Status: `approved`
- Approval: User approved this specification in the Codex task on 2026-09-10.
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-10`
- Domain references: `CONTEXT.md — Allocation Plan, Site, Site Access, Organization, Membership, Sign; docs/domain/figjam-object-catalog.md — Objects and data points (Allocation Plan and Site), Nesting map, Current implementation alignment (multiple-file amendment), Known ambiguities 7, 8, and 10`
- Design authority: User-supplied `Plan.png` and `Plan_ Plan dropdown.png` screenshots, 1512×982.
- Scope clarification: User explicitly deferred Sign placement on 2026-09-10.

## Problem

The existing preview has a padded, bordered canvas and floating zoom controls. It cannot preview the files of newly created multi-file Allocation Plans. The supplied designs show an integrated canvas, compact file selector, and bottom help toolbar.

## Outcome and success metrics

Authorized members can open both legacy and multi-file Allocation Plans and switch their files without reloading the document. Desktop geometry matches the supplied references, with no fabricated plan content or Sign records.

## Non-goals

- Sign display, placement, editing, Add sign or Options interactions. Omit these unavailable toolbar hints rather than implying support.
- File renaming, floor labels, PDF page navigation, measurement rulers, downloads, or persistent view preferences.
- Restoring the Allocations ellipsis previously removed at the user's request.
- Changing the surrounding sidebar, Site header, permissions, or upload workflow.

## Requirements

- REQ-001: Both Grid and List links MUST open every finalized Allocation Plan using client navigation at the existing route. Use the real plan name as the accessible link name, falling back to the legacy filename.
- REQ-002: The viewer MUST initially select the first attached file in persisted order. The floating selector MUST show its real filename and list the remaining files in persisted order. Selecting a file MUST close the menu and load only that file, resetting to fit. Legacy single-file plans MUST remain viewable; their selector MUST not expose an empty menu. Example floor names MUST NOT become stored or fabricated labels.
- REQ-003: At 1512×982, preserve the existing Site shell and tabs. The white canvas MUST begin immediately below the tabs near y151, span the available content width near x332–1480, and end above a 40px bottom toolbar near y942. Remove the old canvas margin, rounded frame, and internal decorative padding. Preserve intrinsic image aspect ratio and initial full-image fit; actual drawing content comes only from uploaded files.
- REQ-004: The selector MUST sit 20px below the canvas top at its left edge, approximately 234×38px, with a separate 35px chevron area, 20px blue plan icon, and 12px filename text. The open menu MUST align beneath the filename area, approximately 200px wide with 38px rows, subtle border/shadow, and selected/hover/focus states. Long filenames MUST truncate visually while remaining fully accessible.
- REQ-005: A 40px bottom toolbar across the main area MUST replace the lower-right zoom overlay. Provide compact operable zoom-out, current-percentage/reset, and zoom-in controls with zoom and Space-pan hints. Preserve 25–400% bounds, 25-point steps, unmodified +/-/= and 0 shortcuts, native scrolling, and Space-drag panning. Do not intercept CMD/CTRL browser zoom despite the reference's CMD hint; display hints for actual supported shortcuts. The toolbar MUST not obscure plan content.
- REQ-006: Each file MUST load through authenticated, tenant- and Site-scoped byte delivery. Only completed uploads attached to the requested finalized Allocation Plan are readable. Verify file, plan, Site, Organization, and current Site Access together. Pending, verified-but-unattached, rejected, expired, foreign, and unknown files MUST fail generically.
- REQ-007: Preserve PNG/JPEG decoding and PDF page-1-only rasterization, private no-store/nosniff/CSP headers, canonical media types, 5 MiB response bounds, and no exposed storage capabilities. The existing legacy content endpoint MUST remain compatible.
- REQ-008: Switching files, retrying, or leaving MUST cancel obsolete requests/render tasks and release resources. Late results MUST never replace the selected file. Display filename-specific accessible preview naming, loading, and generic retryable errors; do not keep the previous drawing visible as though it belongs to the new selection. Retry MUST target the currently selected file.
- REQ-009: File selection MUST be operable by keyboard and pointer, with accessible expanded state, Escape/outside dismissal, visible focus, and focus return on selection/Escape. Controls MUST remain usable at 320 CSS pixels and 200% zoom without document-level horizontal overflow. Interactive controls MUST meet WCAG 2.2 AA target requirements.

## Acceptance scenarios

### AC-001 — Open and switch files [REQ-001, REQ-002, REQ-006..REQ-008]

- Given an accessible finalized plan with multiple ordered files
- When a member opens it from either collection view and selects another file
- Then the first file initially loads and the selected file replaces it at fit scale without document navigation or stale content.
- Given a legacy single-file plan, opening it continues to show its original content without an empty dropdown.

### AC-002 — Match the references [REQ-003..REQ-005, REQ-009]

- Given a 1512×982 viewport
- When the selector is closed or open
- Then canvas, selector, rows, and toolbar follow the specified geometry (within 2 CSS pixels), with real filenames and no Sign markers or unavailable Sign hints.
- At narrow width and 200% zoom all controls remain reachable without document overflow.

### AC-003 — Safe failure and cleanup [REQ-006..REQ-008]

- Given an unauthorized, wrong-plan, wrong-Site, wrong-Organization, unattached, or unavailable file
- When content is requested
- Then no bytes or internal metadata are disclosed and the established generic boundary applies.
- Rapid switching, retry, and unmount cancel obsolete work and never display a stale result.

### AC-004 — Accessible navigation and viewing [REQ-005, REQ-009]

- Given keyboard-only or pointer use
- When a member opens/selects/dismisses the selector or zooms/pans
- Then focus and selected-file state remain understandable, zoom stays bounded, Space-pan ends on release/cancellation, and browser shortcuts remain unchanged.

## UX and accessibility

Use the supplied references for spatial design, not sample filenames, drawing contents, or Sign behavior. Maintain visible zoom controls even though the screenshot presents shortcut hints. Represent single-file, multi-file closed/open, loading, error/retry, long filename, zoomed, narrow, and 200%-zoom states in Storybook using independent fixtures.

## API and integrations

Add `GET /api/sites/{siteId}/allocation-plans/{allocationPlanId}/files/{fileId}/content` with UUID path validation and the existing 401/404/503 generic boundaries. Reuse private bounded content delivery. Document the operation in OpenAPI during approved implementation. The collection's existing ordered `files` metadata supplies the selector; no new listing endpoint or presigned read URL is needed. Keep the legacy `/content` endpoint compatible.

## Data and migration

No additional migration. Read existing ordered, completed `AllocationPlanUpload` associations through `groupedPlanId`, with legacy content fallback for old singular contracts. No new file display-name, floor, Sign positioning, Activity, or preference fields.

## Security and privacy

Reauthorize each read using the current session and Site Access. Match all parent IDs server-side rather than trusting client metadata. Do not expose bucket names, object keys, checksums, raw errors, or temporary uploads. Preserve all existing PDF execution restrictions and content limits.

## Reliability and observability

Bound content requests with a timeout and abort obsolete work. Expose retry after a generic failure. Retain existing categorical preview success/failure telemetry without filenames, content, storage keys, or personal dimensions. No new analytics or unbounded log dimensions.

## Test strategy

After approval, write failing tests mapped to AC-001..AC-004 before implementation. Cover scoped store lookup, route authorization/headers/bounds, contract compatibility, both collection links, ordered file selection, loading/retry/race cleanup, legacy behavior, PDF first-page behavior, zoom/pan, and keyboard focus. Add Storybook browser geometry and axe checks, narrow/200% checks, and run relevant unit, integration, lint, type, build, specification, and OpenAPI validation. Report unrelated baseline failures separately.

## Rollout and rollback

Use the existing allocationPlansEnabled flag, retaining its production default. Deploy the additive file endpoint before or with the new client. No storage permissions or upload flags change. Roll back the viewer/client links and additive endpoint without deleting plans or files. Smoke-test legacy and multi-file reads, cross-Site rejection, and file switching before enabling production.

## Compatibility and approval

This approved specification supersedes preview REQ-001 filename-only links, REQ-006 canvas styling, and lower-right zoom-control placement in the earlier preview UX section. It extends content delivery to ordered files from the approved multiple-file model. All other privacy, PDF, zoom, and Sign exclusions remain in force.

## Open questions

- None. Approval accepts real filenames in the selector, existing browser-safe shortcuts, and omission of deferred Sign controls/markers.
