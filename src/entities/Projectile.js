import * as THREE from 'three';
import { Entity } from './Entity.js';
import { spawnSceneFallbackBurst } from './EffectSceneFallback.js';
import {
    PROCEDURAL_PROJECTILE_VISUAL_DEFINITIONS,
    applyProceduralProjectileScale,
    createProceduralProjectileVisual,
    updateProceduralProjectileVisual
} from '../art/ProceduralProjectileEffects.js';
import { getProjectileImpactRadius } from '../skills/abilityRadii.js';
import { Actor } from './Actor.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { applyOfflineStatus } from '../core/OfflineDamageOverTime.js';
import { clipDungeonEffectSegment } from '../skills/dungeonEffectGeometry.js';

// =====================================================
// Particle Pool Manager - Centralized for performance
// Replaces individual requestAnimationFrame loops
// =====================================================
const PARTICLE_GEO = new THREE.SphereGeometry(0.5, 4, 4);

class ParticlePool {
    constructor() {
        this.particles = [];
        this.activeCount = 0;
        this.maxParticles = 100;
        this.isUpdating = false;
        this.lastUpdateTime = 0;
    }
    
    spawn(scene, position, color = 0xffaa00) {
        if (this.activeCount >= this.maxParticles) return; // Limit particles for performance
        
        // Try to reuse an inactive particle
        let particle = null;
        for (let i = 0; i < this.particles.length; i++) {
            if (!this.particles[i].active) {
                particle = this.particles[i];
                break;
            }
        }
        
        // Create new particle if none available in pool
        if (!particle) {
            const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 });
            const mesh = new THREE.Mesh(PARTICLE_GEO, material);
            particle = { mesh, material, active: false, opacity: 0.6, scale: 1.0 };
            this.particles.push(particle);
        }
        
        // Initialize particle
        particle.mesh.position.copy(position);
        particle.mesh.position.x += (Math.random() - 0.5) * 1.0;
        particle.mesh.position.y += (Math.random() - 0.5) * 1.0;
        particle.mesh.position.z += (Math.random() - 0.5) * 1.0;
        particle.mesh.scale.setScalar(1.0);
        particle.material.opacity = 0.6;
        particle.material.color.setHex(color);
        particle.active = true;
        particle.opacity = 0.6;
        particle.scale = 1.0;

        if (particle.mesh.parent && particle.mesh.parent !== scene) {
            particle.mesh.parent.remove(particle.mesh);
        }
        particle.scene = scene;
        
        if (!particle.mesh.parent) {
            scene.add(particle.mesh);
        }
        particle.mesh.visible = true;
        this.activeCount++;
        
        // Start update loop if not already running
        if (!this.isUpdating) {
            this.startUpdateLoop();
        }
    }
    
    startUpdateLoop() {
        this.isUpdating = true;
        this.lastUpdateTime = performance.now();
        
        const update = () => {
            const now = performance.now();
            const dt = (now - this.lastUpdateTime) / 1000;
            this.lastUpdateTime = now;
            
            let hasActive = false;
            
            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];
                if (!p.active) continue;
                
                hasActive = true;
                p.scale *= 0.9;
                p.opacity -= 3.0 * dt; // Fade out over ~0.2 seconds
                
                if (p.opacity <= 0) {
                    p.active = false;
                    p.mesh.visible = false;
                    this.activeCount--;
                } else {
                    p.mesh.scale.setScalar(p.scale);
                    p.material.opacity = p.opacity;
                }
            }
            
            if (hasActive) {
                requestAnimationFrame(update);
            } else {
                this.isUpdating = false;
            }
        };
        
        requestAnimationFrame(update);
    }
    
    dispose() {
        for (const p of this.particles) {
            p.mesh.parent?.remove(p.mesh);
            p.material.dispose();
        }
        this.particles = [];
        this.activeCount = 0;
    }
}

// Global particle pool instance
const particlePool = new ParticlePool();

export function resetProjectileParticlePoolForTests() {
    particlePool.dispose();
    particlePool.particles = [];
    particlePool.activeCount = 0;
    particlePool.isUpdating = false;
    particlePool.lastUpdateTime = 0;
}

function spawnTransientCombatEffect(gameEngine, type, position, color, options = {}) {
    if (typeof gameEngine?.spawnTransientEffect !== 'function') {
        return false;
    }

    return gameEngine.spawnTransientEffect(type, position, color, options);
}

