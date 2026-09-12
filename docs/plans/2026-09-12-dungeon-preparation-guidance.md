# Bastion preparation guidance — 1.1.0 candidate

## Component acceptance — September 12, 2026

CI34722166310 completed SUCCESS on exact
c09248c8665191dc2bfa365b6722e73b0090d29b. Client414 suites/6415 tests passed
80.023s; server game race363.745s and all three browser shards passed.
Browser3 includes24 layout checks, three entrance checks and two effect checks.
The actual desktop Enter/Space case and both phone preparation cases pass.
Inspected the expanded desktop section and portrait/landscape reading-end
screenshots: readable text, final paragraph clear of the fixed footer, reachable
entry controls and persistent chat. Archive
`/tmp/eidolon-dungeon-preparation-final-browser3-rIXbzV`, credential scan0.
Logs `/tmp/eidolon-dungeon-preparation-final-{client,server}-34722166310.log`
and `/tmp/eidolon-dungeon-preparation-final-browser3-34722166310.log`.

Accept this component for development integration. Native/deploy/live jobs were
skipped, not passed. Fresh combined regression is required after merging; this
does not close physical-phone, first-hour, all-dungeon or full1.1 acceptance.
The following earlier failures remain diagnostic history, not current results.

## Latest follow-up — September 12, 22:13 UTC

CI34721303156 on bea88218 passes client414 suites/6413 tests135.645s and server
game race350.610s, but browser3 still fails desktop Enter on both attempts;
its other23 layout cases pass. Both actual phone-mode reading-end captures were
inspected:16px text, final line clear above the footer, accessible entry and
persistent chat in portrait/landscape. Artifact
`/tmp/eidolon-dungeon-preparation-corrected-browser3-Pn2Bsr`, credential scan0;
logs `/tmp/eidolon-dungeon-preparation-corrected-{client,server,browser3}-34721303156.log`.
The remaining shards were still running at this observation.

The first InputManager fix was necessary but insufficient: UIManager has a
second global Enter-to-chat handler, also lacking summary in its native-control
exclusion. Added actual UI keyboard-dispatch cases both alone and with the
gameplay InputManager binding. Both reproduced focus stolen into chat (2failed/
37passed), despite the earlier InputManager-only regression passing. The same
summary exclusion now applies to UIManager too; no synthetic details toggle or
preventDefault workaround is introduced. Seven focused suites/165tests now
pass19.822s, retaining gameplay Enter, chat submission and input behavior.
Logs `/tmp/eidolon-dungeon-summary-global-{red,green,lint}-20260912.log`.
This follow-up still needs corrected hosted desktop browser acceptance.

## Earlier implementation and evidence

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

The initial hosted browser3 job103626484469 has now failed exactly the desktop
Enter case on both attempts: the paragraph remains hidden. Its other23 layout
cases pass. This corroborates the keyboard reproduction rather than exposing a
different runtime defect. Log
`/tmp/eidolon-dungeon-preparation-browser3-34720519281.log`; downloaded artifact
`/tmp/eidolon-dungeon-preparation-browser3-SyR0VR`, credential scan0. Desktop
failure and both phone preparation screenshots inspected.

The landscape capture also exposed an acceptance-fixture gap: touch emulation
alone retains Chromium's desktop user agent, so a wide viewport did not receive
the production phone boot class. The fixture now explicitly adds mobile-mode
when testing a phone, like the existing phone-adventure fixture. New checks
require at least16px body text and show that the final paragraph line can scroll
clear of the header/footer, with an additional whole-frame reading-end capture.
This is layout/scroll-position coverage, not physical-device gesture acceptance.
These later fixture changes still require hosted browser execution; neither the
old landscape capture nor pending CI34720930285 on66888d3a validates them.

## Draft 1.1.0 patch note

- Added optional first-dungeon preparation tips covering party roles,
  class-appropriate equipment and recovering in town before continuing a run.
- Using Enter or Space on expandable menu sections no longer also opens chat
  or triggers a gameplay ability.

This remains unreleased until integration and actual browser verification.
The full first-hour, dungeon, reconnect, balance and later roadmap gates stay
open. Existing login/release metadata is intentionally unchanged.
