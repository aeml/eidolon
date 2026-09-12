# Fighter damage-buff Masteries — server phase, not release-ready

Based on7f781121 in a separate candidate. This is an intermediate step toward
the full1.1 core-build requirement, not sign-off on these abilities or1.1.

## Reproduced defect and intended behavior

Berserker Edge and Last Stand Rampage set active flags and recalculate Damage
with fixed multipliers1.5 and3. FTR_19/FTR_25 define4% named skill damage per
rank but never affect those buffs. Paired actual casts and the real post-wind-up
basic-impact consumer reproduce unchanged damage at trained ranks, including
Berserker's nearby party recipient. These tests do not simulate mouse input.

Make the named Mastery scale the existing buffed Damage stat by4% per rank,
up to20% relative to the untrained buff. Berserker multipliers become1.5/1.56/1.8
at ranks0/1/5; Last Stand becomes3/3.12/3.6. Preserve saved IDs, rank caps and
one-point purchases. Preserve zero mana costs, cooldown reduction,15s/10s
base durations, Berserker's defense penalty and Last Stand's below30% HP gate.
Generic skill damage remains in its hit consumer and is not applied again by
this stat buff. Existing generic duration remains independently applicable.

The paid cast stores normalized named training on a private snapshot. Later
talent changes cannot rewrite active strength. Berserker recipients inherit
caster strength and deadline, not their own Mastery. Recasting replaces the
same buff; independent buffs retain their ordinary composition order. Expiry
and purge clear stored strength. Legacy active buffs without a stored value
retain their untrained multipliers; invalid/nonfinite values fall back safely,
and an inactive stored multiplier never grants a buff. Both entity copy paths
carry the active state, strength and deadline.

## Evidence and fixture corrections

Initial test run also falsely expected unreduced cooldowns, overlooking normal
stat-derived CDR. Correct that expectation without changing game cooldowns.
Use independent integer-ratio damage expectations rather than reproducing a
chained floating calculation that truncates44.999... to44. The implementation
computes the equivalent base*(25+rank)/25 multiplier before normal damage
truncation. Untrained37.5damage still truncates to37 as before.

Corrected RED:13 trained cases fail in1.568s; untrained/malformed-negative,
admission, duration, defensive cost and ordinary impact controls pass. Initial
green passes1.834s. Expanded race checks pass20.317s with ordinary purchases,
sixth-rank rejection, cast snapshots after rank changes, party scope, copy paths,
refresh/overlap, legacy bounds and adjacent duration/Roar tests. The added purge
test initially used an uninitialized zero-stat Cleric, so its positive damage
control correctly failed (complete log,22.350s). Initialize real base stats and
Wisdom before rerunning; do not remove the hit assertion or alter purge damage.
The final race run passes22.001s, including that paid purge and healthy-character
rejection, with the same adjacent duration, party, copy and refresh controls.
Logs:

- `/tmp/eidolon-fighter-damage-buff-mastery-server-red-20260912.log`
- `/tmp/eidolon-fighter-damage-buff-mastery-server-red-corrected-20260912.log`
- `/tmp/eidolon-fighter-damage-buff-mastery-server-green-20260912.log`
- `/tmp/eidolon-fighter-damage-buff-mastery-server-final-20260912.log`
- `/tmp/eidolon-fighter-damage-buff-mastery-server-complete-20260912.log`
- `/tmp/eidolon-fighter-damage-buff-mastery-server-accepted-20260912.log`

## Required next phase — do not publish this server-only candidate

Carry stored strength through explicit wire/state/delta fields and accurate
client buff presentation, with scalar-only packet safety and legacy fallback.
Update descriptions to distinguish the Damage stat from every spell's entire
damage formula. Repair the actual offline stat/attack consumers and remove
legacy Whirlwind-only special cases that would double-apply bonuses. Source
inspection found that offline Berserker still uses a30% Whirlwind-only bonus
above60%HP, unlike the authoritative buff; reconcile that deliberately with
the intended ability description rather than silently claiming parity.

Verify real purchases, fresh saved login, party receivers, ability/basic damage,
defensive cost, health gating, duration, rejection, dispel, death/scene cleanup,
copy/wire/client display and native rendered lifecycle. Run full combined
regression, measured balance and the versioned release process with patch notes.
Production65 retains its own frozen source/GPU checks. Actual four-party dungeon
clear, earned progression, remaining talents and all1.2–1.10 work remain open.
