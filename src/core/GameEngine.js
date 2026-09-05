import * as THREE from 'three';
import { RenderSystem } from './RenderSystem.js';
import { InputManager } from './InputManager.js';
import { ChunkManager, isAlwaysResidentEntityType } from './ChunkManager.js';
import { CollisionManager } from './CollisionManager.js';
import { NetworkManager } from './NetworkManager.js';
import { AbilityController } from './AbilityController.js';
import { UIBindings } from './UIBindings.js';
import { SocialPresenceController } from './SocialPresenceController.js';
import { RARITY } from './ItemSystem.js';
import { UIManager } from '../ui/UIManager.js';
import { WorldGenerator } from '../world/WorldGenerator.js';
import { Minimap } from '../ui/Minimap.js';
import { WorldMap } from '../ui/WorldMap.js';
import { FloatingTextManager } from '../ui/FloatingTextManager.js';
import { AudioManager } from '../audio/AudioManager.js';
import { installGameEngineNetworkMessages } from './GameEngineNetworkMessages.js';
import { installGameEngineEntitySync } from './GameEngineEntitySync.js';
import { installGameEngineMovement } from './GameEngineMovement.js';
import { installGameEngineRuntime } from './GameEngineRuntime.js';

const REMOTE_SUPPORT_STATE_CONFIG = {
    spirit_guardians: {
        activeLabel: 'GUARDIANS UP',
        inactiveLabel: 'GUARDIANS DOWN',
        explicitSkillLabel: 'Spirit Guardians',
        activeColor: '#9dffb0',
        inactiveColor: '#d8ffd2',
        cooldownMs: 900,
    },
    guardian_embrace: {
        activeLabel: 'EMBRACE UP',
        inactiveLabel: 'EMBRACE DOWN',
        explicitSkillLabel: 'Guardian Embrace',
        activeColor: '#fff1a6',
        inactiveColor: '#fff7d1',
        cooldownMs: 900,
    },
    blessing_resolve: {
        activeLabel: 'RESOLVE UP',
        inactiveLabel: 'RESOLVE DOWN',
        explicitSkillLabel: 'Blessing of Resolve',
        activeColor: '#ffe38a',
        inactiveColor: '#fff2c2',
        cooldownMs: 900,
    },
    divine_intervention: {
        activeLabel: 'INTERVENTION UP',
        inactiveLabel: 'INTERVENTION DOWN',
        explicitSkillLabel: 'Divine Intervention',
        activeColor: '#ffd76b',
        inactiveColor: '#ffefb8',
        cooldownMs: 900,
    },
    arcane_shield: {
        activeLabel: 'SHIELD UP',
        inactiveLabel: 'SHIELD DOWN',
        explicitSkillLabel: 'Arcane Shield',
        activeColor: '#8fd2ff',
        inactiveColor: '#d7efff',
        cooldownMs: 900,
    },
    time_warp: {
        activeLabel: 'WARP UP',
        inactiveLabel: 'WARP DOWN',
        explicitSkillLabel: 'Time Warp',
        activeColor: '#ffe07a',
        inactiveColor: '#fff2bf',
        cooldownMs: 900,
    },
    spell_focus: {
        activeLabel: 'FOCUS UP',
        inactiveLabel: 'FOCUS DOWN',
        explicitSkillLabel: 'Spell Focus',
        activeColor: '#d29cff',
        inactiveColor: '#f0d8ff',
        cooldownMs: 900,
    },
};

function createTimedRemoteEffectConfig({
    payloadKey,
    durationKey,
    activeProperty = payloadKey,
    timerProperty,
    fallbackDuration,
    onActivate,
    onDeactivate
}) {
    const isActive = (entity) => Boolean(entity[activeProperty]) && Number(entity[timerProperty] || 0) > 0;
    return {
        payloadKey,
        payloadKeys: [payloadKey, durationKey],
        // The replicated active bit is the transition authority. A local
        // display timer may reach zero just before the server's explicit
        // inactive snapshot; requiring both here suppresses the DOWN cue and
        // makes the final authoritative edge invisible.
        getPreviousActive: (entity) => Boolean(entity[activeProperty]),
        applyPayload: (entity, value, payload) => {
            if (value !== undefined) entity[activeProperty] = Boolean(value);
            if (payload[durationKey] !== undefined) {
                entity[timerProperty] = Math.max(0, Number(payload[durationKey] || 0));
            } else if (value === true) {
                entity[timerProperty] = Math.max(Number(entity[timerProperty] || 0), fallbackDuration);
            }

            if (Boolean(entity[activeProperty]) && Number(entity[timerProperty] || 0) > 0) {
                onActivate?.(entity, payload);
            } else {
                entity[activeProperty] = false;
                entity[timerProperty] = 0;
                onDeactivate?.(entity, payload);
            }
        },
        getNextActive: isActive,
    };
}

