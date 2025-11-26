# EIDOLON

**Eidolon** is a browser-based Isometric Action-RPG set in *Aethelgard*, a realm where physical reality is a direct projection of the Collective Consciousness.

> *The world has fallen into Dissonance. You are a Harmonizer. You do not kill to conquer; you fight to re-tune.*

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

*   **Language:** Vanilla JavaScript (ES6+ Modules). No transpilers or bundlers (Webpack/Vite) required.
*   **Renderer:** [Three.js](https://threejs.org/) (WebGL).
*   **Assets:** GLTF/GLB 3D Models, PNG Textures.
*   **Architecture:** Object-Oriented Entity System with Component-like composition for visuals.

## 🚀 Getting Started

Since this project uses ES Modules, you cannot open `index.html` directly from the file system due to CORS security policies. You must serve it via a local web server.

### Prerequisites
*   Python 3.x (Pre-installed on most systems)
*   OR Node.js (`http-server`)
*   OR VS Code "Live Server" extension

### Running Locally (Python)

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/eidolon.git
    cd eidolon
    ```

2.  Start a local server:
    ```bash
    # Python 3
    python3 -m http.server 8000
    ```

3.  Open your browser and navigate to:
    `http://localhost:8000`

## 🏛️ System Architecture

The codebase follows a strict separation between **Simulation** and **Visualization**.

### Core Subsystems
*   **GameEngine:** The central orchestrator. Runs a fixed time-step update loop for deterministic logic and a variable render loop for smooth visuals.
*   **RenderSystem:** Manages the Three.js Scene, Orthographic Camera, and Lighting. Handles the isometric projection math.
*   **InputManager:** Abstracts mouse/keyboard events. Uses Raycasting to translate 2D screen coordinates into 3D world-space coordinates on the ground plane.
*   **MeshFactory:** An asynchronous asset loader that handles GLB loading, bone cloning (via `SkeletonUtils`), and animation extraction.

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

The game takes place in **Aethelgard**, divided into four realms representing Jungian functions:
1.  **The Iron Weald** (Sensation/Earth) - Fighter
2.  **The Crystalline Spire** (Thinking/Air) - Wizard
3.  **The Shifting Sands** (Intuition/Fire) - Rogue
4.  **The Abyssal Well** (Feeling/Water) - Cleric

## 📄 License

This project is open source.
