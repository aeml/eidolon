# Routine equipment-drop budget — isolated tuning candidate

September 7. Part of the [broader balance pass](2026-09-07-progression-balance-and-investigations.md),
not a claim that XP, rarity power, quest gold, Forge affordability or the overall
economy are balanced. Not released, versioned or merged to root.

## Chosen first equipment targets

Reduce routine bag/vendor clutter while preserving existing equipment, material
supply and boss promises. Ordinary equipment frequency drops 40%; a non-boss
elite can produce at most one equipment piece. Keep the first equipment result,
not the best of three, so this is not a hidden rarity reroll. Existing item stats,
quality, item levels and rarity distributions within retained equipment stay
unchanged. Those distributions still need a separate power/usefulness review.

The mixed pool currently has 36 equipment entries and two materials. Keep its
existing candidate rolls (ordinary 50%, elite three), then filter only recognized
equipment types before world publication. Ordinary equipment survives with 60%
probability; elites retain their first equipment result. All rolled shards,
hearts, gems and unrecognized non-equipment types remain. Dedicated material/gem
rolls and personal Chronicle drops are outside this filter. Recognized bosses
bypass it, retaining their complete existing ground and direct rewards, including
Heroic/Mythic promises and weekly rules. The isolated QA guarantee still guarantees
its first equipment result but does not manufacture extra elite equipment.

Exact expectations from the current inspected pool and independent rarity rolls:

| Per routine kill | Ordinary before → candidate | Elite before → candidate |
|---|---:|---:|
| Equipment pieces | 0.47368 → 0.28421 | 2.84211 → 0.99985 |
| Legendary equipment pieces | 0.00474 → 0.00284 | 0.28421 → 0.09999 |
| Shards, pool + dedicated | 0.11316 → unchanged | 1.07895 → unchanged |
| Hearts, pool + dedicated | 0.01816 → unchanged | 0.12895 → unchanged |
| Kills filling 25 otherwise empty slots with gear alone | about 53 → 88 | about 9 → 25 |

Elite expectation is `1 - (2/38)^3`, since three all-material candidates produce
no equipment. These are long-run quantities, not guaranteed useful upgrades or
measured player timings. Retaining every material candidate avoids the otherwise
incidental ~29% ordinary / ~41% elite heart-supply cuts from simply reducing the
whole mixed pool. Existing late-potency capacity/affordability problems remain
open; this change must not conceal them by changing the denominator.

Expected elite equipment resale falls from about `142.11 × enemy level` to
`49.99 × enemy level`; ordinary equipment resale falls proportionately by 40%.
Raw gold, quest gold and difficulty/party/Resonance reward multipliers do not
change here. The effect on available skill/Forge purchases still requires earned
routes, not merely a calculation that less loot means less inflation.

## Current evidence and release gates

The actual asynchronous death/publication regression reproduces **57 equipment
pieces from 20 elite kills** before tuning. Twenty independent collectors needing
one guaranteed guardian fragment each provide a world-visible completion barrier;
the check does not mistake an early XP event or elapsed sleep for finished loot
publication. Existing local QA guarantees the first equipment candidate only.
The pre-change run fails **0.415s** overall, log
`/tmp/eidolon-routine-loot-before.log`.

After tuning, the same pipeline produces exactly one guaranteed equipment piece
per elite kill. Boundary/10,000-roll retention tests, material/boss/QA controls,
fragment budgets, real pickup/instance publication and QA consumption checks pass
three race repetitions **5.726s**, log `/tmp/eidolon-routine-loot-after.log`.
Full server race **60005** closes successfully: root **15.507s**, game
**360.700s**, other packages green; log `/tmp/eidolon-routine-loot-server.log`.

An additional exhaustive pass covers **all 54,872 current elite-pool combinations**,
not a Monte Carlo sample. Equipment expectation is **2.84210526 → 0.99985421**;
the exact shard and heart candidate counts each remain **4,332**. It checks every
outcome's one-equipment ceiling and first-equipment retention, alongside the
production pipeline and boundary controls. Three race repetitions pass **2.639s**,
log `/tmp/eidolon-routine-loot-exhaustive.log`. This additional test does not change
the runtime covered by the full suite.

Still required: further ownership checks; compare retained gear, selling, preparation affordability and
survivability through ordinary earned routes; check all relevant clients/offline
callers; package with explicit before/after patch notes and migration statement;
pass the sequential release gates and verify the exact deployed build. The
candidate does not change the XP curve or excuse delaying that coordinated work.
