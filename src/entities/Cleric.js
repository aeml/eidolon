import { getClericAbilityDamage } from '../skills/clericAbilityDamage.js';
import { getClericBranchPlan } from '../skills/clericBranchRunes.js';
import { getAbilityRange } from '../core/AbilityRange.js';
import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';
import { disposeSceneMesh, spawnEffectSceneFallback } from './EffectSceneFallback.js';
import { SpiritGuardiansEffect } from './SpiritGuardiansEffect.js';
import { getAbilityAoeRadius } from '../skills/abilityRadii.js';
import { getAbilityHealingAmount, applyOfflineHealing } from '../core/AbilityHealing.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { createProceduralProjectileVisual, applyProceduralProjectileScale, updateProceduralProjectileVisual, releaseProceduralProjectileVisual } from '../art/ProceduralProjectileEffects.js';
import { clipDungeonEffectSegment } from '../skills/dungeonEffectGeometry.js';
import {applyOfflineHealingLight,applyOfflineRadiantStrike,applyOfflineDivineIntervention,resolveOfflineClericHealTarget} from './ClericAreaAbilities.js';
import { AvengingSeraph } from './AvengingSeraph.js';
import { configureOfflineSeraph, dismissOfflineSeraph } from './SeraphSummon.js';
import { getClericEffectDuration } from '../skills/clericEffectDuration.js';
import { getClericUtilityPower, isOfflineUtilityActor } from '../skills/clericUtilityPower.js';
import { findOfflineAbilityTarget } from '../skills/offlineAbilityTargeting.js';

