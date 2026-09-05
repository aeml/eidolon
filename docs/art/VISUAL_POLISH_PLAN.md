# Eidolon visual polish

Started: September 4, 2026

Status: completed locally on September 4, 2026. All six implementation passes
and the final acceptance checks are complete for the Alpha 1.0.1 candidate.
Nothing has been committed, pushed or published.
The dated progress entries below are a chronological record; their remaining
work lists describe that point in time, not the final acceptance state.

## Intended result

Eidolon should feel like a coherent, carefully finished dark-fantasy action RPG.
Characters should be appealing and recognizable, equipment should fit them and
communicate upgrades, and menus should make ordinary decisions easy. Movement,
attacks, pickups, and transitions should feel responsive and satisfying. Visual
quality must hold up at the actual gameplay camera and while several players
fight together.

The existing `DARK_FANTASY_ART_BIBLE.md` remains the art direction: sculpted
faceted forms, strong silhouettes, layered materials, restrained magic, and
regional character. Improve the production procedural assets directly. Evaluate
shape, lighting, and composition together; increasing detail alone is not the
acceptance criterion.

## Baseline findings

The initial audit used the production animation/equipment gallery in hardware
Chrome at 1440 × 1000. Captures cover all four classes with base costumes and
full equipment. Temporary baseline images are in
`/tmp/eidolon-visual-baseline/`; retain final comparison evidence through the
browser artifact workflow before relying on it as a durable release record.

- Equipment's repeated multicolored socket/relic marks compete with the main
  silhouette. Full equipment needs a controlled accent hierarchy.
- Full loadouts obscure important class costume features. Inspect and improve
  headwear, torso contour, shoulders, glove cuffs, and footwear per class,
  including mixed equipment and every animation state.
- Dark armor masses lose material separation in the gallery lighting. Check
  real region lighting before deciding how much belongs in material values,
  key/fill lighting, or tone mapping.
- Several limbs, shoulders, and armor shells still read as disconnected basic
  shapes. Better transitions, bevels, volume, and layering should create more
  deliberate anatomy and construction.
- Login guidance puts a large amount of instructional text ahead of the main
  action. Shared interface tokens still mix saturated yellow, green, blue, and
  red with the more restrained world palette.
- Existing tests provide substantial functional coverage, but passing mesh
  counts and finite transforms does not prove visual quality. Human-visible
  comparisons must accompany structural checks.

These observations are preliminary. World lighting, menus in actual play,
mobile layouts, and sustained multiplayer motion still require baseline review.

## Implementation passes

1. **Presentation and lighting.** Establish consistent comparison views and
   improve material separation, grounding, shadows, and exposure. Preserve
   region mood and readable combat boundaries. Check both graphics settings.
2. **Characters.** Refine Fighter, Rogue, Wizard, and Cleric anatomy, facial and
   hair forms, costume layering, silhouette, and proportions. Preserve the
   established heroine designs. Improve idle, stride, anticipation, attack
   follow-through, and death poses where visible inspection warrants it.
3. **Equipment.** Improve all 36 equipment families and their 14 rendered slots.
   Fit each class through its full motion range; check grip, shoulder clearance,
   helmets, collars, cuffs, skirts, and boots. Distinguish cloth, leather, wood,
   and metal. Keep rarity, upgrades, sockets, sets, and uniques readable without
   overwhelming the item. Unequipping must restore the base silhouette.
4. **Menus and HUD.** Unify typography, spacing, materials, borders, emphasis,
   hover/focus/pressed states, and scrolling. Prioritize login/class choice,
   inventory and equipped gear, character sheet, journal, skills, and services;
   carry the same treatment through social, trade, guild, PvP, and endgame UI.
   Keep chat permanently visible and controls reachable on small screens.
5. **World and combat.** Review terrain repetition, foliage, architecture,
   services, dungeon/crystal landmarks, enemies, and bosses in context. Give
   reused endgame bosses stronger identity where needed. Tune effects and
   feedback so dangerous attacks, selected targets, allies, loot, and objectives
   remain legible in busy scenes.
6. **Feel and integration.** Check movement starts/stops, turning, local and
   remote animation, input feedback, camera following, hits, healing, pickups,
   and transitions. Resolve visible hitches and jitter without introducing
   artificial input delay or diverging from server authority.

Each pass should leave a coherent improvement that can be independently
reviewed. Record completed changes and evidence below as implementation lands.
Include player-facing patch notes for every released major milestone, and keep
the login version and release identity synchronized when publishing a release.

## Acceptance and verification

- Compare before and after at identical camera, viewport, equipment, graphics
  quality, and animation state. Inspect normal gameplay size as well as close
  views; a successful close-up alone is insufficient.
- Inspect all classes with base, individual, mixed, and full equipment. Check
  front, side, back, idle, moving, and attacking poses for visible intersections,
  gaps, floating attachments, or loss of class identity.
- Preserve pooled resources, actor-owned animation and equipped state,
  replicated appearance, collision, selection, and authoritative attack radii.
- Inspect desktop, narrow, short, and mobile viewports. Test keyboard focus,
  readable contrast, scrolling, reduced motion, and persistent chat.
- Measure frame-time behavior and scene resource counts in comparable scenes.
  Avoid new per-frame allocations, uncontrolled effects, and unbounded geometry
  or material growth. Low quality must preserve gameplay information.
- Use the existing unit tests for touched systems, lint, and relevant hardware
  browser galleries. Exercise actual movement, combat, equipment changes,
  reconnect, and multiplayer when those paths change.
