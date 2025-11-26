System Architecture: Browser-Based Isometric ARPG

1. High-Level Design Philosophy

This project is a high-performance, mobile-compatible Action RPG running in a standard web browser. The architecture strictly follows Object-Oriented Design principles, leveraging Polymorphism to avoid conditional logic ladders ("if/else hell").

Core Pillars

Simulation vs. Visualization Separation: The game logic (hitboxes, stats, cooldowns) must run independently of the rendering engine. The Actor class calculates where it is; the RenderSystem observes this and draws a mesh at that location.

Greybox First: The system is designed to run immediately using geometric primitives (cubes, spheres). 3D Assets (GLB/GLTF) are treated as a "skin" applied later via the AssetManager.

Zero-Garbage Loop: Critical gameplay loops must avoid new allocations to prevent Garbage Collection stutters. Object Pooling is mandatory for projectiles and particle effects.

2. Technology Stack

Language: Vanilla JavaScript (ES6+ Modules). No transpilers (Webpack/Babel) required for dev.

Renderer: Three.js (WebGL abstraction).

Input: Raycasting (Mouse/Touch to World-Space coordinates).

State: Singleton GameEngine managing a list of polymorphic Entities.

3. Core Subsystems

3.1 The Game Loop (GameEngine.js)

The central orchestrator using requestAnimationFrame.

Fixed Time Step Update: Physics and Game Logic run at a fixed delta (e.g., 60 ticks/sec) to ensure deterministic behavior.

Variable Render Step: Rendering happens as fast as the device allows.

3.2 The Input System (InputManager.js)

Responsibility: Abstracts Mouse and Touch events into a unified InputState.

Isometric Raycasting:

Creates an invisible mathematical "Ground Plane" at Y=0.

On click/tap, casts a Ray from the Camera to this plane.

Returns a Vector3 destination. Never use screen coordinates (pixels) for game logic.

3.3 The Render System (RenderSystem.js)

Responsibility: Manages the Three.js Scene, Camera, and Renderer.

Camera Setup:

Type: OrthographicCamera (Essential for Isometric look).

Angle: Isometric Projection (approx. 35.264° X-axis rotation, 45° Y-axis rotation).

Lighting: Simple Directional Light (Sun) + Ambient Light. Shadows should be configured for performance (low resolution map size).

4. Class Hierarchy (Polymorphism)

The game relies on a clean inheritance tree. All game objects are Entities.

4.1 Base Class: Entity

The root object for anything that exists in the world.

Properties: position (Vector3), rotation (Quaternion), id (UUID), isActive (bool).

Methods: update(dt), render(interpolation).

4.2 Base Class: Actor extends Entity

The root for dynamic characters (Player, Enemies).

Properties:

Stats (HP, MaxHP, Speed, Resource).

VisualProxy (Reference to the mesh/primitive).

ActionState (Idle, Moving, Attacking, Dead).

Methods:

move(targetVector): Calculates velocity based on Speed.

takeDamage(amount): Handles HP reduction and death state.

performSkill(target): Executes the active strategy.

4.3 Concrete Classes (The "Fab Four")

These classes inject specific configurations and SkillStrategies into the Actor base.

Fighter

Visual: Red Box (BoxGeometry).

Resource: Rage (0-100).

Trait: High HP, Slow Speed.

Default Skill: MeleeCleave.

Rogue

Visual: Green Cylinder (CylinderGeometry - thin).

Resource: Energy (Regenerates fast).

Trait: High Speed, Low HP.

Default Skill: Backstab (Bonus damage if aligned behind target).

Wizard

Visual: Blue Cone (ConeGeometry).

Resource: Mana.

Trait: Ranged attack.

Default Skill: FireballProjectile.

Cleric

Visual: Gold Sphere (SphereGeometry).

Resource: Faith.

Trait: Support/Hybrid.

Default Skill: AreaHeal.

5. The Strategy Pattern (Skills)

Instead of hardcoding attacks inside Actor, we use a Strategy Pattern.

Interface: SkillStrategy

execute(owner, targetVector): Performs the logic.

canExecute(owner): Checks cooldowns and resource costs.

Concrete Strategies

MeleeAttack: Creates a temporary "Sensor" geometry in front of the owner. If it intersects an enemy, deal damage.

ProjectileCast: Requests a projectile from the ObjectPool, sets its position to the caster's hand, and gives it velocity.

SelfBuff: Directly modifies the owner's Stats object.

6. The Visual Abstraction Layer

To support the "Models later" requirement, we use a Factory/Proxy pattern for visuals.

MeshFactory.js

A static helper that generates Three.js meshes.

Method: createMeshForType(typeString)

Logic:

if (ASSETS_LOADED): Clone the GLB model from the Asset Cache.

else: Return the specific Geometric Primitive (Box/Sphere) defined for that type.

Benefit: The Actor class calls MeshFactory.createMeshForType('Fighter'). It does not care if it gets a Red Box or a high-poly gladiator.

7. Optimization & Memory

7.1 Object Pooling (ObjectPool.js)

Concept: Instantiate 50 generic "Projectile" objects and 20 generic "Enemy" objects at startup.

Lifecycle:

Spawn: Find first inactive object in pool -> Reset State -> Set active = true.

Despawn: Set active = false -> Move to (0, -1000, 0).

7.2 Instanced Rendering (Future Proofing)

If enemy count exceeds 100, the RenderSystem should switch from individual Mesh objects to THREE.InstancedMesh.

8. Directory Structure

/src
├── core/
│   ├── GameEngine.js       // Main Loop
│   ├── InputManager.js     // Raycaster
│   ├── RenderSystem.js     // Three.js setup
│   └── Constants.js        // Config (Speed, Ranges)
├── entities/
│   ├── Entity.js           // Base
│   ├── Actor.js            // Base Character
│   ├── Fighter.js
│   ├── Rogue.js
│   ├── Wizard.js
│   └── Cleric.js
├── skills/
│   ├── SkillStrategy.js    // Interface (Class)
│   ├── MeleeSkill.js
│   └── ProjectileSkill.js
├── memory/
│   └── ObjectPool.js
├── utils/
│   └── MeshFactory.js      // Handles Primitives vs Models
└── main.js                 // Entry Point


9. Implementation Steps (Agent Prompt Guide)

Scaffold: Set up index.html and main.js with a basic Three.js scene (Isometric Camera).

Input: Implement Raycasting to move a Debug Sphere around on the floor.

Entities: Implement Actor and Fighter. Replace Debug Sphere with Fighter instance.

Movement: Implement move(target) in Actor using vector math.

Polymorphism: Create Wizard and Rogue classes; spawn one of each.

Skills: Implement ProjectileSkill and connect it to the Wizard's click action.