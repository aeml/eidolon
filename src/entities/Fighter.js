import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';
import { spawnEffectSceneFallback } from './EffectSceneFallback.js';

export class Fighter extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.FIGHTER);
        this.scaleAnimSpeed = true;
        this.meshType = 'Fighter';
        
        this.abilityName = "Charge";
        this.abilityDescription = "Dash towards an enemy and deal damage.";
        this.abilityManaCost = 20;
        this.abilityMaxCooldown = 5.0;
        
        this.isCharging = false;
        this.ironFortressTimer = 0;
        this.ironFortressReduction = 0;
        this.chargeTarget = null;
    }

    useAbility(targetVector, gameEngine, skillNameOverride = null) {
        const requestedSkill = skillNameOverride || this.abilityName;
        if (requestedSkill === 'Last Stand Rampage' && this.stats.hp / this.stats.maxHp >= 0.30) {
            gameEngine?.floatingTextManager?.spawn?.('HP too high!', this.position, '#888888');
            return false;
        }
        if (!super.useAbility(targetVector, gameEngine, skillNameOverride)) return;

        this.gameEngine = gameEngine;
        
        const skill = skillNameOverride || this.abilityName;

        if (skill === "Whirlwind") {
            if (!this.unlockedSkills.includes("Whirlwind")) return;
            console.log("Fighter used Whirlwind!");
            this.isWhirlwinding = true;
            this.whirlwindTimer = 0;
            this.whirlwindDuration = 1.0; // Spin for 1 second
            this.state = 'ATTACKING';
            
            // Override Cooldown for Whirlwind (e.g. 10s)
            this.setSkillCooldown("Whirlwind", 10.0);
            
            this.spawnVisualEffect(gameEngine, this.position, 0xaaaaaa, "spin");
            return;
        }

        if (skill === "Shield Slam") {
            if (!this.unlockedSkills.includes("Shield Slam")) return;
            console.log("Fighter used Shield Slam!");
            
            // Override Cooldown for Shield Slam (e.g. 6s)
            this.setSkillCooldown("Shield Slam", 6.0);

            // Cone Logic
            const range = 4.0;
            const angleThreshold = Math.PI / 4; // 45 degrees half-angle (90 total)
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
            
            this.spawnVisualEffect(gameEngine, this.position.clone().add(forward), 0xffff00, "impact");

            const entities = gameEngine.chunkManager.getActiveEntities();
            entities.forEach(entity => {
                if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const dir = new THREE.Vector3().subVectors(entity.position, this.position);
                    const dist = dir.length();
                    if (dist < range) {
                        dir.normalize();
                        const angle = forward.angleTo(dir);
                        if (angle < angleThreshold) {
                            // Hit!
                            const damage = this.stats.strength * 1.5;
                            // Apply Damage
                            if (entity.takeDamage) {
                                entity.takeDamage(damage);
                                gameEngine.floatingTextManager.spawn(Math.floor(damage), entity.position, '#ffff00');
                            }
                            
                            // Apply Stun
                            if (entity.stunTimer !== undefined) {
                                entity.stunTimer = 1.5;
                                console.log(`Stunned ${entity.id} for 1.5s`);
                            }
                        }
                    }
                }
            });
            return;
        }

        if (skill === "Iron Fortress") {
            if (!this.unlockedSkills.includes("Iron Fortress")) return;
            console.log("Fighter used Iron Fortress!");
            
            // Duration 30s
            this.ironFortressTimer = 30.0;
            
            // Formula: 1% per Strength, max 75%
            this.ironFortressReduction = Math.min(0.75, this.stats.strength * 0.01);
            
            console.log(`Iron Fortress active: ${(this.ironFortressReduction * 100).toFixed(1)}% reduction for 30s`);
            
            // Cooldown 60s
            this.setSkillCooldown("Iron Fortress", 60.0);
            
            // Visual Effect
            gameEngine.floatingTextManager.spawn("Iron Fortress!", this.position, '#00ff00');
            this.spawnVisualEffect(gameEngine, this.position, 0x00ff00, "buff");
            return;
        }

        if (skill === "Guardian Roar") {
            if (!this.unlockedSkills.includes("Guardian Roar")) return;
            console.log("Fighter used Guardian Roar!");
            
            // Cooldown 30s
            this.setSkillCooldown("Guardian Roar", 30.0);
            
            const radius = 15.0;
            const entities = gameEngine.chunkManager.getActiveEntities();
            
            // Visual
            gameEngine.floatingTextManager.spawn("ROAR!", this.position, '#ff0000');
            this.spawnVisualEffect(gameEngine, this.position, 0xff0000, "wave");
            
            entities.forEach(entity => {
                if (entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const dist = this.position.distanceTo(entity.position);
                    if (dist < radius) {
                        const type = entity.constructor.name;
                        const isEnemy = ['Skeleton', 'Imp', 'DemonOrc', 'Construct', 'InfernoTitan', 'Siren', 'FrostGuardian'].includes(type);
                        
                        if (!isEnemy) {
                            // Ally: Apply Buff
                            entity.guardianRoarTimer = 10.0;
                            entity.guardianRoarReduction = 0.3; // 30%
                            console.log(`Applied Guardian Roar to ${entity.id}`);
                            gameEngine.floatingTextManager.spawn("Protected", entity.position, '#00ff00');
                        } else {
                            // Enemy: Taunt
                            gameEngine.floatingTextManager.spawn("Taunted!", entity.position, '#ff0000');
                        }
                    }
                }
            });
            return;
        }

        if (skill === "Sweeping Strike") {
            if (!this.unlockedSkills.includes("Sweeping Strike")) return;
            console.log("Fighter used Sweeping Strike!");
            
            // Cooldown 4s
            this.setSkillCooldown("Sweeping Strike", 4.0);

            // Cone Logic (Wider than Shield Slam)
            const range = 5.0;
            const angleThreshold = Math.PI / 2; // 90 degrees half-angle (180 total)
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
            
            this.spawnVisualEffect(gameEngine, this.position, 0xffffff, "cone");

            const entities = gameEngine.chunkManager.getActiveEntities();
            entities.forEach(entity => {
                if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const dir = new THREE.Vector3().subVectors(entity.position, this.position);
                    const dist = dir.length();
                    if (dist < range) {
                        dir.normalize();
                        const angle = forward.angleTo(dir);
                        if (angle < angleThreshold) {
                            // Hit!
                            const damage = this.stats.strength * 1.2;
                            if (entity.takeDamage) {
                                entity.takeDamage(damage);
                                gameEngine.floatingTextManager.spawn(Math.floor(damage), entity.position, '#ffff00');
                                gameEngine.floatingTextManager.spawn("Threat!", entity.position, '#ff0000');
                            }
                        }
                    }
                }
            });
            return;
        }

        if (skill === "Earthshaker") {
            if (!this.unlockedSkills.includes("Earthshaker")) return;
            console.log("Fighter used Earthshaker!");
            
            // Cooldown 12s
            this.setSkillCooldown("Earthshaker", 12.0);

            // AoE Circle
            const radius = 6.0;
            const entities = gameEngine.chunkManager.getActiveEntities();
            
            // Visual
            gameEngine.floatingTextManager.spawn("SMASH!", this.position, '#ff8800');
            this.spawnVisualEffect(gameEngine, this.position, 0xff8800, "wave");

            entities.forEach(entity => {
                if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const dist = this.position.distanceTo(entity.position);
                    if (dist < radius) {
                        // Hit!
                        const damage = this.stats.strength * 2.0;
                        if (entity.takeDamage) {
                            entity.takeDamage(damage);
                            gameEngine.floatingTextManager.spawn(Math.floor(damage), entity.position, '#ffff00');
                        }
                        
                        // Knockdown (Stun)
                        if (entity.stunTimer !== undefined) {
                            entity.stunTimer = 2.0;
                            gameEngine.floatingTextManager.spawn("Knockdown!", entity.position, '#ffffff');
                        }
                    }
                }
            });
            return;
        }

        if (skill === "Unbreakable Grip") {
            console.log("Fighter used Unbreakable Grip!");
            
            // Cooldown 15s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Unbreakable Grip"] = 15.0 * (1 - cdr);

            // Single Target Pull
            // Use targetVector to find closest enemy near cursor
            let target = null;
            let minDst = 1000;
            const entities = gameEngine.chunkManager.getActiveEntities();
            
            // Find closest to cursor
            entities.forEach(entity => {
                if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const d = entity.position.distanceTo(targetVector);
                    if (d < 3.0) { // Cursor tolerance
                        if (d < minDst) {
                            minDst = d;
                            target = entity;
                        }
                    }
                }
            });

            if (target) {
                // Pull Logic
                const pullPos = this.position.clone().add(new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion).multiplyScalar(2.0));
                target.position.copy(pullPos); // Instant pull for now
                gameEngine.floatingTextManager.spawn("Pulled!", target.position, '#ffffff');
                this.spawnVisualEffect(gameEngine, target.position, 0xffffff, "impact");
                
                // Root/Stun briefly
                if (target.stunTimer !== undefined) {
                    target.stunTimer = 1.0;
                }
            } else {
                console.log("No target for Grip");
            }
            return;
        }

        if (skill === "Juggernaut Charge") {
            console.log("Fighter used Juggernaut Charge (Shockwave)!");
            
            // Cooldown 20s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Juggernaut Charge"] = 20.0 * (1 - cdr);

            // AoE Shockwave
            const radius = 10.0;
            const entities = gameEngine.chunkManager.getActiveEntities();
            
            // Visual
            gameEngine.floatingTextManager.spawn("SHOCKWAVE!", this.position, '#00ffff');
            this.spawnVisualEffect(gameEngine, this.position, 0x00ffff, "wave");

            entities.forEach(entity => {
                if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const dist = this.position.distanceTo(entity.position);
                    if (dist < radius) {
                        // Hit!
                        const damage = this.stats.strength * 1.0;
                        if (entity.takeDamage) {
                            entity.takeDamage(damage);
                            gameEngine.floatingTextManager.spawn(Math.floor(damage), entity.position, '#ffff00');
                        }
                        
                        // Heavy Slow
                        if (entity.slowTimer !== undefined) {
                            entity.slowTimer = 5.0;
                            entity.slowFactor = 0.6; // 60% slow
                            gameEngine.floatingTextManager.spawn("Slowed!", entity.position, '#00ffff');
                        }
                    }
                }
            });
            return;
        }

        if (skill === "Berserker Edge") {
            console.log("Fighter used Berserker Edge!");
            // Passive toggle or active buff? Description says "Gain a % damage buff when at >60% HP".
            // Usually passives are always on, but if it's a skill slot, maybe it's an active that enables this state?
            // Or maybe it's a short term buff. Let's make it a self-buff for now that enables the passive check.
            
            // Cooldown 45s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Berserker Edge"] = 45.0 * (1 - cdr);
            
            // Duration 15s
            this.berserkerEdgeTimer = 15.0;
            this.berserkerEdgeActive = true;
            
            gameEngine.floatingTextManager.spawn("Berserker Mode!", this.position, '#ff0000');
            this.spawnVisualEffect(gameEngine, this.position, 0xff0000, "buff");
            return;
        }

        if (skill === "Shattering Charge") {
            console.log("Fighter used Shattering Charge!");
            // This modifies Charge, but instructions said "abilities arent allowed to modify charge only do things on their own".
            // However, the skill name IS "Shattering Charge".
            // If we follow "do things on their own", maybe it's a separate charge ability?
            // Let's implement it as a separate charge that applies armor reduction.
            
            this.isCharging = true;
            this.state = 'ATTACKING';
            this.chargeTarget = targetVector.clone();
            
            // Mark this charge as Shattering
            this.isShatteringCharge = true;
            
            // Face target
            const lookTarget = new THREE.Vector3(targetVector.x, this.position.y, targetVector.z);
            if (this.mesh) {
                this.mesh.lookAt(lookTarget);
                this.rotation.copy(this.mesh.quaternion);
            }
            
            // Cooldown 12s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Shattering Charge"] = 12.0 * (1 - cdr);
            return;
        }

        if (skill === "Executioner Spin") {
            console.log("Fighter used Executioner Spin!");
            this.isWhirlwinding = true;
            this.whirlwindTimer = 0;
            this.whirlwindDuration = 1.5; // Longer spin
            this.state = 'ATTACKING';
            
            // Mark as Executioner
            this.isExecutionerSpin = true;
            
            // Cooldown 15s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Executioner Spin"] = 15.0 * (1 - cdr);
            
            this.spawnVisualEffect(gameEngine, this.position, 0xff0000, "spin");
            return;
        }

        if (skill === "Last Stand Rampage") {
            console.log("Fighter used Last Stand Rampage!");
            
            // Check HP Requirement (< 30%)
            const hpPercent = this.stats.hp / this.stats.maxHp;
            if (hpPercent >= 0.30) {
                gameEngine.floatingTextManager.spawn("HP too high!", this.position, '#888888');
                return false; // Failed to cast
            }
            
            // Cooldown 120s (Ultimate)
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Last Stand Rampage"] = 120.0 * (1 - cdr);
            
            // Duration 10s
            this.lastStandTimer = 10.0;
            this.lastStandDamageBoost = 2.0; // +200% Damage
            
            gameEngine.floatingTextManager.spawn("RAMPAGE!", this.position, '#ff0000');
            this.spawnVisualEffect(gameEngine, this.position, 0xff0000, "buff");
            return;
        }

        // Default: Charge
        console.log("Fighter used Charge!");
        this.isCharging = true;
        this.state = 'ATTACKING'; // Lock movement
        
        // Calculate charge direction
        this.chargeTarget = targetVector.clone();
        
        // Face target
        const lookTarget = new THREE.Vector3(targetVector.x, this.position.y, targetVector.z);
        if (this.mesh) {
            this.mesh.lookAt(lookTarget);
            this.rotation.copy(this.mesh.quaternion);
        }
    }

    cancelAbilities() {
        this.isCharging = false;
        this.isWhirlwinding = false;
        this.isShatteringCharge = false;
        this.isExecutionerSpin = false;
        // Iron Fortress is a buff, usually persists? Or cancel on death?
        // Actor.die() calls cancelAbilities.
        this.ironFortressTimer = 0;
        this.berserkerEdgeTimer = 0;
        this.berserkerEdgeActive = false;
    }

    takeDamage(amount) {
        let finalAmount = amount;
        if (this.ironFortressTimer > 0) {
            finalAmount = amount * (1 - this.ironFortressReduction);
            // console.log(`Iron Fortress reduced damage from ${amount} to ${finalAmount}`);
        }
        super.takeDamage(finalAmount);
    }

    update(dt, collisionManager, player, chunkManager, floatingTextManager) {
        if (this.ironFortressTimer > 0) {
            this.ironFortressTimer -= dt;
            if (this.ironFortressTimer <= 0) {
                this.ironFortressTimer = 0;
                console.log("Iron Fortress expired.");
            }
        }

        if (this.berserkerEdgeTimer > 0) {
            this.berserkerEdgeTimer -= dt;
            if (this.berserkerEdgeTimer <= 0) {
                this.berserkerEdgeTimer = 0;
                this.berserkerEdgeActive = false;
                console.log("Berserker Edge expired.");
            }
        }

        if (this.isWhirlwinding) {
            this.whirlwindTimer += dt;
            
            // Spin Effect
            if (this.mesh) {
                this.mesh.rotation.y += 15.0 * dt; // Fast spin
            }

            // Damage Tick (every 0.2s)
            const radius = 3.0;
            // Use chunkManager to get entities
            const entities = chunkManager ? chunkManager.getActiveEntities() : [];
            
            if (!this.whirlwindDamageTimer) this.whirlwindDamageTimer = 0;
            this.whirlwindDamageTimer += dt;
            
            if (this.whirlwindDamageTimer > 0.2) {
                this.whirlwindDamageTimer = 0;
                entities.forEach(entity => {
                    if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                        const dist = this.position.distanceTo(entity.position);
                        if (dist < radius) {
                            let damage = this.stats.strength * 0.5; // Base tick damage
                            
                            // Executioner Spin Bonus
                            if (this.isExecutionerSpin) {
                                damage *= 1.5;
                            }
                            
                            // Berserker Edge Bonus
                            if (this.berserkerEdgeActive) {
                                const hpPercent = this.stats.hp / this.stats.maxHp;
                                if (hpPercent > 0.60) {
                                    damage *= 1.3; // 30% bonus
                                }
                            }
                            
                            // Last Stand Bonus
                            if (this.lastStandTimer > 0) {
                                damage *= (1 + this.lastStandDamageBoost);
                            }

                            if (entity.takeDamage) {
                                entity.takeDamage(damage);
                                if (this.gameEngine && this.gameEngine.floatingTextManager) {
                                    this.gameEngine.floatingTextManager.spawn(Math.floor(damage), entity.position, '#ff8800');
                                }
                            }
                        }
                    }
                });
            }

            if (this.whirlwindTimer >= this.whirlwindDuration) {
                this.isWhirlwinding = false;
                this.isExecutionerSpin = false;
                this.state = 'IDLE';
                this.playAnimation('Idle');
            }
            
            if (this.mixer) this.mixer.update(dt);
            return;
        }

        if (this.isCharging) {
            // Remote entities are moved by server updates, so we skip local physics simulation
            if (this.isRemote) {
                if (this.mixer) this.mixer.update(dt);
                return;
            }

            // Safety check: If chargeTarget is missing, abort charge
            if (!this.chargeTarget) {
                this.isCharging = false;
                super.update(dt, collisionManager);
                return;
            }

            const speed = 25; // Fast charge speed
            const direction = new THREE.Vector3().subVectors(this.chargeTarget, this.position);
            const dist = direction.length();
            
            if (dist < 1.0) {
                // Impact!
                this.isCharging = false;
                this.state = 'IDLE';
                this.playAnimation('Idle');

                // Charge Damage Logic
                const entities = (this.gameEngine && this.gameEngine.chunkManager) ? this.gameEngine.chunkManager.getActiveEntities() : (activeEntities || []);
                const chargeRadius = 3.0;
                
                entities.forEach(entity => {
                    if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                        const d = this.position.distanceTo(entity.position);
                        if (d < chargeRadius) {
                            let damage = 25 + (this.stats.strength * 1.5);
                            
                            // Berserker Edge Bonus
                            if (this.berserkerEdgeActive) {
                                const hpPercent = this.stats.hp / this.stats.maxHp;
                                if (hpPercent > 0.60) {
                                    damage *= 1.3;
                                }
                            }
                            
                            // Last Stand Bonus
                            if (this.lastStandTimer > 0) {
                                damage *= (1 + this.lastStandDamageBoost);
                            }

                            if (entity.takeDamage) {
                                entity.takeDamage(damage);
                                if (this.gameEngine && this.gameEngine.floatingTextManager) {
                                    this.gameEngine.floatingTextManager.spawn(Math.floor(damage), entity.position, '#ff0000');
                                }
                            }
                            
                            // Shattering Charge Effect
                            if (this.isShatteringCharge) {
                                if (this.gameEngine && this.gameEngine.floatingTextManager) {
                                    this.gameEngine.floatingTextManager.spawn("Armor Break!", entity.position, '#ffffff');
                                }
                                this.spawnVisualEffect(this.gameEngine, entity.position, 0xffffff, "impact");
                                // entity.defense -= 5; // If defense existed
                            }
                        }
                    }
                });
                
                this.isShatteringCharge = false;

            } else {
                direction.normalize();
                let moveDist = speed * dt;
                if (moveDist > dist) moveDist = dist; // Prevent overshoot
                
                this.position.add(direction.multiplyScalar(moveDist));
                
                // Update mesh
                if (this.mesh) this.mesh.position.copy(this.position);
            }
            
            // Skip normal update movement logic
            if (this.mixer) this.mixer.update(dt);
            return;
        }

        super.update(dt, collisionManager);
    }

    spawnVisualEffect(gameEngine, position, color, type) {
        if (this.shouldSuppressLegacyCastVisual()) return;
        if (!gameEngine || (!gameEngine.effectScene && !gameEngine.scene && typeof gameEngine.spawnTransientEffect !== 'function')) return;
        if (typeof gameEngine.spawnTransientEffect === 'function' && gameEngine.spawnTransientEffect(type, position, color, { source: this })) {
            return;
        }

        spawnEffectSceneFallback(gameEngine, position, color, type);
    }
}
