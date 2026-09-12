import * as THREE from 'three';
import { restoreActorStealthAppearance } from './ActorStealthAppearance.js';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';
import { Projectile } from './Projectile.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { spawnEffectSceneFallback } from './EffectSceneFallback.js';
import { getAbilityRange, getRogueMovementCastRange } from '../core/AbilityRange.js';
import { findOfflineAbilityTarget } from '../skills/offlineAbilityTargeting.js';
import { resolveDungeonMovementEndpoint } from '../skills/dungeonEffectGeometry.js';
import { applyOfflineStatus } from '../core/OfflineDamageOverTime.js';
import { getOfflineEffectiveArmor } from '../core/OfflineArmor.js';
import { getRogueEffectDuration } from '../skills/rogueEffectDuration.js';
import { resolveRogueAbilityDamage } from '../skills/rogueAbilityDamage.js';
import { applyOfflineSmokeBomb } from '../skills/offlineSmokeBomb.js';
import { applyOfflineDeathSpiral } from '../skills/offlineDeathSpiral.js';
import {
    PROCEDURAL_PROJECTILE_VISUAL_DEFINITIONS,
    createProceduralProjectileVisual,
    releaseProceduralProjectileVisual,
    updateProceduralProjectileVisual
} from '../art/ProceduralProjectileEffects.js';

