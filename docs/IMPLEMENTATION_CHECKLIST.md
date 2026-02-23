# Eidolon Implementation Checklist

This checklist turns the four-phase recommendation plan into actionable engineering tasks with concrete acceptance criteria.

## Phase 1 - Quick Wins (Correctness + Readability)

### 1.1 Remote ability VFX name sync
- [x] Replace legacy skill names in `triggerRemoteAbilityVisuals` with current canonical names from `Constants.js`/server events.
- [x] Add a default fallback visual per class when a skill name is unknown.
- [x] Add a dev-only warning log for unmapped remote skills to catch regressions.

**Files**
- `src/core/GameEngine.js`
- `src/core/Constants.js`

**Acceptance criteria**
- Remote casts for all current Fighter/Rogue/Wizard/Cleric skills show the intended effect.
- No silent "missing visual" cases for valid skills.

### 1.2 Cooldown key mismatch fix (Meteor)
- [x] Change server cooldown reset from `"Meteor"` to `"Meteor Drop"`.
- [x] Audit nearby set-bonus and combo code for other string-key mismatches.

**Files**
- `server/internal/game/world.go`

**Acceptance criteria**
- Meteor cooldown reset effects consistently reset the actual skill cooldown.

### 1.3 Projectile splash radius bug fix
- [x] Replace hardcoded splash distance check with the computed `splashRadius` variable.
- [x] Verify all projectile AoE branches use their local radius variables consistently.

**Files**
- `server/internal/game/world.go`

**Acceptance criteria**
- Fireball/ExplosiveTrap splash hit area matches configured design values.

### 1.4 Known client logic correctness fixes
- [x] Fix Wizard meteor burning-ground gate to use an existing skill/rune flag (or remove dead gate).
- [x] Fix Cleric Spirit Guardians tick path so damage/heal outcomes are applied and visible.
- [x] Remove stale inline comments that contradict current behavior.

**Files**
- `src/entities/Wizard.js`
- `src/entities/Cleric.js`

**Acceptance criteria**
- No dead references to nonexistent skill tree nodes.
- Spirit Guardians clearly apply periodic combat impact in live play.

### 1.5 Validation for Phase 1
- [x] Run JS tests: `npm test`
- [x] Run Go tests: `go test ./...` (from `server/`)
- [ ] Multiplayer smoke check: two clients in same zone; verify remote cast VFX for each class.

---

## Phase 2 - Gameplay Feel + Combat Consistency

### 2.1 Shared ability config source
- [x] Introduce a canonical ability config table (name, cooldown, mana, range, tags).
- [x] Use it from server ability execution and client UI/hotbar display.
- [x] Remove duplicated magic numbers where practical. All four classes (Wizard, Fighter, Rogue, Cleric) now resolve mana cost and cooldown via shared config helpers on both client and server.

**Files (initial targets)**
- `src/core/Constants.js`
- `src/core/GameEngine.js`
- `src/entities/Fighter.js`
- `src/entities/Rogue.js`
- `src/entities/Wizard.js`
- `src/entities/Cleric.js`
- `server/internal/game/world.go`

**Acceptance criteria**
- Cooldown/mana/range behavior matches between client prediction and server authority.

### 2.2 Range normalization pass
- [x] Remove effectively infinite fallback ranges for normal combat actions.
- [x] Define explicit default attack ranges by archetype and per-skill overrides.
- [x] Add clamp rules for mobile auto-targeting so it does not select off-intent targets.

**Files**
- `src/core/GameEngine.js`
- `server/internal/game/world.go`

**Acceptance criteria**
- Combat engagement distance feels intentional and consistent across classes and input modes.

### 2.3 Zone/AoE semantic split
- [x] Split generic `Zone` behavior into clear types (damage zone, healing zone, buff zone, control zone). Server SubType split: `ZoneDamage` (Inferno Cataclysm) and `ZoneHoly` (Consecrated Ground).
- [x] Ensure each skill's zone type applies only intended effects (ally vs enemy). ZoneDamage only damages enemies; ZoneHoly damages enemies + heals allies + applies sanctuary buff.
- [x] Keep visual indicators distinct per zone category. Client renders ZoneDamage as red/orange, ZoneHoly as gold. Server encodes radius via Scale field for correct client geometry scaling.

**Files**
- `server/internal/game/world.go`
- `src/entities/Projectile.js`

**Acceptance criteria**
- Consecrated Ground and Inferno-style zones have non-overlapping, predictable behavior.

### 2.4 Telegraph and readability improvements
- [x] Add cast-start/cast-impact event support for major enemy and boss abilities. Server emits `TelegraphEvent` with position/radius/duration; boss AoE slam fires every 10s with 2s warning.
- [x] Add persistent warning indicators for delayed/high-damage AoE. Client `TransientEffects.js` renders a pulsing red/orange ring+fill disc that grows more urgent as impact approaches.
- [x] Tune indicator timing to match server hit timing. Telegraph duration (2s) matches the goroutine sleep before AoE damage resolves.

