# Alpha 1.33 — build-choice review

Local partial implementation, separate from 1.32 delivery. No
version bump, publication, completed build-balance claim or pricing change.

## Latest kit implementation (partial)

### Cleric branch setups, healer pressure and support rearm

All Cleric catalog pairs now fit learned branches without changing skill or
combo IDs. Healer Sanctuary is Healing Light → Guardian Embrace: three seconds
base caster-only immunity, preserving an already-longer protection. Battle
Holy Fury is Consecrated Ground → Radiant Strike: double strike damage without
requiring Support's mark. Support Divine Storm is Blessing of Zeal → Spirit
Guardians: the boosted variant at ordinary starter cost/duration. Mass Revival
is unchanged. Accepted offline histories mirror these effects and show combo
notifications; boosted aura/presentation uses the cast's correct rune/Ministry
area and starter duration. Expired/cancelled sequences do not grant bonuses.

Zeal rearms only the caster's Spirit Guardians and sends the full authoritative
cooldown snapshot immediately. It does not refresh allies, itself or other
skills. Mana/GCD/normal rejection remain. Purifying Wave keeps its existing
cleanse and gains a 20+Wisdom holy pulse with a non-overwriting 30% slow for
two seconds base against living susceptible enemies; hostile pulse respects
walls. Mastery remains radius, not damage/healing; copy now includes pulse.
Mark's offline target selection now rejects friendly, blocked, distant,
foreign-instance and authoritative actors before spending or advancing history.

Server learned A/B/C actual casts prove once-only costs/cooldowns/payoffs,
unmarked control-immune strike damage, and guardian rearming. New pulse cases
cover cleanse/cover/immunity/existing control. Broader Cleric/spirit/radiant/
Purifying/combo server selection passed in 5.111s; final new server checks
passed in .300s and Zeal wire/rejected-repeat check in .117s. Six client suites
passed 120 checks in 2.132s, followed by 15 updated branch checks in .829s.
An initial client assertion incorrectly expected Technique to grow radius;
inspection confirmed it grows duration, while Ministry grows radius. Corrected
the test to verify both independently. Shared starter admission remains usable
even before the local unlock array is initialized; branch skills require unlock.

These are functional revisions, not full twelve-kit acceptance. Next is the
combined level/gear/ordinary-loop/pressure/party review and gameplay-scale
presentation check, fixing concrete gaps it exposes before 1.33 release.

### Throwing Rogue spacing and piercing volley

With Serrated Edges active, Fan of Knives gives susceptible living targets a
20% slow for two seconds base, trained through Fan's duration rules. It does
not replace an existing slow or bypass immunity. Weighted retains its existing
30%/three-second rune behavior. This creates a spacing window for the throwing
branch without adding healing or changing mana/cooldowns.

Offline Fan → Phantom Volley now captures piercing on all three arrows and
actually hits successive targets once each. Ordinary Volley remains single-hit
per arrow. Aim is planar, and delayed emissions reject cancellation, death,
instance changes and authoritative ownership. Damage remains cast-snapshotted;
the combo uses the existing notification and now has accurate skill copy.

New learned-B server cases cover coated/bare/immune/existing/Weighted slows.
The focused Rogue/status/projectile server selection passed in 7.422s.
The first run exposed an old synthetic enemy fixture with 10,000 HP but zero
base Vitality: a new slow recalculation made its derived maximum zero. Giving
that fixture matching base Vitality fixes the fixture without changing live
stat rules. Seventeen Rogue branch client checks passed in .750s, including
real two-target piercing, ordinary stopping, flat aim and delayed-shot cleanup;
the existing 55 mastery/projectile checks also passed. Scoped lint passed.
Full Rogue kit/presentation acceptance and Cleric implementation remain open.

### Rogue learned setups and aimed traps

All four Rogue catalog pairs fit learned branches. Assassin's Ambush now uses
Weak Point Mark → Backstab. Trickster's Venom Burst is Poison Coating → Tripwire
for double impact damage; Shadow Dance is Cloak & Vanish → Smoke Bomb to rearm
Tripwire, with ordinary Smoke mana/cooldown. The former cross-branch discounted
Smoke and poisoned Death Spiral consumers are retired. Stable combo/skill IDs
are retained, and no cross-branch unlocks are granted.

Tripwire placement uses its aimed six-unit range and reachable-floor segment,
not the caster's feet. Offline equivalents preserve the accepted-cast sequence,
reject malformed aim, clear history on cancellation, and use the same clipped
placement. Smoke sends the full authoritative cooldown snapshot immediately.
Existing impact damage/root/training tests explicitly cast at the caster when
isolating those behaviors; new cases verify distant placement and walls.

