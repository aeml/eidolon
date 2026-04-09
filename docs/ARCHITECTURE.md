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
- `ChunkManager` and `GameEngine.addEntity()` now agree on a single always-resident town-service list (`DwarfSalesman`, `Stash`, `QuestNPC`, `RespecNPC`, `Forge`, `TradingHouse`) so immediate mesh loads do not silently skip render/collision setup
- This keeps dungeon/overworld swaps from carrying stale combat readability artifacts into the next space and closes a real async mesh-load footgun around town services and active-chunk spawns

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
- `ChunkManager` and `GameEngine.addEntity()` now share a single always-resident town-service allowlist (`DwarfSalesman`, `Stash`, `QuestNPC`, `RespecNPC`, `Forge`, `TradingHouse`) so active chunk logic and delayed mesh attach decisions do not drift apart.
- Installing the `onMeshReady` hook before chunk registration closes the immediate mesh creation race where service structures or live chunk spawns could skip render attach or collider setup.
- Wizard `Scorch Beam` and projectile impact/explosion readability bursts now route through `spawnTransientEffect`/`effectScene` first, instead of writing temporary combat meshes straight into the entity scene. That keeps combat telegraphs inside the effect lane and makes transition cleanup deterministic.
- Rogue `Tripwire` now plants its persistent trap mesh in `effectScene` and uses the same effect lane for trigger smoke, so trap readability no longer depends on the entity scene surviving untouched.
- Fighter, Cleric, and AvengingSeraph transient class visuals now accept `effectScene`-only game-engine contexts instead of bailing out just because the entity scene is absent. That keeps multiplayer/alternate runtime paths on the same effect lane.
- Projectile fallback bursts for Arcane Missile and Fireball/Meteor explosions now use the same resolved effect scene (`effectScene` first, then `scene`) instead of writing directly to `gameEngine.scene`. That keeps even non-transient fallback visuals inside the same runtime lane.
- Projectile meteor trail particles now reparent pooled meshes when the effect scene changes, so reused trail visuals do not stick to a stale scene group across combat/runtime transitions.
- Wizard Scorch Beam fallback cleanup now removes its beam mesh from the current parent instead of assuming the original effect scene still owns it, which makes the fallback resilient to scene-group transitions and reparenting.
- Fighter, Cleric, Rogue, Wizard, and AvengingSeraph now share a real effect-scene fallback visual path when `spawnTransientEffect` is unavailable, instead of silently doing nothing after passing the effectScene guard. That keeps class readability effects visible in stripped-down/runtime-limited contexts.
- Projectile fallback bursts now use the same shared parent-safe burst helper as other effect-scene fallbacks, so impact/explosion cleanup survives mesh reparenting instead of assuming the original scene still owns the effect.
- Rogue Tripwire now disposes its planted trap mesh resources on trigger via the shared scene-mesh disposal helper instead of only detaching the mesh. That closes a small but real leak in repeated trap-heavy fights.
- Wizard Scorch Beam fallback now uses the shared parent-safe beam helper instead of carrying its own bespoke cylinder/add/fade/remove lifecycle. That removes another duplicated temporary-visual path and keeps cleanup rules consistent.
- Projectile particle-pool disposal now removes pooled meshes from their current parent instead of a stale recorded scene, so teardown stays correct after effect-scene reparenting and test resets.
- Rogue Tripwire planted visuals now use the shared persistent scene-mesh helper instead of open-coding geometry/material/scene wiring. That keeps persistent temporary effects on the same creation/disposal contract as the newer fallback helpers.
- AreaOfEffect entities now dispose their visual geometry/material through the shared scene-mesh disposal helper when they expire or are removed, instead of relying on generic Entity teardown that only detached the mesh. That closes a real leak on persistent zone spells like burning ground and gravity well.
- ChunkManager direct fallback removal paths now detach meshes from their current parent instead of assuming `this.scene` still owns them. That keeps non-disposable entities safe under reparenting and matches the rest of the parent-safe cleanup work.
- Cleric Spirit Guardians now use shared spirit-mesh cleanup for both cancellation and expiry, so orbiting spirits dispose correctly even if ownership changes before teardown.
- Player jumps now drive the Walk GLB during airtime as a single timed cycle instead of freezing into an idle pose, and the jump lifecycle explicitly restores normal animation timing on landing/authoritative clear.
- Environmental hazards now detach and dispose their meshes from the current parent during teardown, so instance cleanup stays correct even if hazard visuals have been reparented before removal.
- Cleric seraph cleanup now follows the same shared parent-safe disposal path as Spirit Guardians, so cancel/expiry teardown no longer assumes the seraph mesh still lives under the Cleric root mesh.
- GameEngine remote-entity fallback teardown now detaches meshes from their current parent before falling back to render-system removal, so stale ownership assumptions no longer leak into remote entity cleanup.
- GameEngine local pending-interaction pickup cleanup now follows the same parent-safe fallback rule, so reparented loot meshes detach correctly even when no entity-level dispose hook exists.
- GameEngine now also discards immediately-created inactive meshes from their current parent during onMeshReady handling, so stale ownership assumptions do not survive entity invalidation races.
- Optimistic loot pickup cleanup in GameEngine now removes fallback meshes from their current parent before falling back to render-system removal, so remote loot teardown matches the same parent-safe contract as the rest of runtime cleanup.
- Core TransientEffects cleanup now also detaches effect meshes from their current parent before disposing them, so reparented telegraphs and burst visuals obey the same ownership contract as the newer fallback helpers.
- LootDrop.dispose now detaches from the current parent and only disposes its owned sprite materials, keeping cached text textures and shared orb/hitbox resources intact while honoring the same parent-safe teardown contract.
- RenderSystem.setupLights now removes existing ambient/directional lights and their targets from their current parent before installing replacements, keeping lighting resets resilient if scene ownership changes.
- RenderSystem particle-overlay disposal now also detaches the internal points mesh from its current parent before teardown, so environment-particle cleanup matches the same parent-safe ownership contract.
- ChunkManager now also detaches inactive-chunk meshes from their current parent during addEntity residency decisions, removing the last stale special-case branch that still assumed scene ownership there.
- GameEngine render-time HUD throttling now also diffs enemy-bar visibility/health inputs, so stable hover/Alt target states stop forcing high-frequency enemy-bar DOM work every frame.
- Open character-sheet refreshes now also diff tracked stat/equipment inputs before rebuilding the sheet, so leaving the panel open no longer causes redundant heavy DOM/equipment-slot churn every throttle tick.
- Visible world-map refreshes now diff coarse player position and instance context before redrawing, so leaving the map open no longer repaints the whole canvas every render when nothing meaningful changed.
- Most important next architectural step: finish burning down the remaining direct `gameEngine.scene` gameplay visuals still hiding in projectile/utility fallback paths so transient combat readability no longer depends on ad hoc scene writes.