- Run the broader release gates once the integrated visual pass is ready.
  Explicitly distinguish inspected visuals, automated coverage, local gameplay,
  and production evidence.

## Progress

- Active goal created.
- Existing art bible, equipment descriptor/material system, interface tokens,
  login guidance, and rendering setup inspected.
- Initial four-class base/equipment gallery captures recorded.
- First implementation slice: material readability, selected equipment forms,
  and the entry flow. No broad pass has been marked complete yet.

### September 4 — first working-tree milestone

Implemented:

- Added a small code-generated reflection environment so unlit metallic facets
  retain readable material and shape. It is renderer-owned, reused across
  quality changes, fades with regional ambience, and is disposed with the
  renderer. The source radiance data occupies 128 KiB; derived GPU resources
  are additional. No downloaded art or extra shadow-casting lights were added.
- Reduced rarity, socket, set, and unique emission; made socket stones smaller
  with dark mounts; replaced floating ring-like set marks with thin diamonds.
  All item identities and replicated appearance remain represented.
- Rebuilt sword/dagger blades with pointed beveled profiles; replaced the
  shield's misoriented circular ornament with a perimeter rim, central brace,
  and rear grip. Rebuilt helmets with rounded crowns and open faces, and hoods
  with a shaped opening and cloth edging.
- Fixed Cleric headgear being scaled inside her head. Added bounds-based
  regression coverage for all three headwear forms on her rig.
- Reworked login into a compact story introduction and sign-in card. Added
  restrained brass/ink colors, a procedural four-element sigil, persistent
  field labels, autocomplete hints, an announced status area, and a native
  keyboard-operable patch-notes button. Removed delayed form visibility.
- Made the entry screen scrollable and placed authentication before the story
  on narrow screens. Converted class choices into descriptive cards, retaining
  stable button names for keyboard/screen-reader and gameplay automation.
- Shortened initial and post-login guidance while retaining automatic Chronicle
  onboarding, separate daily contracts, and journal/skill/map shortcuts.
- Added presentation browser tests to `npm run test:e2e:anonymous`, which CI
  already runs. Authentication layout fixtures do not contact a real account.

Verification so far:

- Full Jest run: 137 suites, 1,980 tests passed. Subsequent class-card and
  regional-reflection refinements also passed their targeted unit tests.
- Full hardware Chrome gallery plus entry-flow checks: 18 tests passed.
  Coverage includes 36 equipment families, four local/replicated classes,
  animation states, High/Low settings, regional actors, terrain, architecture,
  dungeon interiors, hazards, loot, and effects.
- Entry checks cover 1440×1000, 1280×600, 390×844, and 320×720; reduced motion,
  no horizontal overflow, control reachability, keyboard patch notes, and
  mocked returning/new-character flows.
- Lint and `git diff --check` passed.
- Personally inspected before/after equipped Fighter, Wizard, and Cleric,
  base Cleric, desktop/mobile login, and equipped Fighter under Fire and Umbral
  lighting. All-class captures exist; automated coverage is not a claim that
  every combination has been visually reviewed.
- Temporary comparison captures: `/tmp/eidolon-visual-baseline/` and
  `/tmp/eidolon-visual-pass1/`. Browser tests generate screenshots under
  `test-results/`; later runs can replace that directory. Preserve selected
  comparisons in release artifacts before publication.

Remaining priorities:

- Character facial forms, overbright eyes, large collars, shoulder/limb
  transitions, and torso contours still need a deliberate sculptural pass.
- Full outfits still lose class-specific layering. Inspect all families and
  mixed outfits from front/side/back through animation; headwear bounds and
  finite transforms do not prove absence of clipping.
- Socket mounts add draw calls. Measure full-loadout and raid-scene cost;
  consider consolidating gem/mount geometry while preserving the inset look.
- Carry the new entry palette and interaction treatment into actual inventory,
  equipment inspection, journal, skills, services, and the gameplay HUD.
- Inspect actual region/dungeon gameplay, terrain repetition, encounters, and
  endgame boss identity. Gallery lighting checks are not in-world acceptance.
- Benchmark frame times and resource stability; then inspect movement, camera,
  combat feedback, reconnect, and multiplayer in an isolated gameplay run.

Release status: these are local, unreleased changes. Alpha 1.0.0 remains the
published identity. Add player-facing patch notes and synchronize the login,
release metadata, and asset generation when the integrated release is ready;
do not advertise unfinished passes as shipped.

### September 4 — garment and silhouette refinement

Implemented:

- Replaced cylinder torso lids with tailored waist/abdomen/ribcage/shoulder/
  neckline profiles across the four base outfits and all three torso equipment
  families. Raised and slightly inset shoulder pivots so arms join the upper
  torso instead of hanging below a broad collar-like shelf.
- Separated chest/leg garment length from class-specific width/depth fitting.
  Narrower characters no longer get proportionally shortened armor. Kept
  authoritative bounds, attachment hierarchy, pooling, and animation tracks.
- Replaced Fighter/Wizard luminous eye bars with separate inlaid eyes and
  reduced eye emission on all four classes without dimming ability effects.
- Reused the shaped open hood for the Wizard's starter cowl. Made base cloth
  double-sided so cloaks and front robe/vestment panels no longer disappear
  when viewed from the opposite side.
- Replaced short conical silk leg pieces with long split front/back panels and
  a narrow fabric border, including a shared geometry for the back panel.
- Added structural garment tests: shaped neckline, clear hood opening, separated
  eyes, two-sided cloth ray hits, independent fit dimensions, finite animation
  samples, unequip restoration, and unchanged authoritative bounds.
