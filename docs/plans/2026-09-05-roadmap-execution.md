# Roadmap execution ledger

Objective: implement the full 1.1–1.10 roadmap step by step, deploying each version
with patch notes. Scope and completion gates remain in
[the roadmap](2026-09-05-v1-1-to-v1-10-roadmap.md); individual hotfixes do not close
the whole goal. Started September 5, 2026.

## Alpha 1.0.2 — rewards and roads that meet

Status: pushed as `89dad70db593ac8509eeef5e0506e796e0aec212`; CI run
`33986072901` completed successfully, including server/client tests, anonymous
browser smoke, disposable full-character QA, both deployments, and live
anonymous/persistent-character/four-class/remote-animation QA.

Changes:

- Publish pending explicit wizard/daily quest conversations and quest rewards:
  gold plus XP, with max-level XP and level-cap overflow going into Resonance.
  Authoritative receipts preserve the exact split through persistence/protobuf.
- Publish the shared overworld projectile-boundary correction for Air and Fire.
- Replace independently overlapping room/corridor/corner floor assembly with
  an exact partition of the server's walkable rectangle union. Emit masonry
  only on exposed boundaries, preserving intersections, holes, and rectangular
  rooms. Align floor textures across partitions with one material and origin.
- Retain the existing room dressing and legacy fallback layouts.
- Synchronize version defaults and include the new dungeon geometry browser
  regression in anonymous CI. Historical notes remain intact.

Evidence gathered before final version metadata changes:

- 146 client suites / 2,096 tests passed, including exact floor coverage,
  no internal wall collision, 40 deterministic rectangle-union seed fixtures,
  large boss approaches, and the legacy fallback. The randomized fixtures test
  the surface algorithm; they are not a sweep of actual server dungeon seeds.
- Hardware browser geometry fixture passed at High/Low; inspected the reframed
  overview. The generated approach has one floor per sampled point, one floor
  material, and no collision corrections along its center-line route.
- Existing isolated real-server Verdant entry/recall test passed on the initial
  baseline. This does not reproduce or resolve the reported exit failure.
  The helper is now stricter: town position, scenery, and cleared dungeon
  collision/layout must all finish, not just the early instance-type update.
- Previous deployed master `f6accbf` has successful CI run `33945080866`, checked
  through GitHub Actions. That is not evidence for the new candidate.

Final candidate checks: the full client suite (146 suites / 2,096 tests), full
server race suite, lint, and whitespace checks pass. The added release-history
assertion and helper checks pass in a subsequent 181-test focused run. The
stricter isolated real-server Verdant entry/return route passes on the candidate
with completed town scenery/collision/position recovery; its disposable Mongo
and API containers were removed by the runner. This remains narrower than
reproducing all reported exit states or playing a full dungeon.

All eight anonymous browser release checks pass, including the new dungeon
geometry fixture. A synthetic 79-rectangle layout produced 157 floor partitions
and 316 wall segments in approximately 10 ms on this host; this is a generation
microcheck, not a multiplayer performance claim.

Independent live endpoint checks on September 5 confirmed both `release.json`
and backend `/healthz` report `Alpha 1.0.2` and the full SHA above; the frontend
entry-point query matches too. This hotfix's publication is verified. It does
not close the broader dungeon repair or milestone gates.

## Alpha 1.0.3 — within reach, safely home

Status: pushed as `2ec04bc94d8b5cd684e7182499172ddd80d1d5df`. CI run
`33987477412` passed server/client/anonymous checks but failed predeploy portal
QA before either deployment. The jump destination was projected before the
camera settled; the retry then inherited the unfinished dungeon visit. The
corrective QA change waits for a visible ground destination and returns the
dedicated character to town after inspection failures or before a resumed run.
That initial attempt did not go live; the correction below subsequently did.

Correction pushed as `434216c7224392e936bd50d99620671cd6b22120`, with run
`33988179112` now completed successfully, including deployment and all live QA.
Independent frontend and backend checks report Alpha 1.0.3 and that exact SHA.
The corrected portal test passed against
an exact detached copy of that commit, not the newer uncommitted dungeon work.
Its disposable API/Mongo data and temporary verification worktree were removed.

Confirmed reproductions and changes:

- Scaled Rustbound Colossus and Hollow Sentinel client bodies stopped melee
  players outside the server's attack range. Replicate the authoritative actor
  body radius through JSON and protobuf, including stationary radius/scale
  changes. Decorative model bounds no longer determine multiplayer collision.
  Real server Fighter/Cleric attacks at the replicated contact boundary damage
  all 22 dungeon bosses plus the four elemental raid bosses and Dark King
  (27 boss types) in focused race tests; client collision and production
  synchronization tests pass. Browser picking, kills, and quest credit remain open.
- Recall/respawn during an old charge retained dungeon destinations and height,
  moving the player away from the town spawn on the next update. Reset departed
  movement state under the player lock and reject stale movement samples using
  the existing recovery window. Client transitions clear predicted movement and
  queued casts. Generation guards stop late town/legacy dungeon loading from
  overwriting a newer instance. The old failure and repaired next-update positions
  are covered by server/client tests, not yet all live recovery scenarios.
- Actual Wizard Teleport casts in Air, Fire, and an offset dungeon were clamped
  to the old overworld rectangle. Use the current world bounds only outside an
  instance; preserve dungeon walkability constraints inside. Server tests cover
  all four realms and a dungeon at coordinates (20000, 20000).

