import * as THREE from 'three';
import { RenderSystem } from './RenderSystem.js';
import { InputManager } from './InputManager.js';
import { ChunkManager } from './ChunkManager.js';
import { CollisionManager } from './CollisionManager.js';
import { ItemGenerator } from './ItemSystem.js';
import { UIManager } from '../ui/UIManager.js';
import { WorldGenerator } from '../world/WorldGenerator.js';
import { Minimap } from '../ui/Minimap.js';
import { WorldMap } from '../ui/WorldMap.js';
import { Fighter } from '../entities/Fighter.js';
import { Skeleton } from '../entities/Skeleton.js';
import { Rogue } from '../entities/Rogue.js';
import { Wizard } from '../entities/Wizard.js';
import { Cleric } from '../entities/Cleric.js';
import { DemonOrc } from '../entities/DemonOrc.js';
import { Projectile } from '../entities/Projectile.js';
import { LootDrop } from '../entities/LootDrop.js';
import { DwarfSalesman } from '../entities/DwarfSalesman.js';
import { Actor } from '../entities/Actor.js';
import { Imp } from '../entities/Imp.js';

export class GameEngine {
    constructor(playerType, isMobile = false) {
        this.isMobile = isMobile;
        this.renderSystem = new RenderSystem(isMobile);
        this.inputManager = new InputManager(this.renderSystem.camera, this.renderSystem.scene);
        if (this.isMobile) {
            this.inputManager.setupMobileControls();
            this.cameraLocked = true; // Force camera lock on mobile
        }

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
        this.pendingInteraction = null; // Entity to interact with when in range
        this.pendingAbilityTarget = null; // Entity to use ability on when in range
        
        this.lastTime = 0;
        this.accumulator = 0;
        this.fixedTimeStep = 1 / 60;

        this.gameTime = 0;
        this.nextEliteSpawnTime = 180; // 3 minutes

        // Optimization: Raycast throttling and caching
        this.raycastTimer = 0;
        this.mousePosition = new THREE.Vector2();
        this.needsRaycast = false;
        this.activeEntitiesCache = [];
        this.frameCount = 0;

        // this.init(); // Defer init to loadGame
    }

