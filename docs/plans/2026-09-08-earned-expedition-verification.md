# Earned expedition verification

The combined31-chapter implementation **771c08c** passes full client
**49961 /223 suites /3,339 tests /163.232s**, full server race **95004 /
root24.039s /database1.049s /game498.132s**, and lint81312. Handles closed.
The longer server duration was observed with the exact process active; it was
not restarted or edited while running. This is functional regression evidence,
not earned campaign pacing approval.

Verification work is isolated in `/tmp/eidolon-earned-story-TZuGpp` on
`work/earned-story-20260908`. The old collection-prerequisite fixture now selects
the real collection by stable ID, not the index occupied by a new hunt.
Its expansion checks pass **25352 /race /1.752s**. Lint/preparation12946 pass;
standard client preparation creates the required ignored vendor dependencies.

The new `fresh-story-hunt` route starts a genuinely fresh character, earns the
opening and diary, then accepts Those Who Kept the Watch. It travels through
ordinary ground/jump input, targets actual level8+ Skeletons, fights with normal
class inputs, and records server quest credit, levels, gold, deaths and unsold
equipment value. It permits at most two normal respawns and checks credit is
retained. No levels, items, quest credit, movement or invulnerability are granted.
This initial baseline does not optimize an equipment/talent build.

Completion must remain pending until an explicit Ilyra click. Actual quoted
gold/XP and authored dialogue are checked, followed by reconnect retaining the
exact receipt and progression snapshot. The next chapter must remain unaccepted.
The longer fresh-collection route also now includes Walking Ink and The Borrowed
Oath around their investigations rather than assuming the old23-chapter order.
Investigation speech follows the already unit-checked current authored handoff.

Browser result remains pending. No earned31-chapter or all-class pacing success
is claimed. The full roadmap, economy/source-sink audit, compatibility bridge,
staged release notes and actual deployment gates remain required.

## First expedition closure

Fresh Wizard **49775 PASS /one /8.9m**, source **906057e**. Opening pays100XP/
100gold, level2/46s/zero deaths. Diary earns200XP/25gold, level4 by107s. Watch
starts level4/9XP/336gold, earns40 qualifying server credits, with two ordinary
deaths and retained credit. Before claim: level11/997XP/3412gold; manual1593XP/
100gold leaves level11/2590XP/3512gold, ten XP short of12. Eight occupied bag
slots,270gold unsold equipment value. Watch takes426s including manual claim
and reconnect. No stat/gear optimization or grants; this is one class/route.

Artifact credential scan and owned cleanup pass. Ready image inspected:40/40,
100gold/1593XP, explicit Complete Quest button, intact lore text. Images archived
at `/tmp/eidolon-earned-watch-evidence-kgJbKH/`. Full log:
`/tmp/eidolon-earned-story-watch.log`. Two early deaths remain pacing evidence;
do not treat this as all-class difficulty approval.

Next full Earth run includes the three expeditions and actual investigations.
At level10+, the driver uses the existing ordinary earned-gear/stat/talent UI
preparation before harder expeditions; it never grants a build. The lower-level
watch baseline is unchanged. The whole Earth timeout is60m to cover the newly
added150 kills and travel, rather than the old20m three-objective route.
Actual completion time is still measured and is not approved by that ceiling.

## Full Earth attempt and wall-navigation correction

Full Earth **57004 FAILED /10.8m**, source a7cbd99; artifact scan and owned
cleanup passed. Watch earned40 credits with two deaths and manually reached
level12. Eight Seeds took11 observed target deaths without another death.
The ordinary build UI equipped eight actually earned items and trained two
Fireball Mastery ranks. Walking Ink reached5/60 credits, level14, with no Ink
death before the driver's retreat ran into Lanternhold's west wall at
(-105.55617685,269.11594458). Maximum displacement2.31572 failed the unchanged
six-unit movement assertion. This is not a completed Earth pacing result.

The driver now queries the actual client collision manager on detached vectors
along each proposed retreat, including alternative clicks. Walls, rotated
buildings, circular props and instance floors remain solid. It selects among
normal nine-unit directions or keeps fighting if none fit; it does not move
the actor, grant progress, relax the movement assertion or increase the death
allowance. Regression26911 passes67 tests across three collision/strategy
suites; lint93211 passes. A new full earned run is required.

