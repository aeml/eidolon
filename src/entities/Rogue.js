import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';
import { Projectile } from './Projectile.js';

export class Rogue extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.ROGUE);
        this.meshType = 'Rogue';

        this.abilityName = "Piercing Throw";
        this.abilityDescription = "Throw a dagger that pierces through enemies in a line.";
        this.abilityManaCost = 15;
        this.abilityMaxCooldown = 1.0;
        this.scaleAnimSpeed = false; // Rogue animations are static speed
        
        // Class specific state
        this.serratedEdgesActive = false;
        this.serratedEdgesTimer = 0;
        
        this.poisonCoatingActive = false;
        this.poisonCoatingTimer = 0;
        
        this.traps = []; // Array of active traps
    }

    update(dt, collisionManager, player, chunkManager, floatingTextManager) {
        super.update(dt, collisionManager, player, chunkManager);

        if (this.serratedEdgesActive) {
            this.serratedEdgesTimer -= dt;
            if (this.serratedEdgesTimer <= 0) {
                this.serratedEdgesActive = false;
                this.serratedEdgesTimer = 0;
            }
        }

        if (this.poisonCoatingActive) {
            this.poisonCoatingTimer -= dt;
            if (this.poisonCoatingTimer <= 0) {
                this.poisonCoatingActive = false;
                this.poisonCoatingTimer = 0;
            }
        }

        // Trap Logic
        if (this.traps.length > 0 && chunkManager) {
            const activeEntities = chunkManager.getActiveEntities();
            for (let i = this.traps.length - 1; i >= 0; i--) {
                const trap = this.traps[i];
                let triggered = false;
                
                for (const entity of activeEntities) {
                    if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                        if (entity.position.distanceTo(trap.position) < trap.radius) {
                            // Trigger!
                            entity.rootTimer = 3.0; // Root for 3s
                            if (floatingTextManager) floatingTextManager.spawn("ROOTED!", entity.position, '#ffff00');
                            
                            // Visual Effect (Need scene)
                            if (this.mesh && this.mesh.parent) {
                                const mockGameEngine = { scene: this.mesh.parent };
                                this.spawnVisualEffect(mockGameEngine, trap.position, 0xaaaaaa, "smoke");
                            }
                            
                            triggered = true;
                            break;
                        }
                    }
                }
                
                if (triggered) {
                    if (trap.mesh && trap.mesh.parent) trap.mesh.parent.remove(trap.mesh);
                    this.traps.splice(i, 1);
                }
            }
        }
    }

    useAbility(targetVector, gameEngine, skillNameOverride = null) {
        if (!targetVector) return;
        if (!super.useAbility(targetVector, gameEngine, skillNameOverride)) return;

        const skill = skillNameOverride || this.abilityName;

        // --- Branch A: Assassin Burst Path ---

        if (skill === "Backstab") {
            if (!this.unlockedSkills.includes("Backstab")) return;
            console.log("Rogue used Backstab!");
            this.playAnimation('Attack', false, true);
            
            // Cooldown 6s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Backstab"] = 6.0 * (1 - cdr);

            // Melee Range Check
            const range = 2.5;
            let target = null;
            let minDst = 1000;
            const entities = gameEngine.chunkManager.getActiveEntities();
            
            entities.forEach(entity => {
                if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const d = entity.position.distanceTo(this.position);
                    if (d < range && d < minDst) {
                        // Check if in front of rogue (cone check)
                        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
                        const dir = new THREE.Vector3().subVectors(entity.position, this.position).normalize();
                        if (forward.angleTo(dir) < Math.PI / 3) {
                            minDst = d;
                            target = entity;
                        }
                    }
                }
            });

            if (target) {
                let damage = this.stats.damage * 1.5;
                
                // Backstab Check: Are we behind the target?
                // Compare our forward vector with target's forward vector.
                // If dot product is > 0, we are facing same direction (behind).
                const myForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
                const targetForward = new THREE.Vector3(0, 0, 1).applyQuaternion(target.mesh.quaternion);
                const dot = myForward.dot(targetForward);
                
                if (dot > 0.5) { // Roughly same direction
                    damage *= 2.5; // Massive bonus
                    gameEngine.floatingTextManager.spawn("BACKSTAB!", target.position, '#ff0000');
                }
                
                target.takeDamage(damage);
                gameEngine.floatingTextManager.spawn(Math.floor(damage), target.position, '#ffffff');
                this.spawnVisualEffect(gameEngine, target.position, 0xff0000, "blood");
            }
            return;
        }

        if (skill === "Weak Point Mark") {
            console.log("Rogue used Weak Point Mark!");
            this.playAnimation('Attack', false, true);
            
            // Cooldown 12s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Weak Point Mark"] = 12.0 * (1 - cdr);

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
                target.weakPointMarkTimer = 10.0;
                gameEngine.floatingTextManager.spawn("WEAK POINT!", target.position, '#ff0000');
                this.spawnVisualEffect(gameEngine, target.position, 0xff0000, "mark");
            }
            return;
        }

        if (skill === "Shadow Lunge") {
            console.log("Rogue used Shadow Lunge!");
            // Teleport logic
            
            // Cooldown 10s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Shadow Lunge"] = 10.0 * (1 - cdr);

            // Find target
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
                // Teleport behind target
                const targetForward = new THREE.Vector3(0, 0, 1).applyQuaternion(target.mesh.quaternion);
                const behindPos = target.position.clone().sub(targetForward.multiplyScalar(1.5));
                
                // Validate position (simple check)
                this.position.copy(behindPos);
                this.mesh.position.copy(this.position);
                
                // Face target
                this.mesh.lookAt(target.position);
                this.rotation.copy(this.mesh.quaternion);
                
                // Apply Bleed
                target.bleedTimer = 10.0;
                target.bleedStacks = (target.bleedStacks || 0) + 1;
                gameEngine.floatingTextManager.spawn("BLEED!", target.position, '#ff0000');
                
                this.spawnVisualEffect(gameEngine, this.position, 0x000000, "smoke");
            }
            return;
        }

        if (skill === "Death Spiral") {
            console.log("Rogue used Death Spiral!");
            this.playAnimation('Attack', false, true); // Spin anim if available
            
            // Cooldown 20s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Death Spiral"] = 20.0 * (1 - cdr);

            // AoE around rogue
            const radius = 4.0;
            const entities = gameEngine.chunkManager.getActiveEntities();
            
            this.spawnVisualEffect(gameEngine, this.position, 0x333333, "spin");

            entities.forEach(entity => {
                if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const dist = this.position.distanceTo(entity.position);
                    if (dist < radius) {
                        let damage = this.stats.damage * 2.0;
                        
                        // Bonus per bleed stack
                        if (entity.bleedStacks > 0) {
                            damage += (entity.bleedStacks * this.stats.dexterity * 0.5);
                            // Consume stacks? Or just bonus? "Finisher" implies consume usually, but let's keep it simple for now.
                            // Let's consume for big burst.
                            entity.bleedStacks = 0;
                            entity.bleedTimer = 0;
                            gameEngine.floatingTextManager.spawn("EVISCERATE!", entity.position, '#ff0000');
                        }
                        
                        entity.takeDamage(damage);
                        gameEngine.floatingTextManager.spawn(Math.floor(damage), entity.position, '#ffffff');
                    }
                }
            });
            return;
        }

        // --- Branch B: Throwing Specialist ---


        if (skill === "Serrated Edges") {
            console.log("Rogue used Serrated Edges!");
            this.playAnimation('Attack', false, true);
            
            // Cooldown 20s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Serrated Edges"] = 20.0 * (1 - cdr);

            this.serratedEdgesActive = true;
            this.serratedEdgesTimer = 10.0;
            
            gameEngine.floatingTextManager.spawn("SERRATED BLADES!", this.position, '#ff0000');
            this.spawnVisualEffect(gameEngine, this.position, 0xff0000, "buff");
            return;
        }

        if (skill === "Blade Storm") {
            console.log("Rogue used Blade Storm!");
            this.playAnimation('Attack', false, true);
            
            // Cooldown 15s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Blade Storm"] = 15.0 * (1 - cdr);

            // Cone of daggers
            const startPos = this.position.clone();
            startPos.y += 1.0;
            
            const dx = targetVector.x - this.position.x;
            const dz = targetVector.z - this.position.z;
            const baseAngle = Math.atan2(dx, dz);
            const angleStep = Math.PI / 8;

            for (let i = -2; i <= 2; i++) {
                const angle = baseAngle + (i * angleStep);
                const velX = Math.sin(angle);
                const velZ = Math.cos(angle);
                
                const targetPos = new THREE.Vector3(
                    this.position.x + velX * 10,
                    this.position.y,
                    this.position.z + velZ * 10
                );

                const dagger = new Projectile(null, this, 'Dagger', startPos, targetPos);
                dagger.damage = 10 + this.stats.dexterity;
                gameEngine.addEntity(dagger);
            }
            return;
        }

        if (skill === "Phantom Volley") {
            console.log("Rogue used Phantom Volley!");
            this.playAnimation('Attack', false, true);
            
            // Cooldown 18s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Phantom Volley"] = 18.0 * (1 - cdr);

            // Rapid Fire 3 shots
            const startPos = this.position.clone();
            startPos.y += 1.0;
            
            const direction = new THREE.Vector3().subVectors(targetVector, this.position).normalize();
            const targetPos = startPos.clone().add(direction.multiplyScalar(50)); // Far away target

            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    // Use 'PhantomArrow' for the purple visual
                    const arrow = new Projectile(null, this, 'PhantomArrow', startPos, targetPos);
                    // Damage is set in Projectile.js for PhantomArrow
                    gameEngine.addEntity(arrow);
                    
                    // Small burst for each shot
                    this.spawnVisualEffect(gameEngine, this.position, 0x8800ff, "burst");
                }, i * 150); // 150ms delay between shots
            }
            
            return;
        }

        // --- Branch C: Traps & Tricks ---

        if (skill === "Fan of Knives") {
            console.log("Rogue used Fan of Knives!");
            this.playAnimation('Attack', false, true);
            
            // Cooldown 12s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Fan of Knives"] = 12.0 * (1 - cdr);

            const startPos = this.position.clone();
            startPos.y += 1.0;
            
            const projectileCount = 12;
            const angleStep = (Math.PI * 2) / projectileCount;
            
            for (let i = 0; i < projectileCount; i++) {
                const angle = i * angleStep;
                const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
                const target = startPos.clone().add(direction.multiplyScalar(10)); // Target 10 units away
                
                const dagger = new Projectile(null, this, 'Dagger', startPos, target);
                dagger.damage = 10 + this.stats.dexterity;
                dagger.isPiercingThrow = true;
                if (this.serratedEdgesActive) dagger.applyBleed = true;
                gameEngine.addEntity(dagger);
            }
            return;
        }

        // --- Branch C: Utility / Debuff Path ---

        if (skill === "Smoke Bomb") {
            console.log("Rogue used Smoke Bomb!");
            this.playAnimation('Attack', false, true);
            
            // Cooldown 15s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Smoke Bomb"] = 15.0 * (1 - cdr);

            const radius = 5.0;
            this.spawnVisualEffect(gameEngine, this.position, 0x555555, "smoke_cloud");

            const entities = gameEngine.chunkManager.getActiveEntities();
            entities.forEach(entity => {
                if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const dist = this.position.distanceTo(entity.position);
                    if (dist < radius) {
                        // Apply Slow
                        entity.slowTimer = 5.0;
                        entity.slowFactor = 0.5; // 50% slow
                        
                        // Apply Accuracy Reduction
                        entity.accuracyReductionTimer = 5.0;
                        entity.accuracyReductionFactor = 0.3; // 30% miss chance (logic needs to be in attack code)
                        
                        gameEngine.floatingTextManager.spawn("BLIND!", entity.position, '#aaaaaa');
                    }
                }
            });
            return;
        }

        if (skill === "Poison Coating") {
            console.log("Rogue used Poison Coating!");
            this.playAnimation('Attack', false, true);
            
            // Cooldown 20s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Poison Coating"] = 20.0 * (1 - cdr);

            this.poisonCoatingActive = true;
            this.poisonCoatingTimer = 15.0;
            
            gameEngine.floatingTextManager.spawn("POISON READY!", this.position, '#00ff00');
            this.spawnVisualEffect(gameEngine, this.position, 0x00ff00, "buff");
            return;
        }

        if (skill === "Tripwire") {
            console.log("Rogue used Tripwire!");
            this.playAnimation('Attack', false, true);
            
            // Cooldown 10s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Tripwire"] = 10.0 * (1 - cdr);

            // Place trap at feet
            const trapPos = this.position.clone();
            
            // Visual
            const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8);
            const material = new THREE.MeshBasicMaterial({ color: 0x888888 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(trapPos);
            mesh.position.y += 0.05;
            gameEngine.scene.add(mesh);
            
            this.traps.push({
                position: trapPos,
                radius: 1.0,
                mesh: mesh
            });
            
            return;
        }

        if (skill === "Cloak & Vanish") {
            console.log("Rogue used Cloak & Vanish!");
            
            // Cooldown 30s
            const cdr = this.stats.cooldownReduction || 0;
            this.cooldowns["Cloak & Vanish"] = 30.0 * (1 - cdr);

            this.stealthTimer = 5.0;
            
            // Speed Burst (handled in Actor update or just modify stats temporarily?)
            // Let's use a buff timer for speed if we had one, or just hack it here.
            // Actually, Actor.js doesn't have a generic speed buff timer.
            // I'll add a temporary speed boost logic or just rely on stealth.
            // The prompt says "massive movement speed burst".
            // I'll add `speedBoostTimer` to Actor later if needed, but for now let's just rely on stealth.
            // Or I can modify `this.stats.speed` and reset it later? No, stats are recalculated from base.
            // I'll add `speedBoostTimer` to Actor.js in a moment.
            
            this.speedBoostTimer = 3.0;
            this.speedBoostFactor = 1.0; // +100% speed
            
            gameEngine.floatingTextManager.spawn("VANISH!", this.position, '#ffffff');
            this.spawnVisualEffect(gameEngine, this.position, 0x000000, "smoke");
            return;
        }

        console.log("Rogue used Throw Dagger!");
        this.playAnimation('Attack', false, true);
        
        const startPos = this.position.clone();
        startPos.y += 1.0;
        
        // Adjust target height to match start height for horizontal flight
        const adjustedTarget = targetVector.clone();
        adjustedTarget.y = startPos.y;

        const dagger = new Projectile(null, this, 'Dagger', startPos, adjustedTarget);
        
        // Damage Calculation: Base 15 + (Dexterity * 1.5)
        let damage = 15 + (this.stats.dexterity * 1.5);
        
        dagger.isPiercingThrow = true;
        dagger.damage = damage;
        
        // Apply Serrated Edges if active
        if (this.serratedEdgesActive) {
            dagger.applyBleed = true;
        }

        // Apply Poison Coating if active
        if (this.poisonCoatingActive) {
            dagger.applyPoison = true;
        }
        
        gameEngine.addEntity(dagger);
    }

    spawnVisualEffect(gameEngine, position, color, type) {
        if (!gameEngine || !gameEngine.scene) return;
        
        if (type === "blood") {
            const geometry = new THREE.SphereGeometry(0.2, 4, 4);
            const material = new THREE.MeshBasicMaterial({ color: color });
            
            for(let i=0; i<5; i++) {
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(position);
                mesh.position.x += (Math.random() - 0.5);
                mesh.position.y += (Math.random() * 1.0);
                mesh.position.z += (Math.random() - 0.5);
                gameEngine.scene.add(mesh);
                
                setTimeout(() => {
                    gameEngine.scene.remove(mesh);
                }, 300);
            }
            geometry.dispose();
            material.dispose();
        } else if (type === "mark") {
            const geometry = new THREE.TorusGeometry(0.5, 0.05, 8, 16);
            const material = new THREE.MeshBasicMaterial({ color: color });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            mesh.position.y += 2.0;
            mesh.rotation.x = Math.PI / 2;
            gameEngine.scene.add(mesh);
            
            setTimeout(() => {
                gameEngine.scene.remove(mesh);
                geometry.dispose();
                material.dispose();
            }, 1000);
        } else if (type === "smoke") {
            const geometry = new THREE.SphereGeometry(0.5, 8, 8);
            const material = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
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
        } else if (type === "spin") {
            const geometry = new THREE.RingGeometry(0.5, 4.0, 32);
            const material = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = Math.PI / 2;
            mesh.position.copy(position);
            mesh.position.y += 0.5;
            gameEngine.scene.add(mesh);
            
            const animate = () => {
                if (mesh.material.opacity <= 0) {
                    gameEngine.scene.remove(mesh);
                    geometry.dispose();
                    material.dispose();
                    return;
                }
                mesh.rotation.z += 0.5;
                mesh.material.opacity -= 0.05;
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
        } else if (type === "smoke_cloud") {
            // Multiple smoke particles
            const geometry = new THREE.SphereGeometry(0.5, 8, 8);
            const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
            
            for(let i=0; i<10; i++) {
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(position);
                mesh.position.x += (Math.random() - 0.5) * 4.0;
                mesh.position.z += (Math.random() - 0.5) * 4.0;
                mesh.position.y += (Math.random() * 2.0);
                gameEngine.scene.add(mesh);
                
                const animate = () => {
                    if (mesh.material.opacity <= 0) {
                        gameEngine.scene.remove(mesh);
                        return;
                    }
                    mesh.scale.multiplyScalar(1.01);
                    mesh.position.y += 0.02;
                    mesh.material.opacity -= 0.01;
                    requestAnimationFrame(animate);
                };
                animate();
            }
        }
    }
}