const REMOTE_EFFECT_SYNC_CONFIG = {
    spirit_guardians: {
        payloadKey: 'spiritsActive',
        payloadKeys: ['spiritsActive', 'spiritsBoosted', 'spiritDuration'],
        getPreviousActive: (entity) => Boolean(entity.spiritsActive),
        applyPayload: (entity, value, payload) => {
            const wasActive = Boolean(entity.spiritsActive);
            const nextActive = value !== undefined ? Boolean(value) : wasActive;
            const nextBoosted = nextActive && Boolean(payload.spiritsBoosted ?? entity.spiritBoosted);

            if (!nextActive) {
                entity.spiritsActive = false;
                entity.spiritBoosted = false;
                entity.spiritDuration = 0;
                if (typeof entity.clearSpiritMeshes === 'function') {
                    entity.clearSpiritMeshes();
                }
                return;
            }

            entity.spiritsActive = true;
            entity.spiritBoosted = nextBoosted;
            entity.spiritDuration = Math.max(Number(entity.spiritDuration || 0), nextBoosted ? 10.0 : 8.0);

            if (payload.spiritDuration !== undefined) {
                entity.spiritDuration = Math.max(0, Number(payload.spiritDuration || 0));
            }

            if ((!wasActive || !entity.spiritEffect?.isActive) && typeof entity.createSpirits === 'function') {
                entity.createSpirits();
            }
        },
        getNextActive: (entity) => Boolean(entity.spiritsActive),
    },
    guardian_embrace: createTimedRemoteEffectConfig({
        payloadKey: 'guardianEmbraceActive',
        durationKey: 'guardianEmbraceDuration',
        timerProperty: 'guardianEmbraceTimer',
        fallbackDuration: 8
    }),
    blessing_resolve: createTimedRemoteEffectConfig({
        payloadKey: 'blessingResolveActive',
        durationKey: 'blessingResolveDuration',
        timerProperty: 'blessingResolveTimer',
        fallbackDuration: 8
    }),
    divine_intervention: createTimedRemoteEffectConfig({
        payloadKey: 'divineInterventionActive',
        durationKey: 'divineInterventionDuration',
        timerProperty: 'divineInterventionTimer',
        fallbackDuration: 8
    }),
    arcane_shield: {
        payloadKey: 'arcaneShieldActive',
        payloadKeys: ['arcaneShieldActive', 'arcaneShieldHp', 'arcaneShieldDuration'],
        getPreviousActive: (entity) => Boolean(entity.arcaneShieldActive) && Number(entity.shieldHP || 0) > 0,
        applyPayload: (entity, value, payload) => {
            if (value !== undefined) {
                entity.arcaneShieldActive = Boolean(value);
            }
            if (payload.arcaneShieldHp !== undefined) {
                entity.shieldHP = Number(payload.arcaneShieldHp || 0);
            }
            if (payload.arcaneShieldDuration !== undefined) {
                entity.arcaneShieldTimer = Math.max(0, Number(payload.arcaneShieldDuration || 0));
            }
        },
        getNextActive: (entity) => Boolean(entity.arcaneShieldActive) && Number(entity.shieldHP || 0) > 0,
    },
    time_warp: {
        payloadKey: 'timeWarpActive',
        payloadKeys: ['timeWarpActive', 'timeWarpDuration'],
        getPreviousActive: (entity) => Number(entity.hasteTimer || 0) > 0,
        applyPayload: (entity, value, payload) => {
            const nextActive = value !== undefined ? Boolean(value) : Number(entity.hasteTimer || 0) > 0;
            if (nextActive) {
                entity.hasteTimer = Math.max(Number(entity.hasteTimer || 0), 8.0);
                if (payload.timeWarpDuration !== undefined) {
                    entity.hasteTimer = Math.max(0, Number(payload.timeWarpDuration || 0));
                }
                entity.hasteFactor = Math.max(Number(entity.hasteFactor || 0), 0.5);
            } else {
                entity.hasteTimer = 0;
                entity.hasteFactor = 0;
            }
        },
        getNextActive: (entity) => Number(entity.hasteTimer || 0) > 0,
    },
    spell_focus: createTimedRemoteEffectConfig({
        payloadKey: 'spellFocusActive',
        durationKey: 'spellFocusDuration',
        timerProperty: 'spellFocusTimer',
        fallbackDuration: 8,
        onActivate: (entity) => {
            if (!Number.isFinite(entity.spellFocusMultiplier) || entity.spellFocusMultiplier <= 1) {
                entity.spellFocusMultiplier = 2.5;
            }
        },
        onDeactivate: (entity) => { entity.spellFocusMultiplier = 1; }
    }),
    swift: createTimedRemoteEffectConfig({
        payloadKey: 'swiftActive',
        durationKey: 'swiftDuration',
        timerProperty: 'swiftBuffTimer',
        fallbackDuration: 8
    }),
    iron_fortress: createTimedRemoteEffectConfig({
        payloadKey: 'ironFortressActive',
        durationKey: 'ironFortressDuration',
        timerProperty: 'ironFortressTimer',
        fallbackDuration: 30
    }),
    guardian_roar: createTimedRemoteEffectConfig({
        payloadKey: 'guardianRoarActive',
        durationKey: 'guardianRoarDuration',
        timerProperty: 'guardianRoarTimer',
        fallbackDuration: 8
    }),
    berserker_edge: createTimedRemoteEffectConfig({
        payloadKey: 'berserkerModeActive',
        durationKey: 'berserkerModeDuration',
        activeProperty: 'berserkerEdgeActive',
        timerProperty: 'berserkerEdgeTimer',
        fallbackDuration: 15
    }),
    last_stand: createTimedRemoteEffectConfig({
        payloadKey: 'lastStandActive',
        durationKey: 'lastStandDuration',
        timerProperty: 'lastStandTimer',
        fallbackDuration: 10
    }),
    serrated_edges: createTimedRemoteEffectConfig({
        payloadKey: 'serratedEdgesActive',
        durationKey: 'serratedEdgesDuration',
        timerProperty: 'serratedEdgesTimer',
        fallbackDuration: 10
    }),
    poison_coating: createTimedRemoteEffectConfig({
        payloadKey: 'poisonCoatingActive',
        durationKey: 'poisonCoatingDuration',
        timerProperty: 'poisonCoatingTimer',
        fallbackDuration: 15
    }),
    stealth: createTimedRemoteEffectConfig({
        payloadKey: 'stealthActive',
        durationKey: 'stealthDuration',
        timerProperty: 'stealthTimer',
        fallbackDuration: 10
    }),
    blessing_zeal: createTimedRemoteEffectConfig({
        payloadKey: 'zealActive',
        durationKey: 'zealDuration',
        activeProperty: 'blessingZealActive',
        timerProperty: 'blessingZealTimer',
        fallbackDuration: 8,
        onActivate: (entity) => { entity.blessingZealFactor = 0.35; },
        onDeactivate: (entity) => { entity.blessingZealFactor = 0; }
    }),
};

