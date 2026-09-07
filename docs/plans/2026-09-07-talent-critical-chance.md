# Critical-chance talent consumers — reproduced September 7

Status: **server critical consumption/composition, offline basic and implemented
ability criticals, and tooltip corrections implemented in an isolated branch;
real-browser/persistence and remaining consumer coverage remain open**. This is
not a completed talent category or release.
The main game and earned Fighter browser sources remained frozen during these
isolated Go overlay diagnostics. No production or browser character was modified.

Run `npm run audit:talent-consumers` with Node 24. The existing overlay script
loads `docs/qa/talent_consumer_probe.go` into a disposable test process, without
replacing runtime source. New `TestPendingTalentSkillCriticalChance` cases use
ordinary paid ability dispatch on prepared level-100 fixtures with zero/five
allocated ranks. The only random roll is fixed through the existing production
RNG; the fixture verifies the roll before resetting it for each cast. The test
enables seeded behavior in its own process with `randseednop=0`, preserves other
GODEBUG options and does not run parallel subtests.

The fixed roll is **0.604660**. Untrained builds have a 0.55 equipment critical
chance. Training adds the definition-backed 0.10 or 0.15 skill chance, which
should cross that roll. Separate zero-rank equipment-only controls use 0.65 and
do critically hit. There are no lucky items, special runes, active combos,
target armor, PvP scaling or target deaths to confound damage comparisons.

| Talent / actual cast | Untrained damage | Five-rank damage | Equipment-only critical control | Expected trained damage |
|---|---:|---:|---:|---:|
| Backstab Technique `ROG_04` / Backstab | 150 | 150 | 300 | 300 |
| Needle Precision `ROG_32` / Backstab | 150 | 150 | 300 | 300 |
| Sigil Mastery `WIZ_39` / Flame Whip | 25 | 25 | 50 | 50 |
| Battlefield Awareness `FTR_39` / Shield Slam | 100 | 100 | 200 | 200 |

The first paired run failed in **0.952 seconds**; the expanded equipment-control
run failed in **1.699 seconds**. Logs:
`/tmp/eidolon-critical-consumer-probes.log` and
`/tmp/eidolon-critical-consumer-controls.log`. All four equipment controls pass;
only the four trained critical expectations fail. The retained Cleric area
probes pass on this source. A nonzero audit exit is an open defect, not a release
pass or a skipped standard regression.

Source tracing explains the observed split: `GetSkillBonus` accumulates
`SkillCritChance`, while `CalculateFinalDamage` only reads `CritChanceBonus`.
The direct ability damage helper has no skill-identity parameter. Delayed damage
also uses attacker snapshots that currently omit talent ranks. This is evidence
for missing talent consumption, not proof that every ability shares all these
paths or that every critical interaction has been audited.

## Required repair and verification

- Carry explicit skill identity into the real damage calculation, including
  applicable projectiles, areas and delayed snapshots. Keep unrelated talents
  from affecting another skill; preserve valid saved ranks and point budgets.
- Compose existing equipment and applicable talent chance in one ordinary crit
  roll. Preserve separately defined rune/combo guarantees and lucky-item behavior;
  do not introduce accidental extra doubling or silently change basic-attack
  semantics. Resolve generic-talent copy against its intended actual coverage.
- Retain armor, receiving modifiers, walls, instance isolation and authoritative
  damage/feedback. Match offline behavior and visible critical feedback where
  applicable; changing a tooltip alone does not fix these four cast results.
- Promote these cases into ordinary tests, add rank-zero/one/five and unrelated
  skill controls, then verify immediate and delayed attacks, relevant runes and
  persistence through real gameplay before packaging a subsequent release.

The earned Fighter route does not allocate these critical talents, so these
diagnostics neither explain its missing hotbar casts nor invalidate its ordinary
opening/collection results. The separate fresh-overworld driver correction is
recorded in the earned-melee plan.

## Isolated server implementation checkpoint

Work is isolated in `/tmp/eidolon-critical-talents-lkoMno`, branch
`work/critical-talents-20260907`, based on `2c80b06`. It is not merged into the
root checkout serving the active earned Fighter run, and is not in the release
queue. Generic critical talents now contribute to ordinary damage, including
basic attacks as their general critical-chance copy implies. A named skill also
receives only its own Technique chance. Equipment and talent chance share one
roll, capped at 100%; invalid/cross-class/negative ranks are ignored, oversized
ranks are capped, and duplicate legacy IDs do not double-count.

