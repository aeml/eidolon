# Same-moment shield absorption evidence — QA correction

Native69982 on3b83b154 failed the unchanged current-visual assertion after real
hostile absorption. Diagnostic evidence shows that the later character state had
active=false, shieldHP=0 and visual=false; subsequent ordinary attacks had reduced
health to1240. The test selected a historical partial wire shield, then demanded
that the already-depleted current shield still have a model. This does not prove
a missing active-shield visual. Preserve the actual failed result and archive
`/tmp/eidolon-shield-depletion-diag-meCvyW` (scan0/exact cleanup).

The correction observes AFTER normal message delivery. It records partial
absorption only when the owner wire state and current character agree on a
positive, reduced shield value, the living character has an active shield, and
the same owner's active, undisposed shield effect is attached visibly to the
actual scene with no hidden ancestor. The sample is retained immutably when
subsequent attacks consume the remaining shield. Original handler return values,
errors and actor state are preserved; stopping restores only the owned wrapper.

The gameplay test arms this observer after the ordinary trained cast and before
disabling the existing waypoint protection. It requires the coherent sample,
positive partial HP and exact absorbed amount. The later screenshot is named
`shield-after-hostile-hit.png`, not falsely presented as a picture of the earlier
partial shield. Paid cast/capacity, ranks, saved purchases, natural20s expiry,
zero HP/effect cleanup, real enemy approach, entrance arc and ordinary town
return assertions remain. No game state, damage, protection, timeout or rank is
changed by the observer. No production runtime fix or new player-facing patch
note is claimed for this test correction.

Focused checks cover stale/current mismatch, wrong owner, full/zero/invalid
capacity, missing/hidden/disposed/detached effects, nonliving/incomplete actors,
ordinary state/delta forwarding, later depletion, handler failure and wrapper
ownership. Initial three suites50tests passed2.633s plus full lint; final expanded
checks are recorded in `/tmp/eidolon-shield-coherent-evidence-final-unit-20260912.log`.
Actual native and refreshed full hosted acceptance remain required before
Tripwire's collateral gate can close.
