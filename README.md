# EIDOLON

**Eidolon** is a browser-based Isometric Action-RPG set in *Aethelgard*, a realm where physical reality is a direct projection of the Collective Consciousness.

> *The world has fallen into Dissonance. You are a Harmonizer. You do not kill to conquer; you fight to re-tune.*

## ✨ Features

*   **Multiplayer:** Real-time MMO gameplay with shared world state.
*   **4 Classes:** Fighter, Rogue, Wizard, Cleric - each with unique stats and abilities.
*   **Progression:** Leveling system (1-100), Stat allocation, and XP grinding.
*   **Loot System:** Diablo-style loot with rarities (Common, Uncommon, Rare, Legendary) and random affixes.
*   **Economy:** Gold drops, Trading with NPCs, and Gambling for gear.
*   **Mobile Support:** Full touch controls, virtual joystick, and optimized UI for mobile devices.
*   **Performance:** Chunk-based loading and object pooling for smooth performance.

## 🎮 Playable Demo

This project is built with **Vanilla JavaScript** and **Three.js**, requiring no build steps. It runs directly in modern browsers.

### Controls

| Input | Action |
|-------|--------|
| **Left Click** | Move Character |
| **Right Click** | Perform Skill / Attack |
| **Scroll Wheel** | Zoom In / Out |
| **W / A / S / D** | Pan Camera |
| **Spacebar** | Center Camera on Player |

## 🛠️ Technology Stack

*   **Client:** Vanilla JavaScript (ES6+ Modules), [Three.js](https://threejs.org/) (WebGL).
*   **Server:** Go (Golang) with WebSockets for real-time multiplayer.
*   **Assets:** GLTF/GLB 3D Models, PNG Textures.
*   **Architecture:** Authoritative Server with Client-Side Prediction and Interpolation.

## 🚀 Getting Started

Since this project uses ES Modules, you cannot open `index.html` directly from the file system due to CORS security policies. You must serve it via a local web server.

### Prerequisites
*   Go 1.21+ (For the Server)
*   Python 3.x (For the Client Web Server)

### Running Locally

1.  Clone the repository:
    ```bash
    git clone https://github.com/aeml/eidolon.git
    cd eidolon
    ```

2.  Start the Game Server (Go):
    ```bash
    cd server
    go run main.go
    ```
    The server will start on port `8080`.

3.  Start the Client (Web Server):
    Open a new terminal in the root `eidolon` directory:
    ```bash
    # Python 3
    python3 -m http.server 8000
    ```

4.  Open your browser and navigate to:
    `http://localhost:8000`

## 🏛️ System Architecture

The codebase follows a strict separation between **Simulation** and **Visualization**.

### Core Subsystems
*   **Server (Go):** Handles all game logic, physics, combat, and state management. It broadcasts state updates to connected clients via WebSockets.
*   **Client (JS):** Handles input, rendering, and interpolation.
    *   **GameEngine:** Manages the game loop, network synchronization, and entity interpolation.
    *   **RenderSystem:** Manages the Three.js Scene, Orthographic Camera, and Lighting.
    *   **InputManager:** Abstracts mouse/keyboard/touch events.
    *   **ChunkManager:** Handles dynamic loading/unloading of entities and terrain based on player position.

### Entity Hierarchy
*   **Entity:** Base class for all world objects (Position, Rotation, ID).
*   **Actor:** Extends Entity. Handles stats (HP, Speed), state machines (Idle, Moving, Attacking), and `AnimationMixer` logic.
*   **Archetypes:** Concrete classes (`Fighter`, `Rogue`, `Wizard`, `Cleric`) that inject specific stats and visual configurations.

## 🎨 Asset Pipeline

The project uses a "Greybox First" philosophy that has evolved into a full Asset Pipeline:
1.  **Loading:** `MeshFactory` loads GLB files asynchronously.
2.  **Cloning:** Uses `SkeletonUtils.clone()` to support multiple instances of SkinnedMeshes (characters with skeletons).
3.  **Animation:** Animations are stripped of scale tracks to prevent visual popping and managed via a finite state machine in `Actor.js`.

## 🗺️ World Design

The game takes place in **Aethelgard**, divided into four realms representing the Primal Elements:
1.  **The Iron Weald** (Earth) - Fighter
2.  **The Crystalline Spire** (Air) - Wizard
3.  **The Shifting Sands** (Fire) - Rogue
4.  **The Abyssal Well** (Water) - Cleric

## 📄 License

This project is open source.
