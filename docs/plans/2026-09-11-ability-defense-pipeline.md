# Ability receiving defenses — confirmed repair gate

Required before claiming complete combat/talent/rune acceptance for1.1. This
isolated investigation extends825f9b0c, not domain61 or the narrow gameplay
successor. It does not claim a repair, native balance or completed roadmap gate.

## Reproduction

An ordinary requested/accepted duel authorizes two actual players. After only
expiring the match-start grace period and positioning them within range, the
defending Wizard pays for Arcane Shield (600 capacity). The opponent uses its
ordinary paid ability. Unshielded controls establish that each attack is valid.

87847 failed race0.033s for all four shielded abilities.72981 adds actual basic
attack admission and its scheduled impact, drained through the background task
group rather than invoking a damage helper. It failed race0.130s with the same
four failures; all six unshielded/basic controls passed.

| Shielded ability | Defender HP | Shield capacity | Absorbed |
|---|---|---|---|
| Shield Slam |500→458|600→600|0|
| Earthshaker |500→455|600→600|0|
| Smite |500→468|600→600|0|
| Flame Whip |500→471|600→600|0|

The shielded basic attack leaves HP unchanged and consumes capacity. This
isolates the inconsistency to the tested skill paths, not failed shield creation.
Logs `/tmp/eidolon-ability-shield-diagnostic.log` and
`/tmp/eidolon-ability-shield-diagnostic-controls.log`.
Reproduce with:

```sh
cd server
GOMAXPROCS=2 go test -race -p 1 -tags qa_diagnostics ./internal/game \
  -run '^TestDiagnosticPaidHostileAbilitiesRespectArcaneShield$' -count=1
```

The diagnostic remains deliberately red and opt-in while the receiving pipeline
is repaired. Passing default suites is NOT evidence that this known gate is
closed. Promote it to ordinary regression coverage with the completed repair.

## Source evidence and implementation requirements

ability_helpers.go applyFinalDamageWithCritical calculates outgoing damage and
subtracts it directly from Health. It does not invoke the receiver defense path.
combat_attack.go basic impacts and world_update_entity.go boss slams instead use
combat_impact_defenses.go mitigateImpactDamageLocked. That method includes
invulnerability, Sanctuary/Guardian reduction, shield capacity and reflective/
explosive rune effects; explosive retaliation releases/reacquires the target lock
and needs an explicit world-lock contract for death and party-credit processing.

Repair the full impact contract, not only subtracting shield HP in these four
handlers. Audit each caller's world/attacker/target lock ownership; separate
defense-state mutation from retaliation/death effects where necessary. Preserve
one capacity consumption and one death/credit dispatch per impact. Make the
ordering of outgoing bonuses/PvP scaling, mitigation, absorption and lethal
prevention explicit, and revalidate any intentional budget changes.

Required cases include basic/direct/cone/area/projectile/delayed/persistent
damage, partial and full absorption, expired shields, Reflective/Explosive,
invulnerability/reductions, multi-target attacks, overlapping/recast defenses,
dead/departed recipients and owners, party rewards, PvP and Dark King phase caps.
Do not apply mitigation twice to paths already using it, recurse into held
world/actor locks, silently drop shield retaliation, or count tests for one
family as completion of the whole pipeline. Include native four-role combat and
shield feedback before claiming encounter balance. Existing urgent release61
continues independently through its required gates.