Final candidate unit checks: 147 client suites / 2,111 tests and the full server
race suite pass. Coverage includes 41 collision/transition tests, 249 focused
version/menu/Wizard checks, 27 boss-contact types, and all 52 selectable abilities
casting inside a registered offset dungeon without displacing the caster or
owned entities into another instance/coordinate space. That last check is not
proof of delayed damage, wall rules, rune variants, or visible effects.
Lint and whitespace checks pass. Login, runtime defaults, and patch history now
identify the local 1.0.3 candidate. The browser portal route now includes real
re-entry and mid-jump recall, with a post-arrival stability check; it is enabled
for both predeploy and live CI. The isolated real-server route passes, including
both returns to Lanternhold with settled scenery, cleared dungeon collision,
stable position, and no remaining jump/charge. Temporary Mongo/API containers
and their data were removed by the runner. Earlier attempts exposed an occupied
development port and two test assumptions (town's existing 0.5m presentation
lift and repeat visits already at maximum zoom); the final run used port 4185
and corrected those assumptions without weakening the recovery-state checks.
All eight anonymous browser release checks also pass on the final candidate.
Publication and live verification of 1.0.3 are complete; the wider 1.1 gate is not.

## Alpha 1.0.4 — roads that remember

Status: pushed as `40658d07538404e3db1c9ac5c3a6d82e47bcc785`. CI run
`33990677342` failed before deployment: client/server checks and eight browser
tests passed, but the production-layout fixture timed out twice while capturing
a screenshot on hosted Chromium. The unchanged fixture is being moved to the
existing hardware-Chrome predeploy gate, retaining all 20 layouts and High/Low
captures. The previous 1.0.3 release remains live. A corrective 1.0.4 candidate
also addresses the renewed first-boss report below; it is not yet published.

Correction published as `b888f7f0bdd290ecabc5de4418bc5b66e0562afc`.
CI run `33992723668` passed every job, including both deployments and live
character/class/multiplayer QA. Independent frontend `release.json`, entry-point
asset query, login version, patch history, and backend `/healthz` match Alpha
1.0.4 and that exact SHA. The real Wizard route killed Rootbound Warden and
Briar Matron, cleared intervening encounters, and returned to town both before
deployment and against production. The initial failed push did not go live;
this corrected release did. Wider dungeon gates remain open.

- Four regional generators now have a local seeded RNG independent of global
  combat/loot traffic. Production retries receive distinct deterministic seeds;
  the successful seed, generator version, attempt, and fallback marker travel
  with the layout and survive database mapping, JSON, and restore. Existing
  saved geometry is not regenerated. Fixed-layout Umbral/raid instances share
  the diagnostic identity. The four global-RNG dependence repros fail before
  the change and pass afterward.
- Real client fixtures exposed the old X=50000 scene boundary pushing Water
  positions and excluding Umbral/crystal-raid space. Canonical dungeon collision
  now uses its own walkable area instead of that unrelated envelope. The client
  still enforces its walls/union; clearing the instance restores the scene guard.
  All six Water/Umbral fixture failures pass after the fix, along with explicit
  tests at every dungeon/raid origin from X=50000 through X=110000.
- Added [seed capture/replay instructions](dungeon-seed-replay-qa.md), 1,500
  production layout checks, 20 shared server-generated fixtures, actual client
  floor/collision traversal sampling, and a browser geometry/High-Low fixture
  check. The latter now runs in the hardware-Chrome predeploy gate after the
  hosted screenshot failure described above.
- Dungeon entry also retained departed charge/jump targets: a reproduced jump
  sent the newly entered player to (0,0,0) on the next update. The shared scene
  movement reset now runs on entry under the player lock. Recall/respawn still
  preserve cooldowns and buffs. Focused entry/recovery/restore race tests pass.
- Added a visible Escape-menu Return to Lanternhold (B) action using the shared
  keyboard recall path. Updated help and completed-dungeon routing text so they
  do not imply that a player must backtrack to a physical exit. UI callback and
  menu tests pass.
- The real Water route exposed a stale legacy socket reference after reconnect:
  movement and recall used the new connection, but Continue Party Run sent to
  the closed original socket. The engine's compatibility accessor now follows
  NetworkManager's active socket. A focused regression and the actual browser
  route pass. The route verifies eastward Water movement, session resume, menu
  recall, and re-entry with unchanged instance ID and exact generation seed.
  It is included in predeploy and live CI. Camera-follow reprojection corrected
  the guide-selection test without bypassing real mouse interaction.
- Running Water after the existing Verdant tests exposed incorrect party-leader
  detection in both menu status and reset authorization: the handler compared
  the party ID, not its leader ID. Corrected both tuple reads. Reset now rejects
  an occupied instance under the world lock instead of deleting its players.
  A dispatch-level regression reproduced both failures, then passed leader/member
  status, non-leader rejection, occupied-run preservation, and empty-run reset.
  Successful resets now use system chat rather than an error frame; the combined
  Water run exposed that misleading success-as-error response after all gameplay
  assertions had passed. The final full server race suite passes with these fixes.

