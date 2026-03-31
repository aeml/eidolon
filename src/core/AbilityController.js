// ============================================================================
// AbilityController — owns ability casting, input buffering, VFX mapping,
//                     and pending-ability-target chase logic
// ============================================================================

import * as THREE from 'three';
import { CONSTANTS } from './Constants.js';
import { Fighter } from '../entities/Fighter.js';
import { Rogue } from '../entities/Rogue.js';
import { Wizard } from '../entities/Wizard.js';
import { Cleric } from '../entities/Cleric.js';
import { AvengingSeraph } from '../entities/AvengingSeraph.js';
import { DwarfSalesman } from '../entities/DwarfSalesman.js';
import { resolveRemoteSkillVisual } from '../skills/skillVisuals.js';

export class AbilityController {
    /**
     * @param {import('./GameEngine.js').GameEngine} engine
     */
    constructor(engine) {
        this.engine = engine;

        /** Pending target entity to chase before casting */
        this.pendingAbilityTarget = null;
        /** Skill name associated with the pending chase target */
        this.pendingAbilitySkill = null;

        /** Input buffer for abilities pressed during cooldown */
        this.inputBuffer = [];
        this.inputBufferWindow = 0.4; // 400ms buffer window

        /** Dev-only tracker for unmapped remote ability VFX (prevents log spam) */
        this.unmappedRemoteAbilityVisuals = new Set();
    }

    // ------------------------------------------------------------------
    // Cast-range resolution
    // ------------------------------------------------------------------

    /**
     * Resolve the cast range for a skill from CONSTANTS.ABILITY_CONFIG.
     * Falls back to 12.0 if no config is found.
     *
     * @param {string|null} skillName
     * @returns {number}
     */
    getAbilityCastRange(skillName = null) {
        const player = this.engine.player;
        const className = player && player.constructor ? player.constructor.name : '';
        const classAbilityConfig = CONSTANTS.ABILITY_CONFIG ? CONSTANTS.ABILITY_CONFIG[className] : null;
        const defaultRange = classAbilityConfig && classAbilityConfig.default ? classAbilityConfig.default.range : null;
        const skillRange = (classAbilityConfig && classAbilityConfig.skills && skillName)
            ? classAbilityConfig.skills[skillName]?.range
            : null;

        if (typeof skillRange === 'number') return skillRange;
        if (typeof defaultRange === 'number') return defaultRange;
        return 12.0;
    }

    getAbilityIntentSkillName(skillNameOverride = null) {
        const player = this.engine.player;
        return skillNameOverride || this.pendingAbilitySkill || player?.abilityName || null;
    }

    getAbilityIntentRange(skillNameOverride = null) {
        return this.getAbilityCastRange(this.getAbilityIntentSkillName(skillNameOverride));
    }

    buildSoftDamagePreview(target = null, skillNameOverride = null) {
        const player = this.engine.player;
        const className = player && player.constructor ? player.constructor.name : '';
        const abilityName = this.getAbilityIntentSkillName(skillNameOverride);
        const basicAttack = Math.max(0, Math.round(player?.stats?.damage || 0));

        const previewMultipliers = {
            Fighter: {
                default: 1.2,
                skills: {
                    Charge: 1.35,
                    'Piercing Throw': 1.2
                }
            },
            Rogue: {
                default: 1.3,
                skills: {
                    'Piercing Throw': 1.25,
                    'Shadow Lunge': 1.45,
                    'Shadow Strike': 1.35,
                    Backstab: 1.4
                }
            },
            Wizard: {
                default: 1.4,
                skills: {
                    Fireball: 1.5,
                    Blizzard: 1.6,
                    Meteor: 1.75,
                    Teleport: 0
                }
            },
            Cleric: {
                default: 1.25,
                skills: {
                    Smite: 1.35,
                    'Spirit Guardians': 1.5
                }
            }
        };

        const classPreview = previewMultipliers[className] || {};
        const abilityMultiplier = abilityName && classPreview.skills && Object.prototype.hasOwnProperty.call(classPreview.skills, abilityName)
            ? classPreview.skills[abilityName]
            : (classPreview.default || 1.25);
        const ability = abilityMultiplier === 0
            ? 0
            : Math.max(basicAttack, Math.round(basicAttack * abilityMultiplier));

        return {
            targetId: target?.id || null,
            basicAttack,
            ability,
            abilityName: abilityName || 'Ability',
            isEstimate: true
        };
    }

    // ------------------------------------------------------------------
    // Remote ability VFX
    // ------------------------------------------------------------------

