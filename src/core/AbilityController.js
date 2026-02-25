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

        const targetPos = new THREE.Vector3(targetX, 0, targetZ);
        const position = entity.position.clone();
        let handled = false;

        const spawn = (at, color, type) => {
            entity.spawnVisualEffect(this.engine, at, color, type);
            handled = true;
        };

        // Fighter
        if (entity instanceof Fighter) {
            switch (skillName) {
                case "Charge":
                    spawn(position, 0xff5500, "wave");
                    break;
                case "Whirlwind":
                    spawn(position, 0xaaaaaa, "spin");
                    break;
                case "Shield Slam":
                    spawn(position, 0xffff00, "impact");
                    break;
                case "Iron Fortress":
                    spawn(position, 0x808080, "buff");
                    break;
                case "Guardian Roar":
                    spawn(position, 0xff0000, "wave");
                    break;
                case "Sweeping Strike":
                    spawn(position, 0xffffff, "cone");
                    break;
                case "Earthshaker":
                    spawn(position, 0x8b4513, "wave");
                    break;
                case "Unbreakable Grip":
                    spawn(targetPos, 0x0000ff, "impact");
                    break;
                case "Juggernaut Charge":
                    spawn(position, 0xff0000, "wave");
                    break;
                case "Berserker Edge":
                    spawn(position, 0xff0000, "buff");
                    break;
                case "Shattering Charge":
                    spawn(position, 0xffffff, "wave");
                    break;
                case "Executioner Spin":
                    spawn(position, 0xff0000, "spin");
                    break;
                case "Last Stand Rampage":
                    spawn(position, 0xff0000, "buff");
                    break;
            }
        }
        // Rogue
        else if (entity instanceof Rogue) {
            switch (skillName) {
                case "Piercing Throw":
                case "Ricochet Blades":
                    spawn(position, 0xdddddd, "burst");
                    break;
                case "Shadow Step":
                case "Shadow Lunge":
                    spawn(position, 0x000000, "smoke");
                    break;
                case "Fan of Knives":
                    spawn(position, 0x333333, "spin");
                    break;
                case "Venomous Strike":
                case "Weak Point Mark":
                    spawn(targetPos, 0xff0000, "mark");
                    break;
                case "Assassinate":
                case "Backstab":
                case "Shadow Strike":
                    spawn(targetPos, 0xff0000, "blood");
                    break;
                case "Death Spiral":
                    spawn(position, 0x333333, "spin");
                    break;
                case "Serrated Edges":
                    spawn(position, 0xff0000, "buff");
                    break;
                case "Blade Storm":
                    spawn(position, 0xcccccc, "cone");
                    break;
                case "Phantom Volley":
                    spawn(position, 0x8800ff, "burst");
                    break;
                case "Smoke Bomb":
                    spawn(position, 0x555555, "smoke_cloud");
                    break;
                case "Poison Coating":
                    spawn(position, 0x00ff00, "buff");
                    break;
                case "Tripwire":
                case "Snare Trap":
                case "Explosive Trap":
                    spawn(position, 0xaaaaaa, "impact");
                    break;
                case "Adrenaline Rush":
                case "Stealth":
                case "Cloak & Vanish":
                    spawn(position, 0x000000, "smoke");
                    break;
                case "Rain of Arrows":
                    spawn(targetPos, 0xffffff, "ring");
                    break;
            }
        }
        // Wizard
        else if (entity instanceof Wizard) {
            switch (skillName) {
                case "Frost Nova":
                    spawn(position, 0x00ffff, "ring");
                    break;
                case "Blink":
                case "Teleport":
                    spawn(position, 0x00ffff, "burst");
                    break;
                case "Fireball":
                    spawn(position, 0xff4500, "burst");
                    break;
                case "Flame Whip":
                    spawn(position, 0xff4500, "cone");
                    break;
                case "Flame Tornado":
                    spawn(position, 0xff5500, "spin");
                    break;
                case "Meteor":
                case "Meteor Drop":
                    spawn(targetPos, 0xff4500, "ring");
                    break;
                case "Ice Barrier":
                case "Arcane Shield":
                    spawn(position, 0x0088ff, "sphere");
                    break;
                case "Scorch Beam":
                case "Dragonfire Lance":
                    spawn(targetPos, 0xffaa00, "beam");
                    break;
                case "Arcane Missiles":
                    spawn(position, 0xaa00ff, "burst");
                    break;
                case "Spell Focus":
                    spawn(position, 0x8800ff, "buff");
                    break;
                case "Gravity Well":
                    spawn(targetPos, 0x440088, "ring");
                    break;
                case "Inferno Cataclysm":
                    spawn(targetPos, 0xff2200, "ring");
                    break;
                case "Time Warp":
                    spawn(position, 0xffd700, "ring");
                    break;
            }
        }
        // Cleric
        else if (entity instanceof Cleric) {
            switch (skillName) {
                case "Spirit Guardians":
                case "Spirit Guardians Boost":
                    spawn(position, 0xffff66, "buff");
                    break;
                case "Smite":
                    spawn(targetPos, 0xffff00, "impact");
                    break;
                case "Healing Light":
                    spawn(targetPos, 0x00ff88, "pillar");
                    break;
                case "Guardian Embrace":
                    spawn(position, 0xffff00, "buff");
                    break;
                case "Purifying Wave":
                case "Holy Nova":
                    spawn(position, 0x00ffff, "ring");
                    break;
                case "Divine Protection":
                case "Divine Intervention":
                    spawn(targetPos, 0xffd700, "pillar");
                    break;
                case "Sacred Ground":
                case "Consecrated Ground":
                    spawn(position, 0xffd700, "ground_circle");
                    break;
                case "Radiant Strike":
                    spawn(position, 0xffff00, "burst");
                    break;
                case "Blessing of Resolve":
                case "Blessing of Zeal":
                    spawn(position, 0xffff00, "ring");
                    break;
                case "Mark of Weakness":
                    spawn(targetPos, 0x800080, "pillar");
                    break;
                case "Heaven's Trumpet":
                    spawn(position, 0xffd700, "ring");
                    break;
                case "Resurrection":
                    spawn(targetPos, 0xffffff, "beam");
                    break;
            }
        }
        // Avenging Seraph
        else if (entity instanceof AvengingSeraph) {
            switch (skillName) {
                case "Smite":
                    spawn(targetPos, 0xffff00, "impact");
                    break;
            }
        }

        if (!handled) {
            let fallbackColor = 0xffffff;
            let fallbackType = 'impact';

            if (entity instanceof Fighter) {
                fallbackColor = 0xffaa55;
                fallbackType = 'wave';
            } else if (entity instanceof Rogue) {
                fallbackColor = 0xaaaaaa;
                fallbackType = 'smoke';
            } else if (entity instanceof Wizard) {
                fallbackColor = 0x66bbff;
                fallbackType = 'ring';
            } else if (entity instanceof Cleric || entity instanceof AvengingSeraph) {
                fallbackColor = 0xffff99;
                fallbackType = 'buff';
            }

            spawn(position, fallbackColor, fallbackType);

            const host = (typeof window !== 'undefined' && window.location) ? window.location.hostname : '';
            const isDevHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
            const key = `${entity.constructor.name}:${skillName || '(none)'}`;
            if (isDevHost && !this.unmappedRemoteAbilityVisuals.has(key)) {
                this.unmappedRemoteAbilityVisuals.add(key);
                console.warn(`[Remote VFX] Unmapped skill visual for ${key}; used ${fallbackType} fallback.`);
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
                // Move closer first
                this.pendingAbilityTarget = engine.hoveredEntity;
                this.pendingAbilitySkill = skillNameOverride || player.abilityName;
                engine.pendingInteraction = null;
                player.move(engine.hoveredEntity.position);
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

        player.targetPosition = this.pendingAbilityTarget.position.clone();
        
        const dist = player.position.distanceTo(this.pendingAbilityTarget.position);
        const skillName = this.pendingAbilitySkill || player.abilityName;
        const range = this.getAbilityCastRange(skillName);

        if (dist < range) {
            if (this.engine.isMultiplayer) {
                this.engine.network.send('ability', {
                    targetX: this.pendingAbilityTarget.position.x,
                    targetZ: this.pendingAbilityTarget.position.z,
                    targetId: this.pendingAbilityTarget.id,
                    skillName: skillName
                });
                player.playAnimation('Attack', false);
            } else {
                player.useAbility(this.pendingAbilityTarget.position, this.engine);
            }
            // Clear after casting so we don't re-fire every frame
            this.pendingAbilityTarget = null;
            this.pendingAbilitySkill = null;
        }

        return true;
    }
}
