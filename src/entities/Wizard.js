import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';
import { Projectile } from './Projectile.js';
import { AreaOfEffect } from './AreaOfEffect.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { spawnEffectSceneFallback, spawnSceneFallbackBeam } from './EffectSceneFallback.js';
import { getAbilityAoeRadius } from '../skills/abilityRadii.js';
import { getAbilityRange, getTeleportCastRange, clampWizardGroundTarget, WIZARD_GROUND_ABILITIES } from '../core/AbilityRange.js';
import { clipDungeonEffectSegment, resolveDungeonBeamEndpoint } from '../skills/dungeonEffectGeometry.js';
import { findOfflineAbilityTarget } from '../skills/offlineAbilityTargeting.js';
import { getArcaneShieldTraining } from '../core/ArcaneShieldTraining.js';
import { applyOfflineTimeWarp, getWizardEffectDuration } from './WizardSupportAbilities.js';

// Match the server's next-damage-spell contract. Utility casts neither consume
// nor receive Spell Focus, and failed admission must leave the charge intact.
const WIZARD_DAMAGE_SKILLS = new Set(['Fireball', 'Flame Whip', 'Flame Tornado',
    'Meteor Drop', 'Inferno Cataclysm', 'Scorch Beam', 'Arcane Missiles',
    'Dragonfire Lance', 'Gravity Well', 'Frost Nova']);

