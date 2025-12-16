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
import { FloatingTextManager } from '../ui/FloatingTextManager.js';
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
import { InfernoTitan } from '../entities/InfernoTitan.js';
import { Siren } from '../entities/Siren.js';
import { FrostGuardian } from '../entities/FrostGuardian.js';
import { Fence } from '../entities/Fence.js';
import { QuestNPC } from '../entities/QuestNPC.js';
import { Stash } from '../entities/Stash.js';
import { AvengingSeraph } from '../entities/AvengingSeraph.js';
import { LevelUpEffect } from '../ui/LevelUpEffect.js';
import { AquaGolem } from '../entities/AquaGolem.js';
import { MountainTroll } from '../entities/MountainTroll.js';

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
        this.uiManager = new UIManager(this.isMobile);
        this.effects = []; // Active visual effects
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
        this.uiManager.onSocialOpen = () => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ type: 'social', payload: {} }));
            }
        };
        this.uiManager.onReportSubmit = (type, text) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                const msg = {
                    type: 'report',
                    payload: {
                        reportType: type,
                        text: text
                    }
                };
                this.socket.send(JSON.stringify(msg));
            } else {
                console.warn("Cannot submit report: Not connected to server.");
            }
        };
        this.uiManager.onPartyInvite = (targetName) => {
            this.sendPartyMessage('party_invite', { targetName });
        };
        this.uiManager.onPartyLeave = () => {
            this.sendPartyMessage('party_leave', {});
        };
        this.uiManager.onPartyResponse = (inviterName, accepted) => {
            this.sendPartyMessage('party_response', { inviterName, accepted });
        };
        this.uiManager.onSelectBranch = (branch) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'selectBranch',
                    payload: { branch }
                }));
            }
        };
        this.uiManager.onUnlockSkill = (skillName) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'unlockSkill',
                    payload: { skillName }
                }));
            }
        };
        this.uiManager.onHotbarAssign = (slotIndex, skillName) => {
            // Optional: Persist hotbar to server or local storage
            console.log(`Hotbar slot ${slotIndex} assigned to ${skillName}`);
        };
        this.uiManager.onStashDeposit = (itemId) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                const msg = {
                    type: 'stash_deposit',
                    payload: { itemId }
                };
                this.socket.send(JSON.stringify(msg));
            }
        };
        this.uiManager.onStashWithdraw = (itemId) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                const msg = {
                    type: 'stash_withdraw',
                    payload: { itemId }
                };
                this.socket.send(JSON.stringify(msg));
            }
        };
        this.uiManager.onAcceptQuest = (questId) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                const msg = {
                    type: 'accept_quest',
                    payload: { questId }
                };
                this.socket.send(JSON.stringify(msg));
            }
        };
        this.uiManager.onCompleteQuest = (questId) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                const msg = {
                    type: 'complete_quest',
                    payload: { questId }
                };
                this.socket.send(JSON.stringify(msg));
            }
        };
        this.worldGenerator = new WorldGenerator(this.renderSystem.scene, this.collisionManager);
        this.minimap = new Minimap();
        this.worldMap = new WorldMap(this);
        this.uiManager.onMapToggle = () => this.worldMap.toggle();
        this.floatingTextManager = new FloatingTextManager(this.renderSystem.camera);
        
        this.player = null;
        this.hoveredEntity = null;
        this.playerType = playerType || 'Fighter';
        this.enemies = [];
        this.cameraLocked = true;
        this.pendingInteraction = null;
        this.pendingAbilityTarget = null;
        
        this.lastTime = 0;
        this.accumulator = 0;
        this.fixedTimeStep = 1 / 60;

        this.gameTime = 0;
        this.nextEliteSpawnTime = 180;
        this.lastPickupTime = 0; // Throttle for pickup attempts

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
        this.latestServerTime = null;
        this.messageQueue = [];
        
        // Input Buffering
        this.inputBuffer = [];
        this.inputBufferWindow = 0.4; // 400ms buffer window
    }

    get scene() {
        return this.renderSystem.scene;
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
            let targetSlot = item.slot;
            
            const getWeakerSlot = (slot1, slot2) => {
                const item1 = this.player.equipment[slot1];
                const item2 = this.player.equipment[slot2];

                if (!item1) return slot1;
                if (!item2) return slot2;

                // Compare Level
                if (item1.level < item2.level) return slot1;
                if (item2.level < item1.level) return slot2;

                // Compare Rarity
                const r1 = item1.rarity ? (item1.rarity.multiplier || 0) : 0;
                const r2 = item2.rarity ? (item2.rarity.multiplier || 0) : 0;

                if (r1 < r2) return slot1;
                if (r2 < r1) return slot2;

                // Default to slot1
                return slot1;
            };

            // Handle Ring/Trinket logic (Auto-fill empty slots or replace weaker)
            if (item.slot === 'ring') {
                targetSlot = getWeakerSlot('ring1', 'ring2');
            } else if (item.slot === 'trinket') {
                targetSlot = getWeakerSlot('trinket1', 'trinket2');
            }

            this.sendEquipMessage(item, targetSlot);
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
                console.log("Player requested respawn.");
                
                if (this.isMultiplayer && this.socket && this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({ type: 'respawn', payload: {} }));
                    // Wait for server state update to handle actual respawn
                } else {
                    this.player.respawn(-1.25, 200);
                    this.player.timeSinceDeath = null;
                    this.chunkManager.updateEntityChunk(this.player);
                    this.renderSystem.setCameraTarget(this.player.position);
                    this.chunkManager.update(this.player, 0, this.collisionManager);
                }
            }
        };

        if (onProgress) onProgress(50, "Generating World...");
        await new Promise(r => setTimeout(r, 50));

        console.log("GameEngine: Forcing initial chunk update");
        this.chunkManager.update(this.player, 0, this.collisionManager);

        // In multiplayer, we still need to render the static town
        // Town Center: (0, 200), Radius: 100
        this.worldGenerator.createTown(0, 200, 100);
        // this.spawnTownEntities();

        if (onProgress) onProgress(70, "Spawning Enemies...");
        await new Promise(r => setTimeout(r, 50));

        if (onProgress) onProgress(90, "Setting up Controls...");
        await new Promise(r => setTimeout(r, 50));

        this.inputManager.subscribe('onClick', () => {
            if (!this.player) return;
            if (this.uiManager.isEscMenuOpen || this.uiManager.isPatchNotesOpen || this.uiManager.reportScreen.style.display === 'block') return;

            // Force raycast to ensure hoveredEntity is up to date with exact click position
            this.performRaycast();

            if (this.isMobile) {
                let nearest = null;
                let minDst = 1000;
                const activeEntities = this.chunkManager.getActiveEntities();

                activeEntities.forEach(e => {
                    if (e instanceof Actor && e !== this.player && !(e instanceof DwarfSalesman) && e.isActive && e.state !== 'DEAD') {
                        const d = this.player.position.distanceTo(e.position);
                        if (d < minDst) {
                            minDst = d;
                            nearest = e;
                        }
                    }
                });

                if (nearest && minDst < 8.0) {
                    // Turn towards enemy
                    const lookTarget = new THREE.Vector3(nearest.position.x, this.player.position.y, nearest.position.z);
                    if (this.player.mesh) {
                        this.player.mesh.lookAt(lookTarget);
                        this.player.rotation.copy(this.player.mesh.quaternion);
                    }

                    this.pendingInteraction = nearest;
                    this.player.move(nearest.position);
                } else {
                    this.player.playAnimation('Attack', false);
                }
                return;
            }

            if (this.hoveredEntity && this.hoveredEntity !== this.player) {
                this.moveToAndInteract(this.hoveredEntity);
            } else {
                const point = this.inputManager.getGroundIntersection();
                if (point) {
                    // Smart Click: Check for nearby loot if we clicked ground
                    // This handles cases where the click slightly missed the item or hitbox issues
                    let nearestLoot = null;
                    let minLootDist = 3.0; // Increased search radius around click point

                    const activeEntities = this.chunkManager.getActiveEntities();
                    for (const entity of activeEntities) {
                        if (entity instanceof LootDrop && entity.isActive) {
                            const d = new THREE.Vector2(point.x, point.z).distanceTo(new THREE.Vector2(entity.position.x, entity.position.z));
                            if (d < minLootDist) {
                                minLootDist = d;
                                nearestLoot = entity;
                            }
                        }
                    }

                    if (nearestLoot) {
                        this.moveToAndInteract(nearestLoot);
                    } else {
                        // Only clear pending interaction if we are clicking significantly far away from it?
                        // Or if we explicitly clicked ground.
                        // Since we force raycast above, if hoveredEntity is null, we definitely missed the entity.
                        this.pendingInteraction = null;
                        this.pendingAbilityTarget = null;
                        this.player.move(point);
                    }
                }
            }
        });

        this.inputManager.subscribe('onRightClick', () => {
            this.performAbility();
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

        this.inputManager.subscribe('onSkills', () => {
            this.uiManager.toggleSkillTree();
        });

        this.inputManager.subscribe('onAbilities', () => {
            this.uiManager.toggleAbilitiesMenu();
        });

        this.inputManager.subscribe('onHotbar', (slotIndex) => {
            this.performHotbarAbility(slotIndex);
        });

        this.uiManager.onHotbarAssign = (slotIndex, skillName) => {
            if (this.player) {
                if (!this.player.hotbar) this.player.hotbar = [null, null, null, null];
                this.player.hotbar[slotIndex] = skillName;
                console.log(`Assigned ${skillName} to slot ${slotIndex + 1}`);
            }
        };

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
                this.player.position.set(0, 0, 200);
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

        this.inputManager.subscribe('onQuest', () => {
            this.uiManager.toggleJournal();
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

        this.inputManager.subscribe('onSocial', () => {
            this.uiManager.toggleSocial();
        });


        if (onProgress) onProgress(95, "Waiting for silicon...");
        await new Promise(r => setTimeout(r, 1000));

        if (onProgress) onProgress(100, "Ready!");
        await new Promise(r => setTimeout(r, 100));

        this.connectToServer();

        this.loop(0);
    }

    spawnTownEntities() {
        if (this.townEntitiesSpawned) return;
        this.townEntitiesSpawned = true;

        console.log("Spawning Town Entities (Local)...");

        // Cleanup existing local entities to prevent duplicates
        // Iterate over all chunks to ensure we catch them even if not active
        for (const chunk of this.chunkManager.chunks.values()) {
            // Create a copy to safely remove while iterating
            const entities = Array.from(chunk);
            for (const entity of entities) {
                if (entity.id === 'quest-npc-local' || entity.id === 'stash-local') {
                    console.log(`Removing existing ${entity.id} before respawn`);
                    this.chunkManager.removeEntity(entity);
                }
            }
        }
        
        // Quest NPC (Left of Stash)
        const questNPC = new QuestNPC('quest-npc-local');
        questNPC.position.set(-25, 0, 200); // Near Blacksmith
        questNPC.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        this.addEntity(questNPC);

        // Stash (In front of Two Story Building)
        const stash = new Stash('stash-local');
        stash.position.set(0, 0, 185);
        stash.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
        this.addEntity(stash);
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
        if (typeof alert !== 'undefined') {
            alert("Connection lost! Please refresh the page and login again.");
        }
        
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
                let data = event.data;
                
                // Check for binary data (Compressed State)
                if (data instanceof Blob) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        try {
                            const compressed = new Uint8Array(reader.result);
                            // Decompress using pako
                            const jsonString = pako.inflate(compressed, { to: 'string' });
                            const msg = JSON.parse(jsonString);
                            this.handleServerMessage(msg);
                        } catch (e) {
                            console.error("Decompression error:", e);
                        }
                    };
                    reader.readAsArrayBuffer(data);
                    return;
                }

                // Optimization: Check for time messages without full parse
                if (typeof data === 'string') {
                    if (data.includes('"type":"time"')) {
                        this.latestServerTime = data;
                        return;
                    }
                }

                const msg = JSON.parse(data);
                if (msg.type === 'time') {
                    this.latestServerTime = JSON.stringify(msg.payload);
                } else {
                    this.messageQueue.push(msg);
                }
            } catch (e) {
                console.error("Failed to parse server message:", e);
            }
        };

        this.socket.onclose = () => {
            console.log("Disconnected from server.");
            if (!this.isExpectedDisconnect) {
                if (typeof alert !== 'undefined') {
                    alert("Disconnected from server. Returning to menu.");
                }
                window.location.reload();
            }
        };
        
        this.socket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    }

    spawnEliteEnemy() {
        const elite = new Skeleton('elite-test');
        elite.isElite = true;
        elite.position.set(10, 0, 10);
        this.enemies.push(elite);
        this.addEntity(elite);
        return elite;
    }

    triggerRemoteAbilityVisuals(entity, skillName, targetX, targetZ) {
        if (!entity || !entity.spawnVisualEffect) return;

        const targetPos = new THREE.Vector3(targetX, 0, targetZ);
        const position = entity.position.clone();

        // Fighter
        if (entity instanceof Fighter) {
            switch (skillName) {
                case "Whirlwind":
                    entity.spawnVisualEffect(this, position, 0xaaaaaa, "spin");
                    break;
                case "Shield Slam":
                    // Calculate impact position in front
                    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(entity.mesh.quaternion);
                    entity.spawnVisualEffect(this, position.clone().add(forward), 0xffff00, "impact");
                    break;
                case "Iron Fortress":
                    entity.spawnVisualEffect(this, position, 0x808080, "buff");
                    break;
                case "Sweeping Strike":
                    entity.spawnVisualEffect(this, position, 0xffffff, "cone");
                    break;
                case "Earthshaker":
                    entity.spawnVisualEffect(this, position, 0x8b4513, "wave");
                    break;
                case "Unbreakable Grip":
                    entity.spawnVisualEffect(this, targetPos, 0x0000ff, "impact");
                    break;
                case "Juggernaut Charge":
                    entity.spawnVisualEffect(this, position, 0xff0000, "wave");
                    break;
            }
        }
        // Rogue
        else if (entity instanceof Rogue) {
            switch (skillName) {
                case "Shadow Step":
                    entity.spawnVisualEffect(this, position, 0x000000, "smoke");
                    break;
                case "Fan of Knives":
                    entity.spawnVisualEffect(this, position, 0x333333, "spin");
                    break;
                case "Venomous Strike":
                    entity.spawnVisualEffect(this, targetPos, 0x00ff00, "mark");
                    break;
                case "Assassinate":
                    entity.spawnVisualEffect(this, targetPos, 0xff0000, "blood");
                    break;
                case "Smoke Bomb":
                    entity.spawnVisualEffect(this, position, 0x555555, "smoke_cloud");
                    break;
                case "Adrenaline Rush":
                    entity.spawnVisualEffect(this, position, 0xff0000, "buff");
                    break;
            }
        }
        // Wizard
        else if (entity instanceof Wizard) {
            switch (skillName) {
                case "Frost Nova":
                    entity.spawnVisualEffect(this, position, 0x00ffff, "ring");
                    break;
                case "Blink":
                    entity.spawnVisualEffect(this, position, 0xff00ff, "ring");
                    break;
                case "Meteor":
                    entity.spawnVisualEffect(this, targetPos, 0xff4500, "burst");
                    break;
                case "Ice Barrier":
                    entity.spawnVisualEffect(this, position, 0x00ffff, "buff");
                    break;
                case "Time Warp":
                    entity.spawnVisualEffect(this, position, 0xffd700, "ring");
                    break;
            }
        }
        // Cleric
        else if (entity instanceof Cleric) {
            switch (skillName) {
                case "Smite":
                    entity.spawnVisualEffect(this, targetPos, 0xffff00, "impact");
                    break;
                case "Healing Light":
                    entity.spawnVisualEffect(this, targetPos, 0xffff00, "beam"); 
                    break;
                case "Holy Nova":
                    entity.spawnVisualEffect(this, position, 0xffff00, "ring");
                    break;
                case "Divine Protection":
                    entity.spawnVisualEffect(this, position, 0xffff00, "buff");
                    break;
                case "Sacred Ground":
                    entity.spawnVisualEffect(this, targetPos, 0xffffff, "ring");
                    break;
                case "Resurrection":
                    entity.spawnVisualEffect(this, targetPos, 0xffffff, "beam");
                    break;
            }
        }
        // Avenging Seraph
        else if (entity instanceof AvengingSeraph) {
            switch (skillName) {
                case "Smite":
                    entity.spawnVisualEffect(this, targetPos, 0xffff00, "impact");
                    break;
            }
        }
    }

    hydrateItem(item) {
        if (!item) return null;
        if (typeof item.rarity === 'string') {
            // Try direct lookup (e.g. "COMMON")
            let rarity = RARITY[item.rarity.toUpperCase()];
            
            // If not found, try by name (e.g. "Common")
            if (!rarity) {
                for (const key in RARITY) {
                    if (RARITY[key].name === item.rarity) {
                        rarity = RARITY[key];
                        break;
                    }
                }
            }
            
            // Default to Common if still not found
            item.rarity = rarity || RARITY.COMMON;
        }
        return item;
    }

    handleServerMessage(msg) {
        if (!this.player) return; // Safety check

        if (msg.type === 'chat') {
            const chatData = msg.payload;
            this.uiManager.addChatMessage(chatData.sender, chatData.message);
        } else if (msg.type === 'inventory') {
            this.player.inventory = msg.payload.map(item => this.hydrateItem(item));
            this.uiManager.updateInventory(this.player);
        } else if (msg.type === 'stash') {
            this.player.stash = msg.payload.map(item => this.hydrateItem(item));
            this.uiManager.updateStash(this.player);
        } else if (msg.type === 'party_update') {
            this.uiManager.updateParty(msg.payload);
        } else if (msg.type === 'party_request') {
            this.uiManager.showPartyRequest(msg.payload.targetName);
        } else if (msg.type === 'time') {
            const timeData = msg.payload;
            // Calculate time since server start or just display server time
            // For now, let's just display the time component
            const date = new Date(timeData.time * 1000);
            const timeString = date.toLocaleTimeString();
            if (this.uiManager.gameTimer) {
                this.uiManager.gameTimer.textContent = timeString;
            }
        } else if (msg.type === 'ability') {
            const abilityData = msg.payload;
            // Ignore if source is local player (we already played the effect locally)
            if (this.player && abilityData.sourceId === this.player.id) return;

            const source = this.remotePlayers.get(abilityData.sourceId);
            if (source) {
                this.triggerRemoteAbilityVisuals(source, abilityData.skillName, abilityData.targetX, abilityData.targetZ);
            }
        } else if (msg.type === 'damage') {
            const dmgData = msg.payload;
            
            // Find target entity
            let target = null;
            if (this.player && this.player.id === dmgData.targetId) {
                target = this.player;
            } else {
                target = this.remotePlayers.get(dmgData.targetId);
            }

            if (target) {
                // Only show if player is source or target
                if (this.player && (dmgData.sourceId === this.player.id || dmgData.targetId === this.player.id)) {
                    let color = '#ffffff';
                    if (target === this.player) {
                        color = '#ff0000'; // Red if player takes damage
                    } else {
                        color = '#ffff00'; // Yellow if player deals damage
                    }
                    
                    this.floatingTextManager.spawn(dmgData.amount, target.position, color);
                }
            }

            // If target is local player, flash screen or shake camera?
            if (this.player && dmgData.targetId === this.player.id) {
                // this.renderSystem.shakeCamera(0.2);
            }
        } else if (msg.type === 'error') {
            console.error("Server Error:", msg.payload);
            if (typeof alert !== 'undefined') {
                alert(`Server Error: ${msg.payload}`);
            }
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
                // Hack: Force Quest NPC position if server is outdated
                if (pData.id === 'quest-npc-1') {
                    pData.x = -25;
                    pData.z = 200;
                    pData.rotation = Math.PI / 2;
                }
                // Hack: Force Stash position if server is outdated
                if (pData.id === 'stash-1') {
                    pData.x = 0;
                    pData.z = 185;
                }
                // Hack: Force Merchant position if server is outdated
                if (pData.id === 'merchant-1') {
                    pData.x = 22.5;
                    pData.z = 200;
                }

                seenIds.add(pData.id);

                if (pData.id === this.player.id) {
                    // Update local player stats from server
                    if (this.player) {
                        let justRespawned = false;

                        // Sync State
                        if (pData.state) {
                            if (this.player.state !== 'DEAD' && pData.state === 'DEAD') {
                                this.player.die();
                            } else if (this.player.state === 'DEAD' && pData.state !== 'DEAD') {
                                // Revived?
                                // Force town spawn (-1.25, 200) to ensure immediate visual feedback
                                const x = -1.25;
                                const z = 200;
                                
                                console.log(`GameEngine: Respawn detected. Teleporting to Town (${x}, ${z})`);
                                this.player.respawn(x, z);
                                this.player.state = pData.state; // Ensure state matches server
                                
                                this.chunkManager.updateEntityChunk(this.player);
                                this.renderSystem.setCameraTarget(this.player.position);
                                justRespawned = true;
                            } else {
                                this.player.state = pData.state;
                            }
                        }

                        // Check for forced teleport (large distance discrepancy)
                        // This handles portals or admin teleports where state might not change from DEAD
    
                        if (!justRespawned && pData.x !== undefined && pData.z !== undefined) {
                            const serverPos = new THREE.Vector3(pData.x, pData.y || 0, pData.z);
                            const dist = this.player.position.distanceTo(serverPos);
                            if (dist > 20.0) { // Threshold for teleport (larger than normal lag correction)
                                console.log("GameEngine: Detected server teleport, syncing position.");
                                this.player.position.copy(serverPos);
                                this.player.targetPosition = null;
                                this.chunkManager.updateEntityChunk(this.player);
                                this.renderSystem.setCameraTarget(this.player.position);
                            }
                        }
                        

                        this.player.xp = pData.experience;
                        this.player.xpToNextLevel = pData.maxExperience;
                        
                        // Level Up Detection
                        if (this.player.level < pData.level) {
                            // Only trigger if we have synced at least once (avoid login level up)
                            if (this.player.hasSyncedLevel) {
                                console.log(`Level Up! ${this.player.level} -> ${pData.level}`);
                                
                                // Trigger Effect
                                const effect = new LevelUpEffect(this.renderSystem.scene, this.player.position);
                                this.effects.push(effect);
                                
                                // Floating Text
                                this.floatingTextManager.spawn("LEVEL UP!", 
                                    new THREE.Vector3(this.player.position.x, this.player.position.y + 2, this.player.position.z), 
                                    '#ffd700' // Gold
                                );

                                // Chat Notification
                                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                                    const chatMsg = {
                                        type: "chat",
                                        payload: {
                                            message: `* has reached level ${pData.level}! *`,
                                            sender: this.username || "Player"
                                        }
                                    };
                                    this.socket.send(JSON.stringify(chatMsg));
                                }
                            }
                            this.player.level = pData.level;
                        } else {
                            this.player.level = pData.level;
                        }
                        this.player.hasSyncedLevel = true;

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

                        // Sync Skills
                        const prevBranch = this.player.selectedBranch;
                        const prevPoints = this.player.skillPoints;
                        const prevUnlocked = this.player.unlockedSkills ? this.player.unlockedSkills.length : 0;

                        this.player.skillPoints = pData.skillPoints;
                        this.player.selectedBranch = pData.selectedBranch;
                        this.player.unlockedSkills = pData.unlockedSkills;

                        const currUnlocked = this.player.unlockedSkills ? this.player.unlockedSkills.length : 0;

                        // Update Hotbar if skills changed or if we have skills but hotbar is empty
                        const isHotbarEmpty = !this.player.hotbar || this.player.hotbar.every(s => !s);
                        if (prevUnlocked !== currUnlocked || prevBranch !== this.player.selectedBranch || (currUnlocked > 0 && isHotbarEmpty)) {
                            console.log(`Updating Hotbar: Skills=${currUnlocked}, Branch=${this.player.selectedBranch}, Empty=${isHotbarEmpty}`);
                            this.uiManager.updateHotbar(this.player);
                        }

                        // Refresh Skill Tree if open and data changed
                        if (this.uiManager.skillTreeWindow && this.uiManager.skillTreeWindow.style.display === 'flex') {
                             if (prevBranch !== this.player.selectedBranch || 
                                 prevPoints !== this.player.skillPoints || 
                                 prevUnlocked !== currUnlocked) {
                                     const classType = this.player.subType || this.playerType;
                                     this.uiManager.renderSkillTree(classType);
                             }
                        }

                        // Sync Equipment
                        if (pData.equipment) {
                            this.player.equipment = pData.equipment;
                            // Hydrate Rarity for UI
                            for (const key in this.player.equipment) {
                                this.player.equipment[key] = this.hydrateItem(this.player.equipment[key]);
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
                        if (this.player.xp !== this.lastXP || this.player.xpToNextLevel !== this.lastMaxXP || this.player.level !== this.lastLevel) {
                            console.log(`Updating XP/Level UI: Level=${this.player.level}, XP=${this.player.xp}`);
                            this.uiManager.updateXP(this.player);
                            this.lastXP = this.player.xp;
                            this.lastMaxXP = this.player.xpToNextLevel;
                            this.lastLevel = this.player.level;
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
                    } else {
                        // Update pending creation with latest data to prevent state jumps/glitches upon spawn
                        const idx = this.entityCreationQueue.findIndex(e => e.id === pData.id);
                        if (idx !== -1) {
                            this.entityCreationQueue[idx] = { ...this.entityCreationQueue[idx], ...pData };
                        }
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
                        // Interpolation Setup
                        const newPos = new THREE.Vector3(pData.x, pData.y, pData.z);
                        if (!remoteEntity.targetServerPosition) {
                            // First update or no previous target, snap immediately
                            remoteEntity.position.copy(newPos);
                            remoteEntity.targetServerPosition = newPos;
                        } else {
                            // Check for teleport (large distance)
                            if (remoteEntity.position.distanceTo(newPos) > 10.0) {
                                remoteEntity.position.copy(newPos);
                            }
                            remoteEntity.targetServerPosition = newPos;
                        }
                    }

                    // Force update chunk for remote entities to handle visibility culling
                    this.chunkManager.updateEntityChunk(remoteEntity);

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
                            
                            // Animation handled by Actor.updateState or setMesh
                        }
                    } else {
                        remoteEntity.isDead = false;
                        remoteEntity.deadTimer = 0;
                        if (remoteEntity.mesh) remoteEntity.mesh.visible = true;
                        
                        // Sync Health/Stats for Remote Entities (Enemies/Players)
                        if (remoteEntity.stats) {
                            if (pData.health !== undefined) remoteEntity.stats.hp = pData.health;
                            if (pData.maxHealth !== undefined) remoteEntity.stats.maxHp = pData.maxHealth;
                            if (pData.mana !== undefined) remoteEntity.stats.mana = pData.mana;
                            if (pData.maxMana !== undefined) remoteEntity.stats.maxMana = pData.maxMana;
                            if (pData.attackSpeed !== undefined) remoteEntity.stats.attackSpeed = pData.attackSpeed;
                        }

                        // Update State and Animation
                        if (remoteEntity.state !== pData.state || (pData.isCharging !== undefined && remoteEntity.isCharging !== pData.isCharging)) {
                            if (remoteEntity.updateState) {
                                remoteEntity.updateState(pData.state);
                            } else {
                                remoteEntity.state = pData.state;
                            }
                            
                            if (pData.isCharging !== undefined) remoteEntity.isCharging = pData.isCharging;
                        } else if (pData.state === 'ATTACKING' && remoteEntity.updateState) {
                            // Force update for ATTACKING state to refresh timer/animation
                            remoteEntity.updateState(pData.state);
                        }

                        // Update Rotation
                        if (pData.rotation !== undefined) {
                            remoteEntity.targetServerRotation = pData.rotation;
                        }

                        // Remote Level Up Detection
                        if (pData.level !== undefined) {
                            if (!remoteEntity.hasSyncedLevel) {
                                remoteEntity.level = pData.level;
                                remoteEntity.hasSyncedLevel = true;
                            } else if (remoteEntity.level < pData.level) {
                                console.log(`Remote Entity ${remoteEntity.id} Level Up! ${remoteEntity.level} -> ${pData.level}`);
                                remoteEntity.level = pData.level;
                                
                                // Trigger Effect
                                const effect = new LevelUpEffect(this.renderSystem.scene, remoteEntity.position);
                                this.effects.push(effect);
                            }
                        }
                    }
                }
            });

            // Cleanup removed entities
            for (const [id, entity] of this.remotePlayers) {
                if (!seenIds.has(id)) {
                    entity.isActive = false;
                    
                    if (entity.dispose) {
                        entity.dispose();
                    } else if (entity.mesh) {
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
        } else if (msg.type === 'stash') {
            const stash = msg.payload;
            // Hydrate rarity from string to object for UI
            stash.forEach(item => {
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
                // Pad with nulls to maintain fixed size (100)
                while (stash.length < 100) {
                    stash.push(null);
                }
                this.player.stash = stash;
                this.uiManager.updateStash(this.player);
            }
        } else if (msg.type === 'social') {
            this.uiManager.updateSocialList(msg.payload);
        } else if (msg.type === 'quest_update') {
            const quests = msg.payload;
            if (this.player) {
                this.player.quests = quests;
                this.uiManager.updateQuestWindow(quests);
                this.uiManager.updateJournal(quests);
            }
        }
    }

    pickupLoot(lootId) {
        const msg = {
            type: 'pickup',
            payload: { lootId: lootId }
        };
        this.socket.send(JSON.stringify(msg));

        // Optimistic removal to prevent "ghost items"
        const entity = this.remotePlayers.get(lootId);
        if (entity) {
            console.log(`Optimistically removing loot ${lootId}`);
            entity.isActive = false;
            if (entity.dispose) {
                entity.dispose();
            } else if (entity.mesh) {
                this.renderSystem.remove(entity.mesh);
            }
            
            const key = this.chunkManager.getChunkKey(entity.position.x, entity.position.z);
            if (this.chunkManager.chunks.has(key)) {
                this.chunkManager.chunks.get(key).delete(entity);
            }
            this.remotePlayers.delete(lootId);
            
            if (this.pendingInteraction === entity) {
                this.pendingInteraction = null;
            }
        }
    }

    sendEquipMessage(item, targetSlot) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: 'equip',
            payload: {
                itemId: item.id,
                slot: targetSlot || item.slot
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

        if (type === 'Stash') {
            return new Stash(id);
        }

        // If type is NPC, handle it
        if (type === 'NPC') {
            if (subType === 'DwarfSalesman') {
                p = new DwarfSalesman(id);
            } else if (subType === 'QuestNPC') {
                p = new QuestNPC(id);
            } else if (subType === 'AvengingSeraph') {
                console.log(`GameEngine: Creating AvengingSeraph ${id}`);
                p = new AvengingSeraph(id);
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
                case 'InfernoTitan': p = new InfernoTitan(id); break;
                case 'Siren': p = new Siren(id); break;
                case 'FrostGuardian': p = new FrostGuardian(id); break;
                case 'AquaGolem': p = new AquaGolem(id); break;
                case 'MountainTroll': p = new MountainTroll(id); break;
                default: p = new Skeleton(id); break;
            }

            // Check for Elite ID pattern
            if (id && id.startsWith('elite-')) {
                p.isElite = true;
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
                
                if (!entity.isActive) {
                    console.log(`GameEngine: Entity ${entity.id} is inactive, discarding mesh.`);
                    this.renderSystem.remove(mesh);
                    return;
                }

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

    moveToAndInteract(entity) {
        if (!entity) return;
        this.pendingInteraction = entity;
        this.pendingAbilityTarget = null;
        
        // Check if already in range to avoid unnecessary movement start
        const dist = new THREE.Vector2(this.player.position.x, this.player.position.z)
            .distanceTo(new THREE.Vector2(entity.position.x, entity.position.z));
        
        let range = 5.0;
        if (entity instanceof DwarfSalesman) {
            range = 4.0;
        } else if (entity instanceof Actor && entity !== this.player) {
            if (this.player.constructor.name === 'Wizard') {
                range = 16.0;
            } else {
                range = 5.0;
            }
        }

        if (dist > range) {
            // Flatten move target
            const target = entity.position.clone();
            target.y = this.player.position.y;
            this.player.move(target);
        }
    }

    performRaycast() {
        const meshes = this.activeEntitiesCache
            .filter(e => e.mesh && e.isActive && e !== this.player)
            .map(e => e.mesh);
        
        // Use inputManager.mouse directly to ensure we use the latest cursor position
        this.inputManager.raycaster.setFromCamera(this.inputManager.mouse, this.renderSystem.camera);
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

    performHotbarAbility(slotIndex) {
        if (!this.player || !this.player.hotbar) {
            console.warn("Player or hotbar not initialized.");
            return;
        }
        const skillName = this.player.hotbar[slotIndex];
        if (!skillName) {
            console.log(`Hotbar slot ${slotIndex + 1} is empty.`);
            return;
        }

        // Determine target (mouse cursor)
        let targetPos = null;
        if (this.hoveredEntity && this.hoveredEntity !== this.player && this.hoveredEntity.state !== 'DEAD' && !(this.hoveredEntity instanceof DwarfSalesman)) {
            targetPos = this.hoveredEntity.position;
        } else {
            targetPos = this.inputManager.getGroundIntersection();
        }

        if (targetPos) {
            this.performAbility(targetPos, skillName);
        }
    }

    performAbility(targetVectorOverride = null, skillNameOverride = null) {
        if (!this.player) return;
        if (this.uiManager.isEscMenuOpen || this.uiManager.isPatchNotesOpen || this.uiManager.reportScreen.style.display === 'block') return;

        // Rotate to face cursor/target immediately (even if on cooldown)
        if (!this.isMobile) {
            let lookAtPos = null;
            if (targetVectorOverride) {
                lookAtPos = targetVectorOverride;
            } else if (this.hoveredEntity && this.hoveredEntity !== this.player && this.hoveredEntity.state !== 'DEAD' && !(this.hoveredEntity instanceof DwarfSalesman)) {
                lookAtPos = this.hoveredEntity.position;
            } else {
                const point = this.inputManager.getGroundIntersection();
                if (point) {
                    lookAtPos = point;
                }
            }

            if (lookAtPos) {
                const lookTarget = new THREE.Vector3(lookAtPos.x, this.player.position.y, lookAtPos.z);
                if (this.player.mesh) {
                    this.player.mesh.lookAt(lookTarget);
                    this.player.rotation.copy(this.player.mesh.quaternion);
                }
            }
        }

        // Check Cooldown and Mana before proceeding
        let onCooldown = false;
        if (!skillNameOverride) {
            if (this.player.abilityCooldown > 0) {
                onCooldown = true;
            }
        } else {
            if (this.player.cooldowns && this.player.cooldowns[skillNameOverride] > 0) {
                onCooldown = true;
            }
        }

        if (onCooldown) {
            // Buffer the input
            const existing = this.inputBuffer.find(b => b.skillName === skillNameOverride);
            if (!existing) {
                // Only buffer if not already buffered to avoid duplicates
                this.inputBuffer.push({
                    skillName: skillNameOverride,
                    target: targetVectorOverride,
                    timestamp: Date.now() / 1000
                });
                console.log(`Buffered ability: ${skillNameOverride || 'Primary'} (CD)`);
            }
            return;
        }

        // Mana Check
        const cost = (skillNameOverride ? 0 : this.player.abilityManaCost) * (1 - (this.player.stats.manaCostReduction || 0));
        // Note: Specific skills might have their own mana costs checked in useAbility, 
        // but for primary ability we check here.
        if (!skillNameOverride && this.player.stats.mana < cost) {
            return;
        }
        
        if (this.isMobile && !targetVectorOverride) {
            // Auto-target nearest enemy for mobile ability
            let nearest = null;
            let minDst = 1000;
            const activeEntities = this.chunkManager.getActiveEntities();

            activeEntities.forEach(e => {
                if (e instanceof Actor && e !== this.player && !(e instanceof DwarfSalesman) && e.isActive && e.state !== 'DEAD') {
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

                // Turn towards enemy
                const lookTarget = new THREE.Vector3(nearest.position.x, this.player.position.y, nearest.position.z);
                if (this.player.mesh) {
                    this.player.mesh.lookAt(lookTarget);
                    this.player.rotation.copy(this.player.mesh.quaternion);
                }
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

            if (this.isMultiplayer && this.socket && this.socket.readyState === WebSocket.OPEN) {
                const abilityMsg = {
                    type: "ability",
                    payload: {
                        targetX: targetPos.x,
                        targetZ: targetPos.z,
                        targetId: targetId,
                        skillName: skillNameOverride || this.player.abilityName
                    }
                };
                this.socket.send(JSON.stringify(abilityMsg));
            }
            
            // Client-side prediction
            if (skillNameOverride && this.player.useSkill) {
                this.player.useSkill(skillNameOverride, targetPos, this);
            } else {
                this.player.useAbility(targetPos, this, skillNameOverride);
            }
            return;
        }

        if (targetVectorOverride) {
             if (this.isMultiplayer && this.socket && this.socket.readyState === WebSocket.OPEN) {
                 const abilityMsg = {
                    type: "ability",
                    payload: {
                        targetX: targetVectorOverride.x,
                        targetZ: targetVectorOverride.z,
                        targetId: "",
                        skillName: skillNameOverride || this.player.abilityName
                    }
                };
                this.socket.send(JSON.stringify(abilityMsg));
            }
            
            if (skillNameOverride && this.player.useSkill) {
                this.player.useSkill(skillNameOverride, targetVectorOverride, this);
            } else {
                this.player.useAbility(targetVectorOverride, this, skillNameOverride);
            }
            return;
        }

        if (this.hoveredEntity && this.hoveredEntity !== this.player && this.hoveredEntity.state !== 'DEAD') {
            if (this.hoveredEntity instanceof DwarfSalesman) return;

            const dist = this.player.position.distanceTo(this.hoveredEntity.position);
            const abilityRange = 100.0; // Effectively infinite range as requested

            // Check if we are in range
            if (dist <= abilityRange) {
                // Multiplayer Ability Logic (Targeted)
                if (this.isMultiplayer && this.socket && this.socket.readyState === WebSocket.OPEN) {
                    const abilityMsg = {
                        type: "ability",
                        payload: {
                            targetX: this.hoveredEntity.position.x,
                            targetZ: this.hoveredEntity.position.z,
                            targetId: this.hoveredEntity.id,
                            skillName: skillNameOverride || this.player.abilityName
                        }
                    };
                    this.socket.send(JSON.stringify(abilityMsg));
                }
                
                // Client-side prediction
                if (skillNameOverride && this.player.useSkill) {
                    this.player.useSkill(skillNameOverride, this.hoveredEntity.position, this);
                } else {
                    this.player.useAbility(this.hoveredEntity.position, this);
                }
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
                if (this.isMultiplayer && this.socket && this.socket.readyState === WebSocket.OPEN) {
                    const abilityMsg = {
                        type: "ability",
                        payload: {
                            targetX: targetPoint.x,
                            targetZ: targetPoint.z,
                            targetId: "",
                            skillName: skillNameOverride || this.player.abilityName
                        }
                    };
                    this.socket.send(JSON.stringify(abilityMsg));
                }
                
                // Client-side prediction
                if (skillNameOverride && this.player.useSkill) {
                    this.player.useSkill(skillNameOverride, targetPoint, this);
                } else {
                    this.player.useAbility(targetPoint, this);
                }
            }
        }
    }

    performAttack(target) {
        if (!this.player || !target) return;

        // Send to Server
        const attackMsg = {
            type: "attack",
            payload: {
                targetId: target.id
            }
        };
        this.socket.send(JSON.stringify(attackMsg));

        // Visuals
        const lookTarget = new THREE.Vector3(target.position.x, this.player.position.y, target.position.z);
        if (this.player.mesh) {
            this.player.mesh.lookAt(lookTarget);
            this.player.rotation.copy(this.player.mesh.quaternion);
        }

        this.player.setAttackingState();

        // Client-Side Prediction
        // Sync with Actor.js setAttackingState timing
        // Animation duration = cooldown * 1000
        // Hit point assumed at 35%
        // const hitDelay = this.player.getAttackHitDelay();

        // setTimeout(() => {
        //     // Check if target is still valid
        //     if (target && target.stats && target.stats.hp > 0) {
        //         // Predict damage
        //         // We use base damage as a guess. Server is authoritative.
        //         // const predictedDmg = this.player.stats.damage;
        //         // target.stats.hp -= predictedDmg;
                
        //         // Visual feedback immediately
        //         // If it goes below 0, UI will hide it next frame
        //         // if (target.stats.hp < 0) target.stats.hp = 0;

        //         // Spawn Damage Text
        //         // if (!this.isMultiplayer) {
        //         //    this.floatingTextManager.spawn(predictedDmg, target.position, '#ffffff');
        //         // }
        //     }
        // }, hitDelay);
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
                this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
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
    
            this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
        } catch (err) {
            console.error("GameEngine Loop Error:", err);
        }
    }

    destroy() {
        console.log("GameEngine: Destroying instance...");
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        if (this.renderSystem) {
            this.renderSystem.dispose();
        }

        // Close socket if it was created internally (not passed in)
        // But here we usually pass it in. If we want to reuse it, we shouldn't close it.
        // The main.js logic reuses the socket.
    }

    update(dt) {
        this.frameCount++;

        // Process Input Buffer
        if (this.inputBuffer.length > 0) {
            const now = Date.now() / 1000;
            // Remove expired
            this.inputBuffer = this.inputBuffer.filter(b => now - b.timestamp < this.inputBufferWindow);
            
            // Try to execute oldest
            if (this.inputBuffer.length > 0) {
                const buffered = this.inputBuffer[0];
                
                // Check if ready
                let ready = false;
                if (!buffered.skillName) {
                    if (this.player.abilityCooldown <= 0) ready = true;
                } else {
                    if (!this.player.cooldowns || this.player.cooldowns[buffered.skillName] <= 0) ready = true;
                }

                if (ready) {
                    console.log(`Executing buffered ability: ${buffered.skillName || 'Primary'}`);
                    // Remove BEFORE executing to prevent infinite recursion if performAbility re-buffers (though we check ready first)
                    this.inputBuffer.shift();
                    
                    // Re-determine target if not overridden (to aim at current mouse pos)
                    let target = buffered.target;
                    if (!target) {
                         // If it was a ground click or hover that wasn't captured in targetVectorOverride,
                         // we might want to re-evaluate current mouse pos?
                         // But performAbility logic handles null target by checking mouse.
                         // So passing null is fine.
                    }
                    
                    this.performAbility(target, buffered.skillName);
                }
            }
        }

        // Cleanup Rogue Stashes and Quest NPCs (Fix for extra entities at 0,0,0)
        if (this.frameCount % 60 === 0) {
            const activeEntities = this.chunkManager.getActiveEntities();
            let stashCount = 0;
            let questNpcCount = 0;

            // Use a copy or be careful about modification during iteration
            // activeEntities is an array copy from ChunkManager, so it's safe to iterate
            // but removing from ChunkManager won't affect this array immediately
            
            for (const entity of activeEntities) {
                // Stash Cleanup
                if (entity instanceof Stash) {
                    // Allow server stashes (stash-1) and local stash (stash-local)
                    if (entity.id === 'stash-local') {
                        stashCount++;
                        if (stashCount > 1) {
                             console.warn(`Removing duplicate stash-local`);
                             this.chunkManager.removeEntity(entity);
                        } else if (entity.position.lengthSq() < 1) {
                             console.warn(`Fixing stash-local position from 0,0,0 to 0,0,185`);
                             entity.position.set(0, 0, 185);
                             this.chunkManager.updateEntityChunk(entity);
                        }
                    }
                }

                // QuestNPC Cleanup
                if (entity instanceof QuestNPC) {
                    // Allow server quest npc (quest-npc-1) and local (quest-npc-local)
                    if (entity.id !== 'quest-npc-local' && entity.id !== 'quest-npc-1') {
                        console.warn(`Removing rogue QuestNPC entity: ${entity.id} at ${entity.position.x}, ${entity.position.z}`);
                        this.chunkManager.removeEntity(entity);
                    } else if (entity.id === 'quest-npc-local') {
                        questNpcCount++;
                        if (questNpcCount > 1) {
                             console.warn(`Removing duplicate quest-npc-local`);
                             this.chunkManager.removeEntity(entity);
                        } else if (entity.position.lengthSq() < 1) {
                             console.warn(`Fixing quest-npc-local position from 0,0,0 to -25,0,200`);
                             entity.position.set(-25, 0, 200);
                             this.chunkManager.updateEntityChunk(entity);
                        }
                    }
                }
            }
        }

        // Process Network Message Queue
        // 1. Handle critical messages (Chat, Inventory, etc.)
        // Increased limit to clear backlog faster
        const maxMessages = 200; 
        let msgCount = 0;
        
        // Debug queue size if it gets large
        if (this.messageQueue.length > 100 && this.frameCount % 60 === 0) {
            console.warn(`Message Queue Backlog: ${this.messageQueue.length}`);
        }

        while (this.messageQueue.length > 0 && msgCount < maxMessages) {
            const msg = this.messageQueue.shift();
            try {
                this.handleServerMessage(msg);
            } catch (e) {
                console.error("Error handling message:", msg.type, e);
            }
            msgCount++;
        }

        // 2. Handle latest state update (Coalesced) - REMOVED to ensure all state transitions (like Attacks) are processed
        // if (this.latestServerState) { ... }

        // 3. Handle latest time update (Coalesced)
        if (this.latestServerTime) {
            try {
                let payload;
                if (typeof this.latestServerTime === 'string') {
                    if (this.latestServerTime.startsWith('{')) {
                        const msg = JSON.parse(this.latestServerTime);
                        payload = msg.payload;
                    } else {
                        payload = JSON.parse(this.latestServerTime);
                    }
                } else {
                    payload = this.latestServerTime;
                }
                this.handleServerMessage({ type: 'time', payload: payload });
            } catch (e) {
                console.error("Error handling server time:", e);
            } finally {
                this.latestServerTime = null;
            }
        }

        // Process Entity Creation Queue (Throttle to 5 per frame)
        const creationLimit = 5;
        let createdCount = 0;
        while (this.entityCreationQueue.length > 0 && createdCount < creationLimit) {
            const pData = this.entityCreationQueue.shift();
            this.pendingEntityIds.delete(pData.id);
            
            // Double check if it was already created (race condition)
            if (this.remotePlayers.has(pData.id)) continue;

            try {
                let remoteEntity;
                // Pass subType (e.g. "Skeleton", "DwarfSalesman")
                if (pData.type === 'Loot') {
                    // Map rarity string to object
                    this.hydrateItem(pData.lootItem);

                    // Create LootDrop
                    remoteEntity = new LootDrop(pData.lootItem, pData.x, pData.z, pData.id);
                    remoteEntity.id = pData.id;
                    // Add click handler for pickup
                    remoteEntity.onClick = () => {
                        this.pickupLoot(pData.id);
                    };
                } else if (pData.type === 'Projectile') {
                    // Skip creating server projectile if it belongs to local player (avoid duplicates)
                    if (pData.ownerId === this.player.id) continue;

                    // Create Projectile
                    const start = new THREE.Vector3(pData.x, pData.y, pData.z);
                    const target = new THREE.Vector3(pData.x + (pData.velX || 1), pData.y, pData.z + (pData.velZ || 0));
                    
                    const owner = this.remotePlayers.get(pData.ownerId) || (pData.ownerId === this.player.id ? this.player : null);
                    const dummyOwner = { stats: { intelligence: 10, dexterity: 10 }, isRemote: true, isMultiplayer: true };
                    
                    remoteEntity = new Projectile(pData.id, owner || dummyOwner, pData.subType, start, target);
                } else if (pData.type === 'Fence') {
                    remoteEntity = new Fence(pData.id, pData.x, pData.z, pData.rotation || 0);
                    // Add to collision manager
                    const box = new THREE.Box3();
                    
                    // Calculate AABB for rotated fence
                    // Original dimensions: Width 4 (X), Depth 1 (Z)
                    // Increased depth to 4.0 for more solid collision
                    const w = 4.5;
                    const d = 4.0;
                    const rot = pData.rotation || 0;
                    
                    const absCos = Math.abs(Math.cos(rot));
                    const absSin = Math.abs(Math.sin(rot));
                    
                    const newWidth = w * absCos + d * absSin;
                    const newDepth = w * absSin + d * absCos;

                    // Height 8, Center Y 4
                    box.setFromCenterAndSize(new THREE.Vector3(pData.x, 4.0, pData.z), new THREE.Vector3(newWidth, 8, newDepth));
                    this.collisionManager.addCollider(box);
                } else {
                    remoteEntity = this.createRemotePlayer(pData.type || 'Enemy', pData.id, pData.subType); 
                    // console.log(`Created remote entity: ${pData.id} (${pData.type}/${pData.subType})`);
                }
                
                if (remoteEntity) {
                    // Set initial position immediately
                    remoteEntity.position.set(pData.x, pData.y, pData.z);
                    
                    // Set initial rotation immediately to prevent spin-up glitch
                    if (pData.rotation !== undefined) {
                        remoteEntity.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pData.rotation);
                        remoteEntity.targetServerRotation = pData.rotation;
                    }

                    this.remotePlayers.set(pData.id, remoteEntity);
                    this.addEntity(remoteEntity);
                }
            } catch (e) {
                console.error("Error creating entity:", pData.id, e);
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
            if (this.inputManager.isRightMouseDown) {
                this.needsRaycast = true;
                this.performAbility();
            }

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
                        const cooldownMs = this.player.stats.attackSpeed * 1000;
                        if (now - this.player.lastAttackTime < cooldownMs) {
                            return;
                        }
                        this.player.lastAttackTime = now;

                        this.player.state = 'ATTACKING';
                        this.player.playAnimation('Attack', false);
                        
                        const hitDelay = this.player.getAttackHitDelay();

                        setTimeout(() => {
                            if (this.player.state === 'DEAD') return;
                            
                            const attackRange = 6.0;
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
                    const range = (this.player instanceof Wizard || this.player instanceof Rogue) ? 16.0 : 4.0;

                    if (dist < range) {
                        this.player.targetPosition = null;
                        if (this.isMultiplayer) {
                            // Check Attack Speed Cooldown
                            const now = Date.now();
                            const cooldownMs = this.player.stats.attackSpeed * 1000;
                            if (now - this.player.lastAttackTime < cooldownMs) {
                                // Do not return here, as it exits the entire update loop!
                                // Just skip the attack logic for this frame.
                            } else {
                                this.player.lastAttackTime = now;
                                this.performAttack(this.hoveredEntity);
                            }
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
                            
                            if (!this.pendingInteraction) {
                                this.player.move(point);
                            }
                        }
                    }
                }
            }

            this.chunkManager.update(this.player, dt, this.collisionManager, this.floatingTextManager, this);

            if (this.pendingInteraction) {
                // 1. Validate Target
                if (!this.pendingInteraction.isActive || (this.pendingInteraction.state === 'DEAD' && !(this.pendingInteraction instanceof LootDrop))) {
                    this.pendingInteraction = null;
                    // Stop moving if the target is invalid/gone
                    this.player.targetPosition = null;
                    this.player.state = 'IDLE';
                    this.player.playAnimation('Idle');
                } else {
                    // 2. Calculate Distance & Range
                    const dist = new THREE.Vector2(this.player.position.x, this.player.position.z)
                        .distanceTo(new THREE.Vector2(this.pendingInteraction.position.x, this.pendingInteraction.position.z));
                    
                    let range = 5.0; // Tight range for reliable interactions
                    
                    if (this.pendingInteraction instanceof DwarfSalesman) {
                        range = 4.0;
                    } else if (this.pendingInteraction instanceof Actor && this.pendingInteraction !== this.player) {
                        // Dynamic Attack Range based on class
                        // Wizard is the only true ranged class for now
                        if (this.player.constructor.name === 'Wizard') {
                            range = 16.0;
                        } else {
                            range = 5.0; // Melee range (Fighter, Rogue, Cleric) - tighter to ensure server hit
                        }
                    }

                    // 3. Execute Logic
                    if (dist <= range) {
                        // ARRIVED: Interact
                        
                        if (this.pendingInteraction instanceof LootDrop) {
                            this.player.targetPosition = null; 
                            if (this.player.state === 'MOVING') {
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }
                            // Extra check: If item is gone from server (multiplayer), stop trying immediately
                            if (this.isMultiplayer && !this.remotePlayers.has(this.pendingInteraction.id)) {
                                this.pendingInteraction = null;
                                this.player.targetPosition = null;
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            } else {
                                const now = Date.now();
                                if (now - this.lastPickupTime > 250) { // 250ms throttle for retries
                                    this.lastPickupTime = now;
                                    
                                    if (this.isMultiplayer && this.pendingInteraction.onClick) {
                                        this.pendingInteraction.onClick();
                                        // Do NOT clear pendingInteraction immediately.
                                        // We wait for the server to remove the item (via state update).
                                        // This ensures we keep trying or stay close until it's actually gone.
                                    } else if (this.player.addToInventory(this.pendingInteraction.item)) {
                                        console.log(`Picked up ${this.pendingInteraction.item.name}`);
                                        this.uiManager.updateInventory(this.player);
                                        
                                        this.pendingInteraction.isActive = false;
                                        
                                        if (this.pendingInteraction.dispose) {
                                            this.pendingInteraction.dispose();
                                        } else if (this.pendingInteraction.mesh) {
                                            this.renderSystem.remove(this.pendingInteraction.mesh);
                                        }
                                        
                                        const key = this.chunkManager.getChunkKey(this.pendingInteraction.position.x, this.pendingInteraction.position.z);
                                        if (this.chunkManager.chunks.has(key)) {
                                            this.chunkManager.chunks.get(key).delete(this.pendingInteraction);
                                        }
                                        this.pendingInteraction = null; // Local success, clear immediately
                                    } else {
                                        console.log("Inventory full!");
                                        this.pendingInteraction = null; // Stop trying if full
                                    }
                                }
                            }

                        } else if (this.pendingInteraction instanceof DwarfSalesman) {
                            this.player.targetPosition = null; 
                            if (this.player.state === 'MOVING') {
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }
                            this.uiManager.toggleShop();
                            this.pendingInteraction = null;

                        } else if (this.pendingInteraction instanceof QuestNPC) {
                            this.player.targetPosition = null;
                            if (this.player.state === 'MOVING') {
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }
                            this.uiManager.toggleQuestWindow();
                            this.pendingInteraction = null;

                        } else if (this.pendingInteraction instanceof Stash) {
                            this.player.targetPosition = null;
                            if (this.player.state === 'MOVING') {
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }
                            this.uiManager.toggleStash();
                            this.pendingInteraction = null;

                        } else if (this.pendingInteraction instanceof Actor) {
                            let attacked = false;
                            if (this.isMultiplayer) {
                                // Check Attack Speed Cooldown
                                const now = Date.now();
                                const cooldownMs = this.player.stats.attackSpeed * 1000;
                                if (now - this.player.lastAttackTime >= cooldownMs) {
                                    this.player.lastAttackTime = now;

                                    this.performAttack(this.pendingInteraction);
                                    attacked = true;
                                    
                                    // Do NOT clear pendingInteraction to enable Auto-Attack / Chase
                                    // The loop will continue, checking range and cooldown every frame
                                }
                            } else {
                                // Singleplayer Attack
                                if (this.player.attack(this.pendingInteraction, (dmg, target) => {
                                    this.floatingTextManager.spawn(dmg, target.position, '#ffffff');
                                })) {
                                    attacked = true;
                                }
                                // Do NOT clear pendingInteraction
                            }

                            // Movement Logic (Hysteresis)
                            if (!attacked) {
                                const stopRange = range - 0.5;
                                if (dist <= stopRange) {
                                    this.player.targetPosition = null;
                                    if (this.player.state === 'MOVING') {
                                        this.player.state = 'IDLE';
                                        this.player.playAnimation('Idle');
                                    }
                                } else {
                                    // Close in
                                    const target = this.pendingInteraction.position.clone();
                                    target.y = this.player.position.y;
                                    this.player.move(target);
                                }
                            }
                        }
                    } else {
                        // MOVING: Chase Target
                        // Continuously update target position to handle moving targets
                        const target = this.pendingInteraction.position.clone();
                        target.y = this.player.position.y;
                        
                        // Force move every frame to override any idle states
                        this.player.move(target);
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
                this.uiManager.showDeathScreen();
            } else {
                this.uiManager.hideDeathScreen();
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
                        const correctedPos = this.collisionManager.checkCollision(nextPos, this.player.radius, this.player.position);
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
            // Don't send move updates if dead
            if (this.player.state !== 'DEAD' && this.frameCount % 3 === 0) {
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
        
        // Update Ground Texture based on position
        if (this.player) {
            if (this.player.position.z < -600) {
                this.renderSystem.setGroundTexture('snow');
            } else {
                this.renderSystem.setGroundTexture('ground');
            }
        }

        this.floatingTextManager.update(dt);

        // Update Effects
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const effect = this.effects[i];
            effect.update(dt);
            if (!effect.isActive) {
                this.effects.splice(i, 1);
            }
        }
    }

    sendPartyMessage(type, payload) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type, payload }));
        }
    }

    kickPartyMember(targetId) {
        this.sendPartyMessage('party_kick', { targetId });
    }

    promotePartyMember(targetId) {
        this.sendPartyMessage('party_promote', { targetId });
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
            this.uiManager.updateHotbarCooldowns(this.player);
            
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