Immediate handlers, Rogue projectiles, zones, Meteor, Charge, Whirlwind and
Cleric periodic damage carry explicit skill identities. Attacker snapshots copy
private talent ranks and are captured before target locks, retaining delayed
damage bonuses without aliasing the live talent map. Existing damage modifiers
and event routing remain in place. There are no talent/save migrations.

The original overlay now passes **1.838s**. Promoted actual-cast and new core
chance/snapshot/composition checks pass **0.438s**. Actual projectile update tests
for Piercing Throw, Fan of Knives, Blade Storm and Phantom Volley cover rank
zero/one/five and unrelated Backstab training; they pass **0.539s**. Full server
race checks pass: root **13.470s**, game **338.626s**. Logs:
`/tmp/eidolon-critical-{consumer-first-fix,core-server,projectiles-server,server-race-initial}.log`.

These results do not prove the remaining rune/guaranteed-crit and splash
composition review, all periodic/utility talent benefits, offline parity,
accurate client copy or real-server browser/persistence checks. In particular,
inspect the existing splash path that derives its amount from already-modified
direct damage before running the modifier pipeline again. Preserve its baseline
evidence before choosing a correction. Do not package this checkpoint as a
complete critical-system repair.

## Composition and offline-basic checkpoint

Ordinary paid Cloak & Vanish → Backstab tests reproduce critical stacking:
combo plus equipment and rune plus equipment each deal 600 rather than 300;
all three sources deal 1,200. Six cases fail in 0.283s, including armored targets.
Backstab now supplies a forced critical flag into the same ordinary critical
calculation instead of multiplying damage before that calculation. Ambush keeps
its real 50% roll and the combo is consumed normally; the independent Lucky proc
and behind-target bonus remain separate. **Balance correction:** guaranteed/rune
criticals now double damage after armor, as equipment/talent criticals do. The
armor and Eviscerate tests explicitly cover this change.

Actual paid Fireball flight reproduces eight splash failures in 0.553s. With a
100-base projectile, guaranteed equipment critical and +50% fire damage, splash
deals 360 instead of 120. Primary-only weakness and Implosion slow bonuses leak
to secondary recipients, while a secondary-only slow receives no combo boost.
Splash also crosses a solid dungeon wall. Splash now starts at 40% raw projectile
damage, applies recipient-specific Implosion and outgoing modifiers once, and
checks the canonical floor geometry. Open-doorway and other-instance controls
pass. The shared Fireball/Explosive Trap branch is corrected; the new paid-cast
composition matrix specifically exercises Fireball, not an actual Trap cast.

Basic-attack post-delay tests exercise the production snapshot, armor, rank
zero/one/five and authoritative damage event for all four generic critical
talents. Unrelated Backstab Technique ranks do not affect basic attacks. Lucky
still composes independently with one ordinary critical. Focused composition/
basic checks pass 0.902s. Full server race checks pass: root 10.524s, game 235.272s.
A subsequently added shared 160-talent metadata contract plus composition/basic
race checks pass 4.950s; no production Go source changed after the full race run.

Four real offline Actor attack-callback tests independently reproduce missing
generic critical consumption (100 damage instead of 200) in 0.911s. The new
offline critical helper shares equipment/talent chance, caps ranks/chance and
normalizes duplicate legacy IDs without save mutation. Actor basic attacks now
consume it before receiving shields and reflection, preserving Lucky as a
separate proc. Multiplier calculations do not predict multiplayer/remote damage.
Rogue Technique now describes skill critical chance rather than unused range;
Needle Precision shows 3% per rank and Edge Awareness shows 2% critical chance,
matching the authoritative definitions. Client metadata is checked against a
shared JSON contract independently validated against all 160 server definitions.
Full client regression passes **204 suites / 3,033 tests in 72.435s**; lint and
whitespace checks pass. This checkout does not yet include the separate 1.0.36
hotbar targeting correction, so these are not combined-root test totals.

Logs: `/tmp/eidolon-critical-{composition-before,composition-after,splash-before,
splash-after,composition-complete,server-race-composition,contract-race,
offline-basic-before,offline-basic-after,offline-focused}.log`.

This remains **unreleased**. Offline skill/projectile consumers still need the
new helper, correct skill identity, rune/combo composition and real paid-cast
tests; the generic basic repair does not establish offline ability parity.
Non-damaging Technique benefits, periodic source coverage and browser/persistence
validation remain open. Do not package it as a complete talent or 1.1 release.

## Offline ability and projectile follow-up

