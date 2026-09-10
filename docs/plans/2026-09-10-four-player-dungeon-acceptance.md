# Four-player dungeon acceptance

The user requested party-based dungeon verification: Fighter tank, Cleric healer,
Wizard and Rogue DPS. A solo clear is no longer the primary viability gate.
The preceding solo story attempt was intentionally interrupted, not failed in
combat; its archive is `/tmp/eidolon-solo-party-pivot-GVgwK4`.

The explicit isolated `party-dungeon` route uses four independent browser
processes, ordinary account registration and guarded empty-account fixtures.
All are level30, with production-generated Common level30 equipment, canonical
unallocated base stats, a legal specialization and five ranks of primary mastery.
The Earth dungeon quest is prepared from the recorded story-gate fixture. No
claim is made that these characters earned their preparation. No invulnerability,
in-run grants, health overrides, boss kills or inside waypoints are permitted.
Natural town recovery/Well Rested before entry remains enabled.

The party forms through visible invitations. The Fighter leads normal ground
traversal and attacks; the healer targets injured allies with Healing Light;
both damage classes use actual target clicks and primary abilities. The existing
eight-minute encounter, sixty-second damage-stall and forty-minute expedition
limits remain. Check all four bosses, all rooms, each member's quest/rewards,
effective ally healing, damage receipts, and ordinary Recall/re-entry continuity.
First-pass failures must distinguish fixture/controller defects from game bugs
and actual party balance. Common-only gear is a conservative baseline, not a
claim that this is the optimal or required player build.

Pending: native execution, controller validation, full-clear result, individual
manual turn-in/relogin proof and an earned four-player campaign. This adds no
production gameplay change and is not a release/deployment receipt.

## First native run — informative failure, not a clear

Session20718 TERMINAL1 on080a363b, about5.6minutes. All four level30 clients
formed a party and entered the same generated run (seed-7981223469871274837).
The opening normal/elite rooms cleared and the Warden was attackable, reduced
from15000 to10932HP before the Fighter died. Recorded totals: Fighter5544damage
and2498damage taken; Cleric1634effective ally healing/13Healing Light casts;
Wizard3344damage/21Fireballs; Rogue5116damage/43Piercing Throws. All received471
Gold. No rejected casts. The helper's subsequent ordinary respawn means final
Fighter940HP/610MP are town values, not survival evidence.

Archive `/tmp/eidolon-four-role-first-proof-ve8uzL` contains report/results/log;
wrapper credential scan0 and copied-log remaining QA prefixes0. Owned services
and18580/18581/41980listeners were absent afterward. No later boss/quest claim.

The first controller omitted party town recovery and only used direct Healing
Light. At Warden entry the Fighter had168/555mana, subsequently falling to6.
The next controller uses ordinary whole-party Recall/rest/re-entry after a
cleared room when anyone is below80%HP/MP, checks each member's unchanged
instance/seed/rooms/inventory/Gold/quests, and rewalks the entrance route. It also
uses legal Guardian Embrace healing aura within its range, preserving critical
direct-heal priority, and latches deaths before automatic cleanup can hide them.
These are player-input strategy corrections; no balance or fixture buffs.

Second native18143 TERMINAL1 onf6fcddef: opening room cleared, no deaths,
Cleric666effective ally healing from Healing Light and Guardian Embrace, no
rejected casts. Town recovery worked, but the driver incorrectly expected a
resume request to transfer all four players. Production `dungeon_entry.go`
explicitly resumes only the requester; initial creation moves the group. Fix
the driver to use the guide for every remaining member, preserving the strict
same-run/content checks. Archive `/tmp/eidolon-four-role-rest-proof-HtoFTA`;
wrapper sanitized2files, copied-log scanner sanitized1file, zero remaining
QA prefixes; owned services/listeners removed. This is not a game entry defect.
