# Fighter effect-duration consumers — server implementation stage

This extends the isolated Shield Slam training work, not the1.0.61 domain
release or the accepted general root/slow repair. Do not merge this whole branch
into a release until offline parity, descriptions, saved training and native
acceptance are reconciled. No complete160-talent or full Fighter audit claim.

## Confirmed failure

Actual paid casts at ranks0,1,5 showed fixed deadlines despite the existing
generic FTR_30(+4%/rank) and FTR_37(+3%/rank) definitions. Cases cover Iron
Fortress normal/Extended, Guardian Roar, Berserker Edge, Last Stand Rampage,
Unbreakable Grip, Juggernaut Charge, Earthshaker normal/Seismic and Shield Slam
Fortify. Rank-zero controls passed after correcting the fixture to include
InitialPlayerStats. Without those base stats the initial Fortify control dealt
zero damage and correctly earned no shield; this was not a runtime Fortify bug.

Initial56215 failure log `/tmp/eidolon-fighter-effect-duration-red.log` retained.
Corrected31256 stillfailed1.257s only on trained duration cases, log
`/tmp/eidolon-fighter-effect-duration-red-final.log`. No assertions removed.

## Implementation

These server effect deadlines now use resolveAbilityEffectDuration after the
authored rune/combo adjustment. Buff recipients inherit the caster's resolved
deadline; recipient training cannot extend it again. Earthshaker's delayed
aftershock captures its stun duration at the original cast, not from a later
changed build. Normal aftershock delay remains one second.

No mana cost, cooldown, damage budget, charge travel/CC-immunity movement lock,
Whirlwind channel/pulse scheduling, range or target-eligibility rule is changed.
Existing root/slow/stun expiry and CC immunity remain in place. Effect scaling
does not retroactively rewrite an already-running deadline after training changes.

## Evidence and remaining work

9971 focused race PASS48.348s includes the30 duration casts, the96 Shield Slam
rank/rune matrix, root/slow lifecycle and immunity, and selected dungeon
directional/self/ground-area wall checks. Log
`/tmp/eidolon-fighter-effect-duration-green.log`.

Added real party creation/join and paid support casts for Guardian Roar and
Berserker Edge. Roar uses an actual Shield Slam opener; only GCD admission time
is advanced to keep the test deterministic. Both buff forms resolve20.25s at
combinedrank5, the untrained nearby ally shares the exact caster deadline, and
distant/different-instance party members receive no buff. Later training changes
leave existing timestamps unchanged in the matrix. This is server-fixture proof,
not an earned build, actual elapsed-duration run or native party playthrough.

Still required: explicit delayed-aftershock observation, full rank/rune/combo
coverage beyond these cases, offline effect/rune parity, precise talent copy
(old flat-seconds and armor-penetration promises conflict with definitions),
saved training/reconnect, integration/full regression and gameplay balance.
The existing new-domain release and gameplay successor exclude this stage.

## Real delayed Aftershock follow-up

88288 reproduced a new interaction onbbd16285: initial trained stun2.7s was
shortened by a1.35s Aftershock landing roughly1s later. Log
`/tmp/eidolon-fighter-aftershock-duration-red.log`, failure1.352s. The same test
confirmed that a previously unaffected enemy moved into range between waves
received the original cast's trained duration even after caster ranks were
removed. This executes the actual scheduled callback and real one-second delay;
it does not invoke the impact helper directly or advance the callback clock.

Earthshaker now retains a later existing active stun deadline instead of
replacing it with a shorter deadline. CC immunity remains unchanged. A fresh
target still gets the cast's own duration; no damage/range/delay changes.

97008 three consecutive focused race runs PASS32.070s, including the real
delayed-wave test, the30-case duration matrix, party/combo deadline and exclusion
tests, and dungeon directional-wall checks. Log
`/tmp/eidolon-fighter-aftershock-duration-green.log`. The initial synchronous hit
has an explicit assertion rather than an unbounded receive; delayed receipts
have a five-second failure deadline and normal world callback cleanup.

The earlier party/duration-only run3671 also passed7.462s, log
`/tmp/eidolon-fighter-effect-party-duration.log`. Remaining offline/rune/copy,
full integration, native saved-training and balance requirements above still
apply. Explicit delayed Aftershock observation is now covered at server level,
not a claim of full native or all-rune completion.