    async loadGame(onProgress) {
        console.error(`Initializing GameEngine with player type: ${this.playerType}`); // Error level to ensure visibility
        
        if (onProgress) onProgress(10, "Creating Player...");
        await new Promise(r => setTimeout(r, 50));

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
        
        if (onProgress) onProgress(30, "Initializing UI...");
        await new Promise(r => setTimeout(r, 50));

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

        // Handle Respawn / Unstuck
        this.uiManager.onRespawn = () => {
            if (this.player) {
                console.log("Player requested respawn/unstuck.");
                this.player.respawn(0, 0);
                this.player.timeSinceDeath = null;
                this.chunkManager.updateEntityChunk(this.player); // Force chunk update
                this.renderSystem.setCameraTarget(this.player.position);
                this.chunkManager.update(this.player, 0, this.collisionManager);
            }
        };

        if (onProgress) onProgress(50, "Generating World...");
        await new Promise(r => setTimeout(r, 50));

        // Force initial chunk update to ensure player is visible immediately
        console.log("GameEngine: Forcing initial chunk update");
        this.chunkManager.update(this.player, 0, this.collisionManager);

        // Generate World (Town)
        this.worldGenerator.createTown(0, 0, 100); // 100x100 unit town

        // Spawn NPCs
        this.spawnNPCs();

        if (onProgress) onProgress(70, "Spawning Enemies...");
        await new Promise(r => setTimeout(r, 50));

        // Spawn Enemies
        this.spawnEnemies();

        if (onProgress) onProgress(90, "Setting up Controls...");
        await new Promise(r => setTimeout(r, 50));

        // Input Handling
        this.inputManager.subscribe('onClick', () => {
            if (!this.player) return;
            if (this.uiManager.isEscMenuOpen) return; // Disable movement in Esc menu

            // Mobile Attack Logic (Auto-target nearest)
            if (this.isMobile) {
                // Find nearest enemy
                let nearest = null;
                let minDst = 1000;
                this.enemies.forEach(e => {
                    if (e.isActive && e.state !== 'DEAD') {
                        const d = this.player.position.distanceTo(e.position);
                        if (d < minDst) {
                            minDst = d;
                            nearest = e;
                        }
                    }
                });

                if (nearest && minDst < 8.0) {
                    this.pendingInteraction = nearest;
                    this.player.move(nearest.position);
                } else {
                    // Just attack in place
                    this.player.playAnimation('Attack', false);
                }
                return;
            }

            // 1. Check for Entity Click (Attack or Loot)
            if (this.hoveredEntity && this.hoveredEntity !== this.player) {
                // Set as pending interaction and move towards it
                this.pendingInteraction = this.hoveredEntity;
                this.pendingAbilityTarget = null; // Clear pending ability
                this.player.move(this.hoveredEntity.position);
            } else {
                // 2. Ground Click (Move)
                const point = this.inputManager.getGroundIntersection();
                if (point) {
                    this.pendingInteraction = null; // Cancel pending interaction
                    this.pendingAbilityTarget = null; // Clear pending ability
                    this.player.move(point);
                }
            }
        });

        this.inputManager.subscribe('onRightClick', () => {
            if (!this.player) return;
            if (this.uiManager.isEscMenuOpen) return; // Disable abilities in Esc menu
            
            // Mobile Ability Logic (Auto-target)
            if (this.isMobile) {
                // Find nearest enemy
                let nearest = null;
                let minDst = 1000;
                this.enemies.forEach(e => {
                    if (e.isActive && e.state !== 'DEAD') {
                        const d = this.player.position.distanceTo(e.position);
                        if (d < minDst) {
                            minDst = d;
                            nearest = e;
                        }
                    }
                });

                if (nearest && minDst < 15.0) {
                    this.player.useAbility(nearest.position, this);
                    this.uiManager.updateAbilityIcon(this.player);
                } else {
                    // Cast in facing direction?
                    // For now, just cast at current position + forward vector
                    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.mesh.quaternion);
                    const target = this.player.position.clone().add(forward.multiplyScalar(5));
                    this.player.useAbility(target, this);
                    this.uiManager.updateAbilityIcon(this.player);
                }
                return;
            }

            // 1. Check if hovering an enemy
            if (this.hoveredEntity && this.hoveredEntity !== this.player && this.hoveredEntity.state !== 'DEAD') {
                // Check if player is Ranged (Wizard or Rogue) or Fighter (Charge)
                if (this.player instanceof Wizard || this.player instanceof Rogue || this.player instanceof Fighter) {
                    // Cast Immediately from any distance
                    this.pendingAbilityTarget = null;
                    this.pendingInteraction = null;
                    this.player.useAbility(this.hoveredEntity.position, this);
                    this.uiManager.updateAbilityIcon(this.player);
                    
                    // Stop movement if we were moving
                    this.player.targetPosition = null;
                    // Only set to IDLE if not charging (Fighter sets ATTACKING in useAbility)
                    if (this.player.state !== 'ATTACKING') {
                        this.player.state = 'IDLE';
                        this.player.playAnimation('Idle');
                    }
                } else {
                    // Melee: Move to range
                    this.pendingAbilityTarget = this.hoveredEntity;
                    this.pendingInteraction = null; // Clear pending interaction
                    this.player.move(this.hoveredEntity.position);
                }
            } else {
                // 2. Fallback to ground click (Immediate cast)
                const targetPoint = this.inputManager.getGroundIntersection();
                if (targetPoint) {
                    this.pendingAbilityTarget = null;
                    this.pendingInteraction = null;
                    this.player.useAbility(targetPoint, this);
                    this.uiManager.updateAbilityIcon(this.player); // Update cooldown visual
                }
            }
        });