function spawnProjectileImpact(gameEngine, projectile, position, options = {}) {
    const direction = projectile.velocity?.clone?.().setY(0);
    if (direction?.lengthSq?.() > 0) direction.normalize();
    const effectOptions = {
        projectileType: projectile.type,
        source: projectile.owner,
        direction,
        radius: options.radius,
        targetId: options.targetId || '',
        terminal: Boolean(options.terminal)
    };
    projectile.hasResolvedImpact = true;
    if (spawnTransientCombatEffect(gameEngine, 'projectile_impact', position, 0xffffff, effectOptions)) {
        return true;
    }
    const effectScene = gameEngine?.effectScene || gameEngine?.scene;
    return Boolean(spawnSceneFallbackBurst(effectScene, position, 0xffffff, {
        radius: Number.isFinite(options.radius) ? Math.min(options.radius, 4) : 1,
        color: 0xffffff
    }));
}

export class Projectile extends Entity {
    constructor(id, owner, type, startPos, targetPos) {
        super(id);
        this.owner = owner;
        this.type = type; // 'Fireball', 'Dagger'
        this.skillName = ({ Dagger: 'Piercing Throw', PhantomArrow: 'Phantom Volley',
            Fireball: 'Fireball', FlameTornado: 'Flame Tornado', DragonfireLance: 'Dragonfire Lance',
            ArcaneMissile: 'Arcane Missiles', Meteor: 'Meteor Drop', ExplosiveTrap: 'Explosive Trap',
            SnareTrap: 'Snare Trap', Tripwire: 'Tripwire' })[type] || '';
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
        this.radius = PROCEDURAL_PROJECTILE_VISUAL_DEFINITIONS[type]?.gameplayRadius
            ?? (type === 'Fireball' ? 2.0 : 1.5);
        this.lifeTime = 10.0; // Increased lifetime to allow long-range shots
        this.visualElapsed = 0;
        
        this.hitEntities = new Set(); // Track entities hit by this projectile
        this.hasExploded = false;
        this.hasResolvedImpact = false;
        
        // Modifiers
        this.bounces = 0;
        this.applyBleed = false;
        this.homingTarget = null; // Entity to home in on
        this.homingTurnRate = 5.0; // Radians per second

        this.initMesh();
    }

    initMesh() {
        if (this.type === 'Fireball') {
            this.damage = 20 + (this.owner.stats.intelligence * 2);
        } else if (this.type === 'ArcaneMissile') {
            this.damage = 10 + (this.owner.stats.intelligence * 1.0);
            this.speed = 25;
        } else if (this.type === 'DragonfireLance') {
            this.damage = 50 + (this.owner.stats.intelligence * 4.0);
            this.speed = 40;
        } else if (this.type === 'Dagger') {
            this.damage = 15 + (this.owner.stats.dexterity * 1.5);
        } else if (this.type === 'FlameTornado') {
            this.damage = 30 + (this.owner.stats.intelligence * 2.0);
            this.speed = 10;
            this.isPiercingThrow = true;
        } else if (this.type === 'Meteor') {
            this.damage = 50 + (this.owner.stats.intelligence * 3);
        } else if (this.type === 'PhantomArrow') {
            this.damage = 25 + (this.owner.stats.dexterity * 2.0);
            this.speed = 35;
        } else if (this.type === 'Tripwire') {
            this.damage = 20 + this.owner.stats.dexterity;
            this.speed = 0;
            this.velocity.set(0,0,0);
        } else if (this.type === 'ExplosiveTrap') {
            this.damage = 50 + (this.owner.stats.dexterity * 3);
            this.speed = 0;
            this.velocity.set(0,0,0);
        } else if (this.type === 'SnareTrap') {
            this.damage = 10;
            this.speed = 0;
            this.velocity.set(0,0,0);
        } else if (this.type === 'ZoneDamage') {
            this.damage = 30 + (this.owner.stats.intelligence * 1);
            this.speed = 0;
            this.velocity.set(0,0,0);
        } else if (this.type === 'ZoneHoly') {
            this.damage = 20 + (this.owner.stats.wisdom * 1);
            this.speed = 0;
            this.velocity.set(0,0,0);
        } else if (this.type === 'Zone') {
            // Legacy fallback
            this.damage = 20 + (this.owner.stats.wisdom * 1);
            this.speed = 0;
            this.velocity.set(0,0,0);
        }

        this.mesh = createProceduralProjectileVisual(this.type);
        this.mesh.position.copy(this.position);
        this.mesh.userData.entityId = this.id; // Ensure ID is set for raycasting/identification
        
        // Rotate to face direction
        const lookTarget = this.position.clone().add(this.velocity);
        if (!this.mesh.userData.upright) this.mesh.lookAt(lookTarget);
        this.rotation.copy(this.mesh.quaternion);
    }

