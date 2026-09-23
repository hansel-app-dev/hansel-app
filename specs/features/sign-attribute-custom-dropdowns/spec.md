# Feature: Custom Function and Colour dropdowns

- ID: `sign-attribute-custom-dropdowns`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-23`
- Domain references: `CONTEXT.md — Sign, Allocation Plan, Site Access, Organization Role; docs/domain/figjam-object-catalog.md — Objects and data points (Sign), Organization roles and permissions, Known ambiguities 7 and 10, How feature work must use this catalog (sign-function-options and sign-mounting-options amendments)`
- Design authority: `User request on 2026-09-23: make Function and Colour custom dropdowns similar to the existing Type dropdown in the Sign General drawer. apps/web/src/sites/SignMountingSelect.tsx is the current visual and interaction reference.`
- Supersedes on approval: `sign-function-options UX and accessibility requirement to retain native select behavior. Its option values, ordering, persistence and permissions remain authoritative.`

## Problem

Function and Colour use browser-native selects while Type uses a custom trigger and listbox. The user wants consistent dropdowns in the Sign General drawer.

## Outcome and success metrics

Function and Colour render custom dropdowns matching Type, work with pointer and keyboard, and preserve existing shared Sign values and save behavior.

## Non-goals

- Additional Function or Colour options, custom values, search, multi-select, new icons for Function, or changes to marker appearance.
- Changing Type choices, Site Sign Type grouping, permissions, APIs or persistence.
- Replacing dropdowns elsewhere in the application.

## Requirements

- REQ-001: Replace the native Function and Colour selects in the Sign General drawer with labelled custom single-select triggers and listboxes. Match Type's 40px full-width trigger, white surface, neutral border, rounded corners, typography, label spacing, trailing chevron, menu border/shadow and hover/focus treatment. Menus MUST remain legible and reachable within the drawer and viewport, including long labels.
- REQ-002: Function MUST offer exactly Identification, Directional, Informational and Regulatory/Statutory in that order. The selected value MUST be visible in the closed trigger. Colour MUST offer the existing Red value only, retaining its current decorative swatch in both trigger and option. Opening Colour MUST show its custom listbox even with one option. Labels provide meaning independently of swatch colour.
- REQ-003: A trigger MUST expose its label, expanded state and listbox relationship; the listbox MUST expose the selected option. Pointer click and Enter/Space open the menu with the current option active. Arrow keys navigate; Home/End reach the first/last option; Enter/Space commits the active option. Escape closes only the dropdown and keeps the Sign drawer open. Selecting or pressing Escape returns/retains trigger focus. Tab closes without trapping focus; outside interaction dismisses without saving. These keys MUST NOT pan the drawing, create a Sign or trigger unrelated drawer actions.
- REQ-004: Selecting a different Function MUST invoke exactly one existing Sign update with that value, close the menu and preserve current saving, concurrency, error and retry behavior. Selecting the already selected Function or Red MUST close without a redundant update. Opening, navigating or dismissing a menu MUST NOT save. Other attributes remain unchanged and successful selection survives Sign reload.
- REQ-005: Viewers and users without MANAGE_SIGNS permission MUST see the selected labels/swatches but cannot open or change the controls. Disable both controls during pending saves. A menu MUST close when its control becomes disabled, its Sign changes, its tab changes or the drawer closes; it MUST NOT reopen automatically afterwards. Failed and stale saves retain existing recovery behavior without falsely reporting success.
- REQ-006: Use a small reusable custom select component or reuse an appropriate existing component with these behaviors. Add its important open, closed, selected, long-label, disabled and keyboard states to Storybook, plus integrated Function and Colour drawer examples. Existing Type presentation and behavior MUST remain intact.

## Acceptance scenarios

### AC-001 — Visual consistency and exact options [REQ-001, REQ-002, REQ-006]

- Given an editable Sign in General, when Function or Colour opens, then a custom listbox matches Type's field/menu styling and displays only the existing allowed values.
- Given any supported Function, when the menu is closed, then its selected label is shown; Colour shows Red with the existing swatch.
- At 320 CSS pixels and 200% zoom, the controls and menu choices remain reachable without horizontal document overflow or unreadable clipping.

### AC-002 — Keyboard operation and dismissal [REQ-003, REQ-004]

- Given a focused trigger, when opened and navigated with keyboard keys, then active and selected options are exposed correctly and Enter/Space selects once.
- Given an open menu, when Escape is pressed, then only that menu closes and focus stays on its trigger, with no drawer close or drawing pan.
- Tab and outside interaction dismiss without saving; choosing the current value also performs no update.

### AC-003 — Save, permissions and lifecycle [REQ-004, REQ-005]

- Given each different Function, when selected and reloaded, then the existing save flow persists it without changing other Sign attributes.
- Given a pending save or Viewer, when interacting with the controls, then opening and mutation are unavailable.
- Given a failed or stale save, then existing error/retry/reload behavior remains available.
- Given an open menu, when switching Sign, changing tab, closing the drawer or becoming disabled, then no stale menu or delayed selection survives.

## UX and accessibility

Follow the existing Type reference, using combobox/listbox semantics, visible focus and text labels. Decorative swatches are hidden from assistive technology. Do not use mounting illustrations for Function. Opening a second field dismisses the first. Preserve the existing drawer's scroll behavior and ensure a menu can be fully reached in narrow/zoomed layouts.

## API and integrations

No endpoint, contract, validation or network integration changes. Use the existing Sign update payload and optimistic concurrency token. Only committing a different Function causes a mutation.

## Data and migration

No migration or backfill. Reuse the current Sign.function and Sign.colour values. This is a presentation and interaction amendment, not a new domain attribute or option set.

## Security and privacy

Retain current client edit guards and server session, Origin, Site/Organization access and MANAGE_SIGNS checks. Render fixed labels as text and the existing swatch locally. No new data collection or logging.

## Reliability and observability

Retain existing save status, retry and conflict reporting. Dropdown navigation remains local and produces no requests. Close stale menus on control lifecycle changes. No new telemetry or infrastructure.

## Test strategy

After separate specification approval, write failing tests for custom option rendering, exact option order, one-update selection, no-op/dismissal, disabled and lifecycle behavior, and Escape/Space isolation before implementation. Update native-select tests to exercise the real custom interactions. Add focused browser checks for keyboard operation, matching field geometry, swatch rendering, long labels, narrow/zoomed layout and accessibility. Run affected tests, specification checks, formatting, lint, types, application and Storybook builds; report existing repository-wide failures separately.

## Rollout and rollback

Commit and push this specification separately, obtain explicit approval, then implement test-first on main. Use the existing Allocation Plan Sign feature flag. Release frontend assets through the normal process. Reverting the frontend controls requires no data migration and preserves all stored Sign values.

## Open questions

- None.
