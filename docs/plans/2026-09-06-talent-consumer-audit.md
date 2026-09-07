# Remaining talent consumers — reproduced September 6

Latest September 7 integration: the [critical-chance consumer record](2026-09-07-talent-critical-chance.md)
retains the original four trained-cast failures (1.699s), now repaired in the
local 1.0.41 candidate. The same actual-consumer audit passes **0.890s**, alongside
promoted rank/control/composition/flight regressions and three-class ordinary
browser purchases, combat and saved ranks. Publication remains pending; this is
not a full 160-talent sign-off. The previous Cleric area probes also pass in the
preserved 1.0.40 runtime. Historical unresolved labels below describe their
checkpoints, not the current audit command's result.

Next audit work remains Purifying Wave's healing-only Mastery without a healing
consumer, periodic bleed/poison source attribution and unimplemented offline
Avenging Seraph. Any change to an intended talent benefit must reconcile its
copy, ordinary cast behavior and preserved saved investment; adding metadata or
silently resetting ranks is not a repair. The broader full-tree gate stays open.

Status: four representative consumer defects reproduced against the 1.0.29
runtime. Not repaired by the cooldown/mana patch, and not a complete 160-talent
audit. No production save, running browser source or game balance was changed
by these diagnostic casts.

Latest local Alpha 1.0.37 work promotes [both Blessings and Heaven's Trumpet](2026-09-07-cleric-immediate-areas.md)
alongside Consecrated Ground, Guardian Embrace, Purifying Wave and Teleport into
ordinary actual-consumer coverage. Corrected fixtures reproduce the old handler's
failure via a Go build overlay; the repaired runtime passes. The original Trumpet
diagnostic's zero-Wisdom limitation is explicitly retained in that work record.
The next diagnostic batch now exercises **Spirit Guardians and Spirit Guardians
Boost**, with and without Expanded. All four rank-five actual periodic ticks miss
targets in the trained annulus while rank-zero controls pass, 0.798s,
`/tmp/eidolon-spirit-area-probes.log`. All use nonzero Wisdom and ordinary dispatch.
Earlier probe counts below describe historical checkpoints, not the current
command's contents. Remaining full-suite/publication gates stay in the work record.
The full category and ineffective Purifying Wave healing mastery remain open.

September 7: the separate [1.0.31 healing candidate](2026-09-07-talent-healing.md)
promotes the Healing Light reproduction into normal server regression coverage,
with direct/periodic, rune/combo and receiving-modifier checks. Its focused tests
pass; browser and publication validation remain separate. The diagnostic command
now retains the **three unresolved duration/range/area probes**. The original
four-defect measurements below remain historical evidence, not current failures
of the repaired Healing Light consumer. Purifying Wave's healing-only Mastery
and other effect/copy gaps are still open.

The [1.0.32 duration candidate](2026-09-07-talent-duration.md) also promotes the
Arcane Shield probe into normal actual-cast and expiry tests, with other timed
Wizard buffs/debuffs. The diagnostic overlay now retains **two range/area probes**.
Projectile/zone lifetimes and other classes' duration consumers remain open;
this is not a complete duration audit. Publication/phone validation are separate.

Unpublished work after 1.0.35 begins the range category with Teleport's server,
client targeting and offline landing contract. See [the work record](2026-09-07-talent-range-work.md).
The broader range category and area probe remain open; do not interpret one
repaired representative probe as all skill-range consumers being functional.

## Repeatable evidence

Latest September 7 batch: [Spirit Guardians/Boost](2026-09-07-spirit-area.md) now
has passing ordinary cast/tick, protocol and gameplay checks. Its diagnostic
batch passed 0.653s before promotion. The overlay next reproduces **three**
remaining Ministry area consumers: Radiant Strike at 4.55m, Beacon at 6.75m and
Mass Revival at 23.25m. All rank-zero controls pass and all rank-five casts are
accepted but miss their expected effect (**0.438s**,
`/tmp/eidolon-cleric-next-area-probes.log`). The combo probe deliberately supplies
active combo state; it does not prove normal cross-branch build access. Earlier
batch counts below are historical, not a claim that all other consumers work.

Run `npm run audit:talent-consumers` with Node 24 and Go available. The script
uses Go's build overlay to add [paired diagnostic casts](../qa/talent_consumer_probe.go)
without editing the server package. It refuses to replace an existing source
test and removes only its newly created overlay directory. A nonzero result is
an open defect or diagnostic failure, not a passing release check. These are
not disabled tests inside the standard suite; promote each probe into normal
regression coverage when its implementation is corrected.

All four rank-zero baselines pass; each corresponding rank-five expectation
fails in both the initial temporary-overlay run and the durable command. Logs:
`/tmp/eidolon-talent-pending-probes.log` and
`/tmp/eidolon-talent-consumer-audit.log`.

| Consumer | Paired actual behavior | Definition-backed expectation |
|---|---|---|
| Healing Light Mastery (`CLR_03`) | Heals 72 HP with zero ranks and still 72 with five ranks, at 10 Wisdom and 20% equipment healing bonus | Its +20% healing must have an effect; the probe uses multiplicative equipment/talent composition (86 HP) as the reference contract |
| Arcane Stability (`WIZ_32`) | Arcane Shield lasts 20 seconds at both ranks | Five +5% duration ranks produce 25 seconds under the current server definition |
| Aether Reach (`WIZ_35`) | Teleport at 17m is rejected at both ranks | Five +4% range ranks extend 15m to 18m, allowing that unobstructed target |
| Battlefield Ministry (`CLR_34`) | Purifying Wave leaves a bleeding friendly actor at 10.2m uncleansed at both ranks | Five +3% area ranks extend radius 8m → 9.2m; including the unchanged 1.25m body radius reaches that actor |

Fixtures are level 100 with five allocated ranks, ordinary ability dispatch,
enough mana and explicit unlocked skills. There is no cooldown/mana bypass in
the dispatch. They test effects, not earned progression or physical devices.
For healing, the unchanged 72 HP proves the missing positive bonus regardless
of whether a future reviewed composition policy chooses additive or
multiplicative equipment stacking; do not silently change balance to satisfy
one proposed numeric expectation.

## Implementation sequence and proof requirements

1. **Healing and duration:** centralize actual spell/periodic-heal and duration
   consumers with skill identity. Preserve equipment and receiving-target
   modifiers, health clamps, rune/combination behavior and exact heal events.
   Verify initial heals, renewal ticks, group healing and shield/other buff expiry.
   Server-replicated remaining time must agree with visible effects.
2. **Range and area:** apply caster bonuses to both query bounds and the final
   geometry test, with unchanged walls, height, instance and relationship rules.
   Match client targeting/chase behavior and local/remote effect footprints.
   Simply increasing server radius while leaving the visible circle unchanged
   is not an acceptable fix. Test inside/outside the old and new boundaries,
   oversized actors, relevant runes and both graphics settings.
3. **Remaining tree:** continue exact per-skill damage/crit/secondary-mastery
   and generic-stat checks, then correct all copy against working effects.
   Source inspection finds no production consumer of `SkillCritChance`, and
   many skill-specific handlers require individual tracing; these have not yet
   received the paired-cast proof above. Do not label them verified by this table.

Specific source integration risks to retain for implementation:

- `applyHealingDoneBonus` currently consumes the equipment/stat healing bonus,
  while Healing Light's renewal amount derives from its already-modified initial
  heal. Adding a talent modifier again at every renewal tick would double-apply
  it. Other periodic area heals apply owner bonuses during updates; identify
  whether each amount is a base or a cast-time snapshot before changing it.
- Following the active buff into `world_update_entity.go` confirms that Guardian
  Embrace **does heal self and nearby allies once per second**. Its cast handler
  alone only activates the buff; the earlier cast-only inspection was incomplete.
  Apply its `CLR_05` healing bonus at that actual tick, with health clamps and
  receiving-target modifiers. Purifying Wave still has no observed healing path,
  despite `CLR_07` assigning `SkillHealing`; merely adding a numeric helper cannot
  make that investment meaningful. Review that intended benefit explicitly and
  preserve saved rank investment.
- `withinAbilityRadius` and `expandedAbilityRadius` do not receive a caster.
  Resolve the skill's talent-adjusted base radius before both calls, and propagate
  the same effective dimensions into persistent effects and network presentation.
  Existing target-body padding and Meteor visual scaling are separate concerns.
- Teleport uses a hard range rejection, while directional projectiles can be
  limited by velocity/lifetime. A range fix needs both models and the client's
  pending-target/input checks; changing only `AbilitySpec.Range` does not suffice.

Keep [the roadmap's build gate](2026-09-05-v1-1-to-v1-10-roadmap.md) open. Existing
saved ranks should be preserved; incompatible redesigns need explicit rationale
and migration/reset behavior rather than deleting investment on login.