- Added `character-fit.spec.js` to the hardware animation CI command. It records
  all four full loadouts at fixed idle/run/attack times from front/side/back.
  The fixture sets authoritative presentation rotation and removes animation
  fades before sampling; assertions check active time, weight, and attachment
  parents so a static front view cannot masquerade as a pose check.

Evidence:

- Final full unit suite including skirt refinement: 138 suites, 1,992 tests
  passed. Lint and whitespace checks also passed.
- Four fixed-pose browser checks passed; Wizard and Cleric were rerun after the
  skirt refinement and both passed. Screenshots are in
  `/tmp/eidolon-fit-playwright/` and `/tmp/eidolon-skirt-playwright/`.
- Inspected equipped Fighter/Cleric fronts, Fighter cape/back, Rogue attack,
  and Wizard running side view. These are sampled poses, not a claim that all
  movement is intersection-free.
- Actual local gameplay and menu baselines captured using an additional
  disposable account in the isolated test stack:
  `/tmp/eidolon-visual-ui-baseline/{town,inventory,character,journal}.png`.
- Isolated real-input ability/rune matrices passed for Fighter, Rogue, Wizard,
  and Cleric. This exercised actual authentication, class entry, and production
  game UI against the disposable local server. Credential-artifact scan passed;
  the test containers/network were verified removed after cleanup.

Next work, informed by the live baseline:

- Character sheet: replace the tall empty stats column and cramped two-column
  slot list with a deliberate equipment-inspection layout, ideally a preview
  of the actual equipped character. Keep slot interactions and mobile reach.
- HUD: reduce competing saturated colors, the oversized clock, and repeated
  generic town guidance; give the active Chronicle objective clear priority.
  Chat must remain visible, including after Escape.
- Inventory and journal: shared spacing, readable hierarchy, quieter borders,
  concise help, and proper empty states.
- World: town paving has conspicuous repeated gold crosses and oversized
  masonry motifs. Review real camera scale and regional surfaces together.
- Performance: investigate settled frame-time distributions separately from
  loading and screenshot capture. The visible diagnostics during these captures
  are not a controlled frame-time benchmark.

### September 4 — equipped character sheet

Implemented:

- Replaced the empty stats column / cramped slot list with a 600px desktop
  dressing-room layout: fourteen equipment slots flank a real equipped model;
  level, vitals, attributes, damage and defense sit in compact sections below.
  Narrow screens retain both slot rails and scroll within the viewport.
- Added on-demand `CharacterPreview`: creates graphics only when the sheet
  opens, uses the same class factories and equipment attachments as the live
  actor, and offers left/right/front controls. No second animation loop;
  health/XP changes do not redraw the scene. Pixel ratio is capped at 1.5.
  GPU/context costs and first-open latency still need controlled measurement.
- Preview owns its renderer and reflection texture, borrows shared immutable
  geometry/materials, and releases its resources on engine destruction. It
  redraws after resize/context restoration and leaves slots usable if a second
  WebGL context cannot be created.
- Equipment slots are keyboard-operable buttons with descriptive labels and
  focus tooltips. Updating a focused slot preserves focus; unequipping dismisses
  the old tooltip. Existing drag/drop and server callback routing are retained.
- Fixed Enter-to-chat stealing native menu activation, and Space on a focused
  button also firing the gameplay ability. Gameplay Enter and permanent chat
  remain supported.
- Removed the full-image rarity multiply tint from inventory/equipment/service
  icons. Rarity still colors the frame, while the icon's material colors remain
  readable. Quieted equipment potency labels to match the sheet.
- Character-sheet change detection now includes visual equipment metadata,
  class identity and resonance spending, preventing stale previews/trait ranks.

Evidence:

- Hardware-browser fixture passed all four classes with fourteen actual
  attachments, rotation/reset, keyboard unequip, desktop/short/mobile/320px
  layouts, persistent chat after Escape, and canvas disposal. Inspected desktop
  Fighter/Cleric, narrow and short screenshots in
  `/tmp/eidolon-sheet-playwright/`. This fixture uses production UI/rendering
  with synthetic character data and makes no account/backend writes.
- Extended the real-game menu smoke check to require a rendered preview whose
  class and equipment signature match the live player. Isolated local smoke
  passed login, movement, menu/companion use and reconnect with the actual game
  renderer active. Credential-artifact scan passed; disposable stack cleanup
  completed. This is not production-server evidence.
- Added unit coverage for lazy/diffed rendering, all-class switching, finite
  preview framing, rotation, hidden/disposed behavior, resource ownership,
  unavailable-context fallback, keyboard input routing and untinted item art.
- Final regression run: 139 suites / 2,000 tests passed. Lint and whitespace
  checks passed. Verified no isolated QA containers or networks remained.

Next: the broader HUD/inventory/journal treatment, repeated town paving, further
character/equipment refinement and controlled frame-time measurements remain
open. The overall goal is not complete, and no release/version bump has been
published for these working-tree changes.

### September 4 — shared interface and objective hierarchy

Implemented:

- Shared ink/slate surfaces, brass emphasis, quieter borders and window headers;
  increased muted-text contrast and more restrained health/mana gradients.
  A numeric contrast regression protects small white bar labels and secondary
  text against the relevant base colors. This is not a full accessibility audit.
- Reduced the oversized clock to a compact, tabular time display. Removed its
  decorative crossed-swords emoji and heavy glowing red/gold frame.
