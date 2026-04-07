import * as THREE from 'three';
import { RenderSystem } from './RenderSystem.js';
import { InputManager } from './InputManager.js';
import { ChunkManager } from './ChunkManager.js';
import { CollisionManager } from './CollisionManager.js';
import { NetworkManager } from './NetworkManager.js';
import { AbilityController } from './AbilityController.js';
import { UIBindings } from './UIBindings.js';
import { CONSTANTS } from './Constants.js';
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
import { RespecNPC } from '../entities/RespecNPC.js';
import { DungeonNPC } from '../entities/DungeonNPC.js';
import { Stash } from '../entities/Stash.js';
import { Forge } from '../entities/Forge.js';
import { RootboundWarden } from '../entities/RootboundWarden.js';
import { BriarMatron } from '../entities/BriarMatron.js';
import { RustboundColossus } from '../entities/RustboundColossus.js';
import { HollowSentinel } from '../entities/HollowSentinel.js';
import { TradingHouse } from '../entities/TradingHouse.js';
import { AvengingSeraph } from '../entities/AvengingSeraph.js';
import { LevelUpEffect } from '../ui/LevelUpEffect.js';
import { AquaGolem } from '../entities/AquaGolem.js';
import { MountainTroll } from '../entities/MountainTroll.js';
// Fire Realm enemies
import { SandstormDjinn } from '../entities/SandstormDjinn.js';
import { MagmaGolem } from '../entities/MagmaGolem.js';
import { ScorchedWraith } from '../entities/ScorchedWraith.js';
import { InfernalBehemoth } from '../entities/InfernalBehemoth.js';
import { PhoenixSentinel } from '../entities/PhoenixSentinel.js';
// Air Realm enemies
import { StormHarpy } from '../entities/StormHarpy.js';
import { CloudElemental } from '../entities/CloudElemental.js';
import { ThunderRoc } from '../entities/ThunderRoc.js';
import { TempestGiant } from '../entities/TempestGiant.js';
import { CycloneAvatar } from '../entities/CycloneAvatar.js';
// Molten Core dungeon bosses (Fire)
import { Cindermaw } from '../entities/Cindermaw.js';
import { ScorchedTwins } from '../entities/ScorchedTwins.js';
import { ForgemasterPyrax } from '../entities/ForgemasterPyrax.js';
import { ObsidianGuardian } from '../entities/ObsidianGuardian.js';
import { LordInfernax } from '../entities/LordInfernax.js';
// Tempest Spire dungeon bosses (Air)
import { Windshear } from '../entities/Windshear.js';
import { Stormcallers } from '../entities/Stormcallers.js';
import { RocMatriarch } from '../entities/RocMatriarch.js';
import { ThunderlordKaelix } from '../entities/ThunderlordKaelix.js';
import { Zephyrion } from '../entities/Zephyrion.js';
import { TiderendLeviathan } from '../entities/TiderendLeviathan.js';
import { DrownedChoir } from '../entities/DrownedChoir.js';
import { AbyssalGoliath } from '../entities/AbyssalGoliath.js';
import { MaelstromWarden } from '../entities/MaelstromWarden.js';
import { Thalorath } from '../entities/Thalorath.js';
import { EnvironmentalHazard } from '../entities/EnvironmentalHazard.js';
import { MeshFactory } from '../utils/MeshFactory.js';
import { createTransientEffect } from './TransientEffects.js';

export class GameEngine {
    constructor(playerType, isMobile = false, isMultiplayer = true, serverAddress = '', username = '', socket = null) {
        this.isMobile = isMobile;
        this.isMultiplayer = true;
        this.serverAddress = serverAddress;
        this.username = username;
        this.network = new NetworkManager(socket);
        /** @deprecated Use this.network instead. Kept for any external code. */
        this.socket = socket;
        this.remotePlayers = new Map();
        this.renderSystem = new RenderSystem(isMobile);
        this.inputManager = new InputManager(this.renderSystem.camera, this.renderSystem.scene);
        if (this.isMobile) {
            this.inputManager.setupMobileControls();
            this.cameraLocked = true;
        }

        this.chunkManager = new ChunkManager(this.renderSystem.entityGroup);
        this.collisionManager = new CollisionManager();
        this.uiManager = new UIManager(this.isMobile);
        this.autoLootEnabled = this.uiManager.getAutoLootEnabled();
        this.uiManager.onAutoLootChange = (enabled) => {
            this.autoLootEnabled = enabled;
        };
        this.cameraShakeEnabled = this.uiManager.getCameraShakeEnabled();
        this.uiManager.onCameraShakeChange = (enabled) => {
            this.cameraShakeEnabled = enabled;
        };
        this.effects = []; // Active visual effects
        this.hazards = new Map(); // Environmental hazards (id -> EnvironmentalHazard)
        this.abilityController = new AbilityController(this);
        this.currentInstanceId = null; // Track current instance to prevent state desync
        this.currentInstanceType = null;
        this.currentDungeonRoomState = null;
        this.currentDungeonLayout = null;
        this.activeBuffs = [];
        this.worldGenerator = new WorldGenerator(this.renderSystem.environmentGroup, this.collisionManager);
        this.minimap = new Minimap();
        this.minimap.setGameEngine(this);
        this.worldMap = new WorldMap(this);
        this.uiBindings = new UIBindings(this);
        this.uiBindings.bindConstructorCallbacks();
        this.floatingTextManager = new FloatingTextManager(this.renderSystem.camera);
        
        this.player = null;
        this.hoveredEntity = null;
        this.dungeonEntranceHint = null;
        this.combatIntent = null;
        this.combatIntentSignature = '';
        this.highlightedCombatTarget = null;
        this.combatTargetHighlight = null;
        this.playerType = playerType || 'Fighter';
        this.enemies = [];
        this.lootDrops = [];
        this.cameraLocked = true;
        this.pendingInteraction = null;
        
        this.lastTime = 0;
        this.accumulator = 0;
        this.fixedTimeStep = 1 / 60;

        this.gameTime = 0;
        this.nextEliteSpawnTime = 180;
        this.lastPickupTime = 0; // Throttle for pickup attempts
        this.lastInventoryFullTime = 0; // Throttle for inventory-full messaging
        this.lastServerInventoryFullTime = 0; // Throttle for server-side inventory-full errors
        this.lastLootFeedbackTime = 0;
        this.lastAutoLootAttemptTime = 0;
        this.autoLootAttemptCooldownMs = 250;

        this.raycastTimer = 0;
        this.mousePosition = new THREE.Vector2();
        this.needsRaycast = false;
        this.activeEntitiesCache = [];
        this.frameCount = 0;
        this.playerJumpState = null;
        this.playerJumpVisualHeight = 0;
        this.lastRenderHudSignature = '';
        this.lastRenderXpSignature = '';
        this.lastRenderHotbarCooldownSignature = '';

        // Entity Creation Throttling
        this.entityCreationQueue = [];
        this.pendingEntityIds = new Set();
        
        // Track recently picked up loot IDs to prevent phantom item recreation
        this.recentlyPickedUpLoot = new Set();
        this.recentlyPickedUpLootTimeout = 5000; // 5 seconds
    }

    get scene() {
        return this.renderSystem.entityGroup;
    }

    get effectScene() {
        return this.renderSystem.effectGroup;
    }

    isPlayerDead() {
        if (!this.player) return false;
        const hp = this.player.stats ? this.player.stats.hp : undefined;
        return this.player.state === 'DEAD' || (hp !== undefined && hp <= 0);
    }

    handlePlayerDeathTransition() {
        if (!this.player) return;

        this.player.die();
        this.player.targetPosition = null;

        this.pendingInteraction = null;
        this.abilityController.pendingAbilityTarget = null;
        this.abilityController.pendingAbilitySkill = null;
        this.player.targetEntity = null;

        if (this.inputManager && this.inputManager.clearInputState) {
            this.inputManager.clearInputState();
        }

        this.syncDeathScreen();
    }

    getDeathScreenDetails() {
        const elapsedSeconds = Number(this.player?.timeSinceDeath || 0);
        return {
            title: 'You Died',
            hint: 'Respawn in town, recover at the Stash, then hit Vendor / Repair or Forge before heading back out.',
            elapsedSeconds
        };
    }

    announceRespawnRecovery(source = 'town') {
        if (!this.uiManager?.addChatMessage) return;
        const locationLabel = source === 'delta'
            ? 'Recovered in town from the last defeat.'
            : 'Recovered in town.';
        this.uiManager.addChatMessage('System', `${locationLabel} Hit Vendor / Repair, Forge, or the Stash before pushing back out.`);
    }

    syncDeathScreen() {
        if (!this.uiManager || !this.player) return;
        if (this.isPlayerDead()) {
            this.uiManager.showDeathScreen(this.getDeathScreenDetails());
        } else {
            this.uiManager.hideDeathScreen();
        }
    }

    spawnTransientEffect(type, position, color, options = {}) {
        const mergedOptions = {
            quality: this.uiManager ? this.uiManager.getGraphicsQuality() : 'high',
            effectScale: this.renderSystem.getEffectQualityScale(),
            ...options
        };
        const effect = createTransientEffect(this.renderSystem.effectGroup, type, position, color, mergedOptions);
        if (!effect) return false;
        this.effects.push(effect);
        return true;
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
        this.syncDeathScreen();

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
        
        this.uiBindings.bindSessionCallbacks();
        
        if (onProgress) onProgress(30, "Initializing UI...");
        await new Promise(r => setTimeout(r, 50));

        if (onProgress) onProgress(40, "Loading environment...");
        await this.renderSystem.preloadEnvironment((p, text) => {
            if (!onProgress) return;
            // Map 0..100 -> 40..55
            const mapped = 40 + Math.round((p / 100) * 15);
            onProgress(mapped, text);
        });

        if (onProgress) onProgress(55, "Preloading models...");
        await MeshFactory.preloadAllModels({
            phase: 'all',
            concurrency: 1,
            failFast: true,
            onProgress: (p, text) => {
                if (!onProgress) return;
                // Map 0..100 -> 55..75
                const mapped = 55 + Math.round((p / 100) * 20);
                onProgress(mapped, text);
            }
        });

        if (onProgress) onProgress(75, "Generating World...");
        await new Promise(r => setTimeout(r, 50));

        console.log("GameEngine: Forcing initial chunk update");
        this.chunkManager.update(this.player, 0, this.collisionManager);

        // In multiplayer, we still need to render the static town
        // Town Center: (0, 200), Radius: 100
        await this.worldGenerator.createTown(0, 200, 100);
        await this.worldGenerator.createOverworldStructures();
        // this.spawnTownEntities();

        if (onProgress) onProgress(90, "Spawning Enemies...");
        await new Promise(r => setTimeout(r, 50));

        if (onProgress) onProgress(95, "Setting up Controls...");
        await new Promise(r => setTimeout(r, 50));

        this.inputManager.subscribe('onClick', (event) => {
            this.handlePrimaryClick(event);
        });

        this.inputManager.subscribe('onRightClick', () => {
            this.abilityController.performAbility();
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
            this.abilityController.performHotbarAbility(slotIndex);
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
                // Send recall request to server to ensure sync
                this.network.send('recall', {});
                
                // Optimistic update
                this.player.position.set(0, 0, 200);
                this.player.targetPosition = null;
                this.player.state = 'IDLE';
                
                this.chunkManager.updateEntityChunk(this.player);
                this.renderSystem.setCameraTarget(this.player.position);
                this.chunkManager.update(this.player, 0, this.collisionManager);
            }
        });

