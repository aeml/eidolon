# West-side stash approach correction

Local correction for the next release; live1.9.24 delivery remains accepted,
but this connected failure reopens the stash approach path.

Water continuation `earnedwaterregion0920b` ended exit1 after48.8s, before combat:
`#stash-screen` stayed hidden. The retained screen says “Stash • Move closer”.
Independent archive restore confirms the player stopped at
(-21.25407219637283,193.09997818974443),6.747m from the coffer at(-28,193), beyond
its existing5m interaction range. Level61/21946XP/51012Gold and25/70 Golem credit
are unchanged. Owned services and the isolated archive-inspection copy are gone.

The normal initial click and per-frame chase both targeted the chest centre,
cutting across the rotated Trading House. The QA driver also aimed at that
centre and exhausted16 short strides without asserting arrival. This is not a
reason to remove building collision, enlarge interaction range or relocate the
stash back in front of the casino door.

Both game approach paths now share the coffer's exposed front point: three
units along its local positiveZ face, with facing and player height preserved.
Other targets retain their centre approach. Canonical collision sampling from
town spawn proves the direct centre path intersects, while the new path clears
the actual house, coffer, casino facade and a full-size nearby quest NPC. The
earned driver uses the same exposed face, waits substantial ordinary strides
and asserts arrival before clicking instead of silently exhausting its budget.

90 focused collision, stash readiness, combat callout and attack-range tests
pass1.907s; changed-file lint, shell syntax and whitespace checks pass. Initial
fixture-only failure was its missing hostility predicate, corrected in the
fixture without changing gameplay. A bounded native desktop/portrait/landscape
check is prepared: one actual click/tap from outside interaction range, normal
automatic approach, visible storage, close, no grants or direct UI toggles.
This connected check has not passed yet. Phone joystick travel only brings the
west-side chest on screen; it is not counted as a physical-phone user result.
