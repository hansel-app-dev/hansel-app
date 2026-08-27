# Feature: Design system foundation

- ID: `design-system-foundation`
- Status: `approved`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-08-27`

## Problem

Hansel has multiple Figma-designed product surfaces but no shared code interface for design tokens or common controls. Implementing screens directly would duplicate styling decisions, make design drift difficult to detect, and create inconsistent accessibility and interaction behavior.

## Outcome and success metrics

Hansel has a version-controlled frontend design-system foundation whose semantic tokens and initial primitives are demonstrated in an isolated workbench, consume verified Figma evidence, expose small typed interfaces, meet WCAG 2.2 AA expectations, and preserve 100% frontend unit coverage. Product screens can reuse the system without learning raw design values or Tailwind implementation details.

## Non-goals

- This slice does not implement onboarding, dashboard, email delivery, navigation, tables, dialogs, or complete application screens.
- This slice does not reproduce or import an entire Tailwind Plus template or UI kit.
- This slice does not add dark mode because no approved Hansel dark-theme design has been verified.
- This slice does not invent unobserved responsive states, component variants, animation, icons, or application behavior.
- Email-rendering components remain separate from browser UI primitives because email-client constraints require a different implementation seam.

## Requirements

- REQ-001: The web workspace MUST define named semantic Tailwind CSS tokens for verified Hansel colors, typography, spacing, radii, borders, shadows, and focus treatment; reusable components MUST consume semantic tokens instead of unexplained raw values.
- REQ-002: The initial verified sources MUST include Figma `Foundation / Brown / brown-500` (`#634739`), `Foundation / Off-white / off-white-500` (`#F7F5EB`), `Colours / Greys / White` (`#FFFFFF`), and the Figtree typeface used by onboarding frame `1:3`. The web application and Storybook MUST bundle and load Figtree rather than relying on its presence on the user's device; unverified brand, state, or typography values MUST NOT be presented as Figma-derived tokens.
- REQ-003: The design-system module MUST initially expose `Button` and `TextField` through one public barrel interface and MUST keep Tailwind class composition inside their implementations.
- REQ-004: `Button` MUST support native button attributes, visible keyboard focus, disabled behavior, and only the observed `primary` and `secondary` visual variants; its default `type` MUST be `button` to prevent accidental form submission.
- REQ-005: `TextField` MUST support native input attributes, a programmatically associated visible label, optional description, optional error, invalid and disabled states, visible keyboard focus, and deterministic accessible-description relationships without requiring callers to construct IDs.
- REQ-006: The design-system interfaces MUST use typed React composition and MUST NOT expose raw Tailwind class strings as a required caller concern; an optional `className` escape hatch MAY be accepted for layout integration.
- REQ-007: An isolated Storybook workbench MUST document every initial primitive and its meaningful states without coupling stories to application APIs, authentication, or PostgreSQL.
- REQ-008: Automated accessibility checks MUST run against the workbench, and unit tests MUST verify observable primitive semantics through their public interfaces while frontend statement, branch, function, and line coverage remain 100%.
- REQ-009: A browser visual-regression check MUST render the workbench at a deterministic viewport and compare a committed baseline screenshot; intentional baseline updates MUST be reviewed with the code change.
- REQ-010: Tailwind Plus MAY be used as a licensed implementation reference for accessible React and Tailwind patterns, but the Hansel Figma designs and approved specifications remain authoritative for visual decisions and component scope.
- REQ-011: Design-system source files MUST identify the governing specification and the exact verified Figma reference nodes: onboarding frame `1:3`, welcome-email frame `131:549`, and dashboard frame `2019:2296`.
- REQ-012: Repository specification checks MUST reject missing design-system tokens, exports, workbench configuration, required test commands, or governing Figma references.
- REQ-013: Every newly introduced reusable browser UI component MUST ship with a Storybook story covering its meaningful approved states, accessibility automation, and deterministic visual-regression coverage. Each implemented product screen MUST also ship with an API-independent Storybook story for visual review at its approved representative viewport. A story MUST identify its governing specification and Figma node, use fictional data, and MUST NOT make production network requests or weaken the component's runtime accessibility contract.

## Acceptance scenarios

### AC-001 — Semantic foundations compile [REQ-001, REQ-002]

