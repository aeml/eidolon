# Charge landing-effect duration follow-up

This extends isolated Fighter training7c11bc4d, not the queued domain release
or accepted narrow gameplay successor. Full Fighter/native/save/rune acceptance
is still open. No1.1 or later roadmap milestone is closed by these checks.

## Paid cast, travel and impact evidence

94371 failed8.468s: trained Unstoppable armor, Shattering armor reduction and
Tremor knockdown still used fixed5s/5s/2s deadlines. Each case uses actual
PerformAbility, a partial World.Update followed by the landing update, verifies
mana expenditure and impact damage, and tests both unchanged training and
training removed during travel. Tremor uses an actual paid Earthshaker opener;
only GCD admission is advanced. The target starts beyond the opener's radius.

The broad World.Update bracket could hide a rank-one2.14s-vs2s error because
world generation takes time. Added observation of the specific damage dispatch:
53503 failed8.859s, all12 trained cases failed while6 rank-zero controls passed.
The receipt brackets remaining duration within50ms; it is not just a test of a
timer helper or a manually assigned charge/combo state. Logs:
`/tmp/eidolon-charge-duration-red.log`,
`/tmp/eidolon-charge-duration-red-receipts.log`.

## Repair and follow-up

Accepted casts capture the existing generic duration bonus in a non-replicated
ChargeEffectDurationBonus field. Landing uses that captured value for its armor
buff/break and Tremor knockdown. It is cleared after impact, scene movement reset
and the existing near-death QA reset. The common scaling helper retains the
existing nonnegative bonus and nanosecond-rounding rules. No mana, damage, range,
cooldown, travel speed or temporary movement-immunity duration is changed.

52238 passed three consecutive18-case runs under race detection,30.366s.
`/tmp/eidolon-charge-duration-green.log`.

15600 then found a real overlap bug: a paid Seismic Earthshaker->Charge combo
shortened the stronger initial stun. Immunity and actual Recall snapshot cleanup
controls passed. The landing now retains a stronger active stun. Red1.109s:
`/tmp/eidolon-charge-duration-overlap-red.log`.

69092 focused race passed22.297s: duration matrix, Seismic overlap, immune-target
damage without control, snapshot cleanup through actual Recall, existing Charge
cost/range/event/movement admission, shockwave, dungeon movement walls, town/
instance movement reset, and prior Fighter effect/party-duration tests.
`/tmp/eidolon-charge-duration-final-focused.log`.

The full client/lint/server run49648 is on the preceding7c11bc4d source and
cannot prove these new Go changes. Full merged regression, offline Charge/rune/
combo parity, saved training and native balance/party acceptance remain required.
