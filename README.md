# EIDOLON

[![CI](https://github.com/aeml/eidolon/actions/workflows/ci.yml/badge.svg)](https://github.com/aeml/eidolon/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-report-blue)](https://eidolon.mendola.tech/coverage/)

> Brought to you by [Robert Mendola](https://mendola.tech)

Eidolon is a browser-based isometric action RPG MMO with a vanilla JavaScript + Three.js client, an authoritative Go WebSocket server, and MongoDB persistence.

## Recommended visuals to add
- Gameplay screenshot: overworld combat with HUD, target highlight, and hotbar visible
- Dungeon screenshot: room objective / party / reward-summary UI in one frame
- Short GIF: movement + combat + loot + menu polish in a 10-20 second loop

## Vision and media
- Final vision: [final_vision.md](final_vision.md)
- Planned media folder: [`docs/media/`](docs/media/)

## Preview placeholders
![Eidolon gameplay screenshot placeholder](docs/media/gameplay-overworld.svg)
![Eidolon dungeon screenshot placeholder](docs/media/dungeon-run.svg)

> Replace the placeholder SVG files in `docs/media/` with real captures from the live game. Add a short GIF as `docs/media/combat-loop.gif` when ready.

## Why this project matters
- Real-time browser multiplayer with server authority and synchronization
- A broad shipped gameplay surface: combat, progression, loot, crafting, quests, dungeons, parties, economy, and live UX polish
- Full-stack execution across client runtime, backend services, persistence, asset delivery, testing, and deployment

## Current shipped highlights
- 4 playable classes, 4 overworld realms, and 4 instanced dungeons
- Multiplayer combat, skill trees, passive talents, runes, combos, buffs/debuffs, stash, forge, gambling NPC, and trading house
- Ongoing UX and technical improvements including asset caching, modularized client systems, CI linting, and client/server test coverage

## Architecture at a glance
- Client: vanilla JavaScript ES modules + Three.js runtime and UI systems
- Server: authoritative Go WebSocket simulation and state authority
- Data: MongoDB persistence
- State transport: protobuf envelopes (`EDPB`)
- Delivery: static client + separate WebSocket backend + service-worker-managed asset packs

## System architecture

```mermaid
graph LR
    Player[Player Browser] --> Client[Vanilla JS + Three.js Client]
    Client --> UI[Gameplay + UI Systems]
    Client --> Cache[Service Worker + Asset Cache]
    Client --> NM[NetworkManager]
    NM --> WS[WebSocket]
    WS --> Server[Authoritative Go Game Server]
    Server --> Sim[Combat / Movement / Dungeon Simulation]
    Server --> PB[Protobuf EDPB State Stream]
    Server --> DB[(MongoDB Persistence)]
    PB --> Client
```

## Current shipped state

### Gameplay and progression
- 4 playable classes: Fighter, Rogue, Wizard, Cleric
- Real-time multiplayer combat with an authoritative Go server
- Skill trees, passive talents, runes, combos, buffs, debuffs, and hotbar skills
- Daily quests, party play, stash, forge, gambling NPC, and trading house
- Ctrl+click jump movement with authoritative sync and exaggerated client visuals

### World and dungeons
- Overworld realms: Earth, Water/Snow, Fire, Air, plus Town
- Instanced dungeons: Verdant Bastion Catacombs, Molten Core, Tempest Spire, Abyssal Well
- All base dungeons unlock at level 30
- Players choose dungeon run levels in bands while leveling
- Heroic and Mythic unlock at max level only
- Dungeon room state tracking, room-clear rewards, boss reward summaries, objective guidance, and entrance hints

### UX and presentation
- Combat intent HUD and target highlighting
- Quest/objective tracker and dungeon entrance context hints
- Auto-loot toggle and clearer loot pickup feedback
- Grouped buff/debuff tracker and stronger death/respawn recovery feedback
- Polished modal/menu close behavior, non-selectable window chrome, and better dungeon/respec menu UX
- Higher-fidelity/stabler world shadows plus stronger jump landing feedback with dust and camera punch

### Technical foundations
- Three.js 0.181.2 on both runtime and tests
- Protobuf state streaming with `EDPB` envelopes
- Jest client suite and Go server tests
- ESLint enforced in CI/local workflows
- Modularized client systems including `NetworkManager`, `AbilityController`, and extracted UI feature modules
- Client asset caching flow with per-pack status, cached-version visibility, and update actions

## Controls

| Input | Action |
|-------|--------|
| Left Click | Move / Melee Attack |
| Right Click | Use Ability |
| Ctrl + Left Click | Jump toward cursor |
| 1-4 Keys | Hotbar Abilities |
| Scroll Wheel | Zoom In / Out |
| W / A / S / D | Pan Camera |
| Spacebar | Center/lock camera behavior |
| I | Inventory |
| C | Character Sheet |
| K | Skills / Talents / Runes / Combos |
| M | World Map |
| J | Quest Journal / objectives |
| O | Social / party UI |
| ESC | Escape menu / close modal UI |

## Tech stack

| Layer | Technology |
|-------|------------|
| Client | Vanilla JavaScript (ES modules), Three.js 0.181.2 |
| Server | Go 1.23 (`toolchain go1.24.5` in `server/go.mod`), Gorilla WebSocket, protobuf |
| Database | MongoDB |
| Assets | GLB/GLTF models, PNG textures/icons, service-worker-managed asset packs |
| Testing | Jest, ESLint, Go test |

## Local development

### Prerequisites
- Go 1.23+
- MongoDB
- Node.js / npm
- A simple static file server such as Python's built-in `http.server`

### Run the server
From `server/`:

```bash
cd server
go run main.go
```

Local default WebSocket endpoint:
- `ws://localhost:8080/ws`

Production endpoint commonly used by the client build:
- `wss://eserver.mendola.tech/ws`

### Run the client
From the repo root:

```bash
npm install
python -m http.server 8000
```

Then open:
- `http://localhost:8000`

If you want the local client to connect to local server instead of production, update the hidden server address in `index.html` or use your local dev workflow for that environment.

## Tests and validation

From the repo root:

```bash
npm test
npm run lint
```

From `server/`:

```bash
go test ./...
```

Fast smoke subset:

```bash
npm run test:smoke
```

## Project layout

```text
eidolon/
├── index.html
├── src/
│   ├── main.js
│   ├── core/
│   │   ├── GameEngine.js
│   │   ├── RenderSystem.js
│   │   ├── NetworkManager.js
│   │   ├── AbilityController.js
│   │   ├── InputManager.js
│   │   ├── ChunkManager.js
│   │   └── CollisionManager.js
│   ├── ui/
│   │   ├── UIManager.js
│   │   ├── InventoryUI.js
│   │   ├── SkillTreeUI.js
│   │   ├── ForgeUI.js
│   │   ├── QuestUI.js
│   │   ├── TradingUI.js
│   │   └── SocialUI.js
│   ├── world/
│   ├── entities/
│   ├── skills/
│   └── utils/
├── server/
│   ├── main.go
│   ├── internal/game/
│   ├── internal/database/
│   └── deploy/
├── docs/
├── tests/
└── assets/
```

## Key documentation
- `ROADMAP.md` — high-level product and polish roadmap
- `IMPROVEMENT_PLAN.md` — current improvement tracks and backlog
- `docs/ARCHITECTURE.md` — current architecture snapshot
- `docs/ROADMAP.md` — engineering roadmap / next technical slices
- `docs/plans/2026-04-04-eidolon-current-state-and-next-steps-plan.md` — current implementation plan for the next wave of work

## License

This project is open source.