- Given a clean dependency installation on a device without Figtree installed
- When the web production and Storybook builds run
- Then Tailwind emits the semantic Hansel tokens, the bundled Figtree files load locally, and no component needs a raw verified foundation value to reproduce its supported states

### AC-002 — Button is safe and accessible [REQ-003, REQ-004, REQ-006]

- Given a caller renders each supported Button state
- When a keyboard or pointer user interacts with it
- Then it behaves as a native button, defaults to `type="button"`, exposes focus visibly, prevents activation when disabled, and retains caller-supplied native attributes

### AC-003 — TextField communicates its state [REQ-003, REQ-005, REQ-006]

- Given a caller renders a TextField with a label and optional description or error
- When a user or assistive technology inspects and edits the field
- Then the label targets the input, descriptions are referenced exactly once, errors set the invalid state, disabled state is native, and focus remains visible

### AC-004 — Components are independently inspectable [REQ-007, REQ-010, REQ-011]

- Given the application API and database are unavailable
- When Storybook starts
- Then reviewers can inspect the Button and TextField state matrix and trace the foundation back to the approved Hansel specification and verified Figma nodes

### AC-005 — Design-system regressions are rejected [REQ-008, REQ-009, REQ-012]

- Given a change breaks semantics, accessibility, coverage, token contracts, workbench compilation, or approved visual output
- When local verification or CI runs
- Then the relevant unit, accessibility, contract, build, or visual-regression check fails with an actionable result

### AC-006 — New UI remains independently reviewable [REQ-007, REQ-009, REQ-013]

- Given a reusable browser component or implemented product screen is added or materially changes
- When repository verification runs and Storybook is opened without the application API
- Then its approved states are independently inspectable, traceable to its specification and Figma node, accessibility-scanned, and protected by a reviewed deterministic screenshot
- And no story transmits production data or depends on a live application service

## UX and accessibility

Figma node: `1:3`

Figma node: `131:549`

Figma node: `2019:2296`

The representative onboarding frame shows compact labeled email and password inputs, error treatment, a primary action, and secondary identity-provider actions. The dashboard shows restrained neutral surfaces, borders, cards, and an application shell. The welcome email confirms off-white and white surface foundations but does not authorize browser-component behavior. Button and TextField must meet WCAG 2.2 AA for semantics, keyboard operation, focus visibility, disabled/invalid communication, contrast, reflow, zoom, and reduced motion. Figma evidence never overrides accessible behavior.

## API and integrations

The public module interface is `apps/web/src/design-system/index.ts`. It exports `Button`, `ButtonProps`, `TextField`, and `TextFieldProps`. Storybook is a development-only integration using the existing React, Vite, TypeScript, and Tailwind CSS stack. Tailwind Plus is a human-accessed licensed reference and is not a runtime dependency or external API.

## Data and migration

No Prisma, PostgreSQL, tenant, retention, or data migration changes are required. Component-generated IDs use React's deterministic `useId` mechanism and are not persisted.

## Security and privacy

The design system handles no credentials or customer data. Stories use fictional values and must not include production secrets, personal information, Figma access tokens, or expiring Figma connector assets. Native form behavior and caller event handlers remain explicit; components must not transmit data.

## Reliability and observability

Product runtime must not depend on Storybook, Tailwind Plus, Figma availability, or external asset URLs. Build failures surface locally and in CI. Component failures do not introduce network calls, logging, metrics, or hidden side effects.

## Test strategy

- Contract: validate semantic token declarations, public exports, governing spec references, Storybook configuration, scripts, and absence of forbidden Figma connector URLs.
- Unit: test Button and TextField through rendered roles, labels, accessible descriptions, native attributes, invalid/disabled states, and user interaction; enforce 100% frontend coverage.
- Accessibility: run the Storybook accessibility test integration against every story and fail on violations.
- Build: compile both the production web application and static Storybook.
- Visual: use Playwright at a fixed viewport to compare the initial stories with committed baseline screenshots.
- Regression: run the repository's complete verification suite so backend, contracts, infrastructure, and existing E2E behavior remain unaffected.

## Rollout and rollback

Ship tokens, primitives, stories, tests, workbench configuration, validators, and lockfile together. Product screens adopt the module incrementally through their own approved specifications. Roll back the complete commit if builds, accessibility checks, visual baselines, or existing application behavior regress; no data rollback is required.

## Open questions

- None. Additional tokens and modules require verified design evidence and a later specification amendment or feature spec.
