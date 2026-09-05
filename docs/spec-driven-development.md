# Spec-driven development

## Rule

A feature may enter implementation only after its specification is marked `approved`. Before drafting it, contributors must read [`CONTEXT.md`](../CONTEXT.md) and the [FigJam object catalog](domain/figjam-object-catalog.md), then cite the affected domain references in the specification. Pull requests must name the feature ID and keep the specification, executable contract, code, and tests traceable to one another.

## Lifecycle

1. **Align the domain** — read `CONTEXT.md` and the object catalog. Use canonical terms, identify affected objects and data points, and record contradictions or ambiguities instead of guessing.
2. **Propose** — copy `specs/templates/feature.md` to `specs/features/<feature-id>/spec.md`. Use a stable kebab-case ID and cite the relevant domain references.
3. **Clarify** — make every requirement testable, record exclusions, failure behavior, observability, security, data, rollout, and rollback. A catalog data point is not a requirement until the specification selects and defines it.
4. **Design** — update OpenAPI, Prisma schema, architecture decisions, threat model, and domain documentation when affected.
5. **Approve** — commit and push the specification separately. A product owner and technical reviewer then change `Status` to `approved`; approval is expressed through CODEOWNERS review in GitHub, not by an unchecked box.
6. **Implement** — only after approval, write tests from acceptance scenarios and then production code. Each test references a requirement ID in its name or adjacent comment.
7. **Verify** — CI validates the spec, API contract, lint, types, 100% unit coverage, builds, CDK synthesis, and E2E tests.
8. **Release** — deploy immutable artifacts through protected GitHub environments. Run Prisma migrations as a one-off ECS task before changing service traffic.
9. **Observe** — verify alarms and the spec's success metrics. Roll back the service if the stated guardrail fails.

## Definition of ready

- Status is `approved`.
- Domain references identify the affected canonical terms and object-catalog sections.
- Terminology agrees with `CONTEXT.md`; catalog ambiguities are either out of scope or explicitly resolved.
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