Earlier evidence: 148 client suites / 2,138 tests and the full server race suite pass.
The additional diagnostic-seed test passes in a focused 16-test containment run;
the explicit reported-seed replay command passes. All 20 browser fixtures pass.
Inspected Water High and Umbral Low corridor screenshots: floors are continuous
through the shown joins. The browser check captures both qualities for all ten
dungeon/raid families, but this is not a claim of whole-run visual inspection or
real-player combat/traversal. The final server race suite and lint pass; all nine
anonymous browser checks pass, including the 20 production fixtures. The focused
Water gameplay route passes with normal entry/reconnect/menu recall/re-entry.
The final client suite passes all 148 suites / 2,142 tests. Two older test harnesses
were updated to stop assigning the now-read-only compatibility socket accessor.
The first full updated character QA sequence completed its authenticated gameplay
assertions but failed the final browser-error check on Chrome
`ERR_NETWORK_CHANGED`; the focused portal route also passed in that attempt.
The next run passed all three authenticated routes, then exposed the leader
bug above when resetting the earlier Verdant run before Water. The corrected
complete sequence passes: all three authenticated routes, Water reset/entry/
movement/reconnect/menu recall/re-entry, acknowledged movement smoothness, all
four class ability/rune matrices, and two-account remote effects/movement/combat.
The artifact credential scan passes. Disposable API/Mongo containers and data
were removed by the runner. Final whitespace checks pass; the added patch notes
pass the 177-test version/history suite. Publication and live verification remain
open for this candidate.

## Dungeon investigations still open

The renewed Verdant first-boss/no-later-spawns report exposed another confirmed
failure: room rewards acquired instance -> actor locks, while enemy movement
held actor -> instance locks. A deterministic real-layout regression reproduced
the deadlock. The candidate reserves each room reward under the instance lock,
copies its context, then releases it before touching actors. The regression,
32 concurrent once-only reward attempts, and full server race suite pass.
A new real-input Wizard route passed ordinary kills, Rootbound Warden, later
rooms, Briar Matron, both boss-room clear assertions, and town recall. It does
not use forced kills or inside-instance waypoints. A starter-equipped Fighter
landed steady basic attacks (approximately 540 damage per 15 seconds), but the
15,000-health first boss exceeded the original two-minute encounter deadline.
That run is not recorded as a boss-kill pass. Follow-up melee QA selects the
normal level-unlocked Whirlwind/Shield Slam specialization through its skill UI.
The final Fighter sequence passes Water movement/reconnect/recall/re-entry,
normal reset into fresh Verdant, ordinary enemies, Rootbound Warden's death,
later enemies, Briar Matron's death, both room-clear checks, and town recall
(3.7 minutes total). World-state heartbeat assertions remain active throughout.
The input helper can click a visible point on tall hitboxes when their center
is behind the HUD; no target, health, or progression state is injected. The
credential artifact scan passes, and disposable containers/data were removed.
The client suite was rerun after the final helper changes: all 2,142 tests pass.
The corrected hardware layout fixture passes all 20 layouts and High/Low
captures in 10.8 seconds total. Full client checks pass 148 suites / 2,142 tests;
the full server race suite, lint, and 177 version/history tests also pass.
This repair is now live as recorded above, but does not close all dungeon gates.

## Alpha 1.0.5 — your party holds its ground

Pushed as `3443609cb4d29b20bedb18688fe6ed8898f7ba19`, CI `33995464506`.
Server/client/browser and full disposable predeploy character QA passed, followed
by both deployments. Independent frontend `release.json` and backend `/healthz`
checks report Alpha 1.0.5 and that exact SHA. The run subsequently completed
successfully, including live persistent-character, four-class and remote-animation
QA. The full release is verified.

Confirmed regressions: returning through the dungeon portal moved all members
back to the entrance, a low-level dungeon request could enter a saved higher-
level/Chronicle-gated dungeon or raid, and a non-leader could create a new run.
Dispatch-level tests reproduced each before the change. Entry now resolves the
saved run, checks its real access requirements and moves only the caller on
resume. New runs remain leader-owned and validate the group before creation.
Concurrent duplicate enters are idempotent and preserve movement/geometry.
Qualified raid members can resume an existing formed raid individually without
repeating its launch ready check; initial raid creation retains the full group,
readiness and Chronicle requirements. Unqualified replacements cannot enter.
The menu displays the saved name, difficulty and level with immutable controls.
Login registration now marks restored dungeon membership active; previously
restored instances retained their empty timer even with a player inside. The
new restart/login regression verifies the timer and room-summary initialization.
Two-player real-browser recall/re-entry in both directions passes, followed by
the existing remote summon/effect/movement/combat assertions (1.3 minutes total).
The credential artifact scan passes and disposable services/data were removed.
The full server race suite passes. A prior failure was an old hazard-transfer
fixture entering a nonexistent dungeon; it now creates a real run and retains
the hazard-reset assertion. The full client suite passes 2,146 tests with the
release metadata updates. The complete isolated sequence passed all authenticated
routes, Water recovery, both Verdant boss deaths/return, smoothness, Fighter and
Rogue matrices, then failed the Wizard's post-move animation assertion: the
helper can return after a short move has already completed. The observer now
records animation during the actual movement and still requires Run/Walk plus
authoritative displacement. Focused Wizard verification passes on the latest
server image (49.2 seconds including setup), with a clean credential artifact
scan and disposable cleanup. The full combined sequence is not yet recorded as
passed; predeploy CI will run it against the committed candidate. The latest server race suite
also passes the restored-login membership correction added after the first
isolated image was built.
This work is deployed as recorded above and does not close the full 1.1 gate.

## Alpha 1.0.6 — every road has an ending

Pushed as `8027f221952156a6a7d4c2ee0ac8f24b60f2e3b3`, CI `33997180208`.
Server, client, anonymous browser and disposable predeploy gameplay gates passed.
Both deployments completed, and independent frontend/backend endpoints report
Alpha 1.0.6 with this exact SHA. Final live gameplay checks are still running.
The next push can now queue safely: deployment's branch-tip checks have finished
and workflow concurrency has `cancel-in-progress: false`.

