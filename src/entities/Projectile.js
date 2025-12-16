import * as THREE from 'three';
import { Entity } from './Entity.js';

// Shared Resources
const FIREBALL_GEO = new THREE.SphereGeometry(0.5, 8, 8);
const FIREBALL_MAT = new THREE.MeshStandardMaterial({ 
    color: 0xff4500, 
    emissive: 0xff0000,
    emissiveIntensity: 2
});

const DAGGER_GEO = new THREE.ConeGeometry(0.2, 1.0, 8);
DAGGER_GEO.rotateX(Math.PI / 2); // Point forward
const DAGGER_MAT = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });

// Shared Resources for other projectiles
const ARCANE_GEO = new THREE.SphereGeometry(0.3, 8, 8);
const ARCANE_MAT = new THREE.MeshStandardMaterial({ color: 0xaa00ff, emissive: 0x8800ff, emissiveIntensity: 2 });

const LANCE_GEO = new THREE.CylinderGeometry(0.2, 0.4, 2.0, 8);
LANCE_GEO.rotateX(-Math.PI / 2);
const LANCE_MAT = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff4400, emissiveIntensity: 3 });

const TORNADO_GEO = new THREE.CylinderGeometry(1.5, 0.5, 4.0, 8, 1, true);
const TORNADO_MAT = new THREE.MeshStandardMaterial({ color: 0xff4500, emissive: 0xff0000, emissiveIntensity: 2, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });

const METEOR_GEO = new THREE.SphereGeometry(1.5, 16, 16);
const METEOR_MAT = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff4500, emissiveIntensity: 1, roughness: 0.9 });

const PHANTOM_MAT = new THREE.MeshStandardMaterial({ color: 0x8800ff, metalness: 0.8, roughness: 0.2, emissive: 0x440088 });

const TRAP_GEO = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 8);
const TRIPWIRE_MAT = new THREE.MeshBasicMaterial({ color: 0x888888 });
const EXPLOSIVE_MAT = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const SNARE_MAT = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

const ZONE_GEO = new THREE.CylinderGeometry(5.0, 5.0, 0.1, 32);
const ZONE_MAT = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.3 });

export class Projectile extends Entity {
    constructor(id, owner, type, startPos, targetPos) {
        super(id);
        this.owner = owner;
        this.type = type; // 'Fireball', 'Dagger'
        if (startPos) {
            this.position.copy(startPos);
        }
        
        // Calculate velocity
        if (targetPos && startPos) {
            const direction = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
            this.speed = type === 'Fireball' ? 20 : 35; // Increased speed
            this.velocity = direction.multiplyScalar(this.speed);
        } else {
            this.velocity = new THREE.Vector3(0, 0, 1);
        }
        
        this.damage = 0;
        this.radius = type === 'Fireball' ? 2.0 : 1.5; // Increased hit radius
        this.lifeTime = 10.0; // Increased lifetime to allow long-range shots
        
        this.hitEntities = new Set(); // Track entities hit by this projectile
        
        // Modifiers
        this.bounces = 0;
        this.applyBleed = false;
        this.homingTarget = null; // Entity to home in on
        this.homingTurnRate = 5.0; // Radians per second

        this.initMesh();
    }

