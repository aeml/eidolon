import { RenderSystem } from './RenderSystem.js';
import { InputManager } from './InputManager.js';
import { Fighter } from '../entities/Fighter.js';
import { Rogue } from '../entities/Rogue.js';
import { Wizard } from '../entities/Wizard.js';
import { Cleric } from '../entities/Cleric.js';

export class GameEngine {
    constructor(playerType) {
        this.renderSystem = new RenderSystem();
        this.inputManager = new InputManager(this.renderSystem.camera, this.renderSystem.scene);
        
        this.entities = [];
        this.player = null;
        this.playerType = playerType || 'Fighter';
        
        this.lastTime = 0;
        this.accumulator = 0;
        this.fixedTimeStep = 1 / 60;

        this.init();
    }

    init() {
        console.log(`Initializing GameEngine with player type: ${this.playerType}`);
        // Spawn Player based on selection
        switch(this.playerType) {
            case 'Rogue':
                this.player = new Rogue('player-1');
                break;
            case 'Wizard':
                this.player = new Wizard('player-1');
                break;
            case 'Cleric':
                this.player = new Cleric('player-1');
                break;
            default:
                this.player = new Fighter('player-1');
                break;
        }
        
        if (!this.player) {
            console.error("Failed to create player entity!");
            return;
        }

        this.addEntity(this.player);
        // console.log("Player entity added to scene."); // Removed misleading log

        // Spawn some other entities for demo
        const rogue = new Rogue('npc-rogue');
        rogue.position.set(5, 0, 5);
        this.addEntity(rogue);

        const wizard = new Wizard('npc-wizard');
        wizard.position.set(-5, 0, 5);
        this.addEntity(wizard);

        const cleric = new Cleric('npc-cleric');
        cleric.position.set(0, 0, -5);
        this.addEntity(cleric);

        // Input Handling
        this.inputManager.subscribe('onClick', (targetVector) => {
            if (this.player) {
                this.player.move(targetVector);
            }
        });

        this.inputManager.subscribe('onRightClick', (targetVector) => {
            if (this.player) {
                this.player.performSkill(targetVector);
            }
        });

        this.inputManager.subscribe('onZoom', (delta) => {
            // delta is +1 (zoom out) or -1 (zoom in) usually
            // For orthographic size, smaller = zoomed in.
            // So if delta is positive (scroll down), we want to increase size (zoom out).
            const newZoom = this.renderSystem.currentZoom + delta * 2;
            this.renderSystem.setZoom(newZoom);
        });

        this.inputManager.subscribe('onSpace', () => {
            if (this.player) {
                console.log("Centering camera on player");
                this.renderSystem.setCameraTarget(this.player.position);
            }
        });

        // Start Loop
        requestAnimationFrame((t) => this.loop(t));
    }

    addEntity(entity) {
        this.entities.push(entity);
        if (entity.mesh) {
            this.renderSystem.add(entity.mesh);
        } else {
            // Wait for mesh to load asynchronously
            console.log(`GameEngine: Waiting for mesh for entity ${entity.id}`);
            entity.onMeshReady = (mesh) => {
                console.log(`GameEngine: Mesh ready for entity ${entity.id}, adding to scene.`);
                this.renderSystem.add(mesh);
            };
            
            // Fallback check in case onMeshReady was missed (race condition)
            if (entity.mesh) {
                console.warn(`GameEngine: Mesh was already ready for ${entity.id}! Adding now.`);
                this.renderSystem.add(entity.mesh);
            }
        }
    }

    loop(time) {
        const seconds = time * 0.001;
        const dt = Math.min(seconds - this.lastTime, 0.1); // Cap dt to prevent spiral of death
        this.lastTime = seconds;
        
        this.accumulator += dt;

        while (this.accumulator >= this.fixedTimeStep) {
            this.update(this.fixedTimeStep);
            this.accumulator -= this.fixedTimeStep;
        }

        // Render with interpolation factor (alpha)
        const alpha = this.accumulator / this.fixedTimeStep;
        this.render(alpha);

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        // Camera Movement
        const panSpeed = 20; // Units per second
        const keys = this.inputManager.keys;
        
        let dx = 0;
        let dz = 0;

        // Isometric Movement Mapping
        // W (Up) -> (-1, -1)
        // S (Down) -> (1, 1)
        // A (Left) -> (-1, 1)
        // D (Right) -> (1, -1)

        if (keys.w) { dx -= 1; dz -= 1; }
        if (keys.s) { dx += 1; dz += 1; }
        if (keys.a) { dx -= 1; dz += 1; }
        if (keys.d) { dx += 1; dz -= 1; }

        if (dx !== 0 || dz !== 0) {
            // Normalize
            const length = Math.sqrt(dx*dx + dz*dz);
            dx /= length;
            dz /= length;
            
            this.renderSystem.panCamera(dx * panSpeed * dt, dz * panSpeed * dt);
        }

        this.entities.forEach(entity => {
            if (entity.isActive) {
                entity.update(dt);
            }
        });
    }

    render(alpha) {
        this.entities.forEach(entity => {
            if (entity.isActive) {
                entity.render(alpha);
            }
        });
        this.renderSystem.render();
    }
}