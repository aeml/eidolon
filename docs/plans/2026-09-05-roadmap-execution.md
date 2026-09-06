# Roadmap execution ledger

Objective: implement the full 1.1–1.10 roadmap step by step, deploying each version
with patch notes. Scope and completion gates remain in
[the roadmap](2026-09-05-v1-1-to-v1-10-roadmap.md); individual hotfixes do not close
the whole goal. Started September 5, 2026.

Current release queue (September 6): **1.0.19 (`200478f`) is deployed and verified**:
CI `34026658393` passed in full. Independent post-terminal frontend manifest,
login/runtime entry and backend SHA/version/database-readiness checks match
`200478fddd5c3e1f28f8ef5d93644df3395da020` / Alpha 1.0.19. Only the next exact
commit, 1.0.20 (`bd54b2aab3b56aa6c83efe40d6071e3881ba6074`), was pushed;
CI `34028688737` is running. 1.0.21's runtime (`0498ffe`)
had a QA-route gap: the earlier phone inventory test did not open Settings' Play
category. Test-only correction **`2f5c46b` passed its exact-source inventory route**
and is the next 1.0.21 commit to publish after 1.0.20's full gate. It was merged
forward as `e3bbcf7` so the 1.0.22 release remains a fast-forward descendant.
1.0.22's runtime (`ecf7524`) has passed its recorded checks; the new earned
Earth campaign route is now being tested on the working candidate. Neither
1.0.21 nor 1.0.22 is published. Push each exact next release only
after its predecessor's full gate.
Earlier entries describe their status at the time,
not the current queue. Do not publish a successor before the preceding version's
complete CI/live verification. The original 1.0.14 failure remains recorded below.

## September 6 continuation — dungeon class and campaign evidence

The previous goal turn completed the Settings/adventure candidates and exact-source
checks; it was progress, not completion of the roadmap. This continuation started
by confirming 1.0.19's CI was still live. It subsequently passed predeploy QA and
both deploy jobs; final live character QA is still running.

Clean `a323d96` passed a complete **Wizard Verdant run in 8.4 minutes**, Normal 30,
generator 2, seed `4005696311737504843`: all four bosses, all encounter rooms,
gold, town recall and completed-run re-entry. Credential scan and disposable
cleanup passed; session `18569` is closed. Full evidence and limitations are in
`dungeon-playthrough-evidence.md`. This adds another class, not the whole matrix.

The next dedicated `chronicle-earth` route is being prepared to earn the first
three Chronicle chapters through actual combat, natural relic drops and manual
turn-in, then prove the dungeon kill opens Rootheart access only after Ilyra's
completion dialogue. Level preparation and encounter travel/protection are
explicit; it does not grant quest progress, items or raid access and is not
fresh-level balance evidence. The implementation is test-only and not yet run.

Review also found the old phone bag QA route tried to tap hidden Auto-loot after
the 1.0.21 Settings reflow. In `/tmp/eidolon-release21-qa-iF7eif`, branch
`qa/phone-settings-inventory`, `2f5c46bef15601d965cda2bd098867cfe12b4b6d` adds
the real Play-category tap and scroll before the existing checkbox action.
Lint passes; exact-source real inventory QA is running in
`/tmp/eidolon-release21-inventory-route.log`. Do not publish the old `0498ffe`
without the correction, or claim the new route passed before it finishes.

The first worktree run stopped before login: its generated `vendor/` browser
dependencies had not been prepared when sharing the installed Node dependencies.
`npm run prepare:client` creates the required local Three/protobuf runtime files.
The exact same committed candidate is rerunning after this setup correction in
`/tmp/eidolon-release21-inventory-route-prepared.log`; the original failed route
does not supply gameplay evidence.

After preparation, exact `2f5c46b` **passed in 1.8 minutes**: normal combat loot,
Settings → Play, and both orientations' authoritative equip/unequip, canceled
drop, confirmed drop and manual recovery. Credential scanning and disposable
cleanup passed; session `94525` is closed. Merge `e3bbcf7` carries those two
test-navigation lines into the later release without changing its runtime.
The old `0498ffe` is superseded as the next publishable 1.0.21 commit.

The first earned Earth route failed after 38.4 seconds at collection turn-in:
four naturally acquired seeds remained visible in the client inventory after
Ilyra completed the chapter (expected zero). Server consumption already has
unit coverage; inspection found `MsgCompleteQuest` sends quests/endgame state
but no updated inventory. This is a real synchronization defect, not grounds to
remove the consumption assertion. Log: `/tmp/eidolon-chronicle-earth-first.log`;
credential scan passed and the isolated run terminated. The optional route does
not yet prove a campaign clear. A separate 1.0.23 correction will carry the
dispatch regression, inventory refresh and an earned-route rerun. The 1.0.22
client suite passed 163 suites / 2,352 tests; lint also passed. The earlier
"not yet run" statements above record preparation, not current test status.

## Alpha 1.0.22 — adventure within reach (local candidate)

Committed runtime: `ecf75247895a4021423c968187e4b143ef3ef901`. Its exact clean
source subsequently passed the complete phone adventure route in **12.7 seconds**,
with credential scanning and disposable cleanup. Log:
`/tmp/eidolon-1-0-22-exact-adventure.log`. Local browser session `91715` is closed.
The following entries retain the implementation/reproduction sequence, not an
unresolved test failure. The release still awaits its ordered publication turn.

Phone dungeon/raid selection has readable native choices and controls, expandable
party/difficulty/daily-reward details, remembered tab scroll, and an always-reachable
Start/Continue footer with the actual selected run summary. Raids hide the dungeon
footer. Existing run settings, follower permissions and Chronicle unlocks are
preserved. Phone reset requires confirmation and is absent without an instance;
cancel preserves the run and focus. The server's occupied-instance rejection is
unchanged. Chat can close the guide and open its composer without disappearing.

Six of seven new unit regressions failed before implementation; the existing
story/leader gate check already passed. Focused checks passed 109 tests; the
initial full run passed **163 suites / 2,351 tests in 58.187 seconds**, plus lint.
Three initial phone layouts passed in **14.3 seconds** at 360×800, 390×844 and
844×390. Inspected dungeon, raid and reset captures with 125% menu text.

The first real-server route entered Verdant and recalled, then failed to walk
after landscape rotation. A diagnostic repeat proved the populated party roster
was above the joystick: `elementFromPoint` returned a `.party-member`, joystick
input stayed zero, and both client/server positions remained at town spawn. A
dungeon creates a party even for a solo player. The landscape roster now occupies
space between the thumb regions. No movement/server guard was bypassed.

The new anonymous populated-party test initially used a desktop browser identity,
causing the application's resize handler to leave mobile mode. Its first cleanup
also obscured the assertion by sending touchEnd without an active touch. Those
test issues were corrected: a phone identity and safe touch cancellation preserve
the original assertions. This does not invalidate the separate real-phone-mode
server reproduction. All **five layout/HUD checks passed in 32.4 seconds**,
including joystick acquisition/release with five seeded members and controls at
390×844, 844×390 and 568×320. The very small landscape case proves thumb access,
not full visual acceptance; header/status overlap and party readability still
belong to the remaining phone polish work.

The corrected real-server route passed in **12.3 seconds**: default-zoom joystick
approach and guide tap, level/story restrictions, initial entry, fully rebuilt
town recall, landscape continuation of the same instance, canceled reset, and
confirmed reset creating a different instance. Only level 30 was prepared;
no instance, crystal access, kill or quest credit was granted. Credential scanning
and exact disposable cleanup passed. This is entry/recovery evidence, not a full
dungeon clear, group combat or physical-device test.

Logs: `/tmp/eidolon-phone-adventure-{red,unit,client,layout,gameplay,diagnostic,layout-device,gameplay-fixed}.log`.
Separate 1.0.22 patch notes and all version defaults are updated. Final versioned
client/lint/server and 28 anonymous checks followed by the real-server route are
running under `/tmp/eidolon-1-0-22-`. No publication or full milestone sign-off
is claimed.

Final versioned checks passed **163 client suites / 2,352 tests in 66.161 seconds**,
lint, server race checks (root 9.683 seconds; game package cached), and all
**28 anonymous browser checks in 2.5 minutes**. The real-server repeat then found
the test's full-speed joystick controller oscillating across its arbitrary
one-metre waypoint: client and server positions agreed around Z=235.53 and 238.23,
with nonzero input. This is distinct from the confirmed zero-input roster overlap.
The fixture now stops within the guide's existing interaction radius (with a
0.5m margin), not at an irrelevant exact waypoint. It still must open the guide
by actual touch and pass every server-owned entry/recall/continue/reset assertion.
The corrected route is running in `/tmp/eidolon-1-0-22-adventure-range.log`.