The static-wall rerun75518 failed8.8m at a different position(-15.87,-38.51).
Its last periodic log reported Watch36/40; the inspected failure screenshot
shows39/40 and a tight surrounding crowd. Three retreat clicks gave ATTACKING
or under0.35 displacement despite static path clearance. Auto-loot inspection
shows it only requests nearby pickups, not automatic travel. The evidence
supports checking actor-body obstruction, not changing town collision again.

The driver now detects an actor body's intersection with a proposed retreat
and can use the existing ordinary desktop Ctrl-click jump, provided the player
is not already jumping or movement-disabled. Static full-path/floor constraints
still apply. It waits for landing and retains the six-unit distance assertion;
ordinary death recovery and its two-death allowance are unchanged. Two strategy/
collision suites4570 pass63 tests, lint5850 passes. This is an explicit strategy
change, not proof that every former failed click had the same cause.

Source762a46b integrates the user's requested0.01 regeneration into this31-
chapter candidate. Earlier0.5-rate playthroughs do not establish its new pacing.
The next earned run uses this real rate and the crowd-jump strategy; no XP,
equipment, mana, health, movement or objective credit is granted.

## Requested low-regeneration run and first-hunt correction

Run66368, source dfd3cbd, **failed** after three ordinary deaths at Watch1/40.
The opening took48s, no deaths; the diary left the Wizard at level3 after109s.
All three Watch deaths occurred at level4/97XP/283gold, with no equipment in
the bag. The inspected failure image shows0/175HP,22/145mana and several
nearby Skeletons. This establishes a playable-onramp failure, but a death
screenshot alone cannot distinguish mana starvation from incoming crowd damage.
Artifact scan and owned cleanup passed; the run is terminal, not waiting.
Image: `/tmp/eidolon-earned-low-regen-evidence-J2vCTX/failed-watch.png`.
Log: `/tmp/eidolon-earned-earth-low-regen-crowd.log`.

The first expedition now admits level3+ Skeletons instead of level8+, matching
the actual level reached through the preceding chapters. Ilyra explicitly
directs the player to the near roads. The40-kill objective, authored reward
budget, manual handoff, later dungeon gate and requested0.01 regeneration are
unchanged. Existing higher-level kills still qualify. This widens eligibility;
it does not erase accepted progress or alter quoted rewards. The driver records
volatile health/mana/rates and nearby enemy levels separately from its exact
saved-state assertions. No gear, levels or recovery are granted and the
two-death bound remains. A new earned run is required; later hunts and level30
pacing are still unapproved and must be measured using the new eligibility.

## Level-three route closure and starter encounter spacing

Run66228, source e74a658, **failed /4.3m**, with three deaths at Watch3/40.
Opening41s/no deaths; diary100s/level4. The first Watch death at(188.11,322.99)
had three level30 Demon Orcs within16 units. Later deaths had eleven nearby
level1–4 Skeletons; final health0/175, mana28/145, level4/169XP/493gold,
three occupied bag slots and10gold of unsold equipment. Screenshot inspected
and archived `/tmp/eidolon-earned-watch-three-evidence-jvQixH/failed-watch.png`;
log `/tmp/eidolon-earned-watch-level-three.log`. Scan/owned cleanup passed and
the handle is terminal. Lower eligibility alone did not establish playability.

Source inspection finds level20/30 neighbors can spawn at x±200 while early
roads reach x±185; enemies detect players at45 units and roam10 from spawn.
New Imp/Demon Orc spawns within160 units of the town rectangle are omitted,
with their one-per-sector elite placed on the safe inner edge instead. Existing
sectors, combat stats, rewards, respawn origins, pursuit and dungeon behavior
remain intact. This is spawn spacing, not an invisible immunity boundary.

Unprovoked overworld Skeletons at levels1–9 now detect at12+3×level units
(15–39), reaching the normal45 at level10. Attacked enemies still retaliate
through the full45-unit range. It does not adapt to player level, change other
families, or soften dungeon enemies. This addresses measured crowd acquisition;
it does not claim the unresolved resource economy or whole hunt is balanced.

Regression94476 race PASS /4.190s covers authored detection bands, actual
production AI retaliation, an exhaustive fixed-grid replay of the first death's
location with idle-roam margin, constructor output, and existing hunt/regen
contracts. Lint57878 PASS. Full server regression and fresh playability evidence
are still required. The diagnostic filter now excludes friendly NPCs using the
game's actual hostility predicate. No recovery mechanics or player grants added.

## Spaced encounter run and death resource recovery

