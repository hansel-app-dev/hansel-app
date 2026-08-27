# Feature: Node 24 LTS runtime standard

- ID: `node-24-lts-runtime`
- Status: `approved`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-08-27`
- Product approval: `User-authorized runtime upgrade, 2026-08-27`
- Technical approval: `Independent standards and specification review, 2026-08-27`

## Problem

Hansel's repository declares Node.js 22 even though Node.js 24 is the current Active LTS release line. Node 22 is in Maintenance LTS, while local development is already occurring on Node 24. This mismatch produces engine warnings, makes local verification differ from CI and container execution, and shortens the platform's remaining support window.

The repository needs one explicit Node.js runtime contract that is consistent across local development, dependency installation, CI, image builds, and production execution.

## Outcome and success metrics

Hansel uses Node.js 24 LTS on every supported runtime surface without changing application behavior.

- All repository checks execute successfully under Node.js 24.
- Dependency installation emits no repository engine mismatch when run with Node.js 24.
- CI and deployment jobs provision Node.js 24.
- Both API container stages derive from the official Node.js 24 Alpine image.
- A repository-wide search finds no active Node.js 22 runtime declaration.
- Frontend and backend retain 100% line, branch, function, and statement coverage.

## Non-goals

- Upgrading to Node.js 26 Current before it reaches LTS.
- Changing application features, HTTP behavior, database schemas, AWS architecture, or package versions unrelated to Node.js compatibility.
- Pinning a single Node.js patch version in every environment; the supported contract is the Node.js 24 LTS major line so routine base-image and CI patch updates can deliver security fixes.
- Automating future major-version upgrades without a separately approved specification.

## Requirements

- REQ-001: The root package engine MUST accept Node.js 24 and reject unsupported major versions outside the Node.js 24 line.
- REQ-002: Every GitHub Actions job that installs or executes JavaScript dependencies MUST provision Node.js 24.
- REQ-003: Every API Docker build and runtime stage MUST use the official `node:24-alpine` base image.
- REQ-004: The repository MUST provide conventional local version selectors for Node.js 24 so supported version managers can select the correct major automatically.
- REQ-005: Developer documentation MUST identify Node.js 24 as the required runtime.
- REQ-006: The upgrade MUST preserve the existing specification validator, strict type checking, linting, builds, unit/integration tests, 100% frontend/backend coverage gates, browser E2E journey, container runtime health behavior, and CDK synthesis.
- REQ-007: Node.js 26 Current MUST NOT become a supported production runtime through this change.

## Acceptance scenarios

### AC-001 — Supported local runtime is unambiguous [REQ-001, REQ-004, REQ-005]

- Given a developer checks out Hansel with a Node.js version manager
- When the manager reads the repository version selector and the developer installs dependencies
- Then Node.js 24 is selected and the package engine accepts it without an engine mismatch

### AC-002 — CI and deployment use the same major [REQ-002]

- Given a pull request, a push to `main`, or a protected deployment is triggered
- When GitHub Actions configures its JavaScript runtime
- Then every applicable job provisions Node.js 24 before installing dependencies

### AC-003 — Build and production containers are aligned [REQ-003]

- Given the API image is built
- When Docker executes the build and runtime stages
- Then both stages use the official Node.js 24 Alpine image and the resulting service returns the existing `GET /health` response

### AC-004 — Behavior and quality do not regress [REQ-006]

- Given the runtime declarations have been upgraded
- When the complete verification suite, browser E2E test, production dependency deployment check, and CDK synthesis run under Node.js 24
- Then all checks pass and frontend/backend coverage remains 100% across statements, branches, functions, and lines

### AC-005 — Unsupported current release is not introduced [REQ-007]

- Given Node.js 26 is the Current release line
- When active runtime declarations are inspected
- Then no production, CI, package-engine, or developer version selector declares Node.js 26

## UX and accessibility

There is no intended user-interface or accessibility change. The existing semantic UI and WCAG 2.2 AA target remain unchanged. Any rendered or interaction difference is a regression.

## API and integrations

There is no OpenAPI contract change. `GET /health` MUST continue returning HTTP 200 with `{ "status": "ok" }`. GitHub Actions, the official Node.js container registry image, Corepack, pnpm, Vite, Vitest, Playwright, Prisma, Express, and AWS CDK must remain compatible with Node.js 24.

## Data and migration

There is no Prisma schema or PostgreSQL migration. The change does not read, transform, or write customer data.

## Security and privacy

Node.js 24 is selected because it is the current Active LTS line and receives upstream security maintenance. Docker and CI declarations intentionally track the supported major line so patched Node.js 24 releases can be adopted without a source change. Images must continue using the official Node.js image, execute the API as the existing non-root user, and contain production dependencies only. No secrets, credentials, permissions, or personal data handling change is authorized.

## Reliability and observability

Existing health checks, structured startup/shutdown logs, ECS deployment circuit breaker, autoscaling, CloudWatch metrics, alarms, and dashboard behavior remain unchanged. A failed quality gate, failed container health check, or failed CDK synthesis blocks release.

## Test strategy

- Run the specification validator before implementation and again in the complete gate.
- Run the requirement-traced runtime validator to enforce the engine, local selectors, CI jobs, Docker stages, documentation, Node type declarations, and prohibited-major checks from REQ-001 through REQ-007.
- Search active configuration for stale Node.js 22 declarations and unauthorized Node.js 26 declarations.
- Run formatting, ESLint, strict TypeScript, unit/integration tests, coverage, and production builds.
- Confirm frontend and backend coverage remains 100% for statements, branches, functions, and lines.
- Run Playwright's critical browser journey against the live local API and SPA.
- Build or otherwise exercise the production dependency deployment layout and verify `GET /health` where the container registry is reachable.
- Run CDK assertions and synthesize the CloudFormation template.

## Rollout and rollback

Roll out as one atomic repository commit so package engines, CI, Docker, and local selectors cannot drift. CI must pass before merging or deploying. Existing application artifacts remain valid during the change because there is no API or data migration.

Rollback by reverting the runtime-upgrade commit, which restores Node.js 22 declarations. Rollback is permitted only for a demonstrated Node.js 24 compatibility or production issue and must be followed by a new incident-linked specification because Node.js 22 has a shorter remaining support window.

## Open questions

- None.