- Merged next-step guidance into the first objective card instead of repeating
  the same title and instructions above the list. Dungeon cadence, route
  sequence, exit instructions, rewards, and recovery remain available.
- The active Chronicle now leads in town; ordinary `town_return` guidance no
  longer displaces it. Explicit respawn/recall recovery still takes priority.
- Shorter inventory help retains comparison, Shard, Heart and Gem guidance.
  Journal's Chronicle panel uses shared styling. Skills/talents/runes/combos
  use the brass/sage accents and styled buttons instead of neon highlights and
  unstyled browser controls.
- Live inspection found first-open skills content extending below the screen:
  the empty panel was positioned before rendering its larger contents. Managed
  windows now observe size changes and reflow/clamp after content updates. The
  observer is disconnected on replacement and engine destruction.
- Removed inline HUD positioning/layer values that overrode responsive CSS,
  and inline quest-window layers that put them below the clock. Main gameplay
  panels sit above HUD cards, with tooltips/connection alerts above those.

Verification performed during this pass:

- Full unit regression: 140 suites / 2,004 tests passed; includes objective
  deduplication, story/recovery priority, window resize observer and palette
  contrast checks. Later inline-layer cleanup received focused regression.
- Three hardware-browser entry/character-sheet checks passed, including
  keyboard controls and narrow/short layouts, using
  `/tmp/eidolon-hud-regression/` for artifacts.
- Repeated isolated gameplay smoke checks produced actual-game crops of the
  clock, objectives, vitals, inventory, journal and skills. Inspection, not
  just green test status, caught the clipped skills panel and inline HUD layer
  overrides. Capture mode excludes authentication forms and chat transcripts.
- Final isolated smoke passed login, movement, menu bounds/layer checks and
  reconnect; inspected the corrected skill-window crop with no HUD overpaint.
  Final component images are retained in `/tmp/eidolon-hud-live-pass/`.
  Credential scan passed and temporary containers/networks were removed.

Remaining: town/world surface repetition, more character/equipment refinement,
combat/animation readability, controlled performance measurements, and the
remaining service/social/endgame interface consistency sweep. No claim of
whole-game visual completion or production deployment is made here.

### September 4 — world surface scale and repetition

Implemented:

- Replaced Lanternhold's large black-lined bricks and repeating bright cross
  marks with smaller, offset stonework, softer mortar/bevel transitions, chipped
  corners and low-contrast variation. Architectural oath marks remain distinct
  landmarks instead of being stamped across the ground.
- Town uses eight stone columns / sixteen rows per tile with wrapped cell
  identities. On its existing 198.5-unit plane, stone length is approximately
  0.89 units instead of the old roughly 2.7 units on High / 5.4 on Low.
- Low and High keep the same physical town layout. Other realm/ocean samplers
  now use canonical coordinates too: Low no longer doubles feature scale or
  moves the authored fracture/seam/root patterns. High for those surfaces and
  the resolution-dependent sky star treatment remain unchanged.
- No added geometry, texture layer, shader pass or per-frame generation. The
  town surface remains two triangles with a 256² High / 128² Low RGBA map.

Evidence and performance scope:

- Gameplay-camera comparison uses the production town material and plane size,
  town lighting and a Fighter for scale. Before/after captures are retained in
  `/tmp/eidolon-terrain-before/` and `/tmp/eidolon-terrain-after/`.
- Standalone 1440 × 1000 hardware Chrome comparison, after 60 warm-up frames:
  median frame interval stayed approximately 16.7ms on both qualities; p95 was
  16.7–16.8ms before/after. Renderer residency stayed at 118 geometries and 24
  textures in this fixed fixture. These capped, small-scene measurements do not
  prove whole-game headroom or multiplayer performance.
- Texture source memory stays 262,144 bytes High / 65,536 bytes Low. Single
  sampled generation calls rose from about 10.9ms to 21.5ms High and 1.7ms to
  5ms Low. This is a loading-time tradeoff, not a frame-time improvement claim.
- Actual isolated town gameplay smoke passed login, movement, menu inspection
  and reconnect. Inspected the ground-only crop alongside the scale fixture;
  artifact credential scan passed and temporary test data was cleaned up.
- Added deterministic tests for cross-quality stone centers, bounded color
  values, physical scale, wrap seams versus ordinary interior joints, and
  registered Low/High features on Earth/Water/Fire/Air/ocean. Added the
  gameplay-scale terrain comparison to the hardware browser command.
- Final regression: 140 suites / 2,011 tests passed, plus both hardware terrain
  browser checks and lint/whitespace checks. Inspected the six-surface High/Low
  gallery pair and gameplay-scale town pair in `/tmp/eidolon-terrain-final/`.
  Final gallery runs overlapped unit QA and are not the controlled timing pair
  reported above. Confirmed no disposable QA containers/networks remained.

Still open: full-scene frame-time/resource measurements, additional character
and equipment refinements, busy combat/movement presentation, and the remaining
secondary interface sweep. This remains a working-tree visual overhaul.

### September 4 — full-scene diagnostics, movement and secondary panels

Implemented:

- Added opt-in `EIDOLON_E2E_PROFILE_VISUALS=1` to the isolated gameplay smoke
  route. It samples 180 actual game-loop frames after 60 warm-up frames per
  quality/panel state, reporting frame intervals, JavaScript/submission CPU
  time, whole-frame draw calls/triangles, and world/preview resource counts.
  CPU loop time is not GPU execution time. Normal CI smoke has no extra wait.
