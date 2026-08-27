# ADR 0001: AWS platform architecture

- Status: Accepted
- Date: 2026-08-27

## Context

Hansel needs a secure SaaS foundation on AWS using infrastructure as code while retaining conventional React, Express, PostgreSQL, and Prisma development.

## Decision

Use CloudFront with a private S3 origin for the SPA. Route API behaviors to a WAF-protected Application Load Balancer backed by ECS Fargate tasks in private subnets. Use Aurora PostgreSQL Serverless v2 in isolated subnets, Secrets Manager, CloudWatch logs/metrics/alarms/dashboards, autoscaling, encrypted storage, and multi-AZ production capacity. Deploy with CDK and GitHub Actions using OIDC.

Use separate AWS accounts for development, staging, and production. Apply account-level AWS Organizations guardrails, Security Hub, GuardDuty, IAM Access Analyzer, AWS Config, CloudTrail, centralized log archive, budgets, and backup policies outside this application stack because those controls belong to the organization landing zone.

## Consequences

The service avoids Kubernetes operational overhead and static cloud credentials. Aurora provides PostgreSQL compatibility for Prisma, but application migrations must remain compatible with Aurora's supported PostgreSQL version. The initial WAF is regional and protects the API load balancer. A future edge-specific spec may add a separate `us-east-1` WAF stack for CloudFront if SPA-layer filtering is required.
