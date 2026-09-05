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

## Alpha 1.0.5 candidate — your party holds its ground

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
This work is not yet published and does not close the full 1.1 gate.

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
  Source inspection also confirms the retry-exhaustion fallback is only a start
  room, after generated encounters have been removed. Existing fallback tests
  prove offsets/connectivity, not bosses or progression. Replace this with a
  complete progression-safe fallback and explicitly force that path in tests
  before closing the gate; do not treat the seed sweep as covering it.

## Milestone tracking

1.1 remains open until all five dungeon reports meet their acceptance criteria,
alongside onboarding/reconnect and the initial PvP corrections. Releases 1.2
through 1.10 remain unimplemented roadmap work; none is closed by this hotfix.