export class Cleric extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.CLERIC);
        this.scaleAnimSpeed = true;
        this.meshType = 'Cleric';

        this.abilityName = "Spirit Guardians";
        this.abilityDescription = "Summon spirits that orbit you and damage nearby enemies.";
        this.abilityManaCost = 40;
        this.abilityMaxCooldown = 10.0;
        
        this.spiritsActive = false;
        this.spiritDuration = 0;
        this.spiritBoosted = false;
        this.spiritEffect = null;
        // Compatibility view for diagnostics that predate SpiritGuardiansEffect.
        this.spirits = [];
    }

    useAbility(targetVector, gameEngine, skillNameOverride = null) {
        const skill = skillNameOverride || this.abilityName;
        const branch = getClericBranchPlan(skill, this.skillRunes?.[skill]);
        const offline = !this.isMultiplayer && !this.isRemote && !gameEngine?.isMultiplayer;
        if (offline && !['Spirit Guardians', 'Guardian Spirits'].includes(skill) && !this.unlockedSkills.includes(skill)) return;
        if (offline && skill === 'Avenging Seraph' && !gameEngine?.addEntity) return;
        const markedTarget = offline && skill === 'Mark of Weakness'
            ? findOfflineAbilityTarget(this, gameEngine, targetVector || this.position, { range: getAbilityRange(this, skill, 15), cursorRadius: 5 }) : null;
        if (offline && skill === 'Mark of Weakness' && (!markedTarget || !isOfflineUtilityActor(markedTarget) ||
            markedTarget.stats.hp <= 0 || (markedTarget.instanceId || '') !== (this.instanceId || ''))) return;
        const previous = this.lastOfflineClericCast;
        const chained = offline && previous && Date.now()-previous.at >= 0 && Date.now()-previous.at <= 3000;
        this.healingLightMassRevival = Boolean(chained && skill === 'Healing Light' && previous.skill === 'Divine Intervention');
        const holyFury = chained && skill === 'Radiant Strike' && previous.skill === 'Consecrated Ground';
        const sanctuary = chained && skill === 'Guardian Embrace' && previous.skill === 'Healing Light';
        const divineStorm = chained && skill === 'Spirit Guardians' && previous.skill === 'Blessing of Zeal';
        this.spiritGuardiansDivineStorm = Boolean(divineStorm);
        const healingTarget = offline && ['Healing Light','Divine Intervention'].includes(skill)
            ? (this.healingLightMassRevival ? this : resolveOfflineClericHealTarget(this,targetVector,gameEngine)) : null;
        // Resolve the offline target before the canonical cast presentation, so
        // a fallback heal or Mass Revival is drawn at its actual healing center.
        if (healingTarget) targetVector = healingTarget.position;
        if (!super.useAbility(targetVector, gameEngine, skillNameOverride)) {
            this.healingLightMassRevival = false;
            this.spiritGuardiansDivineStorm = false;
            return;
        }
        this.gameEngine = gameEngine || this.gameEngine;
        if (!offline) return true;
        this.lastOfflineClericCast = {skill,at:Date.now()};
        const combo = holyFury ? ['Holy Fury', 'holy_fury'] : sanctuary ? ['Sanctuary', 'sanctuary_combo']
            : divineStorm ? ['Divine Storm', 'divine_storm'] : null;
        if (combo) {
            gameEngine.floatingTextManager?.spawn(`COMBO: ${combo[0]}!`, this.position, '#ffd700');
            gameEngine.uiManager?.showComboNotification?.(...combo);
        }

        if (skill === "Healing Light") {
            // Shared economy has already charged mana and the trained 8s CD.
            applyOfflineHealingLight(this,healingTarget,gameEngine);
            this.healingLightMassRevival = false;
            return;
        }

        if (skill === "Guardian Embrace") {
            console.log("Cleric used Guardian Embrace!");
            
            this.guardianEmbraceActive = true;
            this.guardianEmbraceTimer = getClericEffectDuration(this, skill, 10 * branch.duration);
            this.guardianEmbraceRune = this.skillRunes?.[skill] || '';
            this.guardianEmbraceRadius = getAbilityAoeRadius('Cleric', skill, this);
            this.embraceTickTimer = 1; // The server's first eligible update pulses immediately.
            if (sanctuary) {
                this.invulnerabilityTimer = Math.max(this.invulnerabilityTimer || 0, getClericEffectDuration(this, skill, 3));
            }
            
            gameEngine.floatingTextManager.spawn("Guardian Embrace!", this.position, '#ffff00');
            this.spawnVisualEffect(gameEngine, this.position, 0xffff00, "buff");
            this.syncAttachedStatusEffects(0);
            return;
        }

        if (skill === "Purifying Wave") {
            console.log("Cleric used Purifying Wave!");
            
            // Shared cost, cooldown and area presentation; allies are cleansed,
            // while the hostile pulse cannot cross dungeon walls.
            const radius = getAbilityAoeRadius('Cleric', skill, this);
            const rects = gameEngine.currentInstanceId && gameEngine.currentInstanceType !== 'overworld'
                ? gameEngine.currentDungeonLayout?.walkRects : null;
            const entities = new Set([this, ...gameEngine.chunkManager.getActiveEntities()]);
            for (const entity of entities) {
                if (!(entity instanceof Actor) || !entity.isActive || entity.state === 'DEAD' || entity.stats.hp <= 0 ||
                    !isOfflineUtilityActor(entity) || (entity.instanceId || '') !== (this.instanceId || '')) continue;
                const hostile = entity !== this && (typeof gameEngine.isHostileActorTarget === 'function'
                    ? gameEngine.isHostileActorTarget(entity)
                    : !['Fighter', 'Rogue', 'Wizard', 'Cleric', 'AvengingSeraph'].includes(entity.constructor.name));
                const distance = Math.hypot(this.position.x - entity.position.x, this.position.z - entity.position.z);
                if (distance > radius + (entity.radius || 0)) continue;
                if (hostile) {
                    if (clipDungeonEffectSegment(rects, this.position, entity.position).blocked) continue;
                    applyOfflineAbilityHit(this, entity, Math.floor((20 + this.stats.wisdom) * branch.damage), skill, gameEngine.floatingTextManager, '#ffff66');
                    if (entity.stats.hp > 0 && !entity.ccImmune && !(entity.slowTimer > 0)) {
                        entity.slowFactor = .30;
                        entity.slowTimer = getClericEffectDuration(this, skill, branch.slowDuration);
                    }
                    continue;
                }
                entity.cleanse();
                gameEngine.floatingTextManager?.spawn('Cleanse!', entity.position, '#ffffff');
            }
            return;
        }

        if (skill === "Divine Intervention") {
            applyOfflineDivineIntervention(this, healingTarget, gameEngine);
            return;
        }

        // --- Branch B: Battle Cleric ---

        if (skill === "Radiant Strike") {
            applyOfflineRadiantStrike(this,targetVector,gameEngine,holyFury);
            return;
        }

        if (skill === "Consecrated Ground") {
            console.log("Cleric used Consecrated Ground!");

            this.clearConsecratedZone();
            const radius = getAbilityAoeRadius('Cleric', skill, this);
            const visual = createProceduralProjectileVisual('ZoneHoly');
            visual.position.copy(this.position);
            visual.scale.setScalar(radius / 5);
            applyProceduralProjectileScale(visual, radius / 5);
            (gameEngine.effectScene || gameEngine.scene)?.add(visual);
            this.consecratedZone = {
                position: this.position.clone(),
                duration: getClericEffectDuration(this, skill, this.skillRunes?.[skill] === 'consecratedground_lingering' ? 16 : 8),
                radius, visual, elapsed: 0, tickTimer: 1,
                sanctuary: this.skillRunes?.[skill] === 'consecratedground_sanctuary',
                damage: getClericAbilityDamage(this, skill, 20 + this.stats.wisdom)
            };
            return;
        }

        if (skill === "Spirit Guardians Boost") {
            console.log("Cleric used Spirit Guardians Boost!");

            this.spiritsActive = true;
            this.spiritDuration = getClericEffectDuration(this, skill, 10 * branch.duration);
            this.spiritBranchRune = this.skillRunes?.[skill] || '';
            this.spiritBoosted = true; // Enable boost
            this.spiritRadius = getAbilityAoeRadius('Cleric', skill, this);
            this.spiritRune = this.skillRunes?.['Spirit Guardians'] || '';
            this.spiritSanctuaryTimer = this.spiritRune === 'spirits_sanctuary' ? this.spiritDuration : 0;
            this.spiritDamageTimer = .5;
            this.createSpirits(gameEngine);
            
            gameEngine.floatingTextManager.spawn("SPIRIT BOOST!", this.position, '#ffff00');
            return;
        }

        if (skill === "Avenging Seraph") {
            console.log("Cleric used Avenging Seraph!");
            
            // Shared economy already charged the trained cost and cooldown.
            const seraph = new AvengingSeraph(`summon-seraph-${crypto.randomUUID()}`);
            configureOfflineSeraph(seraph, this, gameEngine);
            gameEngine.addEntity(seraph);
            
            gameEngine.floatingTextManager.spawn("SERAPH SUMMONED!", this.position, '#ffffff');
            return;
        }

        // --- Branch C: Buff/Debuff Support ---

        if (skill === "Blessing of Resolve" || skill === "Blessing of Zeal") {
            if (skill === 'Blessing of Zeal') this.cooldowns['Spirit Guardians'] = 0;
            const radius = getAbilityAoeRadius('Cleric', skill, this);
            const power = getClericUtilityPower(this, skill);
            // Retain shared cooldown/presentation and include self even when
            // the chunk list omits the local actor. Support remains planar.
            for (const entity of new Set([this, ...gameEngine.chunkManager.getActiveEntities()])) {
                if (!(entity instanceof Actor) || !entity.isActive || entity.state === 'DEAD' || !isOfflineUtilityActor(entity) || (entity.instanceId || '') !== (this.instanceId || '')) continue;
                if (!isOfflineUtilityActor(entity) || (entity.instanceId || '') !== (this.instanceId || '')) continue;
                const hostile = entity !== this && (typeof gameEngine.isHostileActorTarget === 'function'
                    ? gameEngine.isHostileActorTarget(entity)
                    : !['Fighter', 'Rogue', 'Wizard', 'Cleric', 'AvengingSeraph'].includes(entity.constructor.name));
                if (hostile || Math.hypot(this.position.x - entity.position.x, this.position.z - entity.position.z) > radius + (entity.radius || 0)) continue;
                if (skill === 'Blessing of Resolve') {
                    entity.blessingResolveTimer = getClericEffectDuration(this, skill, 20 * branch.duration);
                    entity.blessingResolveActive = true;
                    entity.blessingResolvePower = power;
                    entity.blessingResolveReduction = 0;
                    gameEngine.floatingTextManager.spawn('DEFENSE UP!', entity.position, '#0000ff');
                } else {
                    entity.blessingZealTimer = getClericEffectDuration(this, skill, 8 * branch.duration);
                    entity.blessingZealActive = true;
                    entity.zealPower = power;
                    entity.blessingZealFactor = .3 * power;
                    gameEngine.floatingTextManager.spawn('ZEAL!', entity.position, '#ff0000');
                }
                entity.recalculateStats();
                entity.syncAttachedStatusEffects(0);
            }
            return;
        }



        if (skill === "Mark of Weakness") {
            console.log("Cleric used Mark of Weakness!");
            

            const target = markedTarget;

            if (target) {
                target.markWeaknessTimer = getClericEffectDuration(this, skill, 10 * branch.duration);
                target.markWeaknessFactor = .20 * getClericUtilityPower(this, skill);
                gameEngine.floatingTextManager.spawn("MARKED!", target.position, '#800080');
                this.spawnVisualEffect(gameEngine, target.position, 0x800080, "pillar");
            }
            return;
        }

        if (skill === "Heaven's Trumpet") {
            console.log("Cleric used Heaven's Trumpet!");

            const radius = getAbilityAoeRadius('Cleric', skill, this);
            const entities = gameEngine.chunkManager.getActiveEntities();
            const rects = gameEngine.currentInstanceId && gameEngine.currentInstanceType !== 'overworld'
                ? gameEngine.currentDungeonLayout?.walkRects : null;
            gameEngine.floatingTextManager.spawn("HEAVEN'S TRUMPET!", this.position, '#ffd700');

            entities.forEach(entity => {
                if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const hostile = typeof gameEngine.isHostileActorTarget === 'function' ? gameEngine.isHostileActorTarget(entity)
                        : !['Fighter', 'Rogue', 'Wizard', 'Cleric', 'AvengingSeraph'].includes(entity.constructor.name);
                    if (hostile) {
                        if (Math.hypot(this.position.x - entity.position.x, this.position.z - entity.position.z) <= radius + (entity.radius || 0) &&
                            !clipDungeonEffectSegment(rects, this.position, entity.position).blocked) {
                            // The server deals damage before applying its weakness mark.
                            applyOfflineAbilityHit(this, entity, Math.floor(getClericAbilityDamage(this, skill, this.stats.wisdom * 3) * branch.damage), skill, gameEngine.floatingTextManager, '#ffff00');
                            // Stun
                            if (entity.stunTimer !== undefined && !entity.ccImmune) {
                                entity.stunTimer = Math.max(entity.stunTimer || 0, getClericEffectDuration(this, skill, branch.stun));
                            }
                            // Debuff
                            entity.markWeaknessTimer = getClericEffectDuration(this, skill, 5 * branch.duration);
                            entity.markWeaknessFactor = 0.50; // 50% more damage taken!
                            
                            gameEngine.floatingTextManager.spawn(entity.ccImmune ? 'WEAKENED!' : 'STUNNED!', entity.position, '#ffffff');
                        }
                    }
                }
            });
            return;
        }

        // Default: Spirit Guardians
        if (skill === "Spirit Guardians" || skill === "Guardian Spirits" || skill === this.abilityName) {
            console.log("Cleric used Spirit Guardians!");
            
            this.spiritsActive = true;
            this.spiritDuration = getClericEffectDuration(this, 'Spirit Guardians', 8);
            this.spiritBranchRune = '';
            this.spiritBoosted = Boolean(divineStorm);
            this.spiritRadius = getAbilityAoeRadius('Cleric', 'Spirit Guardians', this);
            this.spiritGuardiansDivineStorm = false;
            this.spiritRune = this.skillRunes?.['Spirit Guardians'] || '';
            this.spiritSanctuaryTimer = this.spiritRune === 'spirits_sanctuary' ? this.spiritDuration : 0;
            this.spiritDamageTimer = .5;
            this.createSpirits(gameEngine);
            return;
        }
    }

    spawnVisualEffect(gameEngine, position, color, type) {
        if (this.shouldSuppressLegacyCastVisual()) return;
        if (!gameEngine || (!gameEngine.effectScene && !gameEngine.scene && typeof gameEngine.spawnTransientEffect !== 'function')) return;
        if (typeof gameEngine.spawnTransientEffect === 'function' && gameEngine.spawnTransientEffect(type, position, color, { source: this })) {
            return;
        }

        spawnEffectSceneFallback(gameEngine, position, color, type);
    }

    createSpirits(gameEngine = this.gameEngine) {
        this.gameEngine = gameEngine || this.gameEngine;
        const scene = this.gameEngine?.effectScene
            || this.gameEngine?.renderSystem?.effectGroup
            || this.mesh?.parent
            || null;
        if (!scene || !this.spiritsActive) return false;

        const runeId = this.spiritRune ?? this.skillRunes?.['Spirit Guardians'] ?? null;
        if (this.spiritEffect?.isActive) {
            this.spiritEffect.setVariant({ boosted: this.spiritBoosted, runeId });
            this.spirits = this.spiritEffect.guardians.map((mesh) => ({ mesh }));
            return true;
        }

        const quality = this.gameEngine?.uiManager?.getGraphicsQuality?.() || 'high';
        this.spiritEffect = new SpiritGuardiansEffect(scene, this, {
            boosted: this.spiritBoosted,
            runeId,
            quality
        });
        this.spirits = this.spiritEffect.guardians.map((mesh) => ({ mesh }));
        return true;
    }

    onMeshReady(mesh) {
        if (this.spiritsActive) {
            this.createSpirits();
        }
    }

    clearSpiritMeshes() {
        this.spiritEffect?.dispose?.();
        this.spiritEffect = null;
        this.spirits.forEach(s => {
            if (s?.mesh?.parent) disposeSceneMesh(s.mesh);
        });
        this.spirits = [];
    }

    clearSeraphMesh() {
        if (!this.seraphMesh) {
            return;
        }

        disposeSceneMesh(this.seraphMesh);
        this.seraphMesh = null;
    }

    clearConsecratedZone() {
        releaseProceduralProjectileVisual(this.consecratedZone?.visual);
        this.consecratedZone = null;
    }

    cancelAbilities() {
        for (const seraph of this.offlineSeraphs || []) dismissOfflineSeraph(seraph);
        this.lastOfflineClericCast = null;
        this.healingLightMassRevival = false;
        this.spiritGuardiansDivineStorm = false;
        this.clearConsecratedZone();
        this.spiritsActive = false;
        this.spiritDuration = 0;
        this.spiritRadius = 0;
        this.spiritRune = '';
        this.spiritBranchRune = '';
        this.spiritSanctuaryTimer = 0;
        this.spiritBoosted = false;
        this.spiritDamageTimer = 0;
        this.clearSpiritMeshes();
        this.guardianEmbraceActive = false;
        this.guardianEmbraceTimer = 0;
        this.guardianEmbraceRadius = 0;
        this.guardianEmbraceRune = '';
        this.seraphActive = false;
        this.clearSeraphMesh();
    }

    dispose() {
        this.cancelAbilities();
        super.dispose();
    }

    update(dt, collisionManager, player, chunkManager, floatingTextManager) {
        super.update(dt, collisionManager, player, chunkManager, floatingTextManager);

        // Consecrated Ground Logic
        if (this.consecratedZone) {
            this.consecratedZone.duration -= dt;
            if (this.consecratedZone.duration <= 0) {
                this.clearConsecratedZone();
            } else if (!this.isMultiplayer && !this.isRemote && !this.gameEngine?.isMultiplayer) {
                this.consecratedZone.elapsed += dt;
                updateProceduralProjectileVisual(this.consecratedZone.visual, 'ZoneHoly', this.consecratedZone.elapsed, dt);
                // Tick every 1s
                this.consecratedZone.tickTimer += dt;
                
                if (this.consecratedZone.tickTimer >= 1.0) {
                    this.consecratedZone.tickTimer -= 1.0;
                    const radius = this.consecratedZone.radius;
                    const healAmount = getAbilityHealingAmount(this, 'Consecrated Ground', 15 + Math.floor(this.stats.wisdom / 2));
                    const damageAmount = this.consecratedZone.damage;
                    const rects = this.gameEngine?.currentInstanceId && this.gameEngine.currentInstanceType !== 'overworld'
                        ? this.gameEngine.currentDungeonLayout?.walkRects : null;
                    
                    const entities = chunkManager ? chunkManager.getActiveEntities() : [];
                    new Set([this, ...entities]).forEach(entity => {
                        if (entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor && isOfflineUtilityActor(entity) && (entity.instanceId || '') === (this.instanceId || '')) {
                            if (Math.hypot(entity.position.x - this.consecratedZone.position.x, entity.position.z - this.consecratedZone.position.z) <= radius + (entity.radius || 0)) {
                                const hostile = entity !== this && (typeof this.gameEngine?.isHostileActorTarget === 'function'
                                    ? this.gameEngine.isHostileActorTarget(entity)
                                    : !['Wizard', 'Cleric', 'Fighter', 'Rogue', 'AvengingSeraph'].includes(entity.constructor.name));
                                if (!hostile) {
                                    if (this.consecratedZone.sanctuary) entity.consecratedSanctuaryTimer = 2;
                                    const received = entity.poisonTimer > 0 ? Math.max(1, Math.floor(healAmount / 2)) : healAmount;
                                    const before = entity.stats.hp;
                                    entity.stats.hp = Math.min(entity.stats.maxHp, before + received);
                                    if (entity.stats.hp > before) this.gameEngine?.floatingTextManager?.spawn(`+${entity.stats.hp - before}`, entity.position, '#00ff00');
                                } else {
                                    // Damage Enemies
                                    if (entity.takeDamage && !clipDungeonEffectSegment(rects, this.consecratedZone.position, entity.position).blocked) {
                                        applyOfflineAbilityHit(this, entity, damageAmount, 'Consecrated Ground', this.gameEngine?.floatingTextManager, '#ffff00');
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }

        // Guardian Embrace Logic
        if (this.guardianEmbraceActive) {
            this.guardianEmbraceTimer -= dt;
            if (this.guardianEmbraceTimer <= 0) {
                this.guardianEmbraceActive = false;
                this.guardianEmbraceTimer = 0;
                this.guardianEmbraceRadius = 0;
                this.guardianEmbraceRune = '';
                this.syncAttachedStatusEffects(0);
            } else if (!this.isMultiplayer && !this.isRemote && !this.gameEngine?.isMultiplayer) {
                // Heal Tick (every 1s)
                this.embraceTickTimer = (this.embraceTickTimer || 0) + dt;
                if (this.embraceTickTimer >= 1.0) {
                    this.embraceTickTimer -= 1.0;
                    const radius = this.guardianEmbraceRadius > 0 ? this.guardianEmbraceRadius : 10;
                    const healAmount = Math.floor(getAbilityHealingAmount(this, 'Guardian Embrace', 20 + this.stats.wisdom * 2) * getClericBranchPlan('Guardian Embrace', this.guardianEmbraceRune).healing);
                    
                    // Find allies in range
                    const entities = (this.gameEngine && this.gameEngine.chunkManager) ? this.gameEngine.chunkManager.getActiveEntities() : (chunkManager ? chunkManager.getActiveEntities() : []);
                    for (const entity of new Set([this, ...entities])) {
                        if (!(entity instanceof Actor) || !entity.isActive || entity.state === 'DEAD' || !isOfflineUtilityActor(entity) || (entity.instanceId || '') !== (this.instanceId || '')) continue;
                        const hostile = typeof this.gameEngine?.isHostileActorTarget === 'function'
                            ? this.gameEngine.isHostileActorTarget(entity)
                            : !['Fighter', 'Rogue', 'Wizard', 'Cleric', 'AvengingSeraph'].includes(entity.constructor.name);
                        if (entity !== this && hostile) continue;
                        if (Math.hypot(this.position.x - entity.position.x, this.position.z - entity.position.z) > radius + (entity.radius || 0)) continue;
                        const received = entity.poisonTimer > 0 ? Math.max(1, Math.floor(healAmount / 2)) : healAmount;
                        const before = entity.stats.hp;
                        entity.stats.hp = Math.min(entity.stats.maxHp, before + received);
                        const actual = entity.stats.hp - before;
                        if (actual > 0) this.gameEngine?.floatingTextManager?.spawn(`+${actual}`, entity.position, '#00ff00');
                    }
                }
            }
        }

        if (this.spiritsActive) {
            // Decrement spirit duration
            this.spiritDuration -= dt;
            
            // Check if spirits should expire
            if (this.spiritDuration <= 0) {
                this.spiritsActive = false;
                this.spiritDuration = 0;
                this.spiritRadius = 0;
                this.spiritRune = '';
                this.spiritBranchRune = '';
                this.spiritSanctuaryTimer = 0;
                this.spiritBoosted = false;
                this.clearSpiritMeshes();
            } else {
                if (!this.spiritEffect?.isActive) this.createSpirits();
                this.spiritEffect?.setVariant?.({
                    boosted: this.spiritBoosted,
                    runeId: this.spiritRune ?? this.skillRunes?.['Spirit Guardians'] ?? null
                });
                this.spiritEffect?.update?.(dt);

                // Offline simulation retains its local damage loop. Multiplayer
                // presentation follows server state and never applies combat.
                if (chunkManager && !this.isMultiplayer && !this.isRemote && !this.gameEngine?.isMultiplayer) {
                    this.spiritDamageTimer = (this.spiritDamageTimer || 0) + dt;
                    if (this.spiritDamageTimer >= 0.5) {
                        this.spiritDamageTimer -= .5;
                        
                        const damageRadius = this.spiritRadius > 0 ? this.spiritRadius : getAbilityAoeRadius(
                            'Cleric',
                            this.spiritBoosted ? 'Spirit Guardians Boost' : 'Spirit Guardians',
                            this
                        );
                        let damage = 10 + (this.stats.wisdom * 1.0);
                        if (this.spiritBoosted) damage = 20 + Math.floor(this.stats.wisdom * 1.5);
                        const spiritPlan = getClericBranchPlan('Spirit Guardians Boost', this.spiritBranchRune);
                        damage = getClericAbilityDamage(this, this.spiritBoosted ? 'Spirit Guardians Boost' : 'Spirit Guardians', damage);
                        damage = Math.floor(damage * spiritPlan.damage);
                        if (this.spiritRune === 'spirits_vengeful') damage = Math.floor(damage * 1.5);
                        const rects = this.gameEngine?.currentInstanceId && this.gameEngine.currentInstanceType !== 'overworld'
                            ? this.gameEngine.currentDungeonLayout?.walkRects : null;
                        const textManager = (this.gameEngine && this.gameEngine.floatingTextManager) || floatingTextManager;

                        const entities = chunkManager.getActiveEntities();
                        const spiritHeal = Object.values(this.activeSetBonuses || {}).some(set => set.specials?.spiritGuardiansHeal);
                        if (spiritHeal) for (const ally of entities) {
                            if (ally === this || !(ally instanceof Actor) || !isOfflineUtilityActor(ally) ||
                                (ally.instanceId || '') !== (this.instanceId || '') ||
                                !['Fighter', 'Rogue', 'Wizard', 'Cleric'].includes(ally.constructor.name) || this.gameEngine?.isHostileActorTarget?.(ally)) continue;
                            if (Math.hypot(ally.position.x - this.position.x, ally.position.z - this.position.z) > damageRadius + (ally.radius || 0)) continue;
                            const base = Math.floor((5 + Math.floor(this.stats.wisdom / 2)) * (this.spiritRune === 'spirits_vengeful' ? .75 : 1));
                            applyOfflineHealing(ally, getAbilityHealingAmount(this, this.spiritBoosted ? 'Spirit Guardians Boost' : 'Spirit Guardians', base), textManager);
                        }
                        for (const entity of entities) {
                            if (entity === this || entity.state === 'DEAD' || !entity.isActive || !isOfflineUtilityActor(entity) || (entity.instanceId || '') !== (this.instanceId || '')) continue;
                            if (entity.constructor.name === 'LootDrop') continue;
                            if (entity.constructor.name === 'DwarfSalesman') continue;
                            if (['Fighter', 'Rogue', 'Wizard', 'Cleric', 'AvengingSeraph'].includes(entity.constructor.name)) continue;
                            if (typeof this.gameEngine?.isHostileActorTarget === 'function' && !this.gameEngine.isHostileActorTarget(entity)) continue;
                            
                            const d = Math.hypot(this.position.x - entity.position.x, this.position.z - entity.position.z);
                            if (d <= damageRadius + (entity.radius || 0) && !clipDungeonEffectSegment(rects, this.position, entity.position).blocked) {
                                if (entity.takeDamage) {
                                    applyOfflineAbilityHit(this, entity, damage, this.spiritBoosted ? 'Spirit Guardians Boost' : 'Spirit Guardians', textManager, '#ffff66');
                                    if (this.spiritBoosted && spiritPlan.slow > 0 && entity.stats?.hp > 0 && !entity.ccImmune && (!(entity.slowTimer > 0) || entity.slowFactor <= spiritPlan.slow)) {
                                        entity.slowFactor = spiritPlan.slow;
                                        entity.slowTimer = Math.max(entity.slowTimer || 0, getClericEffectDuration(this, 'Spirit Guardians Boost', 1));
                                    }
                                }
                             }
                        }
                    }
                }
            }
        }
    }
}
