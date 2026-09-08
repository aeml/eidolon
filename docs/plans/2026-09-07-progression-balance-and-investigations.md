# Progression balance and realm investigations

Requested September 7, 2026. Status: **implementation active; full pass open**.

September 8 update: the isolated expanded story now passes an earned fresh
Earth route with the 100-XP opening, diary, eight-fragment collection and linked
evidence, plus manual handoffs and reconnect. Source **95faafc**, browser
**26283 PASS / 3.1m**, zero deaths, 15 observed collection-target deaths (not all
AoE kills), three equipment drops worth 80 gold **unsold**. It ends at level 16,
with the existing level-30 dungeon gate correctly locked. All four realm phone
investigation routes also pass on their recorded prepared-veteran sources.
This is not a viable full leveling route or a published expansion yet.

The [stacked boss/daily audit](2026-09-08-stacked-dungeon-rewards.md) additionally
measures **16,001,240 XP** from four Normal Verdant boss payouts plus two daily
claims: prepared level 30 → 54 → 57, before trash, rooms, story or sale income.
Quest and encounter budgets must be tuned together. No full replacement curve
or final source/sink approval has been selected.

The following sections retain their original staged scope; isolated expanded
runtime is tracked separately from the root-integrated foundation and releases.
The locally verified, root-integrated 1.0.47 candidate implements eight-fragment
collections, reduced ordinary drop rates, saved bad-luck protection and
legacy-contract migration. It is queued, not published. The
[personal fragment budget](2026-09-07-personal-fragment-budget.md) additionally
prevents simultaneous kills from creating surplus quest fragments; its 1.0.49
package is locally verified and root-integrated, but not published.
The [routine equipment budget](2026-09-07-routine-equipment-budget.md), locally
verified and root-integrated as 1.0.50, reduces ordinary equipment frequency by
40% and caps non-boss elites at one equipment piece while preserving material
rolls, boss rewards and owned gear. Its full browser and earned collection/
preparation checks pass; its publication remains in the sequential release queue.
XP/gold tuning, equipment power/usefulness and playable investigations remain
open. The
[opening reward candidate](2026-09-08-opening-reward.md) reduces new tutorial
offers from 500 to 100 XP, keeps 100 gold and honors accepted promises. Full
server race checks and a fresh earned Wizard opening/collection playthrough
pass; runtime remains isolated and unpublished. The same playthrough exposes
the remaining collection reward jump from level 5 to 16. This small opening
correction does not select a replacement XP curve or close campaign pacing.
The
[loot/Forge baseline](2026-09-07-loot-and-forge-baseline.md) now measures combined
material/equipment sources and actual transactions; the
[Forge precision correction](2026-09-07-forge-earned-scaling.md) is locally
verified and root-integrated as the queued 1.0.48 candidate.
The
[authored investigation draft](2026-09-07-investigation-story-content.md) supplies
Ilyra conversations, personal accounts and discoveries for all eight planned sites;
The [investigation foundation](2026-09-07-investigation-implementation.md) now
compiles this text into matching catalogs, validates personal discoveries, saves
individual evidence and selects Ilyra's replies by stable quest ID. It is locally
tested and integrated, but world interactions and the expanded quest graph are
not yet active on root or released builds. An isolated 23-chapter implementation
has actual Earth and prepared returning-character Water, Fire and Air playthrough
evidence, including manual rewards and saved discoveries. Fire additionally
proves the ordered anchor defeat and released ember visual; Fire/Air verify
retrospective replies and full saved journal rereading. The fresh full campaign,
broader touch/continuity/pacing and expansion-release gates remain open.
The latest isolated phone follow-up verifies readable stacked reward rows and
saved diary controls, including native scrolling in either direction after
rotation. After correcting fresh diary/collection/investigation dialogue handoffs,
combined client checks pass **219 suites / 3,299 tests**, and five layout/real-touch
browser checks pass. Earned Earth, Water, Fire and Air touch routes pass, including
Fire's actual anchor death before ember credit. Air needs an ordinary walking
detour around the solid Bastion entrance; the corrected route passes after the
recorded failures. The smaller opening payout is now integrated into the isolated
expansion, with combined full suites and a fresh Earth route running.
These UI checks neither validate the XP economy nor make
the expansion live. New chapters redistribute their realm's existing reward
budget; they do not add eight full-size payouts. Selected purposeful combat
belongs in those investigations, not an automatic increase to 100-kill dailies.
Authored text and recording tests alone are
not evidence of reachable world locations or completed playable quests.
This expands the active full-roadmap goal. Ship verified excessive-reward fixes
in suitable 1.0.x patches; establish progression pacing in 1.1, deliver the
expanded Chronicle in 1.4, finish the economy pass in 1.5 and revalidate raid
rewards in 1.6. Do not defer obvious progression problems to the later milestones.

