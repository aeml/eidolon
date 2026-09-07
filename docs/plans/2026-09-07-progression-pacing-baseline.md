# Progression pacing baseline — before tuning

September 7, 2026. Source base `dc8de32` (local Alpha 1.0.45 ancestry), plus
`server/internal/game/progression_pacing_audit_test.go`. No live reward changes.
This records specific imbalance evidence for the
[balance/investigation plan](2026-09-07-progression-balance-and-investigations.md),
not completion of its full economy baseline or playability gates.

## Reproduce against actual server behavior

From `server/`:

```sh
go test -race -count=1 ./internal/game -run '^TestProgressionPacingAudit' -v
```

Baseline passes **5.535s**, log `/tmp/eidolon-progression-pacing-baseline.log`.
Three repeated race-enabled audit passes finish **9.039s**, log
`/tmp/eidolon-progression-pacing-repeat.log`; neither run changes reward values.
The boss probe uses the production death → party sharing → XP award → level-up
path and compares its reward receipt with actual credited progression. It does
not simulate player combat or claim the player earned a kill. Fifteen scenarios
cover Normal-level 30/40/60/70/100 Verdant boss rewards, solo and 2/5-player
nearby parties. Quest probes read the catalog and use real payout logic; drop
probes sweep 10,000 explicit rolls per eligible ordinary/guardian source.

## Confirmed front-loaded XP, followed by a steep late-game wall

| Probe | Actual result before tuning |
|---|---|
| Level-30 solo Rootbound Warden | 2,000,310 XP; level 30 → 46 from one boss payout |
| Level-40 solo Rootbound Warden | 2,000,410 XP; level 40 → 47 |
| Level-60 solo equivalent | 2,000,610 XP; 42.61% of that level's threshold |
| Level-70 solo equivalent | 2,000,710 XP; 6.88% of that level's threshold |
| Level-100 solo equivalent | 2,001,010 Resonance XP; no extra character levels |
| First story payout alone | 500 XP; level 1 → 4, excluding all kill XP |
| Second story payout immediately afterward | 8,000 XP; level 4 → 16, excluding all kill XP |

All four classes reproduce those opening payout jumps. The 2,000,000 boss
addition in `combat_death.go` is personal: party sharing divides base XP but
adds the full bonus to each eligible member. At level 30, two players each
receive 2,000,186 XP; five each receive 2,000,093. Whether the final policy uses
personal encounter budgets or a shared pool must be explicit, not accidentally
determined by where a constant sits in the code.

The actual exponential XP curve requires **19,781** XP at level 30,
**4,695,626** at 60, **29,074,079** at 70, **1,114,630,437** at 90, and
**5,751,248,230** at 99. Consequently a global XP reduction is not a coherent
fix: it would suppress early jumps while making the late-game wall worse.
The full curve, reward budgets and required level gates must be tuned together.
These isolated probes complement, not replace, the earlier earned Earth runs
that observed level 34 → 54 through the complete first dungeon.

## Collection and loot source inspection

Each current elemental collection requires four items. Ordinary eligible
enemies drop one at **65%** probability, for **6.15 expected eligible kills**
with immediate pickup and no competition; each designated realm guardian drops
one guaranteed, requiring four. This is an expectation, not an upper bound.
There is no bad-luck counter in the current drop function. Increasing counts
and reducing rates must be budgeted together and include bounded bad luck.

Source inspection of `combat_death.go` / `items.go` additionally identifies:

- Ordinary enemies have a 50% chance of a base loot roll; elites get three.
  The base pool also contains materials/relics, so these are not three guaranteed
  equipment pieces and rarity-roll percentages are not realized equipment rates.
- Ordinary loot rolls select legendary/rare/uncommon/common at 1/29/30/40%;
  elite rolls select legendary/rare/uncommon at 10/40/50%. Material overrides,
  item level, useful slots and powerful rarity stat multipliers still need
  measured equipment/value distributions before changing final rarity budgets.
- Separate shard, heart and gem rolls can stack with base loot. Bosses also
  directly award hearts; Heroic/Mythic add rewards and Mythic's unique-equipment
  promise must be included in the encounter budget, not silently removed.
- Quest gold currently derives from XP with a 100 floor / 50,000 ceiling.
  Changing XP without decoupling gold can accidentally change affordability.
- At level cap, current quest XP becomes Resonance XP alongside quest gold;
  overflow across the cap is split into an exact receipt. There is no automatic
  extra gold compensation for converted XP. Existing conversion needs its own
  tuning budget rather than being treated as discarded XP.
- The offline actor uses the same exponential threshold but advances only one
  level per `gainXp` call; client loot level/elite-pool rules also differ from
  server rules. Verify which offline paths are reachable before claiming parity.

## Next implementation decisions

Use **1–2 hours to the first dungeon** as a provisional design target pending
the player's requested preference and earned playtesting, not a measured result.
Define remaining realm/cap targets before choosing replacement numeric curves.
Preserve required dungeon levels 30/60/70/70 and level-100 endgame; added story
investigations and ordinary exploration must supply a viable non-daily path.

Next work: complete source/sink and rarity measurements; design the bounded XP
curve and source budgets; specify accepted-quest and saved-XP migration; add
investigation prerequisites and authored interactions; compare before/after
through earned routes. Do not ship a boss-only nerf that leaves Water unreachable
without new mandatory grinding. Existing items, gold, earned levels and completed
quest/raid access must survive the migration.
