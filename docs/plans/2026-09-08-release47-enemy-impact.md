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

Full backport server race33511 now passes all packages (root16.790s/game291.657s)
on8f4c452. Handle closed; no source changes during the check. Actual47 collection
remains required, and publication still waits for45 then46 to clear live gates.

Merge d2a8c98 inherits final46/b2016ef with no runtime changes from871926a.
Focused78711 passes240tests/1.934s and full lint. Actual25621 FAILED3.2m at2/8
fragments with zero deaths,200/200HP and11/160mana. It stopped because no clear
ground click existed among three retreat projections; the movement diagnostic
had zero attempts and zero displacement. Scan2sanitizations and cleanup/independent
container absence passed. Failure image viewed and retained at
`/tmp/eidolon-release47-impact-evidence-81jLNQ/failed-collection.png`.

The driver now distinguishes unissued movement (no clear ground) from an issued
click/key that failed to move. Only unissued movement falls back to ordinary
combat, counted separately as blockedRetreats, never as a successful retreat.
Issued pointer/keyboard failures still throw. The combat deadline, six-unit
successful-retreat assertion, quest counts and death bound remain. This is a
test-driver correction, not a collision fix or a successful collection claim.
Removed an unused requireClearPath option from this older helper call; the
planner still queries the actual collision manager. Focused58906 passes31tests/
four suites/1.327s and full lint. A corrected actual run remains required.
