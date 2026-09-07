# Critical-chance talent consumers — reproduced September 7

Status: **four actual-cast failures reproduced; runtime repair pending**. This is
the next build-correctness finding, not a completed talent category or release.
The main game and earned Fighter browser sources remained frozen during these
isolated Go overlay diagnostics. No production or browser character was modified.

Run `npm run audit:talent-consumers` with Node 24. The existing overlay script
loads `docs/qa/talent_consumer_probe.go` into a disposable test process, without
replacing runtime source. New `TestPendingTalentSkillCriticalChance` cases use
ordinary paid ability dispatch on prepared level-100 fixtures with zero/five
allocated ranks. The only random roll is fixed through the existing production
RNG; the fixture verifies the roll before resetting it for each cast. The test
enables seeded behavior in its own process with `randseednop=0`, preserves other
GODEBUG options and does not run parallel subtests.

The fixed roll is **0.604660**. Untrained builds have a 0.55 equipment critical
chance. Training adds the definition-backed 0.10 or 0.15 skill chance, which
should cross that roll. Separate zero-rank equipment-only controls use 0.65 and
do critically hit. There are no lucky items, special runes, active combos,
target armor, PvP scaling or target deaths to confound damage comparisons.

| Talent / actual cast | Untrained damage | Five-rank damage | Equipment-only critical control | Expected trained damage |
|---|---:|---:|---:|---:|
| Backstab Technique `ROG_04` / Backstab | 150 | 150 | 300 | 300 |
| Needle Precision `ROG_32` / Backstab | 150 | 150 | 300 | 300 |
| Sigil Mastery `WIZ_39` / Flame Whip | 25 | 25 | 50 | 50 |
| Battlefield Awareness `FTR_39` / Shield Slam | 100 | 100 | 200 | 200 |

The first paired run failed in **0.952 seconds**; the expanded equipment-control
run failed in **1.699 seconds**. Logs:
`/tmp/eidolon-critical-consumer-probes.log` and
`/tmp/eidolon-critical-consumer-controls.log`. All four equipment controls pass;
only the four trained critical expectations fail. The retained Cleric area
probes pass on this source. A nonzero audit exit is an open defect, not a release
pass or a skipped standard regression.

Source tracing explains the observed split: `GetSkillBonus` accumulates
`SkillCritChance`, while `CalculateFinalDamage` only reads `CritChanceBonus`.
The direct ability damage helper has no skill-identity parameter. Delayed damage
also uses attacker snapshots that currently omit talent ranks. This is evidence
for missing talent consumption, not proof that every ability shares all these
paths or that every critical interaction has been audited.

## Required repair and verification

- Carry explicit skill identity into the real damage calculation, including
  applicable projectiles, areas and delayed snapshots. Keep unrelated talents
  from affecting another skill; preserve valid saved ranks and point budgets.
- Compose existing equipment and applicable talent chance in one ordinary crit
  roll. Preserve separately defined rune/combo guarantees and lucky-item behavior;
  do not introduce accidental extra doubling or silently change basic-attack
  semantics. Resolve generic-talent copy against its intended actual coverage.
- Retain armor, receiving modifiers, walls, instance isolation and authoritative
  damage/feedback. Match offline behavior and visible critical feedback where
  applicable; changing a tooltip alone does not fix these four cast results.
- Promote these cases into ordinary tests, add rank-zero/one/five and unrelated
  skill controls, then verify immediate and delayed attacks, relevant runes and
  persistence through real gameplay before packaging a subsequent release.

The earned Fighter route does not allocate these critical talents, so these
diagnostics neither explain its missing hotbar casts nor invalidate its ordinary
opening/collection results. The separate fresh-overworld driver correction is
recorded in the earned-melee plan.