Actual learned A/C casts verify guaranteed critical, trap budget/consumption,
normal costs/GCD/rearm, and client cooldown delivery. Server focused checks
passed in .460s plus wire .191s; four client suites passed 58 checks in 1.277s;
scoped lint/whitespace clean. Placement initially used the character-movement
wrapper, which ignores non-dungeon-prefixed test instance IDs; using the
instance's canonical floor snapshot directly fixed the observed wall failure
and matches offline geometry. The throwing kit and complete Rogue review remain
open; this is not all-class acceptance.

Shield Fighter now has an active guard-to-counter sequence: Iron Fortress
refreshes Shield Slam only, and Fortress → Slam grants a 50%-damage counter
inside the existing three-second combo window. This is a fifth Fighter combo,
not a replacement for the existing shield/party sequences. Normal mana/GCD,
target shapes, wall/hostility/immunity and rune consumers remain in effect.
The accepted server result is followed by a full cooldown snapshot so the
hotbar unlocks immediately. Rejected Fortress casts do not refresh it. Offline
casts have the same reset, expired-window and once-only behavior plus counter
floating text. Existing Fortress duration/mastery/runes remain unchanged.

Actual learned-A casts verify cooldown scope/GCD/cost, exact 65→97 damage,
immune-target behavior, consumption and ordinary follow-up. Existing Fortress
mastery, Shield Slam damage/runes and shared copy tests pass: game 2.272s,
wire dispatch .142s, 114 client checks in 2.028s. Scoped lint/whitespace clean.
This still needs gameplay-scale presentation and full-kit review.

### Juggernaut movement implementation

Juggernaut now uses the shared collision-constrained charge movement at 50 units/s
with a 10-unit aim limit, then releases its trained damage/60% slow shockwave at
the landing. It does not inherit the starter Charge's rune. Duration training is
captured at cast; existing impact-time damage/area training is applied at landing.
No immediate damage or circle is emitted at cast admission. Offline and remote
presentation wait for landing; the authoritative event supplies the actual origin
and trained shape. Mana/cooldown remain unchanged; no free extra hit is added.

Updated previous instant-shockwave fixtures to step movement before inspecting
hits. Stationary casts isolate existing area/rune/crit tests, while new learned-B
travel checks prove intermediate positions, aim clamping, landing-only displaced
damage, one hit/event and no inherited Momentum rune. Recall cancels the server
landing without refunding cooldown; offline cancellation/death/scene change
produce no later hit or wave. Walls/doorways, immunity and touch aim remain covered.

Evidence: selected server training/control/duration/Charge checks 3.289s; client
Juggernaut/Charge/touch suites 80 checks in 1.968s. New travel/recall/wall checks
passed in .253s; expanded Juggernaut suite 36 checks in 1.056s. Scoped lint and
whitespace clean. No real account, long dungeon or campaign run was used. Full
gameplay-scale visual review and class-kit acceptance still remain pending.

Final shared-movement/admission regression selection (Charge, Shattering,
Juggernaut, learned-kit checks and all selectable handler contracts) passed
in 5.381s. This does not replace the pending rendered review.

All four Wizard combo pairs now belong to learned branches: Fireball → Flame
Whip and Flame Tornado → Inferno Cataclysm (A), Scorch Beam → Arcane Missiles
(B), Gravity Well → Fireball (C). Implosion doubles damage to slowed **or
control-immune** recipients, preserving immunity. Earlier copy-only findings
below describe the baseline; these subsequent changes alter mechanics.

Real learned-branch eligibility/casts, Whip geometry and projectile direct/
splash/critical composition checks passed (Go 1.014s); four client suites passed
58 checks in 2.163s, and five new Wizard branch/cadence checks passed in .796s.
Offline history clears on successful intervening casts and cancellation.

Offensive Fighter's first revision removes Last Stand Rampage's hard health
gate: ordinary-health casts capture 2× Damage stat, below-30% casts retain 3×;
named Mastery scales both. Duration/cost/cooldown rules stay unchanged. Offline
and replicated buff readers accept the lower strength while retaining the 3×
fallback for legacy active buffs without a stored multiplier. This is not a
completed Fighter kit. Iron Will's follow-up redesign is described below.

New tests cover learned C-branch admission at 29.9%, 30% and full health,
captured strength despite subsequent health changes, mastery, cooldown rejection,
expiry and local/remote protobuf presentation. Initial test expectations exposed
fixture assumptions: offline cooldown is 84s after existing cooldown reduction,
and the server fixture needed derived stats rebuilt before recording mana.
No production character was used. Full-kit gameplay-scale presentation/feel
review and all twelve branch acceptance gates remain open.

Final focused Fighter checks: server 2.266s, 41 client checks in 1.293s,
scoped lint and whitespace clean.