## Player-facing outcome

Make levels, equipment upgrades and crystal restoration feel earned. Spend more
meaningful time exploring each realm, learning what happened and preparing for
its dungeon, without replacing a short campaign with repetitive mandatory hunts.
Reduce excessive item drops, XP and rewards together; increase selected story
collection and kill requirements where the resulting playtime is appropriate.

The existing [earned progression evidence](fresh-progression-evidence.md)
records a Fighter reaching level 16 after the opening/collection turn-ins and
an earned Verdant run entering at level 34 and finishing at level 54. The current
pre-tuning catalog asked for four items in each elemental collection chapter;
the 1.0.47 candidate raises new contracts to eight while retaining accepted
legacy contracts. Ordinary daily hunts already ask for 100 kills. These are
reasons to audit pacing, not proof that every source needs the same multiplier.
Automated routes are not a substitute for a new player's exploration time.

## BAL-01 — reward and progression baseline

- [ ] Trace authoritative and offline XP, gold, equipment, rarity, consumable,
  material and quest-item sources: ordinary/elite kills, bosses, chests, story,
  dailies, dungeon completion, crystal Vigils and repeatable raids. Separate
  simultaneous rewards so a boss kill plus quest plus completion is not counted
  as three unrelated budgets. Check party credit and difficulty scaling.
- [ ] Record XP as a fraction of the recipient's next level, levels per activity,
  gold/material income versus Forge/vendor sinks, equipment drops versus useful
  upgrades, inventory pressure, and ordinary versus rare reward frequency.
- [ ] Establish explicit target ranges for the opening hour, each realm, dungeon
  entry, level cap and repeatable endgame before selecting final tuning values.
  Compare all four classes, solo/party and fresh/established characters.
- [ ] Audit max-level rewards and existing Resonance conversion before choosing
  its final policy. Do not accidentally award both uncapped XP conversion and a
  compensating gold payout. State the chosen rule in the UI and patch notes.

## BAL-02 — coordinated tuning, not blanket multipliers

- [ ] Reduce proven excessive XP and gold sources, excessive equipment frequency
  and rarity, and oversupplied consumables/materials. Preserve meaningful boss
  rewards, early survivability, ordinary skill purchases and upgrade affordability.
- [ ] Lower elemental quest-item drop rates and increase collection requirements
  as one combined pacing change. Specify eligible creatures, per-kill quantity,
  target count and expected completion range together; prevent accidental
  multiplicative grind from independently increasing counts and reducing drops.
- [ ] Add a bounded bad-luck safeguard for required quest drops, with progress
  surviving reconnect. Award only needed items for accepted objectives; test
  full bags, party rules and credit/loot consistency. Keep icons and protections.
- [ ] Raise selected short main-story kill requirements and add purposeful hunts
  associated with investigations. Do not automatically increase existing
  100-kill daily contracts or stretch the introductory tutorial hunt.
- [ ] Budget rewards across the expanded chapter chain instead of adding eight
  full-size payouts on top of today's total. Daily contracts remain optional;
  story plus normal realm exploration must support required dungeon entry levels
  without mandatory daily resets or unexplained farming walls.
- [ ] Preserve existing gear, gold and earned levels. Define migration for active
  quest counts and collected items before changing requirements; do not silently
  undo completed quests or revoke already-earned realm/raid access.

## STORY-01 — investigate the wounds of the world

Add **two authored investigation quests per elemental realm (eight total)**,
interleaved with collection/combat before that realm's dungeon handoff. Names
below are proposed content, not existing locations. Reuse the established
Earth → Water → Fire → Air progression and existing lore: the crystals sustain
a willing covenant, and Malachar is trying to replace it with obedience.

