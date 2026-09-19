# Allocation Plan Hand tool verification

Verified 2026-09-19 against approved specification commit `9e5b4ea`.

## Checks

- 30 targeted tests pass across Hand, toolbar, viewer, Sign surface and deletion. Eleven Hand tests cover two-axis bounds, fitted content, Viewer access, primary-pointer filtering, cleanup, file reset, Space override, keyboard scrolling, trailing-click suppression and portaled controls. New behavior was tested failing before implementation; the portal regression also failed before its fix.
- Repository ESLint and web typecheck pass. Production and Storybook builds pass, retaining the existing large-bundle warning.
- Targeted `PlanToolbar.tsx` coverage is 100% statements, branches, functions and lines. This is not whole-viewer coverage.
- Full frontend suite: 302 pass, 11 fail, six unhandled errors. Failures remain in the previously documented App routing/capability fixtures and SiteAllocationPlans relative-date fixture; no new Hand failures.
- `pnpm spec:check` remains blocked by pre-existing validation errors in allocation-card-hover, allocation-plan-sign-moving, plan-sign-delete-dialog and site-section-tabs-consistency. The Hand specification is not reported as invalid.
- Interactive Chrome verification used the Storybook Sign API fixture. At 200% zoom, a 200px-left/150px-up drag increased scroll offsets by exactly 200/150px, with grab restored afterward. The dragging story reports the grabbing cursor. Switching Hand to Move and closing an existing drawer in Hand mode work. Desktop, 950px and 390px layouts were checked, including open-drawer controls; temporary viewport overrides were reset. No live database writes were needed or tested for this frontend-only feature.
- Added Hand-active, overflow and grabbing Storybook states and recorded the approved domain-catalog amendment.

## Reviews

Standards: no non-tool-enforced findings.

Specification: one portal-event finding resolved. Viewport handlers now require DOM containment so portaled toolbar and drawer controls neither initiate panning nor lose clicks. Regression tests and browser checks confirm the fix; re-review found no remaining actionable findings.
