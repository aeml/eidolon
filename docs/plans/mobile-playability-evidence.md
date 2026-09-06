# Phone playability — baseline evidence

Status: baseline diagnosis plus incremental implementation evidence, not a completed phone redesign. Requirements
and release gates live in [the main roadmap](2026-09-05-v1-1-to-v1-10-roadmap.md#phone-playability-and-interface-redesign--11-through-13).

Latest local candidate: **Alpha 1.0.19**, readable phone conversations and quest tracking, not yet published.
Earlier entries below are chronological snapshots, not current process status.

## Phone quest reading and tracking (Alpha 1.0.19 candidate)

Source: `d77f215` plus local quest UI changes. Phone conversations and the journal
use readable scrolling panels above the permanent chat strip. Accept/Complete/
Continue and daily Back actions stay in a separate reachable footer. Completion
still requires a click and authoritative acknowledgement. Rejected requests show
an accessible error beside the action and allow an explicit retry. Same-quest
progress updates preserve open lore and reading position; journal updates preserve
recovered-lore disclosure and tracking focus. A compact tracker cycles every saved
selection without dropping entries from the player's preferences.

Seven phone unit checks pass; the full client suite passes **160 suites / 2,317
tests in 55.291 seconds**, plus lint. All three initial rendered cases failed
because the test kept locating “Accept Quest” after its label correctly changed
to “Waiting for reply…”. After correcting that locator, the unchanged runtime
passed **360×800, 390×844 and 844×390 in 17.6 seconds**. Native touch scrolling,
reachable footer actions, a 16-contract journal, preserved reading state, saved
tracking selection, unclipped tracker buttons and the visible chat strip are
covered. Inspected portrait dialogue and landscape journal captures:
`/tmp/eidolon-phone-{quest,journal}-{360,390,844}.png`.

These fixtures seed display state and simulate acknowledgements; they do not
prove actual quest earning or server rewards. A new dedicated real-server route
is running separately, with normal combat and manual Ilyra turn-in. Its level-30
and encounter-waypoint setup is explicit, not first-hour balance evidence.
Logs: `/tmp/eidolon-phone-quest-{client,lint,layout,layout-rerun,gameplay}.log`.
The full phone release gate, physical devices and remaining menus remain open.

The real-server route subsequently **passed in 1.3 minutes**: a fresh Fighter
walked to Ilyra using the joystick at default zoom, tapped to accept, earned three
ordinary kills after the documented level preparation, recalled and returned to
Ilyra in landscape. The quest remained uncompleted until Complete was tapped.
Authoritative gold/XP, the authored reply, the next offered chapter and completed
state after reconnect were verified. The credential scan and exact disposable
container/data cleanup passed. No quest completion or kill was granted.

One additional regression demonstrated that daily Back lost the offers-list
scroll position (expected 240, received 0). Conversation-route reading state now
restores it, with fresh state when opening a new conversation. The candidate has
separate 1.0.19 patch notes and synchronized login/package/runtime versions. Final
versioned client, lint, server-race, anonymous-browser and real-server quest
reruns are in progress; logs use `/tmp/eidolon-1-0-19-`. It is not yet committed
or published, and remains queued behind 1.0.16–1.0.18.

The initial versioned checks passed **160 suites / 2,320 tests in 67.487 seconds**,
lint, server race checks (root 9.116 seconds; unchanged game package cached),
and all **18 anonymous browser checks in 1.8 minutes**. Visual inspection then
found a long tracker title overlapping its progress count. The added landscape
assertion reproduced it (title right 241.59, permitted right 204.64 CSS pixels).
Explicit flex sizing/ellipsis repaired the title; all three layouts passed again
in **18.7 seconds**. Log: `/tmp/eidolon-phone-tracker-overlap-{red,fixed}.log`.

The versioned server quest rerun **failed in 1.5 minutes**: real kill credit was
complete, but the manual turn-in did not acknowledge within 15 seconds. That run
did not retain enough state to determine why. A diagnostic-enabled rerun of the
same quest-action runtime **passed in 1.3 minutes**, including turn-in/reconnect;
both runs passed credential scanning and exact cleanup. Do not claim that a
passing rerun establishes the original cause or eliminates an intermittent fault.
Logs: `/tmp/eidolon-1-0-19-quests.log` and
`/tmp/eidolon-phone-quest-turnin-diagnostic.log`.

A separate unit regression confirms that unrelated quest updates replaced the
footer action node and lost its focus. The phone footer now retains matching
action nodes while updating handlers and pending state. Focus and duplicate-click
protection pass in the **14-test focused run**. An explicit browser touch-down /
quest update / touch-release sequence already passed before this change; this
is not proof that node replacement caused the earlier turn-in failure. That
failure remains unconfirmed. Fresh full client/anonymous/server-quest checks
are running with the stabilized footer; their logs end in `-final.log`.

Those final checks subsequently **passed**: **160 client suites / 2,321 tests in
75.584 seconds**, lint, **18 anonymous checks in 1.9 minutes**, and the dedicated
real-server quest route in **1.4 minutes**. The quest stayed unclaimed after actual
kills, then manual landscape completion acknowledged gold/XP and the authored
reply; reconnect retained completion. Credential scanning and exact disposable
cleanup passed. The final landscape tracker capture was inspected with title
ellipsis and a separated progress count. The earlier timed-out turn-in remains
an unconfirmed intermittent observation; passing subsequent runs is not a
root-cause finding. The 1.0.19 candidate is prepared for a separate local commit,
with publication held behind prior complete release gates.

## Phone bag and equipped-item routes (Alpha 1.0.18 candidate)

On top of `99c9ab9`, mobile inventory becomes a scrolling list with readable names,
icons and item metadata; equipment and bag panels use the available phone viewport.
Tapping opens a native modal detail route rather than equipping/unequipping on a
repeat tap. Explicit actions preserve source slot/item identity; Drop requires
confirmation of the current stack and keeps quest items protected. Comparison
uses the intended equipment slot, including the weaker ring/trinket choice, with
no Shift requirement. The detail route retains the bag scroll position and leaves
the persistent chat strip visible below it. Desktop click/drag flows remain intact.

Seven initial regressions failed before implementation. The first candidate passed
20 inventory checks and lint, then failed all three rendered routes: inherited
desktop `aspect-ratio: 1` caused oversized hit areas and neighboring-row pointer
interception. Those runs ended before changing the runtime. Explicit phone row
proportions repaired the geometry; all three 360×800, 390×844 and 844×390 routes
passed in **16.4 seconds**. Inspected captures:
`/tmp/eidolon-phone-bag-{360,390,844}.png` and `-item-{360,390,844}.png`.
These use seeded display data, not owned server inventory. Native touch scrolling,
44px actions, quest inspection, comparison, Back/Escape navigation, preserved scroll
and non-destructive equipped-slot taps are covered. A subsequent layout refinement
places the landscape comparison side by side and awaits its final rendered rerun.

The intermediate full client suite passed **159 suites / 2,304 tests** in 56.269
seconds. Later stale-slot, level, quest-protection, offline-equip and disposal
checks bring the focused inventory run to **25 passing tests**, with lint passing.
Final full-suite verification still remains after those lifecycle additions.

The first real-server route stopped during loot setup, before reaching item
actions. Read-only diagnostics on the subsequent run showed a level-1 Fighter
dealing valid damage to a level-10 Skeleton (150 → 130 HP over 40 seconds), not a
proven attack-acquisition failure. The setup now explicitly prepares the dedicated
QA character at level 30 before normal combat/loot; no forced kill or guaranteed
loot is used. This is an inventory action test, not first-hour balance or normal
campaign-leveling evidence. Session `33951` is currently running that route.

The phone redesign remains open, including remaining menu reflow, stack-splitting
ergonomics, sustained physical-device play, all-class combat and campaign flows.
The candidate now has synchronized 1.0.18 login/runtime metadata and separate
patch notes; it is not committed or published yet. The level-prepared real-server
route subsequently **passed in 1.1 minutes**, including both orientations and
item persistence after reconnect. No item or kill was granted; level preparation
and the encounter waypoint remain explicit setup limits. Both equip and unequip
awaited server state, Drop was tested canceled and confirmed, the intentional
drop stayed outside the bag through auto-loot ticks, and Use recovered it normally.
Log: `/tmp/eidolon-phone-inventory-gameplay-level30.log`; sanitization and exact
disposable cleanup passed.

Final versioned Node 24 client checks passed **159 suites / 2,310 tests** in
67.612 seconds, plus lint and server race checks. The initial anonymous run ended
**14 passed / 1 failed** in 1.6 minutes: the login-flow audit captured
`ERR_NETWORK_CHANGED` for local modules, rather than a failing layout assertion.
Trace: `/tmp/eidolon-1-0-18-anonymous-network-change.zip`. The process ended before
an unchanged full rerun started. Final versioned browser/combat/inventory checks
remain pending; their logs use `/tmp/eidolon-1-0-18-`.

Those final checks subsequently **passed**: the unchanged anonymous rerun passed
all **15 checks in 1.4 minutes**, the two-thumb combat route passed both
orientations in **17.2 seconds**, and the authoritative inventory route passed in
**1.0 minute**, including both orientations and persistence. Both credential
scans and exact disposable cleanup passed. Session `43940` is closed. The final
landscape comparison capture was inspected with both items visible side by side.
Logs: `/tmp/eidolon-1-0-18-{anonymous-rerun,combat,inventory}.log`. The server race
suite also passed (root 7.816 seconds; unchanged game package cached). This
candidate is ready for commit; publication remains queued behind prior releases.

## Manual movement follow-up (Alpha 1.0.17 candidate)

On top of committed `226a298`, the joystick now cancels old approach/attack/cast
pursuit before actor movement, while retaining the deliberately selected target.
The initial movement intent clears older buffered casts once; new second-thumb
casts remain usable while moving. Touch ownership survives unrelated fingers,
and cancellation/blur/reset clears both vector and knob without accepting stale
touchmove events.

The regression first failed 5 tests. Final Node 24 checks passed 158 suites / 2,296
tests plus lint; the two-orientation real-server combat route passed 2 tests in
18.1 seconds, including a second-finger cast during actual movement and subsequent
authoritative enemy health loss. Logs: `/tmp/eidolon-manual-movement-{client,lint,combat}.log`.
The route uses an allowlisted encounter waypoint, and is desktop browser touch
emulation—not sustained physical-phone or full campaign evidence.

Publication is held: deployed 1.0.14's final live remote-attack test failed, and
1.0.15/1.0.16 remain queued locally. The execution ledger tracks the exact-live
diagnostic run; these local phone checks do not override that release gate.

The follow-up now has its own 1.0.17 patch notes and synchronized login/package/
runtime version metadata. The final versioned Node 24 client run passed **158
suites / 2,297 tests** in 44.658 seconds (`/tmp/eidolon-1-0-17-client.log`). Lint,
server race checks and all **12 anonymous browser checks** (1.1 minutes) passed.
The final real-server phone route passed in 8.3 seconds, and both combat
orientations passed in 17.1 seconds; both credential scans and disposable cleanup
passed. Logs use `/tmp/eidolon-1-0-17-`. The candidate is ready for commit, with
publication still queued behind the earlier releases.

## Deliberate touch targeting after the 1.0.15 commit

Source: `2b55efabfa4da459d14f37b5e18b659888de7e1e` plus local targeting changes.
Canvas touch release selects an enemy without attacking. Attack and offensive
skills use that selection; a selected out-of-range cast reports range rather than
switching enemies. Without selection, directional skills retain a facing cast;
self-centered abilities still use the caster. A compact target card/gold ring
shows selection. Empty ground and the 44px Clear Target button cancel pursuit,
queued skills and buffered abilities. NPC/loot interaction remains separate.
Target death/removal, player death, scene changes and changed PvP hostility
invalidate selection. Pinch/drag/cancel/blur/reset cannot become a world tap.

Initial canvas regressions reproduced missing release callbacks and unconsumed
native gestures. The first combat unit harness had an incomplete proto
mock; its import error was corrected before claiming any targeting assertions.
The pre-cycle full suite passed **157 suites / 2,285 tests**, 105.851 seconds,
`/tmp/eidolon-touch-target-full.log`. Later focused cases also cover NPC taps,
friendly/PvP changes and self-centered casts. Browser-generated pinch/tap/drag and
portrait/landscape target-card controls passed **2 checks in 21.4 seconds**,
`/tmp/eidolon-touch-target-browser.log`; inspected UI-only captures are preserved
at `/tmp/eidolon-touch-target-portrait.png` and `-landscape.png`.

The real-server route deliberately uses an allowlisted encounter waypoint for
setup, then normal taps and combat buttons against a live overworld enemy. It
does not grant kills, loot or campaign completion. Initial failures included a
keyboard-based setup helper activating a focused button instead of chat; explicit
phone chat controls fixed that. A single portrait route then passed in 9.5 seconds.
Expanding the route exposed a desktop-user-agent fixture error in landscape;
the route now uses the installed Pixel 7 browser-emulation user agent and asserts
that the game actually enabled mobile mode.

Repeated acquisition failures were not all timing errors. Diagnostics in
`/tmp/eidolon-touch-target-diagnostic.log` showed several normal Skeleton hitboxes
overlapping at the same ray distance, with correct individual entity IDs. The
frontmost enemy blocked selection of the intended rear enemy. The production
repair retains the actual raycast hit stack and cycles overlapping hostiles in
stable ID order on repeated taps. It does not assign the test's preferred target
or loosen targeting assertions. A new unit case verifies cycling without attack.
The browser uses bounded actual taps to acquire the intended visible enemy.

After cycling, **both real-server orientations passed in 18.5 seconds total**,
`/tmp/eidolon-touch-target-cycle-gameplay.log`. The route proves no attack on
selection, a selected-target spell and authoritative enemy health loss, the basic
attack's selected ID, target-card cancellation and no further combat commands
for a subsequent 1.1-second observation. Credential scanning and exact disposable
cleanup passed. The dedicated Wizard route joins full predeploy QA.

Alpha 1.0.16 patch notes/login/runtime metadata are prepared. Final versioned
client/lint passed **157 suites / 2,290 tests**, 104.05 seconds; server race checks
passed (root 11.520 seconds; unchanged game package cached); and two-orientation
combat passed **2 tests in 27.8 seconds**. Logs are
`/tmp/eidolon-1-0-16-{client,lint,server,combat}.log`. Credential scanning and
disposable cleanup passed. Full anonymous browser and final movement/menu checks
remain; no release is claimed yet. Gesture tests and target-card regressions are retained.
The initial anonymous run later ended 11/12: local module loads failed with
`ERR_NETWORK_CHANGED` before the dungeon fixture initialized (trace preserved as
`/tmp/eidolon-1-0-16-anonymous-network-change.zip`). It was not restarted while live.
After it ended, the full rerun passed all 12 checks in 1.4 minutes. The local shell
had also selected Node 18; supported-toolchain checks were explicitly rerun with
the installed Node 24.18.0: lint and 157 suites / 2,290 tests passed in 67.024
seconds. Those logs use `/tmp/eidolon-1-0-16-node24-`; final phone movement/menu
and combat routes subsequently passed with that same toolchain: movement/core
menus/chat in both orientations took 6.7 seconds (8.0 total), and the two combat
checks took 17.2 seconds total. Both credential scans and disposable cleanups
passed. The candidate is ready for commit; publication remains queued in order.
This does not establish deliberate drag-to-aim/cast cancellation, sustained
two-thumb combat, all-class/party/dungeon phone readiness or physical-device
ergonomics/performance. Manual joystick override of queued pursuit is another
remaining interaction to refine, alongside full menu reflow.

## Camera composition candidate after the 1.0.14 commit

Source: `af3757b668da11cc932c9e93b7a0f770259d334b` plus the local camera changes.
The new phone projection covers 24 camera-plane world units along the shorter
viewport edge at default zoom, preserving pixel scale through a simple orientation
swap and retaining manual zoom preference. Desktop projection and isometric angle
are unchanged. This is a wider portrait default, not an attempt to fit an entire
desktop encounter view onto a narrow phone. At 390×844, horizontal default span
increases from about 13.86 to 24 units. Compared with the old maximum zoom-out,
the new default makes rendered objects about 15.5% larger in that viewport.

Persistent navigation and hotbar bounds move the projection center into the space
between them. The initial HUD mount refreshes this framing; transient chat/menu
expansion does not drive it. Reset Camera in the phone Menu restores default zoom
and locks follow onto the player. Pinch changes projection without resizing the
drawing buffer. Ground raycasts continue to use that same projection.

Evidence before version finalization:

- Regression first reproduced **8 failures / 1 pass** in the former projection,
  `/tmp/eidolon-phone-camera-red.log`; all 9 camera tests then passed, including
  desktop invariance, rotation scale, HUD center, ground raycast, reset and finite
  projection. Camera plus shadow checks passed 18/18.
- Full client suite passed **155 suites / 2,266 tests**, 96.557 seconds,
  `/tmp/eidolon-phone-camera-full.log`. Focused menu/engine reset checks and lint
  passed too.
- The initial rendered fixture failed because its test requested a nonexistent
  Goblin mesh. It was corrected to the production Skeleton, not a runtime fallback.
  The corrected camera/HUD browser pair passed **2 tests in 24.3 seconds**,
  `/tmp/eidolon-phone-camera-browser-final.log`. Inspected captures show production
  Fighter/Skeleton silhouettes and a six-unit warning boundary in both orientations.
  Fighter projected height exceeds 44 pixels; sampled warning boundary points fit
  the exercised view. The fixture uses production rendering with a simple terrain
  backdrop, not a dungeon, full town, live combat or a physical phone.
- Real-server fresh-character touch gameplay passed **10.5 seconds**, 13.6 with
  browser overhead, `/tmp/eidolon-phone-camera-gameplay.log`. Both orientations
  exercised joystick movement/release, core menus, chat, default framing and reset
  through Menu. Credential scanning and exact disposable cleanup passed. No quest
  progress or kills were granted, and no combat-readiness claim follows from it.

Captures were preserved at `/tmp/eidolon-phone-camera-portrait.png`,
`/tmp/eidolon-phone-camera-landscape.png` and
`/tmp/eidolon-phone-camera-legacy-maximum.png`. The versioned 1.0.15 anonymous
suite now also checks 360×800, 430×932 and 800×360 camera layouts. Final versioned
checks passed: 155 suites / 2,267 client tests (101.69 seconds), lint, full server
race checks (root 13.480 seconds; unchanged game package cached), 12 anonymous
browser tests (1.8 minutes), and the real-server phone route (12.6 seconds; 15.3
including browser overhead). The versioned phone scan/cleanup passed. Logs use the
`/tmp/eidolon-1-0-15-` prefix (`client`, `lint`, `server`, `anonymous`, `phone`).
Publication still follows the preceding release's live gates.

Remaining: deliberate touch target selection/aim/cancel and combat under pressure,
full menu reflow, adjustment preferences, crowded town/dungeon/group readability,
safe-area/software-keyboard physical behavior and sustained iOS/Android performance.
At this camera-only stage, the mobile Attack path selected a nearby hostile rather than respecting
an explicitly tapped enemy (`GameEngineMovement.handlePrimaryClick`); this is a
separate interaction-design issue, addressed by the later targeting work above,
not by changing the camera itself.

## September 6 baseline

Inspected source: `fd93bd3` with the local 1.0.13 Whirlwind/login candidate.
Neither `InputManager.js`, `RenderSystem.js`, nor `responsive.css` has changed in
that candidate. The player's report remains the authoritative usability problem:
too little useful view until maximum zoom-out, unreadably small world objects,
and menus/controls that are impractical on a phone.

### Camera framing

`RenderSystem` initializes and resizes the orthographic frustum as horizontal
half-span `currentZoom × width / height`, vertical half-span `currentZoom`.
The default zoom is 15, with bounds 5–30. At 1280×800 this gives a horizontal
camera-plane span of 48 world units; at 375×667 it gives approximately 16.87.
Even maximum phone zoom-out only provides approximately 33.73 units while halving
object size relative to the default. These are frustum calculations, not measured
ground-plane visibility or a claim that matching desktop width is the solution.
Real framing must account for the isometric angle, HUD occlusion, silhouette
readability, target approach and telegraph evasion together.

### Small touch/UI elements

`responsive.css` sets mobile health-bar/chat text to 10 CSS pixels and the skill/
interact circles to 45×45 pixels. The short-viewport rule additionally scales the
action cluster to 0.8, reducing those hit regions to 36×36 pixels. This contradicts
the new 44×44 minimum primary-target gate. The fixed objective, combat-intent,
dungeon-hint and chat offsets also need rendered overlap inspection rather than
assuming that viewport-clamped individual panels leave useful gameplay space.

### Menu gestures zoom the world

A non-mutating jsdom diagnostic instantiated the production `InputManager`,
enabled mobile controls, and dispatched bubbling two-finger `touchstart`/
`touchmove`/`touchend` events. Fingers started 50 pixels apart and moved to 80.
The same gesture emitted **one onZoom callback over the canvas and one over
`#quest-window #quest-list`**. The latter should emit none.

The pinch listeners are registered on `window` and do not check touch targets.
The baseline also has no pinch `touchcancel` listener and tracks distance rather
than a stable pair of touch identifiers. Follow-up regressions should require:

- Canvas-only two-finger pinch works and suppresses the conflicting browser gesture.
- Menus, chat, text inputs, HUD and joystick/action-button combinations do not zoom.
- A replacement finger, third touch, cancellation or background/resume cannot
  retain an old gesture or cause a sudden zoom step.
- Zoom magnitude follows distance change, not how many move events a device emits.

This DOM reproduction establishes event-routing behavior, not physical-device
ergonomics or browser gesture handling. iOS/Android and rendered portrait/landscape
evidence remain required. Fixing pinch isolation alone will not satisfy the camera,
HUD, menu or full phone-playability gate.

## Local gesture repair after the 1.0.13 candidate commit

Eleven new regressions first failed against the original implementation,
`/tmp/eidolon-mobile-pinch-red.log`. The local repair now receives the renderer's
specific canvas from GameEngine, accepts only a two-finger pair that began there,
tracks both touch identifiers, and clears on cancellation, replacement, a third
finger, focus loss and scene input reset. Distance-ratio deltas replace the
event-count-dependent fixed step. Repeated mobile setup no longer adds duplicate
listeners. Mouse/keyboard behavior is unchanged by this scoped repair.

All 11 new tests plus 11 existing input regressions pass, and lint is clean.
The browser-generated touch route passed in **3.1 seconds**,
`/tmp/eidolon-mobile-pinch-browser.log`, including canvas spread, menu gestures,
mixed menu/canvas touches and cancellation. It uses the production InputManager
with an explicit canvas/overlay fixture; it is not authenticated gameplay, a
camera-layout assessment, or physical-phone verification. It joins anonymous CI
in the next candidate. Full client regression checking is still running.

These changes are local after committed candidate `b321307`; they are **not part
of Alpha 1.0.13**, and no later version or mobile patch notes have been finalized.

## Local HUD/navigation implementation and rendered checks

The phone HUD fixture initially failed its unobstructed-hit check. Its inspected
390×844 capture showed navigation on top of health/resource bars and the hotbar
overlapping both the joystick and action controls. The local `phone-layout.css`
now separates status, labeled navigation and thumb-control regions, with distinct
portrait/short-landscape arrangements. Navigation and primary action hit areas are
at least 44 CSS pixels; landscape no longer scales them below that size. XP/level
feedback remains in a narrow strip above chat. The clock is omitted from the phone
HUD to free its status area; it is unchanged on desktop.

Mobile chat remains visible as a 48px strip, with new-activity count and explicit
expand/collapse. Expanded history and composing use readable text; collapsing
never removes chat, and mobile dimensions no longer overwrite desktop resize
preferences. The unchanged desktop transcript remains resizable. Native labeled
navigation buttons replace single-letter div controls; the phone Menu now offers
Skills & Runes and Abilities without requiring keyboard shortcuts.

The first revised portrait/landscape fixture passed in 11.6 seconds, but screenshot
inspection found the inherited ability-icon translation overlapping navigation
in landscape. It was removed. A broader party/chat regression then found the
roster retained its old top offset; it now follows the new objective position and
available chat space. The corrected combined browser run **passed all three
checks in 44.1 seconds**, `/tmp/eidolon-mobile-hud-corrected.log`, including both
orientations, unobstructed thumb targets, chat activity/expansion, touch access to
Skills & Runes, and desktop/mobile party and service-window layering.

The earlier full HUD client check passed **154 suites / 2,253 tests**, 85.601
seconds. Subsequent menu-entry/spacing refinements pass 88 focused tests and lint;
a fresh final full run remains required. An authenticated disposable phone route
is running in `/tmp/eidolon-phone-gameplay.log` to exercise actual joystick movement
and core menus. No result is claimed yet. Camera composition, full phone menu
reflow, touch combat/aiming, keyboard/safe-area edge cases and physical-device
acceptance remain open; this local HUD work does not close the 1.1 mobile gate.

### Real-character blocker: minimap above menu Close buttons

The first authenticated phone route timed out; its unconditional CDP cleanup
masked the original stalled action. The route now has bounded action timeouts,
non-sensitive step logging and cleanup that preserves the original failure.
The diagnostic run entered the actual world and accepted/released joystick
movement, then opened Inventory. Its Close tap was intercepted by `#minimap-canvas`.
Log: `/tmp/eidolon-phone-gameplay-diagnostic.log`. Neither attempt is a route pass.

`Minimap` appended its wrapper directly to `body`, above the entire `#ui-layer`
stacking context that owns inventory and other menus. Merely increasing a child
menu's z-index could not fix that ownership error. A new mounting regression failed
before correction; the minimap and its buff tooltip now join `#ui-layer` when
available, retaining a body fallback for isolated fixtures. The phone HUD fixture
now includes the real Minimap as well as UIManager. A fresh authenticated rerun is
active in `/tmp/eidolon-phone-gameplay-layer-fixed.log`; no result is claimed yet.

The layer-fixed real-character rerun subsequently **passed in 10.1 seconds**,
13.9 including browser overhead. Both 390×844 and 844×390 used browser touch input
to move the Fighter with the joystick, open and close Inventory/Character/Quests/
Social, reach Skills & Runes through Menu, and expand/focus/collapse chat. The
isolated services/data were removed and credential scanning passed. The minimap
mounting regression also passes, with all 15 minimap tests green. This establishes
the exercised emulated-phone controls against a real server, not physical-device
ergonomics or full phone combat/camera readiness.

The changes are now being prepared as **Alpha 1.0.14**, with accurate patch notes
and synchronized version defaults. The phone gameplay route uses a dedicated fresh
Fighter in the full predeploy sequence, and the anonymous suite includes both phone
HUD and pinch checks. Final versioned checks are running in
`/tmp/eidolon-1-0-14-client.log`, `/tmp/eidolon-1-0-14-server.log` and
`/tmp/eidolon-1-0-14-phone.log`; no publication is claimed yet.
