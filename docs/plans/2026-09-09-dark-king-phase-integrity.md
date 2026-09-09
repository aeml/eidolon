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
