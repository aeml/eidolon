# Earned preparation includes actual stored upgrades

Status: implemented in the earned QA route; focused/full client checks and three
native equipment repetitions passed. A new real earned campaign is still needed
to measure its effect. No game balance, grants, version or deployment changed.

## Gap and scope

The original earned run stored four spare items at levels26/28/29, but later
preparation considered only carried inventory. The archive does not reconstruct
those stored items' full stats, so their usefulness and contribution to the
failed Warden fight remain unknown. Do not invent their stats or grant them to
the historical recorded-build fixture.

The route now opens the real town stash, records its full observed contents and
uses the existing conservative class-weighted comparison to find strictly better,
eligible stored equipment. Carried upgrades are considered first. Quest items,
future-level gear, ties, unknown set/unique mechanics and unsupported item data
are not guessed at or discarded. This is a QA preference, not a new game scoring
rule or a claim of an optimal build.

Withdrawals use ordinary stash right-clicks, followed by actual bag-to-equipment
drags. Each transfer and equip verifies the complete item multiset across bag,
stash and equipment, plus unchanged Gold, XP, level and class. Paired slots target
the weaker item; compacted indices are re-read after every operation. The fixed
iteration bound is the initial stored-item count. A full bag fails explicitly
before withdrawal, rather than granting capacity, dropping gear or silently
starting an incomplete preparation. Existing ordinary bag management remains
responsible for space; the native fixture demonstrates a preserved deposit to
make room. Automatic disposal and invented upgrade materials are not introduced.

This step runs during recurring class preparation and immediately before the
earned dungeon-entry receipt. It does not change phase/encounter/stall budgets,
restore passive regeneration, grant points or bypass manual quests.

## Verification and real failure

- e2822138 implements policy, UI route, integration and native fixture extension.
  51250 PASS76tests/5suites1.331s plus lint. Units cover paired slots, unknown/
  future data, full bags, multiple withdrawals after index compaction, rejected
  or lossy operations, resource drift and stopping entry on preparation failure.
- 73389 TERMINAL1: all three native repetitions failed because the old stash
  approach immediately required the NPC after login, before its world-stream
  delivery. First repetition had already completed withdrawal/equip, failing on
  the final relogin; the others hit the same timing gap earlier. Archive
  `/tmp/eidolon-stored-upgrades-failure-DP52CV` retains all failures. Actual wrapper
  scan0; copied native log additionally sanitized with the existing scanner
  (one file changed). Exact owned services were absent afterward.
- 72300 RED2tests/.670s reproduces missing/delayed NPC handling. bf88aac7 adds
  a bounded10second wait for the real replicated stash before the existing
  movement/interaction logic. No synthetic NPC, arbitrary sleep, renewed travel
  budget or inventory-assertion relaxation.54223 PASS78tests/6suites1.390s+lint.
- 51782 TERMINAL0 on clean bf88aac7: three repetitions25.3s/29.9s/29.8s,
  1.5minutes total, zero retries. Real full-bag rejection, ordinary deposit to
  make room, stored-ring withdrawal, weaker-slot equip, exact ownership/resources
  and relogin all pass. This explicitly seeded level1 interface fixture is not
  earned acquisition, a level30 build or a dungeon-clear result.
- Archive `/tmp/eidolon-stored-upgrades-proof-djIiIl` retains available reports,
  screenshots and native/focused/full-client/lint logs. Actual wrapper scan0;
  copied native log additionally sanitized (one file changed). Exact containers
  and image for`stored-ready-0910` and18580/18581/41980listeners are absent after
  normal cleanup.
- 44075 TERMINAL0 on the same clean tip:308suites/4251tests144.768s plus lint
  underNode24.18.0. Server source diff versus aeff8ab5 is empty; the prior full
  Go race evidence remains applicable to that unchanged code, not a new Go run.

## Next actual acceptance

Run the strict fresh Wizard Earth-to-dungeon route with these ordinary actions
and complete entry receipts. Retain the actual stored/bag/equipped items, any
withdrawals, seed, resources, combat outcome and manual reward/save/Water handoff.
Do not assume a useful stored item will exist, call this an improvement in boss
damage before measuring it, or treat seeded UI fixture success as earned progress.
If bag capacity blocks a useful withdrawal, preserve that evidence and resolve
it through normal inventory/stash management, not item loss or larger capacity.
All-class/party/later-dungeon/raid and broader roadmap acceptance remain open.
