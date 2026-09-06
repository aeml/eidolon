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
- The old early return for unrelated inventory-count growth is removed. A
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
Publish a successor of 1.0.21 and
repeat its entire live gate before marking this release verified or pushing
1.0.22. Carry the correction forward through the existing queued ancestry.
