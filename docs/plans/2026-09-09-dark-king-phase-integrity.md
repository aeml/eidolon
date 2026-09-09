# Dark King phase integrity — separate candidate

Not part of recovery58. Based on primary4172dfa, in the separate
`work/dark-king-phase-integrity-20260909` worktree. Do not publish its inherited
1.0.57 metadata or import it into the urgent town-recovery release.

Regression38428 failed both burst cases:600 damage yielded Orun/Pyralis without
Neris;800 yielded Orun/Aeral without Neris or Pyralis. The current implementation
selected a phase solely from remaining HP and permanently skipped intervening
events and actual aid. Log `/tmp/eidolon-dark-king-phase-integrity-before.log`.

The candidate stops incoming damage at each active quarter until the next phase
is announced, including ordinary abilities, DoTs, shield/kill explosions and
reflection. Final-phase lethal damage remains normal. Event damage uses only
the amount actually applied. Already-overshot snapshots advance in order rather
than lose an Eidolon. Damage modifiers follow announced phase, and aid requires
a living connected player; it cannot revive zero-health actors incidentally.

Focused Go1.24.5 race9224 passed all `TestDarkKing` cases1.299s, including actual
damage application, both original overshoot reproductions,32 concurrent hits,
DoT event amounts, unaffected ordinary targets, eligibility and modifier timing.
Log `/tmp/eidolon-dark-king-phase-integrity-after.log`. This is not a complete
server or player-controlled raid proof. Remaining: full race regression, actual
ordinary combat/explosion/reflection paths and four-browser phase progression,
readable phase presentation under burst damage, and ordered version/notes/live
delivery with the wider campaign gate. Do not claim four meaningful, paced raid
phases solely from these isolated mechanics tests.

Full race23814 FAILED435.855s in game: the four UmbraPrime contact-only fixtures
attacked an unannounced phase0 boss without running any world update. Other
packages passed; no race warning was reported. Original full log
`/tmp/eidolon-dark-king-phase-integrity-full-race.log` retained. The fixture now
calls the production phase hook after adding its living raider and asserts phase1
before the original accepted-attack and actual-health-loss checks. No forced
RaidPhase/health assignment or reduced attack assertion; the runtime gate remains.
Focused and full repeat results must be recorded separately, not inferred here.

## September 9 actual damage-path follow-up

Contact fixture correction a5405fa passed the complete race repeat28054:
game390.582s, other packages passed/cached. Log
`/tmp/eidolon-dark-king-phase-integrity-full-race-r2.log`.

The next three tests use actual post-wind-up attack impacts to exercise reflected
damage, explosive Arcane Shield and explosive unique gear. The original run15137
deadlocked in the gear case: `handleDeath` held the corpse mutex and its nearby
explosion loop tried to lock that same corpse before checking its identity.
An explicit SIGQUIT to the verified owned test PID2209338 captured this stack;
the run exited1 and is NOT a pass. Log
`/tmp/eidolon-dark-king-actual-damage-paths.log`. This signal was diagnosis of the
established lock cycle, not cancellation of any recovery or CI test.

The fix finishes the death, temporarily releases its corpse lock to propagate
the explosion, and restores the caller's lock contract on return. Propagation
skips the corpse before acquiring any mutex, skips already dead targets, and
does not hold ancestor corpse locks during chained deaths. No extra goroutines
or lost on-kill effects are introduced. Phase damage floors and full ordinary
enemy damage remain enforced; only enemies in the captured death instance are
affected.

Initial three actual damage tests passed2.014s after the fix. Expanded focused
race19725 passed25.608s: five tests repeated20times, including three cascading
deaths, isolation from a different instance, exact one explosion per death,
and eight simultaneous killing attempts. Tests drain earned background work and
use synchronized event capture for concurrent combat. Logs
`/tmp/eidolon-dark-king-actual-damage-paths-after.log` and
`/tmp/eidolon-dark-king-explosion-chain-race.log`.

Complete Go1.24.5 race repeat51326 PASSED on clean ce6780e: root24.632s,
game354.984s, database/lifecycle/loadtest passed from cache; remaining packages
have no tests. Log `/tmp/eidolon-dark-king-explosion-full-race.log`.
None of these fixtures establishes player-controlled raid pacing, visible phase
quality, or a production release. This work remains excluded from58.
