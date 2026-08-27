# Spec-driven development

## Rule

A feature may enter implementation only after its specification is marked `approved`. Pull requests must name the feature ID and keep the specification, executable contract, code, and tests in the same change.

## Lifecycle

1. **Propose** — copy `specs/templates/feature.md` to `specs/features/<feature-id>/spec.md`. Use a stable kebab-case ID.
2. **Clarify** — make every requirement testable, record exclusions, failure behavior, observability, security, data, rollout, and rollback.
3. **Design** — update OpenAPI, Prisma schema, architecture decisions, and threat model when affected.
4. **Approve** — a product owner and technical reviewer change `Status` to `approved`. Approval is expressed through CODEOWNERS review in GitHub, not by an unchecked box.
5. **Implement** — write tests from acceptance scenarios, then production code. Each test references a requirement ID in its name or adjacent comment.
6. **Verify** — CI validates the spec, API contract, lint, types, 100% unit coverage, builds, CDK synthesis, and E2E tests.
7. **Release** — deploy immutable artifacts through protected GitHub environments. Run Prisma migrations as a one-off ECS task before changing service traffic.
8. **Observe** — verify alarms and the spec's success metrics. Roll back the service if the stated guardrail fails.

## Definition of ready

- Status is `approved`.
- Problem, outcome, and non-goals are explicit.
- Requirements have unique `REQ-###` identifiers and measurable language.
- Acceptance scenarios use Given/When/Then and cite requirements.
- API, data, security, accessibility, telemetry, migration, rollout, and rollback impacts are resolved.
- Open questions are empty.

## Definition of done

- Implementation and tests trace to every requirement.
- OpenAPI and Prisma changes are backward-compatible or include a migration plan.
- Frontend and backend unit coverage is 100% for lines, functions, branches, and statements.
- E2E covers each critical user journey; E2E is not counted toward unit coverage.
- CI, CDK synthesis, security scans, and deployment smoke checks pass.
- Dashboards, alarms, runbook, and rollback path exist for operational changes.

## Change control

When behavior changes, update the approved spec first. Material scope changes require fresh review. Production incidents may use an emergency spec with the incident link, immediate risk, rollback, and a follow-up deadline.
