import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';
import { disposeSceneMesh, spawnEffectSceneFallback } from './EffectSceneFallback.js';
import { SpiritGuardiansEffect } from './SpiritGuardiansEffect.js';
import { getAbilityAoeRadius } from '../skills/abilityRadii.js';
import { getAbilityHealingAmount } from '../core/AbilityHealing.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { createProceduralProjectileVisual, applyProceduralProjectileScale, updateProceduralProjectileVisual, releaseProceduralProjectileVisual } from '../art/ProceduralProjectileEffects.js';
import { clipDungeonEffectSegment } from '../skills/dungeonEffectGeometry.js';
import {applyOfflineHealingLight,applyOfflineRadiantStrike,resolveOfflineClericHealTarget} from './ClericAreaAbilities.js';

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
        const offline = !this.isMultiplayer && !this.isRemote && !gameEngine?.isMultiplayer;
        if (offline && ['Healing Light','Radiant Strike'].includes(skill) && !this.unlockedSkills.includes(skill)) return;
        const previous = this.lastOfflineClericCast;
        const chained = offline && previous && Date.now()-previous.at >= 0 && Date.now()-previous.at <= 3000;
        this.healingLightMassRevival = Boolean(chained && skill === 'Healing Light' && previous.skill === 'Divine Intervention');
        const holyFury = chained && skill === 'Radiant Strike' && previous.skill === 'Mark of Weakness';
        const healingTarget = offline && skill === 'Healing Light'
            ? (this.healingLightMassRevival ? this : resolveOfflineClericHealTarget(this,targetVector,gameEngine)) : null;
        // Resolve the offline target before the canonical cast presentation, so
        // a fallback heal or Mass Revival is drawn at its actual healing center.
        if (healingTarget) targetVector = healingTarget.position;
        if (!super.useAbility(targetVector, gameEngine, skillNameOverride)) {
            this.healingLightMassRevival = false;
            return;
        }
        this.gameEngine = gameEngine || this.gameEngine;
        if (!offline) return true;
        this.lastOfflineClericCast = {skill,at:Date.now()};

        if (skill === "Healing Light") {
            // Shared economy has already charged mana and the trained 8s CD.
            applyOfflineHealingLight(this,healingTarget,gameEngine);
            this.healingLightMassRevival = false;
            return;
        }

        if (skill === "Guardian Embrace") {
            console.log("Cleric used Guardian Embrace!");
            
            this.guardianEmbraceActive = true;
            this.guardianEmbraceTimer = 10.0;
            this.guardianEmbraceRadius = getAbilityAoeRadius('Cleric', skill, this);
            this.embraceTickTimer = 1; // The server's first eligible update pulses immediately.
            
            gameEngine.floatingTextManager.spawn("Guardian Embrace!", this.position, '#ffff00');
            this.spawnVisualEffect(gameEngine, this.position, 0xffff00, "buff");
            this.syncAttachedStatusEffects(0);
            return;
        }

        if (skill === "Purifying Wave") {
            console.log("Cleric used Purifying Wave!");
            
            // Keep the shared economy's talented cooldown and canonical cast
            // presentation. This remains a cleanse, not an invented healing pulse.
            const radius = getAbilityAoeRadius('Cleric', skill, this);
            const entities = new Set([this, ...gameEngine.chunkManager.getActiveEntities()]);
            for (const entity of entities) {
                if (!(entity instanceof Actor) || !entity.isActive || entity.state === 'DEAD') continue;
                const hostile = typeof gameEngine.isHostileActorTarget === 'function'
                    ? gameEngine.isHostileActorTarget(entity)
                    : !['Fighter', 'Rogue', 'Wizard', 'Cleric', 'AvengingSeraph'].includes(entity.constructor.name);
                if (entity !== this && hostile) continue;
                const distance = Math.hypot(this.position.x - entity.position.x, this.position.z - entity.position.z);
                if (distance > radius + (entity.radius || 0)) continue;
                entity.cleanse();
                gameEngine.floatingTextManager?.spawn('Cleanse!', entity.position, '#ffffff');
            }
            return;
        }

        if (skill === "Divine Intervention") {
            console.log("Cleric used Divine Intervention!");
            
            // Cooldown 120s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Divine Intervention"] = 120.0 * (1 - cdr);

            // Find target
            let target = null;
            let minDst = 1000;
            const entities = gameEngine.chunkManager.getActiveEntities();
            entities.forEach(entity => {
                if (entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const d = entity.position.distanceTo(targetVector);
                    if (d < 3.0 && d < minDst) {
                        minDst = d;
                        target = entity;
                    }
                }
            });
            if (!target) target = this;

            target.divineInterventionActive = true;
            target.divineInterventionTimer = 10.0;
            gameEngine.floatingTextManager.spawn("DIVINE PROTECTION", target.position, '#ffd700');
            this.spawnVisualEffect(gameEngine, target.position, 0xffd700, "pillar");
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
                duration: this.skillRunes?.[skill] === 'consecratedground_lingering' ? 16 : 8,
                radius, visual, elapsed: 0, tickTimer: 1,
                damage: 20 + this.stats.wisdom
            };
            return;
        }

        if (skill === "Spirit Guardians Boost") {
            console.log("Cleric used Spirit Guardians Boost!");

            this.spiritsActive = true;
            this.spiritDuration = 10.0;
            this.spiritBoosted = true; // Enable boost
            this.spiritRadius = getAbilityAoeRadius('Cleric', skill, this);
            this.spiritRune = this.skillRunes?.['Spirit Guardians'] || '';
            this.spiritDamageTimer = .5;
            this.createSpirits(gameEngine);
            
            gameEngine.floatingTextManager.spawn("SPIRIT BOOST!", this.position, '#ffff00');
            return;
        }

        if (skill === "Avenging Seraph") {
            console.log("Cleric used Avenging Seraph!");
            
            // Cooldown 45s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Avenging Seraph"] = 45.0 * (1 - cdr);

            // Server handles summoning the entity
            
            gameEngine.floatingTextManager.spawn("SERAPH SUMMONED!", this.position, '#ffffff');
            return;
        }

        // --- Branch C: Buff/Debuff Support ---

        if (skill === "Blessing of Resolve" || skill === "Blessing of Zeal") {
            const radius = getAbilityAoeRadius('Cleric', skill, this);
            // Retain shared cooldown/presentation and include self even when
            // the chunk list omits the local actor. Support remains planar.
            for (const entity of new Set([this, ...gameEngine.chunkManager.getActiveEntities()])) {
                if (!(entity instanceof Actor) || !entity.isActive || entity.state === 'DEAD') continue;
                const hostile = entity !== this && (typeof gameEngine.isHostileActorTarget === 'function'
                    ? gameEngine.isHostileActorTarget(entity)
                    : !['Fighter', 'Rogue', 'Wizard', 'Cleric', 'AvengingSeraph'].includes(entity.constructor.name));
                if (hostile || Math.hypot(this.position.x - entity.position.x, this.position.z - entity.position.z) > radius + (entity.radius || 0)) continue;
                if (skill === 'Blessing of Resolve') {
                    entity.blessingResolveTimer = 20;
                    entity.blessingResolveReduction = 0.25;
                    gameEngine.floatingTextManager.spawn('DEFENSE UP!', entity.position, '#0000ff');
                } else {
                    entity.blessingZealTimer = 8;
                    entity.blessingZealFactor = 0.35;
                    gameEngine.floatingTextManager.spawn('ZEAL!', entity.position, '#ff0000');
                }
                entity.syncAttachedStatusEffects(0);
            }
            return;
        }



        if (skill === "Mark of Weakness") {
            console.log("Cleric used Mark of Weakness!");
            
            // Cooldown 15s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Mark of Weakness"] = 15.0 * (1 - cdr);

            // Target closest enemy to cursor
            let target = null;
            let minDst = 1000;
            const entities = gameEngine.chunkManager.getActiveEntities();
            
            entities.forEach(entity => {
                if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const d = entity.position.distanceTo(targetVector);
                    if (d < 3.0 && d < minDst) {
                        minDst = d;
                        target = entity;
                    }
                }
            });

            if (target) {
                target.markWeaknessTimer = 10.0;
                target.markWeaknessFactor = 0.20; // 20% more damage taken
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
                            applyOfflineAbilityHit(this, entity, this.stats.wisdom * 3, skill, gameEngine.floatingTextManager, '#ffff00');
                            // Stun
                            if (entity.stunTimer !== undefined && !entity.ccImmune) {
                                entity.stunTimer = 3.0;
                            }
                            // Debuff
                            entity.markWeaknessTimer = 5.0;
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
            this.spiritDuration = 8.0;
            this.spiritBoosted = false; // Normal mode
            this.spiritRadius = getAbilityAoeRadius('Cleric', 'Spirit Guardians', this);
            this.spiritRune = this.skillRunes?.['Spirit Guardians'] || '';
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
        this.lastOfflineClericCast = null;
        this.healingLightMassRevival = false;
        this.clearConsecratedZone();
        this.spiritsActive = false;
        this.spiritDuration = 0;
        this.spiritRadius = 0;
        this.spiritRune = '';
        this.spiritBoosted = false;
        this.spiritDamageTimer = 0;
        this.clearSpiritMeshes();
        this.guardianEmbraceActive = false;
        this.guardianEmbraceTimer = 0;
        this.guardianEmbraceRadius = 0;
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
                        if (entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                            if (Math.hypot(entity.position.x - this.consecratedZone.position.x, entity.position.z - this.consecratedZone.position.z) <= radius + (entity.radius || 0)) {
                                const hostile = entity !== this && (typeof this.gameEngine?.isHostileActorTarget === 'function'
                                    ? this.gameEngine.isHostileActorTarget(entity)
                                    : !['Wizard', 'Cleric', 'Fighter', 'Rogue', 'AvengingSeraph'].includes(entity.constructor.name));
                                if (!hostile) {
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

        // Avenging Seraph Logic (Handled by Server Entity now)
        /*
        if (this.seraphActive) {
            this.seraphDuration -= dt;
            if (this.seraphDuration <= 0) {
                this.seraphActive = false;
                this.clearSeraphMesh();
            } else {
                // Seraph Attacks (every 1.5s)
                if (!this.seraphAttackTimer) this.seraphAttackTimer = 0;
                this.seraphAttackTimer += dt;
                
                if (this.seraphAttackTimer >= 1.5) {
                    this.seraphAttackTimer = 0;
                    // Find target
                    const entities = (this.gameEngine && this.gameEngine.chunkManager) ? this.gameEngine.chunkManager.getActiveEntities() : (activeEntities || []);
                    let target = null;
                    let minDst = 15.0; // Range
                    
                    entities.forEach(entity => {
                        if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                            const d = this.position.distanceTo(entity.position);
                            if (d < minDst) {
                                minDst = d;
                                target = entity;
                            }
                        }
                    });
                    
                    if (target) {
                        const damage = 40 + (this.stats.wisdom * 2.0);
                        target.takeDamage(damage);
                        if (this.gameEngine && this.gameEngine.floatingTextManager) {
                            this.gameEngine.floatingTextManager.spawn(Math.floor(damage), target.position, '#ffffff');
                            this.gameEngine.floatingTextManager.spawn("SMITE!", target.position, '#ffff00');
                        }
                        // Visual Beam
                        this.spawnVisualEffect(this.gameEngine, target.position, 0xffffff, "burst");
                    }
                }
            }
        }
        */

        // Guardian Embrace Logic
        if (this.guardianEmbraceActive) {
            this.guardianEmbraceTimer -= dt;
            if (this.guardianEmbraceTimer <= 0) {
                this.guardianEmbraceActive = false;
                this.guardianEmbraceTimer = 0;
                this.guardianEmbraceRadius = 0;
                this.syncAttachedStatusEffects(0);
            } else if (!this.isMultiplayer && !this.isRemote && !this.gameEngine?.isMultiplayer) {
                // Heal Tick (every 1s)
                this.embraceTickTimer = (this.embraceTickTimer || 0) + dt;
                if (this.embraceTickTimer >= 1.0) {
                    this.embraceTickTimer -= 1.0;
                    const radius = this.guardianEmbraceRadius > 0 ? this.guardianEmbraceRadius : 10;
                    const healAmount = getAbilityHealingAmount(this, 'Guardian Embrace', 20 + this.stats.wisdom * 2);
                    
                    // Find allies in range
                    const entities = (this.gameEngine && this.gameEngine.chunkManager) ? this.gameEngine.chunkManager.getActiveEntities() : (chunkManager ? chunkManager.getActiveEntities() : []);
                    for (const entity of new Set([this, ...entities])) {
                        if (!(entity instanceof Actor) || !entity.isActive || entity.state === 'DEAD') continue;
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
                        if (this.spiritRune === 'spirits_vengeful') damage = Math.floor(damage * 1.5);
                        const rects = this.gameEngine?.currentInstanceId && this.gameEngine.currentInstanceType !== 'overworld'
                            ? this.gameEngine.currentDungeonLayout?.walkRects : null;
                        const textManager = (this.gameEngine && this.gameEngine.floatingTextManager) || floatingTextManager;

                        const entities = chunkManager.getActiveEntities();
                        for (const entity of entities) {
                            if (entity === this || entity.state === 'DEAD' || !entity.isActive) continue;
                            if (entity.constructor.name === 'LootDrop') continue;
                            if (entity.constructor.name === 'DwarfSalesman') continue;
                            if (['Fighter', 'Rogue', 'Wizard', 'Cleric', 'AvengingSeraph'].includes(entity.constructor.name)) continue;
                            if (typeof this.gameEngine?.isHostileActorTarget === 'function' && !this.gameEngine.isHostileActorTarget(entity)) continue;
                            
                            const d = Math.hypot(this.position.x - entity.position.x, this.position.z - entity.position.z);
                            if (d <= damageRadius + (entity.radius || 0) && !clipDungeonEffectSegment(rects, this.position, entity.position).blocked) {
                                if (entity.takeDamage) {
                                    applyOfflineAbilityHit(this, entity, damage, this.spiritBoosted ? 'Spirit Guardians Boost' : 'Spirit Guardians', textManager, '#ffff66');
                                }
                             }
                        }
                    }
                }
            }
        }
    }
}
