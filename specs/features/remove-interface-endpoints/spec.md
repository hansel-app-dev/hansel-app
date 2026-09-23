# Feature: Remove paid interface endpoints

- ID: `remove-interface-endpoints`
- Status: `approved`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-23`
- Domain references: `CONTEXT.md: Organization, Allocation Plan, Document, Image; docs/domain/figjam-object-catalog.md: Objects and data points, Organization roles and permissions. Infrastructure-only change; no domain behavior changes.`
- Approval: User explicitly instructed “Yes remove 4 private endpoints” after reviewing their purpose and NAT alternative. This records that accepted scope; no new deployment is authorized.

## Problem

Four interface endpoints replicated across availability zones add recurring cost despite existing NAT egress.

## Outcome and success metrics

Synthesized environments contain no interface VPC endpoints and retain the S3 gateway endpoint and working private-subnet NAT routes. Remove the endpoint hourly charges on future deployment; NAT processing remains usage-billed.

## Non-goals

- Deploying AWS resources, removing NAT gateways, changing availability zones or resizing compute/database resources.
- Changing product behavior, IAM permissions, storage privacy or domain models.

## Requirements

- REQ-001: All stages MUST omit ECR API, ECR Docker, CloudWatch Logs and Secrets Manager interface endpoints.
- REQ-002: All stages MUST retain the S3 gateway endpoint, private API subnets with NAT default routes, and existing NAT counts (one non-production, two production).
- REQ-003: The API MUST continue using existing IAM-controlled AWS integrations via service HTTPS endpoints through NAT. The database MUST remain isolated, and API tasks MUST NOT receive public IP addresses.

## Acceptance scenarios

### AC-001 — Synthesized network [REQ-001, REQ-002, REQ-003]

- Given development, staging or production configuration
- When the CDK stack is synthesized
- Then its only VPC endpoint is the S3 gateway endpoint, API service subnets retain NAT default routes, the expected NAT count remains, and database subnets have no default egress route
- And API tasks have public IP assignment disabled

## UX and accessibility

No frontend changes or new reusable components; Storybook is unaffected.

## API and integrations

ECR image pulls, Secrets Manager reads and CloudWatch Logs delivery use service HTTPS endpoints via existing NAT. S3 continues through its gateway endpoint. API contracts and IAM grants are unchanged.

## Data and migration

No database migration, object deletion or data transformation.

## Security and privacy

Retain private task placement, isolated database subnets, existing security groups and IAM authorization. NAT egress does not allow unsolicited inbound traffic to tasks.

## Reliability and observability

These AWS integrations now depend on NAT availability. Keep existing NAT redundancy, health checks, deployment circuit breaker, logs and alarms. At deployment verify image pulls, secret injection and fresh application logs.

## Test strategy

Write CDK assertions first for endpoint absence, S3 retention, per-stage NAT count, service subnet routes, database isolation and disabled task public IP assignment. Run infrastructure tests, typecheck, lint, formatting, specification validation and CDK synthesis.

## Rollout and rollback

Commit and push this approved specification before implementation. Commit and push implementation separately. No cloud deployment is included. A future protected deployment must inspect the change set, then smoke-test task startup, health, storage and log delivery. If NAT connectivity fails, restore the four interface endpoints from the preceding configuration and redeploy.

## Open questions

- None.