That fixture revision initially read the guide before town's throttled actor
queue had recreated it after recall. It now explicitly waits for the real guide
actor before reading its radius. The original scenery/collision/position recall
assertions remain, with additional actor readiness rather than a fixed sleep.
Latest route log: `/tmp/eidolon-1-0-22-adventure-ready.log`.

The corrected final route **passed in 13.6 seconds**, including credential scan
and exact disposable cleanup. Browser session `28148` is closed. Together with
the full versioned checks above, this makes 1.0.22 ready for a separate local
commit. The fixture corrections made no runtime changes after the passing
28-case anonymous suite. Publication remains queued behind 1.0.19–1.0.21.

## Alpha 1.0.21 — comfort without losing the view (local candidate)

Committed as `0498ffed14591c10c2d3072a287958e68eed71ff`. Its exact clean source
passed the Settings real-server route again in **8.1 seconds**, with credential
scanning and disposable cleanup. Log: `/tmp/eidolon-1-0-21-exact-settings.log`.
Still queued locally behind 1.0.19 and 1.0.20.

Phone Settings reuses the existing native controls in four readable categories:
Screen, Play, Sound and Device. Navigation and Close remain outside the content
scroller; controls have at least 44px hit areas. Menu text can grow from 100% to
125%, with a separate phone preference, without scaling the world, camera or
desktop layout. This is menu text sizing, not completion of the whole HUD-scale
or physical-phone gate. Settings replaces the pause menu, and tapping the permanent
chat strip closes Settings so the composer is reachable after rotation.

A regression also found missing brightness storage being converted from `null`
to numeric zero. Fresh settings now use the documented 50% renderer default;
an explicitly saved zero remains zero. Initial HTML output now matches that default.

Evidence and corrections:

- Two independent phone-text preference tests failed before the implementation;
  the fresh-brightness test separately reproduced 0 instead of 50.
- Initial rendered layouts failed in both portrait sizes because the new flex
  panel lacked column direction. Correcting composition restored all three cases.
  Visual review then kept category labels unwrapped and the chat strip unobscured.
- The first real-server Settings route found the old pause menu intercepting
  chat after rotation. Closing it when opening Settings fixed the actual route;
  no forced click or weaker assertion was used. The corrected route passed in
  9.3 seconds before the final versioned rerun.
- Final versioned checks passed **162 client suites / 2,344 tests in 60.087
  seconds**, lint, server race checks (root 10.216 seconds; game package cached),
  and **24 anonymous browser checks in 2.0 minutes**.
- The final fresh-character real-server route passed in **8.4 seconds**: native
  touch text sizing, graphics/audio/loot preferences, unchanged camera zoom and
  character position, landscape chat, and reload persistence. Credential scanning
  and exact disposable cleanup passed. No level or progression grants were used.
- Inspected 390×844 and 844×390 Settings captures at 125% and the enlarged
  landscape rune card. Layout coverage also includes 360×800. These are desktop
  Chrome touch emulation, not physical iOS/Android performance evidence.

Logs: `/tmp/eidolon-1-0-21-{client,lint,server,anonymous,settings}.log`.
All login/package/server/deployment version defaults and separate patch notes
identify 1.0.21. Essential dungeon-guide touch flow is next; remaining menus,
physical devices, full dungeon coverage and the broader roadmap gates stay open.

## Alpha 1.0.20 — a build you can read (local candidate)

Committed locally as `bd54b2aab3b56aa6c83efe40d6071e3881ba6074`. Its exact clean
commit subsequently passed the expanded real-server phone build route in
**12.9 seconds**, including credential scanning and disposable cleanup.
Log: `/tmp/eidolon-1-0-20-exact-build.log`. Not yet published.

Phone Skills, Talents, Runes and Combos now have readable cards, permanent section
navigation outside the scroller, explicit build actions and preserved reading
position. Rune selection filters to one ability. Talent reset requires confirmation;
the phone UI never mutates shared ranks optimistically. Correlated server receipts
plus authoritative state confirm changes. Reconnect waits for a full build snapshot
without replaying an interrupted request. Desktop rendering remains on its existing
path. Current level-gated branch progression is explained, not redesigned.

Six new behavior tests failed on the prior UI and passed after implementation.
The initial full client run passed **161 suites / 2,329 tests in 53.91 seconds**,
plus lint. Server race tests passed (root 9.378 seconds; unchanged game package
cached), including new action receipts, rejections and legacy compatibility.
The initial server run caught a violation of the dispatcher's single-switch
architecture guard; moving request-ID parsing into the individual handlers
restored the guard without weakening it.

All three touch-layout cases passed in **11.4 seconds** at 360×800, 390×844 and
844×390; portrait and landscape rune captures were inspected. The first real-server
route confirmed branch and talent actions, then failed because its test selected
Sweeping Strike, which has no rune definitions. The fixture now selects Earthshaker,
an actual supported branch-B rune skill; no assertion was removed. Final versioned
checks and the corrected real-server route are running under `/tmp/eidolon-1-0-20-`.
Separate patch notes and all login/package/server/deployment version defaults
identify 1.0.20. This is not publication or physical-phone acceptance.

Final versioned server race checks passed (root 9.587 seconds; unchanged game
package cached). The first versioned client run found one stale login-version
assertion still expecting 1.0.19; after updating it, **161 suites / 2,332 tests
passed in 64.581 seconds**, plus lint. All **21 anonymous browser checks passed
in 2.0 minutes**. The corrected real-server build route initially passed both
orientations and reconnect persistence in 10.3 seconds, then its expanded route
passed in **13.8 seconds** with canceled/confirmed reset, refunded ranks, re-ranking
and an open-menu WebSocket interruption/resume. The client waited for a fresh
authoritative build before allowing further changes. Credential scanning and
exact disposable cleanup passed. Local browser session `93035` is closed.

Logs: `/tmp/eidolon-1-0-20-{client-final,lint-final,server,anonymous,build,build-final}.log`.
Additional four-class locked-choice checks and explicit rune-button hit-area
assertions are being finalized before commit; no runtime changes followed the
passing real-server route. Broader all-class combat, physical-phone and remaining
menu gates remain open.

Those additional checks passed: **161 suites / 2,336 tests in 59.634 seconds**,
lint and all three explicit rune hit-area layouts in **14.9 seconds**. Final
landscape inspection then prompted a CSS-only composition refinement: talent
and rune actions sit beside their descriptions on short landscape screens so
more of a card fits at once. The anonymous suite and expanded real-server build
route are being rerun after that refinement. Logs use
`/tmp/eidolon-1-0-20-{client-release,lint-release,layout-final,anonymous-release,build-release}.log`.

The final composition reruns **passed**: all 21 anonymous browser checks in
**1.9 minutes** and the expanded server-owned build route in **13.7 seconds**.
The landscape rune card was visually inspected with its name, description,
requirement and Equip action visible together. Credential scanning and disposable
cleanup passed; local browser session `6314` is closed. The 1.0.20 candidate is
ready for its separate local commit; it is not published over the queued releases.

## Alpha 1.0.19 — a story you can settle into (local candidate)

Status: prepared locally, not published; queued behind 1.0.17–1.0.18. Phone quests use
readable viewport-sized conversation/journal panels, footer actions and a compact
tracker that cycles all saved selections. Manual acceptance/completion still
awaits server acknowledgement. Progress updates preserve lore, scroll and focus;
daily Back restores the offers-list position. Chat remains visible below the
panels. Login, package, release defaults and patch history identify 1.0.19.

The initial full client run passed 160 suites / 2,317 tests plus lint. Three
rendered phone layouts passed in 17.6 seconds after correcting a test locator
that did not follow the pending button's changed label. A dedicated real-server
first-chapter route passed in 1.3 minutes: touch acceptance, actual kill credit,
manual landscape turn-in, gold/XP, Ilyra's reply and reconnect persistence. Setup
explicitly uses level 30 and the encounter waypoint; this is neither first-hour
balance nor full-campaign evidence. A later daily-list scroll regression was
reproduced and repaired, and final versioned checks are running. See
[phone evidence](mobile-playability-evidence.md) for logs and limits. The broader
1.1 and physical-phone gates remain open.

