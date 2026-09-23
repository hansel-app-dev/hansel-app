# Feature: Low-cost Lightsail sandbox

- ID: `lightsail-sandbox`
- Status: `approved`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-09-23`
- Domain references: `CONTEXT.md: Organization, User, Membership, Site Access, Allocation Plan, Sign, Document, Image, Sign Comment, Allocation Plan Comment; docs/domain/figjam-object-catalog.md: Objects and data points, Organization roles and permissions. These domain rules remain unchanged; hosting does not introduce new product behavior.`

Approval: User approved this specification and authorized use of current AWS credentials for sandbox provisioning on 2026-09-23. Production deployment remains prohibited.

Address amendment: User requested a freely available AWS address instead of a custom hostname. Use the included static IPv4 address over trusted HTTPS; no paid DNS/CDN is added.

## Problem

The current ECS/Aurora deployment is too expensive for a low-traffic sandbox. The user requested an AWS-only sandbox below US$50/month while keeping the production configuration and explicitly forbidding production deployment.

## Outcome and success metrics

Provide a separate reproducible sandbox deployment using one Lightsail Linux server with 2 vCPU, 4 GB RAM, 80 GB disk and public IPv4 in Sydney, priced at US$24/month at specification time. Target US$30–40/month with small storage and backup usage, excluding taxes, domain purchase, email-provider charges and usage overages. This is a budget target, not an enforced billing cap. Production configuration and synthesized resources remain unchanged.

Pricing evidence: https://aws.amazon.com/lightsail/pricing/ (checked 2026-09-23).

## Non-goals

- Deploying, resizing or modifying production resources, production data, DNS or credentials.
- Replicating production availability, Aurora, ECS, load balancers, NAT gateways, WAF or private interface endpoints in sandbox.
- Vercel hosting, paid domain registration, external-authentication policy changes or copying production data into sandbox.
- Changing existing product features, permissions, API contracts or frontend components.

## Requirements

- REQ-001: Sandbox MUST have its own infrastructure entry point and manual deployment path, resource names and environment configuration. Sandbox commands MUST reject production targets and MUST NOT invoke the production deployment workflow or mutate its configuration.
- REQ-002: Sandbox MUST use one 4 GB Lightsail server with a static public IPv4 address. Docker Compose MUST run PostgreSQL 16, the existing API and background workers, and a Caddy HTTPS reverse proxy serving the built frontend. PostgreSQL and the API MUST NOT publish host ports; only HTTPS/HTTP and SSH restricted to an explicit operator CIDR may be exposed.
- REQ-003: Sandbox MUST use its AWS-assigned static IPv4 address and exact HTTPS application origin, with a publicly trusted short-lived IP certificate renewed automatically by Caddy. No custom domain or DNS change is required. Browser `/api` requests and existing server-owned authentication routes MUST reach the API, while frontend routes retain SPA fallback. Secure cookies, origin checks and current application authorization MUST remain enforced. NODE_ENV remains production for secure runtime behavior. External provider login stays disabled because current configuration requires the production hostname; email/password authentication is the initial supported path.
- REQ-004: Database data, credentials, session/digest secrets, upload bucket and backups MUST be sandbox-only. Never import the local `.env.local` or existing account-wide credentials into deployed configuration. Files and backups MUST remain private and encrypted at rest. S3 runtime permissions MUST be limited to the sandbox bucket and existing required object prefixes; deployment credentials and application credentials MUST be separate. Lightsail service access credentials MUST be provisioned outside source, protected on disk and documented for rotation.
- REQ-005: Builds MUST run outside the small runtime server and releases MUST be identified by immutable commit/image references. Deployment MUST run existing Prisma migrations as a one-off sandbox container before starting the new API release. A failed migration MUST stop release progression. Health checks MUST gate successful deployment; previous artifacts MUST remain available for rollback. Sandbox releases may have downtime.
- REQ-006: PostgreSQL MUST use a persistent volume. Automated daily database dumps MUST be stored privately outside the server with seven-day retention; daily server snapshots and bounded container log rotation MUST be configured. Document and exercise restoring a database dump into an isolated test database. Backup failures MUST be visible through a recorded job result and operator check; snapshot success alone is not proof of database restorability.
- REQ-007: Infrastructure MUST tag sandbox resources for cost tracking, document storage/transfer assumptions, and support a US$50 monthly budget alert when an operator supplies a notification address. Budget alerts MUST be described as alerts, not automatic spending limits. No paid monitoring subscription or additional always-on managed database is required.
- REQ-008: Automated assertions MUST verify sandbox isolation, private storage, firewall boundaries and absence of production-style chargeable resources. Compare production synthesis before and after to confirm no resource/property changes. Existing production configuration and deployment behavior MUST be preserved.
- REQ-009: The runbook MUST document provisioning, domain setup, secret installation, builds, migration, deployment, smoke checks, backup/restore, rollback and teardown. Teardown MUST target sandbox explicitly and retain durable data by default. No cloud resources are provisioned as part of the specification phase; actual sandbox launch needs its assigned static IP, operator access configuration and sandbox secrets.

## Acceptance scenarios

### AC-001 — Independent low-cost stack [REQ-001, REQ-002, REQ-008]

- Given the sandbox configuration
- When infrastructure is synthesized and deployment commands are validated
- Then it contains one specified Lightsail server and sandbox-only storage with no ECS, Aurora, NAT gateway or load balancer
- And sandbox commands reject production targets, database/API host ports are absent and SSH requires an operator CIDR
- And the production template is unchanged

### AC-002 — Sandbox user journey [REQ-003, REQ-004]

- Given a sandbox static IP with trusted HTTPS, separate PostgreSQL and sandbox credentials
- When a tester signs up or logs in using email/password and uses enabled Site, Allocation Plan, Sign and discussion features
- Then requests use the sandbox API, secure same-origin sessions work, and uploads remain private in sandbox storage
- And no production data or provider-authentication configuration is used

### AC-003 — Safe release progression [REQ-005]

- Given a built immutable release and an existing sandbox database
- When migration fails
- Then deployment fails before replacing the running API
- When migration succeeds and the new release passes health checks
- Then deployment reports the exact running revision
- And application rollback selects a previous artifact without destructive schema reversal

### AC-004 — Persistence and recovery [REQ-006, REQ-009]

- Given a sandbox containing test records
- When API/database containers restart
- Then records persist
- When a daily dump is restored into a separate test database
- Then the restored test records can be read and the live sandbox database is unaffected

### AC-005 — Budget visibility [REQ-007]

- Given the operator's budget notification address
- When the sandbox budget configuration is synthesized
- Then it defines sandbox-scoped actual/forecast alerts for a US$50 monthly budget without claiming a hard spending cap

## UX and accessibility

No reusable frontend components or visual changes. Existing accessibility behavior and Storybook remain unchanged. The sandbox URL is its AWS-assigned static IP; no production hostname is used.

## API and integrations

Reuse the current API image, worker lifecycle and PostgreSQL contract. Serve the frontend and API behind one HTTPS origin, including existing server-owned routes. Use the current Resend integration with sandbox sender settings and test recipients. External OAuth remains disabled; enabling it on a sandbox hostname would require a separately reviewed policy change. Feature flags must be explicit and respect existing dependencies.

## Data and migration

Run existing additive Prisma migrations against a new sandbox-only database. Do not seed from production or point at a production database. Use the existing private S3 storage contract; uploaded object prefixes retain their existing meanings. No Prisma or OpenAPI changes are required by this hosting specification.

## Security and privacy

Expose HTTP for redirect/certificate issuance and HTTPS for application traffic. Restrict SSH to a supplied administrative CIDR; never expose PostgreSQL or API ports directly. Keep secrets out of Compose files, user-data, Git, image layers, logs and generated artifacts. Install runtime configuration with restrictive permissions. Pin and verify the SSH host identity. Use narrowly scoped sandbox storage credentials and document revocation/rotation. A production hostname is rejected as sandbox input. Preserve existing application authorization, rate limiting and HTTPS/session protections.

## Reliability and observability

This is an explicit sandbox-only exception to the platform foundation's multi-availability-zone API deployment practice and ECS migration mechanism. Production continues to follow those requirements. A single Lightsail host has no automatic failover; maintenance and releases may interrupt testing. Retain container health checks, bounded logs, disk-space checks and backup status. Build outside the server and smoke-test memory usage for plan/file processing before claiming the size is adequate.

## Test strategy

After explicit specification approval, write failing tests for environment guards, synthesized infrastructure, firewall rules, storage privacy and Compose exposure before implementation. Validate Caddy routing and Compose configuration; build images; run isolated PostgreSQL migrations and HTTP/auth/storage smoke tests where credentials are available. Test migration failure handling and restoration without touching local user data. Run specification checks, relevant lint/typecheck, infrastructure tests and synthesis. Compare production templates using identical context. Document unavailable live checks and existing repository verification blockers rather than declaring them passed.

## Rollout and rollback

Commit and push this draft separately, obtain explicit approval, then implement and push a separate commit. Keep sandbox infrastructure and deployment assets separate from the existing production stack and workflow. No production deployment is authorized. Before sandbox launch, determine its assigned static IP, operator CIDR/access key and sandbox email/storage credentials through appropriate secure configuration. Budget notification is configured when an address is supplied. Provision only the sandbox, install secrets securely, deploy a verified release, and test health, login, plans/media, workers and backup restore. Roll back failed releases to the previous image/frontend pair; retain additive schema changes and durable data. Teardown must be an explicit sandbox-only operation and must not delete retained backups by default.

## Open questions

- No unresolved architecture choices. Deployment-specific access and secret values are required inputs; the sandbox address is allocated by AWS, never inferred from production.
