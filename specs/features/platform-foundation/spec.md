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

## UX and accessibility

The starter UI uses semantic landmarks and exposes API health in readable text. Product features must target WCAG 2.2 AA.

## API and integrations

The initial OpenAPI contract exposes `GET /health`.

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
