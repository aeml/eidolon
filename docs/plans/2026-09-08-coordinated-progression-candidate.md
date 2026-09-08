# Coordinated progression candidate — next implementation pass

Status: **prototype design, not active balance or release approval**. Keep the
full [balance scope](2026-09-07-progression-balance-and-investigations.md): XP,
gold, drops, useful upgrades, authored progression, solo/party and endgame.
The room-XP correction removes a inconsistent award path but does not tune it.

## Constraints carried forward

Keep existing entry levels (Earth 30, Water 60, Fire/Air 70; endgame 100), earned
levels, gear, gold, spent points and completed access. Daily contracts remain
optional. Preserve promised accepted quest requirements/rewards. Opening stays
a short tutorial; do not turn its three kills into a long hunt. New investigations
retain explicit inspection, manual Ilyra replies, saved lore and all dungeon/raid
repair gates. Physical-device and full earned campaign proof remain required.

## Bounded curve to prototype

Test integer next-level requirements `100 + 25 × (level − 1)²` for levels 1–100.
This is a candidate, not a claim of balanced pacing. It slows early level jumps
and avoids the old late-game exponential threshold. At level 100 the value is
only the capped XP-bar sentinel; additional awards still enter Resonance.

| Level | Candidate next-level XP | Total XP to reach level |
|---|---:|---:|
| 10 | 2,125 | 6,000 |
| 30 | 21,125 | 195,750 |
| 60 | 87,125 | 1,674,125 |
| 70 | 119,125 | 2,685,250 |
| 100 | 245,125 | 7,973,625 |

Prototype ordinary-enemy rewards around 10% of the enemy level's threshold,
and boss XP around 35% of the selected encounter level's threshold. Treat these
as **explicit experimental starting budgets**. Review dungeon trash/elites,
party sharing, difficulty and Fortune together; do not silently stack old realm
×4–×8 multipliers or the personal 2,000,000 boss addition on top. Reward amounts
must derive from content level, not the recipient's level, so trivial enemies
cannot become an efficient cap-level farm merely because their killer leveled.

Budget overlapping boss dailies together: their combined payout should be a
modest addition to the run, not the extra 8–23 million XP measured today.
Author main-story payouts against the level reasonably earned while completing
their objectives. Avoid paying several levels just for opening a diary. Separate
gold from XP tuning so reducing a quest's XP does not accidentally remove its
equipment/skill purchasing budget. Audit room, weekly, raid and Vigil sources,
not only ordinary kills and catalog entries.

## Authored progression must support the curve

The current eight-fragment/diary/scar path alone is not enough. Prototype
purposeful main-story hunts along the Earth Skeleton → Imp → DemonOrc route,
and a corresponding Water progression through its actual enemy bands. Earth
and Water need more preparation content because their gates span 30 levels;
Fire and Air do not need the same number of mandatory hunts simply for symmetry.
Connect those objectives to Ilyra's evidence and the corrupted courier's actions.
Keep investigation locations and named personal accounts meaningful; objectives
should change what the player understands, not merely pad a kill counter.

A rejected **5%-per-kill** arithmetic sketch illustrates the gap: even leaving
today's 8,100 total opening/diary/collection/scar XP intact, 80 level-20 Imps and
80 level-30 DemonOrcs add only 120,960 XP. The resulting 129,060 total reaches
level 26, still 66,690 short of the gate (64 additional level-30 kills). This
omits actual collection/travel kills and any new hunt rewards; it is a budget
warning, **not a measured playthrough or a prescription to add 64 filler kills**.
The next candidate must test the complete authored sequence and actual enemy
levels, then change curve/source/objective budgets together when it misses.

## Migration and validation before activation

- Store an explicit progression-curve version. Preserve level and earned progress
  within that level when converting thresholds, applying the conversion once.
  Handle old already-over-threshold room XP deliberately; clamping away its
  unprocessed earned levels or treating old raw XP as new-curve XP is incorrect.
- Preserve capped Resonance progression and existing spent traits; do not convert
  the old capped XP-bar sentinel into a fresh Resonance award.
- Preserve accepted reward quotes, including explicit zero values. Distinguish
  genuinely missing legacy fields from a quoted zero using actual save metadata;
  do not infer acceptance-time promises solely from the new catalog.
- Keep authoritative and reachable offline/client threshold calculations aligned.
  Replace the offline single-level-per-award behavior when adopting the curve.
  Keep large legacy values supported in save/protocol tests even though new
  thresholds are smaller.
- Verify every source/receipt, cap crossing, reconnect, duplicate event, party
  eligibility and accepted-contract migration. Run earned all-class solo and
  group routes through the actual gates, recording timing, deaths, equipment and
  affordability. First-dungeon 1–2 hours remains provisional, not established.
- Publish a coherent versioned balance change only once the whole source/curve/
  objective combination passes. This candidate is not permission to ship a
  curve-only change or a boss-only nerf that strands the next realm.