| Realm | Investigation stops | Revelation and reason to enter the dungeon |
|---|---|---|
| Earth / Orun | **The Keeper's Empty House:** search an abandoned grove-warden's home and read a root-bound diary. **The Scar That Grows Back:** examine three linked roots around a blighted stone circle and recover a memory imprint. | The diary begins with ordinary harvest worries, then records roots retreating from an unfamiliar command. The imprint shows a corrupted courier seal carried toward the Bastion. Memory Seeds preserve the land's identity; defeating the outer guardian is needed to reach the sealed root-road, not to repair the crystal immediately. |
| Water / Neris | **The House Beneath the Tide:** recover and read a ferryman's waterlogged last crossing record at a deserted flood shelter. **A Reflection Out of Time:** compare two pools whose echoes replay different versions of the same promise. | A remembered evacuation has been altered to sound like willing surrender. The same seal is hidden in the false echo. Moon-Tide Pearls retain the authentic rhythm; the Abyssal Well's guardian is trapping the route to Neris's deeper sanctum. |
| Fire / Pyralis | **The Cold Kiln:** investigate an abandoned communal forge and its smith's unfinished ledger. **An Ember That Obeys:** inspect an unnatural flame and disrupt its command anchors through a short combat objective. | The smith was offered reliable heat in exchange for a binding oath, but the fire stopped answering anyone else. The ledger links the seals to the old sanctum courier. Cinderheart Ore carries freely given flame; Molten Core holds the outer mechanism enforcing the command. |
| Air / Aeral | **The Last Weatherkeeper:** explore a deserted observatory and read its final sky journal. **The Stolen Horizon:** investigate a stationary storm using three reachable resonance markers. | The journal identifies Malachar as the former messenger between sanctums. The storm reveals a rehearsed demand for allegiance, not a natural disaster. Stormglass Pinions preserve independent currents; Tempest Spire seals the final raid-road needed to plan Maelin's four Vigils. |

Ilyra sends the player to investigate, discusses discoveries at explicit manual
turn-ins, and changes her interpretation as evidence accumulates. Each artifact
should reveal a particular person's life and loss, not repeat an exposition dump.
Let the final Air discovery establish Malachar's method while leaving his full
justification and threats for the Dark King encounter. Maelin uses this evidence
to explain why each repair ritual must reverse a different part of that method.

- [ ] Author acceptance, discovery, journal and completion text for all eight
  quests, including Ilyra's connective conversations and accessible summaries.
  A complete content draft is linked above; integration and in-game continuity
  review are still required before this item is signed off.
- [ ] Build recognizable, reachable world props and distinct magical disturbances
  with correct collisions, interaction prompts and desktop/touch readability.
  Each realm gets both a personal-history site and a supernatural investigation.
- [ ] Require deliberate inspect/read/interact actions, not merely entering an
  invisible trigger. Use server-validated proximity, realm/instance and active
  quest state; make discovery credit and reward claims idempotent.
- [ ] Store discoveries in a rereadable journal. Essential directions and story
  cannot depend on reading long diary pages during combat. Keep quest tracking
  selectable and compact, with clear destination hints rather than pixel hunts.
- [ ] Preserve all four full dungeon clears, then all four full raids and defended
  Maelin repair events before opening the Dark Realm route. Investigations and
  gathered relics prepare repairs; they never count as restored crystals alone.
- [ ] Add stable quest IDs and an explicit prerequisite graph/migration. Players
  partway through the old chain must not become stranded or lose credit; offer
  missed lore without forcing completed players to repeat dungeon/raid gates.

## Acceptance and release evidence

- [ ] Publish before/after tuning tables with selected targets and rationale.
  Cover reward stacking, max-level conversion, party credit, duplicate turn-ins,
  seeded drop distribution, bad-luck limits and save migration in automated tests.
- [ ] Run earned fresh-character playthroughs without grants through each realm;
  check actual time, levels at dungeon gates, deaths, upgrades and affordability.
  Include unlucky drop sequences, reconnect and solo/party comparisons.
- [ ] Play all eight investigations through normal world interactions, manual
  Ilyra completion and saved journal rereading on desktop and touch. Inspect props,
  story continuity and quest directions; completion assertions alone are not
  proof of enjoyable pacing or good writing.
- [ ] Revalidate full dungeon → raid → repair → portal → Dark King progression,
  existing saves and endgame source/sink balance after the combined changes.
- [ ] Ship focused, versioned patches with explicit reward/requirement changes
  and migration notes, normal CI gates and exact post-deployment verification.
  Do not advertise planned quests or proposed tuning as already live.
