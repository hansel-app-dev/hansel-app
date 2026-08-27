# ADR 0002: Testing and coverage strategy

- Status: Accepted
- Date: 2026-08-27

## Decision

Use Vitest for unit tests in all TypeScript workspaces, Testing Library for React behavior, Supertest for Express HTTP boundaries, CDK assertions for infrastructure, and Playwright Chromium for critical user journeys. Frontend, backend, and shared contracts enforce 100% line, branch, function, and statement coverage.

Coverage is a regression gate, not evidence of correctness. Specifications provide the behavioral oracle: test names cite requirement or acceptance IDs, reviewers inspect meaningful assertions, and E2E tests cover critical journeys independently of unit coverage.

Generated code, entry-point wiring, CSS, and test setup are excluded from unit coverage only where direct execution adds no behavioral confidence. Integration tests requiring PostgreSQL should use an ephemeral CI database once persistence behavior is introduced.
