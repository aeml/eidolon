# Earthshaker damage training — 1.1.0 candidate

Earthshaker's FTR_13 Mastery promises 4% damage per rank, but the server and
offline paid cast ignored it and the generic FTR_38 damage bonus. The base quake
and all three runes used Damage + 2 × Strength without their training multiplier.

## Reproduction and correction

Real paid-cast server tests reproduce 70 damage at trained ranks where 72–91
is required; actual delayed Aftershock remains 35 instead of 45 at full damage
training. Untrained controls retain 70. The server RED run took 2.190 seconds.
Client RED: 22 failures, 16 passes in 1.235 seconds, including real paid casts
and scheduled Aftershock. These failures are not inferred from talent metadata.

Server casts now snapshot read-only normalized damage training, then floor the
trained base once. Offline casts use the existing Fighter damage consumer.
Aftershock retains half that original trained budget, even when the caster's
build and Damage/Strength change during the delay. Ordinary critical and target
damage processing stay at each existing impact boundary. Named/generic damage
bonuses are additive as already defined; ranks do not compound multiplicatively.

Keep mana 40, base cooldown 12 seconds with normal CDR, all rune shapes and
stun durations, wall checks, threat, and Aftershock cancellation rules. No new
damage formula, talent price, rank cap, or ordinary 1.0.x release is introduced.

## Evidence and remaining work

Final focused client: seven suites, 241 tests pass in 3.302 seconds; full lint
passes. Coverage includes rank 0/1/5 × generic 0/5 × all runes, immutable rank
caps and foreign IDs, one critical, resource/cooldown/authority rejection,
one paid Aftershock budget, and existing Charge/Whirlwind/cone/stun regressions.
An initial command named nonexistent ChargeEffectDuration.test.js; only four
suites ran then. The final command uses actual OfflineCharge and
OfflineShatteringCharge suites. Do not treat the missing name as coverage.

Server initial focused race passed in 18.559 seconds. Expanded final race passes
in 35.033 seconds, adding trained critical/wall pairs and existing
Charge/Seismic-stun interactions. Tests also perform ordinary
one-point Mastery purchases and reject the sixth rank without spending points.

Logs `/tmp/eidolon-earthshaker-damage-{server-red,server-green,server-final,client-red,client-green,client-final,lint}-20260912.log`.

Full hosted regression, native purchased-damage demonstrations and deployment
remain pending. This does NOT fix Earthshaker's remaining area training or
presentation: circle/Aftershock radii remain 6/3.5, Fissure width remains 1.5,
accepted casts still lack their resolved shape, and Fissure needs a faithful
line footprint instead of a circular presentation. Resolve and verify these
together before calling Earthshaker or the 160-talent audit complete. Four-role
dungeon/earned progression and all later milestones remain open.

Proposed 1.1.0 patch note: “Earthshaker and Aftershock now honor Mastery and
generic damage training while preserving their original cast's damage budget.”
