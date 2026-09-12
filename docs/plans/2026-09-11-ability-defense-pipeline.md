# Ability receiving defenses — confirmed repair gate

> Historical development evidence, imported with the receiving-defense changes.
> This document's source hashes and phase-cap results describe that development
> branch, not the narrower release64 build. See
> [release64 scope and gates](2026-09-12-release64-receiving-defenses.md) for the
> current candidate: existing release63 campaign/economy and Dark King behavior
> are retained; the separate phase-cap change remains pending.

## Projectile/zone migration — focused acceptance

Projectile updates now own a fresh world-unlocked context and flush after all
projectile/receiver locks are released. Direct collision, splash, Meteor,
Meteor's shield-explosion combo and periodic zone damage use the receiving
pipeline once. Hostility uses an owner combat snapshot with captured party
identity. Zone damage now checks ordinary hostility rather than only TypeEnemy:
consenting PvP opponents can be hit while party members/neutrals remain safe.

3829 reproduced six shield-bypassing projectile families plus two damage zones
ignoring duel opponents (10 failing cases;6 unshielded controls passed), race
0.057s. Initial test setup also missed the real trap trigger radius; the final
reproduction moves its defender inside that radius without changing the trap.
Meteor/zone/trap wall-clock deadlines are explicitly made ready, not claimed as
native timing proof. Cast-created geometry/damage/owner/trajectory are retained.
`/tmp/eidolon-projectile-defense-controls-red.log` records the final red state.

72950 passed immediate/projectile focused race1.160s after migration. Added
exact Fireball direct-versus-splash/reflect budgets, zone party/neutral positive
and negative controls, lethal reflection against the live projectile caster,
and simultaneous paid shielded Fireballs through real parallel World.Update.
61479 passed three repeats under race detection50.586s including existing
projectile/realm/wall/critical/bounce/impact-event, trained shield and boss-slam
retaliation/party-credit cases. Logs
`/tmp/eidolon-projectile-defense-{green,broad}.log`.

Remaining required work includes Whirlwind, Charge landing, Spirit Guardians,
Seraph, DoTs, basic outgoing/receiving ordering, shield expiry, explosive PvP
hostility, full merged regression, native four-role feedback/balance and save
acceptance. None is implicitly closed by this focused pass. Unreleased note
draft: projectiles and lingering damage zones now respect shields/protection;
valid PvP opponents are affected by damage zones without harming bystanders.

## Immediate-cast migration — focused acceptance, not full closure

The four class handlers now use an explicit per-cast impact context. Outgoing
bonuses/critical/PvP scaling precede receiving reductions and shield capacity;
only the remainder damages HP or contributes to Fortify. Retaliation receipts
flush after PerformAbility finishes cast/cooldown/state bookkeeping, while it
still owns the world lock and holds no actor locks. Reflection resolves the live
attacker rather than modifying a private outgoing-stat snapshot. Aftershock
owns a fresh context in its existing delayed world-locked callback.

Original four red skill cases passed in33868 (race1.119s). The test is promoted
from opt-in diagnostic to ordinary TestPaidHostileAbilitiesRespectArcaneShield.
40844 passed focused race9.234s including lethal reflected cast state, absorbed
Fortify and live-attacker/single-flush checks. Expanded coverage now includes
15 basic/immediate attacks across all four classes, each shielded/unshielded,
plus partial absorption, invulnerability, Sanctuary and overlapping stronger
Sanctuary/Guardian ordering with exact reflection amounts.

34002 passed three repeats under race detection25.669s, also retaining trained
Arcane Shield rune and boss-slam defense/party-credit coverage. Logs:
`/tmp/eidolon-ability-shield-immediate-{green,reactions,final}.log`.
An initial expanded invocation used an invalid Go flag (no tests ran); the next
used a nonexistent Juggernaut Slam name. Corrected to the actual Juggernaut
Charge before this final passing run; no runtime requirement was weakened.

This does NOT close projectile, persistent/tick, basic ordering, expiry,
explosive PvP hostility, full regression, saved/native or balance acceptance.
The remaining pipeline requirements below are still mandatory. Unreleased
player-note draft: direct hostile abilities now respect absorption/protection,
reflective shields retaliate without losing death state, and Fortify does not
grant shielding for damage absorbed by another shield.

## Receiver/reaction separation — implementation foundation

The shared ordinary/boss defense implementation now separates locked receiver
mutation from world retaliation. resolveImpactDefenseLocked returns HP-damage
remainder, reflected amount and an immutable explosive-shield receipt (damage,
origin, instance, owner). It commits capacity depletion before returning and
does not acquire another actor/world lock or apply the HP damage itself.
The existing mitigateImpactDamageLocked adapter retains the original immediate
explosion timing and unlock/relock/world-lock behavior for basic attacks/slams.
Reflection/explosion/death/party-credit processing remained intact at foundation
commitadb89195; that commit alone was not wired into hostile skill consumers.

Three new unit cases verify captured explosion survives later recast/movement,
reflection is returned without being applied under the receiver lock, and
invulnerability consumes neither capacity nor retaliation.62735 focused race
PASS9.532s.19737 broader three-repeat racePASS26.898s also includes actual trained
Arcane Shield rune absorption/retaliation and boss-slam party-credit cases.
Logs `/tmp/eidolon-defense-split-focused.log` and
`/tmp/eidolon-defense-split-repeated.log`. These are foundation/legacy-path
acceptance, not a passing ability-shield diagnostic or full pipeline validation.

Lock audit correction: PerformAbility owns w.Mu but does NOT acquire player.Mu.
World.Update releases w.Mu before parallel actor updates; update damage callers
often use private attacker snapshots. Therefore do not assume every function
in ability_*.go has the same lock contract (Whirlwind ticks are a counterexample),
apply reflected damage to a snapshot, or look up a live attacker under a new
world lock while holding a target lock. Immediate-cast reactions should be
flushed after handler state/cooldown bookkeeping so a reflected caster death
cannot be overwritten by the rest of that cast. Background/parallel impacts
need explicit equivalent ownership and reaction boundaries. A bare mechanical
replacement of the outgoing helper is not sufficient.

Required before claiming complete combat/talent/rune acceptance for1.1. This
isolated investigation extends825f9b0c, not domain61 or the narrow gameplay
successor. It does not claim full pipeline/native balance or a completed gate.

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
Historical red reproduction onff2134af/adb89195:

```sh
cd server
GOMAXPROCS=2 go test -race -p 1 -tags qa_diagnostics ./internal/game \
  -run '^TestDiagnosticPaidHostileAbilitiesRespectArcaneShield$' -count=1
```

The diagnostic was deliberately red and opt-in on those commits. The immediate
repair above promotes it to ordinary regression coverage. Passing these tests
is NOT evidence that the remaining full-pipeline gate is closed.

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
