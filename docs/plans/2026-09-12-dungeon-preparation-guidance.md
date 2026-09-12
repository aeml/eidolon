# Bastion preparation guidance — 1.1.0 candidate

Adds a collapsed, keyboard/touch-operable preparation section to the Normal
Verdant Bastion Dungeon Guide. It explains tank/healer/damage roles, appropriate
Uncommon/Rare gear and each class's primary stat, Vitality, and recovery in
Lanternhold followed by continuing the existing run. It adds no item inspection,
entry restriction, stat scaling, enemy adjustment or automatic quest action.
The introductory note is hidden for other families and higher difficulties;
it does not claim this equipment guarantees success in every tier.

Desktop and phone DOM checks cover the text, collapsed default, family/difficulty
switching and unchanged Normal level30 entry payload. Four focused suites pass:
115 tests in 10.253s. Full lint and diff checks passed before browser coverage
was added. Logs `/tmp/eidolon-dungeon-preparation-{green,lint}-20260912.log`.

Actual browser coverage in `tests/e2e/raid-menu.spec.js` exercises keyboard Enter
on desktop and taps in phone portrait/landscape, expanded text, horizontal
overflow, reachable entry controls, unchanged wire entry request and persistent
chat. It saves screenshots for inspection. Browser execution and visual review
remain pending; listing a test is not running it. No native browser was started
alongside the active four-player gameplay run.

Follow-up keyboard reproduction: the global InputManager ignored buttons,
links and selects for Enter/Space, but not native summary controls. A focused
summary incorrectly dispatched chat and ability input. The expanded existing
input regression failed only that new case (14 controls passed); complete red
log `/tmp/eidolon-dungeon-summary-input-red-full-20260912.log`. Adding summary
to the same native-activation exclusion preserves browser toggling rather than
intercepting or simulating it. Focused input/inspection/dungeon/menu checks now
pass six suites/141 tests in12.373s. Browser coverage additionally requires
retained summary focus and native Space close/reopen on desktop. Full lint
passes; logs `/tmp/eidolon-dungeon-summary-input-{green,lint}-20260912.log`.

Initial CI34720519281 remains in progress on e903cffc and cannot validate this
subsequent keyboard correction. Do not call its result final candidate acceptance.

## Draft 1.1.0 patch note

- Added optional first-dungeon preparation tips covering party roles,
  class-appropriate equipment and recovering in town before continuing a run.
- Using Enter or Space on expandable menu sections no longer also opens chat
  or triggers a gameplay ability.

This remains unreleased until integration and actual browser verification.
The full first-hour, dungeon, reconnect, balance and later roadmap gates stay
open. Existing login/release metadata is intentionally unchanged.