**Files (initial targets)**
- `server/internal/game/world.go` — `TelegraphEvent` struct, `LastSpecialAttack` entity field, boss AoE slam logic in enemy AI update
- `server/main.go` — `MsgTelegraph` constant, `TelegraphPayload` struct, `"telegraph"` event handler in OnEvent
- `src/core/GameEngine.js` — `'telegraph'` case in `handleServerMessage()`
- `src/core/TransientEffects.js` — `'telegraph'` effect type (ring + fill disc, pulsing opacity)

**Acceptance criteria**
- Players can react to dangerous attacks from telegraphs before damage resolves.

### 2.5 Validation for Phase 2
- [x] Run JS and Go test suites.
- [ ] Manual balancing pass in Earth/Water/Fire/Air zones with at least one run per class.
- [ ] Verify no new client/server desync logs for ability outcomes.

---

## Phase 3 - Visual + UI Polish

### 3.1 CSS extraction and cleanup
- [x] Move inline `<style>` block from `index.html` into modular CSS files under `src/styles/`. Extracted 15 files: `variables.css`, `base.css`, `overlays.css`, `hud.css`, `abilities.css`, `floating-bars.css`, `windows.css`, `skill-tree.css`, `start-screen.css`, `world-map.css`, `tooltips.css`, `mobile.css`, `chat.css`, `responsive.css`, `party.css`, plus `index.css` barrel.
- [x] Introduce CSS variables for shared spacing/color/typography tokens in `variables.css`.
- [x] Keep behavior identical before style redesign changes. 1,109-line `<style>` block replaced with single `<link>` tag; `index.html` reduced from 2,426 to 1,317 lines.
- [ ] Inline element `style="..."` attributes (367 occurrences) and JS-driven `.style.` assignments (~946) deferred to Phase 4.

**Files**
- `index.html` — `<style>` block replaced with `<link rel="stylesheet" href="src/styles/index.css">`
- `src/styles/` — 16 new CSS files (variables, base, 12 component modules, responsive, barrel)

**Acceptance criteria**
- [x] `index.html` is significantly reduced in style complexity (1,109 lines removed).
- [ ] No visual regressions in core HUD/menu screens (requires manual browser verification).

### 3.2 Responsive/mobile layout rework
- [x] Replace hard pixel-position overrides with responsive anchors and scale rules. Minimap, HUD width, timer, and chat use `clamp()`/`min()` viewport-relative units.
- [x] Remove duplicated mobile override blocks. Added `matchMedia('(max-width: 800px)')` listener in `main.js` that toggles `.mobile-mode` dynamically; removed the duplicate `@media (max-width: 800px)` CSS block (28 duplicate rules eliminated).
- [x] Simplify UIManager drag handler mobile check to rely solely on `.mobile-mode` class (now kept in sync by matchMedia listener).
- [ ] Validate portrait and landscape touch UX (requires manual device testing).

**Files**
- `src/main.js` — `matchMedia` listener for `.mobile-mode` class toggle
- `src/styles/responsive.css` — Deduplicated; `.mobile-mode` rules only + landscape `@media`
- `src/ui/UIManager.js` — Simplified drag handler mobile detection

**Acceptance criteria**
- [x] Core HUD, minimap, chat, and action controls scale with viewport via `clamp()`/`min()`.
- [x] Single source of truth for mobile layout rules (no duplicated blocks).
- [ ] Manual device testing on common phone resolutions (deferred).

### 3.3 Realm visual identity upgrade
- [x] Add realm-specific ground/material variation beyond simple tinting. Fire: emissive heat glow (0x330800, intensity 0.5), roughness 0.95. Water/Snow: blue-white tint (0xddeeff), cold emissive (0x0a1525), smoother (roughness 0.55, metalness 0.35). Air: polished cloud-stone (roughness 0.5, metalness 0.4), sky-glow emissive.
- [x] Add subtle realm-specific atmospheric layers (particles/fog accents) while preserving performance modes. Camera-relative ambient particle system with per-realm configs: earth (dust motes), town (warm firefly motes), water (falling snowflakes), fire (rising embers), air (fast wind wisps). Uses custom ShaderMaterial with additive blending, per-particle fade in/out, soft circle rendering. Disabled on 'low' graphics; 50 particles on mobile, 140 on desktop.
- [x] Add 'town' lighting preset — warmer key/fill (0xfff8ee/0xffe8cc), higher ambient, slightly closer fog. Town detected via 120-radius circle around (0, 200).
- [x] Ensure transitions between realms remain smooth. Particle color/size lerps with dt*2.0; lighting continues existing lerp (dt*2.8). Particles respawn gradually into new-realm configuration.

**Files**
- `src/core/RenderSystem.js` — Ground material enhancements, `REALM_PARTICLE_CONFIGS`, `initRealmParticles()`, `updateRealmParticles()`, `_spawnParticle()`, town lighting preset, town detection in `getRealmForPosition()`

