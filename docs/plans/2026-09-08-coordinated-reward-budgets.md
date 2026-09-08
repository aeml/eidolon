# Coordinated quest and weekly reward candidate

Status: isolated balance experiment based on6076da6, not released or campaign
approved. This replaces the incompatible million-XP catalogs in the curve-2
prototype. The preparation route, remaining source/sink audit, compatibility
bridge and earned all-class/group/device checks remain required.

## Policy under test

- Story rewards have explicit content-level XP and independent gold budgets.
  Opening remains100XP/100gold/three kills. Earth's collection and both new
  investigations share1600XP/100gold (diary200/scars200/collection1200XP).
  Water shares40% of the level50 threshold/600gold; Fire/Air each share40%
  of level70/1000gold. Dungeon story turn-ins pay50% of the area's minimum-entry
  threshold; completed crystal Vigils pay125%. Portal chapter pays75% of level100;
  Dark King story finale pays200% (490250XP), independently of the weekly cache.
- All23 current story chapters total **1,401,515XP and16,700gold**, not a claim
  of enough XP to reach cap. Authored hunts and earned route verification are
  still needed; daily contracts must not become mandatory gap-fillers.
- Ordinary hundred-kill dailies pay2% of the authored enemy band's lower-edge
  threshold per objective (20% of ordinary-kill XP before per-kill rounding).
  Boss dailies pay4% per objective; Heroic/Mythic use level100 and ×2/×4 once.
  Generic, regional and difficulty contracts can all overlap and are included
  in the production audit. No quote derives from the recipient's level.
- Gold is no longer XP/500: ordinary daily gold is `max(100, level×count/10)`;
  boss daily gold is `level×count×4×difficulty`. Story gold is explicit per chapter.
  Existing accepted amounts/requirements and historical receipts still survive.
- Weekly cache is **1,000,000 Resonance XP,15,000gold and one endgame unique**;
  a full bag substitutes an additional5000gold for the item. Production grant
  returns an exact receipt; chat now describes the actual gold, Resonance XP
  and whether equipment was granted. Existing database weekly idempotency gate
  remains; this does not fix its separate claim-before-grant/recovery risk.
- Ordinary combat gold, room payouts, materials/gems and boss equipment are
  unchanged by this pass. Evaluate their combined earned affordability and
  repeatable yield before deciding further changes; do not blanket-nerf rooms.

## Evidence

Initial scoped race **62093 FAIL / game14.093s**: three test families still
expected old starter-daily XP, old dungeon-story XP and old weekly rewards.
Exact expectations were updated to the new policy; receipt/attribution checks
were retained and expanded. Search also found the production chat still
promising50,000gold/one whole Resonance rank/a unique even for a full bag; it
now formats the actual grant receipt and is unit-tested.

Three race repetitions **11135 PASS / root3.225s / database1.050s /
game54.148s** cover every Chronicle, quest migration/receipt, daily generation,
weekly grant/economy/message, all15 solo/party boss receipt scenarios and
overlapping dungeon dailies. Full catalog budget coverage rejects missing or
old million-XP values. Log `/tmp/eidolon-reward-budget-receipts.log`.

| Prepared Verdant scenario | Boss XP | All daily XP | Combined XP | Daily gold |
|---|---:|---:|---:|---:|
| Normal30, two contracts | 29,572 | 6,760 | 36,332 | 960 |
| Heroic100, three contracts | 686,344 | 85,200 | 771,544 | 4,160 |
| Mythic100, three contracts | 1,372,688 | 163,640 | 1,536,328 | 7,360 |

Normal prepared character moves30→31 after bosses and remains31 after claims,
versus old30→54→57. Each combined daily payout is less than25% of actual boss
XP. Combat gold is randomized and separately reconciled exactly, not represented
by the daily-gold column. These are actual reward functions, not earned wins.
They exclude trash, room clears, story claims, equipment sales and weekly caches;
they cannot establish full-run pacing. Full server regression is still required.
