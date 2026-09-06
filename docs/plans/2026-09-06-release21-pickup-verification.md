# Alpha 1.0.21 — item-specific pickup verification

Original candidate `c76db477fb070fe15a7d665ec3cc41f0b0feb916` passed client,
server, browser and predeploy gameplay checks, then both deployments. CI
`34051295918` failed final live gameplay: both attempts expected occupied bag
slots to increase beyond 24 and timed out at 24. Seven other live routes passed,
including the first two Verdant bosses. This is deployed but not fully verified;
do not advance 1.0.22 ahead of the corrected successor's full gate.

The inventory limit is 25. The old evidence does **not** establish a full bag,
an inventory-loss bug, or which entity was hit by the failed click. Failure log:
`/tmp/eidolon-1-0-21-live-failure.log`; downloaded sanitized evidence:
`/tmp/eidolon-release21-live-evidence-N0062e`.

## Verification corrections

- A stack merge can leave occupied slots unchanged. The test now requires the
  selected item's quantity to increase: equipment by exact item ID, stackable
  items by name, matching the server's stacking rule.
- The pointer must actually acquire the intended loot hitbox before clicking;
  projecting its ground position alone does not prove what a click will hit.
- Reload must retain that exact equipment or the received stack quantity, not
  merely a minimum total occupied-slot count.
- The old early return for unrelated inventory-count growth is removed. Early
  pickups instead require a recorded real pickup request and an increase in that
  requested item's quantity. The passive recorder forwards messages unchanged
  and excludes auto-loot. A
  failed pickup reports capacity, occupied slots, pointer target classification,
  drop existence/stack, distance and player state without account credentials.

No combat priority, inventory capacity, player items, XP, progression or server
rules are changed by this patch. The existing 1.0.21 player-facing Settings patch
notes and version remain accurate. These corrections strengthen release evidence;
they do not retroactively prove the precise cause of the original live failure.

## Local evidence

Five receipt regressions cover a merge at 24 occupied slots, exact equipment
identity, unrelated/unchanged inventory rejection, split-stack persistence and
partial-stack pickup. Combined with existing helper regressions: **11 tests in
two suites passed in 2.811 seconds**, and lint passed.

The real isolated extended route passed in **37.2 seconds** (34.7-second body):
ability/basic combat, actual pointer acquisition and manual pickup, dungeon
entry/exit, reconnect and item-specific persistence. Credential scan and
disposable cleanup passed. Source was `c76db47` plus these QA changes; log
`/tmp/eidolon-release21-pickup-extended.log`, session `30093` closed. This is a
fresh functional QA account, not a replay of the persistent production bag.

The complete client suite passed **163 suites / 2,351 tests in 90.19 seconds**;
log `/tmp/eidolon-release21-pickup-client.log`, session `21529` closed.
The exact `fbb3d6a` repeat then failed: a combat click had already collected the
only drop (one occupied slot, auto-loot disabled, no remaining LootDrop). Log
`/tmp/eidolon-release21-pickup-exact.log`, session `40504` closed, credential scan
passed. The request recorder above addresses this early-pickup case without
restoring acceptance of unrelated bag growth. The corrected observer route
**passed in 28.7 seconds** (27.1-second body), including item-specific saved
quantity. Credential scan and disposable cleanup passed; log
`/tmp/eidolon-release21-pickup-observed.log`, session `80816` closed. Lint and all
11 focused receipt/helper tests passed again (1.208 seconds). The full 2,351-test
suite predates this observer addition. Pickup success now logs only early/manual
classification, stackability and before/after quantity, not account/item IDs.
Publish a successor of 1.0.21 and
repeat its entire live gate before marking this release verified or pushing
1.0.22. Carry the correction forward through the existing queued ancestry.

## Final candidate and publication

Clean **`9f587570313d2f78aa469f21bd73bf8db1dd50ab`** passed the complete client
suite again: **163 suites / 2,351 tests in 73.794 seconds**, plus lint. The
exact-source real extended route passed in **29.5 seconds** (27.6-second body).
Its recorded early manual pickup matched non-stackable equipment quantity 0 → 1;
the received item survived dungeon return, reconnect and fresh login. Credential
scan and disposable cleanup passed. Logs `/tmp/eidolon-release21-pickup-final.log`
and `/tmp/eidolon-release21-pickup-final-client.log`; sessions `84554`, `36573`
closed. These final results include the passive request observer.

This successor was pushed to `master`; CI **`34055526018` passed every job**,
including final live persistent-character, four-class and remote-animation QA.
Fresh post-terminal uncached checks at **September 6, 20:32:20 UTC** matched the
frontend manifest, login label, main script release query and backend health to
`9f587570313d2f78aa469f21bd73bf8db1dd50ab` / Alpha 1.0.21. Health reported status
`ok`, database `ready`. This verified 1.0.21 before publishing the next release;
current publication status is maintained in the [execution ledger](2026-09-05-roadmap-execution.md).

The old `c76db47` failure remains recorded; its matching health alone never
established passing gameplay. After the corrected successor's complete gate,
the next 1.0.22 commit `e0b9afd3f8cfcefdbd056ef0339cb7937c27c4e7` was fast-forward
pushed to `master`. CI `34058325420` subsequently passed, with post-terminal
matching identities recorded at September 6, 21:26:23 UTC. Only then was 1.0.23
`ad72a64` pushed; its CI is `34061096121`. No version skipped its predecessor's gate.