- Fixed the in-game performance overlay to aggregate the complete frame,
  including shadow maps and post-processing, rather than reporting the final
  fullscreen triangle. Counters reset each frame and renderer reset policy is
  restored even on failure. Shadow coverage/quality were deliberately retained.
- Fixed optional camera impact timing: duration is in seconds but the clock is
  in milliseconds. The softened impact now decays over its intended interval;
  camera shake remains disabled by default. Deterministic tests cover the
  intermediate offset, decay, expiry and exact return to the followed target.
- Managed service/social panels share a layer above HUD cards. Settings, Help,
  Report and Patch Notes and their backdrop sit above panels/clock; tooltips
  remain above those dialogs. Removed Trading House's overriding inline layer.
  World map and specialized generated/trade/death overlays retain their own
  layering; this is not a claim that every overlay has been unified.
- Floating combat text now stays behind HUD/panels instead of drawing over
  menus. Social shell/title, Settings labels/fields/sliders, and Forge headings
  and guidance card use the shared palette. Forge tabs fit narrow panels.

Evidence:

- Isolated real-game profile at 1440 × 1000, with no competing test/build work:
  High town samples had 16.7ms median / 16.8ms p95 frame intervals, approximately
  1,926–2,061 draw calls and 171,820–175,447 triangles per complete frame. Low
  had 16.7ms median / 16.7ms p95, 286 calls and 67,728 triangles. This capped
  town sample does not establish busy-combat or multiplayer headroom.
- Sampled JavaScript/submission median was 10.7–14.9ms High / 4.6–5.2ms Low.
  JIT warm-up and moving world entities prevent interpreting differences
  between closed/open/closed-again samples as a causal preview speedup.
- World residency stayed at 204 geometries / 29 textures throughout; opening
  the preview added its separate 44 geometries / 4 textures. Across every
  settled sample the preview rendered zero additional frames, including while
  open. It retains those resources for reopening until engine destruction.
- Actual isolated real-input movement QA passed nearby/sub-arrival clicks,
  sustained acknowledged travel, idle stability and camera coherence. The
  credential artifact scan passed; disposable test containers/network were
  removed and verified absent. This is local gameplay, not production evidence.
- Anonymous browser test covers eleven service/social/support panels at
  desktop, short and mobile sizes: viewport bounds, horizontal overflow,
  uncovered headers, HUD/dialog/tooltip layer order, and persistent chat after
  Escape. Inspected Social desktop and Settings/Forge mobile captures;
  final artifacts are in `/tmp/eidolon-menu-layers-final/`. Fixtures use real
  UI/markup without accounts; empty service lists are not populated-state QA.
- Final unit regression passed 141 suites / 2,015 tests. All four anonymous
  browser checks passed, plus lint and whitespace checks. Interface regression
  artifacts are in `/tmp/eidolon-interface-regression/`.

Still open: busy combat/multiplayer presentation, populated service/endgame
dialogs, final all-family/mixed equipment review, and integrated release gates
and player-facing release notes. Goal remains active; changes are unpublished.

### September 4 — multiplayer presentation and reliable danger boundaries

Implemented:

- Boss/elite/minor warning rings no longer disappear at the trough of their
  pulse or expand/shrink away from the authoritative attack radius. The edge
  stays fixed and uses a bounded brightness pulse; fill escalation, regional
  motifs, labels and lifetime/cleanup remain intact. No new meshes/materials,
  particles, server changes or altered damage radii were introduced.
- Added gameplay-zoom browser evidence with production Clerics, overlapping
  Spirit Guardians and a Furnace Rupture warning. Fixed warning phases include
  the former invisible trough and former maximum radius error, on High/Low.
- Added opt-in world-only captures to two-account multiplayer QA. Screenshots
  suppress DOM overlays/transcripts and 3D account name tags, restoring them
  afterward. Default credentialed QA still produces no screenshots/video/trace.

Evidence:

- Isolated two-account Cleric/Wizard run passed party replication, persistent
  aura/boost refresh, reconnect reconstruction, authoritative expiry/cleanup,
  ground effect, summon, projectile, teleport, persistent area, remote movement,
  jump, basic attack and ability presentation. Both pages passed their browser
  failure audit; the artifact credential scan passed. One preceding run reached
  the gameplay assertions but failed its final console audit on
  `ERR_NETWORK_CHANGED`; a fresh run passed without suppressing the error.
- Inspected the real-game Low-quality boosted-guardians and gravity-well
  captures in `/tmp/eidolon-multiplayer-polish/`. These establish two-client
  presentation, not raid-load performance. They also expose the large repeated
  Gloamwood ground cells as a remaining world-art issue, distinct from the
  already improved town paving.
- Inspected before/after warning troughs at matching camera/phase in
  `/tmp/eidolon-combat-before/` and `/tmp/eidolon-combat-after/`. The warning
  outline is now readable while friendly auras remain distinguishable. Actors
  and orbiting guardians continue animating, so their pose/time is not frozen
  between captures; only the warning phase and camera are fixed.
- Three targeted unit suites / 40 tests passed, including 100 warning samples
  per minor/elite/boss tier, exact radius and position, bounded nonzero opacity,
  expiry and cleanup. Hardware browser check passed all four phases on both
  qualities. Disposable QA containers/networks were verified absent afterward.

Remaining: Gloamwood/repeated world-surface polish, populated service/endgame
screens, final mixed-equipment review, busy raid-scale cost and release gates.
The complete goal remains active and all changes are local/unpublished.

### September 4 — Gloamwood ground polish

