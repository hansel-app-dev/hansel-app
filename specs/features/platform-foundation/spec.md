# Feature: Platform foundation

- ID: `platform-foundation`
- Status: `approved`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-08-27`

## Problem

Hansel needs a reproducible foundation that prevents application behavior from drifting away from reviewed product specifications.

## Outcome and success metrics

Every product change is traceable to an approved specification and CI rejects invalid specifications, failing tests, incomplete unit coverage, type errors, or undeployable infrastructure.

## Non-goals

- REQ-001 does not define a customer-facing SaaS feature.
- Multi-region active-active operation is excluded from the initial foundation.

## Requirements

- REQ-001: The repository MUST provide a machine-validated feature specification workflow.
- REQ-002: The web and API workspaces MUST use strict TypeScript and enforce 100% unit coverage.
- REQ-003: Critical browser behavior MUST be testable with Playwright.
- REQ-004: Infrastructure MUST be defined with AWS CDK in TypeScript and follow least-privilege, encryption, logging, and high-availability practices.
- REQ-005: CI/CD MUST authenticate to AWS through GitHub OIDC and use protected deployment environments.
- REQ-006: The root web route MUST render only the word `Hansel` as a centered level-one heading within the main landmark. It MUST NOT show marketing copy, navigation, or API health status.
- REQ-007: Every environment MUST expose application HTTP routes beneath `/api`; the health endpoint MUST be `GET /api/health`. Local web development MUST proxy `/api` requests from the Vite origin to the Express origin so browser code uses the same relative route contract as CloudFront in deployed environments.
- REQ-008: The API development command MUST load a gitignored root `.env.local` file when present, and the repository MUST provide a non-secret `.env.local.example`. Local development MUST use an explicit `console` verification-email adapter that writes the recipient and verification code to the API process output without contacting AWS. Staging and production MUST use the SES adapter and MUST reject unsupported delivery modes. Secrets and usable credentials MUST NOT be committed.

## Acceptance scenarios

### AC-001 — Invalid spec is rejected [REQ-001]

- Given a feature spec omits required sections or requirement IDs
- When spec validation runs
- Then it exits unsuccessfully with actionable errors

### AC-002 — Quality regression is rejected [REQ-002, REQ-003]

- Given code reduces unit coverage or breaks a critical journey
- When CI runs
- Then the relevant coverage or E2E job fails

### AC-003 — Infrastructure is deployable [REQ-004, REQ-005]

- Given valid AWS environment configuration
- When CDK synthesis and deployment run
- Then templates use encrypted managed services and GitHub assumes a scoped deployment role without static credentials

### AC-004 — Landing page is intentionally minimal [REQ-006]

- Given a person opens the root web route
- When the page renders at any supported viewport width
- Then `Hansel` is the only visible page content and is centered horizontally and vertically

### AC-005 — Local web requests reach the API [REQ-007, REQ-008]

- Given the API and Vite development servers are started with the documented local environment
- When a browser requests `GET /api/health` through the Vite origin
- Then Vite proxies the request to Express and returns the specified healthy response without CORS configuration or an absolute frontend API URL
- When onboarding sends a verification email in `console` mode
- Then the API process outputs the recipient and code locally without constructing or calling an SES client

## UX and accessibility

The root route uses a main landmark and a single level-one `Hansel` heading. Product features must target WCAG 2.2 AA.

## API and integrations

The initial OpenAPI contract exposes `GET /api/health`.

## Data and migration

The initial Prisma schema provides tenant and user boundaries. Production migrations run separately from API startup.

## Security and privacy

Secrets use Secrets Manager, public traffic uses TLS, the database is private, S3 blocks public access, CloudFront uses origin access control, and WAF protects public endpoints.

## Reliability and observability

The API runs across multiple availability zones with health checks, structured logs, traces, alarms, and an operator dashboard.

## Test strategy

Unit tests cover web and API behavior. Supertest verifies the HTTP boundary. Playwright verifies the browser journey. CDK assertions verify material security controls.

## Rollout and rollback

GitHub environments gate production. Immutable image digests and CloudFormation history support rollback; database changes must be expand/contract compatible.

## Open questions

- None.