**Acceptance criteria**
- [x] Fire/Air/Water/Earth are visually distinct at a glance from camera height.
- [x] Town has its own lighting feel.
- [ ] Manual verification that particles look good and don't hurt FPS (requires browser testing).

### 3.4 Map/minimap readability overhaul
- [x] Convert `WorldMap` hardcoded draw data into config-driven structures. All spatial data (realm backgrounds, enemy zones, dungeon markers, fence segments) extracted into static config tables (`REALM_BACKGROUNDS`, `ZONE_CONFIGS`, `DUNGEON_MARKERS`, `FENCE_SEGMENTS`). Draw method iterates configs instead of inline coordinates. Entity classification extracted to shared `classifyEntity()` helper.
- [x] Improve label scaling and culling by zoom level. Three-tier visibility system (`realm` always visible, `zone` at scale>=0.8, `detail` at scale>=1.5). Realm labels and dungeon markers visible at moderate zoom; per-enemy-type sub-zone labels only at high zoom. Font sizes scale with `this.scale / 2`.
- [x] Add clearer tactical affordances on minimap (party/boss/objective emphasis). Minimap now has: realm-colored background tinting matching current player position, faint realm boundary lines, party member dots with white ring + edge-clamped arrow indicators for distant party members, elite/boss pulsing ring animation, cardinal direction labels (N/S/E/W rotated to match isometric view), circular clip with out-of-range culling.

**Files**
- `src/ui/WorldMap.js` — Rewritten: config-driven zone/dungeon/fence data, tiered label visibility, extracted `classifyEntity()` helper, `_drawRect`/`_drawLabel`/`_tierVisible` draw helpers, `_makeWorldToScreen` factory
- `src/ui/Minimap.js` — Rewritten: realm background tinting via `getRealmForPosition()`, `_drawRealmBoundaries()`, `_drawCardinals()`, `_drawGlobalPartyMembers()` with edge-clamped arrows, elite pulsing ring, `setGameEngine()` API
- `src/core/GameEngine.js` — Added `minimap.setGameEngine(this)` call after construction

**Acceptance criteria**
- [x] Labels do not overwhelm map at high zoom or disappear unreadably at low zoom.
- [ ] Manual verification of map/minimap rendering (requires browser testing).

### 3.5 Placeholder enemy replacement track
- [ ] Prioritize replacing tinted skeleton placeholders for high-visibility late-game mobs/bosses.
- [ ] Keep fallback mesh path but mark with explicit TODO tags for remaining types.

**Files**
- `src/utils/MeshFactory.js`
- asset/model pipeline files

**Acceptance criteria**
- Top-priority Fire/Air dungeon bosses no longer use generic tinted skeleton stand-ins.

### 3.6 Validation for Phase 3
- [ ] Desktop + mobile visual smoke test.
- [ ] Performance check on low/medium/high graphics presets.
- [ ] Verify no console spam from missing assets/materials.

---

## Phase 4 - Stability + Refactor

### 4.1 GameEngine responsibility split
- [ ] Extract networking message handling into a dedicated module.
- [ ] Extract ability input/targeting orchestration into its own controller.
- [ ] Keep render/update loop in `GameEngine` focused on lifecycle and tick orchestration.

**Files**
- `src/core/GameEngine.js`
- new modules under `src/core/` or `src/systems/`

**Acceptance criteria**
- `GameEngine.js` reduced in size and concern count, with no behavior regressions.

### 4.2 UIManager decomposition
- [ ] Split quest/journal, inventory/equipment, party/social, forge/trading into dedicated UI modules.
- [ ] Keep a thin facade for cross-module wiring and callbacks.

**Files**
- `src/ui/UIManager.js`
- new modules under `src/ui/`

**Acceptance criteria**
- UI modules are independently readable and testable; no monolithic 5k-line single file dependency.

### 4.3 Server ability handler modularization
- [ ] Break `PerformAbility` class blocks into class-specific handlers.
- [ ] Introduce shared helper primitives for cone/AoE/line and effect application.
- [ ] Add regression tests for representative skills per class.

**Files**
- `server/internal/game/world.go`
- `server/internal/game/world_test.go`

**Acceptance criteria**
- Ability logic remains server-authoritative with lower maintenance overhead and clearer diff surface.

### 4.4 Validation for Phase 4
- [ ] Full JS + Go test passes.
- [ ] Multiplayer soak run (long session) without crash/desync/memory-growth anomalies.
- [ ] Review logs for deadlock/panic warnings in server update loop.

---

## Suggested Delivery Cadence

- Phase 1: 1-2 sessions
- Phase 2: 2-4 sessions
- Phase 3: 3-6 sessions
- Phase 4: 3-6 sessions

If needed, split each phase into PR-sized vertical slices (one gameplay slice + one UI/visual slice) to keep review and rollback safe.
