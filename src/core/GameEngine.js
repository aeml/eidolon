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
import { Construct } from '../entities/Construct.js';
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
            this.cameraLocked = true;
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
        this.enemies = [];
        this.projectiles = [];
        this.cameraLocked = true;
        this.pendingInteraction = null;
        this.pendingAbilityTarget = null;
        
        this.lastTime = 0;
        this.accumulator = 0;
        this.fixedTimeStep = 1 / 60;

        this.gameTime = 0;
        this.nextEliteSpawnTime = 180;

        this.raycastTimer = 0;
        this.mousePosition = new THREE.Vector2();
        this.needsRaycast = false;
        this.activeEntitiesCache = [];
        this.frameCount = 0;
    }

    async loadGame(onProgress) {
        console.error(`Initializing GameEngine with player type: ${this.playerType}`);
        
        if (onProgress) onProgress(10, "Creating Player...");
        await new Promise(r => setTimeout(r, 50));

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
        
        if (onProgress) onProgress(30, "Initializing UI...");
        await new Promise(r => setTimeout(r, 50));

        this.uiManager.showHUD();

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

        this.uiManager.onRespawn = () => {
            if (this.player) {
                console.log("Player requested respawn/unstuck.");
                this.player.respawn(0, 0);
                this.player.timeSinceDeath = null;
                this.chunkManager.updateEntityChunk(this.player);
                this.renderSystem.setCameraTarget(this.player.position);
                this.chunkManager.update(this.player, 0, this.collisionManager);
            }
        };

        if (onProgress) onProgress(50, "Generating World...");
        await new Promise(r => setTimeout(r, 50));

        console.log("GameEngine: Forcing initial chunk update");
        this.chunkManager.update(this.player, 0, this.collisionManager);

        this.worldGenerator.createTown(0, 0, 100);

        this.spawnNPCs();

        if (onProgress) onProgress(70, "Spawning Enemies...");
        await new Promise(r => setTimeout(r, 50));

        this.spawnEnemies();

        if (onProgress) onProgress(90, "Setting up Controls...");
        await new Promise(r => setTimeout(r, 50));

        this.inputManager.subscribe('onClick', () => {
            if (!this.player) return;
            if (this.uiManager.isEscMenuOpen || this.uiManager.isPatchNotesOpen) return;

            if (this.isMobile) {
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
                    this.player.playAnimation('Attack', false);
                }
                return;
            }

            if (this.hoveredEntity && this.hoveredEntity !== this.player) {
                this.pendingInteraction = this.hoveredEntity;
                this.pendingAbilityTarget = null;
                this.player.move(this.hoveredEntity.position);
            } else {
                const point = this.inputManager.getGroundIntersection();
                if (point) {
                    this.pendingInteraction = null;
                    this.pendingAbilityTarget = null;
                    this.player.move(point);
                }
            }
        });

        this.inputManager.subscribe('onRightClick', () => {
            if (!this.player) return;
            if (this.uiManager.isEscMenuOpen || this.uiManager.isPatchNotesOpen) return;
            
            if (this.isMobile) {
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
                    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.mesh.quaternion);
                    const target = this.player.position.clone().add(forward.multiplyScalar(5));
                    this.player.useAbility(target, this);
                    this.uiManager.updateAbilityIcon(this.player);
                }
                return;
            }

            if (this.hoveredEntity && this.hoveredEntity !== this.player && this.hoveredEntity.state !== 'DEAD') {
                if (this.player instanceof Wizard || this.player instanceof Rogue || this.player instanceof Fighter) {
                    this.pendingAbilityTarget = null;
                    this.pendingInteraction = null;
                    this.player.useAbility(this.hoveredEntity.position, this);
                    this.uiManager.updateAbilityIcon(this.player);
                    
                    this.player.targetPosition = null;
                    if (this.player.state !== 'ATTACKING') {
                        this.player.state = 'IDLE';
                        this.player.playAnimation('Idle');
                    }
                } else {
                    this.pendingAbilityTarget = this.hoveredEntity;
                    this.pendingInteraction = null;
                    this.player.move(this.hoveredEntity.position);
                }
            } else {
                const targetPoint = this.inputManager.getGroundIntersection();
                if (targetPoint) {
                    this.pendingAbilityTarget = null;
                    this.pendingInteraction = null;
                    this.player.useAbility(targetPoint, this);
                    this.uiManager.updateAbilityIcon(this.player);
                }
            }
        });

        this.inputManager.subscribe('onMouseMove', (mouse) => {
            this.mousePosition.copy(mouse);
            this.needsRaycast = true;
        });

        this.inputManager.subscribe('onZoom', (delta) => {
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
                if (this.player.addToInventory(nearestLoot.item)) {
                    console.log(`Picked up ${nearestLoot.item.name}`);
                    this.uiManager.updateInventory(this.player);
                    nearestLoot.isActive = false;
                    this.renderSystem.remove(nearestLoot.mesh);
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
                this.player.targetPosition = null;
                this.player.state = 'IDLE';
                
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
        await new Promise(r => setTimeout(r, 1000));

        if (onProgress) onProgress(100, "Ready!");
        await new Promise(r => setTimeout(r, 100));

        this.loop(0);
    }

    addEntity(entity) {
        this.chunkManager.addEntity(entity);
        
        if (!entity.mesh) {
            const originalOnMeshReady = entity.onMeshReady;
            entity.onMeshReady = (mesh) => {
                console.log(`GameEngine: Mesh ready for ${entity.id}`);
                if (originalOnMeshReady) originalOnMeshReady(mesh);
                
                const key = this.chunkManager.getChunkKey(entity.position.x, entity.position.z);
                if (this.chunkManager.activeChunkKeys.has(key) || entity.type === 'DwarfSalesman') {
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
        const merchant = new DwarfSalesman('merchant-1');
        merchant.position.set(5, 0, 5);
        merchant.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
        
        this.addEntity(merchant);
    }

    spawnEnemies() {
        this.spawnEnemyGroup(Skeleton, 50, 60, 150, 'skeleton');
        this.spawnEnemyGroup(Imp, 50, 160, 250, 'imp');
        this.spawnEnemyGroup(DemonOrc, 50, 260, 350, 'demon-orc');
        this.spawnEnemyGroup(Construct, 50, 360, 450, 'construct');
    }

    spawnEnemyGroup(EnemyClass, count, minRadius, maxRadius, idPrefix) {
        console.log(`Spawning ${count} ${idPrefix}s...`);
        
        const angleStep = (Math.PI * 2) / count;

        for (let i = 0; i < count; i++) {
            const baseAngle = i * angleStep;
            
            const jitter = (Math.random() - 0.5) * angleStep * 0.8;
            const angle = baseAngle + jitter;

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
        
        const types = [Skeleton, Imp, DemonOrc];
        const EnemyClass = types[Math.floor(Math.random() * types.length)];
        
        const elite = new EnemyClass(`elite-${Date.now()}`);
        
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 10;
        const x = this.player.position.x + Math.cos(angle) * dist;
        const z = this.player.position.z + Math.sin(angle) * dist;
        
        elite.position.set(x, 0, z);
        
        elite.stats.maxHp *= 3;
        elite.stats.hp = elite.stats.maxHp;
        elite.stats.damage *= 3;
        elite.xpValue *= 5;
        elite.isElite = true;

        elite.modifyMesh = (mesh) => {
            if (!mesh) return;
            mesh.scale.multiplyScalar(1.5);
            
            // Temporarily disabled material cloning to prevent crashes on specific models (Imp)
            // The scaling is sufficient to identify Elites for now.
            /*
            mesh.traverse(child => {
                if (child.isMesh) {
                    if (Array.isArray(child.material)) {
                        child.material = child.material.map(m => {
                            if (m.userData?.isEliteClone) return m;
                            const clone = m.clone();
                            clone.userData = { isEliteClone: true };
                            clone.emissive = new THREE.Color(0xff0000);
                            clone.emissiveIntensity = 0.5;
                            return clone;
                        });
                    } else if (child.material) {
                        if (!child.material.userData?.isEliteClone) {
                            try {
                                child.material = child.material.clone();
                                child.material.userData = { isEliteClone: true };
                                child.material.emissive = new THREE.Color(0xff0000);
                                child.material.emissiveIntensity = 0.5;
                            } catch (e) {
                                console.warn("Failed to clone material for Elite:", e);
                            }
                        }
                    }
                }
            });
            */
        };

        this.addEntity(elite);
        this.enemies.push(elite);
    }

    performRaycast() {
        const meshes = this.activeEntitiesCache
            .filter(e => e.mesh && e.isActive && e !== this.player)
            .map(e => e.mesh);
        
        this.inputManager.raycaster.setFromCamera(this.mousePosition, this.renderSystem.camera);
        const intersects = this.inputManager.raycaster.intersectObjects(meshes, true);
        
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

            hitEntities = hitEntities.filter(e => e.state !== 'DEAD' || e instanceof LootDrop);

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
            const dt = Math.min(seconds - this.lastTime, 0.1);
            this.lastTime = seconds;
            
            this.accumulator += dt;
    
            while (this.accumulator >= this.fixedTimeStep) {
                this.update(this.fixedTimeStep);
                this.accumulator -= this.fixedTimeStep;
            }
    
            const alpha = this.accumulator / this.fixedTimeStep;
            this.render(alpha);
    
            requestAnimationFrame((t) => this.loop(t));
        } catch (err) {
            console.error("GameEngine Loop Error:", err);
        }
    }

    update(dt) {
        this.frameCount++;

        this.activeEntitiesCache = this.chunkManager.getActiveEntities();

        this.raycastTimer += dt;
        if (this.needsRaycast && this.raycastTimer > 0.05) {
             this.performRaycast();
             this.raycastTimer = 0;
             this.needsRaycast = false;
        }

        this.gameTime += dt;
        this.uiManager.updateTimer(this.gameTime);

        if (this.gameTime >= this.nextEliteSpawnTime) {
            try {
                this.spawnEliteEnemy();
            } catch (e) {
                console.error("Failed to spawn Elite Enemy:", e);
            }
            this.nextEliteSpawnTime += 180;
        }

        if (this.player) {
            if (!this.isMobile && this.inputManager.isMouseDown && !this.uiManager.isEscMenuOpen) {
                
                if (this.inputManager.keys.control) {
                    this.player.targetPosition = null;
                    this.pendingInteraction = null;
                    this.pendingAbilityTarget = null;

                    let lookTarget = null;
                    if (this.hoveredEntity && this.hoveredEntity instanceof Actor && this.hoveredEntity !== this.player) {
                        lookTarget = new THREE.Vector3(this.hoveredEntity.position.x, this.player.position.y, this.hoveredEntity.position.z);
                    } else {
                        const point = this.inputManager.getGroundIntersection();
                        if (point) {
                            lookTarget = new THREE.Vector3(point.x, this.player.position.y, point.z);
                        }
                    }

                    if (lookTarget && this.player.mesh) {
                        this.player.mesh.lookAt(lookTarget);
                        this.player.rotation.copy(this.player.mesh.quaternion);
                    }

                    if (this.player.state !== 'ATTACKING') {
                        this.player.state = 'ATTACKING';
                        this.player.playAnimation('Attack', false);
                        
                        setTimeout(() => {
                            if (this.player.state === 'DEAD') return;
                            
                            const attackRange = 3.0;
                            const attackAngle = Math.PI / 3;
                            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.mesh.quaternion);
                            
                            this.chunkManager.getActiveEntities().forEach(entity => {
                                if (entity !== this.player && entity.isActive && entity.state !== 'DEAD' && entity.stats && entity.stats.hp > 0) {
                                    const dirToEntity = new THREE.Vector3().subVectors(entity.position, this.player.position);
                                    const dist = dirToEntity.length();
                                    
                                    if (dist < attackRange) {
                                        dirToEntity.normalize();
                                        const angle = forward.angleTo(dirToEntity);
                                        if (angle < attackAngle / 2) {
                                            const baseDmg = this.player.stats.damage;
                                            const variance = (Math.random() * 0.4) + 0.8;
                                            const finalDmg = Math.floor(baseDmg * variance);
                                            entity.takeDamage(finalDmg);
                                            if (entity.stats.hp <= 0) {
                                                this.handleEnemyDeath(entity);
                                            }
                                        }
                                    }
                                }
                            });

                            this.player.state = 'IDLE';
                            this.player.playAnimation('Idle');
                        }, 500);
                    }
                } 
                else if (this.hoveredEntity && this.hoveredEntity instanceof Actor && this.hoveredEntity !== this.player && this.hoveredEntity.state !== 'DEAD') {
                    const dist = this.player.position.distanceTo(this.hoveredEntity.position);
                    const range = (this.player instanceof Wizard || this.player instanceof Rogue) ? 8.0 : 2.0;

                    if (dist < range) {
                        this.player.targetPosition = null;
                        this.player.attack(this.hoveredEntity);
                    } else {
                        this.player.move(this.hoveredEntity.position);
                    }
                }
                else {
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

            if (this.pendingInteraction) {
                if (!this.pendingInteraction.isActive || (this.pendingInteraction.state === 'DEAD' && !(this.pendingInteraction instanceof LootDrop))) {
                    this.pendingInteraction = null;
                } else {
                    if (this.pendingInteraction.position) {
                        this.player.targetPosition = this.pendingInteraction.position.clone();
                    }

                    const dist = this.player.position.distanceTo(this.pendingInteraction.position);
                    let range = 2.5;
                    
                    if (this.pendingInteraction instanceof DwarfSalesman) {
                        range = 4.0;
                    } else if (this.pendingInteraction instanceof Actor && this.pendingInteraction !== this.player) {
                        range = 5.0;
                    }

                    if (dist < range) {
                        if (this.pendingInteraction instanceof LootDrop) {
                            if (this.player.addToInventory(this.pendingInteraction.item)) {
                                console.log(`Picked up ${this.pendingInteraction.item.name}`);
                                this.uiManager.updateInventory(this.player);
                                
                                this.pendingInteraction.isActive = false;
                                this.renderSystem.remove(this.pendingInteraction.mesh);
                                
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

                        this.pendingInteraction = null;
                        this.player.targetPosition = null;
                        this.player.state = 'IDLE';
                        this.player.playAnimation('Idle');
                    }
                }
            }

            if (this.pendingAbilityTarget) {
                if (!this.pendingAbilityTarget.isActive || this.pendingAbilityTarget.state === 'DEAD') {
                    this.pendingAbilityTarget = null;
                } else {
                    this.player.targetPosition = this.pendingAbilityTarget.position.clone();
                    
                    const dist = this.player.position.distanceTo(this.pendingAbilityTarget.position);
                    const range = 8.0;

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
            
            if (this.player.state === 'DEAD') {
                if (this.player.timeSinceDeath === undefined || this.player.timeSinceDeath === null) {
                    this.player.timeSinceDeath = 0;
                }
                this.player.timeSinceDeath += dt;
                
                if (this.player.timeSinceDeath > 3.0) {
                    console.log("Player respawning in town...");
                    this.player.respawn(0, 0);
                    this.player.timeSinceDeath = null;
                    
                    this.chunkManager.updateEntityChunk(this.player);

                    this.renderSystem.setCameraTarget(this.player.position);
                    
                    this.chunkManager.update(this.player, 0, this.collisionManager);
                }
            } else {
                this.player.timeSinceDeath = null;
            }

            if (this.player instanceof Fighter && this.player.isCharging) {
                this.activeEntitiesCache.forEach(enemy => {
                    if (enemy instanceof Actor && enemy.state !== 'DEAD' && enemy.isActive && enemy !== this.player) {
                        const dist = this.player.position.distanceTo(enemy.position);
                        const hitRadius = (this.player.radius || 0.5) + (enemy.radius || 0.5);
                        if (dist < hitRadius) {
                            const dmg = 10 + (this.player.stats.strength * 1.5);
                            enemy.takeDamage(Math.floor(dmg));
                            
                            if (enemy.stats.hp <= 0) {
                                this.handleEnemyDeath(enemy);
                            }

                            this.player.isCharging = false;
                            this.player.state = 'IDLE';
                            this.player.playAnimation('Idle');
                        }
                    }
                });
            }

            if (this.player instanceof Cleric && this.player.spiritsActive) {
                this.activeEntitiesCache.forEach(enemy => {
                    if (enemy instanceof Actor && enemy.state !== 'DEAD' && enemy.isActive && enemy !== this.player) {
                        const dist = this.player.position.distanceTo(enemy.position);
                        if (dist < 8.0) {
                            if (!this.player.spiritTick) this.player.spiritTick = 0;
                            this.player.spiritTick += dt;
                            if (this.player.spiritTick > 0.5) {
                                const dmg = 10 + (this.player.stats.wisdom * 1.0);
                                enemy.takeDamage(Math.floor(dmg));
                                
                                if (enemy.stats.hp <= 0) {
                                    this.handleEnemyDeath(enemy);
                                }
                            }
                        }
                    }
                });
                if (this.player.spiritTick > 0.5) this.player.spiritTick = 0;
            }
        }

        if (this.player) {
            if (this.isMobile) {
                const moveDir = this.inputManager.getMovementDirection();
                if (moveDir.lengthSq() > 0) {
                    const speed = this.player.stats.speed;
                    const moveVec = moveDir.multiplyScalar(speed * dt);
                    
                    const nextPos = this.player.position.clone().add(moveVec);
                    
                    if (this.collisionManager) {
                        const correctedPos = this.collisionManager.checkCollision(nextPos, 0.5);
                        if (correctedPos) {
                            this.player.position.copy(correctedPos);
                        } else {
                            this.player.position.copy(nextPos);
                        }
                    } else {
                        this.player.position.copy(nextPos);
                    }
                    
                    this.player.state = 'MOVING';
                    this.player.playAnimation('Run');
                    
                    const lookTarget = this.player.position.clone().add(moveDir);
                    if (this.player.mesh) {
                        this.player.mesh.lookAt(lookTarget);
                        this.player.rotation.copy(this.player.mesh.quaternion);
                    }
                    
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
                const panSpeed = 30;
                const keys = this.inputManager.keys;
                let dx = 0;
                let dz = 0;

                if (keys.w) { dx -= 1; dz -= 1; }
                if (keys.s) { dx += 1; dz += 1; }
                if (keys.a) { dx -= 1; dz += 1; }
                if (keys.d) { dx += 1; dz -= 1; }

                const currentTarget = this.renderSystem.cameraTarget.clone();

                if (dx !== 0 || dz !== 0) {
                    const length = Math.sqrt(dx*dx + dz*dz);
                    dx /= length;
                    dz /= length;
                    
                    currentTarget.x += dx * panSpeed * dt;
                    currentTarget.z += dz * panSpeed * dt;
                }

                const maxDist = 50; 
                const dist = currentTarget.distanceTo(this.player.position);
                
                if (dist > maxDist) {
                    const dir = new THREE.Vector3().subVectors(currentTarget, this.player.position).normalize();
                    currentTarget.copy(this.player.position).add(dir.multiplyScalar(maxDist));
                }
                
                this.renderSystem.setCameraTarget(currentTarget);
            }
        }

        this.activeEntitiesCache.forEach(enemy => {
            if (enemy instanceof Actor && enemy.state === 'DEAD' && !enemy.deathHandled && enemy !== this.player) {
                this.handleEnemyDeath(enemy);
            }
        });

        if (this.frameCount % 10 === 0) {
            this.enemies.forEach(enemy => {
                if (enemy.state === 'DEAD') {
                    if (typeof enemy.timeSinceDeath !== 'number') enemy.timeSinceDeath = 0;
                    enemy.timeSinceDeath += dt * 10;

                    if (enemy.timeSinceDeath > 2 && enemy.mesh && enemy.mesh.visible) {
                        enemy.mesh.visible = false;
                    }

                    if (enemy.timeSinceDeath > 5) {
                        enemy.timeSinceDeath = 0;
                        
                        let minR = 60, maxR = 150;
                        if (enemy instanceof Imp) {
                            minR = 160; maxR = 250;
                        } else if (enemy instanceof DemonOrc) {
                            minR = 260; maxR = 350;
                        } else if (enemy instanceof Construct) {
                            minR = 360; maxR = 450;
                        }
                        const pos = this.getRandomSpawnPosition(minR, maxR);
                        
                        const oldKey = this.chunkManager.getChunkKey(enemy.position.x, enemy.position.z);
                        if (this.chunkManager.chunks.has(oldKey)) {
                            this.chunkManager.chunks.get(oldKey).delete(enemy);
                        }

                        if (enemy.mesh) enemy.mesh.visible = true;
                        enemy.respawn(pos.x, pos.z);
                        enemy.deathHandled = false;

                        this.chunkManager.addEntity(enemy);
                    }
                }
            });
        }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt);
            
            if (!p.isActive) {
                this.renderSystem.remove(p.mesh);
                this.projectiles.splice(i, 1);
                continue;
            }

            for (const enemy of this.activeEntitiesCache) {
                if (enemy instanceof Actor && enemy.state !== 'DEAD' && enemy.isActive && enemy !== this.player) {
                    if (p.hitEntities.has(enemy.id)) continue;

                    const dist = p.position.distanceTo(enemy.position);
                    const hitRadius = p.radius + (enemy.radius || 0.5);
                    
                    if (dist < hitRadius) {
                        p.hitEntities.add(enemy.id);

                        enemy.takeDamage(Math.floor(p.damage));
                        if (enemy.stats.hp <= 0) {
                            this.handleEnemyDeath(enemy);
                        }

                        if (p.type === 'Fireball') {
                            const splashRadius = 10.0;
                            this.activeEntitiesCache.forEach(nearbyEnemy => {
                                if (nearbyEnemy instanceof Actor && nearbyEnemy !== enemy && nearbyEnemy.state !== 'DEAD' && nearbyEnemy.isActive && nearbyEnemy !== this.player) {
                                    if (nearbyEnemy.position.distanceTo(enemy.position) < splashRadius) {
                                        const splashDmg = Math.floor(p.damage * 0.4);
                                        nearbyEnemy.takeDamage(splashDmg);
                                        if (nearbyEnemy.stats.hp <= 0) {
                                            this.handleEnemyDeath(nearbyEnemy);
                                        }
                                    }
                                }
                            });
                            
                            p.isActive = false;
                            this.renderSystem.remove(p.mesh);
                            this.projectiles.splice(i, 1);
                            break;
                        } else if (p.type === 'Dagger') {
                        } else {
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
        if (enemy.deathHandled) return;
        enemy.deathHandled = true;
        
        this.player.gainXp(enemy.xpValue);
        
        const minGold = Math.max(1, Math.floor(enemy.level * 1.5));
        const maxGold = Math.max(30, enemy.level * 30);
        const goldAmount = Math.floor(minGold + Math.random() * (maxGold - minGold));
        
        this.player.gold += goldAmount;
        console.log(`Gained ${goldAmount} gold. Total: ${this.player.gold}`);
        
        let shouldDrop = false;
        let item = null;

        if (enemy.isElite) {
            shouldDrop = true;
            item = ItemGenerator.generateEliteLoot(enemy.level);
            console.log(`Elite Loot Dropped: ${item.name}`);
        } else if (Math.random() < 0.5) {
            shouldDrop = true;
            let maxLevel = 1;
            if (enemy instanceof Skeleton) maxLevel = 5;
            else if (enemy instanceof Imp) maxLevel = 10;
            else if (enemy instanceof DemonOrc) maxLevel = 20;
            else if (enemy instanceof Construct) maxLevel = 30;

            item = ItemGenerator.generateLoot(maxLevel);
        }

        if (shouldDrop && item) {
            console.log(`Loot Dropped: ${item.name}`);
            
            const dropX = enemy.position.x + (Math.random() - 0.5) * 1.0;
            const dropZ = enemy.position.z + (Math.random() - 0.5) * 1.0;
            
            const loot = new LootDrop(item, dropX, dropZ);
            this.addEntity(loot);
        }
    }

    render(alpha) {
        const activeEntities = this.chunkManager.getActiveEntities();
        activeEntities.forEach(entity => {
            if (entity.isActive) {
                entity.render(alpha);
            }
        });
        
        this.renderSystem.render();
        
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