# Deployment runbook

## Prerequisites

1. Create separate AWS accounts for development, staging, and production under AWS Organizations.
2. Bootstrap each target account/region with modern CDK bootstrap and a trusted GitHub OIDC deployment role.
3. Add GitHub environments named `development`, `staging`, and `production`; require reviewers for production.
4. Configure environment variables `AWS_ACCOUNT_ID`, `AWS_REGION`, and `AWS_DEPLOY_ROLE_ARN`.
5. Enable branch protection requiring all CI checks and CODEOWNERS approval for specs, Prisma, workflows, and infrastructure.

## Deploy

CI verifies source, builds the SPA and API image asset, and prepares a CloudFormation change set without executing it. The workflow publishes the immutable image, registers a temporary migration task definition without updating the ECS service, runs `prisma migrate deploy` through the existing private service network, and executes the prepared service change set only after the task exits successfully. A first environment is bootstrapped with zero service tasks, migrated, and then scaled into service. Only expand/contract migrations are allowed in a single release.

Before enabling Welcome delivery, confirm the Aurora backup is current; the `/hansel/<environment>/resend` secret (or the configured `resendSecretName`) contains `apiKey` and `fromEmail`; the Resend domain and sender are verified; the API task can read that secret; a controlled non-production delivery contains both HTML and plain text; and the Welcome alarms and dashboard widget exist. Leave `enable_welcome_email` false if any check fails.

Before enabling password recovery, deploy both additive password-recovery migrations while `PASSWORD_RECOVERY_ENABLED` is false. Confirm the Resend sender/domain, existing `/api/auth` WAF coverage, trusted-source application limiter, recovery and post-change HTML/plain-text deliveries, generic unknown-account behavior, serializable concurrency test, session revocation, and all password-recovery alarms. Enable the flag only after these gates pass.

Before enabling Sites, deploy the additive site, grant, invitation, idempotency, and delivery-intent migration while `SITES_ENABLED` is false. Confirm the PostgreSQL serializable concurrency test, Owner/Administrator creation boundary, Free one-site and invitation limits, tenant-isolated Activity read, Resend sender/domain, one controlled Viewer invitation, and the desktop and 320-pixel Add Site journeys. Enable `enable_sites` only after these gates pass.

## AWS service network access

The stack retains the S3 gateway endpoint and routes ECR API/Docker, CloudWatch Logs and Secrets Manager HTTPS requests through the existing NAT gateways. No paid interface endpoints are provisioned. API tasks remain in private application subnets without public IP addresses; database subnets remain isolated. Non-production has one NAT gateway and production has two.

When deploying this network configuration, inspect the change set for removal of only the four interface endpoints and their dedicated security groups. Confirm application-subnet NAT routes and the S3 gateway remain. Start a fresh task and confirm image download, secret injection, `/api/health`, a new CloudWatch log entry and private storage access. Synthesis cannot verify these live dependencies. If task startup or log delivery fails because of NAT connectivity, restore the endpoint definitions from the preceding revision and redeploy through the protected workflow.

Removing endpoints saves their per-AZ hourly and endpoint processing charges; the affected traffic now incurs NAT processing and potentially cross-AZ transfer charges. This repository change does not itself deploy or delete live AWS resources.

## Roll back

Disable Welcome delivery first, then re-deploy the last known-good Git commit/image. ECS circuit breaker automatically rolls back unhealthy tasks. Leave the additive delivery table and its pending, delivered, and terminal evidence in place; do not reverse a destructive database migration or delete pending intents. Deploy a forward repair before resuming claims. CloudFront invalidation occurs with web asset deployment.

For password recovery rollback, disable `PASSWORD_RECOVERY_ENABLED` and notification claims before deploying the previous artifact. Preserve initiation, challenge, notification, credential, and session evidence. Do not restore an old password, reactivate a revoked session, unconsume a challenge, or delete pending notification intents.

For Sites rollback, set `enable_sites` to false before deploying the previous artifact. This disables the Sites API and invitation worker together. Preserve created sites, grants, idempotency records, invitations, and delivery intents; leave the additive tables in place and use a reviewed forward migration for any later cleanup.

## Alarm response

Check the generated CloudWatch dashboard, ECS service events, ALB target health, application logs, and RDS performance metrics. Roll back if 5xx or latency breaches the feature spec's guardrail.

For `WelcomeEmailTerminalAlarm`, inspect only the categorical structured fields (`intentId`, `template`, `state`, `attempt`, `ageSeconds`, and `category`). Check Resend service health, sender/domain verification, and secret injection. Do not copy recipient data or message bodies into logs or tickets. Keep delivery disabled when failures indicate configuration or authorization problems; deploy a forward repair before an operator-approved retry.

For `WelcomeEmailPendingAlarm`, confirm the API worker is polling, ECS tasks are healthy, Aurora is reachable, and expired leases are recovering. The `WelcomeEmailOldestPendingAgeSeconds` metric must remain at or below 900 seconds; missing observations are treated as a breach while the feature is enabled. If pending age continues to rise, disable new claims, preserve the outbox records, and repair the worker before re-enabling delivery.

For `PasswordRecoveryUnexpectedAlarm` or `PasswordResetUnexpectedAlarm`, inspect categorical events and dependency health without querying by email, identifier digest, code, password, cookie, source address, or provider body. Disable recovery if failures persist or atomicity cannot be established.

For `PasswordResetNotificationTerminalAlarm`, verify Resend health, sender/domain status, secret injection, and sanitized terminal categories. A completed reset must not be reversed. Preserve notification evidence and deploy a forward repair before retrying.

For `PasswordResetNotificationPendingAlarm`, verify worker polling, ECS and Aurora health, and lease recovery. `PasswordResetNotificationOldestPendingAgeSeconds` must remain at or below 900 seconds; missing observations breach only while recovery is enabled. Disable claims, preserve the outbox, and repair before resuming.

For Sites API or invitation-worker failures, inspect the shared API 5xx signal, ECS health, Aurora availability, and categorical site-creation or delivery events. Do not log or copy invitation email addresses, tokens, site names, or provider response bodies. Disable Sites if tenant isolation, atomic creation, or bounded retry cannot be established; preserve the outbox and deploy a forward repair before resuming.
