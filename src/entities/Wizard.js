import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';
import { Projectile } from './Projectile.js';
import { AreaOfEffect } from './AreaOfEffect.js';

export class Wizard extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.WIZARD);
        this.scaleAnimSpeed = false;
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
            color: 0xff4500,
            visualType: 'cylinder',
            isHostile: true
        };
        
        const zone = new AreaOfEffect(gameEngine, this, position, config);
        gameEngine.addEntity(zone);
    }

    useAbility(targetVector, gameEngine, skillNameOverride = null) {
        if (!targetVector) return;
        if (!super.useAbility(targetVector, gameEngine, skillNameOverride)) return;

        const skill = skillNameOverride || this.abilityName;

        // Apply Spell Focus Multiplier if active
        let damageMultiplier = 1.0;
        if (this.spellFocusActive) {
            damageMultiplier = this.spellFocusMultiplier;
            this.spellFocusActive = false; // Consume it
            this.spellFocusMultiplier = 1.0;
            gameEngine.floatingTextManager.spawn("FOCUSED!", this.position, '#8800ff');
        }

        // --- Pyromancer Branch Skills ---

        if (skill === "Flame Whip") {
            if (!this.unlockedSkills.includes("Flame Whip")) return;
            console.log("Wizard used Flame Whip!");
            this.playAnimation('Attack', false, true);
            
            // Cooldown 10s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Flame Whip"] = 10.0 * (1 - cdr);
            
            // Cone Logic
            const range = 12.0;
            const angleThreshold = Math.PI / 4; // 45 degrees half-angle
            const forward = new THREE.Vector3().subVectors(targetVector, this.position);
            forward.y = 0;
            forward.normalize();
            
            // Visual
            this.spawnVisualEffect(gameEngine, this.position, 0xff4500, "cone_large", forward); 
            
            const entities = gameEngine.chunkManager.getActiveEntities();
            entities.forEach(entity => {
                if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    // Enemy check
                    const isEnemy = !['Wizard', 'Cleric', 'Fighter', 'Rogue'].includes(entity.constructor.name);
                    if (isEnemy) {
                        const dir = new THREE.Vector3().subVectors(entity.position, this.position);
                        const dist = dir.length();
                        if (dist < range) {
                            dir.normalize();
                            const angle = forward.angleTo(dir);
                            if (angle < angleThreshold) {
                                // Hit!
                                const damage = (20 + (this.stats.intelligence * 1.5)) * damageMultiplier;
                                entity.takeDamage(damage);
                                gameEngine.floatingTextManager.spawn(Math.floor(damage), entity.position, '#ff4500');
                                
                                // Stun 3s
                                if (entity.stunTimer !== undefined) {
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
            this.playAnimation('Attack', false, true);
            
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
            this.playAnimation('Attack', false, true);
            
            // Cooldown 15s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Meteor Drop"] = 15.0 * (1 - cdr);
            
            // Spawn Meteor high above target
            const startPos = targetVector.clone();
            startPos.y += 30.0; // High up
            
            // It's a projectile, but big
            const meteor = new Projectile(null, this, 'Meteor', startPos, targetVector);
            meteor.damage = (50 + (this.stats.intelligence * 3.0)) * damageMultiplier;
            meteor.explosionRadius = 8.0; // Big radius
            meteor.speed = 20.0; // Fast fall
            
            // Synergy: Meteor also leaves burning ground if unlocked
            if (this.skillLevels.pyromancer.burningGround > 0) {
                meteor.leaveBurningGround = true;
            }
            
            gameEngine.addEntity(meteor);
            
            // Ground indicator
            this.spawnVisualEffect(gameEngine, targetVector, 0xff0000, "ring");
            return;
        }

        if (skill === "Inferno Cataclysm") {
            if (!this.unlockedSkills.includes("Inferno Cataclysm")) return;
            console.log("Wizard used Inferno Cataclysm!");
            this.playAnimation('Attack', false, true);
            
            // Cooldown 60s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Inferno Cataclysm"] = 60.0 * (1 - cdr);
            
            // Massive AOE Zone
            const damage = (30 + (this.stats.intelligence * 1.0)) * damageMultiplier;
            const config = {
                radius: 12.0,
                duration: 8.0,
                damage: damage,
                damageInterval: 0.5, // Ticks fast
                color: 0xff2200,
                visualType: 'cylinder',
                isHostile: true
            };
            
            const zone = new AreaOfEffect(gameEngine, this, targetVector, config);
            // Make visual bigger/cooler
            if (zone.mesh) {
                zone.mesh.material.opacity = 0.6;
            }
            gameEngine.addEntity(zone);
            
            // Initial explosion visual
            this.spawnVisualEffect(gameEngine, targetVector, 0xff4500, "ring");
            
            return;
        }

        // --- Single-Target Caster Branch Skills ---

        if (skill === "Scorch Beam") {
            if (!this.unlockedSkills.includes("Scorch Beam")) return;
            console.log("Wizard used Scorch Beam!");
            this.playAnimation('Attack', false, true);
            
            // Cooldown 8s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Scorch Beam"] = 8.0 * (1 - cdr);
            
            // Instant Line Damage
            const range = 15.0;
            const width = 1.0;
            const damage = (25 + (this.stats.intelligence * 2.5)) * damageMultiplier;
            
            const startPos = this.position.clone();
            startPos.y += 1.5;
            
            const dir = new THREE.Vector3().subVectors(targetVector, this.position).normalize();
            const endPos = startPos.clone().add(dir.clone().multiplyScalar(range));
            
            // Visual Beam
            const beamGeo = new THREE.CylinderGeometry(0.2, 0.2, range, 8);
            beamGeo.rotateX(-Math.PI / 2);
            const beamMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 });
            const beamMesh = new THREE.Mesh(beamGeo, beamMat);
            
            // Position beam center
            const midPoint = startPos.clone().add(dir.clone().multiplyScalar(range / 2));
            beamMesh.position.copy(midPoint);
            beamMesh.lookAt(endPos);
            
            if (gameEngine.scene) {
                gameEngine.scene.add(beamMesh);
                // Fade out
                const animateBeam = () => {
                    if (beamMesh.material.opacity <= 0) {
                        gameEngine.scene.remove(beamMesh);
                        beamGeo.dispose();
                        beamMat.dispose();
                        return;
                    }
                    beamMesh.material.opacity -= 0.05;
                    beamMesh.scale.x *= 0.9;
                    beamMesh.scale.z *= 0.9;
                    requestAnimationFrame(animateBeam);
                };
                animateBeam();
            }
            
            // Hit Logic (Raycast-ish)
            const entities = gameEngine.chunkManager.getActiveEntities();
            for (const entity of entities) {
                if (!entity.isActive || entity.state === 'DEAD') continue;
                if (entity === this) continue;
                if (entity.constructor.name === 'LootDrop') continue;
                
                // Simple distance check to line segment
                // Project entity pos onto line
                const v = new THREE.Vector3().subVectors(entity.position, startPos);
                const t = v.dot(dir);
                
                if (t > 0 && t < range) {
                    const closestPoint = startPos.clone().add(dir.clone().multiplyScalar(t));
                    const dist = closestPoint.distanceTo(entity.position);
                    if (dist < width + 1.0) { // +1 for entity radius approx
                         entity.takeDamage(damage);
                         // Armor Melt Debuff (Mockup)
                         if (entity.stats) {
                             entity.stats.defense = Math.max(0, entity.stats.defense - 5);
                             gameEngine.floatingTextManager.spawn("ARMOR MELT", entity.position, '#ffaa00');
                         }
                         gameEngine.floatingTextManager.spawn(Math.floor(damage), entity.position, '#ffaa00');
                    }
                }
            }
            return;
        }

        if (skill === "Arcane Missiles") {
            if (!this.unlockedSkills.includes("Arcane Missiles")) return;
            console.log("Wizard used Arcane Missiles!");
            this.playAnimation('Attack', false, true);
            
            // Cooldown 6s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Arcane Missiles"] = 6.0 * (1 - cdr);
            
            // Find target
            let target = null;
            let minDst = 20.0;
            const entities = gameEngine.chunkManager.getActiveEntities();
            entities.forEach(entity => {
                if (entity.isActive && entity.state !== 'DEAD' && entity !== this && !(entity instanceof Actor && entity.constructor.name === 'LootDrop')) {
                     // Enemy check (simplified)
                     if (entity.constructor.name !== 'Wizard' && entity.constructor.name !== 'Cleric' && entity.constructor.name !== 'Fighter' && entity.constructor.name !== 'Rogue') {
                         const d = entity.position.distanceTo(targetVector);
                         if (d < minDst) {
                             minDst = d;
                             target = entity;
                         }
                     }
                }
            });
            
            // Spawn 3 missiles
            const spawnMissile = (delay, offsetAngle) => {
                setTimeout(() => {
                    const startPos = this.position.clone();
                    startPos.y += 2.0;
                    
                    // Spread start pos slightly
                    startPos.x += Math.sin(offsetAngle) * 0.5;
                    startPos.z += Math.cos(offsetAngle) * 0.5;
                    
                    // Initial direction: Up and out, then home
                    const initialTarget = startPos.clone().add(new THREE.Vector3(Math.sin(offsetAngle), 1, Math.cos(offsetAngle)).multiplyScalar(5));
                    
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
            this.playAnimation('Attack', false, true);
            
            // Cooldown 20s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Spell Focus"] = 20.0 * (1 - cdr);
            
            this.spellFocusActive = true;
            this.spellFocusMultiplier = 2.5; // 150% bonus damage
            
            gameEngine.floatingTextManager.spawn("SPELL FOCUS!", this.position, '#8800ff');
            this.spawnVisualEffect(gameEngine, this.position, 0x8800ff, "buff");
            return;
        }

        if (skill === "Dragonfire Lance") {
            if (!this.unlockedSkills.includes("Dragonfire Lance")) return;
            console.log("Wizard used Dragonfire Lance!");
            this.playAnimation('Attack', false, true);
            
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
            this.playAnimation('Attack', false, true);
            
            // Cooldown 20s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Arcane Shield"] = 20.0 * (1 - cdr);
            
            // Shield Amount: 30% of Max HP + Int scaling
            const shieldAmount = (this.stats.maxHp * 0.30) + (this.stats.intelligence * 5.0);
            this.shieldHP = shieldAmount;
            
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
            this.playAnimation('Attack', false, true);
            
            // Cooldown 25s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Gravity Well"] = 25.0 * (1 - cdr);
            
            const damage = (10 + (this.stats.intelligence * 0.5)) * damageMultiplier;
            
            const config = {
                radius: 6.0,
                duration: 5.0,
                damage: damage,
                damageInterval: 0.5,
                color: 0x440088, // Dark Purple
                visualType: 'ring', // Swirling ring
                isHostile: true,
                onTick: (engine, aoe) => {
                    // Pull Logic
                    const entities = engine.chunkManager.getActiveEntities();
                    for (const entity of entities) {
                        if (!entity.isActive || entity.state === 'DEAD') continue;
                        if (entity === this) continue;
                        if (entity.constructor.name === 'LootDrop') continue;
                        if (entity.constructor.name === 'AreaOfEffect') continue;
                        if (entity.constructor.name === 'Projectile') continue;
                        
                        // Enemy Check
                        let isEnemy = true;
                        if (entity.constructor.name === 'Fighter' || entity.constructor.name === 'Rogue' || entity.constructor.name === 'Cleric' || entity.constructor.name === 'Wizard') {
                            isEnemy = false;
                        }
                        
                        if (isEnemy) {
                            const dist = aoe.position.distanceTo(entity.position);
                            if (dist < aoe.radius + 2.0) { // Pull from slightly outside
                                const pullDir = new THREE.Vector3().subVectors(aoe.position, entity.position).normalize();
                                // Pull force
                                const pullSpeed = 4.0;
                                entity.position.add(pullDir.multiplyScalar(pullSpeed * 0.1)); // 0.1s approx tick? No, tick is 0.5s but this runs every tick.
                                // Actually onTick runs every damageInterval (0.5s). That's too slow for smooth pull.
                                // But AreaOfEffect.update calls onTick only on interval.
                                // We need a per-frame update for smooth pull.
                                // AreaOfEffect doesn't support per-frame callback yet.
                                // Let's just do a big yank every tick.
                                entity.position.add(pullDir.multiplyScalar(1.5)); 
                            }
                        }
                    }
                }
            };
            
            const well = new AreaOfEffect(gameEngine, this, targetVector, config);
            gameEngine.addEntity(well);
            return;
        }

        if (skill === "Time Warp") {
            if (!this.unlockedSkills.includes("Time Warp")) return;
            console.log("Wizard used Time Warp!");
            this.playAnimation('Attack', false, true);
            
            // Cooldown 90s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Time Warp"] = 90.0 * (1 - cdr);
            
            const radius = 15.0;
            const entities = gameEngine.chunkManager.getActiveEntities();
            
            // Visual
            this.spawnVisualEffect(gameEngine, this.position, 0xffd700, "ring"); // Gold
            
            // Apply Buff to Allies
            entities.forEach(entity => {
                if (entity.isActive && entity.state !== 'DEAD') {
                    // Ally Check
                    if (entity === this || entity.constructor.name === 'Fighter' || entity.constructor.name === 'Rogue' || entity.constructor.name === 'Cleric' || entity.constructor.name === 'Wizard') {
                        const d = entity.position.distanceTo(this.position);
                        if (d < radius) {
                            entity.hasteTimer = 10.0; // 10s duration
                            entity.hasteFactor = 0.5; // +50% Speed/Attack Speed
                            gameEngine.floatingTextManager.spawn("TIME WARP!", entity.position, '#ffd700');
                        }
                    }
                }
            });
            return;
        }

        // --- Standard Spells ---

        if (skill === "Teleport") {
            if (!this.unlockedSkills.includes("Teleport")) return;
            console.log("Wizard used Teleport!");
            
            // Visual Effect: Fade out/in or particles
            this.spawnVisualEffect(gameEngine, this.position, 0x00ffff, "burst");
            
            const maxRange = 15.0;
            const dist = this.position.distanceTo(targetVector);
            
            let finalTarget = targetVector.clone();
            if (dist > maxRange) {
                const dir = new THREE.Vector3().subVectors(targetVector, this.position).normalize();
                finalTarget = this.position.clone().add(dir.multiplyScalar(maxRange));
            }
            
            // Clamp to bounds (Client side check, server is authority)
            if (finalTarget.x < -1000) finalTarget.x = -1000;
            if (finalTarget.x > 1000) finalTarget.x = 1000;
            if (finalTarget.z < -2200) finalTarget.z = -2200;
            if (finalTarget.z > 1000) finalTarget.z = 1000;

            this.position.copy(finalTarget);
            if (this.mesh) this.mesh.position.copy(this.position);
            
            // Arrival Effect
            this.spawnVisualEffect(gameEngine, this.position, 0x00ffff, "burst");
            
            return;
        }

        console.log("Wizard used Fireball!");
        this.playAnimation('Attack', false, true);
        
        // Spawn Projectile
        const startPos = this.position.clone();
        startPos.y += 1.5; // Shoot from chest/staff height
        
        // Adjust target height to match start height for horizontal flight
        const adjustedTarget = targetVector.clone();
        adjustedTarget.y = startPos.y;

        const fireball = new Projectile(null, this, 'Fireball', startPos, adjustedTarget);
        
        // Damage Calculation: Base 20 + (Intelligence * 2.0)
        fireball.damage = 20 + (this.stats.intelligence * 2.0);
        
        // Pyromancer Passives (Removed/Replaced)
        // if (this.skillLevels.pyromancer.flameSurge > 0) { ... }
        // if (this.skillLevels.pyromancer.burningGround > 0) { ... }
        
        gameEngine.addEntity(fireball);
    }

    spawnVisualEffect(gameEngine, position, color, type, direction = null) {
        if (!gameEngine || !gameEngine.scene) return;
        
        if (type === "ring") {
            const geometry = new THREE.RingGeometry(0.5, 1.0, 32);
            const material = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = Math.PI / 2;
            mesh.position.copy(position);
            mesh.position.y += 0.1;
            gameEngine.scene.add(mesh);
            
            const animate = () => {
                if (mesh.material.opacity <= 0) {
                    gameEngine.scene.remove(mesh);
                    geometry.dispose();
                    material.dispose();
                    return;
                }
                mesh.scale.multiplyScalar(1.05);
                mesh.material.opacity -= 0.02;
                requestAnimationFrame(animate);
            };
            animate();
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
        } else if (type === "cone") {
            const count = 5;
            const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.5);
            const material = new THREE.MeshBasicMaterial({ color: color });
            
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
            
            for(let i=0; i<count; i++) {
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(position);
                mesh.position.y += 1.0;
                
                // Spread
                const angle = (i - (count/2)) * 0.2;
                const dir = forward.clone().applyAxisAngle(new THREE.Vector3(0,1,0), angle);
                
                mesh.lookAt(position.clone().add(dir));
                gameEngine.scene.add(mesh);
                
                const speed = 10.0;
                const animate = () => {
                    if (!mesh.parent) return; 
                    mesh.position.add(dir.clone().multiplyScalar(speed * 0.016));
                    mesh.scale.multiplyScalar(0.95);
                    if (mesh.scale.x < 0.1) {
                        gameEngine.scene.remove(mesh);
                        return;
                    }
                    requestAnimationFrame(animate);
                };
                animate();
            }
        } else if (type === "cone_large") {
            const count = 30; // More particles
            const geometry = new THREE.BoxGeometry(0.5, 0.5, 1.5); // Bigger particles
            const material = new THREE.MeshBasicMaterial({ color: color });
            
            let forward;
            if (direction) {
                forward = direction.clone().normalize();
            } else {
                forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
            }
            
            for(let i=0; i<count; i++) {
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(position);
                mesh.position.y += 1.0;
                
                // Spread (Cover 90 degrees total)
                const totalArc = Math.PI / 2;
                const step = totalArc / count;
                const angle = (i - (count/2)) * step;
                
                const dir = forward.clone().applyAxisAngle(new THREE.Vector3(0,1,0), angle);
                
                mesh.lookAt(position.clone().add(dir));
                gameEngine.scene.add(mesh);
                
                const speed = 20.0;
                const animate = () => {
                    if (!mesh.parent) return; 
                    mesh.position.add(dir.clone().multiplyScalar(speed * 0.016));
                    mesh.scale.multiplyScalar(0.94);
                    if (mesh.scale.x < 0.1) {
                        gameEngine.scene.remove(mesh);
                        return;
                    }
                    requestAnimationFrame(animate);
                };
                animate();
            }
        } else if (type === "sphere") {
             const geometry = new THREE.SphereGeometry(1, 16, 16);
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
                 mesh.scale.multiplyScalar(1.1);
                 mesh.material.opacity -= 0.05;
                 requestAnimationFrame(animate);
             };
             animate();
        }
    }
}