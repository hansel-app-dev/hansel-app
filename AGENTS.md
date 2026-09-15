# Hansel repository instructions

Before planning, specifying, or implementing a product feature:

1. Read `CONTEXT.md` for canonical domain language.
2. Read `docs/domain/figjam-object-catalog.md` for the FigJam-sourced objects, data points, role notes, and unresolved ambiguities.
3. Cite the affected terms and catalog sections in the feature specification's `Domain references` field.
4. Treat the object catalog as discovery evidence only. Never turn a board label, proximity, sample value, or ambiguity into behavior or a database field without explicit acceptance criteria.
5. Follow `docs/spec-driven-development.md`: commit and push the specification separately, obtain explicit approval, and only then start test-first application changes.
6. Add new reusable frontend components and their important states to Storybook.
7. After every feature implementation or follow-up fix, run the relevant checks, commit its implementation, tests, assets, migrations and documentation, and push to `origin/main`. Work directly on `main`; do not create a branch or PR unless the user explicitly requests one. Keep the specification approval commit separate from implementation. Review the staged diff, exclude secrets and generated/local files, preserve unrelated work, and never force-push. A feature is not handed off as complete until its commit is verified on the remote; report any failed checks or push blockers explicitly.

If code, an approved specification, `CONTEXT.md`, and the object catalog disagree, stop and surface the conflict before changing behavior. Approved specifications govern behavior; update the domain references when a product decision changes the model.