The old retry-exhaustion path removed generated actors and returned only an empty
start room. Required-encounter regressions failed for all ten dungeon/raid types.
The candidate builds connected ordinary/elite/boss blocks covering the catalog,
including the elemental raids' terminal crystal Vigil hook. New attempts check
both boss-room count and actual required boss spawns inside those rooms. Tests
force eight failures at all three difficulties, verify failed actors are removed,
preserve unrelated instances, and require every encounter without pre-clearing
rooms or granting rewards. A successful third attempt also stops retrying normally.

Generator identity advances to 2. Valid saved version-1 layouts remain exact;
only flagged one-start-room fallbacks are upgraded on restore. Persistence tests
retain exploration, cleared bosses and reward flags without spawning cleared
encounters. The configured QA-account allowlist can select the next fresh fallback
through a one-shot chat command; normal level, party and Chronicle gates remain
enforced, and resuming a saved run does not consume this selection.

The complete server race suite exposed a missing ordinary actor in one Water
fallback. Dungeon spawns used only 10,000 random suffixes and could overwrite an
existing actor. Deterministic regressions occupying all old suffixes reproduced
this across regional, Fire and Air spawn helpers for ordinary and elite enemies.
Collision-safe suffix selection now checks the world registry before insertion;
it does not alter the independent geometry random stream.

Thirty production/fallback browser fixtures pass their real-coordinate route
collision and single-floor coverage checks at High/Low (22.8 seconds). Inspected
Verdant High and Dark King raid Low fallback joins are continuous. These are
rendered geometry checks, not completed raid encounters. The first full fallback
Fighter run killed Rootbound Warden and Briar Matron but exceeded its encounter
deadline on Rustbound Colossus: the test's fixed four-unit range suppressed both
melee skills at large-body contact. Real server Whirlwind and Shield Slam tests
pass at all four Verdant bosses' replicated body boundaries. The browser helper
now casts through the hotbar at the normal basic-attack boundary. The full fallback
rerun passes all four boss deaths, boss room clears, increased gold and town recall
in 8.2 minutes, without forced kills or in-instance waypoints. It uses the existing
level-100 QA setup and entrance protection, so it is a functional check, not a
level-appropriate balance claim. This browser image predates the ID-collision fix;
the final full server race suite passes with that fix and the legacy-save recovery.
Artifact credential scanning passes and disposable services/data were removed.
The workspace client suite passes 148 suites / 2,158 tests (including the new,
separately staged quest-icon regression for the next UI update). Lint and whitespace
checks pass. Release metadata and patch notes are ready for 1.0.6; publication
remains open until the committed candidate clears CI and live verification.

- DUN-01: targeted movement/scene fixes and the Verdant mid-jump recall route
  shipped in 1.0.3. Water reconnect/menu recall/re-entry passes on the 1.0.4
  candidate. Wipe, remaining dungeons, and party variants remain open.
  The 1.0.5 candidate resolves Continue Party Run's settings display and
  member-specific re-entry with actual saved-run access checks. Two-player
  Heroic Water recall/re-entry passes in both directions. Other dungeons,
  completed/wiped runs and actual group raid recovery still require evidence.
- DUN-02: contact/range mismatch reproduced and repaired in 1.0.3; mouse picking,
  all-class full combat, boss deaths, loot, and progression still need validation.
- DUN-03: Teleport failure reproduced and repaired in 1.0.3; remaining abilities,
  rune variants, wall restrictions, presentation, and instance isolation need
  systematic coverage. Neither this nor the projectile fix proves all skills work.
- DUN-04/05: multi-dungeon player-controlled traversal, reported failing-seed
  capture, and repeated scene-lifecycle checks remain open. The next local
  hotfix now supplies real seed sweeps and rendered
  fixture coverage; these are stronger evidence, not completion of the play gate.
  The 1.0.6 candidate replaces the confirmed empty retry-exhaustion fallback and
  forces that path in encounter tests. Full Verdant fallback Fighter progression
  passes as recorded above; other regional and raid runs remain open. Do not
  treat the seed sweep as covering this whole gate.

Alpha 1.0.6 publication is now verified: commit
`8027f221952156a6a7d4c2ee0ac8f24b60f2e3b3`, CI run `33997180208`, completed
successfully including predeploy, both deployments, and the live class/remote
matrices. Both public release endpoints independently reported this exact version
and commit while 1.0.7 was in predeploy QA.

## Alpha 1.0.7 — your bag, your adventure

Added in response to the player's bag-icon, drag-out drop and tracker-selection
requests while 1.0.6 passes through deployment:

- Four authored elemental SVG icons cover every server Chronicle drop name.
  A generic Chronicle relic fallback prevents future quest items from going blank.
  Shared inventory icon resolution also covers tooltips/stash consumers.
- Dragging a bag item onto the actual world canvas requests an authoritative
  whole-stack ground drop at the character's current position and instance.
  Quest items, stale indices/IDs, duplicate requests, dead/disconnected players
  and active trades are rejected. Items retain stack, stats, sockets and identity.
  No bag removal is predicted before the server acknowledges it. Dropped loot is
  public and follows the existing one-minute expiry; bag guidance explains this.
  Deliberate drops are excluded from this session's auto-loot selection but can
  be manually picked up. Pickup now also rejects cross-instance and dead actors.
- Journal checkboxes select any accepted daily and the story chain. Choices are
  saved per character in browser storage, tolerate unavailable storage, and follow
  the next story chapter. Custom selections are not truncated to three cards;
  the bounded tracker scrolls, including at short screen heights. Default tracking
  remains the initial three until the player customizes it. The existing compact
  party-roster mode still shows the Journal shortcut instead of overlapping cards.

