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

## Roll back

Disable Welcome delivery first, then re-deploy the last known-good Git commit/image. ECS circuit breaker automatically rolls back unhealthy tasks. Leave the additive delivery table and its pending, delivered, and terminal evidence in place; do not reverse a destructive database migration or delete pending intents. Deploy a forward repair before resuming claims. CloudFront invalidation occurs with web asset deployment.

## Alarm response

Check the generated CloudWatch dashboard, ECS service events, ALB target health, application logs, and RDS performance metrics. Roll back if 5xx or latency breaches the feature spec's guardrail.

For `WelcomeEmailTerminalAlarm`, inspect only the categorical structured fields (`intentId`, `template`, `state`, `attempt`, `ageSeconds`, and `category`). Check Resend service health, sender/domain verification, and secret injection. Do not copy recipient data or message bodies into logs or tickets. Keep delivery disabled when failures indicate configuration or authorization problems; deploy a forward repair before an operator-approved retry.

For `WelcomeEmailPendingAlarm`, confirm the API worker is polling, ECS tasks are healthy, Aurora is reachable, and expired leases are recovering. The `WelcomeEmailOldestPendingAgeSeconds` metric must remain at or below 900 seconds; missing observations are treated as a breach while the feature is enabled. If pending age continues to rise, disable new claims, preserve the outbox records, and repair the worker before re-enabling delivery.
