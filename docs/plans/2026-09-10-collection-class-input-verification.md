# Class-appropriate opening and collection input

Status: local QA correction, focused checks passed; native class matrix and full
regression pending. No game balance, release identity or deployment change.

Inspection found that `createFreshCollectionCombat` installed Wizard defense but
returned a no-op for Fighter, Rogue and Cleric. The opening and seed encounters
also invoked the callback without the page/target needed by melee and healing
drivers. Hunt and investigation routes already used `createEarnedClassCombat`.
This made collection verification omit available ordinary class actions; it
does not prove a player-facing ability bug or explain any past native failure.

Both opening and seeds now call the shared earned class driver with the actual
page and current target. Wizard retains its 80% health spacing threshold and
shield policy; Rogue uses its existing ranged spacing, Cleric its unlocked paid
self-heal, and Fighter its earned hotbar selection. No skill training, item/level
grants, healing override, resource mutation, drop/reward change, timeout extension
or relaxed death limit is introduced. The separate story-only dungeon's current
Wizard/Fighter guard remains intact pending broader dungeon-driver verification.

Final focused session11165 passed106tests/6suites in1.659s, followed by lint under
Node24.18.0. Tests cover all four class factory selections, failed setup
propagation, both live-target call sites, normal Cleric self-aim/heal input and
throttling, locked/insufficient-resource rejection, Fighter inputs and unchanged
story-only phase/mode restrictions. Logs:
`/tmp/eidolon-collection-class-unit-final.log` and
`/tmp/eidolon-collection-class-lint-final.log`.

Work is isolated from the active Wizard dungeon attempt96530 on frozen626385d.
Do not merge into that running source or launch another native/full-regression
workload alongside it. After that attempt finishes, preserve its actual evidence,
run the full client suite for this branch, integrate deliberately, then exercise
fresh collection/readiness with the other classes using their actual earned
builds. Unit coverage is not all-class gameplay/pacing or dungeon acceptance.