        this.inputManager.subscribe('onMap', () => {
            this.uiManager.toggleWorldMap();
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

        this.inputManager.subscribe('onDebugOverlay', () => {
            const enabled = this.minimap.toggleDungeonDebugOverlay();
            this.uiManager?.addChatMessage?.(`Dungeon debug overlay ${enabled ? 'enabled' : 'disabled'}.`, 'system');
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
        this.network.connect(this.playerType);
    }

    spawnEliteEnemy() {
        const elite = new Skeleton('elite-test');
        elite.isElite = true;
        elite.position.set(10, 0, 10);
        this.enemies.push(elite);
        this.addEntity(elite);
        return elite;
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

    async enterInstance(instanceId, type, layout, roomState = null) {
        console.log(`Entering instance: ${instanceId} (${type})`);
        this.currentInstanceId = instanceId;
        this.currentInstanceType = type;
        this.currentDungeonRoomState = roomState;
        this.currentDungeonLayout = layout || null;
        this.clearCombatIntentState();
        this.refreshDungeonEntranceHint();

        // Clear current dynamic entities through explicit render ownership paths.
        this.remotePlayers.forEach(entity => {
            if (entity.mesh) {
                if (typeof this.renderSystem.remove === 'function') {
                    this.renderSystem.remove(entity.mesh);
                } else if (entity.mesh.parent?.remove) {
                    entity.mesh.parent.remove(entity.mesh);
                }
            }
            if (entity.healthBar) entity.healthBar.remove();
            this.chunkManager.removeEntity(entity);
        });
        this.remotePlayers.clear();

        this.enemies.forEach(e => this.chunkManager.removeEntity(e));
        this.enemies = [];

        this.lootDrops.forEach(e => this.chunkManager.removeEntity(e));
        this.lootDrops = [];

        if (typeof this.renderSystem.clearInstanceScene === 'function') {
            this.renderSystem.clearInstanceScene();
        } else {
            this.renderSystem.entityGroup?.children?.slice().forEach(child => {
                this.renderSystem.entityGroup.remove(child);
            });
            this.renderSystem.effectGroup?.children?.slice().forEach(child => {
                this.renderSystem.effectGroup.remove(child);
            });
        }

        // Clear collisions
        this.collisionManager.clear();

        const hasCanonicalDungeonWalkRects = !!(
            layout &&
            Array.isArray(layout.walkRects) &&
            layout.walkRects.length > 0 &&
            (
                type === 'verdant_bastion_catacombs' ||
                type === 'molten_core' ||
                type === 'tempest_spire' ||
                type === 'abyssal_well'
            )
        );

        if (hasCanonicalDungeonWalkRects) {
            this.collisionManager.setDungeonWalkableGeometry(layout.walkRects);
        } else {
            this.collisionManager.clearDungeonWalkableGeometry();
        }

        // Generate new world
        const worldGen = new WorldGenerator(this.renderSystem.environmentGroup, this.collisionManager);
        if (type === 'crypt') {
            await worldGen.createDungeon(0, 0, 100);
        } else if (type === 'verdant_bastion_catacombs') {
            await worldGen.createVerdantBastionCatacombs(0, 0, layout);
        } else if (type === 'molten_core') {
            await worldGen.createMoltenCore(0, 0, layout);
        } else if (type === 'tempest_spire') {
            await worldGen.createTempestSpire(0, 0, layout);
        } else if (type === 'abyssal_well') {
            await worldGen.createAbyssalWell(0, 0, layout);
        } else {
            // Returning to overworld - ensure persistent environment meshes are re-added
            // after the scene was cleared.
            await this.renderSystem.preloadEnvironment();
            await worldGen.createTown(0, 200, 100);
            await worldGen.createOverworldStructures();
        }

        // Reset player position and state
        let startX = 0;
        let startZ = 0;

        if (layout && layout.rooms && layout.rooms.length > 0) {
            const startRoom = layout.rooms[0];
            startX = startRoom.x;
            startZ = startRoom.z;
        } else if (type === 'crypt') {
            // Default crypt spawn
            startX = 0;
            startZ = 0;
        } else if (type !== 'verdant_bastion_catacombs') {
             // Overworld spawn default
             startX = -1.25;
             startZ = 200;
        }

        this.player.position.set(startX, 0.5, startZ);
        this.player.targetPosition = null; // Clear any pending movement target

        if (this.player.mesh) {
            this.player.mesh.position.set(startX, 0.5, startZ);
            this.renderSystem.add(this.player.mesh); // Ensure player is in scene
            this.player.mesh.visible = true;
            console.log(`Player mesh re-added to scene at ${startX},0.5,${startZ}`);
        } else {
            console.error("Player mesh missing during instance entry!");
        }

        // Force update chunk to ensure player is tracked correctly in new location
        this.chunkManager.updateEntityChunk(this.player);
        
        // Reset Camera
        this.renderSystem.setCameraTarget(this.player.position);
        this.player.targetPosition = null;
        this.player.state = 'IDLE';
        this.player.playAnimation('Idle');

        // Reset Camera
        if (this.cameraLocked) {
            this.renderSystem.setCameraTarget(this.player.position);
        }
    }

    handleServerMessage(msg) {
        if (!this.player) return; // Safety check

        if (msg.type === 'chat') {
            const chatData = msg.payload;
            this.uiManager.addChatMessage(chatData.sender, chatData.message);
        } else if (msg.type === 'inventory') {
            const inventory = msg.payload.map(item => this.hydrateItem(item));
            if (this.player) {
                // Pad with nulls to maintain fixed 25-slot size
                while (inventory.length < 25) {
                    inventory.push(null);
                }
                this.player.inventory = inventory;
                this.uiManager.updateInventory(this.player);
            }
        } else if (msg.type === 'stash') {
            const stash = msg.payload.map(item => this.hydrateItem(item));
            if (this.player) {
                // Pad with nulls to maintain fixed 100-slot size
                while (stash.length < 100) {
                    stash.push(null);
                }
                this.player.stash = stash;
                this.uiManager.updateStash(this.player);
            }
        } else if (msg.type === 'buyback_list') {
            if (msg.payload) {
                const buybackItems = msg.payload.map(item => this.hydrateItem(item));
                this.uiManager.updateBuybackList(buybackItems);
            } else {
                this.uiManager.updateBuybackList([]);
            }
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
                this.abilityController.triggerRemoteAbilityVisuals(source, abilityData.skillName, abilityData.targetX, abilityData.targetZ);
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
                // Only show if player is source or target, or if it's a DoT/hazard effect
                const isHazardDamage = dmgData.sourceId && dmgData.sourceId.startsWith('hazard-');
                if (this.player && (dmgData.sourceId === this.player.id || dmgData.targetId === this.player.id || dmgData.sourceId === 'bleed' || dmgData.sourceId === 'poison' || isHazardDamage)) {
                    let color = '#ffffff';
                    if (dmgData.sourceId === 'bleed') {
                        color = '#8b0000'; // Dark Red for Bleed
                    } else if (dmgData.sourceId === 'poison') {
                        color = '#00ff00'; // Green for Poison
                    } else if (isHazardDamage) {
                        // Color based on hazard type
                        if (dmgData.sourceId.includes('lava')) {
                            color = '#ff4500'; // Orange-Red for Lava
                        } else if (dmgData.sourceId.includes('lightning')) {
                            color = '#00bfff'; // Electric Blue for Lightning
                        } else if (dmgData.sourceId.includes('sandstorm')) {
                            color = '#d2b48c'; // Tan for Sandstorm
                        } else if (dmgData.sourceId.includes('wind')) {
                            color = '#87ceeb'; // Sky Blue for Wind
                        } else {
                            color = '#ff6600'; // Default hazard orange
                        }
                    } else if (target === this.player) {
                        color = '#ff0000'; // Red if player takes damage
                    } else {
                        color = '#ffff00'; // Yellow if player deals damage
                    }
                    
                    this.floatingTextManager.spawn(dmgData.amount, target.position, color);
                }
            }

            // If target is local player, flash screen or shake camera?
            if (this.player && dmgData.targetId === this.player.id) {
                // Visual sync: if we took damage from a remote entity, force its ATTACKING animation.
                // This prevents cases where state updates arrive out-of-sync and enemies appear to "run" while hitting.
                const sourceEntity = this.remotePlayers.get(dmgData.sourceId);
                if (sourceEntity && sourceEntity.isRemote && typeof sourceEntity.updateState === 'function') {
                    sourceEntity.updateState('ATTACKING');
                }
                // this.renderSystem.shakeCamera(0.2);
            }
        } else if (msg.type === 'trading_list') {
            if (msg.payload) {
                const auctions = msg.payload.map(auction => ({
                    ...auction,
                    item: this.hydrateItem(auction.item)
                }));
                this.uiManager.trading.renderAuctionList(auctions);
            }
        } else if (msg.type === 'trading_my_list') {
            if (msg.payload) {
                const auctions = msg.payload.map(auction => ({
                    ...auction,
                    item: this.hydrateItem(auction.item)
                }));
                this.uiManager.trading.renderMyAuctions(auctions);
            }
        } else if (msg.type === 'trading_refresh') {
            this.uiManager.trading.handleSearch();
        } else if (msg.type === 'select_rune') {
            // Server sends updated runes after select_rune
            if (this.player && msg.payload && msg.payload.skillRunes) {
                this.player.skillRunes = msg.payload.skillRunes;
                // Refresh runes tab if open
                if (this.uiManager.skillTree.isOpen && 
                    this.uiManager.skillTree.skillTreeMode === 'runes') {
                    const classType = this.player.subType || this.playerType;
                    this.uiManager.skillTree.renderSkillTree(classType);
                }
            }
        } else if (msg.type === 'combo') {
            // Combo triggered notification
            if (this.player && msg.payload) {
                const { playerId, comboId, comboName } = msg.payload;
                // Only show for local player
                if (playerId === this.player.id) {
                    // Show floating text notification
                    if (this.floatingTextManager && this.player.position) {
                        this.floatingTextManager.spawn(`COMBO: ${comboName}!`, this.player.position, '#ffd700');
                    }
                    // Trigger UI notification
                    if (this.uiManager) {
                        this.uiManager.showComboNotification(comboName, comboId);
                    }
                    console.log(`[Combo] Triggered: ${comboName} (${comboId})`);
                }
            }
        } else if (msg.type === 'reward_summary') {
            const summary = msg.payload;
            if (this.player && summary && summary.playerId === this.player.id) {
                if (this.floatingTextManager && this.player.position) {
                    this.floatingTextManager.spawn('BOSS DEFEATED!', this.player.position, '#ffd700', '32px');
                }
                if (this.uiManager && this.uiManager.showRewardSummary) {
                    this.uiManager.showRewardSummary(summary);
                }
            }
        } else if (msg.type === 'room_clear_reward') {
            const summary = msg.payload;
            if (this.player && summary && summary.playerId === this.player.id) {
                if (this.floatingTextManager && this.player.position) {
                    this.floatingTextManager.spawn('ROOM CLEARED!', this.player.position, '#7CFFB2', '26px');
                }
                if (summary?.buffName && Number(summary.buffDurationSeconds) > 0) {
                    this.upsertActiveBuff({
                        id: String(summary.buffName).toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                        name: summary.buffName,
                        icon: summary.buffName === 'Sanctuary' ? '🛡️' : '✨',
                        detail: summary.damageReductionPct
                            ? `${summary.damageReductionPct}% DR from shrine blessing`
                            : summary.hint || '',
                        durationSeconds: Number(summary.buffDurationSeconds),
                        expiresAt: Date.now() + (Number(summary.buffDurationSeconds) * 1000)
                    });
                }
                if (this.currentDungeonRoomState) {
                        const updatedRooms = Array.isArray(this.currentDungeonRoomState.rooms)
                            ? this.currentDungeonRoomState.rooms.map((room) => {
                            if (!room || typeof room.index !== 'number') return room;
                            if (typeof summary.roomIndex === 'number' && room.index === summary.roomIndex) {
                                return { ...room, explored: true, cleared: true };
                            }
                            if (typeof summary.objectiveRoomIndex === 'number' && summary.objectiveRoomIndex >= 0 && room.index === summary.objectiveRoomIndex) {
                                return { ...room, explored: true };
                            }
                            return room;
                        })
                        : this.currentDungeonRoomState.rooms;

                    this.currentDungeonRoomState = {
                        ...this.currentDungeonRoomState,
                        objectiveRoomIndex: typeof summary.objectiveRoomIndex === 'number'
                            ? summary.objectiveRoomIndex
                            : this.currentDungeonRoomState.objectiveRoomIndex,
                        rooms: updatedRooms
                    };
                }
                if (this.uiManager && this.uiManager.showRoomClearReward) {
                    this.uiManager.showRoomClearReward(summary);
                }
            }
        } else if (msg.type === 'telegraph') {
            // Boss AoE telegraph — show a warning circle on the ground
            const data = msg.payload;
            if (data) {
                const pos = new THREE.Vector3(data.x, 0, data.z);
                const threatTier = data.threatTier || 'boss';
                const label = data.label || (threatTier === 'boss' ? 'BOSS' : threatTier === 'lethal' ? 'DANGER' : 'WATCH');
                this.spawnTransientEffect('telegraph', pos, 0xff2200, {
                    radius: data.radius || 10,
                    telegraphDuration: data.duration || 2.0,
                    threatTier,
                    label
                });
                if (this.uiManager?.showCombatCallout) {
                    this.uiManager.showCombatCallout({
                        title: label,
                        tone: threatTier,
                        duration: Number(data.duration || 2.0),
                        subtitle: threatTier === 'boss' ? 'Brace for impact' : 'Incoming attack'
                    });
                }
            }
        } else if (msg.type === 'error') {
            console.error("Server Error:", msg.payload);

            // Special-case: Inventory full is a common, non-fatal error.
            // If we're in the middle of an auto-retry pickup interaction, stop retrying.
            if (typeof msg.payload === 'string' && msg.payload.toLowerCase().includes('inventory full')) {
                const now = Date.now();

                // Stop the pickup retry loop (auto-walk interact) immediately.
                if (this.pendingInteraction instanceof LootDrop) {
                    this.pendingInteraction = null;
                    if (this.player) {
                        this.player.targetPosition = null;
                        this.player.state = 'IDLE';
                        if (this.player.playAnimation) this.player.playAnimation('Idle');
                    }
                }

                // Show a single, throttled message instead of spamming alert().
                if (now - (this.lastServerInventoryFullTime || 0) > 1000) {
                    this.lastServerInventoryFullTime = now;
                    this.showLootFailureFeedback('inventory_full');
                }
                return;
            }

            if (typeof alert !== 'undefined') {
                alert(`Server Error: ${msg.payload}`);
            }
            if (typeof msg.payload === 'string' && msg.payload.includes("Logged in from another location")) {
                this.network.isExpectedDisconnect = true;
                window.location.reload();
            }
        } else if (msg.type === 'enter_instance') {
            const instanceData = msg.payload;
            console.log(`GameEngine: Received enter_instance. ID: ${instanceData.instanceId}, Type: ${instanceData.type}`);
            void this.enterInstance(instanceData.instanceId, instanceData.type, instanceData.layout, instanceData.roomState || null)
                .catch(e => console.error('Failed to enter instance:', e));
        } else if (msg.type === 'dungeon_room_state') {
            this.currentDungeonRoomState = msg.payload || null;
        } else if (msg.type === 'get_dungeon_status') {
            if (this.uiManager) {
                this.uiManager.showDungeonMenu(msg.payload);
            }
        } else if (msg.type === 'state') {
            const state = msg.payload;
            const seenIds = new Set();
            
            // One-time log on first state message received
            if (!this._firstStateReceived) {
                this._firstStateReceived = true;
                const entityCount = Object.keys(state).length;
                const types = {};
                Object.values(state).forEach(e => { types[e.type] = (types[e.type] || 0) + 1; });
                console.log(`First state received: ${entityCount} entities`, types);
            }

            // Debug log for entity count (throttled)
            if (this.frameCount % 600 === 0) {
                console.log(`Received state with ${Object.keys(state).length} entities`);
            }

            // Update remote players
            Object.values(state).forEach(pData => {
                this.applyPositionHacks(pData);

                seenIds.add(pData.id);

                if (pData.id === this.player.id) {
                    // Update local player stats from server
                    if (this.player) {
                        // Initialize currentInstanceId if null (first connection)
                        if (!this.currentInstanceId && pData.instanceId) {
                            this.currentInstanceId = pData.instanceId;
                        }

                        // Check for instance mismatch (ignore stale state updates during transition)
                        if (pData.instanceId && this.currentInstanceId && pData.instanceId !== this.currentInstanceId) {
                            // console.log(`Ignoring state update from wrong instance: ${pData.instanceId} vs ${this.currentInstanceId}`);
                            return;
                        }

                        let justRespawned = false;

                        // Sync State
                        const nextHp = pData.health !== undefined ? pData.health : this.player.stats?.hp;
                        const hasPredictedJump = !!this.playerJumpState && !this.playerJumpState.serverDriven;
                        if (pData.state !== undefined) {
                            if (this.player.state !== 'DEAD' && (pData.state === 'DEAD' || (nextHp !== undefined && nextHp <= 0))) {
                                this.handlePlayerDeathTransition();
                            } else if (this.player.state === 'DEAD' && pData.state !== 'DEAD') {
                                if (nextHp !== undefined && nextHp <= 0) {
                                    this.handlePlayerDeathTransition();
                                } else {
                                    // Revived?
                                    // Force town spawn (-1.25, 200) to ensure immediate visual feedback
                                    const x = -1.25;
                                    const z = 200;

                                    console.log(`GameEngine: Respawn detected. Teleporting to Town (${x}, ${z})`);
                                    this.player.respawn(x, z);
                                    this.player.state = pData.state; // Ensure state matches server
                                    this.player.timeSinceDeath = null;

                                    this.chunkManager.updateEntityChunk(this.player);
                                    this.renderSystem.setCameraTarget(this.player.position);
                                    this.announceRespawnRecovery('state');
                                    justRespawned = true;
                                }
                            } else if (!(hasPredictedJump && pData.state !== 'JUMPING')) {
                                this.player.state = pData.state;
                            }
                        } else if (pData.health !== undefined && pData.health <= 0 && this.player.state !== 'DEAD') {
                            // Some delta/full packets can arrive with HP updates before/without state.
                            // Ensure local death presentation still triggers when health reaches zero.
                            this.handlePlayerDeathTransition();
                        }

                        // Check for forced teleport (large distance discrepancy)
                        // This handles portals or admin teleports where state might not change from DEAD
    
                        if (pData.state === 'JUMPING') {
                            this.syncAuthoritativeJumpState(this.player, pData);
                        } else if (pData.state !== undefined) {
                            this.clearAuthoritativeJumpState(this.player);
                        }

                        if (!justRespawned && pData.x !== undefined && pData.z !== undefined) {
                            const serverPos = new THREE.Vector3(pData.x, pData.y || 0, pData.z);
                            const horizontalPos = new THREE.Vector3(pData.x, this.player.position.y, pData.z);
                            const dist = this.player.position.distanceTo(horizontalPos);
                            if (pData.state === 'JUMPING' || dist > 20.0) { // Threshold for teleport (larger than normal lag correction)
                                console.log(`GameEngine: Detected server teleport, syncing position. Dist: ${dist}, Server: ${serverPos.x},${serverPos.z}, Client: ${this.player.position.x},${this.player.position.z}`);
                                if (pData.state === 'JUMPING') {
                                    this.player.position.x = serverPos.x;
                                    this.player.position.z = serverPos.z;
                                } else {
                                    this.player.position.copy(serverPos);
                                }
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
                                const effect = new LevelUpEffect(this.renderSystem.effectGroup, this.player.position);
                                this.effects.push(effect);
                                
                                // Floating Text
                                this.floatingTextManager.spawn("LEVEL UP!", 
                                    new THREE.Vector3(this.player.position.x, this.player.position.y + 2, this.player.position.z), 
                                    '#ffd700' // Gold
                                );

                                // Chat Notification
                                this.network.send('chat', {
                                    message: `* has reached level ${pData.level}! *`,
                                    sender: this.username || "Player"
                                });
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
                            if (pData.damage !== undefined) this.player.stats.damage = pData.damage;
                            if (pData.defense !== undefined) this.player.stats.defense = pData.defense;
                            if (pData.speed !== undefined) this.player.stats.speed = pData.speed;
                            if (pData.attackSpeed !== undefined) this.player.stats.attackSpeed = pData.attackSpeed;
                            if (pData.cooldownReduction !== undefined) this.player.stats.cooldownReduction = pData.cooldownReduction;
                        }

                        // Sync Skills
                        const prevBranch = this.player.selectedBranch;
                        const prevPoints = this.player.skillPoints;
                        const prevUnlocked = this.player.unlockedSkills ? this.player.unlockedSkills.length : 0;

                        // Sync Talents
                        const prevTalentPoints = this.player.talentPoints || 0;
                        const talentSig = (ranks) => {
                            if (!ranks) return '0:0';
                            let keys = 0;
                            let sum = 0;
                            for (const k in ranks) {
                                const v = ranks[k] | 0;
                                if (v > 0) { keys++; sum += v; }
                            }
                            return `${keys}:${sum}`;
                        };
                        const prevTalentSig = talentSig(this.player.talentRanks);

                        this.player.skillPoints = pData.skillPoints;
                        this.player.selectedBranch = pData.selectedBranch;
                        this.player.unlockedSkills = pData.unlockedSkills;

                        // Server-authoritative talents: always apply the decoded values.
                        // (Proto3 defaults will decode as 0/empty when truly unset.)
                        if (pData.talentPoints !== undefined) this.player.talentPoints = pData.talentPoints;
                        if (pData.talentRanks !== undefined) this.player.talentRanks = pData.talentRanks || {};

                        // Server-authoritative skill runes
                        if (pData.skillRunes !== undefined) this.player.skillRunes = pData.skillRunes || {};

                        const currUnlocked = this.player.unlockedSkills ? this.player.unlockedSkills.length : 0;

                        // Update Hotbar if skills changed or if we have skills but hotbar is empty
                        const isHotbarEmpty = !this.player.hotbar || this.player.hotbar.every(s => !s);
                        if (prevUnlocked !== currUnlocked || prevBranch !== this.player.selectedBranch || (currUnlocked > 0 && isHotbarEmpty)) {
                            console.log(`Updating Hotbar: Skills=${currUnlocked}, Branch=${this.player.selectedBranch}, Empty=${isHotbarEmpty}`);
                            this.uiManager.updateHotbar(this.player);
                        }

                        // Refresh Skill Tree if open and data changed
                        if (this.uiManager.skillTree.isOpen) {
                             if (prevBranch !== this.player.selectedBranch || 
                                 prevPoints !== this.player.skillPoints || 
                                 prevUnlocked !== currUnlocked ||
                                 prevTalentPoints !== (this.player.talentPoints || 0) ||
                                 prevTalentSig !== talentSig(this.player.talentRanks)) {
                                     const classType = this.player.subType || this.playerType;
                                     this.uiManager.skillTree.renderSkillTree(classType);
                             }
                        }

                        // Sync Equipment
                        if (pData.equipment) {
                            this.player.equipment = pData.equipment;
                            // Hydrate Rarity for UI
                            for (const key in this.player.equipment) {
                                this.player.equipment[key] = this.hydrateItem(this.player.equipment[key]);
                            }
                            
                            // Force UI Update if Forge is open
                            if (this.uiManager.forge.isOpen) {
                                this.uiManager.forge.updateForgeUI(this.player);
                                this.uiManager.forge.updateForgePotencyUI(this.player);
                                this.uiManager.forge.updateForgeSocketUI(this.player);
                                
                                // Update selected item info if any
                                if (this.uiManager.forge.selectedForgeSlot) {
                                    const item = this.player.equipment[this.uiManager.forge.selectedForgeSlot];
                                    this.uiManager.forge.updateForgeInfo(item);
                                }
                                if (this.uiManager.forge.selectedForgePotencySlot) {
                                    const item = this.player.equipment[this.uiManager.forge.selectedForgePotencySlot];
                                    this.uiManager.forge.updateForgePotencyInfo(item);
                                }
                                if (this.uiManager.forge.selectedForgeSocketSlot) {
                                    const item = this.player.equipment[this.uiManager.forge.selectedForgeSocketSlot];
                                    this.uiManager.forge.updateForgeSocketInfo(item);
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
                    this.syncDeathScreen();
                    return; // Skip self
                }

                let remoteEntity = this.remotePlayers.get(pData.id);
                if (!remoteEntity) {
                    this.queueEntityCreation(pData);
                    this.syncDeathScreen();
                    return;
                }
                
                this.syncRemoteEntity(remoteEntity, pData);
            });

            // Cleanup removed entities
            for (const [id] of this.remotePlayers) {
                if (!seenIds.has(id)) {
                    this.removeRemoteEntity(id);
                }
            }
        } else if (msg.type === 'delta') {
            // Delta compression: Only changed entities and removals
            const delta = msg.payload;
            const updates = delta.u || {};  // Updated/new entities
            const removed = delta.r || [];  // Removed entity IDs

            // Process updated entities
            Object.values(updates).forEach(pData => {
                this.applyPositionHacks(pData);

                // Skip self - local player updates come through full state messages
                if (pData.id === this.player.id) {
                    // Still update critical player state from delta
                    if (this.player && this.player.stats) {
                        const nextHp = pData.health !== undefined ? pData.health : this.player.stats.hp;
                        const hasPredictedJump = !!this.playerJumpState && !this.playerJumpState.serverDriven;
                        if (pData.state !== undefined) {
                            if (this.player.state !== 'DEAD' && (pData.state === 'DEAD' || (nextHp !== undefined && nextHp <= 0))) {
                                this.handlePlayerDeathTransition();
                            } else if (this.player.state === 'DEAD' && pData.state !== 'DEAD') {
                                if (nextHp !== undefined && nextHp <= 0) {
                                    this.handlePlayerDeathTransition();
                                } else {
                                    const x = pData.x !== undefined ? pData.x : -1.25;
                                    const z = pData.z !== undefined ? pData.z : 200;
                                    console.log(`GameEngine: Respawn detected from delta. Teleporting to (${x}, ${z})`);
                                    this.player.respawn(x, z);
                                    this.player.state = pData.state;
                                    this.player.timeSinceDeath = null;
                                    this.chunkManager.updateEntityChunk(this.player);
                                    this.renderSystem.setCameraTarget(this.player.position);
                                    this.chunkManager.update(this.player, 0, this.collisionManager);
                                    this.announceRespawnRecovery('delta');
                                }
                            } else if (!(hasPredictedJump && pData.state !== 'JUMPING')) {
                                this.player.state = pData.state;
                            }
                        }

                        if (pData.state === 'JUMPING') {
                            this.syncAuthoritativeJumpState(this.player, pData);
                        } else if (pData.state !== undefined) {
                            this.clearAuthoritativeJumpState(this.player);
                        }

                        if (pData.x !== undefined && pData.z !== undefined) {
                            const serverPos = new THREE.Vector3(pData.x, pData.y || 0, pData.z);
                            const horizontalPos = new THREE.Vector3(pData.x, this.player.position.y, pData.z);
                            const dist = this.player.position.distanceTo(horizontalPos);
                            if (pData.state === 'JUMPING' || dist > 20.0) {
                                console.log(`GameEngine: Detected self teleport from delta, syncing position. Dist: ${dist}`);
                                if (pData.state === 'JUMPING') {
                                    this.player.position.x = serverPos.x;
                                    this.player.position.z = serverPos.z;
                                } else {
                                    this.player.position.copy(serverPos);
                                }
                                this.player.targetPosition = null;
                                this.chunkManager.updateEntityChunk(this.player);
                                this.renderSystem.setCameraTarget(this.player.position);
                            }
                        }

                        if (pData.health !== undefined) this.player.stats.hp = pData.health;
                        if (pData.maxHealth !== undefined) this.player.stats.maxHp = pData.maxHealth;
                        if (pData.mana !== undefined) this.player.stats.mana = pData.mana;
                        if (pData.maxMana !== undefined) this.player.stats.maxMana = pData.maxMana;

                        if (pData.state === undefined && pData.health !== undefined && pData.health <= 0 && this.player.state !== 'DEAD') {
                            this.handlePlayerDeathTransition();
                        }
                        
                        // Sync Attributes from Server
                        if (pData.stats) {
                            this.player.stats.strength = pData.stats.strength;
                            this.player.stats.dexterity = pData.stats.dexterity;
                            this.player.stats.intelligence = pData.stats.intelligence;
                            this.player.stats.wisdom = pData.stats.wisdom;
                            this.player.stats.vitality = pData.stats.vitality;
                        }
                        
                        // Sync Derived Stats
                        if (pData.damage !== undefined) this.player.stats.damage = pData.damage;
                        if (pData.defense !== undefined) this.player.stats.defense = pData.defense;
                        if (pData.speed !== undefined) this.player.stats.speed = pData.speed;
                        if (pData.attackSpeed !== undefined) this.player.stats.attackSpeed = pData.attackSpeed;
                        if (pData.cooldownReduction !== undefined) this.player.stats.cooldownReduction = pData.cooldownReduction;
                    }
                    
                    // Sync Skills
                    if (pData.selectedBranch !== undefined || pData.unlockedSkills !== undefined || pData.skillPoints !== undefined) {
                        const prevBranch = this.player.selectedBranch;
                        const prevPoints = this.player.skillPoints;
                        const prevUnlocked = this.player.unlockedSkills ? this.player.unlockedSkills.length : 0;
                        
                        if (pData.skillPoints !== undefined) this.player.skillPoints = pData.skillPoints;
                        if (pData.selectedBranch !== undefined) this.player.selectedBranch = pData.selectedBranch;
                        if (pData.unlockedSkills !== undefined) this.player.unlockedSkills = pData.unlockedSkills;
                        
                        const currUnlocked = this.player.unlockedSkills ? this.player.unlockedSkills.length : 0;
                        
                        // Update Hotbar if skills changed
                        const isHotbarEmpty = !this.player.hotbar || this.player.hotbar.every(s => !s);
                        if (prevUnlocked !== currUnlocked || prevBranch !== this.player.selectedBranch || (currUnlocked > 0 && isHotbarEmpty)) {
                            console.log(`[Delta] Updating Hotbar: Skills=${currUnlocked}, Branch=${this.player.selectedBranch}`);
                            this.uiManager.updateHotbar(this.player);
                        }
                        
                        // Refresh Skill Tree if open
                        if (this.uiManager.skillTree.isOpen) {
                            if (prevBranch !== this.player.selectedBranch || 
                                prevPoints !== this.player.skillPoints || 
                                prevUnlocked !== currUnlocked) {
                                const classType = this.player.subType || this.playerType;
                                this.uiManager.skillTree.renderSkillTree(classType);
                            }
                        }
                    }

                    // Sync Talents (delta path)
                    if (pData.talentPoints !== undefined || pData.talentRanks !== undefined || pData.unlockedTalents !== undefined) {
                        const prevTalentPoints = this.player.talentPoints || 0;
                        const talentSig = (ranks) => {
                            if (!ranks) return '0:0';
                            let keys = 0;
                            let sum = 0;
                            for (const k in ranks) {
                                const v = ranks[k] | 0;
                                if (v > 0) { keys++; sum += v; }
                            }
                            return `${keys}:${sum}`;
                        };
                        const prevTalentSig = talentSig(this.player.talentRanks);

                        // Server-authoritative talents: always apply the decoded values.
                        if (pData.talentPoints !== undefined) this.player.talentPoints = pData.talentPoints;
                        if (pData.talentRanks !== undefined) this.player.talentRanks = pData.talentRanks || {};

                        if (this.uiManager.skillTree.isOpen) {
                            if (prevTalentPoints !== (this.player.talentPoints || 0) ||
                                prevTalentSig !== talentSig(this.player.talentRanks)) {
                                const classType = this.player.subType || this.playerType;
                                this.uiManager.skillTree.renderSkillTree(classType);
                            }
                        }
                    }
                    
                    // Sync XP, Level, Gold
                    // Protobuf entity fields use experience/maxExperience; legacy JSON used xp/xpToNextLevel.
                    if (pData.experience !== undefined) this.player.xp = pData.experience;
                    if (pData.maxExperience !== undefined) this.player.xpToNextLevel = pData.maxExperience;
                    if (pData.xp !== undefined) this.player.xp = pData.xp;
                    if (pData.xpToNextLevel !== undefined) this.player.xpToNextLevel = pData.xpToNextLevel;

                    // Level Up Detection (delta path)
                    if (pData.level !== undefined) {
                        if (this.player.level < pData.level) {
                            if (this.player.hasSyncedLevel) {
                                console.log(`Level Up! ${this.player.level} -> ${pData.level}`);

                                const effect = new LevelUpEffect(this.renderSystem.effectGroup, this.player.position);
                                this.effects.push(effect);

                                this.floatingTextManager.spawn(
                                    "LEVEL UP!",
                                    new THREE.Vector3(this.player.position.x, this.player.position.y + 2, this.player.position.z),
                                    '#ffd700'
                                );

                                this.network.send('chat', {
                                    message: `* has reached level ${pData.level}! *`,
                                    sender: this.username || "Player"
                                });
                            }
                            this.player.level = pData.level;
                        } else {
                            this.player.level = pData.level;
                        }
                        this.player.hasSyncedLevel = true;
                    }

                    if (pData.gold !== undefined) this.player.gold = pData.gold;

                    // Keep XP/Level UI responsive when updates arrive via delta.
                    if (this.player.xp !== this.lastXP || this.player.xpToNextLevel !== this.lastMaxXP || this.player.level !== this.lastLevel) {
                        console.log(`Updating XP/Level UI: Level=${this.player.level}, XP=${this.player.xp}`);
                        this.uiManager.updateXP(this.player);
                        this.lastXP = this.player.xp;
                        this.lastMaxXP = this.player.xpToNextLevel;
                        this.lastLevel = this.player.level;
                    }
                    
                    // Sync Inventory
                    if (pData.inventory !== undefined) {
                        const inventory = Array.isArray(pData.inventory) ? [...pData.inventory] : [];
                        while (inventory.length < 25) {
                            inventory.push(null);
                        }
                        this.player.inventory = inventory;
                        for (let i = 0; i < this.player.inventory.length; i++) {
                            this.player.inventory[i] = this.hydrateItem(this.player.inventory[i]);
                        }
                        this.uiManager.updateInventory(this.player);
                    }
                    
                    // Sync Equipment
                    if (pData.equipment) {
                        this.player.equipment = pData.equipment;
                        for (const key in this.player.equipment) {
                            this.player.equipment[key] = this.hydrateItem(this.player.equipment[key]);
                        }
                    }
                    
                    return;
                }

                const remoteEntity = this.remotePlayers.get(pData.id);
                if (!remoteEntity) {
                    this.queueEntityCreation(pData);
                    return;
                }

                this.syncRemoteEntity(remoteEntity, pData);
            });

            // Process removed entities
            for (const id of removed) {
                // Check if it's a hazard first
                if (this.hazards.has(id)) {
                    const hazard = this.hazards.get(id);
                    hazard.removeFromScene(this.renderSystem.environmentGroup);
                    hazard.dispose();
                    this.hazards.delete(id);
                    continue;
                }

                this.removeRemoteEntity(id);
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

    // ------------------------------------------------------------------
    // Shared helpers for state/delta remote-entity sync
    // ------------------------------------------------------------------

    /**
     * Apply position-override hacks for entities whose server coords
     * are known to be stale / incorrect.
     * @param {Object} pData  Entity payload (mutated in-place)
     */
    applyPositionHacks(pData) {
        if (pData.id === 'quest-npc-1') {
            pData.x = -25;
            pData.z = 200;
            pData.rotation = Math.PI / 2;
        }
        if (pData.id === 'stash-1') {
            pData.x = 0;
            pData.z = 185;
        }
        if (pData.id === 'merchant-1') {
            pData.x = 22.5;
            pData.z = 200;
        }
    }

    /**
     * Queue a new remote entity for batched creation when it hasn't been
     * seen before.  Returns true if the entity was queued (caller should
     * skip the rest of the update for this entity).
     *
     * @param {Object} pData  Entity payload
     * @returns {boolean}
     */
    queueEntityCreation(pData) {
        if (pData.type === 'Loot' && this.recentlyPickedUpLoot.has(pData.id)) {
            return true; // skip phantom loot
        }

        if (!this.pendingEntityIds.has(pData.id)) {
            this.pendingEntityIds.add(pData.id);
            this.entityCreationQueue.push(pData);
        } else {
            // Update pending creation with latest data
            const idx = this.entityCreationQueue.findIndex(e => e.id === pData.id);
            if (idx !== -1) {
                this.entityCreationQueue[idx] = { ...this.entityCreationQueue[idx], ...pData };
            }
        }
        return true;
    }

    /**
     * Synchronise a remote entity's position, state, health, animation,
     * rotation, and level from a server payload (used by both `state` and
     * `delta` message handlers).
     *
     * @param {import('../entities/Actor.js').Actor} remoteEntity
     * @param {Object} pData  Entity payload from server
     */
    syncRemoteEntity(remoteEntity, pData) {
        const previousRemotePosition = remoteEntity.position?.clone?.() || new THREE.Vector3();

        // --- Position / Interpolation ---
        if (pData.type === 'Projectile') {
            remoteEntity.position.set(pData.x, pData.y ?? 0, pData.z);
            if (pData.velX !== undefined && pData.velZ !== undefined) {
                remoteEntity.velocity.set(pData.velX, 0, pData.velZ);
            }
        } else {
            const newPos = new THREE.Vector3(pData.x, pData.y ?? 0, pData.z);
            if (!remoteEntity.targetServerPosition) {
                remoteEntity.position.copy(newPos);
                remoteEntity.targetServerPosition = newPos;
            } else {
                if (remoteEntity.position.distanceTo(newPos) > 10.0) {
                    remoteEntity.position.copy(newPos);
                }
                remoteEntity.targetServerPosition = newPos;
            }
        }

        if (pData.state === 'JUMPING') {
            this.syncAuthoritativeJumpState(remoteEntity, {
                ...pData,
                _previousPosition: previousRemotePosition
            });
        } else {
            this.clearAuthoritativeJumpState(remoteEntity);
        }

        // Chunk visibility
        this.chunkManager.updateEntityChunk(remoteEntity);

        // Name
        if (pData.name && remoteEntity.name !== pData.name) {
            remoteEntity.setName(pData.name);
        }

        // Scale
        if (pData.scale !== undefined && remoteEntity.scale !== pData.scale) {
            remoteEntity.setScale(pData.scale);
        }

        // Spirits (Cleric)
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

        // --- Death handling ---
        if (pData.state === 'DEAD') {
            if (!remoteEntity.isDead) {
                remoteEntity.isDead = true;
                remoteEntity.deadTimer = 0;
                if (remoteEntity.updateState) {
                    remoteEntity.updateState('DEAD');
                } else {
                    remoteEntity.state = 'DEAD';
                }
                if (remoteEntity.playAnimation) {
                    remoteEntity.playAnimation('Death', false);
                }
            }
        } else {
            remoteEntity.isDead = false;
            remoteEntity.deadTimer = 0;
            if (remoteEntity.mesh) remoteEntity.mesh.visible = true;

            // Stats
            if (remoteEntity.stats) {
                if (pData.health !== undefined) remoteEntity.stats.hp = pData.health;
                if (pData.maxHealth !== undefined) remoteEntity.stats.maxHp = pData.maxHealth;
                if (pData.mana !== undefined) remoteEntity.stats.mana = pData.mana;
                if (pData.maxMana !== undefined) remoteEntity.stats.maxMana = pData.maxMana;
                if (pData.speed !== undefined) remoteEntity.stats.speed = pData.speed;
                if (pData.attackSpeed !== undefined) remoteEntity.stats.attackSpeed = pData.attackSpeed;
            }

            // State / Animation
            if (remoteEntity.state !== pData.state || (pData.isCharging !== undefined && remoteEntity.isCharging !== pData.isCharging)) {
                if (remoteEntity.updateState) {
                    remoteEntity.updateState(pData.state);
                } else {
                    remoteEntity.state = pData.state;
                }
                if (pData.isCharging !== undefined) remoteEntity.isCharging = pData.isCharging;
            } else if (pData.state === 'ATTACKING' && remoteEntity.updateState) {
                remoteEntity.updateState(pData.state);
            }

            // Rotation
            if (pData.rotation !== undefined) {
                remoteEntity.targetServerRotation = pData.rotation;
            }

            // Remote level-up detection
            if (pData.level !== undefined) {
                if (!remoteEntity.hasSyncedLevel) {
                    remoteEntity.level = pData.level;
                    remoteEntity.hasSyncedLevel = true;
                } else if (remoteEntity.level < pData.level) {
                    remoteEntity.level = pData.level;
                    const effect = new LevelUpEffect(this.renderSystem.effectGroup, remoteEntity.position);
                    this.effects.push(effect);
                }
            }
        }
    }

    /**
     * Remove an entity by id — disposes mesh, removes from chunk and
     * remotePlayers map.
     * @param {string} id
     */
    removeRemoteEntity(id) {
        const entity = this.remotePlayers.get(id);
        if (!entity) return;

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

    isLootEntity(entity) {
        return entity instanceof LootDrop;
    }

    getLootPickupRadius(entity = null) {
        const radius = this.getInteractionRangeForEntity ? this.getInteractionRangeForEntity(entity) : 5.0;
        return Math.max(2.5, radius);
    }

    canAttemptLootPickup(entity) {
        if (!this.player || !this.isLootEntity(entity) || !entity?.isActive || !entity?.position) return false;
        const dx = this.player.position.x - entity.position.x;
        const dz = this.player.position.z - entity.position.z;
        return Math.sqrt(dx * dx + dz * dz) <= this.getLootPickupRadius(entity);
    }

    formatLootPickupMessage(entity) {
        const item = entity?.item;
        if (!item) return 'Picked up loot';
        const rarityName = typeof item.rarity === 'string'
            ? item.rarity
            : (item.rarity?.name || item.gemQuality || 'Loot');
        return `${rarityName}: ${item.name}`;
    }

    showLootPickupFeedback(entity, result = 'picked_up') {
        if (!entity || result !== 'picked_up') return;
        const message = this.formatLootPickupMessage(entity);
        const color = this.uiManager?.getRarityColor?.(entity.item?.rarity) || entity.itemColor || '#ffd700';

        if (this.floatingTextManager && this.player?.position) {
            this.floatingTextManager.spawn(message.toUpperCase(), this.player.position, color);
        }
        if (this.uiManager?.showLootPickupToast) {
            this.uiManager.showLootPickupToast(message, { sender: 'Loot' });
        }
    }

    showLootFailureFeedback(reason = 'inventory_full') {
        if (!this.player?.position) return;
        const now = Date.now();
        if (reason === 'inventory_full') {
            if (now - (this.lastInventoryFullTime || 0) <= 1000) return;
            this.lastInventoryFullTime = now;
            this.floatingTextManager?.spawn('INVENTORY FULL', this.player.position, '#ff4444');
            this.uiManager?.showLootPickupToast?.('Inventory full', { sender: 'Loot' });
        }
    }

    findNearestLootInRange(radius = this.getLootPickupRadius()) {
        if (!this.player || !this.activeEntitiesCache) return null;
        let nearest = null;
        let nearestDistance = radius;

        for (const entity of this.activeEntitiesCache) {
            if (!this.isLootEntity(entity) || !entity.isActive || this.recentlyPickedUpLoot.has(entity.id)) continue;
            const dx = this.player.position.x - entity.position.x;
            const dz = this.player.position.z - entity.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= nearestDistance) {
                nearest = entity;
                nearestDistance = dist;
            }
        }

        return nearest;
    }

    shouldAutoLootEntity(entity) {
        return Boolean(this.autoLootEnabled && this.canAttemptLootPickup(entity));
    }

    processAutoLoot() {
        if (!this.autoLootEnabled || !this.player || this.isPlayerDead?.()) return;
        const now = Date.now();
        if (now - (this.lastAutoLootAttemptTime || 0) < this.autoLootAttemptCooldownMs) return;

        const nearestLoot = this.findNearestLootInRange();
        if (!nearestLoot) return;

        this.lastAutoLootAttemptTime = now;
        this.pickupLoot(nearestLoot.id);
    }

    updateLootVisualFeedback() {
        if (!this.activeEntitiesCache) return;
        const targetLoot = this.isLootEntity(this.pendingInteraction) ? this.pendingInteraction : null;

        for (const entity of this.activeEntitiesCache) {
            if (!this.isLootEntity(entity) || typeof entity.setPickupVisualState !== 'function') continue;
            if (entity === targetLoot) {
                entity.setPickupVisualState('targeted');
            } else if (this.canAttemptLootPickup(entity)) {
                entity.setPickupVisualState('in_range');
            } else {
                entity.setPickupVisualState('default');
            }
        }
    }

    pickupLoot(lootId) {
        const entity = this.remotePlayers.get(lootId);

        const isEmptyInventorySlot = (slot) => !slot || !slot.id;

        // Decide whether we can safely do optimistic pickup.
        // Only do it when the *entire* stack can fit in the current inventory state.
        const canOptimisticPickup = (() => {
            if (!entity || !entity.item || !this.player || !this.player.inventory) return false;

            const item = this.hydrateItem({ ...entity.item });
            const inventory = this.player.inventory;

            const maxStack = item.maxStack || 1;
            let remaining = item.stack || 1;

            if (maxStack > 1) {
                // First, see how much can be absorbed into existing partial stacks.
                for (let i = 0; i < inventory.length && remaining > 0; i++) {
                    const invItem = inventory[i];
                    if (invItem && invItem.id && invItem.name === item.name && (invItem.maxStack || 1) > 1) {
                        const invMax = invItem.maxStack || maxStack;
                        if ((invItem.stack || 1) < invMax) {
                            const space = invMax - (invItem.stack || 1);
                            remaining -= Math.min(space, remaining);
                        }
                    }
                }

                if (remaining <= 0) return true;

                // Then we need empty slots for whatever is left.
                let emptySlots = 0;
                for (let i = 0; i < inventory.length; i++) {
                    if (isEmptyInventorySlot(inventory[i])) emptySlots++;
                }

                // One empty slot can take up to maxStack items of this type.
                return emptySlots * maxStack >= remaining;
            }

            // Non-stackable: must have at least one empty slot.
            for (let i = 0; i < inventory.length; i++) {
                if (isEmptyInventorySlot(inventory[i])) return true;
            }
            return false;
        })();

        if (!canOptimisticPickup) {
            // No point sending a request the server must reject.
            this.showLootFailureFeedback('inventory_full');
            return false;
        }

        // Send pickup request (we expect success since it fits).
        this.network.send('pickup', { lootId: lootId });

        // Track this loot as recently picked up to prevent phantom recreation
        this.recentlyPickedUpLoot.add(lootId);
        setTimeout(() => {
            this.recentlyPickedUpLoot.delete(lootId);
        }, this.recentlyPickedUpLootTimeout);

        // Remove from entity creation queue if pending (prevents phantom items)
        const queueIdx = this.entityCreationQueue.findIndex(e => e.id === lootId);
        if (queueIdx !== -1) {
            this.entityCreationQueue.splice(queueIdx, 1);
            this.pendingEntityIds.delete(lootId);
        }

        // Optimistic removal to prevent "ghost items"
        if (entity) {
            console.log(`Optimistically removing loot ${lootId}`);

            // Optimistic inventory update - add item to bag instantly
            if (entity.item && this.player && this.player.inventory) {
                const item = this.hydrateItem({ ...entity.item });

                // Handle stackable items
                if (item.maxStack && item.maxStack > 1) {
                    // Try to stack with existing items first
                    let remainingStack = item.stack || 1;
                    for (let i = 0; i < this.player.inventory.length && remainingStack > 0; i++) {
                        const invItem = this.player.inventory[i];
                        if (invItem && invItem.id && invItem.name === item.name && invItem.stack < invItem.maxStack) {
                            const spaceAvailable = invItem.maxStack - invItem.stack;
                            const toAdd = Math.min(spaceAvailable, remainingStack);
                            invItem.stack += toAdd;
                            remainingStack -= toAdd;
                        }
                    }

                    // If remaining, find empty slot(s)
                    if (remainingStack > 0) {
                        for (let i = 0; i < this.player.inventory.length && remainingStack > 0; i++) {
                            if (isEmptyInventorySlot(this.player.inventory[i])) {
                                const stackHere = Math.min(item.maxStack, remainingStack);
                                const newItem = { ...item, stack: stackHere };
                                this.player.inventory[i] = newItem;
                                remainingStack -= stackHere;
                            }
                        }
                    }
                } else {
                    // Non-stackable: find empty slot
                    for (let i = 0; i < this.player.inventory.length; i++) {
                        if (isEmptyInventorySlot(this.player.inventory[i])) {
                            this.player.inventory[i] = item;
                            break;
                        }
                    }
                }

                // Immediately update UI
                this.uiManager.updateInventory(this.player);
            }

            this.showLootPickupFeedback(entity, 'picked_up');

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

        return true;
    }

    isInteractableEntity(entity) {
        if (!entity) return false;
        if (entity.name === 'DungeonEntrance') return true;

        const type = entity.constructor?.name || entity.type || entity.meshType || entity.name || '';
        return entity instanceof DwarfSalesman
            || entity instanceof QuestNPC
            || entity instanceof RespecNPC
            || entity instanceof DungeonNPC
            || entity instanceof Stash
            || entity instanceof Forge
            || entity instanceof TradingHouse
            || type === 'DwarfSalesman'
            || type === 'QuestNPC'
            || type === 'RespecNPC'
            || type === 'DungeonNPC'
            || type === 'Stash'
            || type === 'Forge'
            || type === 'TradingHouse';
    }

    isPlayerClassEntity(entity) {
        const name = entity && entity.constructor ? entity.constructor.name : '';
        return name === 'Fighter'
            || name === 'Rogue'
            || name === 'Wizard'
            || name === 'Cleric'
            || name === 'AvengingSeraph';
    }

    isHostileActorTarget(entity) {
        if (!entity || !(entity instanceof Actor)) return false;
        if (entity === this.player) return false;
        if (!entity.isActive || entity.state === 'DEAD') return false;
        if (entity instanceof DwarfSalesman) return false;
        if (this.isPlayerClassEntity(entity)) return false;
        return true;
    }

    getDungeonEntranceName(entity) {
        const dungeonType = entity?.userData?.dungeonType;
        switch (dungeonType) {
        case 'verdant_bastion_catacombs':
            return 'Verdant Bastion Catacombs';
        case 'molten_core':
            return 'Molten Core';
        case 'tempest_spire':
            return 'Tempest Spire';
        case 'abyssal_well':
            return 'Abyssal Well';
        default:
            return 'Dungeon Portal';
        }
    }

    getInteractableEntityLabel(entity) {
        if (!entity) return null;
        if (entity.name === 'DungeonEntrance') return this.getDungeonEntranceName(entity);

        const type = entity.constructor?.name || entity.type || entity.meshType || entity.name || '';
        switch (type) {
        case 'QuestNPC':
            return 'Quest Giver';
        case 'Stash':
            return 'Stash';
        case 'Forge':
            return 'Forge';
        case 'TradingHouse':
        case 'DwarfSalesman':
            return 'Vendor / Repair';
        case 'RespecNPC':
            return 'Respec';
        case 'DungeonNPC':
            return 'Dungeon Guide';
        default:
            return entity.displayName || entity.name || type || null;
        }
    }

    buildDungeonEntranceHint(entity = this.hoveredEntity) {
        if (!entity || !entity.position || !this.player?.position) {
            return null;
        }

        if (entity.name !== 'DungeonEntrance' && !this.isInteractableEntity(entity)) {
            return null;
        }

        const isDungeonEntrance = entity.name === 'DungeonEntrance';
        const interactionRange = Math.max(isDungeonEntrance ? 60.0 : 0, this.getInteractionRangeForEntity(entity));
        const distance = this.player.position.distanceTo(entity.position);
        const inRange = distance <= interactionRange;
        const dungeonName = this.getInteractableEntityLabel(entity);
        const entityLabel = isDungeonEntrance ? 'Dungeon Portal' : dungeonName;

        return {
            dungeonType: isDungeonEntrance ? (entity.userData?.dungeonType || '') : '',
            dungeonName,
            inRange,
            distance,
            statusLabel: inRange ? `${entityLabel} • In range` : `${entityLabel} • Move closer`,
            promptLabel: isDungeonEntrance
                ? (inRange
                    ? 'Click to open the dungeon portal.'
                    : 'Move closer to interact with this dungeon portal.')
                : (inRange
                    ? `Click to interact with ${dungeonName}.`
                    : `Move closer to interact with ${dungeonName}.`)
        };
    }

    refreshDungeonEntranceHint() {
        const hint = this.buildDungeonEntranceHint();
        this.dungeonEntranceHint = hint;
        if (hint) {
            this.uiManager?.updateDungeonEntranceHint?.(hint);
        } else {
            this.uiManager?.clearDungeonEntranceHint?.();
        }
    }

    getBasicAttackRangeForPlayer(player = this.player) {
        if (!player) return 0;
        if (player instanceof Wizard || player instanceof Rogue) return 16.0;
        return 4.0;
    }

    getEffectiveCombatTarget() {
        const pendingTarget = this.abilityController?.pendingAbilityTarget;
        if (this.isHostileActorTarget(pendingTarget)) return pendingTarget;
        if (this.isHostileActorTarget(this.hoveredEntity)) return this.hoveredEntity;
        return null;
    }

    serializeCombatIntent(intent) {
        if (!intent) return '';
        return [
            intent.entityId || '',
            intent.status || '',
            Math.round((intent.distance || 0) * 10) / 10,
            intent.inBasicRange ? 1 : 0,
            intent.inAbilityRange ? 1 : 0,
            intent.preview?.basicAttack ?? '',
            intent.preview?.ability ?? '',
            intent.preview?.abilityName ?? ''
        ].join('|');
    }

    buildCombatIntentState() {
        const player = this.player;
        const entity = this.getEffectiveCombatTarget();
        if (!player || !entity || !entity.position) return null;

        const skillName = this.abilityController?.getAbilityIntentSkillName?.() || player.abilityName || null;
        const distance = player.position.distanceTo(entity.position);
        const basicAttackRange = this.getBasicAttackRangeForPlayer(player);
        const abilityRange = this.abilityController?.getAbilityIntentRange?.(skillName)
            || this.abilityController?.getAbilityCastRange?.(skillName)
            || 0;
        const inBasicRange = distance <= basicAttackRange;
        const inAbilityRange = distance <= abilityRange;
        const preview = this.abilityController?.buildSoftDamagePreview?.(entity, skillName) || {
            basicAttack: Math.max(0, Math.round(player?.stats?.damage || 0)),
            ability: Math.max(0, Math.round(player?.stats?.damage || 0)),
            abilityName: skillName || 'Ability',
            isEstimate: true
        };

        return {
            entity,
            entityId: entity.id || null,
            name: entity.name || entity.displayName || entity.subType || entity.constructor?.name || 'Enemy',
            targetType: entity.subType || entity.type || entity.constructor?.name || 'Enemy',
            distance,
            basicAttackRange,
            abilityRange,
            inBasicRange,
            inAbilityRange,
            status: inAbilityRange ? 'in_range' : 'move_into_range',
            preview
        };
    }

    createCombatTargetHighlight() {
        if (this.combatTargetHighlight) return this.combatTargetHighlight;

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.7, 0.95, 32),
            new THREE.MeshBasicMaterial({
                color: 0xffd966,
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide
            })
        );
        ring.name = 'CombatTargetHighlight';
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.08;
        ring.visible = false;
        this.combatTargetHighlight = ring;
        return ring;
    }

    positionCombatTargetHighlight(entity) {
        const ring = this.combatTargetHighlight;
        if (!ring || !entity?.position) return;

        const targetScale = Number.isFinite(entity.scale) ? entity.scale : 1;
        ring.position.set(entity.position.x, (entity.position.y || 0) + 0.08, entity.position.z);
        ring.scale.setScalar(Math.max(1, targetScale));
    }

    attachCombatTargetHighlight(entity) {
        if (!entity?.position) return;
        const ring = this.createCombatTargetHighlight();
        if (!ring.parent && this.renderSystem?.effectGroup?.add) {
            this.renderSystem.effectGroup.add(ring);
        }
        this.highlightedCombatTarget = entity;
        ring.visible = true;
        this.positionCombatTargetHighlight(entity);
    }

    detachCombatTargetHighlight() {
        const ring = this.combatTargetHighlight;
        if (ring) {
            ring.visible = false;
            if (ring.parent?.remove) {
                ring.parent.remove(ring);
            } else if (this.renderSystem?.effectGroup?.remove) {
                this.renderSystem.effectGroup.remove(ring);
            }
        }
        this.highlightedCombatTarget = null;
    }

    updateCombatTargetHighlight() {
        const target = this.combatIntent?.entity;
        if (!this.isHostileActorTarget(target)) {
            this.detachCombatTargetHighlight();
            return;
        }

        if (this.highlightedCombatTarget !== target || !this.combatTargetHighlight?.parent) {
            this.attachCombatTargetHighlight(target);
            return;
        }

        this.positionCombatTargetHighlight(target);
    }

    refreshCombatIntentState() {
        const nextIntent = this.buildCombatIntentState();
        const nextSignature = this.serializeCombatIntent(nextIntent);
        const changed = nextSignature !== this.combatIntentSignature;

        this.combatIntent = nextIntent;
        this.combatIntentSignature = nextSignature;
        this.updateCombatTargetHighlight();

        if (changed) {
            if (nextIntent) {
                this.uiManager?.updateCombatIntent?.(nextIntent);
            } else {
                this.uiManager?.clearCombatIntent?.();
            }
        }

        return nextIntent;
    }

    clearCombatIntentState() {
        const hadIntent = !!this.combatIntent || !!this.highlightedCombatTarget;
        this.combatIntent = null;
        this.combatIntentSignature = '';
        if (this.abilityController) {
            this.abilityController.pendingAbilityTarget = null;
            this.abilityController.pendingAbilitySkill = null;
        }
        if (this.clearCombatTargetHighlight) {
            this.clearCombatTargetHighlight();
        }
        if (hadIntent) {
            this.uiManager?.clearCombatIntent?.();
        }
        this.dungeonEntranceHint = null;
        this.uiManager?.clearDungeonEntranceHint?.();
    }

    requestDungeonStatus(dungeonType = null) {
        this.uiManager?.clearDungeonEntranceHint?.();
        this.network.send('get_dungeon_status', dungeonType ? { dungeonType } : {});
    }

    getDungeonRoomSummary() {
        return this.currentDungeonRoomState;
    }

    upsertActiveBuff(buff) {
        if (!buff || !buff.id) {
            return;
        }
        if (!Array.isArray(this.activeBuffs)) {
            this.activeBuffs = [];
        }
        const normalized = {
            ...buff,
            remainingSeconds: Math.max(0, Number(buff.remainingSeconds ?? buff.durationSeconds ?? 0))
        };
        const index = this.activeBuffs.findIndex((entry) => entry?.id === normalized.id);
        if (index >= 0) {
            this.activeBuffs[index] = { ...this.activeBuffs[index], ...normalized };
        } else {
            this.activeBuffs.push(normalized);
        }
    }

    removeActiveBuff(buffId) {
        if (!Array.isArray(this.activeBuffs) || !buffId) {
            return;
        }
        this.activeBuffs = this.activeBuffs.filter((entry) => entry?.id !== buffId);
    }

    syncTrackedActorBuffs(actor = null) {
        if (!actor) {
            return;
        }

        const trackedBuffs = [
            {
                id: 'guardian_roar',
                active: Number(actor.guardianRoarTimer) > 0,
                icon: '🛡️',
                name: 'Guardian Roar',
                durationSeconds: Number(actor.guardianRoarTimer || 0),
                detail: `${Math.round(Number(actor.guardianRoarReduction || 0) * 100)}% damage reduction`,
                isDebuff: false
            },
            {
                id: 'blessing_resolve',
                active: Number(actor.blessingResolveTimer) > 0,
                icon: '✝️',
                name: 'Blessing of Resolve',
                durationSeconds: Number(actor.blessingResolveTimer || 0),
                detail: `${Math.round(Number(actor.blessingResolveReduction || 0) * 100)}% damage reduction`,
                isDebuff: false
            },
            {
                id: 'blessing_zeal',
                active: Number(actor.blessingZealTimer) > 0,
                icon: '✨',
                name: 'Blessing of Zeal',
                durationSeconds: Number(actor.blessingZealTimer || 0),
                detail: `+${Math.round(Number(actor.blessingZealFactor || 0) * 100)}% damage and healing`,
                isDebuff: false
            },
            {
                id: 'time_warp',
                active: Number(actor.hasteTimer) > 0,
                icon: '⏩',
                name: 'Time Warp',
                durationSeconds: Number(actor.hasteTimer || 0),
                detail: `+${Math.round(Number(actor.hasteFactor || 0) * 100)}% haste`,
                isDebuff: false
            },
            {
                id: 'arcane_shield',
                active: Number(actor.shieldHP) > 0,
                icon: '🔷',
                name: 'Arcane Shield',
                durationSeconds: Number(actor.hasteTimer || 0),
                detail: `${Math.round(Number(actor.shieldHP || 0))} shield remaining`,
                isDebuff: false
            },
            {
                id: 'vanish',
                active: Number(actor.speedBoostTimer) > 0,
                icon: '💨',
                name: 'Vanish',
                durationSeconds: Number(actor.speedBoostTimer || 0),
                detail: `+${Math.round(Number(actor.speedBoostFactor || 0) * 100)}% speed`,
                isDebuff: false
            },
            {
                id: 'last_stand',
                active: Number(actor.lastStandTimer) > 0,
                icon: '🔥',
                name: 'Last Stand',
                durationSeconds: Number(actor.lastStandTimer || 0),
                detail: `+${Math.round(Number(actor.lastStandDamageBoost || 0) * 100)}% damage`,
                isDebuff: false
            },
            {
                id: 'swift',
                active: Number(actor.swiftBuffTimer) > 0,
                icon: '⚡',
                name: 'Swift',
                durationSeconds: Number(actor.swiftBuffTimer || 0),
                detail: '+20% move speed',
                isDebuff: false
            },
            {
                id: 'mark_weakness',
                active: Number(actor.markWeaknessTimer) > 0,
                icon: '🎯',
                name: 'Marked',
                durationSeconds: Number(actor.markWeaknessTimer || 0),
                detail: `+${Math.round(Number(actor.markWeaknessFactor || 0) * 100)}% damage taken`,
                isDebuff: true
            },
            {
                id: 'bleed',
                active: Number(actor.bleedTimer) > 0,
                icon: '🩸',
                name: 'Bleeding',
                durationSeconds: Number(actor.bleedTimer || 0),
                detail: `${Math.max(1, Math.round(Number(actor.bleedStacks || 0)))} bleed stacks`,
                isDebuff: true
            },
            {
                id: 'poison',
                active: Number(actor.poisonTimer) > 0,
                icon: '☠️',
                name: 'Poisoned',
                durationSeconds: Number(actor.poisonTimer || 0),
                detail: `${Math.max(1, Math.round(Number(actor.poisonStacks || 0)))} poison stacks`,
                isDebuff: true
            },
            {
                id: 'root',
                active: Number(actor.rootTimer) > 0,
                icon: '🪤',
                name: 'Rooted',
                durationSeconds: Number(actor.rootTimer || 0),
                detail: 'Movement locked',
                isDebuff: true
            },
            {
                id: 'slow',
                active: Number(actor.slowTimer) > 0,
                icon: '🐢',
                name: 'Slowed',
                durationSeconds: Number(actor.slowTimer || 0),
                detail: `${Math.round(Number(actor.slowFactor || 0) * 100)}% slow`,
                isDebuff: true
            },
            {
                id: 'spirit_guardians',
                active: Boolean(actor.spiritsActive) && Number(actor.spiritDuration) > 0,
                icon: '👻',
                name: 'Spirit Guardians',
                durationSeconds: Number(actor.spiritDuration || 0),
                detail: actor.spiritBoosted ? 'Boosted guardians active' : 'Guardians active',
                isDebuff: false
            }
        ];

        trackedBuffs.forEach((buff) => {
            if (buff.active) {
                this.upsertActiveBuff({
                    id: buff.id,
                    icon: buff.icon,
                    name: buff.name,
                    detail: buff.detail,
                    durationSeconds: buff.durationSeconds,
                    remainingSeconds: buff.durationSeconds,
                    isDebuff: Boolean(buff.isDebuff)
                });
            } else {
                this.removeActiveBuff(buff.id);
            }
        });
    }

    getActiveBuffs() {
        const now = Date.now();
        if (!Array.isArray(this.activeBuffs)) {
            this.activeBuffs = [];
        }
        if (this.player) {
            this.syncTrackedActorBuffs(this.player);
        }
        if (this.activeBuffs.length === 0) {
            return this.activeBuffs;
        }
        this.activeBuffs = this.activeBuffs
            .map((buff) => {
                if (!buff) return null;
                const remainingSeconds = buff.expiresAt
                    ? Math.max(0, (buff.expiresAt - now) / 1000)
                    : Math.max(0, Number(buff.remainingSeconds ?? buff.durationSeconds ?? 0));
                if (remainingSeconds <= 0) {
                    return null;
                }
                return {
                    ...buff,
                    remainingSeconds
                };
            })
            .filter(Boolean);
        return this.activeBuffs;
    }

    getDungeonDebugOverlayData() {
        if (!this.currentDungeonLayout || !Array.isArray(this.currentDungeonLayout.walkRects) || this.currentDungeonLayout.walkRects.length === 0) {
            return null;
        }

        return {
            walkRects: this.currentDungeonLayout.walkRects,
            rooms: Array.isArray(this.currentDungeonLayout.rooms) ? this.currentDungeonLayout.rooms : [],
            corridors: Array.isArray(this.currentDungeonLayout.corridors) ? this.currentDungeonLayout.corridors : []
        };
    }

    sendEquipMessage(item, targetSlot) {
        this.network.send('equip', { itemId: item.id, slot: targetSlot || item.slot });
    }

    sendSplitStackMessage(slotIndex, amount) {
        this.network.send('split_stack', { slot: slotIndex, amount: amount });
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

        if (type === 'Forge') {
            return new Forge(id);
        }

        if (type === 'TradingHouse') {
            return new TradingHouse(id);
        }

        // If type is NPC, handle it
        if (type === 'NPC') {
            if (subType === 'DwarfSalesman') {
                p = new DwarfSalesman(id);
            } else if (subType === 'QuestNPC') {
                p = new QuestNPC(id);
            } else if (subType === 'DungeonNPC') {
                p = new DungeonNPC(id);
            } else if (subType === 'RespecNPC') {
                p = new RespecNPC(id);
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
                case 'RootboundWarden': p = new RootboundWarden(id); break;
                case 'BriarMatron': p = new BriarMatron(id); break;
                case 'RustboundColossus': p = new RustboundColossus(id); break;
                case 'HollowSentinel': p = new HollowSentinel(id); break;
                // Fire Realm enemies (West Zone - Scorched Wastes)
                case 'SandstormDjinn': p = new SandstormDjinn(id); break;
                case 'MagmaGolem': p = new MagmaGolem(id); break;
                case 'ScorchedWraith': p = new ScorchedWraith(id); break;
                case 'InfernalBehemoth': p = new InfernalBehemoth(id); break;
                case 'PhoenixSentinel': p = new PhoenixSentinel(id); break;
                // Air Realm enemies (East Zone - Skyward Peaks)
                case 'StormHarpy': p = new StormHarpy(id); break;
                case 'CloudElemental': p = new CloudElemental(id); break;
                case 'ThunderRoc': p = new ThunderRoc(id); break;
                case 'TempestGiant': p = new TempestGiant(id); break;
                case 'CycloneAvatar': p = new CycloneAvatar(id); break;
                // Molten Core dungeon bosses (Fire)
                case 'Cindermaw': p = new Cindermaw(id); break;
                case 'ScorchedTwins': p = new ScorchedTwins(id); break;
                case 'ForgemasterPyrax': p = new ForgemasterPyrax(id); break;
                case 'ObsidianGuardian': p = new ObsidianGuardian(id); break;
                case 'LordInfernax': p = new LordInfernax(id); break;
                // Tempest Spire dungeon bosses (Air)
                case 'Windshear': p = new Windshear(id); break;
                case 'Stormcallers': p = new Stormcallers(id); break;
                case 'RocMatriarch': p = new RocMatriarch(id); break;
                case 'ThunderlordKaelix': p = new ThunderlordKaelix(id); break;
                case 'Zephyrion': p = new Zephyrion(id); break;
                // Abyssal Well dungeon bosses (Water)
                case 'TiderendLeviathan': p = new TiderendLeviathan(id); break;
                case 'DrownedChoir': p = new DrownedChoir(id); break;
                case 'AbyssalGoliath': p = new AbyssalGoliath(id); break;
                case 'MaelstromWarden': p = new MaelstromWarden(id); break;
                case 'Thalorath': p = new Thalorath(id); break;
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
                
                // Add Collision for static structures
                if (entity.type === 'TradingHouse') {
                     mesh.position.copy(entity.position);
                     mesh.quaternion.copy(entity.rotation);
                     mesh.updateMatrixWorld(true);
                     const box = new THREE.Box3().setFromObject(mesh);
                     this.collisionManager.addCollider(box);
                     console.log(`Added collision for TradingHouse ${entity.id}`);
                } else if (entity.type === 'Stash' || entity.type === 'Forge') {
                     mesh.position.copy(entity.position);
                     mesh.quaternion.copy(entity.rotation);
                     mesh.updateMatrixWorld(true);
                     const box = new THREE.Box3().setFromObject(mesh);
                     this.collisionManager.addCollider(box);
                     console.log(`Added collision for ${entity.type} ${entity.id}`);
                }

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
        
        // Set up explosive death callback for unique effect
        if (entity.triggerOnKillEffects) {
            entity.onExplosiveDeath = (position, damage, killer) => {
                this.handleExplosiveDeath(position, damage, killer);
            };
        }
    }
    
    // Handle explosive death effect - damages nearby enemies
    handleExplosiveDeath(position, damage, killer) {
        if (!position || !this.chunkManager) return;
        
        const explosionRadius = 8.0; // 8 unit radius explosion
        
        this.chunkManager.getActiveEntities().forEach(entity => {
            // Don't damage the killer, dead entities, or entities without stats
            if (entity === killer || entity.state === 'DEAD' || !entity.stats || !entity.isActive) return;
            // Only damage enemies (not players or friendly NPCs)
            if (entity.id && entity.id.startsWith('player')) return;
            
            const dist = entity.position.distanceTo(position);
            if (dist < explosionRadius) {
                // Damage falls off with distance
                const falloff = 1 - (dist / explosionRadius);
                const finalDamage = Math.floor(damage * falloff);
                if (finalDamage > 0) {
                    entity.takeDamage(finalDamage, killer);
                    console.log(`Explosive death dealt ${finalDamage} damage to ${entity.id}`);
                }
            }
        });
    }

    handlePrimaryClick(event = null) {
        if (!this.player) return false;
        if (this.uiManager.isEscMenuOpen || this.uiManager.isPatchNotesOpen || this.uiManager.reportScreen.style.display === 'block') return false;

        this.performRaycast();

        const ctrlHeld = Boolean(event?.ctrlKey || event?.metaKey || this.inputManager?.keys?.control);
        if (ctrlHeld) {
            const point = this.inputManager?.getGroundIntersectionFromEvent
                ? this.inputManager.getGroundIntersectionFromEvent(event)
                : this.inputManager.getGroundIntersection();
            if (!point) return false;
            return this.requestPlayerJump(point);
        }

        if (this.isMobile) {
            let nearest = null;
            let minDst = 1000;
            const activeEntities = this.chunkManager.getActiveEntities();

            activeEntities.forEach(e => {
                if (this.isHostileActorTarget(e)) {
                    const d = this.player.position.distanceTo(e.position);
                    if (d < minDst) {
                        minDst = d;
                        nearest = e;
                    }
                }
            });

            if (nearest && minDst < 8.0) {
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
            return true;
        }

        if (this.hoveredEntity && this.hoveredEntity !== this.player) {
            this.moveToAndInteract(this.hoveredEntity);
            return true;
        }

        const point = this.inputManager.getGroundIntersection();
        if (!point) return false;

        let nearestLoot = null;
        let minLootDist = 3.0;
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
            this.pendingInteraction = null;
            this.abilityController.pendingAbilityTarget = null;
            this.abilityController.pendingAbilitySkill = null;
            this.player.move(point);
        }

        return true;
    }

    requestPlayerJump(destination) {
        if (!this.player || !destination) return false;

        const end = destination.clone();
        end.y = this.player.position.y;

        if (this.collisionManager?.constrainToDungeonWalkableArea) {
            this.collisionManager.constrainToDungeonWalkableArea(end, this.player.radius || 0);
        }

        if (this.playerJumpState) {
            this.playerQueuedJump = true;
            if (this.inputManager) {
                this.inputManager.isMouseDown = false;
            }
            return true;
        }

        this.playerQueuedJump = false;
        this.player.targetPosition = null;
        this.pendingInteraction = null;
        this.abilityController.pendingAbilityTarget = null;
        this.abilityController.pendingAbilitySkill = null;
        if (this.inputManager) {
            this.inputManager.isMouseDown = false;
        }
        this.clearCombatIntentState?.();

        if (this.isMultiplayer && this.network?.send) {
            this.startPlayerJump(end);
            this.network.send('jump', {
                x: end.x,
                y: end.y,
                z: end.z
            });
            return true;
        }

        return this.startPlayerJump(end);
    }

    startPlayerJump(destination) {
        if (!this.player || !destination) return false;

        const start = this.player.position.clone();
        const end = destination.clone();
        end.y = start.y;

        if (this.collisionManager?.constrainToDungeonWalkableArea) {
            this.collisionManager.constrainToDungeonWalkableArea(end, this.player.radius || 0);
        }

        const travelDistance = start.distanceTo(end);
        const duration = Math.max(0.46, Math.min(1.28, travelDistance / 13.5));
        const height = Math.max(6.5, Math.min(16.5, travelDistance * 0.38 + 4.2));

        this.player.targetPosition = null;
        this.pendingInteraction = null;
        this.abilityController.pendingAbilityTarget = null;
        this.abilityController.pendingAbilitySkill = null;
        this.clearCombatIntentState?.();
        this.player.state = 'JUMPING';

        if (this.player.animations?.Jump) {
            this.player.playAnimation?.('Jump', false, true);
        }

        if (this.player.mesh) {
            this.player.mesh.lookAt(new THREE.Vector3(end.x, this.player.position.y, end.z));
            this.player.rotation.copy(this.player.mesh.quaternion);
        }

        this.playerJumpState = {
            start,
            end,
            elapsed: 0,
            duration,
            height,
            serverDriven: false
        };
        this.playerJumpLandingVisual = null;
        this.playerJumpVisualHeight = 0;
        this.chunkManager?.updateEntityChunk?.(this.player);
        this.renderSystem?.setCameraTarget?.(this.player.position);
        return true;
    }

    syncAuthoritativeJumpState(entity, pData) {
        if (!entity || pData?.state !== 'JUMPING') return false;

        const existingJump = entity === this.player ? this.playerJumpState : entity.jumpVisualState;
        const hasJumpMetadata = pData.jumpStartX !== undefined
            || pData.jumpTargetX !== undefined
            || pData.jumpHeight !== undefined
            || pData.jumpDuration !== undefined
            || pData.jumpProgress !== undefined;
        const previousPosition = pData._previousPosition?.clone?.() || entity.position.clone();
        const currentPosition = new THREE.Vector3(
            pData.x ?? entity.position.x,
            pData.y ?? entity.position.y,
            pData.z ?? entity.position.z
        );

        let start = new THREE.Vector3(
            pData.jumpStartX ?? existingJump?.start?.x ?? previousPosition.x,
            pData.jumpStartY ?? existingJump?.start?.y ?? previousPosition.y,
            pData.jumpStartZ ?? existingJump?.start?.z ?? previousPosition.z
        );
        let end = new THREE.Vector3(
            pData.jumpTargetX ?? existingJump?.end?.x ?? currentPosition.x,
            pData.jumpTargetY ?? existingJump?.end?.y ?? start.y,
            pData.jumpTargetZ ?? existingJump?.end?.z ?? currentPosition.z
        );

        const horizontalTravel = new THREE.Vector3(currentPosition.x - start.x, 0, currentPosition.z - start.z);
        if (!hasJumpMetadata && (!existingJump?.end || start.distanceTo(end) < 0.01) && horizontalTravel.lengthSq() > 0.0001) {
            const inferredTotalDistance = horizontalTravel.length() / 0.2;
            end = start.clone().add(horizontalTravel.clone().normalize().multiplyScalar(inferredTotalDistance));
            end.y = start.y;
        }

        const duration = Math.max(0.001, pData.jumpDuration ?? existingJump?.duration ?? Math.max(0.46, Math.min(1.28, start.distanceTo(end) / 13.5 || 0.46)));
        const jumpVector = new THREE.Vector3(end.x - start.x, 0, end.z - start.z);
        const jumpDistanceSq = jumpVector.lengthSq();
        const projectedProgress = jumpDistanceSq > 0.0001
            ? Math.max(0, Math.min(1, new THREE.Vector3(currentPosition.x - start.x, 0, currentPosition.z - start.z).dot(jumpVector) / jumpDistanceSq))
            : undefined;
        const fallbackProgress = projectedProgress ?? (typeof existingJump?.progress === 'number'
            ? existingJump.progress
            : (typeof existingJump?.elapsed === 'number' ? (existingJump.elapsed / duration) : 0));
        const progress = Math.max(0, Math.min(1, pData.jumpProgress ?? fallbackProgress));
        const inferredHeight = Math.max(6.5, Math.min(16.5, start.distanceTo(end) * 0.38 + 4.2));
        const height = pData.jumpHeight ?? existingJump?.height ?? inferredHeight;
        const baseY = THREE.MathUtils.lerp(start.y, end.y, progress);
        const computedArcHeight = Math.sin(progress * Math.PI) * height;
        const replicatedArcHeight = Math.max(0, (pData.y ?? currentPosition.y) - baseY);
        const visualHeight = Math.max(computedArcHeight, replicatedArcHeight);
        const previousDisplayPosition = existingJump?.displayPosition?.clone?.()
            || entity.mesh?.position?.clone?.()
            || previousPosition.clone();
        const displayPosition = new THREE.Vector3(previousDisplayPosition.x, baseY, previousDisplayPosition.z);

        entity.position.x = currentPosition.x;
        entity.position.y = baseY;
        entity.position.z = currentPosition.z;

        if (entity === this.player) {
            this.playerJumpState = {
                start,
                end,
                progress,
                elapsed: progress,
                duration,
                height,
                serverDriven: true,
                visualHeight,
                displayPosition
            };
            this.playerJumpVisualHeight = 0;
            this.player.targetPosition = null;
        } else {
            entity.jumpVisualState = {
                start,
                end,
                progress,
                elapsed: progress * duration,
                duration,
                height,
                visualHeight,
                serverDriven: true,
                displayPosition,
                landingVisual: entity.jumpLandingVisual || null
            };
        }

        return true;
    }

    clearAuthoritativeJumpState(entity) {
        if (!entity) return;
        if (entity === this.player) {
            if (this.playerJumpState?.serverDriven) {
                const landingEnd = this.playerJumpState.end?.clone() || this.player.position.clone();
                this.player.position.copy(landingEnd);
                this.player.position.y = landingEnd.y;
                this.playerJumpState = null;
                this.playerJumpVisualHeight = 0;
                this.player.targetPosition = null;
                this.chunkManager?.updateEntityChunk?.(this.player);
                this.renderSystem?.setCameraTarget?.(this.player.position);
                this.playerJumpLandingVisual = {
                    startTime: Date.now(),
                    duration: 180,
                    impact: 0.85
                };
                this.applyJumpImpactEffect(entity, 0.85);
            }
            return;
        }
        if (entity.jumpVisualState) {
            entity.jumpLandingVisual = {
                startTime: Date.now(),
                duration: 180,
                impact: 0.85
            };
            this.applyJumpImpactEffect(entity, 0.85);
        }
        entity.jumpVisualState = null;
    }

    updatePlayerJump(dt) {
        if (!this.playerJumpState || !this.player) return false;

        const jump = this.playerJumpState;
        if (jump.serverDriven) {
            this.playerJumpVisualHeight = jump.visualHeight || 0;
            return true;
        }
        if (this.inputManager?.keys?.control && this.inputManager?.primaryMouseButtonDown) {
            this.playerQueuedJump = true;
        }

        jump.elapsed = Math.min(jump.duration, jump.elapsed + dt);
        const progress = jump.duration > 0 ? jump.elapsed / jump.duration : 1;
        const arc = Math.sin(progress * Math.PI) * jump.height;

        this.player.position.lerpVectors(jump.start, jump.end, progress);
        this.player.position.y = jump.start.y;
        this.playerJumpVisualHeight = arc;
        this.chunkManager?.updateEntityChunk?.(this.player);
        this.renderSystem?.setCameraTarget?.(this.player.position);

        if (progress >= 1) {
            this.player.position.copy(jump.end);
            this.player.position.y = jump.end.y;
            this.playerJumpState = null;
            this.playerJumpVisualHeight = 0;
            this.playerJumpLandingVisual = {
                startTime: Date.now(),
                duration: 180,
                impact: 0.9
            };
            this.applyJumpImpactEffect(this.player, 0.9);
            this.player.state = 'IDLE';
            this.player.playAnimation?.('Idle');

            if (this.playerQueuedJump && this.inputManager?.keys?.control && this.inputManager?.primaryMouseButtonDown) {
                this.playerQueuedJump = false;
                const queuedDestination = this.inputManager.getGroundIntersection?.();
                if (queuedDestination) {
                    return this.requestPlayerJump(queuedDestination);
                }
            }

            this.playerQueuedJump = false;
        }

        return true;
    }

    getJumpStyleProfile(entity) {
        const className = entity?.constructor?.name || '';
        const baseProfile = {
            flip: Math.PI * 2,
            roll: 0.12,
            anticipation: 0.12,
            squash: 0.14,
            stretch: 0.1,
            tuck: 0.18,
            untuck: 0.14,
            landingLean: 0.16
        };

        if (className === 'Wizard') {
            return { ...baseProfile, flip: Math.PI * 1.78, roll: 0.18, anticipation: 0.09, squash: 0.1, stretch: 0.16, tuck: 0.14, untuck: 0.12, landingLean: 0.14 };
        }
        if (className === 'Rogue') {
            return { ...baseProfile, flip: Math.PI * 2.2, roll: 0.16, anticipation: 0.1, squash: 0.12, stretch: 0.14, tuck: 0.22, untuck: 0.15, landingLean: 0.18 };
        }
        if (className === 'Cleric') {
            return { ...baseProfile, flip: Math.PI * 1.9, roll: 0.14, anticipation: 0.08, squash: 0.11, stretch: 0.14, tuck: 0.16, untuck: 0.13, landingLean: 0.15 };
        }
        if (className === 'Fighter') {
            return { ...baseProfile, flip: Math.PI * 2.08, roll: 0.08, anticipation: 0.15, squash: 0.17, stretch: 0.1, tuck: 0.24, untuck: 0.18, landingLean: 0.2 };
        }

        return baseProfile;
    }

    getJumpVisualProgress(jumpState) {
        if (!jumpState) return 0;
        if (typeof jumpState.progress === 'number') {
            return Math.max(0, Math.min(1, jumpState.progress));
        }
        if (jumpState.serverDriven && typeof jumpState.visualHeight === 'number' && jumpState.height > 0) {
            const normalizedHeight = Math.max(0, Math.min(1, jumpState.visualHeight / jumpState.height));
            return Math.asin(normalizedHeight) / Math.PI;
        }
        if (typeof jumpState.elapsed === 'number' && typeof jumpState.duration === 'number' && jumpState.duration > 0) {
            return Math.max(0, Math.min(1, jumpState.elapsed / jumpState.duration));
        }
        return 0;
    }

    applyJumpImpactEffect(entity, impact = 0.9) {
        if (!entity?.position || !this.spawnTransientEffect) return;
        const className = entity?.constructor?.name || 'Unknown';
        const impactPosition = entity.position.clone();
        impactPosition.y = entity.position.y;
        this.spawnTransientEffect('jump_land', impactPosition, 0xd8d2c4, {
            impact,
            className
        });
        this.renderSystem?.applyCameraPunch?.({
            intensity: 0.9 * impact,
            duration: 0.18,
            vertical: 1.1,
            horizontal: 0.5
        });
    }

    applyJumpVisualScale(entity, jumpState, progress, styleProfile) {
        const mesh = entity?.mesh;
        if (!mesh?.scale) return;

        if (!mesh.userData.baseScale) {
            mesh.userData.baseScale = mesh.scale.clone();
        }

        mesh.scale.copy(mesh.userData.baseScale);

        const anticipationWindow = 0.12;
        if (progress <= anticipationWindow) {
            const anticipationT = 1 - (progress / anticipationWindow);
            const anticipation = anticipationT * styleProfile.anticipation;
            mesh.scale.x *= 1 + anticipation * 0.55;
            mesh.scale.z *= 1 + anticipation * 0.55;
            mesh.scale.y *= 1 - anticipation;
            return;
        }

        const airborneLift = Math.sin(progress * Math.PI) * styleProfile.stretch;
        const tuckWindow = Math.max(0, Math.sin(progress * Math.PI));
        const tuckStrength = progress < 0.5
            ? THREE.MathUtils.smoothstep(progress, 0.12, 0.36) * styleProfile.tuck
            : (1 - THREE.MathUtils.smoothstep(progress, 0.56, 0.88)) * styleProfile.untuck;
        mesh.scale.x *= 1 - airborneLift * 0.2;
        mesh.scale.z *= 1 + tuckStrength * 1.2 + airborneLift * 0.08;
        mesh.scale.y *= 1 + airborneLift * 0.55 - tuckWindow * tuckStrength * 1.25;

        const landingVisual = jumpState?.landingVisual;
        if (landingVisual) {
            const elapsed = Date.now() - landingVisual.startTime;
            const landingT = Math.max(0, Math.min(1, elapsed / landingVisual.duration));
            if (landingT >= 1) {
                if (entity === this.player) {
                    this.playerJumpLandingVisual = null;
                } else {
                    entity.jumpLandingVisual = null;
                }
                mesh.scale.copy(mesh.userData.baseScale);
                return;
            }

            const impact = (1 - landingT) * landingVisual.impact;
            const squash = styleProfile.squash * impact;
            mesh.scale.x *= 1 + squash * 0.85;
            mesh.scale.z *= 1 + squash * 0.85;
            mesh.scale.y *= 1 - squash;
        }
    }

    getAuthoritativeJumpDisplayTarget(entity, jumpState) {
        const currentDisplayPosition = jumpState?.displayPosition?.clone?.() || entity?.position?.clone?.();
        const targetPosition = entity?.position?.clone?.();
        if (!currentDisplayPosition || !targetPosition) return targetPosition || currentDisplayPosition || null;

        currentDisplayPosition.y = targetPosition.y;
        if (!jumpState?.serverDriven) {
            return targetPosition;
        }

        const jumpVector = jumpState?.start && jumpState?.end
            ? new THREE.Vector3(jumpState.end.x - jumpState.start.x, 0, jumpState.end.z - jumpState.start.z)
            : new THREE.Vector3();
        if (jumpVector.lengthSq() <= 0.0001) {
            return targetPosition;
        }

        const jumpDirection = jumpVector.normalize();
        const horizontalDelta = new THREE.Vector3(
            targetPosition.x - currentDisplayPosition.x,
            0,
            targetPosition.z - currentDisplayPosition.z
        );
        const forwardDelta = horizontalDelta.dot(jumpDirection);
        const lateralDelta = horizontalDelta.clone().sub(jumpDirection.clone().multiplyScalar(forwardDelta));
        const microCorrectionTolerance = 0.08;

        if (forwardDelta < 0 && Math.abs(forwardDelta) <= microCorrectionTolerance) {
            targetPosition.x -= jumpDirection.x * forwardDelta;
            targetPosition.z -= jumpDirection.z * forwardDelta;
        }
        if (lateralDelta.lengthSq() <= microCorrectionTolerance * microCorrectionTolerance) {
            targetPosition.x -= lateralDelta.x;
            targetPosition.z -= lateralDelta.z;
        }

        return targetPosition;
    }

    applyEntityJumpVisuals(entity, jumpState) {
        if (!entity?.mesh) return;

        if (jumpState?.serverDriven) {
            if (!jumpState.displayPosition) {
                jumpState.displayPosition = entity.position.clone();
            }
            const displayTarget = this.getAuthoritativeJumpDisplayTarget(entity, jumpState) || entity.position;
            jumpState.displayPosition.lerp(displayTarget, 0.35);
            jumpState.displayPosition.y = entity.position.y;
            entity.mesh.position.copy(jumpState.displayPosition);
        } else {
            entity.mesh.position.copy(entity.position);
        }
        entity.mesh.quaternion.copy(entity.rotation);

        if (!jumpState) {
            if (entity.mesh.scale && entity.mesh.userData?.baseScale) {
                entity.mesh.scale.copy(entity.mesh.userData.baseScale);
            }
            return;
        }

        const visualHeight = jumpState.visualHeight ?? 0;
        entity.mesh.position.y += visualHeight;

        const progress = this.getJumpVisualProgress(jumpState);
        const styleProfile = this.getJumpStyleProfile(entity);
        const flipAmount = progress * styleProfile.flip;
        const rollAmount = Math.sin(progress * Math.PI * 2) * styleProfile.roll;
        const tuckPitch = progress < 0.45
            ? THREE.MathUtils.smoothstep(progress, 0.06, 0.3) * styleProfile.tuck
            : -THREE.MathUtils.smoothstep(progress, 0.72, 0.9)
                * (1 - THREE.MathUtils.smoothstep(progress, 0.9, 1.0))
                * styleProfile.landingLean;
        let landingPitch = 0;
        if (jumpState?.landingVisual) {
            const landingElapsed = Date.now() - jumpState.landingVisual.startTime;
            const landingT = Math.max(0, Math.min(1, landingElapsed / jumpState.landingVisual.duration));
            landingPitch = -Math.sin((1 - landingT) * Math.PI * 0.5) * styleProfile.landingLean * jumpState.landingVisual.impact;
        }
        const flipQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), flipAmount + tuckPitch + landingPitch);
        const rollQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rollAmount);
        entity.mesh.quaternion.multiply(flipQuaternion).multiply(rollQuaternion);
        this.applyJumpVisualScale(entity, jumpState, progress, styleProfile);
    }

    applyPlayerJumpVisuals() {
        if (!this.player?.mesh) return;
        const jumpState = this.playerJumpState
            ? {
                ...this.playerJumpState,
                progress: this.getJumpVisualProgress(this.playerJumpState),
                visualHeight: this.playerJumpVisualHeight || 0,
                landingVisual: this.playerJumpLandingVisual || null
            }
            : (this.playerJumpLandingVisual
                ? {
                    progress: 1,
                    visualHeight: 0,
                    landingVisual: this.playerJumpLandingVisual
                }
                : null);
        this.applyEntityJumpVisuals(this.player, jumpState);
    }

    moveToAndInteract(entity) {
        if (!entity) return;
        this.pendingInteraction = entity;
        this.abilityController.pendingAbilityTarget = null;
        this.abilityController.pendingAbilitySkill = null;
        
        // Check if already in range to avoid unnecessary movement start
        const dist = new THREE.Vector2(this.player.position.x, this.player.position.z)
            .distanceTo(new THREE.Vector2(entity.position.x, entity.position.z));
        
        const range = this.getInteractionRangeForEntity(entity);

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
        
        // Add Dungeon Entrance to raycast list
        const dungeonEntrances = [];
        this.renderSystem.environmentGroup.traverse(obj => {
            if (obj.name === 'DungeonEntrance') {
                dungeonEntrances.push(obj);
            }
        });
        if (dungeonEntrances.length > 0) {
            meshes.push(...dungeonEntrances);
        }

        // Use inputManager.mouse directly to ensure we use the latest cursor position
        this.inputManager.raycaster.setFromCamera(this.inputManager.mouse, this.renderSystem.camera);
        const intersects = this.inputManager.raycaster.intersectObjects(meshes, true);
        
        if (intersects.length > 0) {
            let hitEntities = [];
            for (const hit of intersects) {
                let obj = hit.object;
                
                // Check for Dungeon Entrance
                let current = obj;
                while (current) {
                    if (current.name === 'DungeonEntrance') {
                        // Create a proxy entity for interaction
                        const proxy = {
                            name: 'DungeonEntrance',
                            position: current.position,
                            userData: current.userData,
                            mesh: current,
                            isActive: true // Required to prevent immediate cancellation in update loop
                        };
                        this.hoveredEntity = proxy;
                        document.body.style.cursor = 'pointer';
                        this.refreshDungeonEntranceHint();
                        this.refreshCombatIntentState();
                        return; // Prioritize entrance
                    }
                    current = current.parent;
                }

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
                } else if (this.hoveredEntity instanceof Forge || this.hoveredEntity instanceof TradingHouse) {
                    document.body.style.cursor = 'pointer';
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

        this.refreshDungeonEntranceHint();
        this.refreshCombatIntentState();
    }

    getInteractionRangeForEntity(entity) {
        let range = 5.0;

        if (entity instanceof DwarfSalesman || entity instanceof Forge) {
            return 4.0;
        }

        if (entity instanceof TradingHouse) {
            return 20.0;
        }

        if (entity && entity.userData && entity.userData.interactionRadius) {
            return entity.userData.interactionRadius + 10.0;
        }

        if (this.isHostileActorTarget(entity)) {
            range = this.abilityController.getAbilityCastRange(
                this.abilityController.pendingAbilitySkill || this.player?.abilityName
            );

            if (entity.scale && entity.scale > 1.0) {
                range += (entity.scale - 1.0) * 1.5;
            }

            return range;
        }

        if (entity instanceof Actor && entity !== this.player) {
            if (entity.scale && entity.scale > 1.0) {
                range += (entity.scale - 1.0) * 1.5;
            }
        }

        return range;
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
        this.clearCombatIntentState();
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        if (this.inputManager) {
            this.inputManager.dispose();
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
        this.abilityController.processInputBuffer();

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
        
        const pendingMessages = this.network.drainMessages(maxMessages);

        // Debug queue size if backlog persists across frames
        if (this.network.messageQueue.length > 100 && this.frameCount % 60 === 0) {
            console.warn(`Message Queue Backlog: ${this.network.messageQueue.length} remaining`);
        }

        for (let i = 0; i < pendingMessages.length; i++) {
            const msg = pendingMessages[i];
            try {
                this.handleServerMessage(msg);
            } catch (e) {
                console.error("Error handling message:", msg.type, e);
            }
        }

        // 2. Handle latest state update (Coalesced) - REMOVED to ensure all state transitions (like Attacks) are processed
        // if (this.latestServerState) { ... }

        // 3. Handle latest time update (Coalesced)
        if (this.network.latestServerTime) {
            try {
                let payload;
                const rawTime = this.network.latestServerTime;
                if (typeof rawTime === 'string') {
                    if (rawTime.startsWith('{')) {
                        const msg = JSON.parse(rawTime);
                        payload = msg.payload;
                    } else {
                        payload = JSON.parse(rawTime);
                    }
                } else {
                    payload = rawTime;
                }
                this.handleServerMessage({ type: 'time', payload: payload });
            } catch (e) {
                console.error("Error handling server time:", e);
            } finally {
                this.network.latestServerTime = null;
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
            
            // Skip loot that was recently picked up (prevents phantom items)
            if (pData.type === 'Loot' && this.recentlyPickedUpLoot.has(pData.id)) {
                console.log(`Skipping phantom loot creation: ${pData.id}`);
                continue;
            }

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
                        return this.pickupLoot(pData.id);
                    };
                } else if (pData.type === 'Projectile') {
                    // Skip creating server projectile if it belongs to local player (avoid duplicates)
                    if (pData.ownerId === this.player.id) continue;

                    // Create Projectile
                    const y = pData.y ?? 0;
                    const start = new THREE.Vector3(pData.x, y, pData.z);
                    const target = new THREE.Vector3(pData.x + (pData.velX || 1), y, pData.z + (pData.velZ || 0));
                    
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
                } else if (pData.type === 'Hazard') {
                    // Environmental hazards - create visual effect
                    // SubType is the hazard type (lava_pool, sandstorm, lightning_zone, wind_gust)
                    // Scale contains the radius
                    const hazardType = pData.subType || 'lava_pool';
                    const radius = pData.scale || 5.0;
                    const position = { x: pData.x, y: 0, z: pData.z };
                    
                    const hazard = new EnvironmentalHazard(pData.id, hazardType, position, { radius });
                    hazard.addToScene(this.renderSystem.environmentGroup);
                    this.hazards.set(pData.id, hazard);
                    
                    // Skip adding to remotePlayers/entities - hazards are managed separately
                    continue;
                } else {
                    remoteEntity = this.createRemotePlayer(pData.type || 'Enemy', pData.id, pData.subType); 
                    console.log(`Created remote entity: ${pData.id} (${pData.type}/${pData.subType})`);
                }
                
                if (remoteEntity) {
                    // Set initial position immediately
                    remoteEntity.position.set(pData.x, pData.y ?? 0, pData.z);

                    // Set initial scale
                    if (pData.scale !== undefined) {
                        remoteEntity.setScale(pData.scale);
                    }
                    
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
        this.updateLootVisualFeedback();
        this.processAutoLoot();

        this.raycastTimer += dt;
        if (this.needsRaycast && this.raycastTimer > 0.05) {
             this.performRaycast();
             this.raycastTimer = 0;
             this.needsRaycast = false;
        }

        this.gameTime += dt;
        // Timer updated by server message

        this.updatePlayerJump(dt);

        if (this.player) {
            if (this.inputManager.isRightMouseDown) {
                this.needsRaycast = true;
                this.abilityController.performAbility();
            }

            if (!this.isMobile && this.inputManager.isMouseDown && !this.uiManager.isEscMenuOpen && !this.uiManager.isShopOpen) {
                if (this.inputManager.keys.control) {
                    this.player.targetPosition = null;
                    this.pendingInteraction = null;
                    this.abilityController.pendingAbilityTarget = null;
        this.abilityController.pendingAbilitySkill = null;

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
                } else if (this.hoveredEntity && this.hoveredEntity instanceof Actor && this.hoveredEntity !== this.player && this.hoveredEntity.state !== 'DEAD') {
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
                                this.abilityController.performAttack(this.hoveredEntity);
                            }
                        } else {
                            this.player.attack(this.hoveredEntity);
                        }
                    } else {
                        this.player.move(this.hoveredEntity.position);
                    }
                } else {
                    const point = this.inputManager.getGroundIntersection();
                    if (point) {
                        if (!this.pendingInteraction) {
                            this.player.move(point);
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
                    // Optimization: Avoid Vector2 allocation
                    const dx = this.player.position.x - this.pendingInteraction.position.x;
                    const dz = this.player.position.z - this.pendingInteraction.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    
                    let range = this.getInteractionRangeForEntity(this.pendingInteraction);

                    if (this.pendingInteraction.name === 'DungeonEntrance') {
                        // Fallback if userData not set, or override
                        if (range < 60.0) range = 60.0;
                        this.hoveredEntity = this.pendingInteraction;
                        this.refreshDungeonEntranceHint();
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
                                        const didSendPickup = this.pendingInteraction.onClick();
                                        if (didSendPickup === false) {
                                            // Inventory is full; stop the retry loop.
                                            this.pendingInteraction = null;
                                            this.player.targetPosition = null;
                                            this.player.state = 'IDLE';
                                            this.player.playAnimation('Idle');
                                        }
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

                        } else if (this.pendingInteraction.name === 'DungeonEntrance') {
                            this.player.targetPosition = null;
                            this.player.state = 'IDLE';
                            this.player.playAnimation('Idle');
                            
                            const dungeonType = this.pendingInteraction.userData
                                ? this.pendingInteraction.userData.dungeonType
                                : null;
                            this.requestDungeonStatus(dungeonType);
                            this.pendingInteraction = null;
                            this.refreshDungeonEntranceHint();

                        } else if (this.pendingInteraction instanceof DungeonNPC) {
                            this.player.targetPosition = null;
                            this.player.state = 'IDLE';
                            this.player.playAnimation('Idle');

                            this.requestDungeonStatus();
                            this.pendingInteraction = null;

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

                        } else if (this.pendingInteraction instanceof RespecNPC) {
                            this.player.targetPosition = null;
                            if (this.player.state === 'MOVING') {
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }
                            this.uiManager.showRespecMenu();
                            this.pendingInteraction = null;

                        } else if (this.pendingInteraction instanceof Stash) {
                            this.player.targetPosition = null;
                            if (this.player.state === 'MOVING') {
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }
                            this.uiManager.toggleStash();
                            this.pendingInteraction = null;

                        } else if (this.pendingInteraction instanceof Forge) {
                            this.player.targetPosition = null;
                            if (this.player.state === 'MOVING') {
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }
                            this.uiManager.toggleForge();
                            this.pendingInteraction = null;

                        } else if (this.pendingInteraction instanceof TradingHouse) {
                            this.player.targetPosition = null;
                            if (this.player.state === 'MOVING') {
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }
                            this.uiManager.toggleTradingHouse();
                            this.pendingInteraction = null;

                        } else if (this.pendingInteraction instanceof Actor) {
                            let attacked = false;
                            if (this.isMultiplayer) {
                                // Check Attack Speed Cooldown
                                const now = Date.now();
                                const cooldownMs = this.player.stats.attackSpeed * 1000;
                                if (now - this.player.lastAttackTime >= cooldownMs) {
                                    this.player.lastAttackTime = now;

                                    this.abilityController.performAttack(this.pendingInteraction);
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

            this.abilityController.updatePendingTarget();
            this.refreshCombatIntentState();

            if (this.isPlayerDead()) {
                this.pendingInteraction = null;
                this.abilityController.pendingAbilityTarget = null;
                this.abilityController.pendingAbilitySkill = null;
                this.clearCombatIntentState();
                this.player.targetPosition = null;
                this.uiManager.showDeathScreen();
            } else {
                this.uiManager.hideDeathScreen();
                this.player.timeSinceDeath = null;
            }
        }

        if (this.player) {
            if (this.isPlayerDead()) {
                this.inputManager.clearInputState();
            }
            if (this.isMobile) {
                if (this.isPlayerDead()) {
                    this.player.targetPosition = null;
                    if (this.player.state !== 'DEAD') {
                        this.player.state = 'DEAD';
                    }
                } else if (!this.playerJumpState) {
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
        if (this.isMultiplayer && this.player) {
            // Don't send move updates if dead
            if (this.player.state !== 'DEAD' && this.player.state !== 'JUMPING' && this.frameCount % 3 === 0) {
                const euler = new THREE.Euler().setFromQuaternion(this.player.rotation);
                this.network.send('move', {
                    x: this.player.position.x,
                    y: this.player.position.y,
                    z: this.player.position.z,
                    rotation: euler.y,
                    state: this.player.state
                });
            }
        }
        
        // Update realm lighting based on player position
        if (this.player) {
            this.renderSystem.updateEnvironmentLighting(this.player.position, dt);
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

        // Update Environmental Hazards
        for (const hazard of this.hazards.values()) {
            hazard.update(dt);
        }
    }

    sendPartyMessage(type, payload) {
        this.network.send(type, payload);
    }

    kickPartyMember(targetId) {
        this.sendPartyMessage('party_kick', { targetId });
    }

    promotePartyMember(targetId) {
        this.sendPartyMessage('party_promote', { targetId });
    }

    render(alpha) {
        // Optimization: Use cached active entities from ChunkManager
        // This avoids re-iterating chunks just for rendering if update() already did it
        const activeEntities = this.chunkManager.getActiveEntities();

        // Use a simple for loop for performance instead of forEach
        for (let i = 0; i < activeEntities.length; i++) {
            const entity = activeEntities[i];
            if (entity.isActive) {
                entity.render(alpha);
                if (entity !== this.player && entity.jumpVisualState) {
                    this.applyEntityJumpVisuals(entity, entity.jumpVisualState);
                }
            }
        }

        this.applyPlayerJumpVisuals();

        this.renderSystem.render();

        if (this.player) {
            // Throttle Minimap updates (every 3 frames)
            if (this.frameCount % 3 === 0) {
                this.minimap.update(this.player, activeEntities);
            }

            const playerStats = this.player.stats || {};
            const hudSignature = [
                Math.ceil(playerStats.hp ?? 0),
                playerStats.maxHp ?? 0,
                Math.floor(playerStats.mana ?? 0),
                playerStats.maxMana ?? 0,
                this.player.abilityName || '',
                this.player.abilityDescription || '',
                this.player.abilityCooldown > 0 ? Math.ceil(this.player.abilityCooldown) : 0,
                this.player.abilityManaCost ?? 0,
                playerStats.manaCostReduction ?? 0
            ].join('|');
            if (hudSignature !== this.lastRenderHudSignature) {
                this.uiManager.updatePlayerStats(this.player);
                this.lastRenderHudSignature = hudSignature;
            }

            const xpSignature = [
                this.player.level ?? 0,
                this.player.xp ?? 0,
                this.player.xpToNextLevel ?? 0
            ].join('|');
            if (xpSignature !== this.lastRenderXpSignature) {
                this.uiManager.updateXP(this.player);
                this.lastRenderXpSignature = xpSignature;
            }

            const hotbarCooldownSignature = (this.player.hotbar || []).map((skillName, index) => {
                if (!skillName) return `${index}:empty`;
                const mappedCooldown = this.player.cooldowns?.[skillName] ?? 0;
                const fallbackCooldown = skillName === this.player.abilityName ? (this.player.abilityCooldown ?? 0) : 0;
                const displayedCooldown = Math.max(mappedCooldown, fallbackCooldown);
                return `${index}:${skillName}:${displayedCooldown > 0 ? Math.ceil(displayedCooldown) : 0}`;
            }).join('|');
            if (hotbarCooldownSignature !== this.lastRenderHotbarCooldownSignature) {
                this.uiManager.updateHotbarCooldowns(this.player);
                this.lastRenderHotbarCooldownSignature = hotbarCooldownSignature;
            }

            // Dynamic UI Updates (Throttled)
            if (this.frameCount % 10 === 0) {
                if (this.uiManager.isCharacterSheetOpen) {
                    this.uiManager.updateCharacterSheet(this.player);
                }
            }

            this.uiManager.updateEnemyBars(
                activeEntities,
                this.renderSystem.camera,
                this.hoveredEntity,
                this.inputManager.keys.alt
            );
            if (this.worldMap?.isVisible?.()) {
                this.worldMap.update(this.player);
            }
        }
    }

}
