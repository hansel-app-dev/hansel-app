# Hansel

Hansel is a spec-driven SaaS application built as a TypeScript monorepo.

## Development contract

No product change starts in application code. Create a feature directory under `specs/features/` from the template, complete its requirements and acceptance criteria, then run:

```bash
pnpm spec:check
```

The authoritative lifecycle is documented in [`docs/spec-driven-development.md`](docs/spec-driven-development.md). Architecture decisions live in [`docs/adr`](docs/adr), while API behavior is defined in [`specs/openapi.yaml`](specs/openapi.yaml).

## Quick start

Requirements: Node.js 24 LTS, pnpm 10, Docker, and Docker Compose.

```bash
corepack enable
pnpm install
docker compose up -d postgres
cp .env.example .env
pnpm db:migrate:dev
pnpm dev
```

The web application runs on <http://localhost:5173> and the API on <http://localhost:3000>.

## Quality gates

```bash
pnpm verify
pnpm test:e2e
pnpm --filter @hansel/infra cdk:synth
```

`verify` validates specifications, formatting, lint, TypeScript, tests, 100% unit-test coverage, and production builds.

## Repository layout

- `apps/web` — React SPA
- `apps/api` — Express API
- `packages/contracts` — shared runtime schemas and TypeScript contracts
- `infra` — AWS CDK application
- `specs` — product and API specifications
- `docs/adr` — architecture decisions
