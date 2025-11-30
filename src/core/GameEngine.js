import * as THREE from 'three';
import { RenderSystem } from './RenderSystem.js';
import { InputManager } from './InputManager.js';
import { ChunkManager } from './ChunkManager.js';
import { CollisionManager } from './CollisionManager.js';
import { RARITY } from './ItemSystem.js';
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
    constructor(playerType, isMobile = false, isMultiplayer = true, serverAddress = '', username = '', socket = null) {
        this.isMobile = isMobile;
        this.isMultiplayer = true;
        this.serverAddress = serverAddress;
        this.username = username;
        this.socket = socket;
        this.remotePlayers = new Map();
        this.renderSystem = new RenderSystem(isMobile);
        this.inputManager = new InputManager(this.renderSystem.camera, this.renderSystem.scene);
        if (this.isMobile) {
            this.inputManager.setupMobileControls();
            this.cameraLocked = true;
        }

        this.chunkManager = new ChunkManager(this.renderSystem.scene);
        this.collisionManager = new CollisionManager();
        this.uiManager = new UIManager();
        this.uiManager.onBuyGamble = (slot) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                const msg = {
                    type: 'buy_gamble',
                    payload: { slot }
                };
                this.socket.send(JSON.stringify(msg));
            }
        };
        this.uiManager.onSellItem = (index) => {
            const item = this.player.inventory[index];
            if (!item) return;

            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                const msg = {
                    type: 'sell',
                    payload: { 
                        itemId: item.id,
                        slotIndex: index // Optional, but might help debugging
                    }
                };
                this.socket.send(JSON.stringify(msg));
            }
        };
        this.uiManager.onSellAll = (rarityName) => {
            if (!this.player) return;
            
            // Iterate backwards to avoid potential index issues
            for (let i = this.player.inventory.length - 1; i >= 0; i--) {
                const item = this.player.inventory[i];
                if (item && item.rarity && item.rarity.name === rarityName) {
                    this.uiManager.onSellItem(i);
                }
            }
        };
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

        // Entity Creation Throttling
        this.entityCreationQueue = [];
        this.pendingEntityIds = new Set();

        // Network Message Buffering
        this.latestServerState = null;
        this.messageQueue = [];
    }

    async loadGame(onProgress) {
        console.error(`Initializing GameEngine with player type: ${this.playerType}`);
        
        if (onProgress) onProgress(10, "Creating Player...");
        await new Promise(r => setTimeout(r, 50));

        const playerId = this.isMultiplayer && this.username ? `player-${this.username}` : (this.isMultiplayer ? `player-${Math.floor(Math.random() * 1000000)}` : 'player-1');

        switch(this.playerType) {
            case 'Rogue':
                this.player = new Rogue(playerId);
                break;
            case 'Wizard':
                this.player = new Wizard(playerId);
                break;
            case 'Cleric':
                this.player = new Cleric(playerId);
                break;
            default:
                this.player = new Fighter(playerId);
                break;
        }
        
        if (!this.player) {
            console.error("Failed to create player entity!");
            return;
        }

        if (this.username) {
            this.player.setName(this.username);
        }

        // Disable local regen in multiplayer
        this.player.isMultiplayer = true;

        this.addEntity(this.player);

        // Hook equipItem for multiplayer
        // Completely override equipItem to only send message
        this.player.equipItem = (item) => {
            this.sendEquipMessage(item);
            return true; // Assume success, server will correct if not
        };
        
        // Connect to server
        this.uiManager.toggleChat(true);
        this.uiManager.onChatSend = (msg) => {
                // Check socket state directly or try to reconnect?
                // For now, just check state.
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    const chatMsg = {
                        type: "chat",
                        payload: {
                            message: msg,
                            sender: this.username
                        }
                    };
                    this.socket.send(JSON.stringify(chatMsg));
                } else {
                    console.warn("Chat send failed: Socket not open");
                    this.uiManager.addChatMessage("System", "Not connected to server.");
                }
            };
            this.connectToServer();
        
        if (onProgress) onProgress(30, "Initializing UI...");
        await new Promise(r => setTimeout(r, 50));

        this.uiManager.showHUD();

        this.uiManager.onStatUpgrade = (stat) => {
            if (this.player) {
                // Send upgrade request to server
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    const msg = {
                        type: 'upgrade_stat',
                        payload: { stat }
                    };
                    this.socket.send(JSON.stringify(msg));
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

        // In multiplayer, we still need to render the static town
        this.worldGenerator.createTown(0, 0, 100);

        if (onProgress) onProgress(70, "Spawning Enemies...");
        await new Promise(r => setTimeout(r, 50));

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
                // Auto-target nearest enemy for mobile ability
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

                let targetPos = null;
                let targetId = "";

                if (nearest && minDst < 15.0) { // Generous auto-aim range
                    targetPos = nearest.position;
                    targetId = nearest.id;
                } else {
                    // Cast in front of player if no enemy
                    // Assuming player mesh rotation is valid
                    if (this.player.mesh) {
                        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.mesh.quaternion);
                        targetPos = this.player.position.clone().add(forward.multiplyScalar(5));
                    } else {
                        // Fallback
                        targetPos = this.player.position.clone();
                        targetPos.z += 5;
                    }
                }

                const abilityMsg = {
                    type: "ability",
                    payload: {
                        targetX: targetPos.x,
                        targetZ: targetPos.z,
                        targetId: targetId
                    }
                };
                this.socket.send(JSON.stringify(abilityMsg));
                this.player.playAnimation('Attack', false);
                this.player.setAttackingState();
                // Optimistic Cooldown
                this.player.abilityCooldown = this.player.abilityMaxCooldown * (1 - (this.player.stats.cooldownReduction || 0));
                return;
            }

            if (this.hoveredEntity && this.hoveredEntity !== this.player && this.hoveredEntity.state !== 'DEAD') {
                if (this.hoveredEntity instanceof DwarfSalesman) return;

                const dist = this.player.position.distanceTo(this.hoveredEntity.position);
                const abilityRange = 100.0; // Effectively infinite range as requested

                // Check if we are in range
                if (dist <= abilityRange) {
                    // Multiplayer Ability Logic (Targeted)
                    const abilityMsg = {
                        type: "ability",
                        payload: {
                            targetX: this.hoveredEntity.position.x,
                            targetZ: this.hoveredEntity.position.z,
                            targetId: this.hoveredEntity.id
                        }
                    };
                    this.socket.send(JSON.stringify(abilityMsg));
                    this.player.playAnimation('Attack', false);
                    this.player.setAttackingState();
                    // Optimistic Cooldown
                    this.player.abilityCooldown = this.player.abilityMaxCooldown * (1 - (this.player.stats.cooldownReduction || 0));
                } else {
                    // Move closer first
                    this.pendingAbilityTarget = this.hoveredEntity;
                    this.pendingInteraction = null;
                    this.player.move(this.hoveredEntity.position);
                }
            } else {
                // Ground click (Movement or Skillshot)
                const targetPoint = this.inputManager.getGroundIntersection();
                if (targetPoint) {
                    // Multiplayer Ability Logic (Skillshot)
                    const abilityMsg = {
                        type: "ability",
                        payload: {
                            targetX: targetPoint.x,
                            targetZ: targetPoint.z,
                            targetId: ""
                        }
                    };
                    this.socket.send(JSON.stringify(abilityMsg));
                    
                    // Client-side prediction
                    this.player.playAnimation('Attack', false);
                    this.player.setAttackingState();
                    // Optimistic Cooldown
                    this.player.abilityCooldown = this.player.abilityMaxCooldown * (1 - (this.player.stats.cooldownReduction || 0));
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
                this.pickupLoot(nearestLoot.id);
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
            if (this.worldMap) {
                this.worldMap.toggle();
            }
        });

        this.inputManager.subscribe('onChat', () => {
            if (this.isMultiplayer && this.uiManager.chatInput) {
                // Focus chat input if not already focused
                if (document.activeElement !== this.uiManager.chatInput) {
                    this.uiManager.chatInput.focus();
                }
            }
        });

        this.inputManager.subscribe('onCharacter', () => {
            this.uiManager.toggleCharacterSheet();
        });

        this.inputManager.subscribe('onInventory', () => {
            this.uiManager.toggleInventory();
        });


        if (onProgress) onProgress(95, "Waiting for silicon...");
        await new Promise(r => setTimeout(r, 1000));

        if (onProgress) onProgress(100, "Ready!");
        await new Promise(r => setTimeout(r, 100));

        this.connectToServer();

        this.loop(0);
    }

    connectToServer() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            console.log("Reusing existing auth socket connection...");
            this.setupSocketListeners();
            // Send join message immediately
            const joinMsg = {
                type: "join",
                payload: {
                    type: this.playerType
                }
            };
            this.socket.send(JSON.stringify(joinMsg));
            return;
        }

        // If we are here, it means we don't have an open authenticated socket.
        // Since we need to be logged in to join, we cannot just open a new connection.
        console.error("Connection lost or not authenticated. Please refresh and login.");
        alert("Connection lost! Please refresh the page and login again.");
        
        /* 
        // Old logic - removed because it bypasses auth
        console.log(`Connecting to server at ${this.serverAddress}...`);
        this.socket = new WebSocket(this.serverAddress);

        this.socket.onopen = () => {
            console.log("Connected to server!");
            this.setupSocketListeners();
            // Send join message
            const joinMsg = {
                type: "join",
                payload: {
                    type: this.playerType
                }
            };
            this.socket.send(JSON.stringify(joinMsg));
        };
        */
    }

    setupSocketListeners() {
        this.socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'state') {
                    // Only keep the latest state to prevent processing backlog
                    this.latestServerState = msg.payload;
                } else {
                    // Queue other messages (chat, inventory, etc.)
                    this.messageQueue.push(msg);
                }
            } catch (e) {
                console.error("Failed to parse server message:", e);
            }
        };

        this.socket.onclose = () => {
            console.log("Disconnected from server.");
            if (!this.isExpectedDisconnect) {
                alert("Disconnected from server. Returning to menu.");
                window.location.reload();
            }
        };
        
        this.socket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    }

    handleServerMessage(msg) {
        if (msg.type === 'chat') {
            const chatData = msg.payload;
            this.uiManager.addChatMessage(chatData.sender, chatData.message);
        } else if (msg.type === 'time') {
            const timeData = msg.payload;
            // Calculate time since server start or just display server time
            // For now, let's just display the time component
            const date = new Date(timeData.time * 1000);
            const timeString = date.toLocaleTimeString();
            if (this.uiManager.gameTimer) {
                this.uiManager.gameTimer.textContent = timeString;
            }
        } else if (msg.type === 'damage') {
            const dmgData = msg.payload;
            // Show damage number
            // TODO: Add floating text system
            console.log(`Damage: ${dmgData.amount} to ${dmgData.targetId} from ${dmgData.sourceId}`);
            
            // If target is local player, flash screen or shake camera?
            if (this.player && dmgData.targetId === this.player.id) {
                // this.renderSystem.shakeCamera(0.2);
            }
        } else if (msg.type === 'error') {
            console.error("Server Error:", msg.payload);
            alert(`Server Error: ${msg.payload}`);
            if (typeof msg.payload === 'string' && msg.payload.includes("Logged in from another location")) {
                this.isExpectedDisconnect = true;
                window.location.reload();
            }
        } else if (msg.type === 'state') {
            const state = msg.payload;
            const seenIds = new Set();
            
            // Debug log for entity count (throttled)
            if (this.frameCount % 600 === 0) {
                console.log(`Received state with ${Object.keys(state).length} entities`);
            }

            // Update remote players
            Object.values(state).forEach(pData => {
                seenIds.add(pData.id);

                if (pData.id === this.player.id) {
                    // Update local player stats from server
                    if (this.player) {
                        this.player.xp = pData.experience;
                        this.player.xpToNextLevel = pData.maxExperience;
                        this.player.level = pData.level;

                        if (this.player.stats) {
                            this.player.stats.hp = pData.health;
                            this.player.stats.maxHp = pData.maxHealth;
                            this.player.stats.mana = pData.mana;
                            this.player.stats.maxMana = pData.maxMana;

                            // Sync Attributes from Server
                            if (pData.stats) {
                                this.player.stats.strength = pData.stats.strength;
                                this.player.stats.dexterity = pData.stats.dexterity;
                                this.player.stats.intelligence = pData.stats.intelligence;
                                this.player.stats.wisdom = pData.stats.wisdom;
                                this.player.stats.vitality = pData.stats.vitality;
                            }

                            // Sync Derived Stats
                            this.player.stats.damage = pData.damage;
                            this.player.stats.defense = pData.defense;
                            if (pData.speed) this.player.stats.speed = pData.speed;
                            if (pData.attackSpeed) this.player.stats.attackSpeed = pData.attackSpeed;
                            if (pData.cooldownReduction !== undefined) this.player.stats.cooldownReduction = pData.cooldownReduction;
                        }

                        // Sync Equipment
                        if (pData.equipment) {
                            this.player.equipment = pData.equipment;
                            // Hydrate Rarity for UI
                            for (const key in this.player.equipment) {
                                const item = this.player.equipment[key];
                                if (item && typeof item.rarity === 'string') {
                                    for (const rKey in RARITY) {
                                        if (RARITY[rKey].name === item.rarity) {
                                            item.rarity = RARITY[rKey];
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        // Sync Spirits (Cleric)
                        if (this.player instanceof Cleric) {
                            if (pData.spiritsActive !== undefined) {
                                if (pData.spiritsActive && !this.player.spiritsActive) {
                                    this.player.spiritsActive = true;
                                    this.player.createSpirits();
                                } else if (!pData.spiritsActive && this.player.spiritsActive) {
                                    this.player.cancelAbilities();
                                }
                            }
                        }

                        // Optimization: Only update UI if values changed
                        if (this.player.xp !== this.lastXP || this.player.xpToNextLevel !== this.lastMaxXP) {
                            this.uiManager.updateXP(this.player);
                            this.lastXP = this.player.xp;
                            this.lastMaxXP = this.player.xpToNextLevel;
                        }

                        // Check stats change (simple heuristic or deep compare)
                        // We can just check a few key stats or use a dirty flag if we had one
                        // For now, let's just throttle it to once per second or check key values
                        const currentStatsHash = `${this.player.stats.hp}/${this.player.stats.maxHp}/${this.player.stats.mana}/${this.player.stats.strength}`;
                        if (currentStatsHash !== this.lastStatsHash) {
                            this.uiManager.updateCharacterSheet(this.player);
                            this.uiManager.updatePlayerStats(this.player);
                            this.lastStatsHash = currentStatsHash;
                        }
                        
                        // Update Gold
                        if (pData.gold !== undefined && pData.gold !== this.lastGold) {
                            this.player.gold = pData.gold;
                            this.uiManager.updateInventory(this.player);
                            this.lastGold = pData.gold;
                        }
                    }
                    return; // Skip self
                }

                let remoteEntity = this.remotePlayers.get(pData.id);
                if (!remoteEntity) {
                    // Check if already pending creation
                    if (!this.pendingEntityIds.has(pData.id)) {
                        this.pendingEntityIds.add(pData.id);
                        this.entityCreationQueue.push(pData);
                    }
                    // Skip update for now, wait for creation
                    return;
                }
                
                if (remoteEntity) {
                    // Interpolation / Correction
                    if (pData.type === 'Projectile') {
                        remoteEntity.position.set(pData.x, pData.y, pData.z);
                        if (pData.velX !== undefined && pData.velZ !== undefined) {
                            remoteEntity.velocity.set(pData.velX, 0, pData.velZ);
                        }
                    } else {
                        remoteEntity.position.set(pData.x, pData.y, pData.z);
                    }

                    // Sync Name
                    if (pData.name && remoteEntity.name !== pData.name) {
                        remoteEntity.setName(pData.name);
                    }
                    
                    // Handle Spirits (Cleric)
                    if (pData.spiritsActive !== undefined) {
                        if (pData.spiritsActive && !remoteEntity.spiritsActive) {
                            if (remoteEntity instanceof Cleric) {
                                remoteEntity.useAbility(null, this); 
                            }
                        } else if (!pData.spiritsActive && remoteEntity.spiritsActive) {
                            if (remoteEntity instanceof Cleric) {
                                remoteEntity.cancelAbilities();
                            }
                        }
                    }

                    // Handle Death State
                    if (pData.state === 'DEAD') {
                        if (!remoteEntity.isDead) {
                            remoteEntity.isDead = true;
                            remoteEntity.state = 'DEAD';
                            remoteEntity.deadTimer = 0;

                            // Try to play Death animation
                            if (remoteEntity.animations && remoteEntity.animations['Death']) {
                                remoteEntity.playAnimation('Death', false);
                            } else {
                                // Fallback: Lay flat visually
                                const deathRot = new THREE.Quaternion();
                                deathRot.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
                                // Combine with current Y rotation
                                const currentY = new THREE.Quaternion();
                                if (pData.rotation !== undefined) {
                                    currentY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pData.rotation);
                                }
                                remoteEntity.rotation.multiplyQuaternions(deathRot, currentY);
                            }
                        }
                    } else {
                        remoteEntity.isDead = false;
                        remoteEntity.deadTimer = 0;
                        if (remoteEntity.mesh) remoteEntity.mesh.visible = true;
                        
                        // Update State and Animation
                        if (remoteEntity.state !== pData.state || (pData.isCharging !== undefined && remoteEntity.isCharging !== pData.isCharging)) {
                            remoteEntity.state = pData.state;
                            if (pData.isCharging !== undefined) remoteEntity.isCharging = pData.isCharging;

                            if (remoteEntity.playAnimation) {
                                if (remoteEntity.isCharging) {
                                    remoteEntity.playAnimation('Run');
                                } else if (pData.state === 'MOVING') {
                                    remoteEntity.playAnimation('Run');
                                } else if (pData.state === 'ATTACKING') {
                                    remoteEntity.playAnimation('Attack', false);
                                } else {
                                    remoteEntity.playAnimation('Idle');
                                }
                            }
                        }

                        // Update Rotation
                        if (pData.rotation !== undefined) {
                            remoteEntity.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pData.rotation);
                        }
                    }
                }
            });

            // Cleanup removed entities
            for (const [id, entity] of this.remotePlayers) {
                if (!seenIds.has(id)) {
                    entity.isActive = false;
                    if (entity.mesh) {
                        this.renderSystem.remove(entity.mesh);
                    }
                    const key = this.chunkManager.getChunkKey(entity.position.x, entity.position.z);
                    if (this.chunkManager.chunks.has(key)) {
                        this.chunkManager.chunks.get(key).delete(entity);
                    }
                    this.remotePlayers.delete(id);
                }
            }
        } else if (msg.type === 'inventory') {
            const inventory = msg.payload;
            // Hydrate rarity from string to object for UI
            inventory.forEach(item => {
                if (item && typeof item.rarity === 'string') {
                    for (const key in RARITY) {
                        if (RARITY[key].name === item.rarity) {
                            item.rarity = RARITY[key];
                            break;
                        }
                    }
                }
            });

            if (this.player) {
                // Pad with nulls to maintain fixed size
                while (inventory.length < 25) {
                    inventory.push(null);
                }
                this.player.inventory = inventory;
                this.uiManager.updateInventory(this.player);
            }
        }
    }

    pickupLoot(lootId) {
        const msg = {
            type: 'pickup',
            payload: { lootId: lootId }
        };
        this.socket.send(JSON.stringify(msg));
    }

    sendEquipMessage(item) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: 'equip',
            payload: {
                itemId: item.id,
                slot: item.slot
            }
        };
        this.socket.send(JSON.stringify(msg));
    }

    createRemotePlayer(type, id, subType) {
        let p;

        // Fix for merchant appearing as skeleton if type is wrong
        if (subType === 'DwarfSalesman') {
            return new DwarfSalesman(id);
        }

        // If type is NPC, handle it
        if (type === 'NPC') {
            if (subType === 'DwarfSalesman') {
                p = new DwarfSalesman(id);
            } else {
                p = new DwarfSalesman(id); // Default NPC
            }
        } else if (type === 'Enemy') {
            // Handle specific enemy types based on subType
            switch(subType) {
                case 'Skeleton': p = new Skeleton(id); break;
                case 'Imp': p = new Imp(id); break;
                case 'DemonOrc': p = new DemonOrc(id); break;
                case 'Construct': p = new Construct(id); break;
                default: p = new Skeleton(id); break;
            }
        } else {
            // Players - Use subType if available (e.g. "Fighter", "Rogue")
            const classType = subType || type;
            switch(classType) {
                case 'Rogue': p = new Rogue(id); break;
                case 'Wizard': p = new Wizard(id); break;
                case 'Cleric': p = new Cleric(id); break;
                default: p = new Fighter(id); break;
            }
        }
        // Mark as remote to avoid local control logic if any
        p.isRemote = true;
        return p;
    }

    addEntity(entity = null) {
        if (!entity) return;
        
        this.chunkManager.addEntity(entity);
        
        if (!entity.mesh) {
            const originalOnMeshReady = entity.onMeshReady;
            entity.onMeshReady = (mesh) => {
                console.log(`GameEngine: Mesh ready for ${entity.id}`);
                if (originalOnMeshReady) originalOnMeshReady.call(entity, mesh);
                
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
            // Catch-up logic: If we are too far behind (e.g. tab backgrounded), jump ahead
            if (seconds - this.lastTime > 1.0) {
                console.log("GameEngine: Large lag spike detected, skipping simulation catch-up.");
                this.lastTime = seconds;
                this.accumulator = 0;
                // Force a render to update positions from any pending network messages
                this.render(1.0);
                requestAnimationFrame((t) => this.loop(t));
                return;
            }

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

        // Process Network Message Queue
        // 1. Handle critical messages (Chat, Inventory, etc.)
        const maxMessages = 50; // Safety limit
        let msgCount = 0;
        while (this.messageQueue.length > 0 && msgCount < maxMessages) {
            const msg = this.messageQueue.shift();
            this.handleServerMessage(msg);
            msgCount++;
        }

        // 2. Handle latest state update (Coalesced)
        if (this.latestServerState) {
            this.handleServerMessage({ type: 'state', payload: this.latestServerState });
            this.latestServerState = null;
        }

        // Process Entity Creation Queue (Throttle to 5 per frame)
        const creationLimit = 5;
        let createdCount = 0;
        while (this.entityCreationQueue.length > 0 && createdCount < creationLimit) {
            const pData = this.entityCreationQueue.shift();
            this.pendingEntityIds.delete(pData.id);
            
            // Double check if it was already created (race condition)
            if (this.remotePlayers.has(pData.id)) continue;

            let remoteEntity;
            // Pass subType (e.g. "Skeleton", "DwarfSalesman")
            if (pData.type === 'Loot') {
                // Map rarity string to object
                if (typeof pData.lootItem.rarity === 'string') {
                    const rarityKey = pData.lootItem.rarity.toUpperCase();
                    pData.lootItem.rarity = RARITY[rarityKey] || RARITY.COMMON;
                }

                // Create LootDrop
                remoteEntity = new LootDrop(pData.lootItem, pData.x, pData.z, pData.id);
                remoteEntity.id = pData.id;
                // Add click handler for pickup
                remoteEntity.onClick = () => {
                    this.pickupLoot(pData.id);
                };
            } else if (pData.type === 'Projectile') {
                // Create Projectile
                const start = new THREE.Vector3(pData.x, pData.y, pData.z);
                const target = new THREE.Vector3(pData.x + (pData.velX || 1), pData.y, pData.z + (pData.velZ || 0));
                
                const owner = this.remotePlayers.get(pData.ownerId) || (pData.ownerId === this.player.id ? this.player : null);
                const dummyOwner = { stats: { intelligence: 10, dexterity: 10 } };
                
                remoteEntity = new Projectile(pData.id, owner || dummyOwner, pData.subType, start, target);
            } else {
                remoteEntity = this.createRemotePlayer(pData.type || 'Enemy', pData.id, pData.subType); 
                // console.log(`Created remote entity: ${pData.id} (${pData.type}/${pData.subType})`);
            }
            
            if (remoteEntity) {
                // Set initial position immediately
                remoteEntity.position.set(pData.x, pData.y, pData.z);
                this.remotePlayers.set(pData.id, remoteEntity);
                this.addEntity(remoteEntity);
            }
            createdCount++;
        }

        // Remote Entity Corpse Cleanup
        if (this.isMultiplayer) {
            this.remotePlayers.forEach(entity => {
                if (entity.state === 'DEAD') {
                    if (typeof entity.deadTimer !== 'number') entity.deadTimer = 0;
                    entity.deadTimer += dt;
                    
                    // Hide after 2 seconds
                    if (entity.deadTimer > 2.0 && entity.mesh && entity.mesh.visible) {
                        entity.mesh.visible = false;
                    }
                }
            });
        }

        this.activeEntitiesCache = this.chunkManager.getActiveEntities();

        this.raycastTimer += dt;
        if (this.needsRaycast && this.raycastTimer > 0.05) {
             this.performRaycast();
             this.raycastTimer = 0;
             this.needsRaycast = false;
        }

        this.gameTime += dt;
        // Timer updated by server message

        if (this.player) {
            if (!this.isMobile && this.inputManager.isMouseDown && !this.uiManager.isEscMenuOpen && !this.uiManager.isShopOpen) {
                
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
                        // Check Attack Speed Cooldown
                        const now = Date.now();
                        const cooldownMs = (1.0 / this.player.stats.attackSpeed) * 1000;
                        if (now - this.player.lastAttackTime < cooldownMs) {
                            return;
                        }
                        this.player.lastAttackTime = now;

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
                                            
                                            // In multiplayer, we should send an attack event to server
                                            // For now, we only apply damage locally if singleplayer
                                            if (!this.isMultiplayer) {
                                                entity.takeDamage(finalDmg);
                                                if (entity.stats.hp <= 0) {
                                                    this.handleEnemyDeath(entity);
                                                }
                                            }
                                        }
                                    }
                                }
                            });
                        }, 500);
                    }
                } 
                else if (this.hoveredEntity && this.hoveredEntity instanceof Actor && this.hoveredEntity !== this.player && this.hoveredEntity.state !== 'DEAD') {
                    if (this.hoveredEntity instanceof DwarfSalesman) {
                        this.player.move(this.hoveredEntity.position);
                        return;
                    }

                    const dist = this.player.position.distanceTo(this.hoveredEntity.position);
                    const range = (this.player instanceof Wizard || this.player instanceof Rogue) ? 8.0 : 2.0;

                    if (dist < range) {
                        this.player.targetPosition = null;
                        if (this.isMultiplayer) {
                            // Check Attack Speed Cooldown
                            const now = Date.now();
                            const cooldownMs = (1.0 / this.player.stats.attackSpeed) * 1000;
                            if (now - this.player.lastAttackTime < cooldownMs) {
                                return;
                            }
                            this.player.lastAttackTime = now;

                            const attackMsg = {
                                type: "attack",
                                payload: {
                                    targetId: this.hoveredEntity.id
                                }
                            };
                            this.socket.send(JSON.stringify(attackMsg));
                            this.player.playAnimation('Attack', false);
                            this.player.setAttackingState();
                        } else {
                            this.player.attack(this.hoveredEntity);
                        }
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
                            if (this.isMultiplayer && this.pendingInteraction.onClick) {
                                this.pendingInteraction.onClick();
                            } else if (this.player.addToInventory(this.pendingInteraction.item)) {
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
                            if (this.isMultiplayer) {
                                // Check Attack Speed Cooldown
                                const now = Date.now();
                                const cooldownMs = (1.0 / this.player.stats.attackSpeed) * 1000;
                                if (now - this.player.lastAttackTime < cooldownMs) {
                                    return;
                                }
                                this.player.lastAttackTime = now;

                                const attackMsg = {
                                    type: "attack",
                                    payload: {
                                        targetId: this.pendingInteraction.id
                                    }
                                };
                                this.socket.send(JSON.stringify(attackMsg));
                                this.player.playAnimation('Attack', false);
                                this.player.setAttackingState();
                            } else {
                                this.player.attack(this.pendingInteraction);
                            }
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
                    const range = 10.0;

                    if (dist < range) {
                        if (this.isMultiplayer) {
                            const abilityMsg = {
                                type: "ability",
                                payload: {
                                    targetX: this.pendingAbilityTarget.position.x,
                                    targetZ: this.pendingAbilityTarget.position.z,
                                    targetId: this.pendingAbilityTarget.id
                                }
                            };
                            this.socket.send(JSON.stringify(abilityMsg));
                            this.player.playAnimation('Attack', false);
                        } else {
                            this.player.useAbility(this.pendingAbilityTarget.position, this);
                        }
                    }
                }
            }

            if (this.player.state === 'DEAD') {
                if (this.player.timeSinceDeath === undefined || this.player.timeSinceDeath === null) {
                    this.player.timeSinceDeath = 0;
                }
                this.player.timeSinceDeath += dt;
                
                if (!this.isMultiplayer && this.player.timeSinceDeath > 3.0) {
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

        // Network Update
        if (this.isMultiplayer && this.socket && this.socket.readyState === WebSocket.OPEN && this.player) {
            if (this.frameCount % 3 === 0) {
                const euler = new THREE.Euler().setFromQuaternion(this.player.rotation);
                const moveMsg = {
                    type: "move",
                    payload: {
                        x: this.player.position.x,
                        y: this.player.position.y,
                        z: this.player.position.z,
                        rotation: euler.y,
                        state: this.player.state
                    }
                };
                this.socket.send(JSON.stringify(moveMsg));
            }
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
            
            // Dynamic UI Updates (Throttled)
            if (this.frameCount % 10 === 0) {
                if (this.uiManager.isCharacterSheetOpen) {
                    this.uiManager.updateCharacterSheet(this.player);
                }
                // Inventory update is expensive, only do it if absolutely necessary or less frequently
                // For now, we rely on event-based updates for inventory to avoid performance hit
            }

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