    initMesh() {
        let geometry, material;
        
        if (this.type === 'Fireball') {
            geometry = FIREBALL_GEO;
            material = FIREBALL_MAT;
            this.damage = 20 + (this.owner.stats.intelligence * 2);
        } else if (this.type === 'ArcaneMissile') {
            geometry = ARCANE_GEO;
            material = ARCANE_MAT;
            this.damage = 10 + (this.owner.stats.intelligence * 1.0);
            this.speed = 25;
        } else if (this.type === 'DragonfireLance') {
            geometry = LANCE_GEO;
            material = LANCE_MAT;
            this.damage = 50 + (this.owner.stats.intelligence * 4.0);
            this.speed = 40;
        } else if (this.type === 'Dagger') {
            geometry = DAGGER_GEO;
            material = DAGGER_MAT;
            this.damage = 15 + (this.owner.stats.dexterity * 1.5);
        } else if (this.type === 'FlameTornado') {
            geometry = TORNADO_GEO;
            material = TORNADO_MAT;
            this.damage = 30 + (this.owner.stats.intelligence * 2.0);
            this.speed = 10; 
            this.isPiercingThrow = true;
        } else if (this.type === 'Meteor') {
            geometry = METEOR_GEO;
            material = METEOR_MAT;
            this.damage = 50 + (this.owner.stats.intelligence * 3);
        } else if (this.type === 'PhantomArrow') {
            geometry = DAGGER_GEO;
            material = PHANTOM_MAT;
            this.damage = 25 + (this.owner.stats.dexterity * 2.0);
            this.speed = 35;
        } else if (this.type === 'Tripwire') {
            geometry = TRAP_GEO;
            material = TRIPWIRE_MAT;
            this.damage = 20 + this.owner.stats.dexterity;
            this.speed = 0;
            this.velocity.set(0,0,0);
        } else if (this.type === 'ExplosiveTrap') {
            geometry = TRAP_GEO;
            material = EXPLOSIVE_MAT;
            this.damage = 50 + (this.owner.stats.dexterity * 3);
            this.speed = 0;
            this.velocity.set(0,0,0);
        } else if (this.type === 'SnareTrap') {
            geometry = TRAP_GEO;
            material = SNARE_MAT;
            this.damage = 10;
            this.speed = 0;
            this.velocity.set(0,0,0);
        } else if (this.type === 'Zone') {
            geometry = ZONE_GEO;
            material = ZONE_MAT;
            this.damage = 20 + (this.owner.stats.wisdom * 1);
            this.speed = 0;
            this.velocity.set(0,0,0);
        }

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.userData.entityId = this.id; // Ensure ID is set for raycasting/identification
        
        // Rotate to face direction
        const lookTarget = this.position.clone().add(this.velocity);
        this.mesh.lookAt(lookTarget);
        this.rotation.copy(this.mesh.quaternion);
        
        // Spin effect for Tornado
        if (this.type === 'FlameTornado') {
            this.mesh.rotation.z = Math.random() * Math.PI;
        }
    }

    update(dt, collisionManager, player, chunkManager, floatingTextManager, gameEngine) { 
        if (!this.isActive) return;

        // Meteor Trail
        if (this.type === 'Meteor' && gameEngine && gameEngine.scene) {
             const geometry = new THREE.SphereGeometry(0.5, 4, 4);
             const material = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 });
             const particle = new THREE.Mesh(geometry, material);
             const offset = new THREE.Vector3(
                 (Math.random() - 0.5) * 1.0,
                 (Math.random() - 0.5) * 1.0,
                 (Math.random() - 0.5) * 1.0
             );
             particle.position.copy(this.position).add(offset);
             gameEngine.scene.add(particle);
             