### Fighter follow-up: learned combos and control-boss value

Iron Will now uses Berserker Edge → Last Stand Rampage, granting a 20%-maximum-
health absorb ward until Rampage expires. It consumes once, does not stack with
or refresh an existing ward, and does not activate Iron Fortress. Both catalogs
and the shared copy fixture agree. Actual C-branch casts prove capacity, impact
absorption, exact expiry and subsequent ordinary-cast behavior. All Fighter
catalog pairs fit learned branches and every branch has a pair. Offline Guardian
Combo now extends protection; Tremor Rush captures its knockdown at Charge
admission and respects immunity/stronger stuns at impact. Server knockdown no
longer attaches to a killed recipient.

Unbreakable Grip now hits for Damage stat + Strength, with existing skill/impact
modifiers and double actual-damage threat. A control-immune enemy takes damage
and threat without moving/rooting; a dead enemy is not pulled or rooted. Existing
wall/range/hostility/resource and mastery-duration checks remain. Actual learned
B-branch boss cast verifies immunity, mana and threat; offline hit/control parity
is covered. This is not yet the whole control-tank revision.

Evidence: selected Grip/Fighter duration/learned combo server checks passed in
2.138s; five client suites passed 66 checks in 1.461s, then Charge/branch suites
passed 45 checks in .998s. Scoped lint and whitespace passed. Initial new-test
failures were corrected fixture setup (missing mesh/zero-derived-stat attacker)
and incorrect test field names; old no-damage Grip expectations were updated to
the intentional strike design. Full-kit gameplay-scale review remains pending.

Charge knockdown/impact-duration server regressions then passed in 1.220s.
Offline death/cancellation clears the new Fighter ward without predicting away
authoritative multiplayer shields; final branch/buff suites passed 33 checks in
.951s. This is a focused mechanics receipt, not a full rendered kit review.

## Demonstrated Talent Master pricing mismatch

The menu advertised level × 100/50/125 Gold for talents/skills/both. Actual
server prices are 1000 × (1 + floor(level/20)) for either individual reset and
150% of that for both. At level 100, for example, the menu showed 10,000/5,000/
12,500 while the server charges 6,000/6,000/9,000. This both blocked affordable
resets and offered unaffordable ones.

The menu now mirrors the existing server formula. Shared boundary fixtures at
levels 1/19/20/39/40/60/80/100 verify all three displayed prices against the
server quote and actual successful deduction. One-Gold-short attempts remain
rejected without spending; UI controls use the correct affordability threshold.
There is no change to Gold prices, talent ranks, point refunds, saves or build
effects. The existing free talent reset and saved-loadout paths are unchanged.

Before correction, 10 of 11 focused client pricing checks failed. Afterward,
pricing/menu/desktop-confirmation suites passed 92 checks in 8.212s. Actual
server price/deduction boundary checks passed in 1.502s; scoped lint and
whitespace passed. No production account or paid action was used.

## Existing representative ability evidence

The existing non-mutating talent-consumer audit passed in 2.413s. It exercises
actual root/slow expiry, Shield Slam duration, Executioner Spin and Guardian
Roar areas, skill critical chance, and Cleric cone/accepted healing areas.
This is not every possible build or proof that all choices are equally strong.
Earlier duration/healing/generic copy fixtures and prepared rune-toggle tests
remain available; don't rerun a whole raid to test menu prices.

## Combo benefits and limits

Corrected five server/client descriptions against their implemented consumers:
Guardian Combo extends protective-buff duration, not forced boss attention;
Shadow Dance halves Smoke Bomb's mana and starts no new skill cooldown, but
cannot bypass an existing skill cooldown or GCD; Implosion doubles damage to
slowed recipients, not every target standing inside an old well; Divine Storm
activates the boosted Guardians variant; Mass Revival heals living nearby
allies in a base 20-unit radius, not a remote whole party or dead characters.
Only descriptions changed, not mechanics, unlocks or saved combo identifiers.

Shared copy checks and existing talent/rune UI fixtures passed 52 checks in
1.553s. Actual Guardian Roar/boosted Guardians/Cleric area/Fireball-recipient
checks plus a new real Shadow Lunge → Smoke Bomb admission/cost/consumption
test passed in 1.909s. The new Smoke Bomb test prepares the two skill unlocks;
it proves the consumer and normal sequence detection, NOT same-branch access.

Four-class combo cards passed portrait/landscape browser layout in 21.2s;
screenshots at /tmp/eidolon-133-combo-layout-corrected/. Rogue portrait and
Cleric landscape screenshots from the initial run were inspected. Initial
layout assertions passed but its final failure-collector assertion used the
wrong shape (object instead of array), so that run FAILED. The corrected test
uses the established collector and disposes its preview. Original failure is
retained at /tmp/eidolon-133-combo-layout/, not relabeled as green.