Evidence: focused unit checks cover arbitrary selections, more than three tracked
quests, an intentionally empty selection, per-character reload isolation, chapter
handoff, icon catalog parity, canceled/invalid/quest-item drags, delayed inventory
acknowledgement and auto-loot exclusion. Server checks preserve a complete item on
drop/pickup, reject cross-instance pickup, validate failed drops leave state intact,
and accept exactly one of 32 concurrent duplicate requests. Dispatch tests require
the inventory acknowledgement and reject replay. The full server race suite passes.

A disposable real-browser route passes earned loot → bag drag-out → ground item
survives auto-loot cycles → ordinary mouse pickup → fresh-login inventory and
tracking-preference persistence (21.7 seconds including setup). Its first attempt
incorrectly assumed the fresh starter model represented owned equipment; the
corrected test acquires an actual server drop through the existing QA loot route.
This is an inventory test, not evidence for level-appropriate combat balance.
Credential artifact scanning passes and disposable services/data were removed.

Two anonymous browser checks pass (8.4 seconds): all four icons decode at 48px,
and nine selected objectives remain reachable by ordinary tracker scrolling.
Inspected the icon strip and tracker crop. An initial fixture placed the journal
halfway down the screen without its normal centering transform; positioning the
fixture inside the viewport resolved that test-only failure. These checks join
the predeploy gallery; the real bag route joins disposable full-character QA.
The full client suite before final release metadata passes 148 suites / 2,165
tests. Version metadata, login text and patch notes advance together to 1.0.7.
Publication is pending the 1.0.6 deployment and final candidate checks.

Final candidate checks pass: 148 client suites / 2,166 tests, the full server race
suite, lint and whitespace checks. The new real-browser inventory route and both
visual checks also pass as recorded above. Neither this quality-of-life patch nor
the fallback repair closes the broader 1.1 dungeon, party, ability and PvP gates.
Checkbox updates also preserve keyboard focus and journal scroll position; a
storage-blocked regression verifies that selection remains usable without browser
persistence. This final UI refinement is included in the candidate.
The final full client rerun passes all 148 suites / 2,167 tests; lint and
whitespace checks remain clean.

Published as commit `015f3cd4258c8cb2cf65e16b2529dc9ad922c418`. CI run
`33998433871` has passed server/client suites, browser smoke, disposable
full-character predeploy QA, and both deployments. Both public release endpoints,
the login label and the client entrypoint release query independently match
Alpha 1.0.7 and that exact commit. Post-deployment live gameplay QA is running;
its terminal result is now **success**. CI `33998433871` completed successfully,
including all post-deployment live gameplay, class and remote-animation checks.

Additional DUN-02/04 evidence: the full **generated** Verdant Fighter route passes
in 7.5 minutes (`/tmp/eidolon-full-generated-verdant-1-0-7.log`), with ordinary
combat, all four actual boss deaths, room completion, increased gold and town
recall. This complements the forced-fallback run above, but remains one generated
instance of one dungeon/class, with level-100 QA setup and entrance protection.
It is not a balance test, three-seed proof, campaign credit proof or a party run.
The original log omitted the generated seed; subsequent Verdant routes now log
seed, generator version, attempt and fallback status without account/instance IDs.

## Alpha 1.0.8 candidate — the last teammate standing

The next 1.1 PvP corrections were reproduced with failing regressions: one death
awarded a 2v2 round immediately, and a practice duel changed rating, wins, honor
and season points. The candidate now records each elimination once and awards
a round only after the whole opposing team is eliminated. Intermission suspends
hostility and rejects further death records; one round-scoped timer restores all
participants before incrementing the round. Stale timers cannot reset later
rounds. Client opponent lists follow the same elimination/intermission state.

Only ranked arena modes update ranked profiles; duel completion/forfeit leaves
existing profiles unchanged and creates no new profile. Practice forfeits do not
apply a ranked queue penalty. Results notify every participant independently of
profile persistence, and completed match/challenge fields clear from UI snapshots.
The panel explains the actual damage scalar/burst cap instead of claiming full
stat normalization. Rating-aware matching, normalization policy, seasons and
anti-farming remain 1.7 work, not claims of this patch.

Town recall/respawn returns an actionable error during a PvP match, without a false
overworld transition. The death screen instead explains teammate survival, round
recovery or automatic return, and offers explicit forfeit where applicable.
Match startup/reset/completion reset movement and acquire actor locks without
holding the PvP lock, preserving combat's actor-to-PvP lock order.

Evidence: server regressions cover duplicate and 32 concurrent death records,
survivor hostility, round intermission, early/stale resets, re-entrant state
callbacks, both teams' best-of-three rewards exactly once, practice results and
forfeits, recall/respawn world and dispatch rejection, and result messages without
database writes. A full server-combat test uses ordinary asynchronous melee hits,
waits out production protection clocks, observes the first elimination surviving
the old three-second reset window, and completes both rounds and restoration
(13.32 seconds). Positions are test fixtures; health is never forced and this is
server combat evidence, not a four-browser player-control test.

Full final-candidate server race suite passes; client suite passes 148 suites /
2,170 tests after version/patch-note updates. Anonymous real-Chrome feedback QA
passes; screenshot inspection identified the old cramped horizontal match card.
It is now a two-column score/action layout with full-width title and guidance;
the recheck passes in 5.5 seconds and the corrected screenshot is inspected.
The check covers survivor count, forfeit clicks (not town respawn), automatic
recovery text, disabled return button and cleared result snapshot. It joins the
predeploy UI gallery. Lint and whitespace checks pass. Final publication/live
verification are pending; 1.0.7 has now finished both deployment jobs, so this
candidate can enter CI without changing the prior deployment's branch tip.
The broader 1.1 gate stays open.

