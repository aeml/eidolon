# Fighter damage-buff Masteries — server, network and offline stat phases, not release-ready

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

## Network and display phase

Added stable protobuf fields121/122 for stored Berserker/Last Stand multipliers,
generated with the existing pinned local tooling. Full snapshots, binary wire
and scalar-only delta detection preserve active strength. Inactive buffs publish
zero without spurious deltas. Client owner and remote support paths consume
those values without private rank inference or multiplying gameplay stats again.
Partial duration updates retain strength; scalar-only packets cannot activate
a buff. Legacy active packets use baseline strength, malformed values fall back
safely, and authoritative removal resets strength. Berserker now has a tracked
buff card; both cards explicitly identify the Damage stat, with Berserker's
unchanged20% defense penalty.

Client RED12failed2.076s; initial server reflection test mistakenly inspected
a snapshot pointer as a struct, so that panic is fixture evidence only. After
dereferencing, all6 missing-field cases fail0.007s on unchanged serialization.
Final client6suites/144tests PASS2.826s, including actual protobuf delivery to
both support paths, private-rank independence, delta-like updates, legacy/malformed
values and no duplicate stat scaling. Server wire/snapshot/delta/Focus regression
race PASS1.358s. Full lint, generated bindings and whitespace checks pass.
Logs `/tmp/eidolon-fighter-buff-wire-{client-red,server-red,server-red-corrected,client-green,client-final,server-green,generate,lint}-20260912.log`.

## Offline stat, recipient and lifecycle phase

Actual offline casts now snapshot named strength, rebuild Damage/defense in
server order, and retain the captured strength across later talent edits.
Berserker has no health gate and shares only with explicit same-party, living,
same-instance nearby hero actors (15m plus recipient radius). Offline mode does
not create a party or treat every friendly NPC as a party member. Last Stand
retains its below30% activation gate. Runtime stats are not multiplied on online
owners/remotes. Description text now identifies Damage stat, defense cost and
activation rather than claiming a passive above60%-HP Whirlwind-only bonus.

Timer expiry runs on every Actor, including non-Fighter recipients. Expiry,
death, Fighter cancellation and actual Radiant Strike purge clear strength and
rebuild stats. Purge preserves independent Last Stand. Whirlwind now advances
normal Actor timers instead of pausing buffs/cooldowns during its spin; old
Whirlwind-only extra buff multiplications were removed.

First RED used an invalid lowercase armor type and failed16 cases at the
fixture's defense assertion; correct it to ordinary ARMOR without changing
equipment admission. Corrected RED13failed/3passed0.892s. First green exposed
six existing duration fixtures that overrode mana/maxMana without sufficient
base Intelligence; actual stat recalculation correctly clamped them. Give those
fixtures20 Intelligence and recalculate before casting, retaining200-mana and
unchanged-cost assertions. Expanded4suites99passed3.509s. Final focused6suites
142passed3.7s plus full lint/diff pass. Tests include actual delayed basic impact,
Executioner Spin's Damage-plus-Strength formula with generic training once,
real purge, snapshot/refresh/overlap/expiry/death, party exclusions, rejected
casts, malformed ranks, online authority isolation and timer progress in a spin.
Logs `/tmp/eidolon-fighter-buff-offline-{red,red-corrected,green,expanded,lint,final-focused}-20260912.log`.

## Required next phase — do not publish this partial candidate

The follow-on [Whirlwind consumer](2026-09-12-offline-whirlwind.md) now implements
the actual cast-budget/pulse/rune/target/wall/lifecycle counterpart of the server,
with focused real-cast tests. Its broader acceptance is still pending. Do not
infer all-ability parity from stat/basic/Spin or narrow Whirlwind tests. Remaining
scene/save/native and combined regression are still required.

Verify real purchases, fresh saved login, party receivers, ability/basic damage,
defensive cost, health gating, duration, rejection, dispel, death/scene cleanup,
copy/wire/client display and native rendered lifecycle. Run full combined
regression, measured balance and the versioned release process with patch notes.
Production65 retains its own frozen source/GPU checks. Actual four-party dungeon
clear, earned progression, remaining talents and all1.2–1.10 work remain open.
