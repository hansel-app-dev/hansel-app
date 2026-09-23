# Selected Areas use Move

Feature: `allocation-plan-area-auto-move`; specification `3da917c`, approval `f6ca7aa` (2026-09-23).

Floor selection still arms rectangle drawing with a crosshair. Successful creation or retry switches to Move and retains the Area selection, drawer and resize handles. Accepted existing-Area selection also activates Move. A selection drag switches only after pointer release so the tool-change cancellation effect cannot interrupt the gesture. Hand/Space-pan and pending/dirty selection guards remain effective.

Keyboard creation focuses the new Area only if focus has not moved to another control and the response still belongs to the current view. This prevents a delayed focus callback from taking focus away from an opened drawer dropdown. Creating another Area requires explicitly selecting Add area again.

## Validation

- The shared viewer's new active-Move assertion failed before implementation.
- 36 focused Area, selection, Add sign and viewer unit tests passed. Creation retry does not activate Move until successful.
- Twelve combined browser tests passed: Area creation/selection active mode, drawing cursor, uninterrupted selection drag, resize/keyboard focus, narrow and 200% zoom, plus Sign type and toolbar icon regressions.
- Lint, typecheck, frontend production build, Storybook build and specification checks passed. Storybook adds Created in Move Mode and updates selected Area states.
- Focused frontend coverage remains below the repository requirement: 98.39% lines/statements, 96.87% functions and 92.02% branches. No thresholds were relaxed.
- Aggregate verification stops at the same 22 existing unrelated formatting failures after specification checks; later aggregate stages are not claimed to pass. Remote CI and production deployment were not performed here.

## Rollout and rollback

Frontend-only release; no API, migration or data changes. Smoke-check Floor → draw → Move → drag/resize, then re-enter Add area to create a second rectangle. Revert this frontend change if mode switching regresses; saved Areas are unaffected.
