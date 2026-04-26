# Eidolon Development Roadmap

> Project by [Robert Mendola](https://mendola.tech)
>
> Last refreshed: April 2026

This file is the high-level product roadmap. It reflects what is already shipped on `master`, what is currently being improved, and what should come next.

For the active long-range tracking document that includes remaining `0.22` work and the roadmap through `alpha 1.0`, see `docs/plans/2026-04-18-alpha-1-0-roadmap-and-status.md`.

## Current shipped foundation

### Core game
- 4 playable classes with skill trees, passive talents, runes, combos, and class-specific visuals
- Authoritative multiplayer combat and movement with WebSocket networking and protobuf state streaming
- Persistent characters with inventory, equipment, stash, gold, quests, talents, and progression
- Forge, gambling, trading house, loot rarities, gems, set-item support hooks, and unique-effect support hooks

### World and progression
- 4 overworld realms plus town: Earth, Water/Snow, Fire, Air
- 4 shipped instanced dungeons: Verdant Bastion Catacombs, Molten Core, Tempest Spire, Abyssal Well
- Dungeon progression refactor shipped:
  - all base dungeons unlock at level 30
  - run level selection scales dungeon runs while leveling
  - Heroic and Mythic unlock only at level 100
- Dungeon room-state tracking, objective summaries, reward summaries, and entrance hints are live

### UX and polish shipped recently
- Combat intent HUD and target clarity
- Loot feedback improvements and optional auto-loot
- Objective tracker and dungeon entrance context hints
- Death/respawn feedback polish
- Grouped active buff/debuff tracker
- Modal/menu close fixes for dungeon and respec flows
- Jump anticipation/flip/tuck/landing polish with stronger arc, dust, and camera punch
- Higher-fidelity, more stable world/building/fence shadows
- Asset-cache management UI with cached-version visibility and update/refresh controls

## Active priorities

### 1. Moment-to-moment feel
- Make movement, combat, hit response, and dungeon pacing feel more authored
- Continue tightening jump/landing/game-feel polish where it improves readability
- Add stronger room identity and encounter rhythm inside dungeons

### 2. Performance and maintainability
- Reduce UI DOM churn and expensive per-frame updates
- Finish scene-group based instance transitions instead of whole-scene rebuild behavior
- Continue moving hard-coded content definitions into data-driven catalogs/registries
- Expand repro/sandbox tooling for safe manual QA

### 3. Dungeon depth and replay value
- Distinguish room roles more clearly: travel, elite, event, reward, boss
- Improve endgame difficulty identity beyond raw stat scaling
- Add more run satisfaction hooks: events, elite modifiers, stronger room-clear moments, better dungeon-specific rewards

### 4. Audio, accessibility, and onboarding
- Add stronger audio/UI feedback for combat, loot, and menus
- Improve onboarding and first-session clarity
- Add accessibility options such as UI scale, keybinds, and visual clarity toggles

## Near-term roadmap

### Phase A: Reliability and frame-time wins
- Scene-group instance transition cleanup
- UI diffing/throttling for frequently updated HUD panels
- MeshFactory catalog cleanup and more data-driven asset definitions
- Expand the local repro/sandbox scene for gameplay and render QA

### Phase B: Dungeon satisfaction pass
- Room-role tagging and encounter pacing rules
- Better elite/event/reward cadence
- Stronger endgame difficulty distinction for Heroic/Mythic
- Manual dungeon QA sweep across all shipped dungeons and classes

### Phase C: Presentation pass
- Reusable VFX/decal library for low-cost combat feedback
- More impact feedback for abilities and enemy telegraphs
- Audio layer and stronger menu/UI feel
- Forge tab layout pass so upgrade/action controls at the bottom of each tab stay visible and clickable

## Longer-term opportunities
- Guilds, friends/LFG, and deeper social systems
- PvP or structured challenge modes
- Crafting/enchanting layers that complement forge progression
- Achievements, cosmetics, and long-term account goals
- Metrics/monitoring for live balancing and operations

## Technical debt still worth paying down
- Finish replacing remaining hard-coded content tables with registries/catalogs
- Reduce monolithic update/UI paths that still run too often
- Add scene grouping so instance transitions stop depending on broad scene resets
- Expand automated + manual QA coverage for dungeon pacing and menu polish
- Document more of the WebSocket/protobuf protocol and deploy flows