    /**
     * Trigger the correct visual effect on a remote player's ability use.
     *
     * @param {import('../entities/Actor.js').Actor} entity
     * @param {string} skillName
     * @param {number} targetX
     * @param {number} targetZ
     */
    triggerRemoteAbilityVisuals(entity, skillName, targetX, targetZ) {
        if (!entity || !entity.spawnVisualEffect) return;

        const visual = resolveRemoteSkillVisual(entity, skillName, new THREE.Vector3(targetX, 0, targetZ));
        if (visual.handled) {
            return;
        }

        entity.spawnVisualEffect(this.engine, visual.origin, visual.color, visual.type);

        if (visual.fallback) {
            const host = (typeof window !== 'undefined' && window.location) ? window.location.hostname : '';
            const isDevHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
            const key = `${entity.constructor.name}:${skillName || '(none)'}`;
            if (isDevHost && !this.unmappedRemoteAbilityVisuals.has(key)) {
                this.unmappedRemoteAbilityVisuals.add(key);
                console.warn(`[Remote VFX] Unmapped skill visual for ${key}; used ${visual.type} fallback.`);
            }
        }
    }

    // ------------------------------------------------------------------
    // Hotbar slot resolver
    // ------------------------------------------------------------------

    /**
     * Resolve a hotbar slot index to a skill name and cast it.
     * @param {number} slotIndex
     */
    performHotbarAbility(slotIndex) {
        const player = this.engine.player;
        if (!player || !player.hotbar) {
            console.warn("Player or hotbar not initialized.");
            return;
        }
        const skillName = player.hotbar[slotIndex];
        if (!skillName) {
            console.log(`Hotbar slot ${slotIndex + 1} is empty.`);
            return;
        }

        // Mobile uses auto-targeting logic inside performAbility().
        if (this.engine.isMobile) {
            this.performAbility(null, skillName);
            return;
        }

        // Determine target (mouse cursor)
        let targetPos = null;
        if (this.engine.hoveredEntity && this.engine.hoveredEntity !== player && this.engine.hoveredEntity.state !== 'DEAD' && !(this.engine.hoveredEntity instanceof DwarfSalesman)) {
            targetPos = this.engine.hoveredEntity.position;
        } else {
            targetPos = this.engine.inputManager.getGroundIntersection();
        }

        if (targetPos) {
            this.performAbility(targetPos, skillName);
        }
    }

    // ------------------------------------------------------------------
    // Main ability orchestrator
    // ------------------------------------------------------------------

