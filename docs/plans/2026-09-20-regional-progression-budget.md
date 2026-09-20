# Regional progression budgets — diagnostic, not balance acceptance

The bounded server audit `TestChronicleRegionalReadinessBudgetAudit` covers
Water, Fire and Air; solo/four-member parties; no rest/full rest uptime; and
8/20/40 collection kills. All36 cases passed in0.011seconds. It uses the actual
quest catalog, hunt levels/counts, combat XP, party sharing, Well Rested and
level requirements. Full output is retained at
`/tmp/eidolon-campaign-budget-20260920-8OfQ9y/audit.log`.

Each segment deliberately starts at the previous dungeon's minimum entry level
with zero carried XP, then includes that dungeon chapter's turn-in and the
following story objectives. **All prior dungeon combat/room XP is omitted**, as
are investigation enemies, incidental travel, dailies, gear and kill throughput.
Consequently these are conservative budgeting scenarios, not actual earned
ending levels or a claim that the game requires the estimated extra kills.

Representative20-collection-kill scenario (not a measured median):

| Segment | Start / next entry | Solo: no rest / full rest | Four-person party: no rest / full rest |
| --- | --- | --- | --- |
| Water | 30 / 60 | 58 / 62 | 46 / 48 |
| Fire | 60 / 70 | 69 / 70 | 64 / 65 |
| Air | 70 / 70 | 77 / 78 | 73 / 74 |

Water merits the next earned pacing review: its four-person/full-rest model
omits781,397XP relative to level60, equivalent to245 additional level55 ordinary
shared kills **before accounting for omitted dungeon and incidental income**.
Fire's corresponding difference is503,188XP/84 level75 shared kills. Parties
can kill faster and earn personal dungeon-boss rewards; this audit measures
neither benefit, elapsed play time, survivability nor equipped-item progression.
It must not be used alone to increase XP, abolish sharing or invent a daily wall.

No economy/runtime values changed. Existing Earth earned readiness and party
dungeon acceptance remain retained. Continue the earned Water handoff with
recorded entry level, carried XP, dungeon/quest/ordinary-kill receipts, actual
Gold income/spending and equipment improvements. The current no-mandatory-daily
requirement remains open until earned evidence supports it across the campaign.

## Retained Verdant income narrows the missing-income question

September20 now supplies an exact earned-Wizard sample: the accepted full
four-player Verdant run starts31/12448XP/9047Gold and ends33/23108XP/10598Gold.
The actual saved archive confirms the final values. Applying the unchanged
level31 and32 thresholds gives57,385XP gained, including the10,562XP manual
chapter reward, hence46,823XP of dungeon combat/room income, and1,551Gold net
increase. The three teammates were prepared; no party-wide earned-progression
claim is implied. This exact sample falls inside the earlier bounded omitted
income estimate below, but still does not measure Water's kill throughput or
time to level60. Continue from this save rather than replaying Verdant.

The accepted September12 four-player Normal30 run starts at level30/zero XP and
ends at level32 for all four players, including the personal10,562XP chapter
claim. Its retained `native.log` in `/tmp/eidolon-geared-party-pass-KVzr6y/`
confirms those levels/rewards but does not print remaining XP. With the unchanged
quadratic progression requirement, its total XP is bounded by43,725–67,849;
subtracting that already-modeled chapter reward bounds the omitted dungeon
combat/room income at33,163–57,287XP per character. This does not require a rerun.

Even the top of that historical range is small beside the model's781,397XP Water
shortfall. Omitted Verdant income alone therefore does not explain the modeled
party gap. This is still not an actual Water ending level or play-time forecast:
the current earned Wizard carries XP into Verdant, seeds and incidental combat
vary, and parties have different kill throughput. Preserve the original rule
that no daily quest is mandatory; measure ordinary Water combat and additional
leveling time before changing rewards. No reward, sharing or entry-level change
is justified by this bound alone.
