# Phone playability — baseline evidence

Status: initial source/DOM diagnosis, not a completed phone redesign. Requirements
and release gates live in [the main roadmap](2026-09-05-v1-1-to-v1-10-roadmap.md#phone-playability-and-interface-redesign--11-through-13).

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
