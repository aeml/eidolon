# Eidolon Improvement Plan

Last refreshed: April 2026

This document replaces the older long-form wishlist with a current-state improvement plan. It is meant to be accurate to the code on `master` today and to point at the highest-value next work.

## Current state summary

### Shipped gameplay systems
- 4 classes with active skills, passive talents, runes, and combo support
- Authoritative multiplayer combat and movement
- Quest journal/objectives, party play, trading house, forge, stash, and loot systems
- Auto-loot option, combat intent HUD, dungeon entrance hints, grouped buff/debuff tracker, and death/respawn polish

### Shipped world and dungeon systems
- Overworld realms: Earth, Water/Snow, Fire, Air, plus Town
- Dungeons: Verdant Bastion Catacombs, Molten Core, Tempest Spire, Abyssal Well
- Dungeon progression model:
  - all base dungeons unlock at level 30
  - players choose run levels while leveling
  - Heroic/Mythic unlock at level 100 only
- Dungeon room states, objective summaries, room-clear rewards, and boss reward summaries are live

### Shipped presentation/technical systems
- Protobuf state envelopes on the wire
- Three.js runtime/test alignment at 0.181.2
- Extracted `NetworkManager`, `AbilityController`, and multiple UI modules
- Asset-cache settings flow with cached-version visibility and maintenance actions
- Stronger jump/shadow/menu polish shipped in the most recent passes

## What is already done and no longer belongs in “planned” status
- Fire and Air realms
- Molten Core, Tempest Spire, and Abyssal Well dungeon support
- Dungeon progression refactor and run-level selection
- Objective tracker, loot feedback, entrance hints, and room-state UX
- Asset cache persistence/settings work
- Major UI module extraction and networking/controller extraction

## Highest-priority improvement tracks

### 1. Scene and performance cleanup
Goal: make iteration safer and reduce runtime jank.

Key work:
- Introduce explicit scene groups for environment, entities, and transient effects
- Reduce broad scene teardown on instance transitions
- Throttle or diff high-frequency UI updates
- Expand the repro/sandbox scene for render/gameplay debugging

Primary files:
- `src/core/RenderSystem.js`
- `src/core/GameEngine.js`
- `src/ui/UIManager.js`
- `src/world/WorldGenerator.js`
- `repro.html`
- `src/repro.js`

### 2. Dungeon satisfaction and replay value
Goal: make dungeon runs feel intentionally paced rather than uniformly procedural.

Key work:
- Add room-role metadata and pacing rules
- Strengthen elite/event/reward room identity
- Improve room-clear feedback and dungeon-specific rewards
- Make Heroic/Mythic feel meaningfully different beyond number scaling

Primary files:
- `server/internal/game/world.go`
- `server/main.go`
- `src/core/GameEngine.js`
- `src/ui/QuestUI.js`
- `src/ui/Minimap.js`
- `src/ui/UIManager.js`

### 3. Content-definition cleanup
Goal: reduce regression risk when adding content.

Key work:
- Continue pushing hard-coded mesh/entity definitions into catalogs
- Continue reducing giant switch/if chains where registries are now a better fit
- Keep adding targeted regression tests around new data-driven definitions

Primary files:
- `src/utils/MeshFactory.js`
- `src/utils/MeshCatalog.js`
- `src/skills/skillVisuals.js`
- `src/core/GameEngine.js`
- `tests/`

### 4. Game-feel and presentation pass
Goal: keep improving the tactile feel of combat, traversal, and menus.

Key work:
- Continue movement/combat impact polish where it clearly improves readability
- Add reusable VFX/decal/audio hooks for low-cost feedback wins
- Keep menu/modal interactions consistent across all UI surfaces
- Add a short manual QA checklist for gameplay-feel regressions after each slice

Primary files:
- `src/core/GameEngine.js`
- `src/core/TransientEffects.js`
- `src/core/RenderSystem.js`
- `src/ui/UIManager.js`
- `src/ui/SkillTreeUI.js`
- `tests/MenuPolish.test.js`
- `tests/GameEngineCtrlClickJump.test.js`

### 5. Accessibility and onboarding
Goal: improve clarity for new and returning players.

Key work:
- Better first-session guidance and more explicit dungeon/progression messaging
- UI scaling/accessibility options
- Clearer keybind/help presentation
- Audio and visual affordances that support readability

Primary files:
- `index.html`
- `src/ui/UIManager.js`
- `src/styles/`
- `src/main.js`

## Deferred / longer-term ideas
These remain interesting, but are not the best immediate use of the next slices compared with polish, scene cleanup, and dungeon replayability:
- Guilds and richer social systems
- PvP or challenge modes
- Achievements/cosmetics/meta-progression
- Deeper crafting/enchanting layers
- Native-wrapper/platform expansion

## Planning rule going forward
When this file changes, it should answer two questions clearly:
1. What is actually shipped on `master` right now?
2. What are the next highest-value slices to implement next?

Anything that is purely historical should move into dated plan docs under `docs/plans/` rather than staying here as if it were still current work.
