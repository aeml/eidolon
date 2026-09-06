# Fresh-character progression evidence — 1.1 gate

Latest result: the corrected optional opening route **passed in 93 seconds**
(1.6 minutes including overhead), fresh Wizard level one → six, three earned
Skeleton kills, 18 real retreat movements and **one death**. Normal respawn,
manual Ilyra completion, 100 quest gold / 500 quest XP, the next unaccepted offer
and fresh-login persistence all passed. Credential scan and disposable cleanup
passed; `/tmp/eidolon-fresh-opening-recovery.log`, session `92005` closed.
Source was `a8d0aa9` plus the test/documentation changes recorded here; no runtime
balance changes. This is neither death-free onboarding nor whole first-hour,
all-class, phone or first-dungeon progression evidence.

The first-hour gate requires earned-level play. The existing level-100 dungeon
routes and level-prepared collection routes verify functionality, not onboarding
balance or the time required to reach a dungeon.

## Opening-chapter route

All-class follow-up: clean `f2b7b76` **failed as Fighter** after three deaths
with zero opening kills, still level one. The route stopped at its existing
two-respawn bound; no extra protection, level grant or weakened bound was added.
Log `/tmp/eidolon-fresh-opening-fighter.log`, session `35594` closed; credential
scan passed. Investigate actual target acquisition/damage and the fresh-stat
baseline before attributing every death to numerical balance. The Wizard pass
does not establish a dependable opening for all four classes.

The next diagnosis should also cover the advertised starter band. `world.go`
labels the town's Skeleton sector “Lv 1-10” but passes fixed level 10 to
`spawnEnemyRect`; `balancedEnemyBaseStats` also clamps all lower levels to the
level-10 profile. Fresh unequipped Fighter Strength 10 becomes basic Damage 2
under `RecalculateStats`, while that Skeleton profile has 150 health and Damage
30. These are source-derived baseline values, not a simulated time-to-kill or
proof of the exact damage exchanged in the failed browser run. Capture actual
target acquisition and damage, then address the real starting encounter/stat
budget without weakening the no-grants test or globally nerfing later dungeons.

The diagnostic repeat also **failed after three deaths without a kill**. It
observed a fresh Fighter with 100 maximum HP, basic Damage 2 and Charge, against
a level-10 Skeleton. The intended target was actually hovered at close range;
its health fell 150 → 130 during the first life, then 130 → 117 during the
second. Damage reaches the target, so a wholly unattackable enemy is not a
sufficient explanation for this failure. Starting encounter/character budget
is the next gameplay priority; this does not measure every class or prove the
entire combat system balanced or broken. Log
`/tmp/eidolon-fresh-opening-fighter-damage.log`, session `76713` closed with
failure; credential scan passed. Source was `370f759` plus diagnostic and
documentation changes, with unchanged game runtime.

Optional isolated route `fresh-opening` registers a new character, asserts level
one, talks to Ilyra, accepts the opening Chronicle, travels through the east gate,
earns three Skeleton kills, explicitly completes the quest and continues the
conversation. It checks positive gold/XP rewards and persistence after login.
Travel and combat use real canvas/keyboard input. It does not use level grants,
QA teleports, protection, guaranteed drops, quest grants or inventory grants.

The route permits at most two ordinary respawns and reports deaths explicitly.
That bound keeps an automated check finite; it is not a design target for how
often a new player should die. Read-only entity positions guide the automated
player, so this route cannot establish that a human can discover the objectives
without help. It is also only the opening chapter, not an entire first hour.

First attempt: the stationary Wizard killed one Skeleton, reached level two,
then died on the second encounter. Log `/tmp/eidolon-fresh-opening-first.log`;
credential scan passed, session `96516` closed with failure. This is not evidence
that the complete quest is impossible. The next attempt adds normal death
recovery; review found its proposed retreat used the wrong class field, so do
not cite that attempt as evidence of ranged kiting. Record corrected results
separately after the route ends.

Second attempt completed the opening chapter in **77 seconds**, ending at level
six with 100 quest gold and 500 quest XP, after **two deaths**. Normal respawn
preserved objective credit; manual completion, next unaccepted offer and fresh
login persistence passed. Credential scan and disposable cleanup passed, session
`25471` closed, log `/tmp/eidolon-fresh-opening-retreat.log`. Because the class
guard prevented retreat, this is recovery/quest evidence, not a ranged-control
or death-free onboarding pass. The corrected route uses the actual character
constructor and reports its retreat count as well as deaths.

Third attempt exercised the corrected class guard but failed when the player
died during the movement helper's polling window. Log
`/tmp/eidolon-fresh-opening-kiting.log`, session `72455` closed; credential scan
passed. The route now sends deaths during retreat through the same normal
respawn path, while still throwing non-death movement failures. This is a test
recovery correction, not a runtime movement fix or a passing onboarding result.

## Progression budget to investigate

The authoritative XP curve in `server/internal/game/progression.go` is exponential:
100 XP at level one, then integer `100 × 1.2^(level−1)` per level. The first two
Chronicle chapters award 500 and 8,000 XP. Quest-only XP therefore leaves a fresh
character around level 16, while the cumulative budget for level 30 is roughly
98,400 XP. Ordinary kill XP starts at `enemy level × 10 + 10`, with separate
enemy, difficulty and party multipliers. Kill XP and optional activities matter;
the quest-only comparison is not an observed completion-time estimate.

Also audit the class-stat baseline before interpreting prepared-level runs:
`server/client_dispatch.go` creates fresh characters with all five base stats at
10, whereas `canonicalBaseStatsForClass` used by level preparation and progression
unit fixtures starts the class's primary stat at 20. Fresh login copies the saved
stats into the player. This discrepancy is another reason prepared-level evidence
cannot stand in for fresh balance; decide the intended baseline and compatibility
for existing saves before applying any stat migration.

Before changing rewards or entry levels:

- Measure normal kills, natural collection drops, deaths, rewards, earned level
  and elapsed time through the second chapter for all four classes.
- Check what the journal, Ilyra and dungeon guide tell an under-level player at
  the first dungeon handoff; distinguish an explained preparation interval from
  an unexplained progression dead end.
- Measure an ordinary route to the first dungeon's entry level without debug
  grants. Verify subsequent area handoffs too; one opening success is not full
  campaign pacing evidence.
- Keep dungeon/raid unlock authority and manual completion intact. Any tuning
  needs reward/replay/cap regressions and its own player-facing patch notes.
- Retain human discovery, phone controls and real-device review as separate
  requirements; automated world-state-assisted navigation cannot replace them.