- Replaced the large closed root/cell outlines and bright square chips exposed
  by combat captures with periodic, smoothly blended loam/moss fields, subdued
  embedded grains and short tapered root fragments. This preserves Gloamwood's
  earthy identity while reducing competition with actors, loot and warnings.
- Surface dimensions, UV repeat, texture resolution/format, material count,
  geometry and per-frame rendering work are unchanged. Low/High use the same
  canonical feature coordinates; seams and color variation have regression
  coverage. Other realm samplers are unchanged in this pass.
- Gameplay-scale before/after at 1440 × 1000 is retained in
  `/tmp/eidolon-earth-before/` and `/tmp/eidolon-earth-after/`. Inspected the
  High comparison and the updated Low combat-warning composition in
  `/tmp/eidolon-earth-context/`.
- Controlled capped fixture samples: before/after median frame interval 16.7ms,
  p95 16.7–16.8ms, residency 118 geometries / 24 textures. Source data remains
  262,144 bytes High / 65,536 Low and the floor remains two triangles. Sampled
  generation increased from 16.9ms to 29.8ms High and 3.8ms to 5.5ms Low;
  generation is loading work, not per-frame work. This is not a raid benchmark.
- Targeted terrain/environment tests passed (16 tests); the six-surface gallery
  and all fixed-phase High/Low combat warning checks passed. Lint and whitespace
  checks passed. Populated endgame/service screens, the final equipment review,
  raid-scale cost and integrated release gates remain open.
- Repeated isolated two-account combat QA passed with the new ground. Inspected
  its Low-quality gravity-well capture in `/tmp/eidolon-earth-live/`; account
  names/transcripts are suppressed. Credential scan passed and temporary QA
  containers/networks were verified removed.

### September 4 — Malachar's distinct endgame model

- Replaced the Dark King's plain Hollow Sentinel alias with a dedicated
  procedural recomposition: black iron and tarnished gold, a fractured crown,
  folded royal mantle, gauntlets, four subdued bound-element seals and a
  beveled oathbreaker sword. Removed the Thorncrypt green sigil, ribs, bone
  tatters and orbiting witchlight ornaments. Shared source materials remain
  unchanged for the original Sentinel and other bosses.
- Fixed actual remote creation to request `UmbraPrime`, not `HollowSentinel`,
  and supply Malachar's name. Preview/factory pooling and live entity routing
  now select the same model. The existing animation skeleton and five clips
  remain; the body offset and clip heights were adjusted to ground his feet,
  and the sword rests at a forward low guard without piercing the floor.
- Combat radius remains 2.5 before server scale. The input-only declared
  silhouette radius is 3.1 to encompass the inclined sword; height stays within
  the existing 6.75 bound. Rebuilt rest-pose ownership after recomposition so
  pooling restores new pieces without retaining removed ornaments.
- Final base model is 42 meshes / 898 triangles versus the source Sentinel's
  69 / 1,566. These are geometry counts before interaction/name-tag additions,
  shadow passes or server scale, not a frame-time benchmark.
- Inspected original and new Idle, new Attack/Death, and final side/back views
  in `/tmp/eidolon-king-before/` and `/tmp/eidolon-king-final/`. Hardware browser
  checks cover Idle/Run/Attack/Death on High/Low under Umbral lighting. Unit
  coverage verifies all five clips, resource isolation/reuse, grounded bounds,
  pool reset and production remote/factory selection. This is not evidence of
  completing the server's full 5–10-player Dark Realm encounter.
- Regenerated `docs/ANIMATION_COVERAGE.md` from the updated actor manifest.
  Full regression passed 142 suites / 2,027 tests; hardware model checks,
  lint and whitespace checks passed.
  Populated raid/service menus, the final equipment review, raid-scale cost
  and integrated release gates remain open; no release has been published.

### September 4 — Populated adventure and service menus

- Split the portal's long combined list into Dungeons / Raids tabs, with a
  shared party summary, fixed header/tab controls and a scrolling body. Raid
  cards have subdued elemental accents, a desktop two-column layout, a narrow
  single-column layout and explicit story/party gates. Players below their
  first raid receive Chronicle guidance instead of an unexplained empty list.
  Dungeon selection, difficulty, run levels, raid requirements and network
  payloads retain their existing rules.
- Added labelled selectors, pressed difficulty states, roving arrow/Home/End
  tab navigation, contained Tab focus and opener focus restoration. Native
  Enter/Space activation no longer also triggers multiplayer chat/abilities.
  Gameplay Escape closes the adventure dialog without opening pause behind it;
  the permanent chat remains visible.
- Populated service-window QA now includes all 14 equipped slots, selected
  Forge upgrade details, stash/buyback items and auction rows. This exposed
  default white auction controls and cramped narrow rows. Trading controls now
  use the shared dark theme; narrow auction rows become two-column cards with
  a labelled price and reachable action buttons. No trading authority changed.
- Inspected ready desktop and follower mobile raid captures, selected Heroic
  dungeon controls, populated mobile Forge, and before/after mobile auction
  rows. Evidence is in `/tmp/eidolon-raids-final/`,
  `/tmp/eidolon-ui-integrated/` and `/tmp/eidolon-ui-final/`. Fixtures use
  synthetic items, party flags and intercepted callbacks; they do not form
  actual raids, buy auctions or change player accounts.
