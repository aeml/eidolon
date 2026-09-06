# Alpha 1.0.29 — make your training count

Status: locally verified candidate on `release/29-with-economy`, not published.
The ordered release queue remains in the [execution ledger](2026-09-05-roadmap-execution.md).
This is part of trustworthy first-hour build preparation and combat, not closure
of the whole 1.1 or 1.3 milestone.

## Reproduced behavior and implementation

Paired authoritative casts at rank zero and rank five reproduce missing talent
consumers in all four classes. Fighter, Wizard and Cleric reject a cast when the
player has exactly the talent-discounted mana cost. Rogue spends mana normally
but retains the unreduced cooldown. A separate Wizard check proves its Technique
mana discount is ignored. Four client cast regressions fail for the same
affordability/cooldown discrepancy. Definitions were populated but not consumed;
the finding is stronger than a source search or tooltip mismatch.

The candidate connects existing `SkillManaCost` and `SkillCdr` definitions to
authoritative ability execution without changing ranks, point budgets or defined
per-rank rates. General and skill-specific talent reductions add within their
category; equipment/global reductions compose multiplicatively with that result.
Mana preserves the existing integer equipment discount first, then floors the
talent-discounted result. For example, a 35-mana spell with 10% equipment and 10%
talent reductions costs `floor(floor(35 × .9) × .9) = 27`. Zero-cost abilities
remain free. At 20% global CDR and 15% skill CDR, a two-second spell has a
1.36-second cooldown. Teleport's set-charge recovery uses the same calculation;
the immediate charge remains an immediate charge.

The ordinary desktop/phone input gate, Actor prediction and primary ability HUD
cost share one client helper. HUD diffing includes the resolved cost so buying
a rank refreshes the label without needing an unrelated health change. A shared
test contract checks all 160 class talent entries for cooldown/mana metadata on
both Go and JavaScript sides. This contract is test data, not a runtime network
dependency. Wizard Technique, Lightstep and Cleanse Discipline copy is corrected
to identify the effects this patch connects; other description mismatches remain
explicitly open.

## Validation

- Red logs: `/tmp/eidolon-talent-economy-red.log` and
  `/tmp/eidolon-talent-client-red.log`; all four class cases reproduce the defect.
- Initial green checks: **35 client tests across five suites** and focused
  race-enabled authoritative cast/config checks. These include unrelated-skill/
  class isolation, integer equipment composition, exact-cost input acceptance,
  HUD refresh and the shared metadata contract.
- Full versioned client validation passes **170 suites / 2,431 tests in 92.304
  seconds**, and lint passes. Full server race verification also passes (root
  16.146 seconds; game package 200.932 seconds). Final repeats include supplemental
  two-charge Teleport recovery and real-class multiplayer override regressions.
  Logs `/tmp/eidolon-1-0-29-{client,lint,server}.log`.
- The final client repeat passes **170 suites / 2,435 tests in 123.412 seconds**,
  including actual Fighter, Rogue, Wizard and Cleric multiplayer subclass skill
  overrides with exact discounted mana. Final lint passes. Logs
  `/tmp/eidolon-1-0-29-{client,lint}-final.log`.
- The final full server race suite passes, including both Teleport charges and
  exact equipment/talent rounding (game package **245.523 seconds**; unchanged
  other packages cached). Session `93657` is closed. Log
  `/tmp/eidolon-1-0-29-server-final.log`. Shell syntax and whitespace checks pass.
- The new real-server phone route passes in **25.8 seconds** (23.9-second body),
  with credential scanning and exact run-owned cleanup completed; session
  `39832` is closed. Log `/tmp/eidolon-1-0-29-talent-economy.log`.
  The route uses a disposable level-100
  functional fixture, purchases ten ranks through normal UI, checks Fireball
  cost 30 → 21 and its server-confirmed cooldown, and repeats after fresh login
  in landscape. It is not an earned leveling or physical-phone measurement.

## Remaining combat/build gate

The four class overrides return through the shared prediction path in multiplayer.
Their legacy offline simulation branches still contain independent hard-coded
cooldowns; those branches are not evidence for the online cast contract and are
not repaired or certified by this patch.

Do not extrapolate these two consumed bonus categories to the entire talent tree.
Subsequent paired-cast probes now reproduce four specific remaining failures;
see the [consumer audit](2026-09-06-talent-consumer-audit.md). That diagnostic
command remains red, separate from the passing cooldown/mana release coverage.
Range, duration, secondary mastery effects on non-damaging skills, crit/healing/
area consumers and all remaining description mismatches need explicit paired
behavior tests. The previous failed fresh Imp hunt is still failed; this patch
does not validate its strategy, earned first-dungeon readiness or campaign pacing.
Continue appropriate Wizard spacing/defensive preparation and real dungeon/party
playthroughs under [fresh progression evidence](fresh-progression-evidence.md).
