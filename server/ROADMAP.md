# Eidolon Multiplayer Migration Roadmap

This document outlines the plan to migrate all single-player features to the authoritative Go server.

## Phase 1: Database Schema Design (MongoDB)
We need to expand the database to store player progress, items, and world configuration.

- [ ] **Update User Schema**: Add `characters` array to `User` struct.
- [ ] **Create Character Schema**:
    - Stats (Str, Dex, Int, Wis, Vit)
    - Level, XP
    - Inventory (Array of Item objects)
    - Equipment (Map of slots to Item objects)
    - Position (X, Y, Z) & Zone ID
- [ ] **Create Item Schema**: Define structure for storing item data (Rarity, Stats, Type).
- [ ] **Implement DB Methods**: `SaveCharacter`, `LoadCharacter`, `UpdateInventory`.

## Phase 2: Core Game Loop & Combat (Server-Side)
The server must become the authority on movement and combat to prevent cheating.

- [ ] **Expand Entity Struct**: Add combat stats (Damage, Defense, AttackSpeed, Cooldowns).
- [ ] **Implement Combat Logic**:
    - Add `MsgAttack` handler.
    - Calculate damage based on stats (Server-side math matching `Actor.js`).
    - Handle death and respawn.
- [ ] **Skill System**:
    - Implement basic skills (Fireball, Heal, etc.) on the server.
    - Validate cooldowns and mana costs.

## Phase 3: World Generation & Enemy AI
Move the logic from `WorldGenerator.js` and `GameEngine.js` to Go.

- [ ] **Zone Management**:
    - Define zones (Town, Skeleton Zone, Imp Zone, etc.) in Go.
    - Implement `SpawnManager` to handle enemy respawns.
- [ ] **Enemy AI**:
    - Port AI logic (Aggro ranges, Chase, Attack, Retreat).
    - Implement different enemy types (Skeleton, Imp, Demon Orc) with unique stats.
- [ ] **Collision Detection**:
    - Implement basic AABB or Circle collision on server to prevent walking through walls/fences.

## Phase 4: Inventory & Loot System
Port `ItemSystem.js` to Go.

- [ ] **Loot Generation**:
    - Implement `ItemGenerator` in Go (Rarity rolls, Stat generation).
    - Create `LootDrop` entities when enemies die.
- [ ] **Inventory Management**:
    - Add `MsgPickupItem`, `MsgEquipItem`, `MsgUnequipItem`.
    - Validate slot requirements (e.g., can't equip Sword in Head slot).
- [ ] **Persistence**:
    - Save inventory changes to MongoDB on every significant event (or periodically).

## Phase 5: Client Integration
Update the JavaScript client to be a "dumb terminal" that renders server state.

- [ ] **Remove Client-Side Logic**: Disable local damage calculations and AI.
- [ ] **Input Handling**: Send inputs (Move, Attack, Skill) to server.
- [ ] **State Interpolation**: Smooth out movement updates from server (20 TPS -> 60 FPS).
- [ ] **UI Updates**: Update Health/Mana bars, Inventory UI based on server messages.

## Phase 6: Deployment & Optimization
- [ ] **Spatial Partitioning**: Optimize entity lookups for larger worlds.
- [ ] **Binary Protocol**: Switch from JSON to Protobuf for bandwidth efficiency (Optional).
- [ ] **Production Deployment**: Dockerize and deploy to cloud/local server.