             const animate = () => {
                 if (particle.material.opacity <= 0) {
                     gameEngine.scene.remove(particle);
                     geometry.dispose();
                     material.dispose();
                     return;
                 }
                 particle.scale.multiplyScalar(0.9);
                 particle.material.opacity -= 0.05;
                 requestAnimationFrame(animate);
             };
             animate();
        }

        if (this.type === 'FlameTornado' && this.mesh) {
            this.mesh.rotation.x += 10.0 * dt; // Spin around local axis
        }

        // In multiplayer, position is authoritative from server, but we can interpolate
        // If this is a remote projectile, we might want to just let the server update position
        // However, for smoothness, we can predict movement
        
        this.lifeTime -= dt;
        if (this.lifeTime <= 0) {
            this.isActive = false;
            return;
        }

        // Homing Logic
        if (this.homingTarget && this.homingTarget.isActive && this.homingTarget.state !== 'DEAD') {
            const targetPos = this.homingTarget.position.clone();
            targetPos.y += 1.0; // Aim for center mass
            
            const directionToTarget = new THREE.Vector3().subVectors(targetPos, this.position).normalize();
            const currentDirection = this.velocity.clone().normalize();
            
            // Slerp direction
            const newDirection = currentDirection.lerp(directionToTarget, this.homingTurnRate * dt).normalize();
            this.velocity = newDirection.multiplyScalar(this.speed);
            
            // Update rotation
            const lookTarget = this.position.clone().add(this.velocity);
            if (this.mesh) this.mesh.lookAt(lookTarget);
        }

        // Move
        const moveStep = this.velocity.clone().multiplyScalar(dt);
        this.position.add(moveStep);
        
        if (this.mesh) {
            this.mesh.position.copy(this.position);
        }

        // Collision Detection (Client-side prediction / Singleplayer)
        if (chunkManager) {
            const activeEntities = chunkManager.getActiveEntities();
            const hitRadius = this.radius || 1.0; // Use projectile's radius

            for (const entity of activeEntities) {
                // Skip self, owner, dead entities, and already hit entities (for pierce)
                if (entity === this || entity === this.owner || entity.state === 'DEAD' || !entity.isActive) continue;
                if (this.hitEntities.has(entity.id)) continue;
                
                // Skip friendly fire (Player vs Player handled by server, but locally we ignore)
                // Assuming owner is Player, ignore other Players? Or if owner is Enemy, ignore Enemies?
                // For now, simple check: If owner is Player, ignore Player.
                if (this.owner && this.owner.constructor.name === entity.constructor.name) continue;
                // Also ignore Loot
                if (entity.constructor.name === 'LootDrop') continue;

                const dist = this.position.distanceTo(entity.position);
                if (dist < hitRadius + (entity.radius || 0.5)) {
                    // HIT!
                    
                    if (this.type === 'Dagger' || this.type === 'DragonfireLance' || this.type === 'FlameTornado') {
                        // Pierce Logic: Hit and continue
                        this.hitEntities.add(entity.id);
                        
                        // Bounce Logic (Dagger only)
                        if (this.type === 'Dagger' && this.bounces > 0) {
                            this.bounces--;
                            // Find new target
                            let bestTarget = null;
                            let minDst = 10.0;
                            for (const other of activeEntities) {
                                if (other !== entity && other !== this.owner && other.isActive && other.state !== 'DEAD' && !this.hitEntities.has(other.id)) {
                                    if (other.constructor.name === 'LootDrop') continue;
                                    if (this.owner && this.owner.constructor.name === other.constructor.name) continue;
                                    
                                    const d = entity.position.distanceTo(other.position);
                                    if (d < minDst) {
                                        minDst = d;
                                        bestTarget = other;
                                    }
                                }
                            }
                            
                            if (bestTarget) {
                                const dir = new THREE.Vector3().subVectors(bestTarget.position, this.position).normalize();
                                this.velocity = dir.multiplyScalar(this.speed);
                                this.lifeTime = 2.0; // Reset lifetime for bounce
                                if (this.mesh) {
                                    const lookTarget = this.position.clone().add(this.velocity);
                                    this.mesh.lookAt(lookTarget);
                                    this.rotation.copy(this.mesh.quaternion);
                                }
                            }
                        }

                        // Apply damage if singleplayer
                        if (!this.owner.isMultiplayer && !this.owner.isRemote) {
                            let finalDamage = this.damage;
                            
                            // Weak Point Mark Bonus
                            if (this.isPiercingThrow && entity.weakPointMarkTimer > 0) {
                                finalDamage *= 1.5; // 50% bonus
                                if (floatingTextManager) floatingTextManager.spawn("CRIT!", entity.position, '#ff0000');
                            }
                            
                            // Bleed Application
                            if (this.applyBleed) {
                                entity.bleedTimer = 5.0;
                                entity.bleedStacks = (entity.bleedStacks || 0) + 1;
                                if (floatingTextManager) floatingTextManager.spawn("BLEED!", entity.position, '#ff0000');
                            }

                            // Poison Application
                            if (this.applyPoison) {
                                entity.poisonTimer = 8.0;
                                entity.poisonStacks = (entity.poisonStacks || 0) + 1;
                                entity.healingReductionTimer = 8.0;
                                entity.healingReductionFactor = 0.5; // 50% healing reduction
                                if (floatingTextManager) floatingTextManager.spawn("POISON!", entity.position, '#00ff00');
                            }

                            entity.takeDamage(finalDamage);
                            if (floatingTextManager) {
                                floatingTextManager.spawn(Math.floor(finalDamage), entity.position, '#ffffff');
                            }
                        }

                    } else if (this.type === 'ArcaneMissile') {
                        // Single Hit Logic
                        this.isActive = false;
                        if (this.mesh) this.mesh.visible = false;
                        
                        if (!this.owner.isMultiplayer && !this.owner.isRemote) {
                            entity.takeDamage(this.damage);
                            if (floatingTextManager) {
                                floatingTextManager.spawn(Math.floor(this.damage), entity.position, '#aa00ff');
                            }
                        }
                        
                        // Visual Hit
                        if (gameEngine && gameEngine.scene) {
                             const geometry = new THREE.SphereGeometry(0.5, 8, 8);
                             const material = new THREE.MeshBasicMaterial({ color: 0xaa00ff, transparent: true, opacity: 0.8 });
                             const mesh = new THREE.Mesh(geometry, material);
                             mesh.position.copy(this.position);
                             gameEngine.scene.add(mesh);
                             
                             const animate = () => {
                                 if (mesh.material.opacity <= 0) {
                                     gameEngine.scene.remove(mesh);
                                     geometry.dispose();
                                     material.dispose();
                                     return;
                                 }
                                 mesh.scale.multiplyScalar(1.1);
                                 mesh.material.opacity -= 0.1;
                                 requestAnimationFrame(animate);
                             };
                             animate();
                        }
                        break;

                    } else if (this.type === 'Fireball' || this.type === 'Meteor') {
                        // Explode Logic: Hit, Splash, Destroy
                        this.isActive = false; // Destroy projectile
                        if (this.mesh) this.mesh.visible = false; // Hide immediately to prevent visual piercing
                        
                        // Splash Damage
                        const splashRadius = this.explosionRadius || (this.type === 'Meteor' ? 8.0 : 4.0);
                        // Find all entities in splash radius
                        for (const splashTarget of activeEntities) {
                            if (splashTarget.state === 'DEAD' || !splashTarget.isActive) continue;
                            if (splashTarget.constructor.name === 'LootDrop') continue;
                            if (this.owner && this.owner.constructor.name === splashTarget.constructor.name) continue;

                            const splashDist = this.position.distanceTo(splashTarget.position);
                            if (splashDist < splashRadius) {
                                if (!this.owner.isMultiplayer && !this.owner.isRemote) {
                                    splashTarget.takeDamage(this.damage);
                                    if (floatingTextManager) {
                                        floatingTextManager.spawn(Math.floor(this.damage), splashTarget.position, '#ff4500');
                                    }
                                }
                            }
                        }
                        
                        // Burning Ground Logic
                        if (this.leaveBurningGround && this.owner && this.owner.spawnBurningGround && gameEngine) {
                             this.owner.spawnBurningGround(this.position, gameEngine);
                        }
                        
                        // Visual Explosion
                        if (gameEngine && gameEngine.scene) {
                             const geometry = new THREE.SphereGeometry(splashRadius, 16, 16);
                             const color = this.type === 'Meteor' ? 0xff2200 : 0xff4500;
                             const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.5 });
                             const mesh = new THREE.Mesh(geometry, material);
                             mesh.position.copy(this.position);
                             gameEngine.scene.add(mesh);
                             
                             const animate = () => {
                                 if (mesh.material.opacity <= 0) {
                                     gameEngine.scene.remove(mesh);
                                     geometry.dispose();
                                     material.dispose();
                                     return;
                                 }
                                 mesh.scale.multiplyScalar(1.05);
                                 mesh.material.opacity -= 0.05;
                                 requestAnimationFrame(animate);
                             };
                             animate();
                        }
                        
                        break; // Stop checking other entities since we exploded
                    }
                }
            }
        }
    }
}