    /**
     * Cast an ability toward a target, with cooldown/mana checks,
     * mobile auto-aim, multiplayer send, and client-side prediction.
     *
     * @param {THREE.Vector3|null} targetVectorOverride
     * @param {string|null} skillNameOverride
     */
    performAbility(targetVectorOverride = null, skillNameOverride = null) {
        const engine = this.engine;
        const player = engine.player;
        if (!player) return;
        if (engine.uiManager.isEscMenuOpen || engine.uiManager.isPatchNotesOpen || engine.uiManager.reportScreen.style.display === 'block') return;

        // Rotate to face cursor/target immediately (even if on cooldown)
        if (!engine.isMobile) {
            let lookAtPos = null;
            if (targetVectorOverride) {
                lookAtPos = targetVectorOverride;
            } else if (engine.hoveredEntity && engine.hoveredEntity !== player && engine.hoveredEntity.state !== 'DEAD' && !(engine.hoveredEntity instanceof DwarfSalesman)) {
                lookAtPos = engine.hoveredEntity.position;
            } else {
                const point = engine.inputManager.getGroundIntersection();
                if (point) {
                    lookAtPos = point;
                }
            }

            if (lookAtPos) {
                const lookTarget = new THREE.Vector3(lookAtPos.x, player.position.y, lookAtPos.z);
                if (player.mesh) {
                    player.mesh.lookAt(lookTarget);
                    player.rotation.copy(player.mesh.quaternion);
                }
            }
        }

        // Check Cooldown and Mana before proceeding
        let onCooldown = false;
        if (!skillNameOverride) {
            if (player.abilityCooldown > 0) {
                onCooldown = true;
            }
        } else {
            if (player.cooldowns && player.cooldowns[skillNameOverride] > 0) {
                onCooldown = true;
            }
        }

        if (onCooldown) {
            // Buffer the input
            const existing = this.inputBuffer.find(b => b.skillName === skillNameOverride);
            if (!existing) {
                // Only buffer if not already buffered to avoid duplicates
                this.inputBuffer.push({
                    skillName: skillNameOverride,
                    target: targetVectorOverride,
                    timestamp: Date.now() / 1000
                });
                console.log(`Buffered ability: ${skillNameOverride || 'Primary'} (CD)`);
            }
            return;
        }

        // Mana Check
        const className = player && player.constructor ? player.constructor.name : '';
        const classAbilityConfig = CONSTANTS.ABILITY_CONFIG ? CONSTANTS.ABILITY_CONFIG[className] : null;
        const defaultAbilityConfig = classAbilityConfig ? classAbilityConfig.default : null;
        const castSkillName = skillNameOverride || player.abilityName;
        const skillAbilityConfig = (classAbilityConfig && classAbilityConfig.skills && castSkillName)
            ? classAbilityConfig.skills[castSkillName]
            : null;
        const manaCostBase = (skillAbilityConfig && typeof skillAbilityConfig.mana === 'number')
            ? skillAbilityConfig.mana
            : (defaultAbilityConfig && typeof defaultAbilityConfig.mana === 'number')
                ? defaultAbilityConfig.mana
                : player.abilityManaCost;
        const cost = manaCostBase * (1 - (player.stats.manaCostReduction || 0));
        if (player.stats.mana < cost) {
            return;
        }
        
        if (engine.isMobile && !targetVectorOverride) {
            // Auto-target nearest enemy for mobile ability
            let nearest = null;
            let minDst = 1000;
            const activeEntities = engine.chunkManager.getActiveEntities();

            activeEntities.forEach(e => {
                if (engine.isHostileActorTarget(e)) {
                    const d = player.position.distanceTo(e.position);
                    if (d < minDst) {
                        minDst = d;
                        nearest = e;
                    }
                }
            });

            let targetPos = null;
            let targetId = "";

            const autoAimRange = this.getAbilityCastRange(skillNameOverride || player.abilityName);
            if (nearest && minDst < autoAimRange) {
                targetPos = nearest.position;
                targetId = nearest.id;

                // Turn towards enemy
                const lookTarget = new THREE.Vector3(nearest.position.x, player.position.y, nearest.position.z);
                if (player.mesh) {
                    player.mesh.lookAt(lookTarget);
                    player.rotation.copy(player.mesh.quaternion);
                }
            } else {
                // Cast in front of player if no enemy
                if (player.mesh) {
                    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(player.mesh.quaternion);
                    targetPos = player.position.clone().add(forward.multiplyScalar(5));
                } else {
                    // Fallback
                    targetPos = player.position.clone();
                    targetPos.z += 5;
                }
            }

            if (engine.isMultiplayer) {
                engine.network.send('ability', {
                    targetX: targetPos.x,
                    targetZ: targetPos.z,
                    targetId: targetId,
                    skillName: skillNameOverride || player.abilityName
                });
            }
            
            // Client-side prediction
            if (skillNameOverride && player.useSkill) {
                player.useSkill(skillNameOverride, targetPos, engine);
            } else {
                player.useAbility(targetPos, engine, skillNameOverride);
            }
            return;
        }

        if (targetVectorOverride) {
             if (engine.isMultiplayer) {
                engine.network.send('ability', {
                    targetX: targetVectorOverride.x,
                    targetZ: targetVectorOverride.z,
                    targetId: "",
                    skillName: skillNameOverride || player.abilityName
                });
            }
            
            if (skillNameOverride && player.useSkill) {
                player.useSkill(skillNameOverride, targetVectorOverride, engine);
            } else {
                player.useAbility(targetVectorOverride, engine, skillNameOverride);
            }
            return;
        }

        if (engine.hoveredEntity && engine.hoveredEntity !== player && engine.hoveredEntity.state !== 'DEAD') {
            if (engine.hoveredEntity instanceof DwarfSalesman) return;

            const dist = player.position.distanceTo(engine.hoveredEntity.position);
            const abilityRange = this.getAbilityCastRange(skillNameOverride || player.abilityName);

            // Check if we are in range
            if (dist <= abilityRange) {
                // Multiplayer Ability Logic (Targeted)
                if (engine.isMultiplayer) {
                    engine.network.send('ability', {
                        targetX: engine.hoveredEntity.position.x,
                        targetZ: engine.hoveredEntity.position.z,
                        targetId: engine.hoveredEntity.id,
                        skillName: skillNameOverride || player.abilityName
                    });
                }
                
                // Client-side prediction
                if (skillNameOverride && player.useSkill) {
                    player.useSkill(skillNameOverride, engine.hoveredEntity.position, engine);
                } else {
                    player.useAbility(engine.hoveredEntity.position, engine);
                }
            } else {
                // Out of range – move to edge of ability range, not to the enemy
                this.pendingAbilityTarget = engine.hoveredEntity;
                this.pendingAbilitySkill = skillNameOverride || player.abilityName;
                engine.pendingInteraction = null;
                const direction = new THREE.Vector3()
                    .subVectors(engine.hoveredEntity.position, player.position)
                    .normalize();
                const stopPoint = engine.hoveredEntity.position.clone()
                    .sub(direction.multiplyScalar(abilityRange * 0.9));
                player.move(stopPoint);
            }
        } else {
            // Ground click (Movement or Skillshot)
            const targetPoint = engine.inputManager.getGroundIntersection();
            if (targetPoint) {
                // Multiplayer Ability Logic (Skillshot)
                if (engine.isMultiplayer) {
                    engine.network.send('ability', {
                        targetX: targetPoint.x,
                        targetZ: targetPoint.z,
                        targetId: "",
                        skillName: skillNameOverride || player.abilityName
                    });
                }
                
                // Client-side prediction
                if (skillNameOverride && player.useSkill) {
                    player.useSkill(skillNameOverride, targetPoint, engine);
                } else {
                    player.useAbility(targetPoint, engine);
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Basic attack
    // ------------------------------------------------------------------

    /**
     * Send a basic attack to the server and trigger facing visuals.
     * @param {import('../entities/Actor.js').Actor} target
     */
    performAttack(target) {
        const player = this.engine.player;
        if (!player || !target) return;

        // Send to Server
        this.engine.network.send('attack', { targetId: target.id });

        // Visuals
        const lookTarget = new THREE.Vector3(target.position.x, player.position.y, target.position.z);
        if (player.mesh) {
            player.mesh.lookAt(lookTarget);
            player.rotation.copy(player.mesh.quaternion);
        }

        player.setAttackingState();
    }

    // ------------------------------------------------------------------
    // Per-frame helpers (called from GameEngine.update)
    // ------------------------------------------------------------------

    /**
     * Process the input buffer: expire old entries, execute the oldest
     * buffered ability if its cooldown is now ready.
     */
    processInputBuffer() {
        if (this.inputBuffer.length === 0) return;

        const player = this.engine.player;
        const now = Date.now() / 1000;

        // Remove expired
        this.inputBuffer = this.inputBuffer.filter(b => now - b.timestamp < this.inputBufferWindow);
        
        // Try to execute oldest
        if (this.inputBuffer.length > 0) {
            const buffered = this.inputBuffer[0];
            
            // Check if ready
            let ready = false;
            if (!buffered.skillName) {
                if (player.abilityCooldown <= 0) ready = true;
            } else {
                if (!player.cooldowns || player.cooldowns[buffered.skillName] <= 0) ready = true;
            }

            if (ready) {
                console.log(`Executing buffered ability: ${buffered.skillName || 'Primary'}`);
                // Remove BEFORE executing to prevent infinite recursion
                this.inputBuffer.shift();
                
                // Re-determine target if not overridden
                let target = buffered.target;
                if (!target) {
                     // performAbility logic handles null target by checking mouse.
                }
                
                this.performAbility(target, buffered.skillName);
            }
        }
    }

    /**
     * Chase a pending ability target and cast when in range.
     * Returns true if a pending target is being chased (so caller
     * knows not to do other movement logic).
     */
    updatePendingTarget() {
        if (!this.pendingAbilityTarget) return false;

        const player = this.engine.player;

        if (!this.pendingAbilityTarget.isActive || this.pendingAbilityTarget.state === 'DEAD') {
            this.pendingAbilityTarget = null;
            this.pendingAbilitySkill = null;
            return false;
        }

        const dist = player.position.distanceTo(this.pendingAbilityTarget.position);
        const skillName = this.pendingAbilitySkill || player.abilityName;
        const range = this.getAbilityCastRange(skillName);

        if (dist <= range) {
            // In range – stop moving and cast
            player.targetPosition = null;
            player.state = 'IDLE';
            player.velocity.set(0, 0, 0);

            // Face the target
            const lookTarget = new THREE.Vector3(
                this.pendingAbilityTarget.position.x,
                player.position.y,
                this.pendingAbilityTarget.position.z
            );
            if (player.mesh) {
                player.mesh.lookAt(lookTarget);
                player.rotation.copy(player.mesh.quaternion);
            }

            if (this.engine.isMultiplayer) {
                this.engine.network.send('ability', {
                    targetX: this.pendingAbilityTarget.position.x,
                    targetZ: this.pendingAbilityTarget.position.z,
                    targetId: this.pendingAbilityTarget.id,
                    skillName: skillName
                });
            }

            if (skillName !== player.abilityName && player.useSkill) {
                player.useSkill(skillName, this.pendingAbilityTarget.position, this.engine);
            } else {
                player.useAbility(this.pendingAbilityTarget.position, this.engine);
            }
            // Clear after casting so we don't re-fire every frame
            this.pendingAbilityTarget = null;
            this.pendingAbilitySkill = null;
        } else {
            // Out of range – move to edge of ability range
            const direction = new THREE.Vector3()
                .subVectors(this.pendingAbilityTarget.position, player.position)
                .normalize();
            const stopPoint = this.pendingAbilityTarget.position.clone()
                .sub(direction.multiplyScalar(range * 0.9));
            player.targetPosition = stopPoint;

            if (player.state !== 'MOVING') {
                player.state = 'MOVING';
                const moveAnim = player.getMovementAnimationName(player.isRunning);
                if (moveAnim) player.playAnimation(moveAnim);
            }
        }

        return true;
    }
}
