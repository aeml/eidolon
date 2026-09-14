# Remaining regional four-player dungeon acceptance

## Abyssal attempt20006 — terminal traversal deadline, four bosses cleared

Native20006 is terminal failed against frozen042fd742, Alpha1.9.9, High graphics,
Normal60 seed `-5297765868375752807`, generator2/no fallback. Tiderend Leviathan,
Drowned Choir, Abyssal Goliath and now Maelstrom Warden are defeated. Warden
started at57,750HP; recorded role totals: Fighter14229damage/11321taken,
Cleric27540allyhealing/4616taken, Wizard18754damage/4579taken,
Rogue24830damage/13033taken. No death hidden or boss health reduced by a grant.
At6284.41s (~104.7min), sixth town recovery/re-entry passed all-four recovery
and same seed/rooms/Gold/bag/quests. Traversal count35 includes retracing;
it is not35 unique rooms. Thalorath and each player's manual quest claim,
next offer and final persistence checks remain outstanding.

The original120-minute expedition budget expired during traversal at7205.49s,
not during a boss fight:100.68min traversal (including84.19min follower
formation),14.93min combat,4.31min recovery,0.18min entry. Counters806leader
steps/39traversals including retracing/six townreturns. Final all-four snapshots
are level61/2563Gold, alive with `sawDeath:false`, Water quest accepted/count0/
not completed. Total Cleric healing57,755; Fighter74,833, Wizard75,954 and
Rogue111,320 damage. This is partial combat evidence, NOT full dungeon acceptance.

The game's `enterInstanceLocked` explicitly returns to layout room0 while
preserving cleared encounters; the saved room is not a teleport checkpoint.
Do not change that gameplay rule or extend the declared deadline to make this
test pass. Next affected party run should use the existing Low graphics option
to reduce observed four-browser host/GPU contention. Actual full clear and
personal claims still require evidence; no second QA framework was added.

Retained log, sanitized `test-results` and `playwright-report` are under
`/tmp/eidolon-abyssal-party-r2-20260914-qmz7uv/`. Roster/healing screenshot was
inspected; it is an opening-town support UI image, not a final-boss image.
Credential scan passed with0files sanitized. Wrapper removed both owned
containers, their validation databases and ports18285/18286/4187; read-only
container/socket checks confirmed cleanup. Do not poll/restart20006.

Private actual four-boss progress archive (do not commit/publish account data):
`/tmp/eidolon-abyssal-party-r2-20260914-qmz7uv/party-four-boss-checkpoint.archive.gz`,
mode0600,39,684bytes; gzip integrity passed. SHA256
`b0cb73caec8159e3c7be03add455106e9cd673f09d35e91dafae7e87fe959823`.
Actual restore83743 succeeded24documents/0failures into previously empty
`eidolon_party_four_boss_validation` within the owned disposable QA Mongo;
running `eidolon` was not overwritten. Read-back verifies all four classes
level61/2563Gold, savedroom10, exact seed,13rooms, bossrooms3/5/8/10 cleared
and12 uncleared. This is an in-flight saved-progress copy, not an atomic
production backup or a proven resumed gameplay session. The separate earlier
two-boss archive remains intact. Validation databases leave with owned wrapper
cleanup. No automatic continuation tool or permission to fabricate earlier
completion receipts is implied.

## Existing route and preparation

Continue the existing real-input party route; do not repeat the accepted
Verdant clear for these test-only extensions. The selected family now determines
the actual server-generated character/item level, target story chapter, boss
sequence and next manual offer. Normal entry levels: Abyssal 60, Molten 70,
Tempest 70, Umbral 100. At level 100, reward assertions include Resonance ranks/XP.

Each actor retains fourteen attainable, role-affixed items: five Rare and nine
Uncommon, zero potency. Strong Fighter, Wise Cleric, Brilliant Wizard, Agile
Rogue; no stat-scaling bonus or mid-run grants. Existing tank/heal/DPS input,
room/boss completion, individual credit, town recovery/re-entry, manual Ilyra
claims and persisted personal handoffs remain required. Existing isolation
guards restrict fixture preparation to newly registered empty local accounts.

These are **prepared-party encounter checks**, not earned regional campaign
progression or completed crystal raids. Later-region prerequisites are explicitly
seeded, with the selected dungeon chapter accepted but uncleared. The helper
checks its target against the real server catalog and expected final boss;
later chapters are not seeded. The already accepted Verdant fixture is retained.
Five-player minimum raid admission remains unchanged.

Focused validation: 35 JavaScript tests across three suites passed (1.634s),
normal generated item-stat budgets for all four roles at levels 30/60/70/100
passed in Go (0.034s), scoped lint/diff checks passed. Actual level-60 Go catalog
round-trip into all four JS builds passed: fourteen items each, Water dungeon
chapter active, next offer `chronicle_fire_cold_kiln`.

Next native target: Normal level-60 Abyssal Well, one fresh seed, four System
Chrome clients, no retries. Full native result is not yet established.

First attempt73535 on62fca4f9 is terminal failed before entry (1.4m). All four
builds replicated and invitation/support-roster UI passed, but the shared route
always requested a reset, then waited for the existing-run confirmation. This
new party has no instance; the actual UI only confirms discarding an existing
one. No combat, boss or seed evidence was produced. Archive:
`/tmp/eidolon-abyssal-party-20260914-v2vOO4/` (log, report, roster screenshot).
Owned services removed and ports released by wrapper.

Correction: preserve the shared route's existing reset default for reusable
actors, but explicitly disable the reset for this guarded newly-created party.
An entry-boundary regression checks that choice; no gameplay reset behavior,
party state, entry gate or combat assertion is changed.
