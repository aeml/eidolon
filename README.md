# EIDOLON

[![CI](https://github.com/aeml/eidolon/actions/workflows/ci.yml/badge.svg)](https://github.com/aeml/eidolon/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-report-blue)](https://eidolon.mendola.tech/coverage/)

> **Brought to you by [Robert Mendola](https://mendola.tech)**

**Eidolon** is a browser-based Isometric Action-RPG MMO set in *Aethelgard*. Built with vanilla JavaScript, Three.js, and a Go WebSocket server, it features real-time multiplayer combat, deep character progression, and a Diablo-inspired loot system.

## ✨ Features

### Core Gameplay
- **Real-Time Multiplayer:** Authoritative Go server with WebSocket connections, delta compression, and spatial partitioning for scalable MMO gameplay
- **4 Playable Classes:** Fighter, Rogue, Wizard, Cleric — each with unique base stats, skill trees, and playstyles
- **Skill Trees:** Each class has 3 branches with unlockable active abilities (e.g., Fighter: Charge, Whirlwind, Shield Slam, Iron Fortress, Guardian Roar, Earthshaker)
- **Leveling System:** XP-based progression with stat point allocation (Strength, Dexterity, Intelligence, Wisdom, Vitality)
- **Combat:** Melee attacks, projectiles, AoE abilities, buffs, debuffs, stuns, bleeds, and more

### Loot & Economy
- **Item Rarities:** Common, Uncommon, Rare, Legendary, Eidolic
- **Equipment Slots:** Head, Chest, Legs, Feet, Gloves, Shoulders, Belt, Rings (x2), Neck, Trinkets (x2), Main Hand, Off Hand
- **Random Affixes:** Items roll stats based on rarity and level
- **Gambling NPC:** Spend gold for random gear
- **Trading House:** Player-to-player auction system with bidding and buyouts
- **Item Forge:** Upgrade equipment, increase potency, and add sockets using Eidolon Shards and Hearts
- **Personal Stash:** 100-slot account storage

### World & Content
- **Multiple Zones:** Earth Realm (main), Snow/Water Realm with unique enemies
- **Enemy Types:** Skeletons, Imps, Demon Orcs, Constructs, Sirens, Frost Guardians, Mountain Trolls, Aqua Golems, dungeon bosses (Briar Matron, Hollow Sentinel, Rootbound Warden, Rustbound Colossus, Inferno Titan)
- **Elite Enemies:** Scaled-up versions with better loot
- **Dungeon Instances:** Procedurally generated layouts with party support
- **NPCs:** Dwarf Salesman (shop), Quest NPC, Stash, Forge, Trading House
- **Quest System:** Daily kill quests with XP rewards

### Party System
- Invite players to your party
- Shared dungeon instances
- Party UI with member health/mana display

### Technical Features
- **Mobile Support:** Touch controls, virtual joystick, responsive UI
- **Chunk-Based Loading:** Dynamic entity loading/unloading based on player position
- **Minimap & World Map:** Real-time position tracking
- **Floating Combat Text:** Damage numbers, heals, status effects
- **Persistent Characters:** MongoDB storage for accounts, inventory, and progress
- **SSL/TLS Support:** Secure WebSocket connections for production

## 🎮 Controls

| Input | Action |
|-------|--------|
| **Left Click** | Move Character |
| **Right Click** | Attack / Use Ability |
| **1-4 Keys** | Hotbar Abilities |
| **Scroll Wheel** | Zoom In / Out |
| **W / A / S / D** | Pan Camera |
| **Spacebar** | Center Camera on Player |
| **I** | Inventory |
| **C** | Character Sheet |
| **K** | Skill Tree |
| **M** | World Map |
| **J** | Quest Journal |
| **ESC** | Menu |

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| **Client** | Vanilla JavaScript (ES6 Modules), [Three.js](https://threejs.org/) (WebGL) |
| **Server** | Go 1.21+, [Gorilla WebSocket](https://github.com/gorilla/websocket) |
| **Database** | MongoDB |
| **Assets** | GLTF/GLB 3D Models, PNG Textures/Icons |
| **Testing** | Jest (client), Go testing (server) |

## 🚀 Getting Started

### Prerequisites
- Go 1.21+
- MongoDB (local or Atlas)
- Python 3.x or any static file server

### Running Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/eidolon.git
   cd eidolon
   ```

2. **Start MongoDB** (if running locally):
   ```bash
   mongod
   ```

3. **Start the Game Server:**
   ```bash
   cd server
   go run main.go
   ```
   Local dev typically uses port `8080` (WebSocket endpoint: `ws://localhost:8080/ws`).
   Production (via `server/run_prod.ps1`) binds on port `443` (WebSocket endpoint: `wss://eserver.mendola.tech/ws`).

4. **Serve the Client:**
   ```bash
   # From the root eidolon directory
   python -m http.server 8000
   ```

5. **Play:**
   Open `http://localhost:8000` in your browser.

### Production Deployment

For SSL/TLS (required for `wss://`):
```bash
go run main.go --cert=cert.pem --key=key.pem --mongo-uri="mongodb+srv://..."
```

See [server/README.md](server/README.md) for detailed deployment options including Let's Encrypt setup.

## 🏗️ Project Structure

```
eidolon/
├── index.html              # Game entry point
├── src/
│   ├── main.js             # Client initialization
│   ├── core/
│   │   ├── GameEngine.js   # Main game loop, networking, entity management
│   │   ├── RenderSystem.js # Three.js scene, camera, lighting
│   │   ├── InputManager.js # Mouse, keyboard, touch input
│   │   ├── ChunkManager.js # Spatial loading/unloading
│   │   ├── ItemSystem.js   # Loot generation, rarities, affixes
│   │   └── Constants.js    # Game configuration
│   ├── entities/
│   │   ├── Actor.js        # Base class for all characters
│   │   ├── Fighter.js      # Fighter class with skills
│   │   ├── Rogue.js        # Rogue class with skills
│   │   ├── Wizard.js       # Wizard class with skills
│   │   ├── Cleric.js       # Cleric class with skills
│   │   ├── Skeleton.js     # Enemy type
│   │   └── ...             # Other entities
│   ├── ui/
│   │   ├── UIManager.js    # All UI panels (inventory, shop, forge, etc.)
│   │   ├── Minimap.js      # Minimap rendering
│   │   └── WorldMap.js     # Full world map
│   └── world/
│       └── WorldGenerator.js # Town buildings, trees, terrain
├── server/
│   ├── main.go             # Server entry, WebSocket hub, message routing
│   ├── internal/
│   │   ├── game/
│   │   │   ├── world.go    # Entity management, combat, AI, dungeons
│   │   │   ├── items.go    # Server-side loot generation
│   │   │   ├── party.go    # Party system
│   │   │   └── trading.go  # Auction house
│   │   └── database/
│   │       └── db.go       # MongoDB operations
│   └── cmd/
│       ├── loadtest/       # Load testing bots
│       └── simulator/      # Game simulation
├── assets/
│   ├── archetypes/         # Player class GLB models
│   ├── enemies/            # Enemy GLB models
│   ├── buildings/          # Town structures
│   ├── icons/              # UI icons for items and abilities
│   └── ...
└── tests/                  # Jest test files
```

## 🎨 Asset Pipeline

1. **3D Models:** GLB format loaded via Three.js `GLTFLoader`
2. **Mesh Cloning:** `SkeletonUtils.clone()` for instancing skinned meshes
3. **Animations:** Managed via `AnimationMixer` with state machine (Idle, Walk, Run, Attack, Death)
4. **Icons:** PNG files organized by slot type in `assets/icons/`

## 🔧 Server Architecture

The Go server is fully authoritative:

- **State Management:** All entity positions, health, inventory, and combat validated server-side
- **Tick Rate:** 30 TPS game loop with 1-second party/time sync broadcasts
- **Spatial Partitioning:** Grid-based `SpatialMap` for efficient nearby entity queries
- **Delta Compression:** Only changed entity states are sent to clients
- **GZIP Compression:** Reduces bandwidth for state updates
- **Graceful Shutdown:** Player data saved on SIGTERM/SIGINT

## 📝 Running Tests

```bash
# Client tests (Jest)
npm install
npm test

# Server tests
cd server
go test ./...
```

## 📄 License

This project is open source.

---

*Created by [Robert Mendola](https://mendola.tech)*
