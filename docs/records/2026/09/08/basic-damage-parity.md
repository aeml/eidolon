# Basic attack damage parity — queued Alpha 1.0.54

## Versioned package

Full client12730 on8dfd9a4 **PASS225suites/3288tests/203.525s**, terminal.26852
full lint also passed. Packaged as **Alpha1.0.54 (know your strength)** with its
own patch notes, matching login/package/backend/container/deployment defaults,
and retained53 and all prior patch history. This is queued, not published;
final47 inheritance and prior46–53 verification/publication remain prerequisites.

Versioned63440 PASS244tests/two suites/4.229s plus full lint, shell syntax and
diff checks. Four additional tests now verify the actual delayed offline damage
callback for each hero rather than only the derived number; focused verification
of those tests remains due. Gameplay formulas are unchanged since8dfd9a4.

Final19848 **PASS248tests/two suites/7.152s**, including each real offline delayed
hit callback (4/6/9/11damage for the unequal-stat fixture), plus full lint/diff.
29318 PASS server health/root checks0.031s and shared game fixture0.033s.
All handles are closed. The versioned package is ready to preserve as a queued
release candidate, not to jump earlier releases or claim live gameplay approval.

## Development evidence

Separate follow-up based on queued53, not a change to the frozen47 playthrough.
Actor construction and recalculation used Strength×2 for every class. The server
instead uses integer primary-stat/4 plus flat equipment damage: Strength for
Fighter, Dexterity for Rogue, Intelligence for Wizard, Wisdom for Cleric. This
causes incorrect offline damage and local recalculation previews; a replicated
server snapshot can later replace the local result. It is not evidence that
online server damage was increased or that server progression pacing is fixed.

New shared client helper applies the existing authoritative formula only to the
four hero classes. Other actors retain Strength×2. Constructor and recalculation
use the helper; flat weapon damage is added after primary-stat scaling. No server
formula, attack cadence, regeneration, save data or reward is changed.

Initial8044 reproduced all four hero constructor mismatches (4fail/8pass).
Shared fixture checks use the same four unequal-stat/equipment cases in Go and
JavaScript;90787 Go PASS0.007s. Initial62021 could not read its fixture because
jsdom's URL object is not Node's URL; the reader now uses the repository-relative
file path. Corrected26852 PASS72tests/three suites/2.066s; full lint follows.
These focused checks cover actual hero construction/recalculation and retained
generic-actor equipment behavior. Full client regression remains required before
versioned packaging or publication. No physical-phone, combat pacing or roadmap
milestone completion claim.
