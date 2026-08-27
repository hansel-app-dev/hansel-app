# Feature: Tailwind CSS frontend foundation

- ID: `tailwind-css-frontend`
- Status: `approved`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-08-27`

## Problem

Hansel's React frontend needs a consistent, maintainable styling system. Without an explicitly specified styling technology and integration contract, features can introduce incompatible styling approaches and the implementation can drift from the agreed frontend stack.

## Outcome and success metrics

Tailwind CSS is the standard styling system for the React frontend. A clean install can compile the application and its Tailwind utilities, automated checks detect a missing integration, and the existing user-facing experience remains functional.

## Non-goals

- This change does not redesign the existing interface or alter product behavior.
- This change does not add a third-party component library, theme package, CSS-in-JS library, or Tailwind plugin.
- This change does not require replacing every small global CSS rule when a global rule is clearer or required for browser defaults.

## Requirements

- REQ-001: The web workspace MUST use Tailwind CSS major version 4 as its primary styling system.
- REQ-002: Tailwind CSS MUST be integrated into the Vite build through Tailwind's supported Vite integration and imported by the frontend stylesheet.
- REQ-003: React components MUST use Tailwind utility classes for component layout and presentation; global CSS MUST be limited to Tailwind initialization and genuinely global browser-level styling.
- REQ-004: The existing responsive layout, readable API health states, semantic landmarks, and reduced-motion behavior MUST remain intact.
- REQ-005: The web workspace MUST retain strict TypeScript checks, 100% unit-test coverage, production build validation, and the existing critical Playwright journey.
- REQ-006: The repository MUST contain an automated contract check that fails when the declared Tailwind dependency, Vite integration, or stylesheet import is removed or materially misconfigured.

## Acceptance scenarios

### AC-001 — Tailwind utilities compile [REQ-001, REQ-002, REQ-003]

- Given dependencies are installed from the lockfile
- When the web production build runs
- Then Tailwind processes the frontend stylesheet and emits CSS for utility classes used by React components

### AC-002 — Styling integration drift is rejected [REQ-006]

- Given the Tailwind dependency, Vite plugin, stylesheet initialization, or plugin registration is absent or inconsistent
- When specification compliance checks run
- Then the checks fail with an actionable error identifying the missing contract

### AC-003 — Existing experience is preserved [REQ-004, REQ-005]

- Given the frontend is running at a supported viewport and the API is healthy, pending, or unavailable
- When a user opens the application
- Then the existing content, landmarks, responsive presentation, accessible live status, and reduced-motion preference continue to work

### AC-004 — Quality gates remain enforced [REQ-005]

- Given the Tailwind integration is installed
- When repository verification and the critical browser journey run
- Then formatting, linting, type checking, 100% web unit coverage, production build, and E2E checks pass

## UX and accessibility

This is a styling-system migration, not a visual redesign. The current content hierarchy, responsive behavior from 320-pixel viewports upward, semantic header/main/section structure, readable contrast, live API status, and `prefers-reduced-motion` behavior must be preserved. Utility usage must not replace semantic HTML or accessible names.

## API and integrations

No API contract changes are permitted. The existing `GET /health` integration and frontend health-state behavior remain unchanged. Tailwind integrates only with the web workspace's Vite build.

## Data and migration

No Prisma models, PostgreSQL data, migrations, tenant boundaries, or retention rules change.

## Security and privacy

Tailwind runs at build time and must not add runtime services, remote stylesheets, browser tracking, secrets, or new data collection. Dependencies remain lockfile-pinned and are evaluated by existing dependency and CI controls.

## Reliability and observability

A missing or invalid Tailwind integration must fail during local verification and CI rather than at deployment. Existing application health reporting, logs, metrics, traces, alarms, and service-level behavior are unchanged.

## Test strategy

- Contract: validate the Tailwind and Vite package declarations, Vite plugin registration, Tailwind stylesheet import, and representative utility usage.
- Unit: retain 100% statement, branch, function, and line coverage for frontend TypeScript and React behavior.
- Build: compile the production web bundle and assert that generated CSS contains a representative Tailwind utility used by the application.
- E2E: run the existing critical Playwright journey to verify rendered content and API health behavior.
- Regression: run the complete repository verification suite so backend, contracts, and infrastructure remain unaffected.

## Rollout and rollback

Ship the dependency, Vite integration, stylesheet initialization, component utility migration, contract validator, and lockfile together. Roll back the complete commit if the production build, browser journey, or visual behavior regresses; no data rollback is required.

## Open questions

- None.
