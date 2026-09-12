# Periodic and summon receiving defenses

> Historical development evidence, imported with the receiving-defense changes.
> This document's source hashes and phase-cap results describe that development
> branch, not the narrower release64 build. See
> [release64 scope and gates](2026-09-12-release64-receiving-defenses.md) for the
> current candidate: existing release63 campaign/economy and Dark King behavior
> are retained; the separate phase-cap change remains pending.

Extendsf3068a2b in the isolated periodic-defense worktree. These are local
combat repairs for the still-open1.1 gate, not domain61 or a published release.
The complete1.1–1.10 roadmap and native/save/balance gates remain mandatory.

## Confirmed failures and repairs

12112 failed race0.058s on actual paid casts. Shielded Whirlwind, Charge,
Shattering Charge and Avenging Seraph damaged HP while leaving600 capacity
unchanged. Their unshielded controls passed. Spirit Guardians ignored the
valid duel opponent in both cases. Two reflected-Whirlwind death tests also
failed because no receiving/reflection processing occurred.

Charge landing and Spirit Guardians now have a per-update world-unlocked
context, flushed after player bookkeeping/actor unlocks. Spirit hostility uses
the caster's captured party identity and ordinary consent/safe-zone rules.
Seraph retains owner stats and kill credit, but its dedicated retaliation actor
is the visible summon: reflected damage damages/kills that NPC, not the owner's
private stat snapshot or the distant Cleric. Ordinary summon-death cleanup is
tested. This actor/owner distinction is intentional, matching its event source.

The first Whirlwind pulse shares PerformAbility's world-locked cast context,
so a reflected death cannot be overwritten by the later cast state update.
Subsequent pulses use a fresh context and flush at each actor-unlocked pulse
boundary; lethal reflection cancels remaining catch-up pulses. Existing budget,
cadence, wall checks, pull/heal rune behavior and death-credit handling remain.
Standalone beginWhirlwind helpers use an unlocked context, while production
explicitly passes its cast context. An initial compile-only failure exposed
the existing standalone test callers; no passing test claim covers that attempt.

54572 focused race passed1.074s.10920 then reproduced a second actual update
failure: Renewal restored100HP after the same frame's Whirlwind reflection had
set DEAD. Charge and summon lethal-reflection controls passed. Player updates
now stop when already dead, after lethal Whirlwind retaliation and after lethal
DoT processing, before continuing healing or other periodic abilities.

## Acceptance and remaining scope

14943 broad three-repeat run failed90.969s only on the old Spirit healing test
expecting a valid hostile opponent to take no damage. Its corrected expectation
requires the actual13-point PvP pulse AND no ally set heal (HP100→87); a new
invulnerable opponent remains unchanged, alongside dead/other-instance controls.
This preserves and strengthens protection/healing assertions while accepting
the explicitly repaired PvP damage behavior, not a weakened safety assertion.

94415 three-repeat focused racePASS1.719s.92300 final broader racePASS27.886s,
including actual paid periodic casts, initial/later/catch-up Whirlwind deaths,
same-frame/next-update corpse healing, Charge landing death, summon reflection
and removal, existing Charge durations, Whirlwind budgets/concurrency/credits,
Spirit healing/area/walls and Seraph lifecycle. Logs:

- `/tmp/eidolon-periodic-defense-red.log`
- `/tmp/eidolon-periodic-defense-green.log`
- `/tmp/eidolon-periodic-defense-death-red.log`
- `/tmp/eidolon-periodic-defense-{broad,focused-final,broad-final}.log`

Full current-source server regression is still required; preceding34593 covers
f3068a2b only. Native four-role encounters, actual shield/aura feedback, saved
builds, DoT receiving defenses and inherited budgets, shield expiry, basic-hit
ordering, all thorns/set retaliation consumers and explosive PvP hostility stay
open. Do not claim complete combat/talent acceptance from this family pass.

Unreleased patch-note draft: Charge, Whirlwind, Spirit Guardians and Seraph hits
respect defensive shields. Spirit Guardians affects valid PvP opponents without
healing them. Reflected damage hits the real attacking character or summon;
dead characters stop later spin pulses and no longer receive same-frame Renewal
healing. Publish only with the eventual accepted version and live verification.
