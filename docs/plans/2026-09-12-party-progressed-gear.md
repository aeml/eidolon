# Role-appropriate dungeon equipment — player-directed QA revision

## Full prepared-party acceptance — September 12, 22:19 UTC

Native15051 on exact9b6745d797333105ce657bac4f9bbc288ff713e4 completed PASS:
one test58.8minutes, zero retries. Normal level30 Verdant, seed
-1286139677518117694, generator2/attempt0/no fallback, clean source. All four
actual replicated role loadouts passed verification. Every room and original-HP
boss cleared; all four final evidence records have sawDeath=false. No stat curve,
provisional boss reduction or mid-run grants were used.

Boss encounter durations: Warden32.35s, Matron55.19s, Colossus118.01s,
Sentinel179.79s. The healer contributed5503 ally healing in the final encounter
and12164 across the full run. Five actual town recovery/resume cycles preserved
seed, cleared rooms, gold, inventory and quests. Completed-run recall/re-entry
also preserved the run. Each player received credit/XP/gold, individually claimed
Ilyra's chapter reward, received the Water offer and retained their own chapter/
reward/offer after relog; another member's claim did not claim anyone else's.
All finish level32/1794gold; each chapter grants300gold/10562XP once.

The route measured2592.20s traversal,539.69s combat,178.36s recovery and22.94s
verification, plus10.03s entry. Traversal includes2162.36s formation and292.80s
leader-input observation. These are automation timings, not a human clear-time
or pacing approval. The harness's80% post-room resource recovery threshold is
conservative and is not a game rule requiring players to return at that point.

Archive `/tmp/eidolon-geared-party-pass-KVzr6y` contains the complete native log,
report and test results; credential scan sanitized0 files. Inspected the Low
party/selected-healing screenshot. Exact disposable containers, run image and
API18185/Mongo18186/web41875 listeners were absent after script cleanup.

CI34719442897 completed SUCCESS on0a75527d: full client/server and three browser
shards, with native/deploy/live skipped. The subsequent test-only hydrated-rarity
comparison9b6745d7 passed its13 focused checks and the actual full route above.
Accept this prepared-party QA component for integration; run fresh combined CI
after merging. This is not earned first-hour/equipment evidence, other seeds or
dungeons, death/reconnect variants during combat, High/physical-phone acceptance,
raid progression,1.1.0 release approval or live deployment.

## Earlier implementation and evidence

September12: the player explicitly requested at least Uncommon/Rare equipment,
Strong gear for the warrior, Agile for the Rogue and corresponding caster stats.
The proposed level-dependent stat multiplier was explicitly withdrawn. No stat
scaling change is included.

The default four-player fixture now uses level30 equipment in all14slots:
five Rare pieces (weapon, offhand, chest, legs, first trinket) and nine Uncommon.
Every Fighter item has the Strong/Strength affix, every Rogue item Agile/
Dexterity, every Wizard item Brilliant/Intelligence and every Cleric item Wise/
Wisdom. Rare pieces also have the Vitality suffix. These are selected legal rolls
from the production item generator with its actual2x/5x rarity budgets and
one/two affixes, ordinary stat squish and zero potency. No fabricated bonus,
Legendary item, future level, enchantment, talent grant or resource protection
was added. Selection is bounded and fails if the required legal roll is absent.

The browser verifies all14 actual replicated equipped items against the catalog,
including names, levels, rarities and stats, and records each loadout. The old
Common setup remains an explicit `EIDOLON_E2E_PARTY_GEAR=common` comparison;
default/progressed uses `EIDOLON_E2E_PARTY_GEAR=progressed`. Isolation guards,
level30 base growth, rank5 primary mastery, paid combat, survival, town recovery,
full-room/boss clear and individual manual quest handoff checks are unchanged.

This branch starts from the party controller plus accepted primary c9e922be and
the test-only traversal accounting90b3313a. It deliberately retains the ORIGINAL
boss health, not the provisional40% Verdant reduction: gear should be evaluated
before stacking another balance change. The failed Common Matron run remains
evidence, not erased by the better-equipped scenario. No production change or
full-clear success is claimed before the new actual party test completes.

Focused fixture/timing tests: two suites19tests PASS0.775s. Every base item/role/
rarity combination passes production-roll budget verification under Go race
in1.080s. Full lint, client preparation and diff checks pass. Logs
`/tmp/eidolon-party-progressed-gear-{client,server,lint,prepare}-20260912.log`.
This changes test loadouts, not player loot, so it needs an acceptance record
rather than a fabricated player-facing release note.

First native70936 on0a75527d failed14.0s during equipment verification, before
party formation or dungeon entry. The real Fighter had the expected Strong Rare
sword and exact11damage/9Strength/9Vitality, but hydrated client rarity is an
object with `name: Rare`, not the wire string. The read-only comparison now
normalizes that representation; all item name/level/rarity/stat checks remain.
Archive `/tmp/eidolon-party-progressed-gear-preparation-failure-9pX8sZ`, scan0/
exact cleanup verified. This was a test-contract error, not a dungeon failure.