## Remaining design/access gap

The class trees allow one specialization at a time. Several catalog combos
span different branches (for example Shadow Lunge + Smoke Bomb), despite the
consumer working when a fixture unlocks both. Branches may currently be changed
freely, but rapid mid-sequence branch switching is not evidence of a normal
single-branch build. The owner selected **redesign within single branches**,
then explicitly requested a full-kit rework across all twelve specializations.
The [expanded contract](2026-09-28-class-kit-rework.md) now governs this milestone.
Do not silently grant cross-branch skills, remove saved choices or claim those
builds are ready from the earlier prepared-consumer fixtures.

Current catalog audit: 9 of 16 pairs span branches. Six branches lack any
reachable pair: Fighter C, Rogue A/C, Wizard A/B and Cleric B. The client tree
was enumerated and compared with `getSkillsForBranch` in server `skills.go`;
this is an access baseline, not a completed combat or feel test. Preserve the
existing respec/copy corrections, but update copy again when mechanics change.

Remaining: all-twelve-kit redesign, real branch combo access and payoff,
presentation/compatibility integration, version/patch notes and CI/live delivery.
Human preference/balance feedback remains open; do not retune from the price
regression or call the former narrow draft a finished full-kit pass.

## First precision-caster implementation (local, incomplete)

- Arcane Barrage now belongs to Wizard B: Scorch Beam → Arcane Missiles within
  the existing three-second sequence launches five missiles rather than three.
  It pays ordinary mana/cooldown and consumes the payoff once. The former
  cross-branch Arcane Shield → Meteor Drop no longer arms or spends a shield.
- Spell Focus also provides a brief ward, capacity `40 + 2*Intelligence`, base
  six-second duration with its existing duration training. It does not replace,
  refresh or stack with an active shield. The ordinary next-spell multiplier,
  mana cost and cooldown remain. This gives the preparation action a defensive
  timing purpose; it is not a field-regeneration change.
- Server and offline implementations match those mechanics, use the existing
  shield-state replication/presentation and retain skill IDs and learned builds.
  Offline volley payoff has explicit floating feedback and two additional
  ordinary missile visuals. Gameplay-scale art/feel review remains pending.

Actual server branch selection at level40 (not arbitrary mixed unlocks) can
cast the new pair; its five projectiles, mana/cooldown and next ordinary
three-projectile cast are checked. Focus ward absorption/expiry at the impact
boundary and existing-shield preservation are checked. Client tests include
expired sequences and rejected/intervening casts. Final scoped Go checks passed
0.786s; four client suites passed52 checks1.611s; scoped lint/whitespace passed.
These are prepared mechanics receipts, not earned progression or balance proof.

One obsolete test initially expected a Meteor to consume/expire the caster's
shield as a side effect. It now checks the requested retired-pair behavior:
ordinary Meteor damage, no explosion flag and no mutation of the still-active
shield. Existing paid-shield expiry tests remain and pass, and the new Focus
ward has its own exact-expiry check. Do not report that initial failure as green.

Wizard B still needs its whole-loop/early-level pressure response and gameplay
presentation review; Wizard A/C and the other nine specs still need their kit
implementation. No full-kit milestone acceptance or release version bump yet.

### Early pressure response and first control-spec revision

Scorch Beam now slows susceptible surviving targets 30% for three base seconds
(duration training applies). It preserves any existing active slow and respects
CC immunity and dungeon walls. A normally selected level10 branch B can use it;
control-immune targets still take the ordinary beam damage/armor melt. Offline
beam targeting also now rejects friendly and remote/server-owned actors before
damage, armor melt or slow. Cancellation clears prepared offline combo history.
Beam mechanics/wall/immunity/overlap tests passed(game0.422s); client kit, beam
range, presentation and effect-routing suites passed47checks2.131s before the
additional cancellation case. No new range, hit width or damage multiplier.

Time Warp now refreshes only the caster's Teleport and Gravity Well, including
Teleport charge recovery; it retains its own paid cooldown, party haste and
normal mana/GCD rules. Party members' cooldowns and the caster's Arcane Shield
are not reset. A successful command sends the existing complete authoritative
cooldown packet immediately, so the hotbar can use the refreshed abilities.
Rejected casts do not send that reset. Offline mechanics match.

Actual server C selection and post-warp Teleport, preserved ally/self cooldowns,
GCD and rejected-mana cases passed(game0.218s). Real message-dispatch refresh
passed(main0.138s). Offline Time Warp/Focus/precision checks passed85cases2.125s;
scoped lint/whitespace passed. New gameplay-scale loop/presentation and control
spec boss-payoff review remain open; this is not a completed twelve-spec pass.