Final versioned checks subsequently passed **160 suites / 2,321 tests in 75.584
seconds**, lint, the server race suite, all **18 anonymous browser checks in 1.9
minutes**, and the real-server phone quest route in **1.4 minutes**, including
reconnect, credential scanning and exact disposable cleanup. Inspection and a
failing geometry assertion caught and repaired long tracker titles overlapping
progress. Matching footer actions now retain their DOM/focus across quest updates.
One earlier server turn-in timed out and then passed with diagnostics; its cause
remains unconfirmed, not established by the separate action-node regression.
Keep that failure recorded and retain the diagnostic route during publication.

### Confirmed post-recall turn-in failure and recovery correction

An exact-commit repeat of `43321ed` failed again. The Complete callback fired,
but the server rejected giver distance. Temporary admission diagnostics then
proved that the client reached approximately `(17.5, 215.4)` while the server
still placed it at the recall spawn `(-1.25, 200)`: fresh movement packets arrived
128–943 ms after recall and were rejected by the existing one-second recovery
guard. This explains the reproduced immediate turn-in failure; it does not
retroactively prove the cause of every earlier timeout. Diagnostic-only server
logging was removed after gathering evidence.

The correction gives approved recall/respawn an acknowledged movement context.
Fresh-context movement works immediately, old-context packets remain rejected,
and legacy clients retain their timed guard. Sequence, ability-lock, crowd-control,
distance and geometry checks remain. Join/resume sends the current session
context. Manual quest acceptance and completion are unchanged. Protocol details
and the player-facing correction are included in the unpublished 1.0.19 notes.

Initial corrected checks passed **160 client suites / 2,322 tests in 69.466
seconds**, lint and the complete server race suite (game package 150.448 seconds).
The real-server phone quest route passed in **1.4 minutes**, including normal
kill credit, immediate manual landscape turn-in, gold/XP, next chapter, reconnect
and authoritative movement after reconnect. Credential scanning and disposable
cleanup passed. Additional compatibility/rejection/jump tests and the final server
race run passed (root 9.826 seconds; game 158.739 seconds). The final client run
passed 160 suites / 2,322 tests in 83.576 seconds, plus lint; all 18 anonymous
browser checks passed in 1.9 minutes. Portrait dialogue and landscape journal
captures were inspected. The real-server dungeon death/respawn/re-entry regression
passed in **1.7 minutes**, using a level-30 Wizard, generator 2 and seed
`-7689347035156546500`: normal hostile death, denied dead-player recall, explicit
respawn and guide re-entry preserved the unfinished run. Credential scanning and
cleanup passed. Log: `/tmp/eidolon-recovery-context-dungeon.log`. Logs use
`/tmp/eidolon-recovery-context-`; original reproductions are retained under
`/tmp/eidolon-phone-quest-{transaction,recall-movement}-diagnostic.log`.
These checks do not close the physical-phone, full-campaign or full dungeon gates.

The correction was committed as `98f42866848e6fdd1c113b304b0d5d397e54e14d`.
The exact clean committed runtime then passed the phone quest route in **1.3
minutes** and both two-thumb combat orientations in **16.7 seconds**. Both
credential scans and disposable cleanups passed. Sequential local session `21689`
is closed; logs are `/tmp/eidolon-recovery-context-exact-{quests,combat}.log`.

Next phone implementation: Skills & Runes. Inspection identifies 10–14px inline
descriptions, tabs inside the content scroller, rerenders that discard reading
position, whole-card rank/rune actions and optimistic talent-rank mutations.
Reflow this into readable deliberate controls with server-confirmed feedback and
preserved navigation. Preserve the actual progression rules: selecting a branch
currently enables its level-eligible skills automatically; do not invent a new
point-spending requirement during the UI redesign. Verify branch choice, talent
ranks, rune equipment and reconnect with the real server. No skill-menu runtime
changes are included in 1.0.19.

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

## Alpha 1.0.10 corrected candidate — direct-target boundaries

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
secondary wall effects remain open. Nothing in this section has deployed yet.
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

Pushed the corrected candidate as `3dbb76d0a24d972e756583023e2ba4a11356cff0`, CI
`34007206525`. Client checks pass; the server race step is running. Public
frontend release and server health still match healthy Alpha 1.0.9 at
`20eadc9483abbc6d2bd19f1bde0a2a3f78bda4b9`. A full Tempest Spire Fighter run is
active on clean `3dbb76d`, seed `3202185699779077470`, generator 2 attempt 0,
Normal 70. Log: `/tmp/eidolon-1-0-10-tempest-full-fighter.log`. No full Tempest
completion or 1.0.10 live deployment is claimed yet.

The Tempest run has now terminated **failed after 9.2 minutes**: Windshear and
Stormcallers died normally, then the player died during a later Cloud Elemental
encounter. The incoming sources are not established by that log. Its replay seed
is retained in the full-run evidence document; the route now prints bounded
damage/healing history on death without changing combat or granting protection.
CI `34007206525` has passed client/server/smoke checks and is executing predeploy
character QA. The public build remains Alpha 1.0.9 at the last verified check.

Both 1.0.10 deployment jobs subsequently succeeded. The public release manifest,
healthy database-ready backend, login label and commit-qualified main module
independently match **Alpha 1.0.10** at
`3dbb76d0a24d972e756583023e2ba4a11356cff0`. Post-deployment live character QA is
running; the entire CI run is not yet terminal. This is the first deployed 1.0.10
candidate, not either of its earlier failed candidates.

## Alpha 1.0.11 candidate — grounded in the dungeon (not deployed)

Red canonical-floor dispatch tests reproduced four ground spells accepting
wall-blocked destinations and spending resources: Gravity Well, Meteor Drop,
Inferno Cataclysm and legacy Rain of Arrows. Independent legal-center tests
reproduced those spells and Consecrated Ground damaging enemies across a wall.
The repair validates clamped cast destinations before resources/combos, and
uses private floor snapshots for area damage while actor locks are held.
Gravity Well's accepted pull stays on the validated segment, without nesting
an instance lock under the target lock. Meteor's shield-explosion combo uses
the same damage boundary. Cluster and Apocalypse scatter clip from the accepted
center; their actual corrected positions drive warnings and impacts.

Focused race checks cover open doorways, blocked casts, damage/pull/debuffs,
expanded/Black Hole/Cluster/Extinction variants, all six Apocalypse meteors,
shield explosions, friendly Sanctuary/healing, invalid points, legacy geometry,
and stale spatial entries after a target changes instance. The final focused
suite passes (14.382 seconds), `/tmp/eidolon-ground-area-final-focused.log`.
The full server race suite passes (game package 171.606 seconds),
`/tmp/eidolon-ground-area-server-full.log`; the final two additional tests were
added during that full run and are covered by the later focused run.

The real Wizard UI route passes in 23.5 seconds including setup, source dirty
`3dbb76d`: ordinary walking to a generated dungeon wall, rejected Meteor/Inferno/
Gravity casts with zero cooldown and no accepted ability event, followed by
accepted reachable-floor casts and a client-presented Meteor impact. Log:
`/tmp/eidolon-ground-area-browser.log`. Credential scan and disposable cleanup
pass. This is placement/feedback evidence, not a full dungeon or rendered AoE
occlusion matrix. The route joins predeploy QA and is available as `ground-walls`.

The candidate advances version defaults, login text and patch notes to 1.0.11.
It must not be pushed into deployment ahead of the pending 1.0.10 deployments.
Full client checks and final release verification are still required. Remaining
1.1 work includes self-centered AoE, channels/cones, secondary effects, clipped
area footprints, full class/party/campaign progression, and Tempest survival.
Zone PvP relationship coverage is also still open; this geometry patch does not
silently change the existing zone target-type policy.

The first complete client candidate run passed 149 suites and failed one stale
MenuPolish login-version assertion (2,202 passing tests, one failure). That
assertion now expects 1.0.11, matching the updated release identity; the complete
client rerun is in progress. This was a test expectation mismatch, not a runtime
UI failure. Lint, shell syntax and whitespace checks pass.

Final candidate checks pass: **150 client suites / 2,203 tests** (102.149 seconds),
`/tmp/eidolon-1-0-11-client-final.log`, and the complete server race suite after
all final tests and metadata edits (game package 183.721 seconds),
`/tmp/eidolon-1-0-11-server-final.log`. The candidate is ready for a local commit;
publishing remains sequenced after 1.0.10's post-deployment verification. None of
these results closes the full 1.1 acceptance matrix.

## Milestone tracking

### Continued directional and pull audit — unpublished after 1.0.11 candidate

