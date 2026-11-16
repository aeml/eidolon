# Alpha 1.2.0 — release candidate

Implementation consolidated for publication; deployment not yet verified. Login,
package and backend versions and player-facing patch notes now identify1.2.0.
This milestone does not complete the1.1–1.10 goal.

## Player-facing changes prepared

- Phone Forge equipment selection uses readable named rows, visible level and
  potency, larger controls and collapsible help. Desktop retains its icon grid.
- Exposed Rogue, Wizard and Cleric faces are smoother. All four heroes have
  visible wrist grips that remain when equipped gloves replace their defaults.
  Shared geometry keeps the hands to one additional mesh each.
- Phone Trading House inventory has named rows, quantity and selection feedback.
  Selling uses a stacked form; auction controls have at least 44px touch targets.
  Auction item stats and descriptions can be expanded without hovering. Listing
  identity/quantity validation and existing transaction callbacks are retained.
- Touch settings now save left/right-handed action placement and 100–120%
  control sizing independently of menu text. The camera's unobstructed region
  follows those controls, and very short landscape uses standard size to preserve
  viewing space. Phone and desktop camera zoom save independently across sessions.
- Phone social/friend/guild lists use readable cards and touch-sized actions.
  Guild roster management is tucked into a named Manage disclosure while retaining
  permission checks and callbacks. PvP challenges, scores and leaderboard entries
  use readable text and scroll within the screen.
- All four heroes lean forward rather than backward when running. Smoothed
  locomotion and animated ankle attachments give default/equipped boots a more
  natural stride, without changing attack timing or gameplay movement speed.
- World map supports single-finger pan, focal-point pinch zoom and explicit zoom/
  Find me controls. Portrait/landscape canvas sizing and phone label caps keep
  town wayfinding readable without oversized labels.

## Focused evidence

- Forge: 14 tests, short 390px Chrome layout/click check.
- Hero models/equipment: 222 tests; four-class static before/after render inspected.
- Trading: 82 tests; actual TradingUI with production HTML/CSS in short 390px
  Chrome preview. Fixed form overflow and low-contrast text found in that preview.
  Rows are 318px wide, 72–94px high, without horizontal content overflow.
- These previews use fixtures, not production economic transactions or physical
  phone sign-off. Exhaustive matrices remain deferred under the delivery policy.
- Touch/settings: 29 focused settings tests and 20 camera/settings tests pass
  (overlapping suites, not 49 unique tests). Short Chrome checks at 390×844,
  844×390 and 568×320 cover both hands at the largest selected size: all movement,
  action and hotbar targets are in bounds, at least 44px and hit-test reachable.
- Community: existing guild/friends/PvP 49 tests pass, plus the focused guild
  rerun (5) checks the new disclosure. Actual SocialUI/GuildUI/PvPUI previews at
  390×844 inspected, with no horizontal guild/PvP window overflow.
- Locomotion: existing model/equipment222 tests pass; four new targeted equipped
  stride checks pass. Side-view before/after rendered poses inspected. This is
  focused presentation evidence, not a comprehensive animation collision audit.
- Map:8 focused tests pass. Actual Chrome touch pan moved30×20 pixels; pinch
  changed scale2→3; Find me and zoom buttons operated in portrait and landscape.
  Rendered canvas366×682 matched CSS dimensions, and labels were visually checked.

## Predecessor live-check correction

Alpha1.1 is live on both domains at377bdf21. CI34727002679 deployed successfully
but its final live job failed after7 passing checks because the dungeon harness
imported `/tests/wizardHuntControls.js` from a production site that omits tests.
The ordinary clear-path observation is now self-contained;26 focused input tests
pass, including actual callback execution for blocked/clear paths. Carry this
test-only repair with1.2; do not claim the failed1.1 dungeon or skipped town-rest
live checks passed. No extra runtime hotfix or exhaustive rerun was started.

## Scope carried forward and deferred verification

The four existing class-specific rigs, hair/hood/helmet silhouettes and equipment
mounts are retained and refined by the face/grip/stride changes above. The earlier
phone bag/vendor detail route, stash, quest/skill sheets, party support and dungeon/
raid-preparation menu remain implemented; Forge, trading, social/guild/PvP and map
complete this milestone's remaining menu treatment. Earlier phone framing and the
player's positive core-menu feedback remain relevant but are not new-device proof.

Full animation/equipment matrices, physical-device ergonomics across iOS/Android,
tablet/full desktop comparisons and long sessions remain final stabilization work
under the explicit feature-first policy. Do not mark those checks passed. Retain
basic live release checks now; deepen combat feedback and touch aiming in1.3.