Published the PvP candidate as commit
`968c2c722d8fc7cef200224a352b7fa713079608`, CI `33999632052`. Server/client suites
and browser smoke pass; disposable predeploy character QA and both deployment
jobs now pass. Both public release endpoints, the login label and entrypoint
release query match this exact Alpha 1.0.8 commit. CI `33999632052` now completed
successfully, including all post-deployment gameplay and class/remote checks.

## Continued 1.1 dungeon verification

The full player-control route is now parameterized for the five catalog dungeons,
difficulty and run level, with logged replay identity and completed-run re-entry
assertions. The server body-contact matrix expands to all four classes and adds
220 skill/rune/instance-isolation combinations. These are meaningful partial
checks, not closure of the all-class/all-dungeon player-control gate.

Molten Core's full Fighter route passes in 23.8 minutes after resolving a
locked-portal test assumption and replacing its too-short two-minute combat timer.
It covers all five bosses, every encounter room, gold, recall and completed-run
re-entry without duplicated gold. A distinct solid-wall projectile bug was
reproduced and repaired locally; fresh-server Wizard browser verification now
passes in 11.3 seconds, including actual wall contact and zero-radius presentation.
It exposed a protocol-layer zero omission that is also repaired and regression
tested. Commands, seeds, exact limitations and
run results are recorded in [the playthrough evidence](dungeon-playthrough-evidence.md).

## Alpha 1.0.9 candidate — walls hold, roads continue

Packages the verified ground-projectile wall repair and explicit zero-radius
impact transport/rendering with the expanded dungeon verification routes. It also
corrects Ilyra's opening objective and daily descriptions to name Lanternhold,
with a regression preserving acceptance and kill count on existing characters.
Other cross-wall ability types, secondary effects and the full 1.1 matrix remain
open; the patch notes do not claim those fixed. Login, package, server/container,
deploy and CI release defaults advance together. Final candidate checks pass:
the complete server race suite, 149 client suites / 2,180 tests, lint and
whitespace validation. Publication and live results follow below.

Published as `20eadc9483abbc6d2bd19f1bde0a2a3f78bda4b9`, CI `34001977877`.
Client/server checks, browser smoke, predeploy gameplay QA and both deployment
jobs pass. Both public release endpoints, the login label and runtime entry query
match this exact Alpha 1.0.9 commit. CI `34001977877` completed successfully,
including post-deployment gameplay, all four classes and remote-animation QA.
The complete Abyssal Well Fighter attempt used this clean commit, generator 2 seed
`-7057617757322159080`, Normal 60. All first four bosses were defeated, but the
character died during a Siren encounter before Thalorath after 18.7 minutes.
This is not a full-run pass. The failure and normal defensive/rune/wipe-control
follow-up are recorded in the playthrough evidence ledger.

## Alpha 1.0.10 candidate — paths, not just landings

Endpoint-only movement checks allow Charge, Shattering Charge, Teleport and
jumping to skip a solid wall when the landing is in another valid room. Twelve
ordinary-dispatch charge/teleport regressions and two authoritative jump cases
reproduce the problem. Ground-targeted movement now clips its complete path
through the canonical floor union, preserving open doorways, existing realm
bounds and invalid-position recovery. Charge/Teleport events and jump targets
carry the actual bounded destination. Normal walk-target selection and AI routing
are unchanged.

The matrix covers base/Momentum Charge, Shattering Charge, base/Blink/Warp
Teleport, two distant coordinate regions, solid gaps and open doorways; jumping
adds ordinary and large simulation steps. The full server race suite passes
(`/tmp/eidolon-movement-walls-server-full.log`, game package 110.292 seconds).
Six further red cases reproduce Rogue movement, damage and debuffs through a
thin wall. Shadow Strike, Shadow Lunge and Backstab now require an accessible
target before mana/cooldown commitment; blink landings also clip the full path.
Open doorways retain damage and representative rune effects. The expanded server
race suite passes (`/tmp/eidolon-movement-rogue-server-full.log`, game package
142.951 seconds); additional legacy/recovery matrix checks pass in 6.937 seconds.
Rejected casts now explain their requirements, action locks and cooldowns while
reconciling authoritative resource state. The client suite passes 149 suites /
2,188 tests before the subsequent charge-sync and release-note additions.

The fresh-server Wizard browser route passes in 13.1 seconds, including actual
Teleport events/landing, Ctrl-click jumps against the wall and on open floor,
and ordinary recall (`/tmp/eidolon-movement-wall-wizard-browser.log`). Fighter's
first attempt failed with its client stopping 2.8848 units short of the server
landing. Normal prediction's three-unit correction threshold did not reconcile
short server-driven Charge steps. Charge now reconciles each authoritative step
and its final landing while retaining ordered movement acknowledgements.
Focused client checks pass, and the unchanged Fighter browser assertions now
pass in 12.2 seconds (`/tmp/eidolon-movement-wall-fighter-browser-sync.log`).
Both disposable runs clean up successfully. The new route joins predeploy QA.
These are real-control wall/open-floor movement checks; crossing a gap between
two valid rooms is separately established by the server regression matrix.

