# Basic-attack cadence — isolated experiment, not released

## Actual duel admission failed; no PvP cadence approval

81208 on clean6881053 returned terminal exit1: all four classes failed the same
15-second shared-PvP-instance gate, before any attack measurements. Credential
scan passed with0sanitizations; the driver completed. Log
`/tmp/eidolon-starter-cadence-duels-gameplay.log`. Do not weaken the scene gate
or count this as sustained-combat evidence.

Source review finds that sendPvPMatchState only sends pvp_update, whereas dungeon
entry sends enter_instance; the client's delta path does not apply instanceId
as a scene transition. There is also no explicit PvP arena generation branch.
These are concrete missing integration paths, but the original failure lacks
wire/scene receipts. The next probe observes own full/delta instance identity,
enter-message counts and match mode/status without logging accounts or writing
state. Verify admission/return/reconnect and rendered arena before balancing
cadence in PvP; component/profile tests alone did not cover this path.

## Four-class collection comparison closed; practice-duel probe next

All original-campaign comparisons passed with ordinary inputs and the same
0.01 regeneration. Fighter52647: opening95s, collection200s,13 observed target
deaths,8 seeds,0 player deaths,5.0minutes total. Rogue92922: opening32s,
collection435s,25 observed target deaths,8 seeds,0 deaths,7.8minutes total.
Cleric30263: opening34s, collection303s,22 observed target deaths,8 seeds,
1 ordinary death,5.7minutes total. All three used clean a38b535, returned normal
exit0, passed credential scans and independent exact-container absence checks.
Each manually claimed Ilyra's reward, consumed the items, preserved save/handoff
and ended at level17 with the level30 gate clearly locked. The earlier Wizard
result is below. Different drop rolls mean these are not class-DPS benchmarks.

After the final run closed,57a762a was fast-forwarded into this candidate. It
adds only the independently verified browser-smoke sharding workflow/regressions.
Release47 notes now explicitly describe cadence, the unbuffed floor and CI
changes. The broader level/reward gap, expanded31-chapter story and endgame
PvP/class balance are still open. A new disposable four-class mirror-duel route
will measure actual accepted basic attacks, health loss, unchanged mana, normal
practice forfeits and absence of ranked rewards through ordinary UI inputs.
No level, equipment, protection, damage or resource grants are used by that
route. It is not a substitute for final ranked-match or endgame balance evidence.

## Original-campaign collection comparison passed

76763 completed normally with exit0 on clean d72f7df: Wizard opening32seconds,
then15 observed target deaths,8/8 seeds, no player deaths and470seconds in the
collection phase (8.4minutes total test). Ordinary manual Ilyra turn-in consumed
the seeds, awarded100gold/8000XP, preserved the next accepted quest and saved
progress across login, and correctly explained the level30 dungeon gate.
Artifact credential scan0 and independent container absence passed. This was
the original15-chapter/current-curve comparison, not the31-chapter campaign.
Opening reward/relogin was retained; this does not establish an uninterrupted
first hour. The handoff was level17: the gap to30 and excessive payout remain
open progression work, not solved by faster attacks.

After the run closed, bfd2d7d merged release46's QA-only recovery correction
86609cd. Production cadence is unchanged. The existing fresh-collection route
now supports an explicit EIDOLON_E2E_FRESH_CLASS override for all four classes,
retaining Wizard by default and the same isolated account/retry/death bounds.
46510 passed27 client checks/.913s plus full lint/bash/diff.32798 passed focused
race2.624s, including new haste and actual four-class PvP impact/consent checks.

Source review: Lucky/critical opportunities and Executioner damage scale with
the increased number of basic hits; no proc chance or per-hit modifier changed.
Poison Coating refreshes the same status rather than stacking extra per-hit
ticks; tickPoisonLocked retains a one-second clock (covered by the race run).
PvP retains65% per-hit scaling and35% target-health burst cap; unchanged caps do
not establish unchanged sustained PvP damage. Zeal and Time Warp still multiply
attack frequency after the base formula, as the new regression confirms.
Therefore the one-second floor below is the **unbuffed Dexterity floor**, not an
absolute limit while haste buffs are active. All-class earned comparison and
actual PvP/encounter pacing still need verification before a final selection.

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
abilities. Dexterity still improves unbuffed attack frequency, up to one attack per second.
Ability cooldowns, enemy attacks and passive regeneration are unchanged.”
