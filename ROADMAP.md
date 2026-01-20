# Eidolon Development Roadmap

> **Project by [Robert Mendola](https://mendola.tech)**

This document tracks completed milestones and outlines future development goals.

---

## ✅ Completed Features

### Phase 1: Core Infrastructure
- [x] MongoDB integration with user accounts and authentication
- [x] Character persistence (stats, level, XP, position, inventory, equipment)
- [x] Item schema with rarities, stats, slots, potency, sockets
- [x] Stash system (100 slots) with deposit/withdraw
- [x] Periodic auto-save and graceful shutdown saves

### Phase 2: Authoritative Server
- [x] Full server-side combat (damage, defense, attack speed, cooldowns)
- [x] All 4 classes implemented with complete skill trees (3 branches each)
- [x] Buff/debuff system (stuns, bleeds, poisons, roots, slows, shields)
- [x] Mana costs and cooldown validation
- [x] Death and respawn handling
- [x] HP/Mana regeneration

### Phase 3: World & AI
- [x] Zone management (Earth Realm, Snow/Water Realm)
- [x] Enemy spawning with respawn timers
- [x] Multiple enemy types (Skeleton, Imp, Demon Orc, Construct, Siren, Frost Guardian, Mountain Troll, Aqua Golem)
- [x] Dungeon bosses (Briar Matron, Hollow Sentinel, Rootbound Warden, Rustbound Colossus, Inferno Titan)
- [x] Elite enemy spawning with enhanced stats/loot
- [x] Enemy AI (aggro, chase, attack, leash back to spawn)
- [x] Fence/collision boundaries between zones

### Phase 4: Loot & Economy
- [x] Server-side loot generation with rarity rolls
- [x] Random affix system matching client item generation
- [x] Loot drops on enemy death
- [x] Pickup, equip, unequip validation
- [x] Gambling NPC with random gear
- [x] Sell items and buyback system
- [x] Gold economy

### Phase 5: Advanced Systems
- [x] Trading House (auction system with bids and buyouts)
- [x] Forge system (upgrades, potency, sockets)
- [x] Quest system with daily kill quests
- [x] Party system (invite, join, leave, shared instances)
- [x] Dungeon instances with procedural layouts
- [x] Skill point allocation and branch selection
- [x] Hotbar ability assignment

### Phase 6: Performance & Networking
- [x] Spatial partitioning (`SpatialMap` with configurable cell size)
- [x] Delta compression (only send changed entity states)
- [x] GZIP compression for state broadcasts
- [x] Entity creation throttling and message buffering
- [x] SSL/TLS support for production
- [x] Client-side interpolation (30 TPS server → 60 FPS render)

### Phase 7: Client Polish
- [x] Mobile support with touch controls and virtual joystick
- [x] Chunk-based entity loading/unloading
- [x] Minimap and world map
- [x] Floating combat text
- [x] Full UI system (inventory, character sheet, skill tree, forge, trading house, etc.)
- [x] Drag-and-drop hotbar assignment

---

## 🚧 In Progress

### Content Expansion
- [ ] Additional dungeon tilesets and boss mechanics
- [ ] More enemy variety per zone
- [ ] Unique/set items with special effects

---

## 🔮 Future Roadmap

### Phase 8: Content & Progression
- [ ] **New Zones**: Expand to remaining elemental realms (Fire/Shifting Sands, Air/Crystalline Spire)
- [ ] **Level Cap Increase**: Extend beyond current progression
- [ ] **Endgame Content**: 
  - Repeatable challenge dungeons with scaling difficulty
  - Weekly/monthly leaderboards
  - Rare cosmetic rewards
- [ ] **Crafting System**: Combine materials to create specific items
- [ ] **Enchanting**: Add/reroll affixes on existing gear

### Phase 9: Social & Competitive
- [ ] **Guild System**: Create guilds, guild stash, guild chat
- [ ] **PvP Arena**: Opt-in dueling or structured battlegrounds
- [ ] **Global Chat Channels**: General, Trade, LFG
- [ ] **Friends List**: Add friends, see online status, quick party invite
- [ ] **Achievements**: Track milestones with rewards

### Phase 10: Polish & Accessibility
- [ ] **Sound Effects & Music**: Ambient audio, combat sounds, UI feedback
- [ ] **Improved Animations**: More attack variations, death animations
- [ ] **Localization**: Multi-language support
- [ ] **Accessibility Options**: Colorblind modes, UI scaling, keybind remapping
- [ ] **Tutorial/Onboarding**: New player experience improvements

### Phase 11: Infrastructure & Scale
- [ ] **Binary Protocol**: Switch from JSON to Protobuf/FlatBuffers for bandwidth efficiency
- [ ] **Horizontal Scaling**: Multiple server instances with load balancing
- [ ] **Sharding**: Distribute players across world shards
- [ ] **Metrics & Monitoring**: Prometheus/Grafana dashboards for server health
- [ ] **Dockerization**: Container-based deployment with docker-compose
- [ ] **CI/CD Pipeline**: Automated testing and deployment

### Phase 12: Platform Expansion
- [ ] **Native Mobile Apps**: Capacitor/Cordova wrappers for iOS/Android
- [ ] **Desktop Client**: Electron wrapper with offline mode considerations
- [ ] **Steam Integration**: Achievements, cloud saves, overlay

---

## 💡 Ideas Backlog

*Lower priority concepts to explore:*

- Seasonal leagues with ladder resets
- Hardcore mode (permadeath)
- Cosmetic MTX system (skins, pets, effects)
- Player housing/hideouts
- Summon/companion AI improvements
- World events (server-wide boss spawns)
- Transmog system for gear appearance
- Replay/spectator mode for dungeons

---

## 📊 Technical Debt

*Known issues to address:*

- [ ] Consolidate skill definitions between client and server
- [ ] Reduce code duplication in entity classes
- [ ] Improve error handling and logging consistency
- [ ] Add comprehensive server-side validation for edge cases
- [ ] Increase test coverage (aim for 80%+)
- [ ] Document WebSocket message protocol

---

*Last updated: December 2024*
