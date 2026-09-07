# Routine equipment-drop budget — isolated tuning candidate

September 7. Part of the [broader balance pass](2026-09-07-progression-balance-and-investigations.md),
not a claim that XP, rarity power, quest gold, Forge affordability or the overall
economy are balanced. Packaged locally as Alpha 1.0.50; not released or merged
to root, and final package browser verification remains open.

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

The actual party death/pickup pipeline additionally preserves master-looter
restrictions, full-bag world loot, the original retained item ID, duplicate-pickup
rejection and independent personal fragments even when the leader is not master
looter. Three race repetitions pass **1.846s**, log
`/tmp/eidolon-routine-loot-party.log`.

## Earned route and Alpha 1.0.50 package

Clean runtime/test checkpoint **49ac0c7** passes the actual fresh Wizard readiness
route **1 / 14.2m**, handle 58746 closed, log
`/tmp/eidolon-routine-loot-earned-readiness.log`. No level/item/quest/protection
grants. The route earns the opening and eight exact fragments, claims manually,
reconnects with identical earned equipment IDs/stats/rarities/vendor values, then
completes two optional daily hunts and equips/trains through the real UI.

- Collection: **12 observed target deaths**, no player deaths, five picked-up
  equipment pieces, 80 total vendor value (not sold), eight occupied bag slots.
  Gold is 136 before collection / 333 after combat; manual 100 gold / 8,000 XP
  leaves level 17, 433 gold and the level-30 Guide correctly locked. Collection
  and handoff take 74 seconds.
- Skeleton hunt: 100 credited kills, **one death**, manual 50,000 XP / 100 gold,
  level 27. Eight earned items are equipped, Control & Utility chosen and five
  Fireball mastery ranks purchased with earned points.
- Imp hunt: 100 credited kills, **two deaths**, manual 150,000 XP / 300 gold,
  saved level 34 / 15,987 gold, level-30 entry available. Defensive inputs record
  181 retreats / five accepted shields / zero rejected shields.

These observations establish a working earned preparation route, not pleasant
first-hour pacing, a controlled before/after death comparison, or the required
non-daily leveling path. Existing quest payouts still create large level jumps;
three crowded-encounter deaths remain visible rather than being attributed to
loot frequency without evidence. Selling, better upgrade selection, all-class/
party affordability and source/sink balance still need further coverage.

Local Alpha 1.0.50 aligns login/package/manifest/server/container/deploy/QA
versions and adds **less clutter on the road** notes without replacing earlier
history. Notes state the 40% routine equipment reduction, elite ceiling,
preserved materials/bosses/owned gear/accepted contracts and incomplete wider
balancing work. Package contracts pass **251 / 2.387s**. Full client passes
**217 suites / 3,213 tests / 137.407s**, lint passes; package server-root race
passes **17.940s**. Logs `/tmp/eidolon-release50-contracts.log`,
`/tmp/eidolon-release50-client.log`, `/tmp/eidolon-release50-server-root.log`.
The gameplay runtime is unchanged from the full game race and earned route;
package changes are version/copy plus additional party regression coverage.

Still required: final package browser sweep and exact package gameplay identity,
final checkpoint/integration, every preceding sequential release gate, and this
package's own CI/deployment/exact live verification. Client item-generator methods
have no source callers outside their definitions in the current search; no offline
loot parity claim is inferred from that alone. The candidate does not change the
XP curve or excuse delaying its coordinated reward and level-gate work.
