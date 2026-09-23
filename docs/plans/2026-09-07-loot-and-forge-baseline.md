# Loot and Forge economy baseline

## September23 refresh — current100-hour campaign assumptions

Current source1639fd6f, existing generator/material/upgrade/purchase-sale probes:
`/tmp/eidolon-economy-20260923.log`, PASS0.713s. This is a calculation/sample audit,
not measured player pacing. No production prices, drops or balances changed.
The older baseline below is historical, not the current equipment rate.

`limitRoutineEquipmentLoot` now retains60% of ordinary equipment rolls and at
most one elite piece, while retaining material rolls. With the current38-entry
pool, exact equipment expectations are0.28421/ordinary kill and0.99985/elite.
At the same explicit90 ordinary +3 elite kills/hour used by the XP forecast:

| Reference solo inflow | Current estimate |
| --- | ---: |
| Equipment |28.58 pieces/hour |
| Empty25-slot bag, equipment only |52.49 minutes |
| Shards, general + dedicated |13.42/hour |
| Hearts, including one boss/four hours |2.52/hour |

These exclude quest items, gems, chests, extra boss gear, difficulty/Fortune,
party sharing and useful equipped upgrades. They are not a promised drop cadence.
At level100 the sampled mean equipment resale values were2594.63 ordinary and
4958.20 elite; applying the actual retention rates gives about81,240Gold/hour
from selling all that equipment, versus10,512 raw kill Gold/hour. Vendor sales
therefore dominate this sample. Do not approve the Gold economy from raw purses
alone, assume every drop is sold, or treat optional casino losses as mandatory sinks.
Current1,000-purchase level100 gamble/sale receipts spend3.5M and recover3.47M;
that finite sample is not a guaranteed return or an exploit finding.

Actual +1 and bulk Forge upgrades now agree: level1→100 costs119 Shards and the
sample staff reaches13 damage on either path. Fourteen such items cost1666
Shards versus approximately1342 from the100-hour reference kills; normal level-
appropriate replacement drops reduce that hypothetical need. Moderate potency
costs210 Hearts for fourteen +4 items, or255 for one +8 item, versus about252
Hearts from the same reference100 hours. These are alternatives, not both funded.

**Unresolved:** late potency still uses `2^currentPotency`, so +15→+16 requires
32768 Hearts and exceeds25×1000 normal bag capacity. Higher ranks are likewise
unpayable with ordinary stacks. The existing Forge-capacity transaction audit
was rerun on the current source: PASS1.094s, full25,000-Heart bag rejected for
+15→+16 and later purchases; `/tmp/eidolon-potency-capacity-20260923.log`.
Do not mark Forge affordability complete merely because upgrade precision is fixed.
The user answered: **+20 is a long-term endgame goal; moderate potency during
the story**. The +4/+8 arithmetic above is an audit example, not an approved
exact story-rank target. Preserve earned gear/materials; align material supply,
a payable long-term cost curve and client quotes with the approved direction
rather than merely increasing stack limits or making +20 a campaign requirement.

## Historical September7 baseline

September 7, 2026, source `e470a80`, audit `6172111`. This extends the
[progression baseline](2026-09-07-progression-pacing-baseline.md). It is not a
balanced-economy sign-off or an earned gameplay session.

`go test -race -count=1 ./internal/game -run '^TestLootEconomyAudit' -v`
passes **8.446s**, log `/tmp/eidolon-loot-economy-baseline.log`.
The probes call production item/material generators, Forge operations, inventory
storage, gambling, selling and economy accounting. Random samples use the actual
generator RNG; reported frequencies are observations, not fixed seeded fixtures.

## Combined sources, not isolated drop percentages

The general pool has **38 entries: 36 equipment, one shard, one heart**.
`combat_death.go` gives ordinary kills a 50% general-pool roll, and elites three
rolls. `GenerateShardLoot` adds independent materials. Exact expectations below
are derived from those inspected probabilities, excluding QA guarantees, quest
items, gems and direct boss rewards:

| Per defeated enemy | Ordinary | Elite |
|---|---:|---:|
| Equipment pieces | 0.47368 | 2.84211 |
| Legendary equipment pieces | 0.00474 | 0.28421 |
| Shards, general + dedicated | 0.11316 | 1.07895 |
| Hearts, general + dedicated | 0.01816 | 0.12895 |

These are quantities, not independent per-enemy probabilities or useful upgrades.
A 25-slot bag would hold about 53 ordinary kills' equipment or nine elites'
equipment alone, before accounting for worn upgrades, existing items, selling,
materials and gems. Elite equipment vendor value averages **142.11 × enemy
level per kill**, compared with raw gold averaging **5 × level + 9.5** before
party/difficulty/Resonance multipliers. Reducing equipment changes gold income as
well as clutter; separating material rolls must not double-count their base-pool
contribution.

At level 30, 10,000 generated pool items per source give observed equipment shares
94.53% ordinary / 95.09% elite, with mean vendor value **712.04 / 1,435.93** per
pool roll. Materials are included in these means. Equipment uses current squished
stats; rarity's pre-squish multiplier is not a measured character power increase.
Separate 10,000-roll samples observe 0.1043 shards / 0.0047 hearts per ordinary
dedicated roll and 1.0212 / 0.0488 per elite roll. Direct boss hearts average
2.0128 in another 10,000 samples, separately from ground loot and other rewards.

## Forge problems confirmed through actual transactions

- **Rounding erases successive upgrades.** The same generated common level-one
  staff starts at one damage. Ninety-nine +1 upgrades reach level 100 with
  **one damage / 119 shards spent**. A single +99 request reaches level 100
  with **13 damage / 99 shards spent**. Its value also differs, 109 versus 139.
  The public menu's +1/+10 paths use this same rounding and cost logic.
- **Batch pricing skips tiers.** Cost is computed at the starting item level
  for the entire request. Crossing level 80 therefore differs from buying the
  same levels individually. Correct previews and server charges together.
- **Late potency exceeds usable inventory.** Filling 25 slots with normally
  generated-sized heart units proves a 25,000-heart capacity. +15 → +16 requires
  32,768, and subsequent costs reach 524,288. Production Forge rejects each
  despite the completely full bag, preserving the items. This is not a claim
  that arbitrary legacy/QA oversized stacks cannot exist. Set attainable costs
  or design a deliberate material-storage spending model before tuning supply.

Fix accumulated upgrade precision with persisted item metadata, including
snapshot, login, trade/storage and client previews. Preserve existing item stats
as the starting point; do not invent lost historical rolls or retroactively nerf
earned equipment. Test +1/+10/bulk equivalence, mixed potency/level order, rejected
operations, reconnect, and legacy gear. Affordability still needs a campaign and
repeatable-endgame budget; fixing arithmetic alone does not close balancing.

## Gambling and vendor accounting

Actual purchase → sell loops reconcile every payment with telemetry. The inspected
gamble rarity distribution and vendor formula imply **34.5 × level** resale value
against **35 × level** cost: **98.57% expected return**, not the source comment's
approximately 0.5% house edge. Four 1,000-purchase samples return 95.86%, 97.71%,
100.71% and 93.60%; a profitable finite sample is not proof of positive expected
return. Keeping useful items changes actual gold recovery. Gambling is a weak
long-run gold sink under the current resale rules, not an automatic money exploit.

Still open: full chest/raid/Vigil reward stacking, useful upgrades by class/build,
loot ownership/full bags, sustained source/sink playthroughs, explicit XP curve
and reward targets, attainable potency, and the eight playable investigations.