export class Rogue extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.ROGUE);
        this.meshType = 'Rogue';

        this.abilityName = "Piercing Throw";
        this.abilityDescription = "Throw a dagger that pierces through enemies in a line.";
        this.abilityManaCost = 15;
        this.abilityMaxCooldown = 1.0;
        this.scaleAnimSpeed = true;
        
        // Class specific state
        this.serratedEdgesActive = false;
        this.serratedEdgesTimer = 0;
        
        this.poisonCoatingActive = false;
        this.poisonCoatingTimer = 0;
        
        this.traps = []; // Array of active traps
    }

    moveBehindOfflineTarget(target, gameEngine) {
        const facing = target.mesh?.quaternion || target.rotation || new THREE.Quaternion();
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(facing);
        const desired = target.position.clone().sub(forward.multiplyScalar(1.5));
        const rects = gameEngine.currentInstanceId && gameEngine.currentInstanceType !== 'overworld'
            ? gameEngine.currentDungeonLayout?.walkRects : null;
        const landing = resolveDungeonMovementEndpoint(rects, this.position, desired);
        this.position.x = landing.x;
        this.position.z = landing.z;
        this.mesh?.position.copy(this.position);
        this.mesh?.quaternion.copy(facing);
        this.rotation.copy(facing);
    }

    update(dt, collisionManager, player, chunkManager, floatingTextManager, gameEngine = null) {
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
                trap.elapsed = (trap.elapsed || 0) + Math.max(0, Number(dt) || 0);
                updateProceduralProjectileVisual(trap.mesh, 'Tripwire', trap.elapsed, dt);
                let triggered = false;
                
                for (const entity of activeEntities) {
                    if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                        if (entity.position.distanceTo(trap.position) < trap.radius) {
                            // Trigger!
                            entity.rootTimer = getRogueEffectDuration(this, 3);
                            if (floatingTextManager) floatingTextManager.spawn("ROOTED!", entity.position, '#ffff00');
                            
                            // Visual Effect (Need scene)
                            const trapScene = trap.mesh?.parent || gameEngine?.effectScene || gameEngine?.scene || this.mesh?.parent || null;
                            if (trapScene) {
                                const mockGameEngine = {
                                    scene: trapScene,
                                    effectScene: gameEngine?.effectScene || trapScene,
                                    spawnTransientEffect: gameEngine?.spawnTransientEffect
                                };
                                this.spawnVisualEffect(mockGameEngine, trap.position, 0xaaaaaa, "smoke");
                            }
                            
                            triggered = true;
                            break;
                        }
                    }
                }

                if (triggered) {
                    releaseProceduralProjectileVisual(trap.mesh);
                    this.traps.splice(i, 1);
                }
            }
        }
    }

    useAbility(targetVector, gameEngine, skillNameOverride = null) {
        if (!targetVector) return;
        const skill = skillNameOverride || this.abilityName;
        let castTarget = null;
        if (skill === 'Backstab' && !this.isMultiplayer && !gameEngine?.isMultiplayer && !this.unlockedSkills.includes(skill)) return false;
        if (['Weak Point Mark', 'Backstab', 'Shadow Lunge'].includes(skill) && !this.isMultiplayer && !gameEngine?.isMultiplayer) {
            const range = skill === 'Weak Point Mark'
                ? getAbilityRange(this, skill, CONSTANTS.ABILITY_CONFIG.Rogue.skills[skill].range)
                : getRogueMovementCastRange(this, skill);
            castTarget = findOfflineAbilityTarget(this, gameEngine, skill === 'Backstab' ? this.position : targetVector, {
                range, cursorRadius: skill === 'Backstab' ? range : 3, padCursor: skill === 'Backstab'
            });
            // Match the authoritative rejection before super spends mana or
            // presents a cast. An invalid targeted debuff is not a free aim.
            if (!castTarget) return false;
        }
        if (!super.useAbility(targetVector, gameEngine, skillNameOverride)) return;

        if (this.isMultiplayer || gameEngine?.isMultiplayer) return true;

        // Only accepted offline casts advance sequence history. Target, mana
        // and cooldown rejections above must not consume a pending Ambush.
        const now = Date.now();
        const ambushCombo = skill === 'Backstab' && this.lastOfflineRogueSkill === 'Cloak & Vanish' &&
            now - this.lastOfflineRogueSkillAt <= 3000;
        this.lastOfflineRogueSkill = skill;
        this.lastOfflineRogueSkillAt = now;

        // --- Branch A: Assassin Burst Path ---

        if (skill === "Backstab") {
            if (!this.unlockedSkills.includes("Backstab")) return;
            console.log("Rogue used Backstab!");
            

            const target = castTarget;

            if (target) {
                let damage = resolveRogueAbilityDamage(this, skill);
                if (this.skillRunes?.Backstab === 'backstab_shadowstep') this.moveBehindOfflineTarget(target, gameEngine);
                
                // Backstab Check: Are we behind the target?
                // Compare our forward vector with target's forward vector.
                // If dot product is > 0, we are facing same direction (behind).
                const myForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
                const targetForward = new THREE.Vector3(0, 0, 1).applyQuaternion(target.mesh.quaternion);
                const dot = myForward.dot(targetForward);
                
                if (dot > 0.5 || this.skillRunes?.Backstab === 'backstab_shadowstep') {
                    damage = Math.trunc(damage * 2.5); // Match the server's positional strike boundary.
                    gameEngine.floatingTextManager.spawn("BACKSTAB!", target.position, '#ff0000');
                }
                
                const rune = this.skillRunes?.Backstab;
                const runeCritical = rune === 'backstab_ambush' && Math.random() < .5;
                let armor = getOfflineEffectiveArmor(target);
                if (rune === 'backstab_eviscerate') armor -= Math.floor(armor / 2);
                damage = Math.max(1, damage - armor);
                applyOfflineAbilityHit(this, target, damage, skill, gameEngine.floatingTextManager, '#ffffff', ambushCombo || runeCritical);
                if (ambushCombo) {
                    gameEngine.floatingTextManager?.spawn('COMBO: Ambush!', this.position, '#ffd700');
                    gameEngine.uiManager?.showComboNotification?.('Ambush', 'ambush');
                }
                this.spawnVisualEffect(gameEngine, target.position, 0xff0000, "blood");
            }
            return;
        }

        if (skill === "Weak Point Mark") {
            console.log("Rogue used Weak Point Mark!");
            

            const target = castTarget;

            if (target) {
                target.weakPointMarkTimer = getRogueEffectDuration(this, 10, skill);
                gameEngine.floatingTextManager.spawn("WEAK POINT!", target.position, '#ff0000');
                this.spawnVisualEffect(gameEngine, target.position, 0xff0000, "mark");
            }
            return;
        }

        if (skill === "Shadow Lunge") {
            console.log("Rogue used Shadow Lunge!");
            // Teleport logic
            

            const target = castTarget;

            if (target) {
                this.moveBehindOfflineTarget(target, gameEngine);
                
                // Face target
                this.mesh.lookAt(target.position);
                this.rotation.copy(this.mesh.quaternion);
                
                // Apply Bleed
                applyOfflineStatus(this, target, 'bleed', 10+Math.floor(this.stats.dexterity/2), 10, skill);
                if (this.skillRunes?.[skill] === 'shadowlunge_cripple' && !target.ccImmune) {
                    target.slowTimer = getRogueEffectDuration(this, 3);
                    target.slowFactor = .5;
                }
                gameEngine.floatingTextManager.spawn("BLEED!", target.position, '#ff0000');
                
                this.spawnVisualEffect(gameEngine, this.position, 0x000000, "smoke");
            }
            return;
        }

        if (skill === "Death Spiral") {
            applyOfflineDeathSpiral(this, gameEngine);
            return;
        }

        // --- Branch B: Throwing Specialist ---


        if (skill === "Serrated Edges") {
            console.log("Rogue used Serrated Edges!");
            

            this.serratedEdgesActive = true;
            this.serratedEdgesTimer = getRogueEffectDuration(this, 10);
            
            gameEngine.floatingTextManager.spawn("SERRATED BLADES!", this.position, '#ff0000');
            this.spawnVisualEffect(gameEngine, this.position, 0xff0000, "buff");
            return;
        }

        if (skill === "Blade Storm") {
            console.log("Rogue used Blade Storm!");
            

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
                dagger.skillName = skill;
                dagger.damage = resolveRogueAbilityDamage(this, skill);
                gameEngine.addEntity(dagger);
            }
            return;
        }

        if (skill === "Phantom Volley") {
            console.log("Rogue used Phantom Volley!");
            

            // Snapshot every shot at this paid cast, not the delayed emission.
            const volleyDamage = resolveRogueAbilityDamage(this, skill);
            // Rapid Fire 3 shots
            const startPos = this.position.clone();
            startPos.y += 1.0;
            
            const direction = new THREE.Vector3().subVectors(targetVector, this.position).normalize();
            const targetPos = startPos.clone().add(direction.multiplyScalar(50)); // Far away target

            for (let i = 0; i < 3; i++) {
                this.scheduleTask(() => {
                    // Use 'PhantomArrow' for the purple visual
                    const arrow = new Projectile(null, this, 'PhantomArrow', startPos, targetPos);
                    arrow.skillName = skill;
                    arrow.damage = volleyDamage;
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
            

            const startPos = this.position.clone();
            startPos.y += 1.0;
            
            const projectileCount = 12;
            const angleStep = (Math.PI * 2) / projectileCount;
            
            for (let i = 0; i < projectileCount; i++) {
                const angle = i * angleStep;
                const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
                const target = startPos.clone().add(direction.multiplyScalar(10)); // Target 10 units away
                
                const dagger = new Projectile(null, this, 'Dagger', startPos, target);
                dagger.skillName = skill;
                dagger.damage = resolveRogueAbilityDamage(this, skill);
                dagger.isPiercingThrow = true;
                if (this.serratedEdgesActive) dagger.applyBleed = true;
                gameEngine.addEntity(dagger);
            }
            return;
        }

        // --- Branch C: Utility / Debuff Path ---

        if (skill === "Smoke Bomb") {
            // Actor.useAbility already presents the shared trained footprint.
            applyOfflineSmokeBomb(this, gameEngine);
            return;
        }

        if (skill === "Poison Coating") {
            console.log("Rogue used Poison Coating!");
            

            this.poisonCoatingActive = true;
            this.poisonCoatingTimer = getRogueEffectDuration(this, 15);
            
            gameEngine.floatingTextManager.spawn("POISON READY!", this.position, '#00ff00');
            this.spawnVisualEffect(gameEngine, this.position, 0x00ff00, "buff");
            return;
        }

        if (skill === "Tripwire") {
            console.log("Rogue used Tripwire!");
            

            // Place trap at feet
            const trapPos = this.position.clone();

            // Multiplayer receives the server-owned stationary projectile.
            // The cast cue is predicted by the canonical presentation layer.
            if (gameEngine.isMultiplayer) return;
            
            // Visual
            const trapScene = gameEngine?.effectScene || gameEngine?.scene;
            if (!trapScene) return;
            const mesh = createProceduralProjectileVisual('Tripwire');
            mesh.position.copy(trapPos);
            trapScene.add(mesh);

            this.traps.push({
                position: trapPos,
                radius: PROCEDURAL_PROJECTILE_VISUAL_DEFINITIONS.Tripwire.gameplayRadius,
                mesh,
                elapsed: 0
            });
            this._suppressLegacyCastVisualUntil = 0;
            
            return;
        }

        if (skill === "Cloak & Vanish") {
            console.log("Rogue used Cloak & Vanish!");
            

            this.stealthTimer = getRogueEffectDuration(this, this.skillRunes?.[skill] === 'cloak_longer' ? 10 : 5, skill);
            
            // Speed Burst (handled in Actor update or just modify stats temporarily?)
            // Let's use a buff timer for speed if we had one, or just hack it here.
            // Actually, Actor.js doesn't have a generic speed buff timer.
            // I'll add a temporary speed boost logic or just rely on stealth.
            // The prompt says "massive movement speed burst".
            // I'll add `speedBoostTimer` to Actor later if needed, but for now let's just rely on stealth.
            // Or I can modify `this.stats.speed` and reset it later? No, stats are recalculated from base.
            // I'll add `speedBoostTimer` to Actor.js in a moment.
            
            this.speedBoostTimer = getRogueEffectDuration(this, 3, skill);
            this.speedBoostFactor = 1.0; // +100% speed
            
            gameEngine.floatingTextManager.spawn("VANISH!", this.position, '#ffffff');
            this.spawnVisualEffect(gameEngine, this.position, 0x000000, "smoke");
            return;
        }

        console.log("Rogue used Throw Dagger!");
        const startPos = this.position.clone();
        startPos.y += 1.0;
        
        // Adjust target height to match start height for horizontal flight
        const adjustedTarget = targetVector.clone();
        adjustedTarget.y = startPos.y;

        const dagger = new Projectile(null, this, 'Dagger', startPos, adjustedTarget);
        dagger.skillName = skill;
        
        // Damage Calculation: Base 15 + (Dexterity * 1.5)
        const damage = resolveRogueAbilityDamage(this, skill);
        
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
        if (this.shouldSuppressLegacyCastVisual()) return;
        if (!gameEngine || (!gameEngine.effectScene && !gameEngine.scene && typeof gameEngine.spawnTransientEffect !== 'function')) return;
        if (typeof gameEngine.spawnTransientEffect === 'function' && gameEngine.spawnTransientEffect(type, position, color, { source: this })) {
            return;
        }

        spawnEffectSceneFallback(gameEngine, position, color, type);
    }

    cancelAbilities() {
        this.serratedEdgesActive = false;
        this.serratedEdgesTimer = 0;
        this.poisonCoatingActive = false;
        this.poisonCoatingTimer = 0;
        this.stealthTimer = 0;
        this.speedBoostTimer = 0;
        this.speedBoostFactor = 0;
        this.traps.forEach((trap) => releaseProceduralProjectileVisual(trap.mesh));
        this.traps.length = 0;
        restoreActorStealthAppearance(this);
    }
}
