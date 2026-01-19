# Eidolon Architecture

## Current architecture (observed)

```
Client
  index.html
    -> src/main.js
        -> GameEngine
           - RenderSystem (Three.js scene, camera, renderer)
           - InputManager (mouse/keyboard/touch)
           - ChunkManager (entity spatial loading)
           - CollisionManager (world + entity collisions)
           - UIManager (all UI panels)
           - WorldGenerator (terrain/props/dungeons)
           - MeshFactory (GLTF load/cache/pool)
           - Entities (Actor, NPCs, Projectiles, Loot)
           - Networking (WebSocket + protobuf state)

Server
  server/main.go
    -> internal/game/world.go
       - World state + spatial grid + dungeons
       - Parties, trading, quests
       - WebSocket hub + state broadcast
    -> internal/database (MongoDB persistence)
```

Main loop
- `GameEngine.loop()` fixed timestep update + render.
- `ChunkManager.update()` iterates active entities.
- `RenderSystem.render()` draws scene; UI updated every frame in `GameEngine.render()`.

Render pipeline
- Orthographic camera + directional light + shadow map.
- Environment/ground textures loaded in `RenderSystem.preloadEnvironment()`.
- Entities loaded through `MeshFactory` (GLTF + fallback primitives).

Asset loading
- `MeshFactory` manages GLTF caching, preloading, pooling.
- `WorldGenerator` loads static GLTFs (buildings/trees).

Input
- `InputManager` handles mouse, keyboard, touch; subscribes via callbacks.

Networking
- Client uses authenticated WebSocket (`GameEngine.connectToServer()`).
- Server sends state deltas and protobuf envelopes.

Persistence
- Server writes MongoDB user/character data. Client is stateless.

## Target architecture (incremental)

Increment 1: Separate orchestration
- `GameEngine` remains coordinator but delegates to:
  - `NetworkClient` (WebSocket + message routing)
  - `EntityFactory` (maps server entity types to constructors)
  - `UIBindings` (registers UI callbacks without networking logic)

Increment 2: Data-driven content
- `MeshFactory` reads a `meshCatalog` (path + animations + scale).
- Skill visuals and behaviors move to `skillRegistry` + `SkillStrategy` subclasses.

Increment 3: Scene organization
- `RenderSystem` owns `sceneGroups`:
  - `environmentGroup` (terrain/buildings)
  - `entityGroup` (actors/loot/projectiles)
  - `effectGroup` (VFX/floating text)
- Instance transitions clear only `entityGroup` and `effectGroup`.

Increment 4: UI modularization
- Split `UIManager` into focused modules with a shared `UIBus`:
  - HUD, Inventory, Social, Quests, Trading, Map.

## Recommended interfaces
- `NetworkClient.on('state', ...)` / `on('delta', ...)` events.
- `EntityFactory.create(type, data)` for server-driven spawn.
- `SkillRegistry.get(class, skillName)` returns `SkillStrategy`.
- `SceneGroups.addToGroup(name, object)` to avoid direct scene manipulation.

## Verification steps
- Use `repro.html` to sanity-check perf/input changes quickly.
- Add a smoke test that loads a minimal scene and runs 1–2 simulation ticks.
- Use perf overlay (FPS, frame time, draw calls) after each architectural change.