export class Wizard extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.WIZARD);
        this.scaleAnimSpeed = true;
        this.meshType = 'Wizard';

        this.abilityName = "Fireball";
        this.abilityDescription = "Launch a fiery orb that explodes on impact.";
        this.abilityManaCost = 30;
        this.abilityMaxCooldown = 2.0;
        
        // Skill Tree: Pyromancer (Branch A)
        this.skillLevels = {
            pyromancer: {
                flameWhip: 1,        // Tier 2: Active Skill - Cone stun
                flameTornado: 1,     // Tier 3: Active Skill - Moving tornado
                meteorDrop: 1,       // Tier 4: Active Skill - Call down a meteor
                infernoCataclysm: 1  // Tier 5: Active Skill - Massive fire storm
            },
            singleTarget: {
                scorchBeam: 1,       // Tier 2: Line nuke, melts armor
                arcaneMissiles: 1,   // Tier 3: Homing projectiles
                spellFocus: 1,       // Tier 4: Channel to boost next spell
                dragonfireLance: 1   // Tier 5: Huge single-target spike
            },
            controlUtility: {
                frostNova: 1,        // Tier 2: AoE freeze/slow
                arcaneShield: 1,     // Tier 3: Absorbs damage
                gravityWell: 1,      // Tier 4: Pulls enemies together
                timeWarp: 1          // Tier 5: Party haste + CDR
            }
        };
        
        // State for Spell Focus
        this.spellFocusActive = false;
        this.spellFocusMultiplier = 1.0;
    }

    spawnBurningGround(position, gameEngine) {
        // Create a burning zone
        const damage = 10 + (this.stats.intelligence * 0.5);
        const config = {
            radius: 3.5,
            duration: 5.0,
            damage: damage,
            damageInterval: 1.0,
            effectType: 'BurningGround',
            isHostile: true
        };
        
        const zone = new AreaOfEffect(gameEngine, this, position, config);
        gameEngine.addEntity(zone);
    }

    useAbility(targetVector, gameEngine, skillNameOverride = null) {
        if (!targetVector) return;
        if (this.isRemote) return;
        const offline = !this.isMultiplayer && !gameEngine?.isMultiplayer && !this.gameEngine?.isMultiplayer;
        const requestedSkill = skillNameOverride || this.abilityName;
        if (requestedSkill !== 'Fireball' && !this.unlockedSkills.includes(requestedSkill)) return;
        if (offline && WIZARD_GROUND_ABILITIES.has(requestedSkill)) {
            const placement = clampWizardGroundTarget(this, requestedSkill, targetVector);
            const rects = gameEngine.currentInstanceId && gameEngine.currentInstanceType !== 'overworld'
                ? gameEngine.currentDungeonLayout?.walkRects : null;
            if (clipDungeonEffectSegment(rects, this.position, placement).blocked) return;
            targetVector = placement;
        }
        this.flameWhipNovaCascade = offline && requestedSkill === 'Flame Whip' &&
            Number.isFinite(this.lastOfflineTeleportAt) && Date.now() - this.lastOfflineTeleportAt <= 3000;
        const implosion = offline && requestedSkill === 'Fireball' &&
            Number.isFinite(this.lastOfflineGravityWellAt) && Date.now() - this.lastOfflineGravityWellAt <= 3000;
        if (!super.useAbility(targetVector, gameEngine, skillNameOverride)) return;

        const skill = skillNameOverride || this.abilityName;

        if (!offline) return true;
        this.lastOfflineTeleportAt = null;
        this.lastOfflineGravityWellAt = null;

        // Apply Spell Focus Multiplier if active
        let damageMultiplier = 1.0;
        if (this.spellFocusActive && this.spellFocusTimer > 0 && WIZARD_DAMAGE_SKILLS.has(skill)) {
            damageMultiplier = this.spellFocusMultiplier;
            this.spellFocusActive = false; // Consume it
            this.spellFocusTimer = 0;
            this.spellFocusMultiplier = 1.0;
            gameEngine.floatingTextManager.spawn("FOCUSED!", this.position, '#8800ff');
        }

        // --- Pyromancer Branch Skills ---

        if (skill === "Flame Whip") {
            if (!this.unlockedSkills.includes("Flame Whip")) return;
            console.log("Wizard used Flame Whip!");
            
            // Cooldown 10s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Flame Whip"] = 10.0 * (1 - cdr);
            
            // Cone Logic
            const range = getAbilityAoeRadius('Wizard', skill, this);
            const angleThreshold = Math.PI / 4; // 45 degrees half-angle
            const walkRects = gameEngine.currentInstanceId && gameEngine.currentInstanceType !== 'overworld'
                ? gameEngine.currentDungeonLayout?.walkRects : null;
            const forward = new THREE.Vector3().subVectors(targetVector, this.position);
            forward.y = 0;
            if (forward.lengthSq() === 0) {
                forward.set(0, 0, 1);
                if (this.mesh?.quaternion) forward.applyQuaternion(this.mesh.quaternion);
                forward.y = 0;
            }
            forward.normalize();
            
            // Visual
            this.spawnVisualEffect(gameEngine, this.position, 0xff4500, "cone_large", forward); 
            
            const entities = gameEngine.chunkManager.getActiveEntities();
            entities.forEach(entity => {
                if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    // Enemy check
                    const isEnemy = typeof gameEngine.isHostileActorTarget === 'function'
                        ? gameEngine.isHostileActorTarget(entity)
                        : !entity.isInvulnerable && !['Wizard', 'Cleric', 'Fighter', 'Rogue', 'AvengingSeraph'].includes(entity.constructor.name);
                    if (isEnemy) {
                        const dir = new THREE.Vector3().subVectors(entity.position, this.position);
                        dir.y = 0;
                        const dist = dir.length();
                        if (dist > 0 && dist <= range + (entity.radius || 0) &&
                            !clipDungeonEffectSegment(walkRects, this.position, entity.position).blocked) {
                            dir.normalize();
                            const angle = forward.angleTo(dir);
                            if (this.flameWhipNovaCascade || angle < angleThreshold) {
                                // Hit!
                                const damage = (20 + (this.stats.intelligence * 1.5)) * damageMultiplier;
                                applyOfflineAbilityHit(this, entity, damage, skill, gameEngine.floatingTextManager, '#ff4500');
                                
                                // Stun 3s
                                if (entity.stunTimer !== undefined && !entity.ccImmune) {
                                    entity.stunTimer = 3.0;
                                    gameEngine.floatingTextManager.spawn("STUNNED!", entity.position, '#ffffff');
                                }
                            }
                        }
                    }
                }
            });
            return;
        }

        if (skill === "Flame Tornado") {
            if (!this.unlockedSkills.includes("Flame Tornado")) return;
            console.log("Wizard used Flame Tornado!");
            
            // Cooldown 12s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Flame Tornado"] = 12.0 * (1 - cdr);
            
            const startPos = this.position.clone();
            startPos.y += 1.0;
            
            // Target direction
            const adjustedTarget = targetVector.clone();
            adjustedTarget.y = startPos.y;
            
            const tornado = new Projectile(null, this, 'FlameTornado', startPos, adjustedTarget);
            // Damage is set in Projectile.js but we can override or apply multiplier
            tornado.damage *= damageMultiplier;
            
            gameEngine.addEntity(tornado);
            return;
        }

        if (skill === "Meteor Drop") {
            if (!this.unlockedSkills.includes("Meteor Drop")) return;
            console.log("Wizard used Meteor Drop!");

            const meteorRuneId = this.skillRunes?.["Meteor Drop"] || null;
            // The authoritative Meteor hit helper uses the same 1.65x footprint
            // as its telegraph. Snapshot that resolved radius for each impact.
            const meteorRadius = getAbilityAoeRadius('Wizard', skill, this);
            const isClusterMeteor = meteorRuneId === 'meteor_cluster';
            
            // Cooldown 15s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Meteor Drop"] = 15.0 * (1 - cdr);

            const spawnMeteorTelegraph = (impactPos, radius) => {
                if (gameEngine.isMultiplayer) {
                    return;
                }
                if (typeof gameEngine.spawnTransientEffect === 'function') {
                    gameEngine.spawnTransientEffect('telegraph', impactPos, 0xff2200, {
                        radius,
                        telegraphDuration: 1.5
                    });
                } else {
                    this.spawnVisualEffect(gameEngine, impactPos, 0xff0000, "ring");
                }
            };

            const spawnMeteor = (impactPos, radius, damage, index = 0) => {
                const startPos = impactPos.clone();
                startPos.y += 30.0 + index * 4;

                const meteor = new Projectile(null, this, 'Meteor', startPos, impactPos);
                meteor.damage = damage;
                meteor.explosionRadius = radius;
                meteor.speed = 20.0;
                meteor.velocity.set(0, -20, 0);
                meteor.groundImpactPosition = impactPos.clone();
                gameEngine.addEntity(meteor);
                spawnMeteorTelegraph(impactPos, radius);
            };

            const baseDamage = (50 + (this.stats.intelligence * 3.0)) * damageMultiplier;
            if (isClusterMeteor) {
                const clusterRadius = meteorRadius;
                const clusterDamage = baseDamage * (2 / 3);
                const offsets = [
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(-3, 0, -2),
                    new THREE.Vector3(3, 0, -2)
                ];

                offsets.forEach((offset, index) => {
                    const impactPos = targetVector.clone().add(offset);
                    const rects = gameEngine.currentInstanceId && gameEngine.currentInstanceType !== 'overworld'
                        ? gameEngine.currentDungeonLayout?.walkRects : null;
                    const clipped = clipDungeonEffectSegment(rects, targetVector, impactPos);
                    impactPos.x = clipped.x;
                    impactPos.z = clipped.z;
                    spawnMeteor(impactPos, clusterRadius, clusterDamage, index);
                });
            } else {
                spawnMeteor(targetVector.clone(), meteorRadius, baseDamage);
            }
            return;
        }

        if (skill === "Inferno Cataclysm") {
            if (!this.unlockedSkills.includes("Inferno Cataclysm")) return;
            console.log("Wizard used Inferno Cataclysm!");
            
            // Cooldown 60s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Inferno Cataclysm"] = 60.0 * (1 - cdr);
            
            // Massive AOE Zone
            const damage = (30 + (this.stats.intelligence * 1.0)) * damageMultiplier;
            const config = {
                radius: getAbilityAoeRadius('Wizard', 'Inferno Cataclysm', this) || 12,
                duration: 8.0,
                damage: damage,
                damageInterval: 1.0, // Ordinary server cadence; combo timing is separate.
                effectType: 'InfernoCataclysm',
                isHostile: true
            };

            const zone = gameEngine.isMultiplayer ? null : new AreaOfEffect(gameEngine, this, targetVector, config);
            if (zone) gameEngine.addEntity(zone);
            
            // Initial explosion visual
            this.spawnVisualEffect(gameEngine, targetVector, 0xff4500, "ring");
            
            return;
        }

        // --- Single-Target Caster Branch Skills ---

        if (skill === "Scorch Beam") {
            if (!this.unlockedSkills.includes("Scorch Beam")) return;
            console.log("Wizard used Scorch Beam!");
            
            // Cooldown 8s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Scorch Beam"] = 8.0 * (1 - cdr);
            
            // Instant Line Damage
            const authoredRange = getAbilityRange(this, skill, CONSTANTS.ABILITY_CONFIG.Wizard.skills[skill].range);
            const walkRects = gameEngine.currentInstanceId && gameEngine.currentInstanceType !== 'overworld'
                ? gameEngine.currentDungeonLayout?.walkRects : null;
            const endpoint = resolveDungeonBeamEndpoint(walkRects, this.position, targetVector, authoredRange);
            const range = Math.hypot(endpoint.x - this.position.x, endpoint.z - this.position.z);
            const width = 1.0;
            const damage = (25 + (this.stats.intelligence * 2.5)) * damageMultiplier;
            
            const startPos = this.position.clone();
            startPos.y += 1.5;
            
            const dir = new THREE.Vector3(targetVector.x - this.position.x, 0, targetVector.z - this.position.z).normalize();
            const endPos = startPos.clone().add(dir.clone().multiplyScalar(range));
            
            const midPoint = startPos.clone().add(dir.clone().multiplyScalar(range / 2));
            if (this.shouldSuppressLegacyCastVisual()) {
                // The canonical presentation already emitted the beam.
            } else if (typeof gameEngine?.spawnTransientEffect === 'function') {
                gameEngine.spawnTransientEffect('beam', endPos, 0xffaa00, { source: this });
            } else {
                const effectScene = gameEngine?.effectScene || gameEngine?.scene;
                if (effectScene) {
                    spawnSceneFallbackBeam(effectScene, startPos, endPos, 0xffaa00, {
                        radius: 0.2,
                        segments: 8,
                        opacity: 0.8,
                        fadeStep: 0.05,
                        scaleXStep: 0.9,
                        scaleZStep: 0.9
                    });
                }
            }
            
            // Hit Logic (Raycast-ish)
            const entities = gameEngine.chunkManager.getActiveEntities();
            for (const entity of entities) {
                if (!entity.isActive || entity.state === 'DEAD') continue;
                if (entity === this) continue;
                if (!(entity instanceof Actor) || typeof entity.takeDamage !== 'function') continue;
                
                // Simple distance check to line segment
                // Project entity pos onto line
                const v = new THREE.Vector3().subVectors(entity.position, startPos);
                const t = v.dot(dir);
                
                const targetRadius = entity.radius || 1.0;
                if (t > 0 && t < range + targetRadius) {
                    const closestPoint = startPos.clone().add(dir.clone().multiplyScalar(t));
                    const dist = Math.hypot(closestPoint.x - entity.position.x, closestPoint.z - entity.position.z);
                    if (dist < width + targetRadius && !clipDungeonEffectSegment(walkRects, this.position, entity.position).blocked) {
                         applyOfflineAbilityHit(this, entity, damage, skill, gameEngine.floatingTextManager, '#ffaa00');
                         // Armor Melt Debuff (Mockup)
                         if (entity.stats) {
                             entity.stats.defense = Math.max(0, entity.stats.defense - 5);
                             gameEngine.floatingTextManager.spawn("ARMOR MELT", entity.position, '#ffaa00');
                         }
                    }
                }
            }
            return;
        }

        if (skill === "Arcane Missiles") {
            if (!this.unlockedSkills.includes("Arcane Missiles")) return;
            console.log("Wizard used Arcane Missiles!");
            
            // Cooldown 6s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Arcane Missiles"] = 6.0 * (1 - cdr);
            
            const target = findOfflineAbilityTarget(this, gameEngine, targetVector, {
                range: getAbilityRange(this, skill, CONSTANTS.ABILITY_CONFIG.Wizard.skills[skill].range),
                cursorRadius: 4, padCursor: true
            });
            const cursorAngle = Math.atan2(targetVector.z - this.position.z, targetVector.x - this.position.x);
            
            // Spawn 3 missiles
            const spawnMissile = (delay, offsetAngle) => {
                this.scheduleTask(() => {
                    const startPos = this.position.clone();
                    startPos.y += 2.0;
                    
                    // Spread start pos slightly
                    startPos.x += Math.sin(offsetAngle) * 0.5;
                    startPos.z += Math.cos(offsetAngle) * 0.5;
                    
                    // Initial direction: Up and out, then home
                    const launchDirection = target
                        ? new THREE.Vector3(Math.sin(offsetAngle), 1, Math.cos(offsetAngle))
                        : new THREE.Vector3(Math.cos(cursorAngle + offsetAngle * .1), 0, Math.sin(cursorAngle + offsetAngle * .1));
                    const initialTarget = startPos.clone().add(launchDirection.multiplyScalar(5));
                    
                    const missile = new Projectile(null, this, 'ArcaneMissile', startPos, initialTarget);
                    missile.damage = (10 + (this.stats.intelligence * 1.0)) * damageMultiplier;
                    missile.homingTarget = target;
                    missile.homingTurnRate = 8.0; // High turn rate
                    
                    gameEngine.addEntity(missile);
                }, delay);
            };
            
            spawnMissile(0, 0);
            spawnMissile(200, 2.0);
            spawnMissile(400, -2.0);
            
            return;
        }

        if (skill === "Spell Focus") {
            if (!this.unlockedSkills.includes("Spell Focus")) return;
            console.log("Wizard used Spell Focus!");
            
            // Actor admission already applies the canonical45s cooldown and
            // trained economy. Do not overwrite it with the legacy20s value.
            
            this.spellFocusActive = true;
            this.spellFocusTimer = getWizardEffectDuration(this, skill, 15);
            this.spellFocusMultiplier = 2.5; // 150% bonus damage
            
            gameEngine.floatingTextManager.spawn("SPELL FOCUS!", this.position, '#8800ff');
            this.spawnVisualEffect(gameEngine, this.position, 0x8800ff, "buff");
            return;
        }

        if (skill === "Dragonfire Lance") {
            if (!this.unlockedSkills.includes("Dragonfire Lance")) return;
            console.log("Wizard used Dragonfire Lance!");
            
            // Cooldown 12s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Dragonfire Lance"] = 12.0 * (1 - cdr);
            
            const startPos = this.position.clone();
            startPos.y += 1.5;
            
            const adjustedTarget = targetVector.clone();
            adjustedTarget.y = startPos.y;
            
            const lance = new Projectile(null, this, 'DragonfireLance', startPos, adjustedTarget);
            lance.damage = (50 + (this.stats.intelligence * 4.0)) * damageMultiplier;
            
            // Pierce everything
            lance.hitEntities = new Set(); // Reset just in case, though new instance
            // We need to modify Projectile to support piercing or just let it hit once?
            // "Huge single-target spike damage" implies single target usually, but "Lance" might pierce.
            // Let's make it pierce.
            // Projectile.js logic destroys on first hit unless we change it.
            // Let's assume it's single target for now based on description "Single-Target Caster".
            
            gameEngine.addEntity(lance);
            return;
        }

        // --- Control & Utility Branch Skills ---


        if (skill === "Arcane Shield") {
            if (!this.unlockedSkills.includes("Arcane Shield")) return;
            console.log("Wizard used Arcane Shield!");
            
            // Actor committed the canonical paid cooldown. Shield capacity is
            // defensive training, not spell damage or a Spell Focus consumer.
            const training = getArcaneShieldTraining(this);
            const shieldAmount = training.capacity;
            this.shieldHP = shieldAmount;
            this.arcaneShieldActive = true;
            this.arcaneShieldTimer = training.duration;
            
            gameEngine.floatingTextManager.spawn(`SHIELD +${Math.floor(shieldAmount)}`, this.position, '#0088ff');
            
            // Visual Sphere
            this.spawnVisualEffect(gameEngine, this.position, 0x0088ff, "sphere");
            // Make it persist? For now just a burst visual, but maybe attach a mesh?
            // Simplified: Just a burst.
            return;
        }

        if (skill === "Gravity Well") {
            if (!this.unlockedSkills.includes("Gravity Well")) return;
            console.log("Wizard used Gravity Well!");
            
            // Gravity Well is an immediate pull/damage/slow on the server, not
            // the old offline repeated-damage zone. Keep the canonical cast VFX.
            const radius = getAbilityAoeRadius('Wizard', skill, this);
            const rune = this.skillRunes?.[skill];
            const damage = (20 + this.stats.intelligence) * damageMultiplier * (rune === 'gravitywell_crushing' ? 2 : 1);
            const rects = gameEngine.currentInstanceId && gameEngine.currentInstanceType !== 'overworld'
                ? gameEngine.currentDungeonLayout?.walkRects : null;
            for (const entity of gameEngine.chunkManager.getActiveEntities()) {
                if (!(entity instanceof Actor) || entity === this || !entity.isActive || entity.state === 'DEAD') continue;
                const hostile = typeof gameEngine.isHostileActorTarget === 'function' ? gameEngine.isHostileActorTarget(entity)
                    : !entity.isInvulnerable && !['Wizard', 'Cleric', 'Fighter', 'Rogue', 'AvengingSeraph'].includes(entity.constructor.name);
                if (!hostile) continue;
                const distance = Math.hypot(entity.position.x - targetVector.x, entity.position.z - targetVector.z);
                if (distance > radius + (entity.radius || 0) || clipDungeonEffectSegment(rects, targetVector, entity.position).blocked) continue;
                if (!entity.ccImmune) {
                    const strength = rune === 'gravitywell_blackhole' ? .8 : .5;
                    if (distance > .5) {
                        entity.position.x += (targetVector.x - entity.position.x) * strength;
                        entity.position.z += (targetVector.z - entity.position.z) * strength;
                        entity.mesh?.position.copy(entity.position);
                    }
                    if (rune === 'gravitywell_blackhole') entity.rootTimer = 2;
                    entity.slowTimer = 3;
                    entity.slowFactor = .5;
                }
                applyOfflineAbilityHit(this, entity, damage, skill, gameEngine.floatingTextManager, '#9966ff');
            }
            this.lastOfflineGravityWellAt = Date.now();
            return;
        }

        if (skill === "Time Warp") {
            if (!this.unlockedSkills.includes("Time Warp")) return;
            console.log("Wizard used Time Warp!");
            // Actor already paid and committed the trained cooldown before
            // the cast grants CDR. Its presentation owns the area boundary.
            applyOfflineTimeWarp(this, gameEngine);
            return;
        }

        // --- Standard Spells ---

        if (skill === "Teleport") {
            if (!this.unlockedSkills.includes("Teleport")) return;
            console.log("Wizard used Teleport!");
            
            // Visual Effect: Fade out/in or particles
            this.spawnVisualEffect(gameEngine, this.position, 0x00ffff, "burst");
            
            const maxRange = getTeleportCastRange(this);
            const dist = this.position.distanceTo(targetVector);
            
            let finalTarget = targetVector.clone();
            if (dist > maxRange) {
                const dir = new THREE.Vector3().subVectors(targetVector, this.position).normalize();
                finalTarget = this.position.clone().add(dir.multiplyScalar(maxRange));
            }
            
            // Offline prediction uses the same realm envelope; instances use
            // their own walkable geometry, never the old overworld rectangle.
            if (!gameEngine.currentInstanceId) {
                finalTarget.x = Math.max(-3000, Math.min(3000, finalTarget.x));
                finalTarget.z = Math.max(-2200, Math.min(1000, finalTarget.z));
            } else {
                gameEngine.collisionManager?.constrainToDungeonWalkableArea?.(finalTarget, this.radius);
            }

            this.position.copy(finalTarget);
            if (this.mesh) this.mesh.position.copy(this.position);
            this.lastOfflineTeleportAt = Date.now();
            
            // Arrival Effect
            this.spawnVisualEffect(gameEngine, this.position, 0x00ffff, "burst");
            
            return;
        }

        console.log("Wizard used Fireball!");
        
        // Spawn Projectile
        const startPos = this.position.clone();
        startPos.y += 1.5; // Shoot from chest/staff height
        
        // Adjust target height to match start height for horizontal flight
        const adjustedTarget = targetVector.clone();
        adjustedTarget.y = startPos.y;

        const fireball = new Projectile(null, this, 'Fireball', startPos, adjustedTarget);
        fireball.fireballWellBoost = implosion;
        if (implosion) {
            gameEngine.floatingTextManager?.spawn('COMBO: Implosion!', this.position, '#ffd700');
            gameEngine.uiManager?.showComboNotification?.('Implosion', 'implosion');
        }
        
        // Damage Calculation: Base 20 + (Intelligence * 2.0)
        fireball.damage = (20 + (this.stats.intelligence * 2.0)) * damageMultiplier;
        
        // Pyromancer Passives (Removed/Replaced)
        // if (this.skillLevels.pyromancer.flameSurge > 0) { ... }
        // if (this.skillLevels.pyromancer.burningGround > 0) { ... }
        
        gameEngine.addEntity(fireball);
    }

    spawnVisualEffect(gameEngine, position, color, type, direction = null) {
        if (this.shouldSuppressLegacyCastVisual()) return;
        if (!gameEngine || (!gameEngine.effectScene && !gameEngine.scene && typeof gameEngine.spawnTransientEffect !== 'function')) return;
        if (typeof gameEngine.spawnTransientEffect === 'function' && gameEngine.spawnTransientEffect(type, position, color, { source: this, direction })) {
            return;
        }

        spawnEffectSceneFallback(gameEngine, position, color, type);
    }

    cancelAbilities() {
        this.spellFocusActive = false;
        this.spellFocusTimer = 0;
        this.spellFocusMultiplier = 1;
        this.arcaneShieldActive = false;
        this.arcaneShieldTimer = 0;
        this.shieldHP = 0;
    }
}