    setScale(scale) {
        super.setScale(scale);
        applyProceduralProjectileScale(this.mesh, this.scale);
    }

    update(dt, collisionManager, player, chunkManager, floatingTextManager, gameEngine) {
        if (!this.isActive) return;
        const locallySimulated = !this.serverAuthoritativeLifetime && !gameEngine?.isMultiplayer &&
            !this.owner?.isMultiplayer && !this.owner?.isRemote;
        const walkRects = gameEngine?.currentInstanceId && gameEngine.currentInstanceType !== 'overworld'
            ? gameEngine.currentDungeonLayout?.walkRects : null;

        this.visualElapsed += Math.max(0, Number(dt) || 0);

        const effectScene = gameEngine?.effectScene || gameEngine?.scene;

        // Meteor Trail - Using centralized particle pool for performance
        if (this.type === 'Meteor' && effectScene) {
            particlePool.spawn(effectScene, this.position, 0xffaa00);
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
        if (locallySimulated) {
            const destination = this.position.clone().add(moveStep);
            const clipped = clipDungeonEffectSegment(walkRects, this.position, destination);
            if (clipped.blocked) {
                this.position.set(clipped.x, destination.y, clipped.z);
                this.mesh?.position.copy(this.position);
                this.isActive = false;
                if (this.mesh) this.mesh.visible = false;
                spawnProjectileImpact(gameEngine, this, this.position, { terminal: true });
                return;
            }
        }
        this.position.add(moveStep);
        
        if (this.mesh) {
            this.mesh.position.copy(this.position);
            updateProceduralProjectileVisual(this.mesh, this.type, this.visualElapsed, dt);
        }

        // Collision Detection (Client-side prediction / Singleplayer)
        if (this.type === 'Meteor' && this.groundImpactPosition && locallySimulated) {
            // A falling meteor impacts its selected ground point, even when no
            // actor stands under it. Do not detonate early on an actor's head.
            if (this.position.y <= this.groundImpactPosition.y) {
                this.position.copy(this.groundImpactPosition);
                this.mesh?.position.copy(this.position);
                this.hasExploded = true;
                this.isActive = false;
                if (this.mesh) this.mesh.visible = false;
                const rects = gameEngine?.currentInstanceId && gameEngine.currentInstanceType !== 'overworld'
                    ? gameEngine.currentDungeonLayout?.walkRects : null;
                for (const target of chunkManager?.getActiveEntities() || []) {
                    if (!(target instanceof Actor) || target === this.owner || !target.isActive || target.state === 'DEAD') continue;
                    const hostile = typeof gameEngine?.isHostileActorTarget === 'function' ? gameEngine.isHostileActorTarget(target)
                        : !target.isInvulnerable && !['Wizard', 'Cleric', 'Fighter', 'Rogue', 'AvengingSeraph'].includes(target.constructor.name);
                    if (!hostile || Math.hypot(target.position.x - this.position.x, target.position.z - this.position.z) > this.explosionRadius + (target.radius || 0) ||
                        clipDungeonEffectSegment(rects, this.position, target.position).blocked) continue;
                    if (!this.owner.isMultiplayer && !this.owner.isRemote) {
                        applyOfflineAbilityHit(this.owner, target, this.damage, this.skillName, floatingTextManager, '#ff4500');
                    }
                }
                spawnProjectileImpact(gameEngine, this, this.position, { radius: this.explosionRadius, terminal: true });
            }
            return;
        }
        if (chunkManager && locallySimulated) {
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
                // World props, service NPCs, loot, effects, and other
                // non-combat entities can share a chunk with a projectile.
                // Only the damageable actor contract is a valid collision
                // target; otherwise a visual pass can throw on takeDamage.
                if (typeof entity.takeDamage !== 'function') continue;
                if (clipDungeonEffectSegment(walkRects, this.position, entity.position).blocked) continue;

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
                                    if (typeof other.takeDamage !== 'function') continue;
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
                            
                            const hit = applyOfflineAbilityHit(this.owner, entity, finalDamage, this.skillName, floatingTextManager);
                            // Like the server, coatings are checked at impact.
                            // The bleed inherits this hit's modifiers and crit;
                            // its own Mastery is applied once to the snapshot.
                            if (hit > 0 && this.owner.serratedEdgesActive &&
                                ['Piercing Throw', 'Fan of Knives'].includes(this.skillName) &&
                                applyOfflineStatus(this.owner, entity, 'bleed', Math.max(1, Math.floor(hit/5)), 5, 'Serrated Edges', true)) {
                                floatingTextManager?.spawn('BLEED!', entity.position, '#ff0000');
                            }
                            if (hit > 0 && this.skillName === 'Piercing Throw' && this.owner.poisonCoatingActive &&
                                applyOfflineStatus(this.owner, entity, 'poison', 8+Math.floor(this.owner.stats.dexterity/2), 8, 'Poison Coating')) {
                                floatingTextManager?.spawn('POISON!', entity.position, '#00ff00');
                            }
                        }

                        spawnProjectileImpact(gameEngine, this, this.position, {
                            targetId: entity.id,
                            terminal: false
                        });

                    } else if (this.type === 'ArcaneMissile' || this.type === 'PhantomArrow') {
                        // Single Hit Logic
                        this.isActive = false;
                        if (this.mesh) this.mesh.visible = false;
                        
                        if (!this.owner.isMultiplayer && !this.owner.isRemote) {
                            applyOfflineAbilityHit(this.owner, entity, this.damage, this.skillName, floatingTextManager, '#aa00ff');
                        }
                        
                        spawnProjectileImpact(gameEngine, this, this.position, {
                            targetId: entity.id,
                            terminal: true
                        });
                        break;

                    } else if (this.type === 'Fireball' || this.type === 'Meteor' || this.type === 'ExplosiveTrap') {
                        // Explode Logic: Hit, Splash, Destroy
                        this.hasExploded = true;
                        this.isActive = false; // Destroy projectile
                        if (this.mesh) this.mesh.visible = false; // Hide immediately to prevent visual piercing
                        
                        // Splash Damage
                        const splashRadius = this.explosionRadius
                            || getProjectileImpactRadius(this.type, this.owner, this.scale)
                            || (this.type === 'Meteor' ? 26.4 : this.type === 'ExplosiveTrap' ? 6.0 : 10.0);
                        // Find all entities in splash radius
                        for (const splashTarget of activeEntities) {
                            if (splashTarget.state === 'DEAD' || !splashTarget.isActive) continue;
                            if (typeof splashTarget.takeDamage !== 'function') continue;
                            if (this.owner && this.owner.constructor.name === splashTarget.constructor.name) continue;

                            const splashDist = Math.hypot(this.position.x - splashTarget.position.x, this.position.z - splashTarget.position.z);
                            if (splashDist <= splashRadius + (splashTarget.radius || 0) &&
                                !clipDungeonEffectSegment(walkRects, this.position, splashTarget.position).blocked) {
                                if (!this.owner.isMultiplayer && !this.owner.isRemote) {
                                    // Meteor is a full-strength area impact. Fireball
                                    // and traps splash for 40% of raw damage, with
                                    // independent recipient criticals, never a
                                    // critical multiplied into another critical.
                                    let raw = splashTarget === entity || this.type === 'Meteor' ? this.damage : Math.floor(this.damage * .4);
                                    if (this.type === 'Fireball' && this.fireballWellBoost && splashTarget.slowTimer > 0) raw *= 2;
                                    applyOfflineAbilityHit(this.owner, splashTarget, raw, this.skillName, floatingTextManager, '#ff4500');
                                }
                            }
                        }
                        
                        // Burning Ground Logic
                        if (this.leaveBurningGround && this.owner && this.owner.spawnBurningGround && gameEngine) {
                             this.owner.spawnBurningGround(this.position, gameEngine);
                        }
                        
                        spawnProjectileImpact(gameEngine, this, this.position, {
                            radius: splashRadius,
                            targetId: entity.id,
                            terminal: true
                        });

                        break; // Stop checking other entities since we exploded
                    } else if (this.type === 'Tripwire' || this.type === 'SnareTrap') {
                        this.isActive = false;
                        if (this.mesh) this.mesh.visible = false;
                        if (!this.owner.isMultiplayer && !this.owner.isRemote) {
                            applyOfflineAbilityHit(this.owner, entity, this.damage, this.skillName, floatingTextManager);
                        }
                        spawnProjectileImpact(gameEngine, this, this.position, {
                            targetId: entity.id,
                            terminal: true
                        });
                        break;
                    }
                }
            }
        }
    }
}
