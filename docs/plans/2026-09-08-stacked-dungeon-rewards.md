# Stacked dungeon rewards — measured, not tuned

The balance pass must budget overlapping rewards together. A new production
server probe accepts the actual boss daily contracts, delivers the four Verdant
boss death pipelines, verifies objectives become ready without auto-payment,
then manually claims each contract near the daily giver. It rejects duplicate
claims and reconciles XP/Resonance and gold receipts with the recipient's actual
state. This is a prepared reward probe, **not an earned dungeon playthrough**.

First race-enabled pass: **1.548s**, log
`/tmp/eidolon-progression-reward-stack-audit.log`. Run from `server/`:

```sh
go test -race -count=1 ./internal/game -run '^TestProgressionPacingAuditOverlappingBossDailies$' -v
```

| Difficulty / actual minimum level | Four boss payouts | Overlapping daily payouts | Combined XP | Recipient levels |
|---|---:|---:|---:|---|
| Normal / 30 | 8,001,240 | 8,000,000 (two contracts) | 16,001,240 | 30 → 54 after bosses → 57 after claims |
| Heroic / 100 | 8,008,080 | 18,000,000 (three contracts) | 26,008,080 | Remains 100; XP becomes Resonance |
| Mythic / 100 | 8,016,160 | 23,000,000 (three contracts) | 31,016,160 | Remains 100; XP becomes Resonance |

These totals **exclude** trash, room clears, story rewards, sales and the value
of equipment/materials. Four prepared deaths must not be mislabeled a full run
budget. The Normal daily claims double the already front-loaded boss XP. Simply
reducing boss XP while leaving overlapping contracts unchanged would leave a
large alternative payout for the same kills.

Daily gold is 16,000 / 36,000 / 46,000 respectively. Boss gold is randomized;
the first observed combined gold totals were 16,769 / 40,832 / 56,208. They are
one observation, not expected income or tuning targets. Each run reconciles its
own exact payments without asserting a fixed random outcome.

Three repeated race-enabled runs also pass **3.042s**, log
`/tmp/eidolon-progression-reward-stack-repeat.log`. XP/level results remain the
same; randomized gold reconciles separately on every repetition.

No XP, gold, gate, contract or Resonance policy changes in this audit. The full
balance decision still needs the non-daily realm path, a replacement progression
curve, source/sink budgets and preservation of accepted reward quotes. In
particular, the fresh expanded Earth route currently finishes at 16 while its
dungeon requires 30; do not ship a further isolated XP cut as a complete fix.