        this.inputManager.subscribe('onMouseMove', (mouse) => {
            this.mousePosition.copy(mouse);
            this.needsRaycast = true;
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

        this.inputManager.subscribe('onInteract', () => {
            if (!this.player || !this.isMobile) return;
            
            // Smart Interact Logic:
            // 1. Loot (Very close range)
            // 2. NPC (Close range)
            
            const activeEntities = this.chunkManager.getActiveEntities();
            let nearestLoot = null;
            let nearestNPC = null;
            let lootDist = 2.5;
            let npcDist = 4.0;

            activeEntities.forEach(e => {
                if (!e.isActive) return;
                const d = this.player.position.distanceTo(e.position);
                
                if (e instanceof LootDrop && d < lootDist) {
                    nearestLoot = e;
                    lootDist = d;
                } else if (e instanceof DwarfSalesman && d < npcDist) {
                    nearestNPC = e;
                    npcDist = d;
                }
            });

            if (nearestLoot) {
                // Pick up
                if (this.player.addToInventory(nearestLoot.item)) {
                    console.log(`Picked up ${nearestLoot.item.name}`);
                    this.uiManager.updateInventory(this.player);
                    nearestLoot.isActive = false;
                    this.renderSystem.remove(nearestLoot.mesh);
                    // Remove from chunk
                    const key = this.chunkManager.getChunkKey(nearestLoot.position.x, nearestLoot.position.z);
                    if (this.chunkManager.chunks.has(key)) {
                        this.chunkManager.chunks.get(key).delete(nearestLoot);
                    }
                }
            } else if (nearestNPC) {
                this.uiManager.toggleShop();
            }
        });

        this.inputManager.subscribe('onEscape', () => {
            this.uiManager.handleEscape();
        });

        this.inputManager.subscribe('onTeleport', () => {
            if (this.player) {
                console.log("Teleporting to town...");
                this.player.position.set(0, 0, 0);
                this.player.targetPosition = null; // Stop moving
                this.player.state = 'IDLE';
                
                // Force chunk update
                this.chunkManager.updateEntityChunk(this.player);
                this.renderSystem.setCameraTarget(this.player.position);
                this.chunkManager.update(this.player, 0, this.collisionManager);
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

        if (onProgress) onProgress(95, "Waiting for silicon...");
        await new Promise(r => setTimeout(r, 5000));

        if (onProgress) onProgress(100, "Ready!");
        await new Promise(r => setTimeout(r, 100));

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

    spawnNPCs() {
        console.log("Spawning NPCs...");
        // Spawn Dwarf Salesman in Town (Safe Area)
        // Position him near the center but slightly offset
        const merchant = new DwarfSalesman('merchant-1');
        merchant.position.set(5, 0, 5); // Near spawn
        // Rotate to face South
        merchant.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
        
        this.addEntity(merchant);
        // Note: We don't add him to this.enemies list so he isn't targeted by logic iterating that list
    }

    spawnEnemies() {
        // Spawn Skeletons (Level 1-5 Area: 60-150 radius)
        this.spawnEnemyGroup(Skeleton, 50, 60, 150, 'skeleton');

        // Spawn Imps (Level 5-10 Area: 160-250 radius)
        this.spawnEnemyGroup(Imp, 40, 160, 250, 'imp');

        // Spawn Demon Orcs (Level 10+ Area: 260-350 radius)
        this.spawnEnemyGroup(DemonOrc, 30, 260, 350, 'demon-orc');
    }

    spawnEnemyGroup(EnemyClass, count, minRadius, maxRadius, idPrefix) {
        console.log(`Spawning ${count} ${idPrefix}s...`);
        
        const angleStep = (Math.PI * 2) / count;

        for (let i = 0; i < count; i++) {
            // Distribute angles evenly around the circle
            const baseAngle = i * angleStep;
            
            // Add random jitter to angle (up to 80% of the step) to avoid perfect lines
            const jitter = (Math.random() - 0.5) * angleStep * 0.8;
            const angle = baseAngle + jitter;

            // Random radius within the zone
            const radius = minRadius + Math.random() * (maxRadius - minRadius);
            
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const enemy = new EnemyClass(`${idPrefix}-${i}`);
            enemy.position.set(x, 0, z);
            
            this.addEntity(enemy);
            this.enemies.push(enemy);
        }
    }

    getRandomSpawnPosition(minRadius = 60, maxRadius = 150) {
        const angle = Math.random() * Math.PI * 2;
        const radius = minRadius + Math.random() * (maxRadius - minRadius);
        return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    }

    spawnEliteEnemy() {
        if (!this.player) return;

        console.log("Spawning Elite Enemy!");
        
        // Pick random enemy type
        const types = [Skeleton, Imp, DemonOrc];
        const EnemyClass = types[Math.floor(Math.random() * types.length)];
        
        const elite = new EnemyClass(`elite-${Date.now()}`);
        
        // Spawn near player (20-30 units away)
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 10;
        const x = this.player.position.x + Math.cos(angle) * dist;
        const z = this.player.position.z + Math.sin(angle) * dist;
        
        elite.position.set(x, 0, z);
        
        // Buff Stats
        elite.stats.maxHp *= 3;
        elite.stats.hp = elite.stats.maxHp;
        elite.stats.damage *= 3;
        elite.xpValue *= 5;
        elite.isElite = true;

        // Visual Scale
        elite.onMeshReady = (mesh) => {
            mesh.scale.multiplyScalar(1.5);
            // Add a red tint or glow if possible?
            mesh.traverse(child => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.emissive = new THREE.Color(0xff0000);
                    child.material.emissiveIntensity = 0.5;
                }
            });
        };

        this.addEntity(elite);
        this.enemies.push(elite);
        
        // Notify UI
        // this.uiManager.showNotification("An Elite Enemy has appeared!");
    }

    performRaycast() {
        // Raycast against active entities to find hovered one
        // Use cached active entities
        const meshes = this.activeEntitiesCache
            .filter(e => e.mesh && e.isActive && e !== this.player)
            .map(e => e.mesh);
        
        this.inputManager.raycaster.setFromCamera(this.mousePosition, this.renderSystem.camera);
        const intersects = this.inputManager.raycaster.intersectObjects(meshes, true); // Recursive for child meshes
        
        if (intersects.length > 0) {
            let hitEntities = [];
            for (const hit of intersects) {
                let obj = hit.object;
                while (obj.parent && !obj.userData.entityId) {
                    obj = obj.parent;
                }
                if (obj.userData.entityId) {
                    const entity = this.activeEntitiesCache.find(e => e.id === obj.userData.entityId);
                    if (entity) hitEntities.push(entity);
                }
            }

            // Filter out DEAD entities (unless they are Loot)
            hitEntities = hitEntities.filter(e => e.state !== 'DEAD' || e instanceof LootDrop);

            // Sort: Loot first, then others
            hitEntities.sort((a, b) => {
                if (a instanceof LootDrop && !(b instanceof LootDrop)) return -1;
                if (!(a instanceof LootDrop) && b instanceof LootDrop) return 1;
                return 0;
            });

            if (hitEntities.length > 0) {
                this.hoveredEntity = hitEntities[0];
                
                if (this.hoveredEntity instanceof LootDrop) {
                    document.body.style.cursor = 'grab';
                } else if (this.hoveredEntity && this.hoveredEntity.state !== 'DEAD') {
                    document.body.style.cursor = 'crosshair';
                } else {
                    document.body.style.cursor = 'default';
                }
            } else {
                this.hoveredEntity = null;
                document.body.style.cursor = 'default';
            }
        } else {
            this.hoveredEntity = null;
            document.body.style.cursor = 'default';
        }
    }

    loop(time) {
        try {
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
        } catch (err) {
            console.error("GameEngine Loop Error:", err);
        }
    }

    update(dt) {
        this.frameCount++;

        // Optimization: Cache active entities once per frame
        this.activeEntitiesCache = this.chunkManager.getActiveEntities();

        // Handle Raycast (Throttled)
        this.raycastTimer += dt;
        if (this.needsRaycast && this.raycastTimer > 0.05) { // 20 times per second
             this.performRaycast();
             this.raycastTimer = 0;
             this.needsRaycast = false;
        }

        // Update Game Timer
        this.gameTime += dt;
        this.uiManager.updateTimer(this.gameTime);

        // Check for Elite Spawn
        if (this.gameTime >= this.nextEliteSpawnTime) {
            this.spawnEliteEnemy();
            this.nextEliteSpawnTime += 180; // Next spawn in 3 minutes
        }

        // Update ChunkManager (handles loading/unloading and entity updates)
        if (this.player) {
            // Hold-to-Move / Hold-to-Attack Logic (Desktop)
            if (!this.isMobile && this.inputManager.isMouseDown && !this.uiManager.isEscMenuOpen) {
                
                // 1. Stationary Attack (Control Key)
                if (this.inputManager.keys.control) {
                    // Stop moving
                    this.player.targetPosition = null;
                    this.pendingInteraction = null;
                    this.pendingAbilityTarget = null;

                    // Face Mouse
                    const point = this.inputManager.getGroundIntersection();
                    if (point) {
                        const lookTarget = new THREE.Vector3(point.x, this.player.position.y, point.z);
                        if (this.player.mesh) {
                            this.player.mesh.lookAt(lookTarget);
                            this.player.rotation.copy(this.player.mesh.quaternion);
                        }
                    }

                    // Attack (if not already attacking)
                    if (this.player.state !== 'ATTACKING') {
                        // If hovering enemy, attack it directly (auto-aim)
                        if (this.hoveredEntity && this.hoveredEntity !== this.player && this.hoveredEntity.state !== 'DEAD') {
                            this.player.attack(this.hoveredEntity);
                        } else {
                            // Attack in direction (Ground Attack)
                            // We need to manually trigger attack animation and check for hits
                            this.player.state = 'ATTACKING';
                            this.player.playAnimation('Attack', false);
                            
                            // Delayed Hit Check (Cone)
                            setTimeout(() => {
                                if (this.player.state === 'DEAD') return;
                                
                                // Define Attack Cone/Box
                                const attackRange = 3.0;
                                const attackAngle = Math.PI / 3; // 60 degrees
                                const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.mesh.quaternion);
                                
                                this.chunkManager.getActiveEntities().forEach(entity => {
                                    if (entity !== this.player && entity.isActive && entity.state !== 'DEAD' && entity.stats && entity.stats.hp > 0) {
                                        const dirToEntity = new THREE.Vector3().subVectors(entity.position, this.player.position);
                                        const dist = dirToEntity.length();
                                        
                                        if (dist < attackRange) {
                                            dirToEntity.normalize();
                                            const angle = forward.angleTo(dirToEntity);
                                            if (angle < attackAngle / 2) {
                                                // Hit!
                                                const baseDmg = this.player.stats.damage;
                                                const variance = (Math.random() * 0.4) + 0.8;
                                                const finalDmg = Math.floor(baseDmg * variance);
                                                entity.takeDamage(finalDmg);
                                                if (entity.stats.hp <= 0) {
                                                    this.player.gainXp(entity.xpValue || 10);
                                                    this.handleEnemyDeath(entity);
                                                }
                                            }
                                        }
                                    }
                                });

                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }, 500); // Sync with animation
                        }
                    }
                } 
                // 2. Hold-to-Attack (Hovering Enemy)
                else if (this.hoveredEntity && this.hoveredEntity !== this.player && this.hoveredEntity.state !== 'DEAD') {
                    // If in range, attack
                    const dist = this.player.position.distanceTo(this.hoveredEntity.position);
                    const range = (this.player instanceof Wizard || this.player instanceof Rogue) ? 8.0 : 2.0; // Ranged vs Melee

                    if (dist < range) {
                        this.player.targetPosition = null; // Stop moving
                        this.player.attack(this.hoveredEntity);
                    } else {
                        // Move to range
                        this.player.move(this.hoveredEntity.position);
                    }
                }
                // 3. Hold-to-Move (Ground)
                else {
                    // If we are NOT hovering an entity (or hovering ground), update movement target
                    if (!this.hoveredEntity || this.hoveredEntity === this.player) {
                        const point = this.inputManager.getGroundIntersection();
                        if (point) {
                            this.pendingInteraction = null;
                            this.player.move(point);
                        }
                    }
                }
            }

            this.chunkManager.update(this.player, dt, this.collisionManager);

            // Handle Pending Interaction (Move to Interact)
            if (this.pendingInteraction) {
                // Check if entity is still valid
                if (!this.pendingInteraction.isActive || (this.pendingInteraction.state === 'DEAD' && !(this.pendingInteraction instanceof LootDrop))) {
                    this.pendingInteraction = null;
                } else {
                    // Update target position to follow moving entities
                    if (this.pendingInteraction.position) {
                        this.player.targetPosition = this.pendingInteraction.position.clone();
                    }

                    const dist = this.player.position.distanceTo(this.pendingInteraction.position);
                    let range = 2.5; // Default (Loot)
                    
                    if (this.pendingInteraction instanceof DwarfSalesman) {
                        range = 4.0;
                    } else if (this.pendingInteraction instanceof Actor && this.pendingInteraction !== this.player) {
                        range = 5.0; // Attack Range
                    }

                    if (dist < range) {
                        // Perform Interaction
                        if (this.pendingInteraction instanceof LootDrop) {
                            if (this.player.addToInventory(this.pendingInteraction.item)) {
                                console.log(`Picked up ${this.pendingInteraction.item.name}`);
                                this.uiManager.updateInventory(this.player);
                                
                                // Remove loot entity
                                this.pendingInteraction.isActive = false;
                                this.renderSystem.remove(this.pendingInteraction.mesh);
                                
                                // Remove from ChunkManager
                                const key = this.chunkManager.getChunkKey(this.pendingInteraction.position.x, this.pendingInteraction.position.z);
                                if (this.chunkManager.chunks.has(key)) {
                                    this.chunkManager.chunks.get(key).delete(this.pendingInteraction);
                                }
                            } else {
                                console.log("Inventory full!");
                            }
                        } else if (this.pendingInteraction instanceof DwarfSalesman) {
                            this.uiManager.toggleShop();
                        } else if (this.pendingInteraction instanceof Actor) {
                            this.player.attack(this.pendingInteraction);
                        }

                        // Clear pending interaction and stop moving
                        this.pendingInteraction = null;
                        this.player.targetPosition = null;
                        this.player.state = 'IDLE';
                        this.player.playAnimation('Idle');
                    }
                }
            }

            // Handle Pending Ability (Move to Cast)
            if (this.pendingAbilityTarget) {
                if (!this.pendingAbilityTarget.isActive || this.pendingAbilityTarget.state === 'DEAD') {
                    this.pendingAbilityTarget = null;
                } else {
                    // Update target position
                    this.player.targetPosition = this.pendingAbilityTarget.position.clone();
                    
                    const dist = this.player.position.distanceTo(this.pendingAbilityTarget.position);
                    const range = 8.0; // Generic Ability Range (should be dynamic based on ability)

                    if (dist < range) {
                        this.player.useAbility(this.pendingAbilityTarget.position, this);
                        this.uiManager.updateAbilityIcon(this.player);
                        
                        this.pendingAbilityTarget = null;
                        this.player.targetPosition = null;
                        this.player.state = 'IDLE';
                        this.player.playAnimation('Idle');
                    }
                }
            }
            
            // Player Death & Respawn Logic
            if (this.player.state === 'DEAD') {
                if (this.player.timeSinceDeath === undefined || this.player.timeSinceDeath === null) {
                    this.player.timeSinceDeath = 0;
                }
                this.player.timeSinceDeath += dt;
                
                if (this.player.timeSinceDeath > 3.0) { // Respawn after 3 seconds
                    console.log("Player respawning in town...");
                    this.player.respawn(0, 0); // Respawn at Town Center (0,0)
                    this.player.timeSinceDeath = null; // Reset timer
                    
                    // Force chunk update
                    this.chunkManager.updateEntityChunk(this.player);

                    // Reset Camera
                    this.renderSystem.setCameraTarget(this.player.position);
                    
                    // Force chunk update to ensure town is loaded
                    this.chunkManager.update(this.player, 0, this.collisionManager);
                }
            } else {
                // Reset timer when alive
                this.player.timeSinceDeath = null;
            }

            // Cleric Spirit Damage Logic
            if (this.player instanceof Fighter && this.player.isCharging) {
                // Optimization: Use cached active entities
                this.activeEntitiesCache.forEach(enemy => {
                    if (enemy.state !== 'DEAD' && enemy.isActive && enemy !== this.player) {
                        const dist = this.player.position.distanceTo(enemy.position);
                        const hitRadius = (this.player.radius || 0.5) + (enemy.radius || 0.5);
                        if (dist < hitRadius) { // Hit radius
                            // Damage Calculation: Base 10 + (Strength * 1.5)
                            const dmg = 10 + (this.player.stats.strength * 1.5);
                            enemy.takeDamage(Math.floor(dmg));
                            
                            if (enemy.stats.hp <= 0) {
                                this.handleEnemyDeath(enemy);
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
                // Optimization: Use cached active entities
                this.activeEntitiesCache.forEach(enemy => {
                    if (enemy.state !== 'DEAD' && enemy.isActive && enemy !== this.player) {
                        const dist = this.player.position.distanceTo(enemy.position);
                        if (dist < 8.0) { // Spirit radius (Increased to 8.0)
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
                                    this.handleEnemyDeath(enemy);
                                }
                                // Reset handled after loop
                            }
                        }
                    }
                });
                if (this.player.spiritTick > 0.5) this.player.spiritTick = 0;
            }
        }

        // Camera Handling
        if (this.player) {
            // Mobile Joystick Movement
            if (this.isMobile) {
                const moveDir = this.inputManager.getMovementDirection();
                if (moveDir.lengthSq() > 0) {
                    // Move player directly
                    const speed = this.player.stats.speed;
                    const moveVec = moveDir.multiplyScalar(speed * dt);
                    
                    // Simple collision check (very basic)
                    const nextPos = this.player.position.clone().add(moveVec);
                    
                    // Update Player Position
                    this.player.position.copy(nextPos);
                    this.player.state = 'MOVING';
                    this.player.playAnimation('Run'); // Always run with joystick
                    
                    // Rotate player to face movement
                    const lookTarget = this.player.position.clone().add(moveDir);
                    this.player.mesh.lookAt(lookTarget);
                    
                    // Cancel any target position (click-to-move)
                    this.player.targetPosition = null;
                } else {
                    if (this.player.state === 'MOVING' && !this.player.targetPosition) {
                        this.player.state = 'IDLE';
                        this.player.playAnimation('Idle');
                    }
                }
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
        // Optimization: Run less frequently (every 10 frames)
        if (this.frameCount % 10 === 0) {
            this.enemies.forEach(enemy => {
                if (enemy.state === 'DEAD') {
                    if (typeof enemy.timeSinceDeath !== 'number') enemy.timeSinceDeath = 0;
                    enemy.timeSinceDeath += dt * 10; // Compensate for 10x slower update

                    // Hide body after 2 seconds (allow animation to finish)
                    if (enemy.timeSinceDeath > 2 && enemy.mesh && enemy.mesh.visible) {
                        enemy.mesh.visible = false;
                    }

                    // Respawn after 5 seconds
                    if (enemy.timeSinceDeath > 5) {
                        enemy.timeSinceDeath = 0; // Reset timer
                        
                        let minR = 60, maxR = 150;
                        if (enemy instanceof Imp) {
                            minR = 160; maxR = 250;
                        } else if (enemy instanceof DemonOrc) {
                            minR = 260; maxR = 350;
                        }
                        const pos = this.getRandomSpawnPosition(minR, maxR);
                        
                        // We need to update ChunkManager because it might move to a new chunk
                        // Remove from old chunk
                        const oldKey = this.chunkManager.getChunkKey(enemy.position.x, enemy.position.z);
                        if (this.chunkManager.chunks.has(oldKey)) {
                            this.chunkManager.chunks.get(oldKey).delete(enemy);
                        }

                        // Respawn (updates position)
                        enemy.mesh.visible = true;
                        enemy.respawn(pos.x, pos.z);
                        enemy.deathHandled = false;

                        // Add to new chunk
                        this.chunkManager.addEntity(enemy);
                    }
                }
            });
        }

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
            // Optimization: Use cached active entities
            for (const enemy of this.activeEntitiesCache) {
                if (enemy.state !== 'DEAD' && enemy.isActive && enemy !== this.player) {
                    // Skip if already hit (for piercing projectiles)
                    if (p.hitEntities.has(enemy.id)) continue;

                    const dist = p.position.distanceTo(enemy.position);
                    const hitRadius = p.radius + (enemy.radius || 0.5);
                    
                    if (dist < hitRadius) { // Projectile radius + Enemy radius
                        // Register hit
                        p.hitEntities.add(enemy.id);

                        // Deal Damage
                        enemy.takeDamage(Math.floor(p.damage));
                        if (enemy.stats.hp <= 0) {
                            this.handleEnemyDeath(enemy);
                        }

                        // Special Effects
                        if (p.type === 'Fireball') {
                            // Splash Damage (20% to nearby enemies)
                            const splashRadius = 5.0;
                            // Optimization: Use cached active entities for splash
                            this.activeEntitiesCache.forEach(nearbyEnemy => {
                                if (nearbyEnemy !== enemy && nearbyEnemy.state !== 'DEAD' && nearbyEnemy.isActive && nearbyEnemy !== this.player) {
                                    if (nearbyEnemy.position.distanceTo(enemy.position) < splashRadius) {
                                        const splashDmg = Math.floor(p.damage * 0.2);
                                        nearbyEnemy.takeDamage(splashDmg);
                                        if (nearbyEnemy.stats.hp <= 0) {
                                            this.handleEnemyDeath(nearbyEnemy);
                                        }
                                    }
                                }
                            });
                            
                            // Fireball explodes on first contact
                            p.isActive = false;
                            this.renderSystem.remove(p.mesh);
                            this.projectiles.splice(i, 1);
                            break; // Stop checking enemies for this projectile
                        } else if (p.type === 'Dagger') {
                            // Dagger pierces, so we DON'T destroy it immediately
                            // It continues to travel and hit other enemies
                            // But we need to make sure we don't hit the same enemy twice (handled by hitEntities)
                        } else {
                            // Default behavior: destroy on hit
                            p.isActive = false;
                            this.renderSystem.remove(p.mesh);
                            this.projectiles.splice(i, 1);
                            break;
                        }
                    }
                }
            }
        }
    }

    handleEnemyDeath(enemy) {
        if (enemy.deathHandled) return; // Already handled
        enemy.deathHandled = true;
        
        this.player.gainXp(enemy.xpValue);
        
        // Gold Drop (1-200 range, scaled by level)
        // Base: 1-20. Max at level 10: 10-200.
        const minGold = Math.max(1, enemy.level);
        const maxGold = Math.max(20, enemy.level * 20);
        const goldAmount = Math.floor(minGold + Math.random() * (maxGold - minGold));
        
        this.player.gold += goldAmount;
        console.log(`Gained ${goldAmount} gold. Total: ${this.player.gold}`);
        // Ideally show floating text for gold too
        
        // Loot Drop Logic
        let shouldDrop = false;
        let item = null;

        if (enemy.isElite) {
            // Guaranteed Elite Drop
            shouldDrop = true;
            item = ItemGenerator.generateEliteLoot(enemy.level);
            console.log(`Elite Loot Dropped: ${item.name}`);
        } else if (Math.random() < 0.3) {
            // Standard Drop Chance (30%)
            shouldDrop = true;
            let maxLevel = 1;
            if (enemy instanceof Skeleton) maxLevel = 5;
            else if (enemy instanceof Imp) maxLevel = 10;
            else if (enemy instanceof DemonOrc) maxLevel = 20;

            item = ItemGenerator.generateLoot(maxLevel);
        }

        if (shouldDrop && item) {
            console.log(`Loot Dropped: ${item.name}`);
            
            // Spawn LootDrop entity
            const dropX = enemy.position.x + (Math.random() - 0.5) * 1.0;
            const dropZ = enemy.position.z + (Math.random() - 0.5) * 1.0;
            
            const loot = new LootDrop(item, dropX, dropZ);
            this.addEntity(loot);
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