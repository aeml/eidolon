# Wound application budgets and spreading

> Historical development evidence, imported with the receiving-defense changes.
> This document's source hashes and phase-cap results describe that development
> branch, not the narrower release64 build. See
> [release64 scope and gates](2026-09-12-release64-receiving-defenses.md) for the
> current candidate: existing release63 campaign/economy and Dark King behavior
> are retained; the separate phase-cap change remains pending.
Unreleased follow-up to9446887c explosive defenses; part of the still-open1.1
combat gate. This patch does not finish all status talents or full1.1–1.10.

## Reproduction

32560 race RED0.241s reproduced unscaled PvP wounds from real paid Shadow
Strike, Shadow Lunge, Poison Coating/basic and Poison Coating/Piercing Throw.
At100 Dexterity, raw60/58 remained60/58 instead of39/37. At10000 Dexterity,
5010/5008 bypassed the175 cap for a500-max-HP player. A paid coating applied
to a monster spread58 damage to a flagged player rather than37. Inherited
critical Serrated/Poisoned Fan controls passed without another scaling pass.
One high-Dexterity PvE projectile control killed its500-HP recipient before
poison could apply; that prepared monster now has sufficient HP to survive.

82000 race RED0.038s reproduced Magma inheriting a PvE hit then spreading an
unscaled6-point wound to a player instead of3. The reverse PvP-to-PvE control
kept its inherited4-point budget.53730 race RED0.497s reproduced paid Magma
burn through a closed canonical dungeon wall, with a valid doorway control.

## Implementation and contract

Raw wounds keep their existing training/base formulas and apply PvP scaling
and the recipient's maximum-HP cap once at application. Stored ticks still
enter receiving defenses without rereading caster stats, rerolling criticals
or rescaling outgoing damage. This preserves PvE wound amounts.

Application-local `statusDamageBudget` distinguishes raw spread damage from
damage inherited from an already PvP-scaled hit. Every spread recipient gets
its own cap; inherited player-hit budgets are not scaled65% twice and are not
amplified when spreading back to monsters. The stored entity/save representation
is unchanged. Poison spread uses the existing immutable combat snapshot rather
than an unlocked live caster for relationship checks.

Magma retains the existing attributed wound consumer but now checks canonical
dungeon cover, visible-body range, current hostility and living/connected state
while locking the recipient. It cannot create a zero-damage burn.

## Verification

-15571 three-repeat focused race PASS1.657s for raw PvE/PvP/large-budget controls,
  inherited critical wounds and actual paid coating spreading.
-3580 broader three-repeat race PASS23.801s covers Mastery/training snapshots,
  real ticks, shields/reductions/reflection, poison spread/cadence, parallel
  wounds, Dark King DoT boundaries and Magma geometry/budgets. Earlier paid
  Shadow Strike receiving tests now expect6 PvP damage before reductions rather
  than the old unscaled10; partial/20% Sanctuary/Guardian controls remain exact.
-10060 final three-repeat race PASS2.672s adds actual paid Poisoned Fan to a
  prepared second opposing seat. Spread retains the already-scaled critical
  wound; later source Dexterity/poison-bonus changes cannot magnify its tick.
  Explicit raw/inherited spread budgets verify each recipient's35%-max-HP cap.

Logs `/tmp/eidolon-wound-pvp-{red,green,broad,final}.log`,
`/tmp/eidolon-wound-spread-red.log`, `/tmp/eidolon-magma-wall-red.log`.
Full current-source server regression and merged native/save/party acceptance
remain required. These prepared mechanical cases are not full encounter balance,
earned character builds or a four-player dungeon clear.

Still-open status audit: raw-wound critical-Technique and elemental/unique/set
outgoing interactions, status duration/copy consistency, offline parity and
native feedback. Do not claim this PvP-budget fix resolves those separate gates.

## Unreleased patch-note draft

Bleed and Poison Coating now respect PvP damage scaling and limits. Spreading
poison and Magma burns use the correct budget for each target without reducing
already-scaled damage twice. Magma burns can no longer spread through dungeon
walls.

## Full server acceptance on be6d43ae

86822 completed with exit0 on unchangedbe6d43ae1c568ceb9d083369a01664195263ac84.
Full Go race passed: root22.512s, game370.317s, loadtest1.023s, database1.128s,
lifecycle1.028s; remaining packages have no tests. Log
`/tmp/eidolon-wound-pvp-full-server.log`. This closes full server regression for
this wound-budget source, not native/save/party acceptance or the remaining
status-consumer audit. These changes remain separate from the62 candidate.
