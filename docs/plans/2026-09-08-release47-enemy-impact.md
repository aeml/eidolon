# Release47 enemy melee impact correction — not released

Backport the independently reproducible impact defect from isolated aa905ae,
without its parent basic-attack cadence experiment or expanded story chapters.
Admission already checked attack distance; delayed enemy melee did not. A fresh
actual-impact regression failed four escaped-target cases before the fix,
including a Skeleton damaging a target15units away after wind-up.

The correction shares the existing reach calculation between admission and
enemy impact, retaining large-body adjustments and DwarfSalesman's longer reach.
Player attacks, projectile abilities and separate boss telegraphs are unchanged.
No enemy stat, player cadence, passive regeneration, quest or reward changes.
The existing47 login version and collection patch notes remain, with a new
player-facing entry describing evading an enemy swing.

Source and new tests exactly match aa905ae, whose full server race passes
(root18.490s/game417.772s/all packages). That evidence is for the expanded
candidate, not this backport's integration. Focused backport regressions, full
server integration and actual47 collection play remain required. The separate
uninterrupted browser18050 uses the expanded candidate and cannot establish
this47 candidate's collection pacing.

Focused backport checks pass: server race10861/9.881s and client66704,
226tests/two suites/4.555s (version/patch-note presentation and regeneration).
Diff checks pass. Full server integration and actual collection remain open.
