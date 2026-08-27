# Deployment runbook

## Prerequisites

1. Create separate AWS accounts for development, staging, and production under AWS Organizations.
2. Bootstrap each target account/region with modern CDK bootstrap and a trusted GitHub OIDC deployment role.
3. Add GitHub environments named `development`, `staging`, and `production`; require reviewers for production.
4. Configure environment variables `AWS_ACCOUNT_ID`, `AWS_REGION`, and `AWS_DEPLOY_ROLE_ARN`.
5. Enable branch protection requiring all CI checks and CODEOWNERS approval for specs, Prisma, workflows, and infrastructure.

## Deploy

CI verifies source, builds the SPA and API image asset, synthesizes the template, and deploys through CloudFormation. Database migrations must run as a one-off ECS task after a backup and before service rollout. Only expand/contract migrations are allowed in a single release.

## Roll back

Re-deploy the last known-good Git commit/image. ECS circuit breaker automatically rolls back unhealthy tasks. Do not reverse a destructive database migration; deploy a forward repair. CloudFront invalidation occurs with web asset deployment.

## Alarm response

Check the generated CloudWatch dashboard, ECS service events, ALB target health, application logs, and RDS performance metrics. Roll back if 5xx or latency breaches the feature spec's guardrail.