Version defaults and patch notes advance to Alpha 1.0.10, not milestone 1.10.
The final client candidate passes 149 suites / 2,190 tests, with lint and shell
syntax checks passing. The final complete server race suite passes (game package
110.525 seconds). Publication remains pending. Cross-wall secondary/AoE
effects, ordinary movement authority, Rogue rendered wall checks and the full
dungeon/class/party matrix remain open. This is not 1.1 closure.

Published Alpha 1.0.10 as `6212ef3d50b7712126a1349fff50dcdd842d1930`, CI
`34003316079`. Client/server suites and browser smoke pass; disposable predeploy
gameplay QA **failed** at the multiplayer member's dungeon-guide re-entry. Its
retry then failed an overworld-only waypoint while still in the unfinished run.
Both deployment jobs were skipped. Alpha 1.0.9 remains the verified live release;
Alpha 1.0.10 has not deployed. The guide failure is under investigation.

## Continued 1.1 recovery checks — unpublished

The full Fighter route now selects Bloodwhirl, Fortify and Extended through the
rune UI and uses Iron Fortress/Guardian Roar alongside its damage skills. An
independent hotbar selector honors placement, cooldowns, class, charging, mana and
range; its nine tests pass. Actual server ability events must confirm all four
hotbar skills by the first boss kill. The new Abyssal attempt ran on
`6212ef3` with QA-route changes, seed `-412794620771892541`, generator 2 attempt 0,
Normal 60. First-boss events confirm all four skills. It killed the first four
bosses and reduced Thalorath to 18,626 HP while the Fighter remained at 2,575 HP,
then hit the aggregate 25-minute test timeout. This is a failed run, not full
completion/reward/re-entry evidence. The full route now has a 40-minute aggregate
budget consistent with five individually bounded six-minute boss fights plus
trash/traversal; its no-damage and individual encounter deadlines remain intact.
The new health logs exposed the old test's nonexistent `stats.mp` field. The
selector/telemetry now read `stats.mana` and reject missing mana; that correction
was made after this run started and is not evidence from this running attempt.
All requests still use normal client/server resource validation.

Recovery regressions reproduce two independent issues: dead recall created an
IDLE actor with zero health, and recall/respawn did not start the empty-instance
return window. Dead recall now requires explicit Respawn, with non-blocking client
guidance rather than an alert. Successful town exits update presence after
releasing the actor lock. One member leaving retains the occupied run; the last
starts its existing five-minute grace period; re-entry preserves room progress
and clears that timer. Dispatch, lock-order and membership tests cover these
contracts. Progress/death states in these unit tests are fixtures, not a claim of
a real party wipe. Two older chat/Chronicle test actors needed explicit living
health for their intended recall scenarios; the production health guard remains.

The corrected full server race suite passes (game package 134.295 seconds,
`/tmp/eidolon-dungeon-recovery-server-rerun.log`). Client suites pass 150 suites /
2,199 tests before the later recovery-guidance test; that addition and the hotbar
selector pass together (57 focused tests). Two additional regressions exposed
the client predicting recall for a zero-health actor before server acceptance;
both fail before the client guard and pass after it (59 focused tests total).

The actual level-30 Wizard route passes in 37.4 seconds, generator 2 seed
`-1986625632463315919`, dirty `6212ef3` candidate. It observes ordinary hostile
damage and death, rejected recall while still dead inside, explicit Respawn and
normal guide re-entry with the same seed and cleared flags. It uses no protected
waypoint or health/kill command. Log:
`/tmp/eidolon-dungeon-natural-recovery-browser.log`. The isolated predeploy chain
now runs this check on its own newly registered Wizard, not an earlier protected
combat character.

A fresh actual Cleric/Wizard multiplayer route passes in 1.0 minute, including
both member/leader-specific recall and same-run re-entry, remote casts, movement,
jump and browser error audit (`/tmp/eidolon-party-guide-investigation.log`). The
original CI guide failure has not reproduced; diagnostics remain in place rather
than claiming a proven gameplay cause. Retry setup now uses normal recall/Respawn
before asking for an overworld-only waypoint, fixing the separate retry failure.
The never-deployed 1.0.10 candidate retains its version and adds recovery patch
notes; full CI and exact live verification remain required before release.
The full dungeon/class/party and remaining ability-wall gates stay open.

The final client candidate passes all 150 suites / 2,202 tests in 58.59 seconds,
with lint, shell syntax and whitespace checks passing. Moving the recovery check
to a separate newly registered account first exposed an omitted disposable QA
allowlist entry (failed before dungeon entry); that account is now explicitly
included in the isolated server's allowlist. Production QA permissions are not
changed by this test-runner configuration.
The corrected fresh-account runner passes in 35.6 seconds on generator 2 seed
`5580111386158966775`, including actual death, rejected recall, explicit Respawn
and preserved-run re-entry; credential scan and disposable cleanup pass. Log:
`/tmp/eidolon-dungeon-recovery-fresh-account-allowlisted.log`.

Pushed the corrected 1.0.10 candidate as
`a8c09ef4db43162b4752437e757c70d4859b5bad`, CI `34005044422`.
Client/server checks, anonymous smoke and the High/Low gallery pass, but the
disposable gameplay job **failed again** at the multiplayer guide. Both attempts
failed its initial leader interaction (party route line 13), not member re-entry.
Diagnostics show a live socket, IDLE player at (-2.685579, 240.213598), no pending
interaction and no menu. Neither deployment ran; live remains verified 1.0.9.
Log: `/tmp/eidolon-1-0-10-recovery-ci-failure.log`. Click/request/response probes
and three repeated party-return cycles are being tested locally to find the cause;
do not call this fixed merely because one fresh standalone run passed earlier.

