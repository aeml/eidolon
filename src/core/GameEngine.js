import * as THREE from 'three';
import { RenderSystem } from './RenderSystem.js';
import { InputManager } from './InputManager.js';
import { ChunkManager } from './ChunkManager.js';
import { CollisionManager } from './CollisionManager.js';
import { UIManager } from '../ui/UIManager.js';
import { WorldGenerator } from '../world/WorldGenerator.js';
import { Minimap } from '../ui/Minimap.js';
import { WorldMap } from '../ui/WorldMap.js';
import { Fighter } from '../entities/Fighter.js';
import { Skeleton } from '../entities/Skeleton.js';
import { Rogue } from '../entities/Rogue.js';
import { Wizard } from '../entities/Wizard.js';
import { Cleric } from '../entities/Cleric.js';
import { Projectile } from '../entities/Projectile.js';

export class GameEngine {
    constructor(playerType) {
        this.renderSystem = new RenderSystem();
        this.inputManager = new InputManager(this.renderSystem.camera, this.renderSystem.scene);
        this.chunkManager = new ChunkManager(this.renderSystem.scene);
        this.collisionManager = new CollisionManager();
        this.uiManager = new UIManager();
        this.worldGenerator = new WorldGenerator(this.renderSystem.scene, this.collisionManager);
        this.minimap = new Minimap();
        this.worldMap = new WorldMap(this);
        
        this.player = null;
        this.hoveredEntity = null;
        this.playerType = playerType || 'Fighter';
        this.enemies = []; // Keep track of enemies for pooling
        this.projectiles = []; // Track active projectiles
        this.cameraLocked = true; // Default to locked
        
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
        
        this.uiManager.showHUD();

        // Handle Stat Upgrades
        this.uiManager.onStatUpgrade = (stat) => {
            if (this.player) {
                const success = this.player.increaseStat(stat);
                if (success) {
                    console.log(`Upgraded ${stat}. New value: ${this.player.stats[stat]}`);
                    this.uiManager.updateCharacterSheet(this.player);
                } else {
                    console.log(`Failed to upgrade ${stat}. Points: ${this.player.statPoints}`);
                }
            }
        };

        // Force initial chunk update to ensure player is visible immediately
        console.log("GameEngine: Forcing initial chunk update");
        this.chunkManager.update(this.player, 0, this.collisionManager);

        // Generate World (Town)
        this.worldGenerator.createTown(0, 0, 100); // 100x100 unit town

        // Spawn Enemies (Outside Town)
        this.spawnEnemies(20);

        // Input Handling
        this.inputManager.subscribe('onClick', () => {
            if (!this.player) return;

            // 1. Check for Entity Click (Attack)
            if (this.hoveredEntity && this.hoveredEntity !== this.player) {
                // Check distance
                const dist = this.player.position.distanceTo(this.hoveredEntity.position);
                if (dist < 5) { // Melee range
                    this.player.attack(this.hoveredEntity);
                } else {
                    // Move to target? Or just move towards it
                    this.player.move(this.hoveredEntity.position);
                }
            } else {
                // 2. Ground Click (Move)
                // const target = this.inputManager.getRayIntersection(); // Removed as it doesn't exist
                // if (target) {
                //     this.player.move(target);
                // } else {
                    // Move to ground position
                    const point = this.inputManager.getGroundIntersection();
                    if (point) {
                        this.player.move(point);
                    }
                // }
            }
        });

        this.inputManager.subscribe('onRightClick', () => {
            if (!this.player) return;
            
            const point = this.inputManager.getGroundIntersection();
            if (point) {
                this.player.useAbility(point, this);
                this.uiManager.updateAbilityIcon(this.player); // Update cooldown visual
            }
        });

        this.inputManager.subscribe('onMouseMove', (mouse) => {
            // Raycast against active entities to find hovered one
            const activeEntities = this.chunkManager.getActiveEntities();
            const meshes = activeEntities
                .filter(e => e.mesh && e.isActive && e !== this.player)
                .map(e => e.mesh);
            
            this.inputManager.raycaster.setFromCamera(mouse, this.renderSystem.camera);
            const intersects = this.inputManager.raycaster.intersectObjects(meshes, true); // Recursive for child meshes
            
            if (intersects.length > 0) {
                // Find the root entity from the mesh
                let obj = intersects[0].object;
                while (obj.parent && !obj.userData.entityId) {
                    obj = obj.parent;
                }
                
                if (obj.userData.entityId) {
                    this.hoveredEntity = activeEntities.find(e => e.id === obj.userData.entityId);
                    // Change cursor?
                    document.body.style.cursor = 'crosshair';
                }
            } else {
                this.hoveredEntity = null;
                document.body.style.cursor = 'default';
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
            this.cameraLocked = !this.cameraLocked;
            console.log(`Camera Locked: ${this.cameraLocked}`);
            if (this.cameraLocked && this.player) {
                this.renderSystem.setCameraTarget(this.player.position);
            }
        });

        this.inputManager.subscribe('onTeleport', () => {
            if (this.player) {
                console.log("Teleporting to town...");
                this.player.position.set(0, 0, 0);
                this.player.targetPosition = null; // Stop moving
                this.player.state = 'IDLE';
                
                // Reset camera if locked
                if (this.cameraLocked) {
                    this.renderSystem.setCameraTarget(this.player.position);
                }
            }
        });

        this.inputManager.subscribe('onMap', () => {
            this.worldMap.toggle();
        });

        this.inputManager.subscribe('onCharacter', () => {
            this.uiManager.toggleCharacterSheet();
            this.uiManager.updateCharacterSheet(this.player);
        });

        this.inputManager.subscribe('onInventory', () => {
            this.uiManager.toggleInventory();
            this.uiManager.updateInventory(this.player);
        });

        // Start Loop
        this.loop(0);
    }

    addEntity(entity) {
        this.chunkManager.addEntity(entity);
        
        if (!entity.mesh) {
            // Wait for mesh to load asynchronously
            const originalOnMeshReady = entity.onMeshReady;
            entity.onMeshReady = (mesh) => {
                console.log(`GameEngine: Mesh ready for ${entity.id}`);
                if (originalOnMeshReady) originalOnMeshReady(mesh);
                
                // Re-add to chunk manager to ensure visibility check runs with the new mesh
                const key = this.chunkManager.getChunkKey(entity.position.x, entity.position.z);
                if (this.chunkManager.activeChunkKeys.has(key)) {
                    console.log(`GameEngine: Adding mesh for ${entity.id} to scene (delayed)`);
                    this.renderSystem.add(mesh);
                } else {
                    console.log(`GameEngine: Chunk ${key} not active, mesh not added yet`);
                }
            };
        } else {
             console.log(`GameEngine: Entity ${entity.id} already has mesh`);
        }
    }

    spawnEnemies(count) {
        console.log(`Spawning ${count} skeletons...`);
        for (let i = 0; i < count; i++) {
            const skeleton = new Skeleton(`skeleton-${i}`);
            
            // Random position outside town
            const pos = this.getRandomSpawnPosition();
            skeleton.position.copy(pos);
            
            this.addEntity(skeleton);
            this.enemies.push(skeleton);
        }
    }

    getRandomSpawnPosition() {
        // Spawn in a ring between 60 and 150 units
        const angle = Math.random() * Math.PI * 2;
        const radius = 60 + Math.random() * 90;
        return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
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
        // Update ChunkManager (handles loading/unloading and entity updates)
        if (this.player) {
            this.chunkManager.update(this.player, dt, this.collisionManager);
            
            // Player Death & Respawn Logic
            if (this.player.state === 'DEAD') {
                if (this.player.timeSinceDeath === undefined) this.player.timeSinceDeath = 0;
                this.player.timeSinceDeath += dt;
                
                if (this.player.timeSinceDeath > 3.0) { // Respawn after 3 seconds
                    console.log("Player respawning in town...");
                    this.player.respawn(0, 0); // Respawn at Town Center (0,0)
                    
                    // Reset Camera
                    this.renderSystem.setCameraTarget(this.player.position);
                    
                    // Force chunk update to ensure town is loaded
                    this.chunkManager.update(this.player, 0, this.collisionManager);
                }
            }

            // Cleric Spirit Damage Logic
            if (this.player instanceof Fighter && this.player.isCharging) {
                this.enemies.forEach(enemy => {
                    if (enemy.state !== 'DEAD' && enemy.isActive) {
                        const dist = this.player.position.distanceTo(enemy.position);
                        const hitRadius = (this.player.radius || 0.5) + (enemy.radius || 0.5);
                        if (dist < hitRadius) { // Hit radius
                            // Damage Calculation: Base 10 + (Strength * 1.5)
                            const dmg = 10 + (this.player.stats.strength * 1.5);
                            enemy.takeDamage(Math.floor(dmg));
                            
                            if (enemy.stats.hp <= 0) {
                                this.player.gainXp(enemy.xpValue);
                            }

                            // Stop charging on impact
                            this.player.isCharging = false;
                            this.player.state = 'IDLE';
                            this.player.playAnimation('Idle');
                        }
                    }
                });
            }

            // Cleric Spirit Damage Logic
            if (this.player instanceof Cleric && this.player.spiritsActive) {
                this.enemies.forEach(enemy => {
                    if (enemy.state !== 'DEAD' && enemy.isActive) {
                        const dist = this.player.position.distanceTo(enemy.position);
                        if (dist < 5.0) { // Spirit radius (Increased to 5.0)
                            // Damage tick (simple implementation: damage every frame is too much, need timer)
                            // Let's just do small damage per frame or use a timer on the enemy?
                            // Better: Timer on player
                            if (!this.player.spiritTick) this.player.spiritTick = 0;
                            this.player.spiritTick += dt;
                            if (this.player.spiritTick > 0.5) { // Tick every 0.5s
                                // Damage Calculation: Base 10 + (Wisdom * 1.0)
                                const dmg = 10 + (this.player.stats.wisdom * 1.0);
                                enemy.takeDamage(Math.floor(dmg));
                                
                                if (enemy.stats.hp <= 0) {
                                    this.player.gainXp(enemy.xpValue);
                                }
                                // Reset handled after loop
                            }
                        }
                    }
                });
                if (this.player.spiritTick > 0.5) this.player.spiritTick = 0;
            }
            
            if (this.cameraLocked) {
                this.renderSystem.setCameraTarget(this.player.position);
            } else {
                // Handle Camera Movement (WASD)
                const panSpeed = 30; // Increased speed for better feel
                const keys = this.inputManager.keys;
                let dx = 0;
                let dz = 0;

                // Isometric Movement Mapping
                if (keys.w) { dx -= 1; dz -= 1; }
                if (keys.s) { dx += 1; dz += 1; }
                if (keys.a) { dx -= 1; dz += 1; }
                if (keys.d) { dx += 1; dz -= 1; }

                // Get current target
                const currentTarget = this.renderSystem.cameraTarget.clone();

                if (dx !== 0 || dz !== 0) {
                    const length = Math.sqrt(dx*dx + dz*dz);
                    dx /= length;
                    dz /= length;
                    
                    currentTarget.x += dx * panSpeed * dt;
                    currentTarget.z += dz * panSpeed * dt;
                }

                // Clamp Camera to Loaded Area (relative to Player)
                // We allow the camera to roam within the loaded chunks.
                // LOAD_DISTANCE = 1 means 3x3 chunks. 
                // Safe radius is roughly 1 chunk size (50 units).
                const maxDist = 50; 
                const dist = currentTarget.distanceTo(this.player.position);
                
                if (dist > maxDist) {
                    // Pull camera back towards player
                    const dir = new THREE.Vector3().subVectors(currentTarget, this.player.position).normalize();
                    currentTarget.copy(this.player.position).add(dir.multiplyScalar(maxDist));
                }
                
                this.renderSystem.setCameraTarget(currentTarget);
            }
        }

        // Enemy Spawning / Recycling Logic
        this.enemies.forEach(enemy => {
            if (enemy.state === 'DEAD') {
                enemy.timeSinceDeath += dt;

                // Hide body after 2 seconds (allow animation to finish)
                if (enemy.timeSinceDeath > 2 && enemy.mesh && enemy.mesh.visible) {
                    enemy.mesh.visible = false;
                }

                // Respawn after 5 seconds
                if (enemy.timeSinceDeath > 5) {
                    const pos = this.getRandomSpawnPosition();
                    
                    // We need to update ChunkManager because it might move to a new chunk
                    // Remove from old chunk
                    const oldKey = this.chunkManager.getChunkKey(enemy.position.x, enemy.position.z);
                    if (this.chunkManager.chunks.has(oldKey)) {
                        this.chunkManager.chunks.get(oldKey).delete(enemy);
                    }

                    // Respawn (updates position)
                    enemy.mesh.visible = true;
                    enemy.respawn(pos.x, pos.z);

                    // Add to new chunk
                    this.chunkManager.addEntity(enemy);
                }
            }
        });

        // Projectile Logic
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt);
            
            if (!p.isActive) {
                this.renderSystem.remove(p.mesh);
                this.projectiles.splice(i, 1);
                continue;
            }

            // Collision with Enemies
            for (const enemy of this.enemies) {
                if (enemy.state !== 'DEAD' && enemy.isActive) {
                    const dist = p.position.distanceTo(enemy.position);
                    const hitRadius = p.radius + (enemy.radius || 0.5);
                    if (dist < hitRadius) { // Projectile radius + Enemy radius
                        enemy.takeDamage(Math.floor(p.damage));
                        if (enemy.stats.hp <= 0) {
                            p.owner.gainXp(enemy.xpValue);
                        }
                        
                        // Destroy projectile
                        p.isActive = false;
                        this.renderSystem.remove(p.mesh);
                        this.projectiles.splice(i, 1);
                        break; // Stop checking enemies for this projectile
                    }
                }
            }
        }
    }

    render(alpha) {
        // Get active entities for rendering interpolation
        const activeEntities = this.chunkManager.getActiveEntities();
        activeEntities.forEach(entity => {
            if (entity.isActive) {
                entity.render(alpha);
            }
        });
        
        this.renderSystem.render();
        
        // Update UI
        if (this.player) {
            this.minimap.update(this.player, activeEntities);
            this.uiManager.updatePlayerStats(this.player);
            this.uiManager.updateXP(this.player);
            this.uiManager.updateEnemyBars(
                activeEntities, 
                this.renderSystem.camera, 
                this.hoveredEntity, 
                this.inputManager.keys.alt
            );
            this.worldMap.update(this.player);
        }
    }
}