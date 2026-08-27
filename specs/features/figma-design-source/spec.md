# Feature: Figma design source integration

- ID: `figma-design-source`
- Status: `approved`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-08-27`

## Problem

Hansel's application designs live in Figma, but a shared URL alone does not give engineering a durable, machine-readable contract for locating approved screens, mapping design decisions to React and Tailwind CSS, or detecting when implementation proceeds without valid design context.

## Outcome and success metrics

The repository identifies one canonical Figma file and records verified page and node identifiers. Every UI feature specification references an approved, inspectable Figma frame before implementation, design assets and tokens are mapped deliberately into the codebase, and automated validation rejects missing or malformed design-source metadata.

## Non-goals

- This integration does not make the production application call Figma at runtime.
- This integration does not automatically deploy arbitrary Figma changes to production.
- This integration does not treat generated Figma reference code as production-ready code.
- This integration does not infer application screens from the current cover artwork.
- This change does not modify the existing application UI.

## Requirements

- REQ-001: The repository MUST declare the canonical Figma file key `2zlJi8PzLXCbHqEGQI7Hn5`, its canonical URL, and verified page and frame node identifiers in version-controlled design-source metadata.
- REQ-002: The Figma connection MUST be used only as authenticated development tooling; Figma credentials, access tokens, and expiring asset URLs MUST NOT be committed or exposed to the browser application.
- REQ-003: A UI implementation MUST NOT begin until its approved feature specification references at least one node-specific Figma frame that has been inspected through authenticated Figma access; every registered `application-screen` node MUST name that specification and the specification MUST cite the same node.
- REQ-004: Figma output MUST be treated as design evidence and adapted to the repository's React, TypeScript, Vite, and Tailwind CSS conventions rather than copied as authoritative production code.
- REQ-005: Design variables MUST map to named, version-controlled application tokens; unexplained raw values MUST NOT replace an available mapped token.
- REQ-006: Icons and images MUST be exported from the referenced Figma nodes, stored in an appropriate durable application or CDN location, and include accessible treatment; expiring Figma connector URLs MUST NOT ship in committed application code.
- REQ-007: Each implemented screen MUST define its supported viewport states, content states, interaction states, semantic structure, keyboard behavior, and WCAG 2.2 AA expectations in its feature specification.
- REQ-008: Each implemented screen MUST have automated unit and E2E coverage plus visual comparison evidence at its specified viewport states before acceptance.
- REQ-009: Figma changes MUST enter the application through a reviewed specification and code change; a changed Figma file alone MUST NOT change production behavior.
- REQ-010: Repository specification checks MUST reject missing, malformed, or inconsistent canonical design-source metadata.
- REQ-011: Verified nodes MUST record their observed Figma kind and implementation role; page `0:1` (`Cover`) and frame `48:25` (`Cover`) MUST remain `reference-only` and MUST NOT be represented as application screens.
- REQ-012: User-supplied but uninspected nodes MUST be registered as `pending-verification` and record their claimed scope and node-specific URL. Authenticated browser inspection MAY promote pages and frames to `visual-reference` with recorded evidence and dimensions, but only `application-screen` nodes linked to an approved feature specification authorize screen implementation.

## Acceptance scenarios

### AC-001 — Canonical design source is discoverable [REQ-001, REQ-010, REQ-011, REQ-012]

- Given a clean repository checkout
- When specification validation runs
- Then it verifies the Figma provider, file key, canonical URL, the verified cover nodes, the supplied onboarding node `1:2`, email node `131:548`, dashboard node `40:502`, and every node's implementation classification

### AC-002 — Unspecified UI work is blocked [REQ-003, REQ-011, REQ-012]

- Given a proposed UI implementation references only the file root, a page, the cover frame, a pending-verification node, a visual-reference node without an implementing feature specification, or no Figma node
- When the implementation is reviewed
- Then the work is rejected until its feature specification references an accessible approved application-screen frame

### AC-003 — Design context is adapted safely [REQ-002, REQ-004, REQ-005, REQ-006]

- Given an approved application-screen frame is available
- When engineering retrieves its design context
- Then the implementation reuses repository conventions and mapped tokens, stores durable exported assets, and contains no Figma credentials or expiring connector asset URLs

### AC-004 — Screen fidelity is demonstrated [REQ-007, REQ-008]

- Given a screen implementation is ready for review
- When its quality gates run
- Then unit tests, E2E behavior, accessibility checks, and visual comparisons cover every viewport and state named by the feature specification

### AC-005 — Figma changes are controlled [REQ-009]

- Given a designer changes a registered Figma frame
- When no corresponding reviewed specification and code change has been approved
- Then the production application remains unchanged

## UX and accessibility

Figma is a visual source, not a substitute for accessibility requirements. Each screen specification must resolve responsive behavior, loading/empty/error/success states, focus order, keyboard operation, semantic HTML, accessible names, contrast, reduced motion, zoom, and screen-reader announcements. Where the design is silent, implementation must stop for a specification decision rather than invent behavior.

## API and integrations

The canonical source is the Figma design file `Hansel App UI`, file key `2zlJi8PzLXCbHqEGQI7Hn5`. Access occurs through the authenticated Figma plugin or authenticated development browser. The verified inventory contains page `0:1` and cover frame `48:25`. Browser inspection verified onboarding page `1:2` and representative frame `1:3` (1728×1117), emails page `131:548` and welcome frame `131:549` (800px fixed width), and dashboard page `40:502` and dashboard frame `2019:2296` (1512×982). Structured design-context requests remain limited by no-selection responses and the connected Figma View seat's MCP quota, so these browser-inspected nodes are visual references rather than structured design-context records. Production APIs and browser bundles have no Figma integration.

## Data and migration

No PostgreSQL or Prisma data changes are required. Version-controlled design-source metadata is declarative and contains no customer data or credentials. Adding an application screen requires adding its verified node mapping through normal code review.

## Security and privacy

Figma authentication remains in the developer's connected account. The least-privileged useful Figma role is viewer. Secrets and access tokens are never stored in Git, frontend environment variables, logs, screenshots, or generated artifacts. Exported assets must be reviewed for confidential data and licensing before distribution.

## Reliability and observability

The application build and runtime do not depend on Figma availability. Figma retrieval failures block only design ingestion. Validation errors identify the affected metadata field and requirement. Design drift is surfaced during reviewed UI work through node-specific context and visual evidence rather than runtime synchronization.

## Test strategy

- Contract: validate the provider, file key, canonical URL, registered node IDs, node classifications, and absence of expiring Figma asset URLs in application source.
- Unit: UI behavior continues to require 100% statement, branch, function, and line coverage.
- E2E: each screen feature defines and tests its critical user journeys and specified viewport/state matrix.
- Accessibility: test semantic structure and automated accessibility rules, supplemented by keyboard and screen-reader review for new interaction patterns.
- Visual: compare implementation screenshots with the exact referenced Figma frames at matching viewport dimensions; review intentional differences explicitly.

## Rollout and rollback

Commit the specification, metadata, and contract validator together. Register supplied nodes as pending verification, promote inspected nodes to visual references with evidence, and promote individual frames to `application-screen` only when their implementing feature specification is approved. Roll back incorrect metadata through a normal revert; the production application is unaffected because it has no runtime Figma dependency.

## Open questions

- None. The verified nodes may support design-system evidence, while complete screen implementation still requires an approved feature specification and `application-screen` registration.