A clean full Abyssal Fighter run on this exact commit **passed in 29.1 minutes**,
seed `-3014860983784452515`, generator 2 attempt 0, Normal 60, with corrected mana
selection and the 40-minute budget. All five bosses, every encounter room, gold,
town recall and completed-run re-entry assertions passed. Log:
`/tmp/eidolon-1-0-10-abyssal-full-fighter-recovery.log`. Its image does not include
the following unpublished changes and it does not close the full 1.1 matrix.

## Continued 1.1 direct-target boundaries — unpublished

Twelve direct-dispatch cases reproduce six blocked-path failures: Smite, Mark of
Weakness and Weak Point Mark applied damage/debuffs and spent resources across a
solid gap, with either explicit targeting or cursor fallback. The local patch
uses canonical path validation for hostile direct targets, preserves friendly
support/legacy rules and open doorways, and commits these spells' resources only
after selecting a reachable target. Arcane Missiles no longer retains a rejected
explicit homing ID; ordinary cursor volleys still fire. The existing targeted
movement wrapper reuses the shared validation without a duplicate geometry scan.

Focused race checks pass for the 12 spell cases, four missile-lock cases, support/
legacy/isolation checks and the existing Rogue targeted-movement wall matrix
(latest 6.611 seconds). The first full server race run found an older contract
explicitly expecting Smite to spend its cast on a cross-instance target. That
contract now requires rejection with no damage, mana loss or cooldown. The full
corrected server race suite passes (game package 206.853 seconds), log
`/tmp/eidolon-dungeon-direct-skills-server-rerun.log`. These are server
fixtures, not rendered class playthroughs; rendered basic attacks, ground-targeted AoE and
secondary wall effects remain open. Nothing in this section has been published.
A real-input Cleric/Rogue mark test is prepared for empty-target rejection and a
server-accepted mark on a reachable ordinary enemy. Its first execution exposed
an accepted cursor-selected mark publishing an empty target ID. Three red server
cases reproduce the omission for both marks and legacy Smite. Those handlers now
publish the resolved target and its coordinates. The actual Rogue and Cleric
browser checks both pass (11.3 and 11.9 seconds including setup), log
`/tmp/eidolon-direct-target-resolved-browser.log`. They join the isolated predeploy
chain using the exact allowlisted class actors. The full Water run has finished;
an updated short Verdant Fighter route is checking the new basic-attack code.

Basic-attack regressions then reproduced wall-crossing admission with all four
classes, plus damage landing after a target moved behind a wall during wind-up.
The local repair validates both admission and actual impact against canonical
floors. Delayed attacks retain a private floor snapshot so impact validation does
not acquire an instance lock while holding an actor lock; old attacks cannot
follow actors into another scene. The post-delay damage body is extracted without
changing its damage rules, letting tests prove rejected impacts by synchronous
completion rather than an absence-of-events timer. Open-doorway dispatch still
lands real delayed damage for each class.

The basic/impact/snapshot, direct-spell and projectile-wall focused race checks
pass in 7.963 seconds (`/tmp/eidolon-dungeon-basic-wall-impact-green.log`). The
complete server race suite passes with this change (game package 224.471 seconds,
`/tmp/eidolon-dungeon-basic-wall-server-full.log`). A further red regression found
that the combat snapshot omitted InstanceID, sending actual basic and reflected
damage events with empty routing scope. The snapshot now retains its instance;
the focused event/basic/impact matrix passes (3.431 seconds). Another final full
race run passes after that last field correction (game package 146.604 seconds,
`/tmp/eidolon-dungeon-attack-routing-server-final.log`). The completed clean
1.0.10 Water playthrough predates these local patches and cannot verify them.

The guide failure reproduced in a fresh three-cycle multiplayer route. The click
probe records DungeonNPC before the click, no hit on the click's fresh raycast,
and an ordinary ground-move destination afterwards. No menu request or response
occurred; 937 state updates arrived while the test waited. The player was still
at z=217.28 during the click, proving the approach/camera had not settled. Log:
`/tmp/eidolon-dungeon-guide-click-probe.log`. The helper now waits for IDLE with
no movement destination and rendered actor/camera agreement before reprojecting
and clicking. This corrects a test timing error; production click raycasts still
use the actual click coordinates. The repeated route passes in 2.4 minutes: all
three cycles, both party roles, remote combat/movement and browser error audit,
log `/tmp/eidolon-dungeon-guide-settled-cycles.log`.

The updated client candidate passes all 150 suites / 2,202 tests (73.236 seconds).
The never-deployed Alpha 1.0.10 entry now includes the basic/direct wall and damage
routing corrections. The complete server race suite passes after the final
resolved-target event correction (game package 161.847 seconds), log
`/tmp/eidolon-direct-resolved-server-final.log`. The actual short Verdant Fighter
route passes in 3.5 minutes on dirty `a8c09ef`, generator 2 seed
`6311919532000196432`, Normal 30: Rootbound Warden and Briar Matron die, ordinary
encounters continue and town return succeeds. Log:
`/tmp/eidolon-direct-basic-verdant-browser.log`. This tests the new attack code,
but is not a full dungeon/class/party completion claim. Lint, shell syntax and
whitespace checks pass. The corrected candidate is ready for a new full CI run;
deployment and exact live verification remain unproven.

## Milestone tracking

1.1 remains open until all five dungeon reports meet their acceptance criteria,
alongside onboarding/reconnect and the initial PvP corrections. Releases 1.2
through 1.10 remain unimplemented roadmap work; none is closed by this hotfix.
