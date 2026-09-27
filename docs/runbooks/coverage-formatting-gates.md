# Coverage and formatting gates

## Scope

Maintenance of the existing verification gates. Keep existing thresholds: 100%
statements, branches, functions and lines for API, web and contracts; 90% for
infrastructure. Storybook stories are presentation
fixtures and are excluded from the web unit coverage target; production source
remains included. Storybook has its own build and browser checks.

Domain references: `CONTEXT.md` — Identity and access, Managed content;
`docs/domain/figjam-object-catalog.md` — Objects and data points, Nesting map,
Source and authority. The catalog supplies discovery context only. This work adds
no domain fields or product requirements.

## Repairs

- Format the repository with its existing Prettier configuration.
- Cover authentication, permissions, uploads, pagination, retries, errors,
  stale responses, drawing interactions and comment composition through public
  service or component interfaces.
- Stabilize time-dependent fixtures and HTTP server teardown.
- Express existing invariants directly in types and control flow, removing
  unreachable fallbacks and callbacks. The Add Plans modal follows the approved
  single-file invariant in `allocation-plan-single-file`, REQ-001 and REQ-002.
- Share the API's existing pagination cursor calculation across media and comment
  readers. Preserve transaction retry limits and existing request contracts.

## Verification

Run `pnpm verify` from the repository root. It checks specifications, formatting,
lint, types, package coverage, application builds, Storybook and browser checks in
that order. Database and live storage tests retain their existing opt-in setup.

### Verification on 27 September 2026

Specifications, global formatting, lint, types, application builds and the
Storybook build pass. Package coverage gates pass without lowering thresholds:

| Package        | Passing tests | Statements | Branches | Functions |  Lines |
| -------------- | ------------: | ---------: | -------: | --------: | -----: |
| API            |           652 |       100% |     100% |      100% |   100% |
| Web            |           498 |       100% |     100% |      100% |   100% |
| Contracts      |           111 |       100% |     100% |      100% |   100% |
| Infrastructure |            16 |     98.63% |   90.58% |      100% | 98.63% |

The API run skips 62 database/live tests under the existing opt-in configuration.
The full `pnpm verify` command remains red at the design-system browser suite:
106 passed and 28 failed. Failures include existing visual references,
accessibility checks and interaction expectations. Browser failures remain a
separate follow-up from these coverage and formatting repairs.
