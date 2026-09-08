# Basic attack damage parity — unversioned candidate

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