Nine ordinary paid offline casts reproduce the missing critical multiplier in
0.766s: Backstab (`ROG_04` and `ROG_32`), Flame Whip (`WIZ_39`), Shield Slam
(`FTR_39`), Piercing Throw, Fan of Knives, Blade Storm, Phantom Volley and
Fireball. Tests advance actual projectiles to a real collision; they do not call
a replacement damage calculation. Shared Dagger visuals now carry the actual
originating skill so another Dagger skill's Technique cannot apply. Rank-zero,
one, five and unrelated-skill controls pass and critical hits receive explicit
offline feedback.

A shared offline hit step now passes the critical amount and caster into normal
recipient damage. Existing base/area/rune rules remain with the consumers;
Lucky is independent, and multiplayer/remote sources or targets cannot acquire
local damage or critical feedback. Implemented Fighter, Rogue, Wizard and
Cleric direct, projectile and periodic consumers use this step. Fighter's damage
override now preserves the attacker argument for reflection/kill attribution.
Actual paid periodic/area checks cover Whirlwind, Inferno Cataclysm, Spirit
Guardians, Boost, Consecrated Ground and Radiant Strike; the expanded 15-case
consumer suite passes 0.673s. Radiant Strike retains its real received-HP
accounting for lifesteal.

Offline Ambush and Implosion also needed actual consumption, not just a shared
critical helper. Backstab's 12-case matrix initially has seven failures/five
passes (0.513s). Accepted Cloak → Backstab now guarantees one ordinary critical;
Ambush's 50% rune roll composes with it and equipment without extra doubling.
Armor and Eviscerate follow the same post-armor critical order as the server.
Expired sequences do not proc; rejected targets preserve the pending sequence
without spending mana. Combo feedback follows the successful hit.

Fireball's seven initial splash/flight/authority cases all fail: secondary
targets receive 100% rather than 40% raw damage, splash and flight cross walls,
and an authoritative engine flag alone does not stop local damage. Local
projectiles now clip against canonical dungeon floors and terminate at the wall;
recipient line-of-sight is checked separately. Fireball/Explosive Trap splash
starts at 40% raw damage; Meteor remains a full-strength area impact. An
authoritative engine never simulates the local collision or damage. Gravity
Well → Fireball now carries Implosion into the projectile and checks each
recipient's slow independently, including splash and ordinary critical chance.
Three additional actual paid combo cases reproduce missing Implosion before
the fix. Combined Backstab, projectile-composition and direct/projectile
consumer checks pass 31 tests in 0.969s (before adding the six periodic cases).

The first full client run reports **15 failures / 3,055 passes in 81.968s**,
all in Spirit/Consecrated boundary assertions expecting a one-argument damage
call. Actual amounts are unchanged; the new second argument is the caster.
Assertions now retain exact damage and additionally require that caster.
The corrected full regression passes **207 suites / 3,074 tests in 92.635s**;
lint and whitespace pass. Production Go source is unchanged from the recorded
server race pass. This is still the isolated critical branch without the hotbar
correction, not a combined-root or live-release result.

Logs are retained under `/tmp/eidolon-critical-offline-`: `abilities-before`,
`abilities-after`, `consumers-expanded`, `backstab-before`, `backstab-after`,
`splash-before`, `splash-after`, `implosion-before`, `composition-complete`,
`periodic`, `full-client` and `full-client-final` (all `.log`).

Remaining limits are explicit: this is not a claim of complete offline combat
parity. Older base-damage/stat/rune differences, bleed/poison source consumption,
and missing offline skills remain separate audit work. In particular Avenging
Seraph's offline handler only announces a summon; its old attack loop is commented
out, so it is **not** an implemented periodic consumer or a passing summon test.
The new Fireball explosion tests do not establish a real paid Explosive Trap
cast. Real-server browser/persistence validation is still required before
release packaging.

## Integrated targeting checkpoint

Offline implementation is committed as **`3dd9c4608bcbbcfbbca2b62801ff4a4868d9d2ca`**.
The separate corrected 1.0.36 hotbar source is merged in
**`054b285628c6020e2591a4e1842f51d143793bbf`**. Combined regression passes
**208 suites / 3,079 client tests in 62.461s**, lint and whitespace pass, and
the original isolated actual-cast consumer probes pass **0.457s**. Logs:
`/tmp/eidolon-critical-hotbar-merged-{client,lint}.log` and
`/tmp/eidolon-critical-final-consumer-audit.log`.

The critical branch remains separate from root and from queued 1.0.37–40.
Next validation must use ordinary browser talent purchases, accepted real-server
casts and fresh-login saved ranks; seeded Go casts already prove the damage math,
so a browser UI rank change alone must not be presented as that mathematical
proof. Existing partial/full-offline limitations above remain open.
