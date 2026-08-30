import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';
import { disposeSceneMesh, spawnEffectSceneFallback } from './EffectSceneFallback.js';
import { SpiritGuardiansEffect } from './SpiritGuardiansEffect.js';
import { getAbilityAoeRadius } from '../skills/abilityRadii.js';

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
        if (!super.useAbility(targetVector, gameEngine, skillNameOverride)) return;
        this.gameEngine = gameEngine || this.gameEngine;

        const skill = skillNameOverride || this.abilityName;

        if (this.isMultiplayer || gameEngine?.isMultiplayer) return true;

        if (skill === "Healing Light") {
            if (!this.unlockedSkills.includes("Healing Light")) return;
            console.log("Cleric used Healing Light!");
            
            // Cooldown 5s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Healing Light"] = 5.0 * (1 - cdr);

            // Find target (closest ally to cursor)
            let target = null;
            let minDst = 1000;
            const entities = gameEngine.chunkManager.getActiveEntities();
            
            // Check cursor distance
            entities.forEach(entity => {
                if (entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    // Allow self cast if close to self or no one else
                    const d = entity.position.distanceTo(targetVector);
                    if (d < 3.0) {
                        if (d < minDst) {
                            minDst = d;
                            target = entity;
                        }
                    }
                }
            });

            if (!target) target = this; // Self cast fallback

            // Heal Logic
            let healAmount = 30 + (this.stats.wisdom * 2.0);
            const hpPercent = target.stats.hp / target.stats.maxHp;
            if (hpPercent < 0.30) {
                healAmount *= 1.5; // 50% bonus if low HP
                gameEngine.floatingTextManager.spawn("CRIT HEAL!", target.position, '#00ff00');
            }

            target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healAmount);
            gameEngine.floatingTextManager.spawn(`+${Math.floor(healAmount)}`, target.position, '#00ff00');

            // Visual
            this.spawnVisualEffect(gameEngine, target.position, 0x00ff00, "pillar");
            return;
        }

        if (skill === "Guardian Embrace") {
            console.log("Cleric used Guardian Embrace!");
            
            // Cooldown 15s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Guardian Embrace"] = 15.0 * (1 - cdr);

            this.guardianEmbraceActive = true;
            this.guardianEmbraceTimer = 8.0; // 8s duration
            
            gameEngine.floatingTextManager.spawn("Guardian Embrace!", this.position, '#ffff00');
            this.spawnVisualEffect(gameEngine, this.position, 0xffff00, "buff");
            return;
        }

        if (skill === "Purifying Wave") {
            console.log("Cleric used Purifying Wave!");
            
            // Cooldown 12s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Purifying Wave"] = 12.0 * (1 - cdr);

            const radius = 8.0;
            const entities = gameEngine.chunkManager.getActiveEntities();
            
            // Visual Ring
            this.spawnVisualEffect(gameEngine, this.position, 0x00ffff, "ring");

            entities.forEach(entity => {
                if (entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const dist = this.position.distanceTo(entity.position);
                    if (dist < radius) {
                        if (entity.cleanse) {
                            entity.cleanse();
                            gameEngine.floatingTextManager.spawn("Cleanse!", entity.position, '#ffffff');
                        }
                    }
                }
            });
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
            console.log("Cleric used Radiant Strike!");
            
            // Cooldown 4s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Radiant Strike"] = 4.0 * (1 - cdr);

            // Melee Hit + Bonus
            const range = 3.0;
            const entities = gameEngine.chunkManager.getActiveEntities();
            let hit = false;

            entities.forEach(entity => {
                if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const dist = this.position.distanceTo(entity.position);
                    if (dist < range) {
                        // Check angle (front cone)
                        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
                        const dir = new THREE.Vector3().subVectors(entity.position, this.position).normalize();
                        if (forward.angleTo(dir) < Math.PI / 3) { // 60 deg cone
                            const damage = this.stats.damage + (this.stats.wisdom * 1.5);
                            if (entity.takeDamage) {
                                entity.takeDamage(damage);
                                gameEngine.floatingTextManager.spawn(Math.floor(damage), entity.position, '#ffff00');
                                gameEngine.floatingTextManager.spawn("Radiant!", entity.position, '#ffffff');
                                hit = true;
                            }
                        }
                    }
                }
            });
            
            if (hit) {
                this.spawnVisualEffect(gameEngine, this.position.clone().add(new THREE.Vector3(0,1,0)), 0xffff00, "burst");
            }
            return;
        }

        if (skill === "Consecrated Ground") {
            console.log("Cleric used Consecrated Ground!");
            
            // Cooldown 12s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Consecrated Ground"] = 12.0 * (1 - cdr);

            // Create Zone
            this.consecratedZone = gameEngine.isMultiplayer ? null : {
                position: this.position.clone(),
                duration: 8.0,
                radius: 5.0
            };
            
            // Visual
            this.spawnVisualEffect(gameEngine, this.position, 0xffd700, "ground_circle");
            return;
        }

        if (skill === "Spirit Guardians Boost") {
            console.log("Cleric used Spirit Guardians Boost!");
            
            // Cooldown 20s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Spirit Guardians Boost"] = 20.0 * (1 - cdr);

            this.spiritsActive = true;
            this.spiritDuration = 10.0;
            this.spiritBoosted = true; // Enable boost
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

        if (skill === "Blessing of Resolve") {
            console.log("Cleric used Blessing of Resolve!");
            
            // Cooldown 20s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Blessing of Resolve"] = 20.0 * (1 - cdr);

            const radius = 10.0;
            const entities = gameEngine.chunkManager.getActiveEntities();
            
            // Visual
            this.spawnVisualEffect(gameEngine, this.position, 0x0000ff, "ring");

            entities.forEach(entity => {
                if (entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    // Allies only (including self)
                    if (entity === this || entity.constructor.name === 'Fighter' || entity.constructor.name === 'Rogue' || entity.constructor.name === 'Wizard' || entity.constructor.name === 'Cleric') {
                        if (this.position.distanceTo(entity.position) < radius) {
                            entity.blessingResolveTimer = 10.0;
                            entity.blessingResolveReduction = 0.25; // 25% damage reduction
                            gameEngine.floatingTextManager.spawn("DEFENSE UP!", entity.position, '#0000ff');
                        }
                    }
                }
            });
            return;
        }

        if (skill === "Blessing of Zeal") {
            console.log("Cleric used Blessing of Zeal!");
            
            // Cooldown 25s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Blessing of Zeal"] = 25.0 * (1 - cdr);

            const radius = 10.0;
            const entities = gameEngine.chunkManager.getActiveEntities();
            
            // Visual
            this.spawnVisualEffect(gameEngine, this.position, 0xff0000, "ring");

            entities.forEach(entity => {
                if (entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    // Allies only
                    if (entity === this || entity.constructor.name === 'Fighter' || entity.constructor.name === 'Rogue' || entity.constructor.name === 'Wizard' || entity.constructor.name === 'Cleric') {
                        if (this.position.distanceTo(entity.position) < radius) {
                            entity.blessingZealTimer = 8.0;
                            entity.blessingZealFactor = 0.35;
                            // Zeal effect (e.g. attack speed or damage) handled in stats or update
                            gameEngine.floatingTextManager.spawn("ZEAL!", entity.position, '#ff0000');
                        }
                    }
                }
            });
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
            
            // Cooldown 60s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Heaven's Trumpet"] = 60.0 * (1 - cdr);

            const radius = 12.0;
            const entities = gameEngine.chunkManager.getActiveEntities();
            
            // Visual
            this.spawnVisualEffect(gameEngine, this.position, 0xffd700, "ring");
            gameEngine.floatingTextManager.spawn("HEAVEN'S TRUMPET!", this.position, '#ffd700');

            entities.forEach(entity => {
                if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    // Enemies only (simple check: not a player class)
                    const isPlayer = ['Fighter', 'Rogue', 'Wizard', 'Cleric'].includes(entity.constructor.name);
                    if (!isPlayer) {
                        if (this.position.distanceTo(entity.position) < radius) {
                            // Stun
                            if (entity.stunTimer !== undefined) {
                                entity.stunTimer = 3.0;
                            }
                            // Debuff
                            entity.markWeaknessTimer = 5.0;
                            entity.markWeaknessFactor = 0.50; // 50% more damage taken!
                            
                            gameEngine.floatingTextManager.spawn("STUNNED!", entity.position, '#ffffff');
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

        const runeId = this.skillRunes?.['Spirit Guardians'] || null;
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

    cancelAbilities() {
        this.spiritsActive = false;
        this.spiritDuration = 0;
        this.spiritBoosted = false;
        this.spiritDamageTimer = 0;
        this.clearSpiritMeshes();
        this.guardianEmbraceActive = false;
        this.guardianEmbraceTimer = 0;
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
                this.consecratedZone = null;
            } else {
                // Tick every 1s
                if (!this.consecratedZone.tickTimer) this.consecratedZone.tickTimer = 0;
                this.consecratedZone.tickTimer += dt;
                
                if (this.consecratedZone.tickTimer >= 1.0) {
                    this.consecratedZone.tickTimer -= 1.0;
                    const radius = this.consecratedZone.radius;
                    const healAmount = 15 + (this.stats.wisdom * 0.5);
                    const damageAmount = 10 + (this.stats.wisdom * 0.5);
                    
                    const entities = chunkManager ? chunkManager.getActiveEntities() : [];
                    entities.forEach(entity => {
                        if (entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                            if (entity.position.distanceTo(this.consecratedZone.position) < radius) {
                                // Heal Allies (including self)
                                if (entity === this || entity === player) { // Simple ally check
                                    entity.stats.hp = Math.min(entity.stats.maxHp, entity.stats.hp + healAmount);
                                    if (this.gameEngine && this.gameEngine.floatingTextManager) {
                                        this.gameEngine.floatingTextManager.spawn(`+${Math.floor(healAmount)}`, entity.position, '#00ff00');
                                    }
                                } else {
                                    // Damage Enemies
                                    if (entity.takeDamage) {
                                        entity.takeDamage(damageAmount);
                                        if (this.gameEngine && this.gameEngine.floatingTextManager) {
                                            this.gameEngine.floatingTextManager.spawn(Math.floor(damageAmount), entity.position, '#ffff00');
                                        }
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
            } else {
                // Heal Tick (every 1s)
                this.embraceTickTimer = (this.embraceTickTimer || 0) + dt;
                if (this.embraceTickTimer >= 1.0) {
                    this.embraceTickTimer -= 1.0;
                    const radius = getAbilityAoeRadius('Cleric', 'Guardian Embrace', this);
                    const healAmount = 10 + (this.stats.wisdom * 0.5);
                    
                    // Find allies in range
                    const entities = (this.gameEngine && this.gameEngine.chunkManager) ? this.gameEngine.chunkManager.getActiveEntities() : (chunkManager ? chunkManager.getActiveEntities() : []);
                    entities.forEach(entity => {
                        if (entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                            if (this.position.distanceTo(entity.position) < radius) {
                                entity.stats.hp = Math.min(entity.stats.maxHp, entity.stats.hp + healAmount);
                                if (this.gameEngine && this.gameEngine.floatingTextManager) {
                                    this.gameEngine.floatingTextManager.spawn(`+${Math.floor(healAmount)}`, entity.position, '#00ff00');
                                }
                            }
                        }
                    });
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
                this.spiritBoosted = false;
                this.clearSpiritMeshes();
            } else {
                if (!this.spiritEffect?.isActive) this.createSpirits();
                this.spiritEffect?.setVariant?.({
                    boosted: this.spiritBoosted,
                    runeId: this.skillRunes?.['Spirit Guardians'] || null
                });
                this.spiritEffect?.update?.(dt);

                // Offline simulation retains its local damage loop. Multiplayer
                // presentation follows server state and never applies combat.
                if (chunkManager && !this.isMultiplayer && !this.isRemote) {
                    this.spiritDamageTimer = (this.spiritDamageTimer || 0) + dt;
                    if (this.spiritDamageTimer > 0.5) {
                        this.spiritDamageTimer = 0;
                        
                        const damageRadius = getAbilityAoeRadius(
                            'Cleric',
                            this.spiritBoosted ? 'Spirit Guardians Boost' : 'Spirit Guardians',
                            this
                        );
                        let damage = 10 + (this.stats.wisdom * 1.0);
                        if (this.spiritBoosted) damage *= 1.5;
                        const textManager = (this.gameEngine && this.gameEngine.floatingTextManager) || floatingTextManager;

                        const entities = chunkManager.getActiveEntities();
                        for (const entity of entities) {
                            if (entity === this || entity.state === 'DEAD' || !entity.isActive) continue;
                            if (entity.constructor.name === 'LootDrop') continue;
                            if (entity.constructor.name === 'DwarfSalesman') continue;
                            if (['Fighter', 'Rogue', 'Wizard', 'Cleric'].includes(entity.constructor.name)) continue;
                            
                            const d = this.position.distanceTo(entity.position);
                            if (d < damageRadius) {
                                if (entity.takeDamage) {
                                    entity.takeDamage(damage);
                                }
                                if (textManager) {
                                    textManager.spawn(Math.floor(damage), entity.position, '#ffff66');
                                }
                                if (this.spiritBoosted && entity.slowTimer !== undefined) {
                                    entity.slowTimer = 1.0;
                                    entity.slowFactor = 0.3;
                                }
                             }
                        }
                    }
                }
            }
        }
    }
}
