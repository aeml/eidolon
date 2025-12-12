import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';

export class Cleric extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.CLERIC);
        this.scaleAnimSpeed = false;
        this.meshType = 'Cleric';

        this.abilityName = "Spirit Guardians";
        this.abilityDescription = "Summon spirits that orbit you and damage nearby enemies.";
        this.abilityManaCost = 40;
        this.abilityMaxCooldown = 10.0;
        
        this.spiritsActive = false;
        this.spiritDuration = 0;
        this.spirits = []; // Array of meshes
    }

    useAbility(targetVector, gameEngine, skillNameOverride = null) {
        if (!super.useAbility(targetVector, gameEngine, skillNameOverride)) return;

        const skill = skillNameOverride || this.abilityName;

        if (skill === "Healing Light") {
            if (!this.unlockedSkills.includes("Healing Light")) return;
            console.log("Cleric used Healing Light!");
            this.playAnimation('Attack', false, true);
            
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
            this.playAnimation('Attack', false, true);
            
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
            this.playAnimation('Attack', false, true);
            
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
            this.playAnimation('Attack', false, true);
            
            // Cooldown 60s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Divine Intervention"] = 60.0 * (1 - cdr);

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
            gameEngine.floatingTextManager.spawn("DIVINE PROTECTION", target.position, '#ffd700');
            this.spawnVisualEffect(gameEngine, target.position, 0xffd700, "pillar");
            return;
        }

        // --- Branch B: Battle Cleric ---

        if (skill === "Radiant Strike") {
            console.log("Cleric used Radiant Strike!");
            this.playAnimation('Attack', false, true);
            
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
            this.playAnimation('Attack', false, true);
            
            // Cooldown 12s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Consecrated Ground"] = 12.0 * (1 - cdr);

            // Create Zone
            this.consecratedZone = {
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
            this.playAnimation('Attack', false, true);
            
            // Cooldown 20s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Spirit Guardians Boost"] = 20.0 * (1 - cdr);

            this.spiritsActive = true;
            this.spiritDuration = 10.0; 
            this.spiritBoosted = true; // Enable boost
            this.createSpirits();
            
            gameEngine.floatingTextManager.spawn("SPIRIT BOOST!", this.position, '#ffff00');
            return;
        }

        if (skill === "Avenging Seraph") {
            console.log("Cleric used Avenging Seraph!");
            this.playAnimation('Attack', false, true);
            
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
            this.playAnimation('Attack', false, true);
            
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
            this.playAnimation('Attack', false, true);
            
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
                            entity.zealTimer = 8.0;
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
            this.playAnimation('Attack', false, true);
            
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
            this.playAnimation('Attack', false, true);
            
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

        // Default: Guardian Spirits
        if (skill === "Guardian Spirits" || skill === this.abilityName) {
            console.log("Cleric used Guardian Spirits!");
            this.playAnimation('Attack', false, true); 
            
            this.spiritsActive = true;
            this.spiritDuration = 8.0; 
            this.spiritBoosted = false; // Normal mode
            this.createSpirits();
            return;
        }
    }

    spawnVisualEffect(gameEngine, position, color, type) {
        if (!gameEngine || !gameEngine.scene) return;
        
        if (type === "pillar") {
            const geometry = new THREE.CylinderGeometry(0.5, 0.5, 4, 8);
            const material = new THREE.MeshBasicMaterial({ 
                color: color, 
                transparent: true, 
                opacity: 0.5,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            mesh.position.y = 2;
            gameEngine.scene.add(mesh);
            
            const startTime = Date.now();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                if (elapsed > 1000) {
                    gameEngine.scene.remove(mesh);
                    geometry.dispose();
                    material.dispose();
                    return;
                }
                material.opacity = 0.5 * (1 - (elapsed / 1000));
                mesh.scale.setScalar(1 + (elapsed / 1000));
                requestAnimationFrame(animate);
            };
            animate();
        } else if (type === "ring") {
            const geometry = new THREE.RingGeometry(0.5, 8.0, 32);
            const material = new THREE.MeshBasicMaterial({ 
                color: color, 
                transparent: true, 
                opacity: 0.5,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.copy(position);
            mesh.position.y = 0.1;
            gameEngine.scene.add(mesh);

            const startTime = Date.now();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                if (elapsed > 500) {
                    gameEngine.scene.remove(mesh);
                    geometry.dispose();
                    material.dispose();
                    return;
                }
                const t = elapsed / 500;
                mesh.scale.setScalar(t);
                material.opacity = 0.5 * (1 - t);
                requestAnimationFrame(animate);
            };
            animate();
        } else if (type === "ground_circle") {
            const geometry = new THREE.CircleGeometry(5.0, 32);
            const material = new THREE.MeshBasicMaterial({ 
                color: color, 
                transparent: true, 
                opacity: 0.3,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.copy(position);
            mesh.position.y = 0.05;
            gameEngine.scene.add(mesh);

            // Persist for 8s (matches duration)
            setTimeout(() => {
                gameEngine.scene.remove(mesh);
                geometry.dispose();
                material.dispose();
            }, 8000);
        } else if (type === "burst") {
            // Simple flash
            const geometry = new THREE.SphereGeometry(1.0, 8, 8);
            const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            gameEngine.scene.add(mesh);
            
            setTimeout(() => {
                gameEngine.scene.remove(mesh);
                geometry.dispose();
                material.dispose();
            }, 200);
        } else if (type === "buff") {
            const geometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
            const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.5 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            mesh.position.y += 1.0;
            gameEngine.scene.add(mesh);
            
            const animate = () => {
                if (mesh.material.opacity <= 0) {
                    gameEngine.scene.remove(mesh);
                    geometry.dispose();
                    material.dispose();
                    return;
                }
                mesh.position.y += 0.1;
                mesh.material.opacity -= 0.02;
                requestAnimationFrame(animate);
            };
            animate();
        }
    }

    createSpirits() {
        if (this.mesh && this.spirits.length === 0) {
            for (let i = 0; i < 3; i++) {
                const geo = new THREE.SphereGeometry(0.3, 8, 8);
                const mat = new THREE.MeshStandardMaterial({ 
                    color: 0xffff00, 
                    emissive: 0xffd700,
                    emissiveIntensity: 1
                });
                const spirit = new THREE.Mesh(geo, mat);
                this.mesh.add(spirit); // Attach to player
                this.spirits.push({ mesh: spirit, angle: (i / 3) * Math.PI * 2 });
            }
        } else if (!this.mesh) {
            // Retry later if mesh not ready
            setTimeout(() => {
                if (this.spiritsActive) this.createSpirits();
            }, 100);
        }
    }

    onMeshReady(mesh) {
        if (this.spiritsActive) {
            this.createSpirits();
        }
    }

    cancelAbilities() {
        this.spiritsActive = false;
        this.spirits.forEach(s => {
            if (this.mesh) this.mesh.remove(s.mesh);
        });
        this.spirits = [];
        this.guardianEmbraceActive = false;
        this.guardianEmbraceTimer = 0;
        this.seraphActive = false;
        if (this.seraphMesh && this.mesh) {
            this.mesh.remove(this.seraphMesh);
            this.seraphMesh = null;
        }
    }

    update(dt, collisionManager, player, activeEntities, floatingTextManager) {
        super.update(dt, collisionManager, player, activeEntities, floatingTextManager);

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
                    
                    const entities = (this.gameEngine && this.gameEngine.chunkManager) ? this.gameEngine.chunkManager.getActiveEntities() : (activeEntities || []);
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
                if (this.seraphMesh && this.mesh) {
                    this.mesh.remove(this.seraphMesh);
                    this.seraphMesh = null;
                }
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
                    const radius = 6.0;
                    const healAmount = 10 + (this.stats.wisdom * 0.5);
                    
                    // Find allies in range
                    const entities = (this.gameEngine && this.gameEngine.chunkManager) ? this.gameEngine.chunkManager.getActiveEntities() : (activeEntities || []);
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
            // Rotate spirits
            const radius = this.spiritBoosted ? 5.0 : 3.0; // Boosted radius
            const speed = 3.0;
            
            this.spirits.forEach(s => {
                s.angle += speed * dt;
                s.mesh.position.set(
                    Math.cos(s.angle) * radius,
                    1.0 + Math.sin(s.angle * 2) * 0.2, // Bob up and down
                    Math.sin(s.angle) * radius
                );
            });

            // Damage Logic (Area check)
            if (activeEntities) {
                this.spiritDamageTimer = (this.spiritDamageTimer || 0) + dt;
                if (this.spiritDamageTimer > 0.5) {
                    this.spiritDamageTimer = 0;
                    
                    const damageRadius = this.spiritBoosted ? 5.5 : 3.5;
                    let damage = 10 + (this.stats.wisdom * 1.0);
                    if (this.spiritBoosted) damage *= 1.5;

                    for (const entity of activeEntities) {
                        if (entity === this || entity.state === 'DEAD' || !entity.isActive) continue;
                        if (entity.constructor.name === 'LootDrop') continue;
                        if (entity.constructor.name === 'DwarfSalesman') continue;
                        
                        const d = this.position.distanceTo(entity.position);
                        if (d < damageRadius) {
                             // if (!this.isMultiplayer && !this.isRemote) {
                             //    entity.takeDamage(damage);
                             // }
                             
                             // if (floatingTextManager && !this.isMultiplayer) {
                             //     floatingTextManager.spawn(Math.floor(damage), entity.position, '#ffffff');
                             // }
                             
                             if (this.spiritBoosted && entity.slowTimer !== undefined) {
                                 entity.slowTimer = 1.0;
                                 entity.slowFactor = 0.3;
                             }
                        }
                    }
                }
            }
            
            // if (!this.isMultiplayer && !this.isRemote && this.spiritDuration <= 0) {
            //     this.spiritsActive = false;
            //     this.spirits.forEach(s => {
            //         if (s.mesh.parent) s.mesh.parent.remove(s.mesh);
            //     });
            //     this.spirits = [];
            // }
        }
    }
}