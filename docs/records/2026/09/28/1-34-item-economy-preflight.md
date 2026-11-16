# Alpha 1.34 — item economy and safe unwanted-item handling

Local partial candidate. No version bump, publication, production account
mutation or economy retune. Keep separate from the 1.30–1.33 packages.

## Changed-stack drops

A bag item can retain its ID while its quantity changes during a drag or while
the request travels to the server. The previous ID-only check could therefore
drop a different quantity from the one the player inspected.

Desktop drag captures quantity and rejects a changed stack before sending.
The drop request also includes expected quantity, checked under the existing
server inventory lock before any bag/world mutation. A fresh request still
moves the whole stack exactly once. Existing mobile confirmation and protected
quest-item rules remain. Older clients omitting quantity remain supported during
rolling deployment; their existing ID checks are not a quantity guarantee.

The two new client regressions failed before correction. Inventory, feedback
and mobile fixtures passed 33 checks in 14.82s. Scoped server drop/concurrent
checks passed (main 0.181s; game 0.698s); the added real dispatch stale/fresh
quantity check passed in 0.147s. No stale rejection consumes or creates items.

## Ground-loot lifetime

The older DropLoot/DropLootInInstance helpers set CreatedAt but omitted
LootTime, which the entity update uses for expiry. The reproduced result was
fresh loot being removed on its first update. Both now share the same creation
path and initialize both timestamps. Overworld/instance placement and normal
one-minute expiry are preserved. The failing reproduction passed after the fix;
combined lifetime/drop checks passed in 0.638s.

This is not a claim that ordinary enemy drops or current durable auction
delivery all lost items: those use separate paths. The persistent auction
delivery plans inventory/stash atomically and rejects unavailable storage.
The legacy in-memory auction overflow callers still merit review in 1.36:
two pass Y instead of Z, and all three assume overworld placement. Do not
confuse that remaining legacy-path issue with current persistent delivery.

## Existing collection/icon safeguards

All eight current authored quest-fragment names already have distinct icons;
unknown quest items have a recognizable fallback. Existing procedural icon
checks passed 24 cases in 1.001s. No replacement icon assets were needed.
Personal collection budgets, pity protection, full-bag handling, quest-item
protection and current routine equipment limits are retained, not relaxed.
Focused collection/drop-budget, Dark Realm fragment, routine elite loot and
full-inventory/master-loot pickup regressions passed in 0.997s.

## Bounded generator baseline

The existing production-generator audit sampled 10,000 items for each of four
levels and three sources: 120,000 total, passing in 0.283s. These are generated
items, not kills or earned player-session rewards. No exact random-frequency
assertion, class-usefulness claim or campaign-speed inference is made.

| Source | Approximate equipment rarity mix | Mean equipment vendor value at levels 5 / 30 / 60 / 100 |
| --- | --- | --- |
| Ordinary pool | 40% Common / 30% Uncommon / 29% Rare / 1% Legendary | 92 / 758 / 1,565 / 2,630 |
| Elite pool | 50% Uncommon / 40% Rare / 10% Legendary | 251 / 1,488 / 3,025 / 4,974 |
| Main-hand gamble | 35% Common / 30% Uncommon / 30% Rare / 5% Legendary | 172 / 1,032 / 2,063 / 3,473 |

Ordinary/elite mixed pools produced about 94–95% equipment before the actual
death-path gates. Existing ordinary equipment retention gives
0.5 × 0.6 × 36/38 = approximately 0.284 pieces per ordinary kill; elite routine
loot is capped at one equipment item. Materials and direct boss rewards use
their existing rules. These distinctions matter when interpreting bag pressure.

## Class usefulness and readable comparisons

Current affixes are not smart loot: Uncommon selects one of five attributes,
Rare selects two distinct attributes, and Legendary distributes across all five
with random primary/secondary emphasis. Thus a particular preferred attribute
has 20%/40% inclusion in Uncommon/Rare affixes, before considering base stats,
slot, level and the player's existing gear. This is a source-derived selection
probability, not the fraction of all drops that upgrades a particular character.
The 1.31 four-class prepared gear review demonstrates attainable class-aligned
rolls at 30/60/70/100, not how quickly players earn a complete matching outfit.
No class-biased loot or stat multiplier is introduced in this milestone.

Existing item/slot/comparison checks passed 77 cases in 5.445s: comparisons
include gems, lost attributes, broken set bonuses and lost special effects,
rather than implying that rarity alone makes an upgrade. Existing generator
stat/rarity/slot checks plus the final lifetime regression passed in 0.185s.
There is no new gear-stat migration or change to earned equipment.

Remaining: final package and CI/live verification. Real collection pacing, time
between bag visits and player judgments about useful loot remain playtest
questions; no long automated campaign is needed to verify a drop guard.

## September 29 integration review while 1.33 deploys

Rechecked the current desktop → client sender → dispatch → locked server path,
and the phone confirmation path. Desktop records ID and quantity at drag start;
only the actual world canvas accepts the release. Another window, Escape or
browser-external release is cancellation, not a destructive request. Phone
details already require a second deliberate tap, invalidate a replaced slot,
and require fresh confirmation if the stack changes. Both feed the same sender,
which includes the current expected quantity. The server checks it before
removing the bag entry or creating ground loot. There is no local optimistic
item deletion. Quest-prefix protection exists at UI, sender and server layers.

The existing round-trip regression preserves the whole item's ID, stats,
sockets, stack and instance; the concurrent test guards against duplicate
ground items. The new helper lifetime regression checks both scene placement
and the real expiry consumer, not merely timestamp presence. These inspected
tests cover the changes being packaged; previous passing receipts above remain
applicable because their source has not changed. No extra generic confirmation
dialog is added to the owner's deliberate desktop drag-out workflow.

Roadmap mapping: rarity/source/level and class-affix baselines above cover the
economy review; existing authored/fallback icons and comparison safeguards cover
readability; the stack guard and lifetime correction address safe unwanted-item
handling. Collection/bag-pressure pacing remains explicitly owner playtest
evidence feeding 1.39, not a reason to invent a new drop curve now. Package this
milestone only after 1.33's CI and exact public checks are accepted.