- Integrated hardware art suite passed all 25 checks, covering the 36 equipment
  families, four classes/local and replicated attachments, actor/effect/realm
  families, fixed-pose fits, sheet use, warning edges and Malachar. Inspected
  final Fighter idle front, Rogue attack side, Wizard run front and Cleric
  attack front captures in `/tmp/eidolon-polish-final-gallery/`; these are
  deliberately dense 14-slot mixed-rarity/set/gem showcase loadouts. Automated
  coverage is broader than the manually inspected frames.
- All six integrated anonymous browser checks passed, including populated
  services and adventure states at desktop, short and narrow widths. The full
  unit suite passed 142 suites / 2,027 tests before the final input regressions;
  subsequent input/menu regression checks passed three suites / 85 tests. Both
  adventure browser tests passed again with the real input handler and chat/
  Escape bindings. Lint and whitespace checks passed.
- Isolated authenticated portal QA passed real server-authoritative dungeon
  entry and exit at the allowlisted waypoint. Artifact credential scan passed;
  the disposable containers and network were verified removed afterward.

Remaining: raid-scale busy-frame/resource evidence, final integrated release
validation and synchronized player-facing patch notes/version/cache identity.
The overall goal remains active; these changes are local and unpublished.

### September 4 — Busy-scene resources and release candidate

- Added `npm run test:e2e:visual-load`: ten fully equipped mixed-class heroes,
  Malachar, four production area fields and four pulsing labelled boss warnings.
  It records 180 frames after 60 warm-up frames on High/Low, clears the scene,
  and rebuilds it to check resident geometry/texture stability. This is a
  controlled rendering workload, not ten network clients or a complete raid
  map/encounter. CPU numbers measure render submission, not the entire game loop
  or GPU duration. Hardware: AMD integrated Radeon / RADV Renoir through ANGLE.
- The first run found a real leak: four warning labels added four unreleased
  GPU textures on every rebuild (28 → 32). Transient effects now dispose only
  explicitly owned label maps and become inactive on explicit disposal. Shared
  maps are preserved. Expiry, explicit/idempotent cleanup, and shared-map
  ownership have unit coverage; repeated browser counts are stable afterward.
- Batched opaque rigid equipment siblings sharing material and shadow state.
  Actor bones, anchor transforms, fit scales, named source pieces and item
  metadata remain intact. Merged geometry is immutable and reused. All 36
  families on both sides have exact attribute/triangle/material/shadow tests,
  and repeated instances share geometry without sharing mutable transforms.
  All four fixed-pose fit tests, equipped-sheet interaction and warning
  readability passed again; inspected the batched Fighter front comparison.
- Before/after batching: High calls 3,002 → 2,672; Low 1,558 → 1,393. Triangles
  unchanged (64,357 / 34,168). After batching, High median 21.9–22.4ms / p95
  28.1–30.1ms; Low median 16.8–17.0ms / p95 23.3–24.3ms. Render CPU medians
  were approximately unchanged (20.7ms High; 14.5–15.1ms Low): this proves fewer
  draw calls, not a measured FPS gain or a universal 60fps guarantee. The
  deliberately dense loadout remains demanding on this integrated GPU.
- Busy/repeated residency is 282 geometries / 28 textures on both qualities;
  clearing the fixture returns to 241 / 24, with remaining art resources cached
  for reuse. Before/after evidence: `/tmp/eidolon-raid-sized-fixed/` and
  `/tmp/eidolon-raid-sized-batched/`. The failing pre-fix run is retained in
  `/tmp/eidolon-raid-sized-profile/`.
- Prepared local Alpha 1.0.1 patch notes (retaining every earlier milestone),
  login/release/package/server/deploy defaults and asset generation
  `2026-09-04-11`. Full unit suite passed 142 suites / 2,071 tests, lint passed,
  dependency audit reports zero vulnerabilities, and movement hot-path
  benchmark passed. Nothing has been committed, pushed or deployed.

### September 4 — Party/chat integration correction

- The final multiplayer check exposed two distinct interactions. Enter was
  correctly activating the still-focused, visible party Invite button instead
  of stealing focus into chat. The QA action now explicitly clicks chat.
  That click exposed a genuine party-roster overlap with the chat composer on
  shorter screens; no force-click or hidden-chat workaround was used.
- Moved the party roster below the player HUD and sized its scrolling region
  against observed chat height. Chat resizing reserves room for a compact
  roster. Party health rows precede secondary controls, detailed reward
  explanations remain in the tooltip, and the invitation field can shrink
  without clipping its buttons. Mobile uses its actual chat bottom offset.
- The populated screenshot also exposed colliding Whispers/Game tab labels.
  Chat now uses proportioned columns and contained unread badges; Arrow keys,
  Home and End switch tabs while retaining keyboard focus. The chat resize
  observer is disconnected on engine destruction.
- Ten-member party fixtures pass at 1280×720, 1280×600, 390×844 mobile and
  320×640, with default and maximized chat. Real clicks reach both chat and
  party invitation inputs; channel labels do not overflow. Inspected the
  final short-screen composition in `/tmp/eidolon-party-chat-final/`.
- Fresh isolated two-client multiplayer passed after the overlap fix, including
  party state, guardians refresh/late-join reconstruction/expiry, remote ground
  effect/summon/projectile/teleport/area, movement, jump, basic attack and ability
  presentation. A fresh authenticated smoke also passed login, movement,
  gameplay/character-preview menus and reconnect. Both artifact credential
  scans passed. Initial failed runs are not counted as successful verification.

At this checkpoint the release candidate remained local/unpublished, with final
integrated browser and movement checks pending. The closeout below supersedes
that intermediate status.

### September 4 — Final equipped-fit and rendering verification

