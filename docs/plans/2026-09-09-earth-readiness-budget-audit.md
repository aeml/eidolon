# Expanded Earth handoff budget diagnostic

This unpublished primary-story audit is separate from town recovery58. It uses
the actual catalog, combat budget, party split, Well Rested kill multiplier and
level-up/quest-payout functions. It is not a combat win, drop simulation, rest
uptime measurement or approval of current pacing.

Go1.24.5 race test `TestChronicleEarthReadinessBudgetAudit` passed all12 scenarios
in3.348s. Log `/tmp/eidolon-primary-earth-budget-audit.log`. Seven pre-dungeon
chapters pay25,979XP/800gold; the unavailable dungeon completion reward is
excluded. Inputs are three tutorial kills, the150 authored hunt kills at their
minimum eligible levels, and either8 or20 level-three collection kills. Eight
is best possible luck;20 is a scenario near the separately observed drop-audit
mean, not a promise. Incidental investigation/travel combat is omitted.

| Party size | Rest on kills | Level at handoff | XP shortfall to30, 8 / 20 collection kills |
|---|---|---|---|
|1|None|29|8,461 / 8,221|
|1|Every kill|31|0 / 0|
|2|None|25|73,007 / 72,863|
|2|Every kill|27|48,900 / 48,720|
|5|None|22|121,444 / 121,372|
|5|Every kill|23|109,416 / 109,332|

These bounds expose a handoff risk: the authored objectives alone do not ensure
level30, especially with normal shared party combat XP. Actual extra encounters
can change the result; the audit does not establish how much a human route earns
or how fast parties fight. Full earned Earth routes remain required, without
optional dailies or grants inserted to conceal a shortfall. Record rest uptime,
party eligibility and incidental kill income alongside those routes before
choosing coordinated reward/progression changes. Do not change live58 rewards
or raise collection requirements again on the strength of this diagnostic.
