# Eidolon Architecture

Last refreshed: April 2026

## Current architecture

```text
Client
  index.html
    -> src/main.js
        -> GameEngine
           - RenderSystem
           - InputManager
           - ChunkManager
           - CollisionManager
           - NetworkManager
           - AbilityController
           - UIManager facade
             - InventoryUI
             - SkillTreeUI
             - ForgeUI
             - TradingUI
             - QuestUI
             - SocialUI
           - WorldGenerator
           - MeshFactory / MeshCatalog helpers
           - Entities / transient effects / maps / HUD

Server
  server/main.go
    -> internal/game/
       - world state
       - parties / quests / dungeons / rewards / progression
       - protobuf envelope production
    -> internal/database/
       - MongoDB persistence
```

## Main runtime responsibilities

### `GameEngine`
- Orchestrates update/render lifecycle
- Holds high-level player state, authoritative sync handling, and interaction flow
- Coordinates rendering, collision, UI, networking, dungeon entry, loot flow, and transient effects

### `RenderSystem`
- Owns Three.js renderer, camera, scene, lighting, shadows, environment textures, and quality settings
- Handles current lighting/shadow-follow behavior and camera punch support
- Uses explicit scene groups so environment content survives instance changes while entity/effect content is cleared separately

### Instance transition runtime hygiene
- `GameEngine.enterInstance()` now clears pending interactions, active transient effects, hazard visuals, and combat-target highlight state before rebuilding the next scene
- This keeps dungeon/overworld swaps from carrying stale combat readability artifacts into the next space

### `NetworkManager`
- Wraps socket message flow and protobuf state decoding
- Keeps WebSocket logic out of most UI wiring paths

### `AbilityController`
- Owns ability-targeting/orchestration logic that used to live directly inside `GameEngine`
- Reduces core-engine sprawl around skills and input-to-ability flow

### `UIManager` facade + feature modules
- `UIManager` still handles cross-surface wiring and shared helpers
- Heavy feature surfaces have been split into dedicated modules:
  - `InventoryUI`
  - `SkillTreeUI`
  - `ForgeUI`
  - `TradingUI`
  - `QuestUI`
  - `SocialUI`

### Server `world.go`
- Still the main authoritative gameplay hub for combat, movement, dungeon logic, rewards, and progression
- It is far more capable than earlier versions, but remains a major future refactor target because so much game logic still concentrates there

## Data flow notes
- Client receives protobuf state envelopes (`EDPB` + version byte + payload)
- Server remains authoritative for movement, combat, progression, and dungeon entry validation
- Client adds prediction/presentation layers for responsiveness and readability, then reconciles to server truth

## What changed since earlier architecture docs
- Networking is no longer best described as “GameEngine directly owns the socket everywhere”
- UI is no longer best described as “one class owns everything”
- Protobuf networking is no longer a future architecture target; it is current architecture
- Current design work is less about first extraction and more about finishing the remaining heavy seams cleanly

## Most important next architectural step
Introduce explicit scene groups for environment, entities, and transient effects so instance transitions stop relying on broad scene rebuild behavior.