Full server26246 PASS on5398395: root18.567s/database1.040s/game276.898s;
the handle is closed. Earned browser82247 **failed /2.5m** at the opening's
third kill: two prior kills, one death, then the unchanged120s combat deadline.
No Watch pacing result exists for this source. The opening route disables
screenshots; its old diagnostic read nonexistent player.health instead of
player.stats.hp, so that failure has no usable resource-bar snapshot. Log:
`/tmp/eidolon-earned-watch-spaced.log`. Artifact scan/owned cleanup passed.

The production respawn path restores health but not mana. This also explains
why the prior run's death mana18→23→28 stayed depleted across ordinary respawns.
Source6371b3c integrates the separate dead-only mana-recovery fix7440ccd, not
a passive regeneration increase or a new potion/rest system. Living unstuck
and recall cannot refill mana; PvP restrictions and cooldowns remain intact.
See the death-resource evidence document for focused tests.

The earned opening/Watch driver now observes actual state/delta messages around
the ordinary death-button click and requires a full-mana server receipt, not
just a predicted local refill. No health/mana grant command is used. Opening
failure logs now read real resource fields. Existing combat deadlines, death
allowances, quest counts and manual claims remain unchanged. A new full check
and earned run remain required; neither spacing nor recovery proves full pacing.

Combined653357c server31046 **PASS** root22.084s/database cached/game366.158s.
Client65703 **FAILED** one of225 suites (3350 tests passed, one failed,
225.515s): ProgressionCurve's fixture reader passed JSDOM's global URL to Node
readFileSync. The test now explicitly imports Node's URL, as other filesystem
fixture tests already do. No threshold, expected fixture value or gameplay
assertion is changed. Both handles are closed. Corrected full client and earned
browser checks remain required; server source is unchanged by this test fix.

## Combined recovery closure and uninterrupted pacing mode

Corrected candidatea584ec8 client75691 **PASS225 suites/3351 tests/227.420s**;
server code remains identical to the passing31046 run. All full handles closed.
Earned51389 **FAILED6.4m**: opening49s/no deaths, diary107s/level3. Watch
deaths at3,6,9 credits with mana15,16,2. The first two ordinary death recoveries
received actual full server bars (150HP/130mana, then175HP/145mana). The third
death exceeds the unchanged two-death limit. Final level4/107XP/406gold, two
bag slots/60gold unsold equipment. The last death had three Skeletons and a
level20 Imp nearby; this is not proof every death has one cause. Scan/owned
cleanup passed, handle closed. Screenshot inspected/archived
`/tmp/eidolon-earned-watch-recovery-evidence-6RSZBb/failed-watch.png`; log
`/tmp/eidolon-earned-watch-recovery.log`. Death recovery works; pacing does not
pass. No new resource mechanic or grant is justified by the screenshot alone.

The existing opening and diary persistence checkpoints reconnect. Login builds
health/mana from base stats (`server/client_dispatch.go`), and DB Character does
not store bars. That makes this a valid persistence route but not uninterrupted
resource pacing. New explicit `fresh-story-uninterrupted` mode keeps the opening,
diary and first Watch in one session, with a final post-hunt reconnect only.
The default mode retains every existing reconnect. Resource bars are logged
before/after checkpoints, and unsupported mixed routes fail before login so
another helper cannot silently refill a supposedly uninterrupted adventure.
No gameplay stats, rewards, counts, death limit or deadline change.

Focused90713 **PASS33 tests/three suites/1.551s**, lint and shell syntax pass.
Tests prove default reconnects, skipped mid-route logins, mandatory final login,
resource logging without credentials, and rejection of mixed route flags.
The uninterrupted browser run and corrected full client suite remain required.
This only separates two kinds of evidence; it does not make the hunt balanced.

The a26f7d1 full client run43054 passed226 suites/3361 tests/160.389s.
Uninterrupted browser2755 failed after37.9s because the opening conversation
remained open and blocked the next ground click. Its opening checkpoint retained
125/125HP and11/115mana without reconnecting; the opening took34s with no death.
This is a navigation failure, not a completed uninterrupted pacing measurement.
Log `/tmp/eidolon-earned-watch-continuous.log`; artifact scan and owned cleanup
passed. The old test handle30895 is unavailable, so no result is inferred from it.

The route now closes the conversation with its ordinary Close button before the
checkpoint and requires the panel to be hidden. No resources, counts, deadlines
or permitted deaths changed. Fresh focused rerun83836 passed all10 checkpoint
tests and route lint. A new uninterrupted browser run is required to verify the
navigation correction and obtain an actual uninterrupted Watch result.