The previous goal turn made implementation progress: the 1.0.11 ground-spell
candidate was committed locally as `ba4a32e5477da6f13105f278eb5f40a207abe241`,
and 1.0.10's exact public identity was verified. At this continuation's latest
check, CI `34007206525` is still executing live four-class/remote-animation QA;
the 1.0.11 candidate has not been pushed ahead of that verification.

A new clean-`ba4a32e` full Tempest Fighter run is active with generator 2 attempt
0 seed `-1329185764639002788`, Normal 70, log
`/tmp/eidolon-1-0-11-tempest-diagnostic.log`. Windshear died and Stormcallers is
in combat at the latest observation. This is not a completed run. The server
image predates the local changes below and cannot verify them.

Sixteen directional dispatch cases reproduced eight wall-crossing failures:
Flame Whip, Scorch Beam, Radiant Strike (base/Smite), Shield Slam, Sweeping Strike,
and Earthshaker (radial/Fissure). Log: `/tmp/eidolon-directional-wall-red.log`.
Private canonical-floor snapshots now block damage, stun and armor-reduction
effects across walls without changing legal empty-space casts or open-doorway
hits. The shared Earthshaker helper checks the actual effect origin, including
its delayed use. No area/beam visual clipping is claimed by these server tests.

Eight Grip cases reproduced six failures: selecting enemies across a wall and
pushing targets closer than two units outward, sometimes into the next room.
Log: `/tmp/eidolon-grip-wall-red.log`. Selection now requires a reachable enemy
before spending resources; the pull stops at the lesser of two units and the
original distance, keeping movement on the validated segment without nesting
an instance lock under the target lock.

Combined directional/Grip/ground/Meteor race checks pass in 21.604 seconds,
`/tmp/eidolon-directional-grip-green.log`. The complete server race run is active,
`/tmp/eidolon-directional-grip-server-full.log`. These local changes are not part
of the committed 1.0.11 candidate and still require rendered verification and
their own release notes/version before publication.

The complete server race run subsequently passed (game package 214.627 seconds),
`/tmp/eidolon-directional-grip-server-full.log`. Whitespace checks pass. Source
inspection identifies the next presentation work: the canonical beam uses the
requested target position, while the network handler discards the local actor's
accepted ability event. Server damage occlusion alone therefore does not prove
that local/remote beam endpoints and area footprints agree with walls. That
rendered/authoritative presentation audit remains open; no client presentation
change was made during the active clean-source Tempest playthrough.

### Alpha 1.0.11 publication and continued aura audit

CI `34007206525` is now terminal **success**, including all post-deployment live
character, class and remote-animation checks. Frontend release and backend
health were rechecked at the exact healthy 1.0.10 commit. Pushed only the already
tested 1.0.11 candidate `ba4a32e5477da6f13105f278eb5f40a207abe241`; its CI run is
`34009078308`. New local directional/pull/aura changes are not in that commit.
The 1.0.11 client/server jobs pass and browser smoke is running at the latest
check. No 1.0.11 deployment is claimed yet.

Twenty-six initial self-area cases reproduced thirteen blocked-wall failures,
`/tmp/eidolon-self-area-wall-red.log`: Whirlwind (base/Bladestorm), Executioner
Spin, Guardian Roar taunt, Juggernaut Charge, Death Spiral, Smoke Bomb, Frost Nova,
Heaven's Trumpet and Spirit Guardians (base/Expanded/Vengeful/Boost). Canonical
floor reachability now applies to these hostile effects and existing active
Whirlwind ticks. Friendly Roar buffs and Spirit healing retain their existing
rules. Bladestorm pulls stay on the validated segment and cannot overshoot the
caster. The actual target position is checked under its lock before damage;
floor snapshots are taken outside actor locks.

The expanded checks include Bloodwhirl healing only from reachable hits, ordinary
Spirit casts ticking before/after an enemy moves behind a wall, friendly Roar
buffs and the existing active-Whirlwind tick branch. The initial combined race
checks pass (22.766 seconds), and the first full race suite passes (game package
201.957 seconds), `/tmp/eidolon-aura-directional-server-full.log`. The subsequent
target-lock refinement passes focused checks (26.691 seconds),
`/tmp/eidolon-aura-locks-focused.log`. Final full checks including the explicit
active-state fixture are running in `/tmp/eidolon-aura-locks-server-final.log`.

The rune audit also exposes a separate unresolved contract: `whirlwind_extended`
reduces instant damage by 50%, but no cast path sets `WhirlwindActive` true. Its
advertised extra duration is therefore not established. The explicit active-state
fixture tests wall behavior only and is not claimed as rune activation evidence.
This needs a real duration/damage/presentation repair before the rune gate closes.
Rendered aura footprints and beam endpoints likewise remain open.

### Continued beam agreement and Tempest evidence — unpublished

The final aura full-server race check passed (game package **208.503 seconds**),
`/tmp/eidolon-aura-locks-server-final.log`, including the target-lock refinement
and explicit active-state fixture. It predates the following beam endpoint edit.

Two new Scorch Beam event cases reproduced that the server reported the cursor
position rather than the actual line endpoint, `/tmp/eidolon-scorch-endpoint-red.log`.
The event now reports the canonical-wall-clipped full-range endpoint; the line
hit extent uses that same length. Focused directional/endpoint race checks pass
in 4.561 seconds, `/tmp/eidolon-scorch-endpoint-green.log`. A new full server race
run is active in `/tmp/eidolon-beam-server-full.log`.

Eight real-Three mesh tests reproduced the analogous local/remote presentation
failure at High and Low quality, `/tmp/eidolon-beam-presentation-red.log`. After
the clean Tempest process terminated, the shared transient-effect route was
updated to normalize Scorch Beam to its configured range and clip its segment
against the canonical floor union. Caller aim vectors are not mutated. All eight
mesh cases and six segment-geometry cases pass (1.957 seconds). A disposable
Wizard browser route is running in `/tmp/eidolon-beam-browser.log`; rendered
browser/server agreement is not yet claimed. Other aura/cone footprints and the
legacy offline Wizard hit path are not covered by this beam integration.

Tempest terminated **failed after 29.7 minutes**: four bosses dead, final boss
Zephyrion still taking damage at the six-minute encounter cutoff. The last
report was 12,673 boss HP and 2,021/2,575 player HP. The exact clean-source seed
and limitations are recorded in `dungeon-playthrough-evidence.md`. Only after
termination was the functional encounter ceiling extended to eight minutes,
retaining the stall watchdog and whole-run ceiling. A full-clear rerun is pending.

CI `34009078308` is still live in disposable full-character predeploy QA;
client, server and browser-smoke jobs pass. The public frontend and backend
remain healthy at exact 1.0.10 commit `3dbb76d0a24d972e756583023e2ba4a11356cff0`.
The latest user-request check also reconfirmed the already-deployed bag icons,
deliberate drops and tracking choices: 244 focused client tests and server drop
race tests pass. No new feature release or 1.1 milestone closure is claimed.

### Alpha 1.0.12 candidate — a clear line of fire

