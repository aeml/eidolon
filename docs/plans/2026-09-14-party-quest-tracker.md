# Party quest tracker — compact layout correction

Status: implemented locally; rendered layout acceptance and deployment pending.

The accepted party screenshot exposed a real HUD regression: the body class
`party-roster-visible` hid `#objectives-list` entirely. Players could see a tracked
count and Journal shortcut, but none of their selected quests during party play.

The desktop party layout now keeps the selected list in a keyboard-focusable,
scrollable strip above the existing roster. Every selected entry remains in the
list, with title/progress visible and full title, progress and hint on hover.
The compact strip is capped at 66px; it does not move the healing controls down
toward chat. Leaving the party restores full solo cards. Phone button/carousel
navigation is unchanged. The shorter shortcut reads “Track quests · Journal (J)”.
No quest rewards, automatic selection rules, combat or progression changes.

Focused verification: **81 tests in three suites passed, 3.175s**, covering
QuestUIObjectivesPanel, QuestConversation and PhonePartyUI. Changed JS/test files
pass ESLint; `git diff --check` passes. Added tests cover all eight selected quests,
accessible scroll focus, full hover text, Journal action, empty tracker and phone
button semantics. These unit checks do not prove CSS geometry.

`tests/e2e/party-quest-tracker-layout.spec.js` is prepared but **not yet run**.
It checks actual UI components/styles at 1280×720 and 1440×900: all selected quests,
keyboard scrolling, roster separation, healing-target click, solo restoration,
and empty-list hiding. It suppresses game boot and does not claim earned quests,
connected party combat or physical-phone acceptance. Run and inspect screenshots
after the active four-player Abyssal session11985 releases the GPU. Do not edit
that running session's source tree or repeat previously passing dungeon tests
just to validate this HUD-only correction.

Release-note candidate: “Tracked quests remain visible and scrollable while in
a party, without covering the party's healing controls.” Version packaging and
publication remain pending until the targeted rendered check passes.