const AUTHORITATIVE_STATUS_CLEAR_CONFIG = {
    stunned: (entity) => {
        entity.stunTimer = 0;
    },
    slowed: (entity) => {
        entity.slowTimer = 0;
        entity.slowFactor = 0;
    },
    rooted: (entity) => {
        entity.rootTimer = 0;
    },
    bleeding: (entity) => {
        entity.bleedTimer = 0;
        entity.bleedStacks = 0;
        entity.bleedTickDamage = 0;
    },
    poisoned: (entity) => {
        entity.poisonTimer = 0;
        entity.poisonStacks = 0;
        entity.poisonTickDamage = 0;
    },
    weakPointMarked: (entity) => {
        entity.weakPointMarkTimer = 0;
    },
    markWeakness: (entity) => {
        entity.markWeaknessTimer = 0;
        entity.markWeaknessFactor = 0;
    }
};
import { Fighter } from '../entities/Fighter.js';
import { Skeleton } from '../entities/Skeleton.js';
import { Rogue } from '../entities/Rogue.js';
import { Wizard } from '../entities/Wizard.js';
import { Cleric } from '../entities/Cleric.js';
import { DemonOrc } from '../entities/DemonOrc.js';
import { Construct } from '../entities/Construct.js';
import { LootDrop } from '../entities/LootDrop.js';
import { DwarfSalesman } from '../entities/DwarfSalesman.js';
import { Actor } from '../entities/Actor.js';
import { Imp } from '../entities/Imp.js';
import { InfernoTitan } from '../entities/InfernoTitan.js';
import { Siren } from '../entities/Siren.js';
import { FrostGuardian } from '../entities/FrostGuardian.js';
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
import { MeshFactory } from '../utils/MeshFactory.js';
import { createTransientEffect } from './TransientEffects.js';
import {
    findNextDungeonMeaningfulRoom,
    getDungeonBeatLabel as getSharedDungeonBeatLabel,
    getDungeonCadenceLabel,
    getDungeonRoomRole,
    isLiveDungeonBossRoom
} from '../utils/dungeonRoomMetadata.js';

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
        this.audioManager = new AudioManager();
        this.uiManager = new UIManager(this.isMobile, { audioManager: this.audioManager });
        this.autoLootEnabled = this.uiManager.getAutoLootEnabled();
        this.uiManager.onAutoLootChange = (enabled) => {
            this.autoLootEnabled = enabled;
        };
        this.cameraShakeEnabled = this.uiManager.getCameraShakeEnabled();
        this.uiManager.onCameraShakeChange = (enabled) => {
            this.cameraShakeEnabled = enabled;
        };
        this.fullscreenEnabled = this.uiManager.getFullscreenEnabled?.() || false;
        this.uiManager.onFullscreenChange = (enabled) => {
            this.fullscreenEnabled = enabled;
        };
        this.effects = []; // Active visual effects
        this.hazards = new Map(); // Environmental hazards (id -> EnvironmentalHazard)
        this.abilityController = new AbilityController(this);
        this.currentInstanceId = null; // Track current instance to prevent state desync
        this.currentInstanceType = null;
        this.currentDungeonRoomState = null;
        this.currentDungeonLayout = null;
        this.activeBuffs = [];
        this.worldGenerator = new WorldGenerator(this.getInstanceEnvironmentGroup(), this.collisionManager);
        this.activeWorldGenerator = this.worldGenerator;
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
        // 0.37.2 — party-member highlight: local player's party ID from the state stream.
        // Remote actors whose partyId matches get a teal ground ring.
        this.socialController = new SocialPresenceController({
            network: this.network,
            uiManager: this.uiManager,
            remotePlayers: this.remotePlayers,
        });
        this.playerType = playerType || 'Fighter';
        this.enemies = [];
        this.lootDrops = [];
        this.cameraLocked = true;
        this.pendingInteraction = null;

        this.lastTime = 0;
        this.accumulator = 0;
        this.fixedTimeStep = 1 / 60;
        this.isDestroyed = false;
        this.deferredOverworldSceneryPromise = null;
        this.overworldSceneryReady = false;
        this.overworldSceneGeneration = 0;

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
        this.playerCorrectionVisualState = null;
        this.movementNetworkState = null;
        this.movementTelemetry = {
            packetsSent: 0,
            idleHeartbeats: 0,
            acknowledged: 0,
            staleAcknowledgements: 0,
            duplicateAcknowledgements: 0,
            serverAdjustments: 0,
            hardCorrections: 0,
            maxServerAdjustment: 0
        };
        this.lastRenderHudSignature = '';
        this.lastRenderXpSignature = '';
        this.lastRenderHotbarCooldownSignature = '';
        this.lastRenderEnemyBarSignature = '';
        this.lastRenderCharacterSheetSignature = '';
        this.lastRenderWorldMapSignature = '';
        this.onboardingRecoveryContext = null;
        this.readabilityFeedbackTimestamps = new Map();

        // Entity Creation Throttling
        this.entityCreationQueue = [];
        this.pendingEntityIds = new Set();

        // Track recently picked up loot IDs to prevent phantom item recreation
        this.recentlyPickedUpLoot = new Set();
        this.recentlyPickedUpLootTimeout = 5000; // 5 seconds
        // A pickup is not real until the server's inventory packet confirms it.
        // Keeping pending loot retryable prevents rejected requests from
        // creating client-only "ghost" items.
        this.pendingLootPickups = new Map();
        this.pendingLootPickupTimeout = 10000;
    }

    get scene() {
        return this.renderSystem.entityGroup;
    }

    get effectScene() {
        return this.renderSystem.effectGroup;
    }

    getInstanceEnvironmentGroup() {
        return this.renderSystem.instanceEnvironmentGroup || this.renderSystem.environmentGroup;
    }

    resetRenderUpdateSignatures() {
        this.lastRenderHudSignature = '';
        this.lastRenderXpSignature = '';
        this.lastRenderHotbarCooldownSignature = '';
        this.lastRenderEnemyBarSignature = '';
        this.lastRenderCharacterSheetSignature = '';
        this.lastRenderWorldMapSignature = '';
        this.uiManager?.resetDisplaySignatures?.();
    }

    playAudioCue(cueName, options = {}) {
        return this.audioManager?.play?.(cueName, options) || false;
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
        const addMessage = this.uiManager?.addGameMessage || this.uiManager?.addChatMessage;
        if (!addMessage) return;
        const locationLabel = source === 'delta'
            ? 'Recovered in town from the last defeat.'
            : 'Recovered in town.';
        addMessage.call(this.uiManager, 'System', `${locationLabel} Hit Vendor / Repair, Forge, or the Stash before pushing back out.`);
    }

    isTownPosition(x, z) {
        const px = Number(x);
        const pz = Number(z);
        if (!Number.isFinite(px) || !Number.isFinite(pz)) return false;
        return px >= -100 && px <= 100 && pz >= 100 && pz <= 300;
    }

    getOnboardingRecoveryContext() {
        if (!this.onboardingRecoveryContext || !this.player) return null;
        if (!this.isTownPosition(this.player.position?.x, this.player.position?.z)) return null;
        if ((this.currentInstanceType || 'overworld') !== 'overworld') return null;
        return this.onboardingRecoveryContext;
    }

    clearOnboardingRecoveryContext() {
        this.onboardingRecoveryContext = null;
    }

    refreshOnboardingGuidance(reason = null) {
        if (reason) {
            this.onboardingRecoveryContext = { reason, updatedAt: Date.now() };
        }
        if (!this.player || !this.uiManager?.updateJournal) return;
        this.uiManager.updateJournal(Array.isArray(this.player.quests) ? this.player.quests : []);
    }

    syncTownRecoveryGuidance(previousX, previousZ, nextX, nextZ, reason = null) {
        const wasInTown = this.isTownPosition(previousX, previousZ);
        const isInTown = this.isTownPosition(nextX, nextZ);

        if (reason && isInTown) {
            this.refreshOnboardingGuidance(reason);
            return;
        }

        if (!wasInTown && isInTown) {
            this.refreshOnboardingGuidance('town_return');
            return;
        }

        if (wasInTown && !isInTown) {
            this.clearOnboardingRecoveryContext();
            this.uiManager?.updateJournal?.(Array.isArray(this.player?.quests) ? this.player.quests : []);
        }
    }

    showReadabilityFeedback(key, callout = {}, cooldownMs = 900) {
        if (!key || !this.uiManager?.showCombatCallout) return false;
        const now = Date.now();
        const lastShown = this.readabilityFeedbackTimestamps.get(key) || 0;
        if (now - lastShown < cooldownMs) return false;

        this.readabilityFeedbackTimestamps.set(key, now);
        this.uiManager.showCombatCallout({
            tone: 'warning',
            duration: 1.6,
            ...callout
        });
        return true;
    }

    canShowThrottledReadabilityEvent(key, cooldownMs = 900) {
        if (!key) return false;
        const now = Date.now();
        const lastShown = this.readabilityFeedbackTimestamps.get(key) || 0;
        if (now - lastShown < cooldownMs) return false;
        this.readabilityFeedbackTimestamps.set(key, now);
        return true;
    }

    isPositionNearPlayer(position, radius = 38) {
        if (!this.player?.position || !position) return false;
        const dx = this.player.position.x - position.x;
        const dz = this.player.position.z - position.z;
        return Math.sqrt(dx * dx + dz * dz) <= radius;
    }

    isNearbyCombatEvent(sourceEntity = null, targetEntity = null, radius = 38) {
        return this.isPositionNearPlayer(sourceEntity?.position, radius)
            || this.isPositionNearPlayer(targetEntity?.position, radius);
    }

    formatRemoteActionLabel(skillName = '') {
        const text = String(skillName || '').trim();
        if (!text) return '';
        return text.toUpperCase();
    }

    getRemoteActionSourceLabel(entity = null) {
        const raw = String(entity?.name || entity?.displayName || entity?.subType || entity?.constructor?.name || 'ALLY').trim();
        if (!raw) return 'ALLY';
        return raw.toUpperCase();
    }

    buildRemoteActionReadabilityText(entity, actionLabel) {
        const action = this.formatRemoteActionLabel(actionLabel);
        if (!action) return '';
        return `${this.getRemoteActionSourceLabel(entity)}: ${action}`;
    }

    showRemoteActionReadability(sourceEntity, skillName) {
        if (!sourceEntity?.position || !skillName || !this.floatingTextManager) return false;
        if (!this.isPlayerClassEntity(sourceEntity)) return false;
        if (!this.isPositionNearPlayer(sourceEntity.position, 34)) return false;

        const label = this.buildRemoteActionReadabilityText(sourceEntity, skillName);
        if (!label) return false;
        const actorKey = sourceEntity.id || sourceEntity.name;
        if (actorKey) {
            this.readabilityFeedbackTimestamps.set(`remote-attack-state-suppressed-${actorKey}`, Date.now());
        }
        const key = `remote-action-${sourceEntity.id || sourceEntity.name}-${label}`;
        if (!this.canShowThrottledReadabilityEvent(key, 750)) return false;

        this.floatingTextManager.spawn(label, sourceEntity.position, '#8fe7ff', '18px');
        return true;
    }

    getReplicatedEntityById(entityId) {
        if (!entityId) return null;
        if (this.player && this.player.id === entityId) return this.player;
        return this.remotePlayers?.get(entityId) || null;
    }

    beginRemoteActionPresentation(entity) {
        if (!entity || entity.state === 'JUMPING') return false;
        if (typeof entity.setAttackingState === 'function') {
            entity.setAttackingState(true);
            return true;
        }
        if (typeof entity.updateState === 'function') {
            entity.updateState('ATTACKING');
            return true;
        }
        entity.state = 'ATTACKING';
        return true;
    }

    showRemoteStateReadability(entity, nextState, previousState = '') {
        if (!entity?.position || !this.floatingTextManager) return false;
        if (!this.isPlayerClassEntity(entity)) return false;
        if (!this.isPositionNearPlayer(entity.position, 34)) return false;

        const state = String(nextState || '').trim().toUpperCase();
        const previous = String(previousState || '').trim().toUpperCase();
        if (!state || state === previous) return false;

        let actionLabel = '';
        let color = '#8fe7ff';
        let fontSize = '16px';

        if (state === 'JUMPING') {
            actionLabel = 'JUMP';
            color = '#d3f2ff';
        } else if (state === 'ATTACKING') {
            actionLabel = 'ATTACK';
            color = '#ffd36b';
        } else {
            return false;
        }

        const label = this.buildRemoteActionReadabilityText(entity, actionLabel);
        if (!label) return false;

        if (state === 'ATTACKING') {
            const actorKey = entity.id || entity.name;
            const suppressedAt = actorKey ? (this.readabilityFeedbackTimestamps.get(`remote-attack-state-suppressed-${actorKey}`) || 0) : 0;
            if (suppressedAt && (Date.now() - suppressedAt) < 750) {
                return false;
            }
        }

        const key = `remote-state-${entity.id || entity.name}-${state}`;
        if (!this.canShowThrottledReadabilityEvent(key, state === 'JUMPING' ? 650 : 500)) return false;

        this.floatingTextManager.spawn(label, entity.position, color, fontSize);
        return true;
    }

    showRemoteSupportStateReadability(entity, supportKey, active) {
        if (!entity?.position || !this.floatingTextManager) return false;
        if (!this.isPlayerClassEntity(entity)) return false;
        if (!this.isPositionNearPlayer(entity.position, 34)) return false;

        const normalizedKey = String(supportKey || '').trim().toLowerCase();
        if (!normalizedKey) return false;

        const config = REMOTE_SUPPORT_STATE_CONFIG[normalizedKey];
        if (!config) return false;

        const actionLabel = active ? config.activeLabel : config.inactiveLabel;
        const explicitSkillLabel = config.explicitSkillLabel;
        const color = active ? config.activeColor : config.inactiveColor;
        const cooldownMs = config.cooldownMs;

        const label = this.buildRemoteActionReadabilityText(entity, actionLabel);
        if (!label) return false;

        const actorKey = entity.id || entity.name;
        if (active && actorKey && explicitSkillLabel) {
            const explicitSupportLabel = this.buildRemoteActionReadabilityText(entity, explicitSkillLabel);
            const explicitSupportKey = explicitSupportLabel ? `remote-action-${actorKey}-${explicitSupportLabel}` : '';
            const explicitSupportAt = explicitSupportKey ? (this.readabilityFeedbackTimestamps.get(explicitSupportKey) || 0) : 0;
            if (explicitSupportAt && (Date.now() - explicitSupportAt) < cooldownMs) {
                return false;
            }
        }

        const key = `remote-support-${actorKey}-${normalizedKey}-${active ? 'active' : 'inactive'}`;
        if (!this.canShowThrottledReadabilityEvent(key, cooldownMs)) return false;

        this.floatingTextManager.spawn(label, entity.position, color, '16px');
        return true;
    }

    syncRemoteSupportEffects(remoteEntity, payload) {
        Object.entries(REMOTE_EFFECT_SYNC_CONFIG).forEach(([supportKey, config]) => {
            const payloadKeys = config.payloadKeys || [config.payloadKey];
            const hasRelevantPayload = payloadKeys.some((key) => payload[key] !== undefined);
            if (!hasRelevantPayload) return;

            const previousActive = config.getPreviousActive(remoteEntity);
            config.applyPayload(remoteEntity, payload[config.payloadKey], payload);
            const nextActive = config.getNextActive(remoteEntity);

            if (previousActive !== nextActive) {
                this.showRemoteSupportStateReadability(remoteEntity, supportKey, nextActive);
            }
        });
        remoteEntity.syncAttachedStatusEffects?.(0);
    }

    syncPlayerSupportEffects(playerEntity, payload) {
        this.syncRemoteSupportEffects(playerEntity, payload);
    }

    syncPlayerStatusClears(playerEntity, payload) {
        if (!playerEntity || !payload) return;

        Object.entries(AUTHORITATIVE_STATUS_CLEAR_CONFIG).forEach(([payloadKey, clearStatus]) => {
            if (payload[payloadKey] === false) {
                clearStatus(playerEntity);
            }
        });
    }

    syncPlayerStatusDetails(playerEntity, payload) {
        if (!playerEntity || !payload) return;

        if (payload.slowFactor !== undefined) {
            playerEntity.slowFactor = Number(payload.slowFactor || 0);
            if (payload.slowed === true && playerEntity.slowTimer <= 0) {
                playerEntity.slowTimer = Math.max(playerEntity.slowTimer || 0, 0.1);
            }
        }

        if (payload.slowDuration !== undefined && payload.slowed === true) {
            playerEntity.slowTimer = Math.max(0, Number(payload.slowDuration || 0));
        }

        if (payload.rootDuration !== undefined && payload.rooted === true) {
            playerEntity.rootTimer = Math.max(0, Number(payload.rootDuration || 0));
        }

        if (payload.stunDuration !== undefined && payload.stunned === true) {
            playerEntity.stunTimer = Math.max(0, Number(payload.stunDuration || 0));
        }

        if (payload.bleedDuration !== undefined && payload.bleeding === true) {
            playerEntity.bleedTimer = Math.max(0, Number(payload.bleedDuration || 0));
        }

        if (payload.bleedDamage !== undefined && payload.bleeding === true) {
            playerEntity.bleedTickDamage = Math.max(0, Math.round(Number(payload.bleedDamage || 0)));
        }

        if (payload.poisonDuration !== undefined && payload.poisoned === true) {
            playerEntity.poisonTimer = Math.max(0, Number(payload.poisonDuration || 0));
        }

        if (payload.poisonDamage !== undefined && payload.poisoned === true) {
            playerEntity.poisonTickDamage = Math.max(0, Math.round(Number(payload.poisonDamage || 0)));
        }

        if (payload.weakPointDuration !== undefined && payload.weakPointMarked === true) {
            playerEntity.weakPointMarkTimer = Math.max(0, Number(payload.weakPointDuration || 0));
        }

        if (payload.weakPointMarked === true && playerEntity.weakPointMarkTimer <= 0) {
            playerEntity.weakPointMarkTimer = Math.max(playerEntity.weakPointMarkTimer || 0, 0.1);
        }

        if (payload.markWeakness === true && playerEntity.markWeaknessTimer <= 0) {
            playerEntity.markWeaknessTimer = Math.max(playerEntity.markWeaknessTimer || 0, 0.1);
        }

        if (payload.markWeaknessDuration !== undefined && payload.markWeakness === true) {
            playerEntity.markWeaknessTimer = Math.max(0, Number(payload.markWeaknessDuration || 0));
        }
    }

    showNearbyRemoteDamageFeedback(sourceEntity, targetEntity, amount) {
        if (!targetEntity?.position || !this.floatingTextManager) return false;
        if (!this.isNearbyCombatEvent(sourceEntity, targetEntity, 38)) return false;

        const sourceIsRemotePlayer = this.isPlayerClassEntity(sourceEntity);
        const targetIsRemotePlayer = this.isPlayerClassEntity(targetEntity);
        if (!sourceIsRemotePlayer && !targetIsRemotePlayer) return false;

        const key = `remote-damage-${sourceEntity?.id || 'unknown'}-${targetEntity?.id || 'unknown'}-${amount}`;
        if (!this.canShowThrottledReadabilityEvent(key, 180)) return false;

        const color = targetIsRemotePlayer ? '#ff8a8a' : '#8fe7ff';
        this.floatingTextManager.spawn(amount, targetEntity.position, color, '20px');
        return true;
    }

    getLevelUpReadabilityHint(previousLevel, nextLevel) {
        if (previousLevel < 30 && nextLevel >= 30) {
            return 'All base dungeons are now unlocked. Talk to the Dungeon Guide in town when you are ready.';
        }
        if (previousLevel < 100 && nextLevel >= 100) {
            return 'Heroic and Mythic are now unlocked. Push back into the dungeon menu for endgame runs.';
        }
        return 'Open Skills (K) and review your build before pushing deeper.';
    }

    handleLevelUpFeedback(previousLevel, nextLevel) {
        if (!this.player || previousLevel >= nextLevel) return;

        const effect = new LevelUpEffect(this.renderSystem.effectGroup, this.player.position);
        this.effects.push(effect);

        this.floatingTextManager.spawn(
            'LEVEL UP!',
            new THREE.Vector3(this.player.position.x, this.player.position.y + 2, this.player.position.z),
            '#ffd700'
        );

        const hint = this.getLevelUpReadabilityHint(previousLevel, nextLevel);
        this.uiManager?.showCombatCallout?.({
            title: `Level ${nextLevel} Reached`,
            tone: nextLevel >= 100 ? 'boss' : 'support',
            metaText: 'Level Up',
            subtitle: hint,
            duration: 2.8
        });
        this.uiManager?.addGameMessage?.('Level Up', `Reached level ${nextLevel}. ${hint}`);

        this.network.send('chat', {
            message: `* has reached level ${nextLevel}! *`,
            sender: this.username || 'Player'
        });
    }

    announceExperienceGain(previousXP, nextXP, previousLevel, nextLevel, hadSyncedProgress) {
        if (!hadSyncedProgress || previousLevel !== nextLevel) return;
        const gainedXP = Math.max(0, Number(nextXP || 0) - Number(previousXP || 0));
        if (gainedXP <= 0) return;
        this.uiManager?.addGameMessage?.('Experience', `+${gainedXP.toLocaleString()} XP`);
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
        console.log(`Initializing GameEngine with player type: ${this.playerType}`);

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
            // The selected actor and nearby Skeleton assets gate entry. Heavy
            // scenery continues in the background and other actor/object models
            // load on demand, so an unused GLB cannot strand the loading overlay.
            phase: 'startup',
            playerType: this.playerType,
            concurrency: 2,
            timeoutMs: 30000,
            failFast: false,
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
        if (typeof this.worldGenerator.createTownBase === 'function') {
            await this.worldGenerator.createTownBase(0, 200, 100);
            void this.startDeferredOverworldScenery();
        } else {
            // Preserve compatibility with lightweight/custom generators.
            await this.worldGenerator.createTown(0, 200, 100);
            await this.worldGenerator.createOverworldStructures();
        }
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
            this.handlePointerRaycast(mouse);
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
            const escMenuWasOpen = this.uiManager.isEscMenuOpen;
            this.uiManager.handleEscape();
            if (escMenuWasOpen && !this.uiManager.isEscMenuOpen) {
                this.uiManager.onEscMenuClosedByEscape?.();
            }
        });

        this.inputManager.subscribe('onTeleport', () => {
            if (this.player) {
                console.log("Teleporting to town...");
                // Send recall request to server to ensure sync
                this.network.send('recall', {});
                const previousX = this.player.position.x;
                const previousZ = this.player.position.z;

                // Optimistic update
                // Match the authoritative server recall/respawn coordinate so
                // the next state snapshot never has to pull the player 1.25m
                // sideways immediately after this optimistic handoff.
                this.player.position.set(-1.25, 0, 200);
                this.player.targetPosition = null;
                this.player.state = 'IDLE';

                this.chunkManager.updateEntityChunk(this.player);
                this.renderSystem.setCameraTarget(this.player.position);
                this.chunkManager.update(this.player, 0, this.collisionManager);
                this.syncTownRecoveryGuidance(previousX, previousZ, this.player.position.x, this.player.position.z, 'recall');
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
                    if (this.uiManager.chat?.focusChatInput) {
                        this.uiManager.chat.focusChatInput();
                    } else {
                        this.uiManager.chatInput.focus();
                    }
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
            this.uiManager?.addGameMessage?.('Debug', `Dungeon debug overlay ${enabled ? 'enabled' : 'disabled'}.`);
        });

        if (onProgress) onProgress(95, "Waiting for silicon...");
        await new Promise(r => setTimeout(r, 1000));

        if (onProgress) onProgress(100, "Ready!");
        await new Promise(r => setTimeout(r, 100));

        this.connectToServer();

        this.loop(0);
    }

    startDeferredOverworldScenery() {
        if (this.overworldSceneryReady) {
            return Promise.resolve(true);
        }
        if (this.deferredOverworldSceneryPromise) {
            return this.deferredOverworldSceneryPromise;
        }

        const sceneGeneration = this.overworldSceneGeneration || 0;
        const sceneIsCurrent = () => (
            !this.isDestroyed &&
            sceneGeneration === (this.overworldSceneGeneration || 0) &&
            (!this.currentInstanceType || this.currentInstanceType === 'overworld')
        );
        const task = (async () => {
            // Interactive dungeon entrances must not sit behind the entire
            // decorative scenery queue. Start them first; the generator checks
            // sceneIsCurrent before attaching each structure so a concurrent
            // instance transition cannot repopulate a cleared scene.
            const structuresTask = Promise.resolve(
                this.worldGenerator.createOverworldStructures({ shouldAttach: sceneIsCurrent })
            ).then(result => result !== false).catch((error) => {
                console.warn('GameEngine: Deferred overworld structures failed to load.', error);
                return false;
            });
            // Code-native foliage is synchronous, light, and independent of
            // the remaining authored structures. Put realm identity on screen
            // immediately instead of holding it behind the background queue.
            const foliageTask = Promise.resolve(
                this.worldGenerator.loadTrees(0, 200, { shouldAttach: sceneIsCurrent })
            ).then(result => result !== false).catch((error) => {
                console.warn('GameEngine: Deferred realm foliage failed to load.', error);
                return false;
            });
            // Lanternhold architecture is also entirely code-native now. Build
            // it beside foliage instead of holding the town skyline behind the
            // remaining authored dungeon-facade downloads.
            const buildingsTask = Promise.resolve(
                this.worldGenerator.loadBuildings(0, 200, { shouldAttach: sceneIsCurrent })
            ).then(result => result !== false).catch((error) => {
                console.warn('GameEngine: Deferred town architecture failed to load.', error);
                return false;
            });

            const result = await MeshFactory.preloadAllModels({
                phase: 'background',
                concurrency: 2,
                timeoutMs: 30000,
                failFast: false
            });

            if (!sceneIsCurrent()) {
                await Promise.all([structuresTask, foliageTask, buildingsTask]);
                return false;
            }

            if (result?.failures?.length) {
                console.warn(
                    `GameEngine: Deferred scenery continuing after ${result.failures.length} optional model preload failure(s).`
                );
            }

            const [structuresReady, foliageReady, buildingsReady] = await Promise.all([
                structuresTask,
                foliageTask,
                buildingsTask
            ]);

            if (!sceneIsCurrent()) {
                return false;
            }

            // The deferred pass has completed even if one optional asset used a
            // fallback or failed. Avoid duplicating already attached scenery.
            this.overworldSceneryReady = true;
            return structuresReady || foliageReady || buildingsReady;
        })().catch((error) => {
            console.warn('GameEngine: Deferred overworld scenery failed to load.', error);
            return false;
        });

        const trackedTask = task.finally(() => {
            if (this.deferredOverworldSceneryPromise === trackedTask) {
                this.deferredOverworldSceneryPromise = null;
            }
        });
        this.deferredOverworldSceneryPromise = trackedTask;
        return trackedTask;
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
        questNPC.position.set(-20, 0, 200); // In full view outside the smithy door
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
        if (this.isPlayerClassEntity(entity)) return Boolean(this.socialController?.isPvPHostile?.(entity.id));
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
        case 'umbral_nexus':
            return 'Umbral Nexus';
        case 'weekly_raid':
            return "The Umbra's First Eidolon";
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
            return 'Trading House';
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
        const interactableType = entity.constructor?.name || entity.type || entity.meshType || entity.name || '';
        let promptLabel;
        let statusLabel = inRange ? `${entityLabel} • In range` : `${entityLabel} • Move closer`;

        if (isDungeonEntrance) {
            const summary = this.currentDungeonRoomState;
            const hoveredDungeonType = entity.userData?.dungeonType || '';
            const isCurrentDungeon = hoveredDungeonType && hoveredDungeonType === this.currentInstanceType;
            const objectiveRoom = isCurrentDungeon && summary && Array.isArray(summary.rooms) && typeof summary.objectiveRoomIndex === 'number'
                ? summary.rooms.find((room) => room && room.index === summary.objectiveRoomIndex)
                : null;
            const nextRoomAfterObjective = objectiveRoom ? findNextDungeonMeaningfulRoom(summary, objectiveRoom.index) : null;
            const bossIsLiveNow = isLiveDungeonBossRoom(objectiveRoom, summary);

            if (isCurrentDungeon && objectiveRoom) {
                const beatLabel = this.getDungeonBeatLabel(objectiveRoom);
                const cadenceLabel = getDungeonCadenceLabel(objectiveRoom);
                statusLabel = bossIsLiveNow
                    ? `${entityLabel} • Boss Now`
                    : cadenceLabel
                        ? `${entityLabel} • Next: ${beatLabel} • ${cadenceLabel}`
                        : `${entityLabel} • Next: ${beatLabel}`;

                if (bossIsLiveNow) {
                    promptLabel = 'You are in the boss room — commit and survive';
                } else if (objectiveRoom.roomRole === 'event') {
                    promptLabel = 'Elite room ahead — pressure spike incoming';
                } else if (objectiveRoom.roomRole === 'recovery') {
                    promptLabel = getDungeonRoomRole(nextRoomAfterObjective) === 'boss'
                        ? 'Last reset before the boss push'
                        : 'Shrine ahead — brief reset before the push';
                } else if (objectiveRoom.roomRole === 'reward') {
                    promptLabel = ['event', 'elite'].includes(getDungeonRoomRole(nextRoomAfterObjective))
                        ? 'Quick score before the ambush spike'
                        : 'Treasure room ahead — quick reward before danger';
                } else if (objectiveRoom.roomRole === 'boss') {
                    promptLabel = 'Boss room ahead — reset and commit';
                } else if (objectiveRoom.roomRole === 'elite') {
                    promptLabel = objectiveRoom.explored ? 'Elite room discovered' : 'Elite threat ahead';
                } else if (objectiveRoom.roomRole === 'approach') {
                    promptLabel = 'Final room before the boss — clear it, then commit';
                } else {
                    promptLabel = inRange
                        ? 'Click to open the dungeon portal.'
                        : 'Move closer to interact with this dungeon portal.';
                }
            } else {
                promptLabel = inRange
                    ? 'Click to open the dungeon portal.'
                    : 'Move closer to interact with this dungeon portal.';
            }
        } else if (interactableType === 'QuestNPC') {
            promptLabel = inRange
                ? 'Click to browse the Quest Giver’s daily contracts. Your Chronicle starts automatically.'
                : 'Move closer to browse daily contracts. Your Chronicle starts automatically.';
        } else if (interactableType === 'Forge') {
            promptLabel = inRange
                ? 'Click to use the Forge and upgrade or socket gear.'
                : 'Move closer to use the Forge and upgrade or socket gear.';
        } else if (interactableType === 'Stash') {
            promptLabel = inRange
                ? 'Click to open the Stash and sort spare gear.'
                : 'Move closer to open the Stash and sort spare gear.';
        } else if (interactableType === 'TradingHouse') {
            promptLabel = inRange
                ? 'Click to open the Trading House and buy or sell items with other players.'
                : 'Move closer to open the Trading House and buy or sell items with other players.';
        } else if (interactableType === 'DwarfSalesman') {
            promptLabel = inRange
                ? 'Click to open Vendor / Repair and gamble or sell unwanted gear.'
                : 'Move closer to open Vendor / Repair and gamble or sell unwanted gear.';
        } else if (interactableType === 'DungeonNPC') {
            promptLabel = inRange
                ? 'Click to talk to the Dungeon Guide and start your first dungeon run.'
                : 'Move closer to talk to the Dungeon Guide and start your first dungeon run.';
        } else {
            promptLabel = inRange
                ? `Click to interact with ${dungeonName}.`
                : `Move closer to interact with ${dungeonName}.`;
        }

        return {
            dungeonType: isDungeonEntrance ? (entity.userData?.dungeonType || '') : '',
            dungeonName,
            inRange,
            distance,
            statusLabel,
            promptLabel
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

    clearCombatTargetHighlight() {
        this.detachCombatTargetHighlight();
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

    getDungeonBeatLabel(room) {
        return getSharedDungeonBeatLabel(room, this.currentDungeonRoomState);
    }

    buildDungeonBeatAdvanceCallout(previousSummary, nextSummary) {
        if (!previousSummary || !nextSummary || !Array.isArray(nextSummary.rooms)) {
            return null;
        }

        const previousObjective = Number(previousSummary.objectiveRoomIndex);
        const nextObjective = Number(nextSummary.objectiveRoomIndex);
        const previousRoom = Number(previousSummary.currentRoomIndex);
        const nextRoom = Number(nextSummary.currentRoomIndex);
        const progressedObjective = Number.isFinite(nextObjective) && nextObjective >= 0 && nextObjective !== previousObjective;
        const progressedRoom = Number.isFinite(nextRoom) && nextRoom >= 0 && nextRoom !== previousRoom;
        const bossWentLive = Number.isFinite(nextRoom)
            && nextRoom >= 0
            && nextRoom === nextObjective
            && (previousRoom !== nextRoom || previousObjective !== nextObjective);
        if (!progressedObjective && !progressedRoom && !bossWentLive) {
            return null;
        }

        const objectiveRoom = nextSummary.rooms.find((room) => room && room.index === nextObjective);
        if (!objectiveRoom) {
            return null;
        }

        const beatLabel = this.getDungeonBeatLabel(objectiveRoom);
        const nextRoomAfterObjective = findNextDungeonMeaningfulRoom(nextSummary, nextObjective);
        const bossIsLiveNow = isLiveDungeonBossRoom(objectiveRoom, nextSummary);
        let title = `Next: ${beatLabel}`;
        let subtitle = 'Next room marked on the route';
        let tone = 'support';
        if (objectiveRoom.roomRole === 'event') {
            subtitle = 'Elite room ahead — pressure spike incoming';
            tone = 'warning';
        } else if (objectiveRoom.roomRole === 'boss') {
            title = bossIsLiveNow ? 'Boss Now' : `Next: ${beatLabel}`;
            subtitle = bossIsLiveNow
                ? 'You are in the boss room — commit and survive'
                : 'Boss room ahead — reset and commit';
            tone = 'boss';
        } else if (objectiveRoom.roomRole === 'recovery') {
            subtitle = getDungeonRoomRole(nextRoomAfterObjective) === 'boss'
                ? 'Last reset before the boss push'
                : 'Shrine ahead — brief reset before the push';
        } else if (objectiveRoom.roomRole === 'reward') {
            subtitle = ['event', 'elite'].includes(getDungeonRoomRole(nextRoomAfterObjective))
                ? 'Quick score before the ambush spike'
                : 'Treasure room ahead — quick reward before danger';
        } else if (objectiveRoom.roomRole === 'elite') {
            subtitle = objectiveRoom.explored ? 'Elite room discovered' : 'Elite threat ahead';
        } else if (objectiveRoom.roomRole === 'approach') {
            subtitle = 'Final room before the boss — clear it, then commit';
            tone = 'warning';
        }

        return {
            title,
            tone,
            duration: 2.4,
            subtitle
        };
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
                id: 'divine_intervention',
                active: Boolean(actor.divineInterventionActive) && Number(actor.divineInterventionTimer || 0) > 0,
                icon: '🪽',
                name: 'Divine Intervention',
                durationSeconds: Number(actor.divineInterventionTimer || 0),
                detail: 'Fatal damage prevention active',
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
                id: 'spell_focus',
                active: Boolean(actor.spellFocusActive) && Number(actor.spellFocusTimer || 0) > 0,
                icon: '🔮',
                name: 'Spell Focus',
                durationSeconds: Number(actor.spellFocusTimer || 0),
                detail: `+${Math.round((Number(actor.spellFocusMultiplier || 1) - 1) * 100)}% next spell damage`,
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
                durationSeconds: Number(actor.arcaneShieldTimer || 0),
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
                id: 'weak_point',
                active: Number(actor.weakPointMarkTimer) > 0,
                icon: '🎯',
                name: 'Weak Point',
                durationSeconds: Number(actor.weakPointMarkTimer || 0),
                detail: 'Vulnerable to piercing throw',
                isDebuff: true
            },
            {
                id: 'mark_weakness',
                active: Number(actor.markWeaknessTimer) > 0,
                icon: '🎯',
                name: 'Marked',
                durationSeconds: Number(actor.markWeaknessTimer || 0),
                detail: Number(actor.markWeaknessFactor || 0) > 0 ? `+${Math.round(Number(actor.markWeaknessFactor || 0) * 100)}% damage taken` : 'Damage taken increased',
                isDebuff: true
            },
            {
                id: 'bleed',
                active: Number(actor.bleedTimer) > 0,
                icon: '🩸',
                name: 'Bleeding',
                durationSeconds: Number(actor.bleedTimer || 0),
                detail: Number(actor.bleedTickDamage || 0) > 0
                    ? `${Math.round(Number(actor.bleedTickDamage || 0))} bleed per tick`
                    : `${Math.max(1, Math.round(Number(actor.bleedStacks || 0)))} bleed stacks`,
                isDebuff: true
            },
            {
                id: 'poison',
                active: Number(actor.poisonTimer) > 0,
                icon: '☠️',
                name: 'Poisoned',
                durationSeconds: Number(actor.poisonTimer || 0),
                detail: Number(actor.poisonTickDamage || 0) > 0
                    ? `${Math.round(Number(actor.poisonTickDamage || 0))} poison per tick`
                    : `${Math.max(1, Math.round(Number(actor.poisonStacks || 0)))} poison stacks`,
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
            } else if (subType === 'CrystalKeeper') {
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
                // Umbral Nexus deliberately recombines existing procedural rigs.
                case 'DissonantShade': p = new ScorchedWraith(id); break;
                case 'MemoryReaver': p = new Construct(id); break;
                case 'DissonantHerald': p = new Stormcallers(id); break;
                case 'NullArchitect': p = new ObsidianGuardian(id); break;
                case 'EidolonDevourer': p = new HollowSentinel(id); break;
                case 'UmbraPrime':
                    p = new HollowSentinel(id);
                    p.meshType = 'UmbraPrime';
                    p.name = 'Malachar, the Dark King';
                    break;
                case 'GravenColossus': p = new HollowSentinel(id); break;
                case 'TideboundTyrant': p = new Thalorath(id); break;
                case 'AshenImperator': p = new LordInfernax(id); break;
                case 'TempestSovereign': p = new Zephyrion(id); break;
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

        // Persistent actor-owned VFX use the engine's world-space effect group
        // and must not inherit scaled/rotating model transforms.
        entity.gameEngine = this;

        const originalOnMeshReady = entity.onMeshReady;
        entity.onMeshReady = (mesh) => {
            console.log(`GameEngine: Mesh ready for ${entity.id}`);

            if (!entity.isActive) {
                console.log(`GameEngine: Entity ${entity.id} is inactive, discarding mesh.`);
                if (mesh.parent?.remove) {
                    mesh.parent.remove(mesh);
                } else {
                    this.renderSystem.remove(mesh);
                }
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
            if (this.chunkManager.activeChunkKeys.has(key) || isAlwaysResidentEntityType(entity.type)) {
                console.log(`GameEngine: Adding mesh for ${entity.id} to scene (delayed)`);
                this.renderSystem.add(mesh);
            } else {
                console.log(`GameEngine: Chunk ${key} not active, mesh not added yet`);
            }
        };

        this.chunkManager.addEntity(entity);

        if (entity.mesh && entity.onMeshReady) {
            entity.onMeshReady(entity.mesh);
            entity.onMeshReady = null;
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
            if (entity === killer || entity.state === 'DEAD' || !entity.stats || !entity.isActive || typeof entity.takeDamage !== 'function') return;
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


}

installGameEngineNetworkMessages(GameEngine);
installGameEngineEntitySync(GameEngine);
installGameEngineMovement(GameEngine);
installGameEngineRuntime(GameEngine);
