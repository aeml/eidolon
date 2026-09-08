# Basic-attack cadence — isolated experiment, not released

## Rebased comparison on the original campaign, September 8

9505325 applies only the existing0bbc945 cadence commit to the current starter
candidate0d05dcc. It does NOT import the expanded31-chapter story, future XP curve,
death mana recovery or54 damage-parity change. This15-chapter/current-curve
comparison includes the independently verified enemy-impact and starter pursuit
fixes plus actual-target QA. No release or balance selection is implied.

The concurrent baseline's normal preparation had0eligible gear and0available
attribute points at level5. Source confirms online progression grows base stats
automatically and deliberately disables manual allocation; offline-only points
cannot be prescribed as the missing online preparation. Normal specialization is
still level10+. The optional equipment/point comparison grants nothing.

Below is the original prototype rationale. Its earlier expanded-story failures
remain recorded in that branch's later document; do not treat this backport as
new earned-play evidence. Full regression and a fresh comparison against these
starter fixes are still required. Keep0.01 regeneration and per-hit damage intact.

Rebased15042 PASS31focused tests/3.055s and full lint/diff. Full61045 server
PASS root5.352s/database0.024s/game88.516s; full10812 client PASS226suites/
3292tests/153.923s. Both terminal and source frozen throughout. Only this later
document changes after the tested9505325 runtime. Actual fresh collection with
the combined starter/cadence candidate remains due, after the owned46 recovery
browser finishes. More frequent on-hit effects and PvP/PvE pacing remain release
review requirements, not closed by unit regressions.

The first-hour routes repeatedly run out of mana and die before a short hunt
is complete. Starter spacing alone does not establish a playable opening: the
latest47 route failed after two kills and two respawns. The online starting
attributes give all four classes two basic damage and a **4.167-second** attack
interval. A30HP Skeleton therefore takes15 ordinary unmodified hits: roughly
58seconds between first and final impact, before movement or interruptions.
This is a concrete fallback-combat pacing issue, separate from quest payouts.

This candidate tests a more responsive player-only attack interval:

| Dexterity | Previous interval | Candidate interval |
| --- | --- | --- |
| 10 | 4.167s | 1.905s |
| 50 | 2.500s | 1.600s |
| 100 | 1.667s | 1.333s |
| 200 | 1.000s | 1.000s |

Formula: `max(1, 2 / (1 + max(0, Dexterity) * 0.005))` seconds per attack,
instead of the old five-second base and0.02 scaling. The one-second floor and
its200Dexterity threshold remain. Increasing Dexterity never slows attacks.
The existing35% wind-up fraction and authoritative attack admission still apply.

No base damage, equipment roll, starting attributes, saved investment, mana cost,
ability cooldown, regeneration coefficient or enemy profile changes. In particular,
passive health/mana regeneration remains0.01 per relevant stat. The same hero
interval is used for all four actual client classes; non-player constructor and
recalculation behavior remains unchanged. The Dexterity tooltip describes the
new basic-attack scaling. Other online/offline stat discrepancies remain open;
matching cadence is not full combat parity.

Initial checks pass21client tests/1.643s and targeted server race2.822s, covering
all four classes, monotonicity, caps, unchanged damage/resources/regen and enemy
recalculation. Expanded constructor/admission checks, full regressions and an
actual uninterrupted earned playthrough are still required. This is not a final
balance selection merely because the first focused tests passed.

Expanded checks pass22client tests/1.280s, full lint, diff checks and targeted
server race2.550s. They additionally preserve non-player constructor timing and
exercise real server attack admission: early and repeated requests are rejected,
while a ready basic attack is accepted. Full suites and earned play remain open.

Before release, also review actual encounter time, damage received, resource
downtime, all four classes, item on-hit frequency, dungeon/raid pacing and PvP.
More frequent basic attacks affect those systems even when damage per hit is
unchanged. Preserve the lowered XP/drop/reward goals; do not use excessive
rewards or reconnect refills to hide weak combat pacing.

Proposed patch-note text, pending verification and packaging: “Basic attacks are
more responsive for new heroes, giving each class a useful fallback between
abilities. Dexterity still improves attack frequency, up to one attack per second.
Ability cooldowns, enemy attacks and passive regeneration are unchanged.”