The ordinary Wizard browser route now **passes in 27.8 seconds** (30.8 seconds
including browser setup), `/tmp/eidolon-beam-browser-corrected.log`. Actual
production beam meshes attached to the effect scene match accepted server
endpoints for north-wall and open-floor casts at High and Low quality. Input uses
the skill tree, hotbar, mouse aiming, settings and recall; no actors, casts or
combat events are injected. The first browser attempt used the wrong observer
field (`x/z` instead of the protocol's `targetX/targetZ`) and failed in its numeric
assertion. Correcting only that observer resolved the failure. This is local-cast
browser evidence; the remote endpoint check remains the separate real-Three unit
matrix, not a claim of two-client dungeon browser verification.

The full post-beam server race suite passes (game package **189.500 seconds**),
`/tmp/eidolon-beam-server-full.log`. Ten mesh cases now include non-mutating aim
and source vectors and stale-layout overworld/legacy compatibility. The beam
browser route joins disposable CI and can run alone with `beam-walls` and class
`Wizard`. Credential scanning and temporary-service cleanup pass.

Login label, package/lockfile, release manifest, server/container/deploy/QA/CI
defaults and historical patch notes now identify the local **1.0.12 candidate**.
The 1.0.11 history is retained. Full final client/server checks and lint are
running in `/tmp/eidolon-1-0-12-client-full.log`,
`/tmp/eidolon-1-0-12-server-final.log`, and `/tmp/eidolon-1-0-12-lint.log`.
This candidate is not published; 1.0.11 still precedes it in deployment order.

Final candidate checks pass: **152 client suites / 2,220 tests** in 106.401
seconds, final full server race checks (unchanged game-package results cached
from the successful 189.500-second post-beam run), lint, shell syntax and
whitespace validation. The candidate is ready for a local commit and a new
clean-source full Tempest run. Publishing still waits for 1.0.11's complete
deployment and post-live verification; the full 1.1–1.10 roadmap remains active.

### Continued rune duration audit — unpublished after 1.0.12 candidate

The previous goal turn made implementation/release progress: committed 1.0.12
as `fd93bd3b89d1817762df757a6568e14be8dd1794` after final checks. It remains
local, behind 1.0.11's post-live gate. CI `34009078308` passed both deployments
and live anonymous/persistent-character QA; four-class/remote-animation QA is
still running at this continuation's latest check. Public frontend release,
backend health, login label and entrypoint query were verified at exact 1.0.11
commit `ba4a32e5477da6f13105f278eb5f40a207abe241`.

The clean-`fd93bd3` full Tempest Fighter rerun is live in
`/tmp/eidolon-1-0-12-tempest-full.log`, session `27831`, seed
`-5249240270438193008`, generator 2 attempt 0, Normal 70. Windshear, Stormcallers
and Roc Matriarch are dead at the latest observation. It uses ordinary
Bloodwhirl/Fortify/Extended defenses and the eight-minute per-encounter ceiling.
It is not a completed run and its built server cannot verify the newer local
Whirlwind edits below. No client runtime or active QA shell-script edits were
made during this clean-source run.

Two actual-cast regressions reproduced missing Whirlwind activation for both
base and Extended, `/tmp/eidolon-whirlwind-duration-red.log`. The local repair
uses the existing authored one-second Fighter spin and half-second pulse cadence:
base has two pulses, Extended has four over two seconds. Each Extended pulse has
half the normal pulse's raw damage (integer rounding distributed across pulses).
The former instant cast's raw damage budget, including its talent/combo bonus,
is preserved, not multiplied by the number of ticks. This deliberately changes
base Whirlwind from an instant hit to damage over its spin; final post-mitigation
damage can still vary with normal combat effects on each pulse.

The server owns an independent pulse clock, snapshots the cast budget, and
rechecks current target range, relationship, instance and canonical walls per
pulse. Bloodwhirl healing and Bladestorm pulls occur once per distinct enemy per
cast. Death, disconnection, scene reset, expiry and instance change terminate
the spin; late updates do not replay an already-expired cast. Attacker snapshots
are captured before target locking, retaining party identity and safe-zone
coordinates. The old manually activated tick fixture now uses a real Extended
cast followed by a later pulse.

Focused race checks pass in 16.272 seconds, then expanded checks pass in 19.432
seconds, `/tmp/eidolon-whirlwind-expanded.log`, covering duration, exact budget,
independent timers, range/wall rechecks, rune side-effect limits, cancellation,
combo capture and an ordinary later-pulse kill with gold rewards. An additional
parallel shared-enemy/party-safety race check passes in 1.352 seconds,
`/tmp/eidolon-whirlwind-parallel.log`.

New server protobuf fields 110/111 carry active state and remaining duration;
entity broadcast copies preserve that presentation state without copying private
pulse maps/budgets. Observer change detection includes expiry and elapsed time.
The full-server run in `/tmp/eidolon-whirlwind-server-full.log` first exposed a
test-only 100 ms allowance around copying a whole world. The copy test now
requires the exact preserved deadline and a positive, bounded remaining time;
the focused protocol race rerun passes in 1.565 seconds,
`/tmp/eidolon-whirlwind-protocol-corrected.log`. The original full game-package
run is still executing; a final full rerun is required after test refinements.

This rune work is **not release-ready**: client protobuf generation, local and
remote animation/effect timing, late-observer and cancellation presentation,
real browser casting, final full checks, version metadata and patch notes remain
to do. The running Tempest test retains the unmodified 1.0.12 client graph; only
the server protobuf output was regenerated so far. No 1.1 or later milestone is
closed by these local changes.

The initial full game-package race run passed in **242.803 seconds**; that
overall invocation failed only the copy-timing assertion described above. The
corrected full-server rerun then **passed**, game package **242.828 seconds**,
`/tmp/eidolon-whirlwind-server-final.log`. A final inactive-path optimization
(avoid unlocking/relocking actors that are not spinning) passes focused race
checks in 5.765 seconds. A normal entity-update/copy-path test was also added;
the full check including these last refinements is running in
`/tmp/eidolon-whirlwind-server-current.log`. These results do not establish
client animation agreement or release readiness.

Tempest has now defeated Thunderlord Kaelix as well as its first three bosses
and is clearing the route to Zephyrion on the same clean source/seed/process.
The 1.0.11 CI watcher remains live (`/tmp/eidolon-1-0-11-ci-watch.log`), still
in four-class and remote-animation QA. The committed 1.0.12 candidate has not
been pushed ahead of that gate.

Tempest has defeated Windshear, Stormcallers and Roc Matriarch and is fighting
Thunderlord Kaelix on the same clean-1.0.11 process/seed. This is progress, not a
complete clear; the current local fixes are absent from that running server.

1.1 remains open until all five dungeon reports meet their acceptance criteria,
alongside onboarding/reconnect and the initial PvP corrections. Releases 1.2
through 1.10 remain unimplemented roadmap work; none is closed by this hotfix.

## September 6 continuation — Tempest complete, Whirlwind client integration

The previous turn made concrete progress: the requested subtle open-source
credit and GitHub link are implemented beneath the login controls. All 70 menu
tests, lint, and desktop/mobile keyboard browser checks pass. The link opens the
actual repository in a separate tab without opener access. This remains local.

The clean 1.0.12 Tempest run above is now **terminal PASS**, all five bosses plus
completed recall/re-entry, 31.5 minutes, seed `-5249240270438193008`. Its full
evidence is recorded in `dungeon-playthrough-evidence.md`. Alpha 1.0.11 CI
`34009078308` completed all gates successfully. Alpha 1.0.12 was pushed as
`fd93bd3b89d1817762df757a6568e14be8dd1794`; CI `34011698025` has passed client,
server and browser smoke and is now running predeploy character QA. Neither a
queued nor a running deployment gate is a verified live release.

The final full server race run including the Whirlwind inactive-path refinement
and normal entity-update/copy regression **passed**, game package 200.263 seconds,
`/tmp/eidolon-whirlwind-server-current.log`. After the clean Tempest process ended,
client protobuf was regenerated and local/remote presentation integrated. Base
and Extended spin meshes follow the caster for one and two seconds respectively;
authoritative remaining time supports late observers, explicit stop, and event
deduplication. Predicted rejection and death/removal/disposal clear the effect.

Twelve initial real-Three presentation regressions failed before integration,
then passed; expanded coverage now passes **18 tests**, including protobuf false
defaults, late observers, rejected predictions, acknowledged repeat rejection
and cancellation. The earlier complete client check passed 153 suites / 2,232
tests; later additions require a fresh final run. Extended's tooltip now explicitly
says its damage reduction is **per pulse**, in both client and server catalogs.
The new ordinary-input dungeon browser route is running against a fresh disposable
server in `/tmp/eidolon-whirlwind-browser.log`; its outcome is not yet established.
No version beyond 1.0.12 has been prepared or deployed, and the full roadmap gates
remain open.

### Alpha 1.0.13 candidate — hold the whirlwind

Version defaults, the login label and patch history are now prepared for 1.0.13.
Notes explicitly describe the change from an instant hit to two pulses, Extended's
four half-damage pulses, per-target side-effect limits, duration presentation and
the open-source login credit. All previous release entries remain intact.

The first actual browser route failed after its first successful High-quality
cast: a late positive snapshot recreated an expired effect for approximately
11 milliseconds. A regression reproduced the extra mesh; synchronization now
remembers the preceding authoritative remaining time and rejects a decreasing
tail snapshot after local expiry. A new cast can start after a clear or newly
increased duration. All **19** presentation tests pass after this correction.

The fresh-server corrected browser route passed **27.8 seconds**, followed by
the versioned candidate and dedicated CI account route passing **27.5 seconds**,
`/tmp/eidolon-1-0-13-whirlwind-browser.log`. Both exercise base/Extended at High/Low,
ordinary movement, authoritative acknowledgment, duration and no duplicated
effect. Artifact credential scanning passed and disposable services were removed.
The route is included in the full predeploy sequence, not only a manual command.

Final full client/server checks are running in `/tmp/eidolon-1-0-13-client.log`
and `/tmp/eidolon-1-0-13-server.log`. A fresh complete Verdant Fighter run is live
in `/tmp/eidolon-1-0-13-verdant-full.log`; this is deliberately after the Whirlwind
damage-timing change, unlike the earlier clean Tempest evidence. These pending
checks are not yet passes. Alpha 1.0.12 remains in predeploy full-character QA;
the next candidate has not been pushed ahead of that release's live gates.

### Added scope: phone playability (September 6 player report)

The main roadmap now explicitly treats usable phone framing, HUD, touch controls
and core menus as a **1.1 release gate**, with a complete portrait/landscape visual
redesign in **1.2**, touch-combat/performance refinement in **1.3**, retained mobile
flows through later features, and physical-device evidence required for **1.10**.
The player reports excessive mandatory zoom-out and unusably small/awkward UI.
Source inspection confirms aspect-scaled orthographic horizontal framing and
fixed-offset touch controls; the exact physical-phone failures still need reproduction.
This is a roadmap change, not a claim of a shipped mobile fix. It includes readable
UI independent of world zoom, no keyboard/hover-only actions, safe-area/keyboard
handling, always-available visible chat, and real Android/iOS testing.

The final 1.0.13 client run passed **153 suites / 2,241 tests**, 110.341 seconds;
lint also passed. The full server race and Verdant playthrough remain live at this
update. Verdant seed `4391125778650393874`, generator 2 attempt 0, Normal 30,
Fighter 100, has reached and is damaging Rootbound Warden through ordinary combat.

The final full server race check subsequently **passed**, game package 239.040
seconds, `/tmp/eidolon-1-0-13-server.log`. The same Verdant process has defeated
Rootbound Warden and Briar Matron; the remaining bosses and recall/re-entry are
still pending, not a complete-run pass.

The Verdant process subsequently **passed in 8.7 minutes**, all four bosses and
completed recall/re-entry with preserved seed/boss/gold state. This is the first
complete dungeon evidence containing the Whirlwind duration changes; replay details
are in the dungeon evidence document. The final anonymous browser suite is running
in `/tmp/eidolon-1-0-13-anonymous.log` before candidate commit.

The new `mobile-playability-evidence.md` records concrete phone baseline findings:
aspect-ratio camera span, 10px mobile HUD/chat text, 36px scaled landscape skill/
interact targets, and a production InputManager/jsdom reproduction where a
two-finger gesture over the quest list emits a world zoom callback. This is
diagnostic evidence for the upcoming phone work, not a claimed mobile fix.

Final candidate anonymous checks **passed all nine tests**, including the new
desktop/mobile login-credit route, release/dependency surface, canonical dungeon
floors, menu layers, raid menus and responsive entry flow. Together with the
153-suite client pass, full server race pass, ordinary Whirlwind casts and complete
Verdant run above, this permits committing the 1.0.13 candidate. Publication still
waits for 1.0.12's terminal live gates; watcher session `1678` follows CI
`34011698025` in `/tmp/eidolon-1-0-12-ci-watch.log` without restarting it.

### Candidate committed; 1.0.12 deployed; next phone input repair

Alpha 1.0.13 is committed locally as
`b3213077faa8eb8e1ddc7b45d2905d5682b8fbb8`, including Whirlwind, login credit,
phone roadmap/baseline evidence, synchronized version metadata and patch notes.
All nine final anonymous tests passed in 1.4 minutes. It has not been pushed
ahead of the preceding release's terminal live checks.

Alpha 1.0.12 CI subsequently passed predeploy QA and both deployment jobs. Direct
public checks confirm frontend release, login label, entrypoint query and backend
health all identify `fd93bd3b89d1817762df757a6568e14be8dd1794`, Alpha 1.0.12,
with database ready. Post-deployment character QA remains active; the full CI run
is not yet a terminal pass.

Separate local work after `b321307` fixes the reproduced phone pinch-routing
problem. All 11 new regressions first failed, then passed alongside 11 existing
input tests. Browser-generated touch targeting passes in 3.1 seconds; the check
is added to anonymous CI for the next candidate. The repair is limited to gesture
ownership, cancellation and distance-based zoom response; phone camera composition,
HUD, menus and real-device acceptance remain open. See the mobile evidence document.
The full client rerun is active in `/tmp/eidolon-mobile-pinch-full.log`.

That full client run finished with 152 passing suites and two failing constructor
fixture suites (10 failures): their RenderSystem mocks omitted the renderer canvas
now explicitly passed into input handling. The mocks now expose that production
interface, and the settings constructor test also asserts that the correct canvas
is wired. Production code retains strict renderer-canvas ownership. Focused
constructor/pinch checks and a corrected full rerun are executing via session
`13196`, `/tmp/eidolon-mobile-pinch-constructor.log` and
`/tmp/eidolon-mobile-pinch-full-final.log`. This is still uncommitted next-candidate
work, not a modification of committed 1.0.13.

### 1.0.13 pushed; phone HUD work advances separately

Alpha 1.0.12 CI `34011698025` completed **all gates successfully**. Exact frontend
and backend identities were rechecked after terminal success; both report
`fd93bd3b89d1817762df757a6568e14be8dd1794`, Alpha 1.0.12, database ready.
The existing watcher ended successfully. Only then was committed candidate
`b3213077faa8eb8e1ddc7b45d2905d5682b8fbb8` pushed to master. Alpha 1.0.13 CI
`34013545773` has passed client/server/browser checks and is in predeploy QA.
Newer phone work stays uncommitted and is absent from that release.

The corrected pinch full suite passed **154 suites / 2,252 tests**, 104.32 seconds.
The phone HUD then gained separated controls/status/navigation, 44px-or-larger
primary touch targets, explicit menu labels, compact permanent expandable chat
with activity count, preserved XP/level feedback and phone Menu entries for Skills
& Runes/Abilities. These address inspected overlaps and missing touch navigation,
not merely source formatting. Full HUD tests passed 154 suites / 2,253 tests before
the last spacing/menu refinements. The corrected combined browser suite passes
all three phone/party/service checks (44.1 seconds). Remaining evidence and scope
are in `mobile-playability-evidence.md`.

A new real-server phone route is currently live via session `63902`,
`/tmp/eidolon-phone-gameplay.log`. It uses a fresh disposable character, actual
browser touch input for joystick movement, inventory/character/quest/social menus,
Skills & Runes and chat, in portrait and landscape. It does not grant quest progress
or kills. Do not edit the running isolated-QA shell script or client graph before
it terminates. No mobile patch version/notes have been finalized or pushed yet.

The first phone route ended at its 180-second limit, with cleanup masking the
stalled action. After bounded action timeouts and stage diagnostics, a fresh run
reproduced a real obstruction: joystick movement and Inventory opening worked,
but the minimap intercepted Inventory's Close tap. It was mounted at body level
above the whole menu UI stacking context. A failing unit regression confirmed
the wrong parent; minimap and tooltip now mount in the same UI root as menus.
The local phone fixture also instantiates the real minimap. A new disposable
rerun is active through session `67356`, `/tmp/eidolon-phone-gameplay-layer-fixed.log`.
The prior phone processes are terminal failures, not verified usable mobile runs.

### Alpha 1.0.14 candidate — room for your thumbs

The layer-corrected real-server phone route **passed**, 10.1 seconds, both
orientations and all its movement/menu/chat actions; minimap tests pass 15/15.
Replay limits and failures remain recorded in the mobile evidence document.

Version metadata/login display and patch notes are prepared for 1.0.14. The notes
describe separated phone controls, persistent compact chat, canvas-owned pinch,
touch-accessible skill menus and the minimap layering repair. They explicitly
leave camera framing, complete menu redesign, combat and physical-phone acceptance
open. The fresh phone account route joins full predeploy QA; phone HUD/pinch fixtures
join anonymous CI. No 1.1 or later milestone is closed.

Final versioned client/lint, server-race and phone checks are live via sessions
`83396`, `67029` and `98106`, logs `/tmp/eidolon-1-0-14-client.log`,
`/tmp/eidolon-1-0-14-server.log` and `/tmp/eidolon-1-0-14-phone.log`. Do not edit
the active isolated script or runtime while that phone check runs. The 1.0.13
deployment watcher is session `38496`, `/tmp/eidolon-1-0-13-ci-watch.log`;
publication of 1.0.14 will wait for that preceding release's terminal live gates.

The final versioned client/lint checks **passed**, 154 suites / 2,255 tests,
107.594 seconds. Full server race checks passed (root package 14.173 seconds,
unchanged game package cached). The dedicated-account 1.0.14 phone route also
**passed in 15.4 seconds**, 19.8 including browser overhead, with normal touch
movement, all exercised menus and chat in both orientations; credential scanning
and disposable cleanup passed. The final 11-test anonymous suite is active via
session `90199`, `/tmp/eidolon-1-0-14-anonymous.log`. No candidate commit or push
has occurred yet.

All **11 final anonymous checks passed in 1.1 minutes**, including the new phone
HUD with the real minimap and browser-generated pinch targeting. A final CSS-only
palette pass replaces neon action rings with muted game-consistent colors and
reduces the short-landscape minimap to 88px. The phone HUD/skill-menu check was
rerun afterward and **passed in 14.1 seconds**; its portrait and landscape captures
were inspected and preserved at `/tmp/eidolon-1-0-14-phone-hud-portrait.png` and
`/tmp/eidolon-1-0-14-phone-hud-landscape.png`. These are rendered UI fixtures, not
physical-phone gameplay captures. The 1.0.14 candidate is ready for local commit;
push/deployment still waits for 1.0.13's live gates.

### Alpha 1.0.15 candidate — a wider view of Eidolon

The preceding HUD candidate was committed as
`af3757b668da11cc932c9e93b7a0f770259d334b`. It is not yet pushed: 1.0.13 CI
`34013545773` has passed predeploy and both deployment jobs, and is still running
its live four-class/remote-animation gate. Do not overlap the next deployment.

The next local candidate changes phone projection to a 24-unit short-axis default,
preserving rotation scale and manual zoom. Persistent navigation/hotbar bounds
influence hero framing; chat and transient menus do not. Phone Menu gains Reset
Camera, relocking follow and restoring default zoom. Desktop framing stays intact,
raycasts use the same projection, and zoom no longer reallocates drawing buffers.
Patch notes/login/runtime metadata are prepared as Alpha 1.0.15. None of the open
1.1–1.10 milestones is closed by this change.

The former projection failed 8 of the 9 new camera regressions; all now pass.
Initial full client tests passed 155 suites / 2,266 tests. A corrected production
mesh fixture and HUD pair passed 2 checks in 24.3 seconds; the first fixture's
nonexistent Goblin mesh request was a test error, corrected to Skeleton. Inspected
portrait/landscape captures show a readable Fighter, Skeleton and six-unit warning
boundary, not a populated dungeon or physical-phone combat session. A fresh
real-server phone route passed 10.5 seconds with movement, core menus, chat, default
framing and Reset Camera in both orientations, with credential scan/cleanup passing.

Final versioned **client/lint passed: 155 suites / 2,267 tests**, 101.69 seconds,
`/tmp/eidolon-1-0-15-client.log` and `/tmp/eidolon-1-0-15-lint.log`. Full server
race checks passed, root package 13.480 seconds (unchanged game package cached),
`/tmp/eidolon-1-0-15-server.log`. All **12 anonymous browser checks passed in
1.8 minutes**, `/tmp/eidolon-1-0-15-anonymous.log`, including camera layout at
360×800, 390×844, 430×932, 844×390 and 800×360. The narrow portrait/landscape
captures were inspected and preserved in `/tmp/eidolon-1-0-15-camera-*.png`.

The versioned real-server phone rerun is active through session `89316`, log
`/tmp/eidolon-1-0-15-phone.log`. Do not edit that runtime or the isolated QA script
until it finishes. Further phone requirements and evidence limits are recorded
in `mobile-playability-evidence.md`; touch targeting is a concrete next issue.

The versioned phone rerun **passed in 12.6 seconds**, 15.3 with browser overhead;
artifact credential scan and disposable cleanup passed. Session `89316` ended
successfully. All final 1.0.15 checks are complete and the candidate is ready for
commit. Its publication follows 1.0.14, which still waits on 1.0.13's live gate.

### 1.0.14 deployment advances; Alpha 1.0.16 candidate — choose your mark

The camera release was committed as
`2b55efabfa4da459d14f37b5e18b659888de7e1e`. Alpha 1.0.13 CI `34013545773`
subsequently completed all live gates successfully. Frontend/backend manifests,
database readiness, login label and commit-qualified runtime were reverified as
exact `b3213077faa8eb8e1ddc7b45d2905d5682b8fbb8`, Alpha 1.0.13. Only then was
the exact 1.0.14 commit `af3757b668da11cc932c9e93b7a0f770259d334b` pushed,
without prematurely publishing 1.0.15. Its CI is `34015379084`, watcher `21598`,
`/tmp/eidolon-1-0-14-ci-watch.log`. It has now passed client/server/browser and
full predeploy gameplay checks and is running both deployment jobs. Wait for all
postdeploy live gates before pushing the camera release.

The next local candidate adds persistent deliberate mobile selection, shared by
Attack and offensive abilities; invalid/dead/removed/previous-instance/friendly
targets cannot remain selected. Canvas taps select without attacking, while
empty-ground taps and a 44px target-card Clear button cancel pursuit and queued
casts. Self-centered casts retain their behavior; unselected directional casts
use facing. Target-card name/range feedback is compact on phones, with the existing
gold world ring. Menu/drag/pinch/cancel/blur/reset cannot become synthetic selection.

The actual combat route exposed overlapping Skeleton hitboxes that made a rear
enemy unselectable through repeated identical taps. Production raycasting now
retains the actual hit stack and repeated phone taps cycle hostile overlaps in
stable ID order without attacking. The unit regression covers cycling and the
real route still requires the intended target, not any arbitrary acquired enemy.
Earlier failures and diagnostic IDs/positions are recorded in the mobile evidence
document; the fixture's proto import, chat-focus and desktop-UA errors are not
claimed as gameplay fixes. Corrected pre-version combat passed both orientations
in 18.5 seconds, with normal enemy health loss and cancellation observations.

Alpha 1.0.16 patch notes, login/package/release and all runtime version defaults
are prepared. Its dedicated Wizard `phone-combat` route is added to full predeploy
QA with an exact disposable account; it grants no kills or campaign completion.
The open phone and 1.1–1.10 requirements remain intact.

Final versioned **client/lint passed: 157 suites / 2,290 tests**, 104.05 seconds,
`/tmp/eidolon-1-0-16-client.log` and `-lint.log`. Full server race checks passed,
root 11.520 seconds (unchanged game package cached), `-server.log`. Real-server
touch combat passed **2 tests / 27.8 seconds**, `-combat.log`, including selected
spell damage, basic attack IDs, both orientations and no new combat commands for
1.1 seconds after cancellation; credential scan/cleanup passed. The full anonymous
browser suite is active as session `93949`, `/tmp/eidolon-1-0-16-anonymous.log`.
A final phone movement/menu regression remains to run after that browser process.
No 1.0.16 commit or push is claimed yet.

The first final anonymous run ended **11 passed / 1 failed**, 3.5 minutes. Its
dungeon gallery never initialized: the preserved trace
`/tmp/eidolon-1-0-16-anonymous-network-change.zip` reports `ERR_NETWORK_CHANGED`
for multiple local module requests. It did not reach the floor assertions. The
same process was allowed to finish before any rerun; no assertion was weakened.

Inspection also found the login shell selected `/usr/bin/node` 18.19.1, below
the repository's Node 24 baseline. Local JS checks now explicitly use the existing
runner toolcache's Node **24.18.0** at
`/home/aeml/.local/share/eidolon-actions-runner/_work/_tool/node/24.18.0/x64/bin`.
Use this prefix for subsequent local npm/Playwright commands; it changes no global
installation. The full supported-toolchain rerun passed **157 suites / 2,290 tests
in 67.024 seconds**, lint, and **12 anonymous checks in 1.4 minutes**. The dungeon
gallery passed in 3.0 seconds. Logs: `/tmp/eidolon-1-0-16-node24-{client,lint,anonymous}.log`.
The independently passing server race checks are unaffected by Node selection.

Final Node 24 phone movement/menu and combat reruns are sequential in session
`87532`, logs `/tmp/eidolon-1-0-16-node24-phone.log` and `-combat.log`. Do not run
another local Playwright session or edit their runtime while this sequence runs.
Alpha 1.0.14 now has both deployment jobs successful and its live character gate
running; later versions still wait for that gate's terminal success.

The final Node 24 phone sequence **passed** and session `87532` is closed:
movement/core menus/chat in both orientations passed in 6.7 seconds (8.0 total),
and the two combat orientations passed in 17.2 seconds total. Both artifact
credential scans and exact disposable cleanup passed. All required local candidate
checks are now complete; 1.0.16 is ready for commit, but its publication remains
behind the committed 1.0.15 release and 1.0.14's active final live animation gate.

### 1.0.14 live failure and manual phone movement follow-up

CI `34015379084` ended in **failure** at Live Release and Character QA. Both
deployments and all preceding jobs succeeded, as did the live four-class matrices.
The final two-account route failed on its original attempt and retry when a real
hostile click did not acquire an attack target. The projected centers were on the
canvas; this alone does not prove that the current ray intersected an active
hostile. Do not classify this as transient or bypass the assertion without evidence.

Added read-only acquisition diagnostics to the multiplayer test: pointer/canvas
ownership, open-menu flags, target activity/position, hovered entity and current
ray hits. The isolated route on `226a298` plus local changes passed in **1.9 minutes**,
including all three party dungeon return cycles, effect lifecycles, remote movement,
jump, basic attack and ability. Log:
`/tmp/eidolon-release14-multiplayer-diagnostic.log`. Credential scanning and exact
disposable cleanup passed. This newer local source is not proof that deployed
1.0.14 passes.

Diagnostic-only branch `qa/release14-click-diagnostic`, commit `527a812`, starts
from exact deployed `af3757b` and changes only the test diagnostics and its branch's
workflow. Run `34017914992` verifies frontend/backend SHA before repeating the
original four-class and remote sequence against production with existing QA
accounts. It has no deployment step or automatic push trigger and must not be
merged as the production CI workflow. The run is pending at this entry.

Meanwhile, local phone input work gives joystick movement priority over old
attack/ability pursuit before actor updates. Crossing the movement dead zone
clears older buffered actions once, while new casts requested with the other thumb
remain available; the selected enemy is retained. Another finger cannot steal
joystick ownership, and blur/reset/cancellation clears the knob and rejects stale
touch movement. No new release number or publication is assigned to this work yet.

The old behavior failed **5 tests** before repair. Focused checks passed **36 tests**;
Node 24 lint and the full client suite passed **158 suites / 2,296 tests** in 55.016
seconds. Logs use `/tmp/eidolon-manual-movement-`. The real-server two-thumb route
passed both orientations in **18.1 seconds**: movement while the second finger
casts, authoritative selected-target health loss, manual takeover of attack pursuit,
retained selection and no resumed pursuit after release. It uses an allowlisted
encounter waypoint for setup, not ordinary traversal or campaign-completion proof.
Physical-phone, all-class and full-menu acceptance remain open.

Diagnostic run `34017914992` subsequently **passed** against the exact deployed
`af3757b` frontend and backend: all four real-input class matrices and the remote
Cleric/Wizard sequence, including basic attack acquisition. Sanitization passed.
Log: `/tmp/eidolon-release14-live-diagnostic.log`. This did not reproduce or explain
the original failure; the loot-first raycast priority is only an investigation
lead, not an established live cause. The original failed job in `34015379084` is
now being rerun unchanged; do not publish successors while it is running.

### Alpha 1.0.17 candidate — your next step is yours

The manual joystick follow-up above now has a separate patch-note entry and
synchronized login, package, release manifest and runtime version defaults. It
remains an unpublished candidate behind 1.0.15 and 1.0.16, not a claim that the
mobile milestone is finished. Final Node 24 client checks passed **158 suites /
2,297 tests** in 44.658 seconds (`/tmp/eidolon-1-0-17-client.log`). Final versioned
lint, server race and anonymous-browser checks are pending at this entry. The
prior two-thumb combat proof uses the same input/runtime changes before the
version-only update; a final versioned phone run remains to be gathered.

Final versioned checks subsequently **passed**: lint, server race suite (root
7.010 seconds; unchanged game package cached), and 12 anonymous browser checks
in 1.1 minutes. The sequential real-server phone route passed in **8.3 seconds**,
followed by both two-thumb combat orientations in **17.1 seconds**. Both
credential scans and exact disposable cleanups passed; local browser session
`44631` is closed. Logs: `/tmp/eidolon-1-0-17-{lint,server,anonymous,phone,combat}.log`.
The candidate is ready for commit; no gameplay release is published by this work.
The original 1.0.14 live gate rerun remains active and successors remain queued.

### 1.0.14 verified; 1.0.15 publication starts; phone item routes underway

The unchanged original live job in `34015379084` subsequently **passed**, making
the full CI run successful after its earlier failure. Independent post-terminal
checks confirmed frontend release metadata, versioned main entry, login label and
backend commit/version all match `af3757b` / Alpha 1.0.14; backend database status
is `ready`. The exact-live diagnostic had also passed independently. The original
acquisition failure was not reproduced or attributed to a confirmed cause; retain
its evidence rather than calling it fixed. Loot-first raycast priority remains
an unconfirmed investigation lead.

Only `2b55efabfa4da459d14f37b5e18b659888de7e1e` was pushed to master next, preserving
the separate 1.0.15 camera release. CI `34018964584` is running. Later commits
remain local; do not push HEAD over this gate. 1.0.17 was committed as `99c9ab9`
after all its local checks completed.

The next local phone work adds readable bag rows and explicit item details/actions.
Source inspection found that mobile material/quest-item clicks returned without
inspection and equipped-slot taps immediately unequipped gear. Seven new tests
failed before the change; the initial candidate passed 20 inventory tests and
lint. Its first rendered check then exposed inherited square-slot geometry causing
neighboring rows to intercept taps. This is a candidate regression, not evidence
that the new layout is ready. Browser session `65130` is still running at this
entry; no runtime changes or replacement browser run are made over it.

### Alpha 1.0.18 candidate — a bag made for your hands

The phone bag/detail implementation now has separate patch notes and synchronized
login/package/runtime release metadata. The initial square-slot regression was
repaired after its browser run ended; three rendered phone layouts passed in
16.4 seconds, including actual touch scrolling, target reachability, comparison
and Back/Escape navigation. Item details expose explicit equip/unequip and
confirmed drop actions, validate current item identity/stack, protect quest items
and preserve desktop drag-out. Native dialog lifecycle cleanup is included.

The real-server inventory route initially failed its combat setup. Diagnostics
proved a level-1 Fighter was dealing damage to a level-10 Skeleton, but not enough
to finish within 40 seconds. Explicitly preparing the dedicated QA character at
level 30 corrected that test precondition; it does not prove first-hour balance.
The resulting normal-combat/loot route passed in 1.1 minutes with authoritative
equip, unequip, canceled/confirmed drop, manual recovery and reconnect persistence
in both phone orientations. No forced kill or guaranteed-loot command is used.
Credential scanning and exact disposable cleanup passed. This route is now part
of full predeploy QA, alongside the existing two-thumb combat route.

Final versioned Node 24 client/lint checks pass: **159 suites / 2,310 tests**, 67.612
seconds, plus server race checks. The first anonymous run ended 14/15 because
Chrome reported `ERR_NETWORK_CHANGED` loading local modules in the login-flow
audit; its trace is preserved at `/tmp/eidolon-1-0-18-anonymous-network-change.zip`.
The unchanged rerun and subsequent versioned combat/inventory checks are pending.
No assertion was weakened and no live local browser run was replaced.

Meanwhile, 1.0.15's predeploy and both deployment jobs succeeded. CI `34018964584`
is now in Live Release and Character QA. Later releases remain queued; 1.0.18 is
not yet committed or published. The wider dungeon, phone and 1.1–1.10 gates remain
open. Detailed phone evidence and remaining limits are in the companion evidence file.

The final 1.0.18 sequence **passed** and session `43940` is closed: unchanged
anonymous rerun **15/15 in 1.4 minutes**, two-thumb combat **2/2 in 17.2 seconds**,
and server-owned bag/equipment/drop/recovery/persistence **1/1 in 1.0 minute**
covering both orientations. Both credential scans and exact disposable cleanup
passed. Final landscape comparison was visually inspected. Server race checks
passed (root 7.816 seconds; unchanged game package cached). Logs use
`/tmp/eidolon-1-0-18-{anonymous-rerun,combat,inventory,server}.log`.
The candidate is ready for commit. 1.0.15 is still in its final live gate;
1.0.16, 1.0.17 and 1.0.18 must retain separate, ordered publication.
