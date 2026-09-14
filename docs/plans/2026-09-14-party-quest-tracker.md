# Party quest tracker — compact layout correction

Status: implemented and targeted rendered checks passed locally; Alpha1.9.11
version/notes prepared. Not pushed or deployed yet.

The accepted party screenshot exposed a real HUD regression: the body class
`party-roster-visible` hid `#objectives-list` entirely. Players could see a tracked
count and Journal shortcut, but none of their selected quests during party play.

The desktop party layout now keeps the selected list in a keyboard-focusable,
scrollable strip above the existing roster. Every selected entry remains in the
list, with title/progress visible and full title, progress and hint on hover.
The compact strip is capped at 66px with one complete 24px quest row at a time
and vertical scroll snapping; it does not move the healing controls down
toward chat. Leaving the party restores full solo cards. Phone button/carousel
navigation is unchanged. The shorter shortcut reads “Track quests · Journal (J)”.
No quest rewards, automatic selection rules, combat or progression changes.

Focused verification: **82 tests in three suites passed, 3.364s**, covering
QuestUIObjectivesPanel, QuestConversation and PhonePartyUI. Changed JS/test files
pass ESLint; `git diff --check` passes. Added tests cover all eight selected quests,
accessible scroll focus, full hover text, Journal action, empty tracker and phone
button semantics. Scrolling keys retain native scrolling but do not bubble to
gameplay shortcuts (notably Space-to-cast). These unit checks do not prove CSS geometry.

`tests/e2e/party-quest-tracker-layout.spec.js` **passed both viewports in13.7s**,
terminal30204. It checks actual UI components/styles at1280×720 and1440×900: all selected quests,
keyboard scrolling, roster separation, healing-target click, solo restoration,
and empty-list hiding. Both saved screenshots inspected: one complete quest row,
no clipped preceding row, all four healing targets accessible. The initial13.3s
pass3947 exposed a cropped partial row on visual inspection; that was corrected
with fixed row height/snapping and the final check explicitly verifies alignment.
The fixture suppresses game boot, disablesGPU/WebGL/software rasterizer and
asserts no game instance or WebGL context. It could safely run as CPU-only HTML/CSS
alongside11985 without another GPU gameplay job. Its owned server4199 is closed.
No earned quests, connected party combat or physical-phone claim. Inspected
screenshots and Playwright report retained in
`/tmp/eidolon-party-tracker-20260914-3AQBD8/` along with packaging test logs.
Main11985 source remains frozen1d62befa.

Alpha1.9.11 notes, login, package/lock, manifest and deployment/runtime defaults
are synchronized. The version test's three old1.9.10 assertions failed during
initial packaging and were updated; historical1.9.10 notes remain unchanged.
Corrected packaging checks pass268tests/3suites/2.8s; the added CPU-only tracker
fixture is included in the existing CI interface stage, whose plan/runner/coverage
checks pass39tests/4suites/7.477s. Changed-file ESLint and diff checks pass.
11985 has now terminated with signal143 and its owned services have been cleaned
up after a private saved-progress archive; see regional dungeon evidence. GPU is
free for publication/CI. No extra campaign rerun for this HUD fix.
