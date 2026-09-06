# Phone playability — baseline evidence

Status: baseline diagnosis plus incremental implementation evidence, not a completed phone redesign. Requirements
and release gates live in [the main roadmap](2026-09-05-v1-1-to-v1-10-roadmap.md#phone-playability-and-interface-redesign--11-through-13).

Latest local candidate: **Alpha 1.0.15**, camera composition/reset, not yet published.
Earlier entries below are chronological snapshots, not current process status.

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
The existing mobile Attack path selects a nearby hostile rather than respecting
an explicitly tapped enemy (`GameEngineMovement.handlePrimaryClick`); this is a
concrete next interaction-design issue, not resolved by changing the camera.

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
