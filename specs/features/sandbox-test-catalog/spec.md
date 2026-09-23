# Feature: Explicit sandbox test catalog

- ID: `sandbox-test-catalog`
- Status: `draft`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-23`
- Domain references: `CONTEXT.md: Plan, Site Allowance; docs/domain/figjam-object-catalog.md: Objects and data points, Organization roles and permissions; onboarding-plan-selection REQ-002,003,018; lightsail-sandbox REQ-003.`

## Problem

Sandbox must retain NODE_ENV=production for HTTPS/session and runtime checks, but the existing startup code uses that same variable to reject the approved non-production dummy catalog. The built image cannot start. Disabling security checks or pretending the dummy catalog is commercial is not acceptable.

## Outcome and success metrics

The explicitly identified sandbox starts with the approved test catalog while production continues rejecting dummy catalogs and Stripe test lookup keys.

## Non-goals

- Changing plan values, allowances, payment behavior, production infrastructure or external-authentication policy.
- Enabling payments or weakening secure cookies, origin checks, email validation or other NODE_ENV checks.

## Requirements

- REQ-001: A server-only HANSEL_DEPLOYMENT_ENVIRONMENT=sandbox marker MUST allow the existing test catalog only when ALLOWED_ORIGIN is an HTTPS IPv4 origin, matching the approved AWS-assigned sandbox address. Unknown marker values MUST fail startup; production or absent markers MUST retain existing catalog validation.
- REQ-002: NODE_ENV MUST remain production in the sandbox container. The marker MUST affect only catalog-environment selection, not other security/configuration behavior. No dummy field or price value may be rewritten.
- REQ-003: Only the separate sandbox Compose configuration MUST set the sandbox marker. The production stack and workflow MUST remain unchanged and tests MUST prove they do not set it.

## Acceptance scenarios

### AC-001 — Explicit sandbox [REQ-001, REQ-002]

- Given production Node runtime with the sandbox marker and an HTTPS IPv4 origin
- When startup selects a catalog
- Then the approved dummy catalog loads while runtimeEnvironment remains production

### AC-002 — Production remains strict [REQ-001, REQ-003]

- Given an absent or production marker, or an invalid sandbox origin/unknown marker
- When startup selects a catalog
- Then production rejects dummy/test catalog data, or invalid configuration fails before startup

## UX and accessibility

No UI changes. Existing dummy catalog copy, plan-selection behavior and accessibility remain unchanged.

## API and integrations

No OpenAPI changes or payments. Email and external-authentication checks remain unchanged.

## Data and migration

No schema or data migration; sandbox uses its own empty database.

## Security and privacy

The deployment marker is operator-controlled and never accepted from requests. Sandbox requires a trusted HTTPS IP origin. Production has no new flag enabled. Preserve all current cookie, origin, credential and permission checks.

## Reliability and observability

Retain existing startup catalog error logging and fail-closed behavior. Validate with a cold-start container health check.

## Test strategy

Write failing tests for sandbox/production/absent/unknown marker and invalid origins before implementing the environment selector. Keep existing catalog validation tests and verify production synthesis does not inject the marker. Repeat container startup and login-page checks.

## Rollout and rollback

Commit/push this amendment separately and obtain approval before changing startup behavior. Rebuild only sandbox images and deploy only sandbox. Rollback the image; production remains undeployed.

## Open questions

- None.
