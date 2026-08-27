# ADR 0003: TypeScript monorepo and contract ownership

- Status: Accepted
- Date: 2026-08-27

## Decision

Use pnpm workspaces with independently deployable web, API, and infrastructure packages. OpenAPI is the public HTTP source of truth. `@hansel/contracts` contains runtime Zod schemas shared by browser and server; it must remain consistent with OpenAPI until automated OpenAPI generation is introduced by an approved feature.

Prisma owns the persistence schema but does not define the public API. Tenant ownership is explicit on tenant-scoped tables. HTTP handlers may not expose Prisma entities directly.