- The final character-sheet close-up exposed a neck gap: necklaces replace
  costume collars, but three classes lacked a permanent physical neck and the
  Cleric's neck was treated as removable equipment. Each class now keeps a
  small shared-geometry skin neck beneath that equipment layer. Anchors, bones,
  animation and authoritative combat bounds are unchanged.
- Four new unit cases check visibility and overlap with the face and equipped
  torso through necklace/pendant/choker changes and unequipping. All five
  affected hardware browser checks (four class fit routes and equipped-sheet
  interaction) passed after this correction. Inspected the final Fighter and
  Cleric sheet close-ups in `/tmp/eidolon-neck-fit-final/`.
- The final ten-hero workload passed again after this fit correction. High
  renders 2,692 calls / 64,997 triangles; Low 1,403 / 34,488. Busy and repeated
  residency remains 282 geometries / 28 textures, clearing to 241 / 24 on both
  qualities. The small increase from the earlier batching comparison is the
  ten visible necks, including their High-quality shadow passes.
- Final measured High median was 16.7–16.8ms, with p95 42.6ms on the initial
  busy sample and 18.2ms on its repeat; Low median 16.7ms, p95 16.9–17.2ms.
  Render CPU medians were 12.8–15.6ms High and 8.4–9.0ms Low. These differ
  substantially from earlier timings on the same machine, so retain both
  observations: scheduling, warm-up and host load affect this measurement.
  Stable resources and reduced submission counts are established; neither
  perfectly smooth High settings nor a causal FPS gain is claimed. Evidence:
  `/tmp/eidolon-neck-load-final/`.

## Alpha 1.0.1 acceptance audit

| Requirement | Implementation and evidence |
|---|---|
| Coherent lighting and material presentation | Renderer-owned procedural reflections, material-aware equipment caching and restrained emission. Regional hardware galleries plus inspected town/Fire/Umbral comparisons; reflection/disposal/shadow coverage tests. |
| Refined character and equipment models | Four tailored class silhouettes, separated inlaid eyes, shaped open headwear, improved weapon/shield profiles and split garments. Unit coverage for all 36 equipment families; hardware local/remote class/state/quality coverage and fixed-pose front/side/back loadouts. Named anchors, skeletons and authoritative combat bounds remain intact. |
| Equipment looks correct when worn | Independent fit width/length, corrected Cleric headgear and shoulder attachments, preserved class faces, de-tinted item icons. Equipped 3D sheet uses the same factories and attachment path; live smoke compares its appearance signature to the actual player. Exact batching attribute/material tests supplement inspected fits. |
| Clean, usable menus and HUD | Shared ink/brass styling; responsive login/class choice, character sheet, skills, journals, services, social and adventure menus. Populated auction/Forge/stash/raid/party fixtures check bounds, layers, scrolling, focus and real input reachability. Chat remains present through Escape and party changes. |
| World/combat readability | Fine town paving and Gloamwood soil at matching High/Low feature coordinates; exact continuously visible warning edges; dedicated production-routed Malachar. Hardware realm/hazard/dungeon/effect coverage and inspected actual two-client combat/portal/town evidence. |
| Smooth, clean interaction and motion | Corrected camera-impact units and native control activation, on-demand preview rendering, live acknowledged movement/camera checks, and isolated two-client party/reconnect/animation/effect/combat QA. No server authority or progression changes in this pass. |
| Measured rendering/resource cost | Repeated ten-equipped-hero rendering fixture exposes and verifies the warning-texture leak fix; batching reduces High draw calls by 330 with identical triangles. High/Low timing and stable resource counts are recorded above, with hardware and workload limitations. |
| Player-facing release record | Alpha 1.0.1 patch notes lead the retained milestone history. Login, release manifest, package, server/container/deploy/CI defaults and asset generation 2026-09-04-11 are synchronized and covered by version tests. |

Verification ledger for the current candidate:

- Full unit regression after the final neck correction: 142 suites / 2,076
  tests passed.
- Anonymous UI/entry suite: all 7 checks passed, including populated party/chat
  and adventure-keyboard use. Evidence: `/tmp/eidolon-1-0-1-ui/`.
- Actual isolated gameplay: fresh smoke, movement and two-account multiplayer
  routes passed; earlier portal entry/exit passed. Credential scans passed and
  disposable QA containers/networks were verified absent after completion.
- Hardware art suite: all 25 checks passed in the final serial full-gallery
  run, `/tmp/eidolon-1-0-1-gallery-final/`. An earlier run's sheet import
  failed with `net::ERR_NETWORK_CHANGED` fetching `ForgeUI.js`; that failed
  run is not counted as a pass. After the subsequent neck correction, all
  five affected class-fit/sheet checks and the repeated busy-scene test passed
  again in the evidence directories recorded above.
- Lint, whitespace, dependency audit (zero vulnerabilities), the client
  movement benchmark, and the Alpha 1.0.1 server-container build passed.

Scope of the evidence: visual inspection is representative, while automated
family/state coverage is broader. The ten-hero stress fixture does not prove
ten-client raid networking or completion of the Dark King's entire campaign
encounter. High remains demanding on this integrated GPU; no universal 60fps
claim is made. Publication/live deployed-SHA verification is a separate operator
workflow and has not been performed for this uncommitted candidate.

Completion decision: the scoped local visual-polish goal is complete. All six
passes have implementation and acceptance evidence; no required local fix or
check remains open. Further artistic iteration, broader device coverage and
full networked raid validation are future work, not claims of this pass.
