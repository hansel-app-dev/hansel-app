# Feature: Add new Site design refresh

- ID: `add-site-design-refresh`
- Status: `approved`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-10`
- Domain references: `CONTEXT.md — Site, Site Access Scope, Membership, Organization Role, Image; docs/domain/figjam-object-catalog.md — Objects and data points (Site, User, Image), Canonical interpretation notes (Users with access and Photo / Cover), Known ambiguities 4, 8, 10, Current implementation alignment`
- Design authority: User-supplied `Add new site – Step 1_ Workspace.png`, 1512×982.
- Accepted product clarification: On 2026-09-10 the user confirmed that Next creates the Site and opens the cover-image step, and the Organization screen is labelled Step 1 of 2.

## Problem

The current 600px modal, labelled name field, large access selector, boxed permission options, and footer do not match the supplied compact design. Its Organization-flow action and progress labels also predate the optional cover-image step.

## Outcome and success metrics

The Organization-access first screen matches the reference within 2 CSS pixels at 1512×982, and Next progresses once to the optional cover step after successful creation without navigating away or duplicating a Site.

## Non-goals

- New access rules, invitation behavior, cover validation/upload behavior, or backend changes.
- Redesigning the invitation screen or changing existing submitted Site fields.
- Replacing the real Organization name with the reference placeholder.

## Requirements

- REQ-001: The first screen MUST use a 500px-wide modal, approximately 456px tall in its normal Organization state, centered at x506/y263 at 1512×982. Use a blurred gray backdrop, white surface, 6px corners, subtle shadow, a 52px header, and a 72px pale footer. Errors and wrapped content may increase height with bounded scrolling at small viewports.
- REQ-002: Show `Add new Site` in a 17px semibold heading and a 24px close control. The name row MUST start 24px below the header and contain a 40px pale icon tile, an 8px gap, and a 404×40px input. Keep the accessible Name label but hide its visual label. Start with an empty name and show `New site` as the placeholder, as explicitly requested and approved by the user on 2026-09-10. Preserve normalization, required-name validation, and error association; placeholder text is never submitted as a name.
- REQ-003: Show Who has access in regular 14px type, a 452×40px access selector with the existing selected-scope icon and actual Organization name, and a 12px helper row with a decorative information icon. Preserve the existing listbox choices, keyboard behavior, validation, and scope-specific helper text.
- REQ-004: Organization permissions MUST appear as two unboxed radio rows beneath What they can do, with 16px radio circles and approximately 40px vertical separation. Retain the exact permission labels, values, default View and comment selection, and registration. Existing explanatory text may remain screen-reader-only. No permission changes are authorized by this styling.
- REQ-005: When coverImageEnabled is true, Organization and Private flows MUST show Next and Step 1 of 2. Next validates the existing fields and submits the existing idempotent creation request; only success opens the cover screen, labelled Step 2 of 2. Failure stays on the first screen with the existing generic error/retry behavior. Pending creation MUST prevent duplicate submission and display Creating….
- REQ-006: People You Invite MUST retain the invitation step: when covers are enabled, labels MUST truthfully read Step 1 of 3, Step 2 of 3, and Step 3 of 3. Its first Next MUST only open invitations, while Create site submits the existing creation request before opening the cover screen. Preserve the required assignment, roles, validation, Back, and plan restrictions.
- REQ-007: When coverImageEnabled is false, preserve existing Add new site/immediate-navigation behavior for Organization and Private, and the two-step People You Invite flow. Never advertise a nonexistent cover step. Cover skip, close, upload success, and retry MUST retain existing behavior and must not create another Site.
- REQ-008: The first-screen footer MUST have 24px horizontal padding, a left-aligned progress label, an 80×40px Cancel button, a 16px gap, and a 65×40px Next button when applicable. Preserve readable wider fallback/pending labels. Focus trapping, dismissal confirmation, error announcements, and 320px/200% usability MUST remain intact.

## Acceptance scenarios

### AC-001 — Reference appearance [REQ-001..REQ-004, REQ-008]

- Given Organization access and an enabled cover step
- When the first screen opens, then its modal, header, name row, selector, radio rows, and footer match the supplied reference using real Organization data.
- Keyboard and pointer users can select the existing scopes and permissions; invalid names remain associated with their errors.

### AC-002 — Create before cover [REQ-005, REQ-007]

- Given valid Organization or Private details with covers enabled
- When Next is activated, then exactly one creation succeeds before Step 2 of 2 appears, with no premature navigation.
- A failed creation stays on the first screen; cover retry/skip/close never submits creation again.
- With covers disabled the existing immediate-completion behavior remains unchanged.

### AC-003 — Preserve invitation flow [REQ-006..REQ-008]

- Given People You Invite
- When the user advances, then the existing invitation screen and required assignment validation remain intact with truthful total-step labels, including the cover step only when enabled.

## UX and accessibility

Reuse the existing Modal, form validation, and controls wherever practical. Scope compact styling to the first screen; preserve invitation usability and the established cover design. Use existing icons and Figtree. Support visible focus, labelled radios and input, announced errors, reduced-motion preferences, and bounded dialog scrolling. Do not copy sample Organization names or invent permissions.

## API and integrations

No changes. Next calls the existing createSite seam with the same idempotency key and scope-specific payload. Cover uploads use the returned Site identifier and existing private upload API.

## Data and migration

None. Site creation remains durable before cover upload; no staged Site model or transaction across creation/upload is introduced.

## Security and privacy

Existing server-derived membership, Site Access, scope restrictions, and cover authorization remain authoritative. No new reads, disclosure, storage access, or invitation capability.

## Reliability and observability

Retain existing creation pending/error/idempotency handling and cover failure isolation. No new telemetry or network dependency. The progress labels derive from selected scope and the existing cover feature flag, not a new persistent field.

## Test strategy

After approval, write failing tests for Organization/Private Next, People You Invite totals, failure/retry/no duplicate creation, and cover-disabled compatibility. Add or update Storybook first-screen and flow states. Verify desktop geometry, normal/error/dropdown states, keyboard/radio behavior, axe, narrow/200% layout, and existing modal/cover tests. Run focused lint/types/build checks and report unrelated failures separately.

## Rollout and rollback

Use the existing Site and cover flags; no migration or backend rollout. Revert the presentation/progress amendment to roll back without changing created Sites or stored covers.

## Compatibility and approval

Approved by the user in conversation on 2026-09-10. The user explicitly directed direct pushes to main without a separate branch or PR for this change, waiving the GitHub review step.

On approval, REQ-005..REQ-007 supersede `sites-access-scope` REQ-013 action labels only when covers are enabled and the unconditional third-step wording in `site-cover-image-add` REQ-001. All other behavior remains unchanged. Await specification approval before application edits.

## Open questions

- None.
