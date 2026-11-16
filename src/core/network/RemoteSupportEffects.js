import { syncWellRested } from '../gameplay/progression/WellRested.js';
import { syncWhirlwindPresentation } from '../../skills/fighter/whirlwindPresentation.js';
import { createTimedRemoteEffectConfig } from './TimedRemoteEffectConfig.js';
import { readDamageBuffMultiplier } from '../gameplay/combat/FighterDamageBuffState.js';
import { readClericUtilityScalar } from '../gameplay/combat/ClericUtilityState.js';
import { GUARDIAN_ROAR_DAMAGE_REDUCTION_PERCENT } from '../gameplay/combat/GuardianRoar.js';

const REMOTE_EFFECT_SYNC_CONFIG = {
    invulnerable: createTimedRemoteEffectConfig({
        payloadKey: 'invulnerableActive', durationKey: 'invulnerableDuration',
        timerProperty: 'invulnerabilityTimer', fallbackDuration: 0,
    }),
    spirit_guardians: {
        payloadKey: 'spiritsActive',
        payloadKeys: ['spiritsActive', 'spiritsBoosted', 'spiritDuration', 'spiritRadius', 'spiritRune'],
        getPreviousActive: (entity) => Boolean(entity.spiritsActive),
        applyPayload: (entity, value, payload) => {
            const wasActive = Boolean(entity.spiritsActive);
            const nextActive = value !== undefined ? Boolean(value) : wasActive;
            const nextBoosted = nextActive && Boolean(payload.spiritsBoosted ?? entity.spiritBoosted);

            if (!nextActive) {
                entity.spiritsActive = false;
                entity.spiritBoosted = false;
                entity.spiritDuration = 0;
                entity.spiritRadius = 0;
                entity.spiritRune = '';
                if (typeof entity.clearSpiritMeshes === 'function') {
                    entity.clearSpiritMeshes();
                }
                return;
            }

            entity.spiritsActive = true;
            if (!wasActive || nextBoosted !== Boolean(entity.spiritBoosted)) {
                entity.spiritDuration = nextBoosted ? 10 : 8;
            }
            entity.spiritBoosted = nextBoosted;
            if (payload.spiritRadius !== undefined) {
                const radius = Number(payload.spiritRadius);
                entity.spiritRadius = Number.isFinite(radius) && radius > 0 ? radius : 0;
            }
            if (payload.spiritRune !== undefined) entity.spiritRune = String(payload.spiritRune || '');

            if (payload.spiritDuration !== undefined) {
                entity.spiritDuration = Math.max(0, Number(payload.spiritDuration || 0));
            }

            if (typeof entity.createSpirits === 'function') {
                entity.createSpirits();
            }
        },
        getNextActive: (entity) => Boolean(entity.spiritsActive),
    },
    guardian_embrace: { ...createTimedRemoteEffectConfig({
        payloadKey: 'guardianEmbraceActive',
        durationKey: 'guardianEmbraceDuration',
        timerProperty: 'guardianEmbraceTimer',
        fallbackDuration: 10,
        onActivate: (entity, payload) => {
            if (payload.guardianEmbraceRadius !== undefined) {
                const radius = Number(payload.guardianEmbraceRadius);
                entity.guardianEmbraceRadius = Number.isFinite(radius) && radius > 0 ? radius : 10;
            } else if (!(entity.guardianEmbraceRadius > 0)) entity.guardianEmbraceRadius = 10;
        },
        onDeactivate: entity => { entity.guardianEmbraceRadius = 0; }
    }), payloadKeys: ['guardianEmbraceActive', 'guardianEmbraceDuration', 'guardianEmbraceRadius'] },
    blessing_resolve: createTimedRemoteEffectConfig({
        payloadKey: 'blessingResolveActive',
        durationKey: 'blessingResolveDuration',
        timerProperty: 'blessingResolveTimer',
        fallbackDuration: 20,
        extraPayloadKeys: ['blessingResolvePower'],
        onActivate: (entity, payload) => {
            entity.blessingResolvePower = readClericUtilityScalar(payload, 'blessingResolvePower', entity.blessingResolvePower);
        },
        onDeactivate: entity => { entity.blessingResolvePower = 0; }
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
        extraPayloadKeys: ['spellFocusMultiplier', 'spellFocusCharges'],
        onActivate: (entity, payload) => {
            const count = Number(payload.spellFocusCharges);
            const newCounter = Number.isInteger(count) && count >= 1 && count <= 2;
            if (payload.spellFocusCharges !== undefined) entity.spellFocusCharges = newCounter ? count : 1;
            else if (payload.spellFocusActive === true) entity.spellFocusCharges = 1;
            else if (![1, 2].includes(entity.spellFocusCharges)) entity.spellFocusCharges = 1;
            if (payload.spellFocusMultiplier !== undefined) {
                const value = Number(payload.spellFocusMultiplier);
                const minimum = newCounter ? 1.75 : 2.5, maximum = newCounter ? 3.5 : 3;
                entity.spellFocusMultiplier = Number.isFinite(value) && value >= minimum && value <= maximum ? value : 2.5;
            } else if (!Number.isFinite(entity.spellFocusMultiplier) || entity.spellFocusMultiplier <= 1) {
                entity.spellFocusMultiplier = 2.5;
            }
        },
        onDeactivate: (entity) => { entity.spellFocusMultiplier = 1; entity.spellFocusCharges = 0; entity.spellFocusRuneId = ''; }
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
        fallbackDuration: 10,
        onActivate: entity => { entity.guardianRoarReduction = GUARDIAN_ROAR_DAMAGE_REDUCTION_PERCENT / 100; },
        onDeactivate: entity => { entity.guardianRoarReduction = 0; }
    }),
    berserker_edge: createTimedRemoteEffectConfig({
        payloadKey: 'berserkerModeActive',
        durationKey: 'berserkerModeDuration',
        activeProperty: 'berserkerEdgeActive',
        timerProperty: 'berserkerEdgeTimer',
        fallbackDuration: 15,
        extraPayloadKeys: ['berserkerModeMultiplier'],
        onActivate: (entity, payload) => {
            entity.berserkerEdgeMultiplier = readDamageBuffMultiplier(payload, 'berserkerModeMultiplier', entity.berserkerEdgeMultiplier, 1.5, 1.8);
        },
        onDeactivate: entity => { entity.berserkerEdgeMultiplier = 1; }
    }),
    last_stand: createTimedRemoteEffectConfig({
        payloadKey: 'lastStandActive',
        durationKey: 'lastStandDuration',
        timerProperty: 'lastStandTimer',
        fallbackDuration: 10,
        extraPayloadKeys: ['lastStandMultiplier'],
        onActivate: (entity, payload) => {
            entity.lastStandMultiplier = readDamageBuffMultiplier(payload, 'lastStandMultiplier', entity.lastStandMultiplier, 3, 3.6, 2);
            entity.lastStandDamageBoost = entity.lastStandMultiplier - 1;
        },
        onDeactivate: entity => { entity.lastStandMultiplier = 1; entity.lastStandDamageBoost = 0; }
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
        extraPayloadKeys: ['zealPower'],
        onActivate: (entity, payload) => {
            entity.zealPower = readClericUtilityScalar(payload, 'zealPower', entity.zealPower);
            entity.blessingZealFactor = .3 * entity.zealPower;
        },
        onDeactivate: entity => { entity.zealPower = 0; entity.blessingZealFactor = 0; }
    }),
    mark_weakness: createTimedRemoteEffectConfig({
        payloadKey: 'markWeakness',
        durationKey: 'markWeaknessDuration',
        timerProperty: 'markWeaknessTimer',
        fallbackDuration: 0.1,
        extraPayloadKeys: ['markWeaknessFactor'],
        onActivate: (entity, payload) => {
            entity.markWeaknessFactor = readClericUtilityScalar(payload, 'markWeaknessFactor', entity.markWeaknessFactor, .2, .5);
        },
        onDeactivate: entity => { entity.markWeaknessFactor = 0; }
    }),
};

/** Apply replicated support state; GameEngine retains presentation ownership. */
export function syncRemoteSupportEffects(engine, remoteEntity, payload) {
    syncWellRested(remoteEntity, payload);
    syncWhirlwindPresentation(engine, remoteEntity, payload);
    Object.entries(REMOTE_EFFECT_SYNC_CONFIG).forEach(([supportKey, config]) => {
        const payloadKeys = config.payloadKeys || [config.payloadKey];
        const hasRelevantPayload = payloadKeys.some((key) => payload[key] !== undefined);
        if (!hasRelevantPayload) return;

        const previousActive = config.getPreviousActive(remoteEntity);
        config.applyPayload(remoteEntity, payload[config.payloadKey], payload);
        const nextActive = config.getNextActive(remoteEntity);

        if (previousActive !== nextActive) {
            engine.showRemoteSupportStateReadability(remoteEntity, supportKey, nextActive);
        }
    });
    remoteEntity.syncAttachedStatusEffects?.(0);
}
