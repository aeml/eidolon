# Role-appropriate dungeon equipment — player-directed QA revision

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
