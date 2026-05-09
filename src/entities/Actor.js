import * as THREE from 'three';
import { Entity } from './Entity.js';
import { calculateSetBonuses, getEquippedUniqueEffects, getGemStats, UNIQUE_EFFECTS } from '../core/ItemSystem.js';
import { CONSTANTS } from '../core/Constants.js';

// Optimization: Reusable temporary objects to avoid GC
const TEMP_VEC = new THREE.Vector3();
const TEMP_VEC2 = new THREE.Vector3();
const TEMP_VEC3 = new THREE.Vector3();
const TEMP_QUAT = new THREE.Quaternion();
const UP_VEC = new THREE.Vector3(0, 1, 0);
const ZERO_VEC = new THREE.Vector3(0, 0, 0);

export class Actor extends Entity {
    constructor(id, config) {
        super(id);
        
        // Base Stats
        const baseStats = config.STATS || {
            STRENGTH: 5,
            INTELLIGENCE: 5,
            DEXTERITY: 5,
            WISDOM: 5,
            STAMINA: 5
        };

        let manaStatName = config.MANA_STAT || 'INTELLIGENCE';
        
        // Ensure we can find the value in baseStats
        let manaStatValue = baseStats[manaStatName];
        
        if (manaStatValue === undefined) {
            // Try finding it with different casing
            const upper = manaStatName.toUpperCase();
            if (baseStats[upper] !== undefined) {
                manaStatName = upper;
                manaStatValue = baseStats[upper];
            } else {
                console.warn(`Mana stat ${manaStatName} not found in baseStats. Defaulting to INTELLIGENCE.`);
                manaStatName = 'INTELLIGENCE';
                manaStatValue = baseStats.INTELLIGENCE || 5;
            }
        }

        this.manaStatName = manaStatName.toLowerCase(); // Store as lowercase for property access in this.stats

        // Base Stats (Permanent)
        this.baseStats = {
            strength: baseStats.STRENGTH,
            intelligence: baseStats.INTELLIGENCE,
            dexterity: baseStats.DEXTERITY,
            wisdom: baseStats.WISDOM,
            vitality: baseStats.STAMINA
        };

        // Derived Stats (Total)
        this.stats = {
            ...this.baseStats,
            maxHp: this.baseStats.vitality * 10,
            hp: this.baseStats.vitality * 10,
            maxMana: this.baseStats.intelligence * 10,
            mana: this.baseStats.intelligence * 10,
            speed: 3 + (this.baseStats.dexterity * 0.5),
            damage: this.baseStats.strength * 2,
            defense: 0,
            hpRegen: this.baseStats.vitality * 0.5,
            manaRegen: this.baseStats.wisdom * 0.5,
            attackSpeed: 1 + (this.baseStats.dexterity / 5) * 0.05,
            cooldownReduction: Math.min(0.5, this.baseStats.intelligence * 0.01),
            manaCostReduction: 0, 
            castSpeed: 1 + (this.baseStats.wisdom / 5) * 0.01,
            critChanceBonus: 0,
            poisonDamageBonus: 0,
            fireDamageBonus: 0,
            healingDoneBonus: 0,
            holyDamageBonus: 0,
            lifestealBonus: 0,
            allResistBonus: 0
        };

        // Progression
        this.level = 1;
        this.xp = 0;
        this.xpToNextLevel = 100;
        this.statPoints = 0;
        
        this.regenTimer = 0; // Accumulator for regeneration
        
        // Ability State
        this.abilityCooldown = 0;
        this.abilityMaxCooldown = 0;
        this.abilityManaCost = 0;
        this.abilityName = "Unknown";
        this.abilityDescription = "No ability";

        this.lastAttackTime = 0; // For melee attack speed limit
        this.attackTimer = null;
        this.stunTimer = 0; // Time remaining for stun
        this.guardianRoarTimer = 0; // Guardian Roar Buff
        this.guardianRoarReduction = 0;
        this.slowTimer = 0;
        this.slowFactor = 0;
        this.lastStandTimer = 0; // Last Stand Rampage Buff
        this.lastStandDamageBoost = 0;
        this.berserkerEdgeActive = false; // Passive check

        // Cleric Buffs/Debuffs
        this.blessingResolveTimer = 0;
        this.blessingResolveReduction = 0;
        this.divineInterventionTimer = 0; // Display-only authoritative rescue window
        this.blessingZealTimer = 0;
        this.blessingZealFactor = 0;
        this.markWeaknessTimer = 0;
        this.markWeaknessFactor = 0;

        // Hotbar (Default empty)
        this.hotbar = [null, null, null, null];
        this.unlockedSkills = [];

        // Rogue Debuffs
        this.bleedTimer = 0;
        this.bleedStacks = 0;
        this.bleedTickDamage = 0;
        this.weakPointMarkTimer = 0;
        
        // Rogue Branch C Debuffs
        this.accuracyReductionTimer = 0;
        this.accuracyReductionFactor = 0;
        this.healingReductionTimer = 0;
        this.healingReductionFactor = 0;
        this.rootTimer = 0;
        this.stealthTimer = 0;
        this.poisonTimer = 0;
        this.poisonStacks = 0;
        this.poisonTickDamage = 0;
        this.speedBoostTimer = 0;
        this.speedBoostFactor = 0;

        // Wizard Debuffs/Buffs
        this.frozenTimer = 0; // Stun + Visual
        this.arcaneShieldTimer = 0; // Display-only authoritative shield duration
        this.shieldHP = 0; // Absorbs damage
        this.hasteTimer = 0; // Speed + CDR
        this.hasteFactor = 0;
        this.spellFocusTimer = 0; // Display-only authoritative spell focus duration
        
        // Unique Effect Timers
        this.swiftBuffTimer = 0; // Swift effect: +20% speed for 3s after skill use

        // Hotbar & Skills
        this.hotbar = [null, null, null, null];
        this.unlockedSkills = [];
        this.cooldowns = {}; // Map of skillName -> cooldown timer

        // Passive Talents
        this.talentPoints = 0;
        this.talentRanks = {};

        // Inventory & Equipment
        this.inventory = new Array(25).fill(null); // 25 slots
        this.equipment = {
            head: null,
            chest: null,
            legs: null,
            feet: null,
            gloves: null,
            shoulders: null,
            belt: null,
            ring1: null,
            ring2: null,
            neck: null,
            trinket1: null,
            trinket2: null,
            mainHand: null,
            offHand: null
        };
        
        this.targetPosition = null;
        this.velocity = new THREE.Vector3();
        this.state = 'IDLE'; // IDLE, MOVING, ATTACKING, DEAD
        
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        
        this.radius = 1.25; // Collision radius (matches 2.5 scale width)

        this.isRunning = true; // Default to running (Players run, Enemies walk)
        
        this.gold = 0; // Currency
        this.scaleAnimSpeed = true; // Default to scaling animation speed with movement speed
        this.visualOffset = new THREE.Vector3(); // Visual separation offset
    }

    modifyMesh(mesh) {
        if (this.isElite) {
            mesh.scale.multiplyScalar(2.0);
        }
    }

    setSkillCooldown(skillName, seconds) {
        const cdr = this.stats.cooldownReduction || 0;
        this.cooldowns[skillName] = seconds * (1 - cdr);
    }

    updateBasicEnemyAI(dt, player) {
        if (this.state === 'DEAD') return true;

        if (player && player.state !== 'DEAD') {
            const dist = this.position.distanceTo(player.position);

            if (dist < this.sightRange) {
                if (dist < this.attackRange) {
                    this.attack(player);
                } else {
                    this.move(player.position);
                }
                return true;
            }
        }

        if (this.state === 'IDLE') {
            this.roamTimer -= dt;
            if (this.roamTimer <= 0) {
                this.roamRandomly();
                this.roamTimer = this.roamInterval + Math.random() * 2;
            }
        }

        return false;
    }

    roamRandomly() {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * this.roamRadius;
        const dx = Math.cos(angle) * radius;
        const dz = Math.sin(angle) * radius;

        const target = new THREE.Vector3(
            this.position.x + dx,
            this.position.y,
            this.position.z + dz
        );

        this.move(target);
    }

    setScale(scale) {
        super.setScale(scale);
        if (this.baseRadius === undefined) {
            this.baseRadius = this.radius;
        }
        this.radius = this.baseRadius * scale;
    }

    setMesh(mesh) {
        super.setMesh(mesh);
        
        // Add Hitbox for easier clicking
        // The mesh is scaled by 2.5 in MeshFactory, so a 1x2x1 box becomes 2.5x5x2.5
        const hitGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
        const hitMat = new THREE.MeshBasicMaterial({ 
            visible: true, 
            transparent: true, 
            opacity: 0,
            depthWrite: false
        });
        const hitbox = new THREE.Mesh(hitGeo, hitMat);
        hitbox.position.y = 1.0; // Center vertically (assuming origin at feet)
        hitbox.userData.entityId = this.id;
        mesh.add(hitbox);

        // Setup Animation Mixer if mesh has animations
        if (mesh.userData.animations && mesh.userData.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(mesh);
            
            // Map animations by name (assuming standard naming conventions)
            // You might need to adjust these names based on your actual GLB file
            mesh.userData.animations.forEach(clip => {
                this.animations[clip.name] = this.mixer.clipAction(clip);
            });

            // Initial Animation State
            if (this.state === 'DEAD') {
                if (this.animations['Death']) {
                    const action = this.animations['Death'];
                    action.reset().play();
                    action.setLoop(THREE.LoopOnce);
                    action.clampWhenFinished = true;
                    // Fast forward to end so it appears as a corpse immediately
                    action.time = action.getClip().duration;
                    this.currentAction = action;
                }
            } else if (this.state === 'ATTACKING') {
                this.playAnimation('Attack', false);
            } else if (this.state === 'MOVING') {
                const moveAnim = this.getMovementAnimationName(this.isRunning);
                if (moveAnim) this.playAnimation(moveAnim);
            } else {
                if (this.animations['Idle']) {
                    this.playAnimation('Idle');
                }
            }
        }
    }

    getMovementAnimationName(preferRun = true) {
        if (preferRun && this.animations['Run']) return 'Run';
        if (this.animations['Walk']) return 'Walk';
        if (this.animations['Run']) return 'Run';
        if (this.animations['Idle']) return 'Idle';
        return null;
    }

    playAnimation(name, loop = true, force = false) {
        if (!this.mixer) return;
        
        // Fallback or check if animation exists
        if (!this.animations[name]) {
            // console.warn(`Animation ${name} not found for ${this.id}`);
            return;
        }
        
        const action = this.animations[name];
        if (!force && this.currentAction === action) return;

        if (this.currentAction && this.currentAction !== action) {
            this.currentAction.fadeOut(0.2);
        }

        if (force && this.currentAction === action) {
            action.stop();
        }

        action.reset().fadeIn(0.2).play();
        action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
        action.clampWhenFinished = !loop;
        
        this.currentAction = action;

        // For non-looping Attack animations, set up a callback to return to Idle
        if (!loop && name === 'Attack' && this.state !== 'DEAD') {
            // Clear any existing animation finished handler
            if (this._animFinishedHandler) {
                this.mixer.removeEventListener('finished', this._animFinishedHandler);
                this._animFinishedHandler = null;
            }
            
            const self = this;
            this._animFinishedHandler = function onFinished(e) {
                if (e.action === action) {
                    self.mixer.removeEventListener('finished', onFinished);
                    self._animFinishedHandler = null;
                    // Return to Idle if not dead, not moving, and not in a special ability state
                    if (self.state !== 'DEAD' && self.state !== 'MOVING' && 
                        !self.spiritsActive && !self.isWhirlwinding && !self.isCharging) {
                        self.state = 'IDLE';
                        self.playAnimation('Idle');
                    }
                }
            };
            this.mixer.addEventListener('finished', this._animFinishedHandler);
        }
    }

    move(targetVector) {
        if (this.state === 'DEAD') return;
        this.targetPosition = targetVector.clone();
        
        // Only trigger animation if changing state
        if (this.state !== 'MOVING') {
            this.state = 'MOVING';
            const moveAnim = this.getMovementAnimationName(this.isRunning);
            if (moveAnim) this.playAnimation(moveAnim);
        }
    }

    playJumpAnimation(jumpState = null) {
        const duration = Math.max(0.001, Number.isFinite(jumpState?.duration) ? jumpState.duration : 0.8);
        const walkAction = this.animations?.Walk;
        if (!walkAction) {
            if (this.animations?.Jump) {
                this.playAnimation('Jump', false, true);
                const clipDuration = this.currentAction?.getClip?.()?.duration || duration;
                const timeScale = Math.max(0.01, clipDuration / duration);
                this.currentAction?.setEffectiveTimeScale?.(timeScale);
                this.jumpAnimationRestore = {
                    name: 'Jump',
                    timeScale
                };
                this.syncJumpAnimationToVisualState(jumpState);
                return true;
            }
            return false;
        }

        this.playAnimation('Walk', false, true);
        const clipDuration = this.currentAction?.getClip?.()?.duration || duration;
        const timeScale = Math.max(0.01, clipDuration / duration);
        this.currentAction?.setEffectiveTimeScale?.(timeScale);
        this.jumpAnimationRestore = {
            name: 'Walk',
            timeScale
        };
        this.syncJumpAnimationToVisualState(jumpState);
        return true;
    }

    syncJumpAnimationToVisualState(jumpState = this.jumpVisualState) {
        if (!this.currentAction?.getClip || !jumpState) return false;

        const duration = Math.max(0.001, Number.isFinite(jumpState.duration) ? jumpState.duration : 0.8);
        const progress = Number.isFinite(jumpState.visualProgress)
            ? jumpState.visualProgress
            : (Number.isFinite(jumpState.progress)
                ? jumpState.progress
                : (Number.isFinite(jumpState.elapsed) ? jumpState.elapsed / duration : 0));
        const clipDuration = this.currentAction.getClip()?.duration || duration;
        const clampedProgress = Math.max(0, Math.min(1, progress));
        this.currentAction.time = Math.min(clipDuration, Math.max(0, clipDuration * clampedProgress));
        return true;
    }

    clearJumpAnimation() {
        if (!this.jumpAnimationRestore) {
            return;
        }

        if (this.currentAction?.setEffectiveTimeScale) {
            this.currentAction.setEffectiveTimeScale(1.0);
        }
        this.jumpAnimationRestore = null;
    }

    useAbility(targetVector, gameEngine, skillNameOverride = null) {
        // Base implementation checks costs
        if (this.state === 'DEAD' || this.stunTimer > 0) return false;
        
        // Bypass checks for remote entities (visual only)
        if (this.isRemote) {
            return true;
        }

        const skillName = skillNameOverride || this.abilityName;
        const className = this.meshType || this.subType || this.constructor.name;
        const classAbilityConfig = CONSTANTS.ABILITY_CONFIG ? CONSTANTS.ABILITY_CONFIG[className] : null;
        const defaultAbilityConfig = classAbilityConfig ? classAbilityConfig.default : null;
        const skillAbilityConfig = (classAbilityConfig && classAbilityConfig.skills && skillName) ? classAbilityConfig.skills[skillName] : null;
        const manaCostBase = (skillAbilityConfig && typeof skillAbilityConfig.mana === 'number')
            ? skillAbilityConfig.mana
            : (defaultAbilityConfig && typeof defaultAbilityConfig.mana === 'number')
                ? defaultAbilityConfig.mana
                : this.abilityManaCost;
        const cooldownBase = (skillAbilityConfig && typeof skillAbilityConfig.cooldown === 'number')
            ? skillAbilityConfig.cooldown
            : (defaultAbilityConfig && typeof defaultAbilityConfig.cooldown === 'number')
                ? defaultAbilityConfig.cooldown
                : this.abilityMaxCooldown;

        // Check specific cooldown
        if (this.cooldowns[skillName] > 0) {
            console.log(`Skill ${skillName} on cooldown: ${this.cooldowns[skillName].toFixed(1)}s`);
            return false;
        }

        // Fallback to global cooldown if no specific skill name (legacy)
        if (!skillNameOverride && this.abilityCooldown > 0) {
            console.log("Ability on cooldown");
            return false;
        }
        
        // Apply Mana Cost Reduction
        const cost = manaCostBase * (1 - (this.stats.manaCostReduction || 0));
        
        if (this.stats.mana < cost) {
            console.log("Not enough mana");
            return false;
        }

        this.stats.mana -= cost;
        
        // Apply Cooldown Reduction
        const cdr = this.stats.cooldownReduction || 0;
        const maxCd = cooldownBase * (1 - cdr);
        
        // Set Cooldown
        if (skillName) {
            this.cooldowns[skillName] = maxCd;
        }
        
        // Also set global cooldown for legacy support / base ability
        if (!skillNameOverride) {
            this.abilityCooldown = maxCd;
        }
        
        // Unique Effect: Swift - +20% move speed for 3s after using a skill
        if (this.hasSwiftEffect) {
            this.swiftBuffTimer = 3.0; // 3 seconds duration
            console.log(`${this.id} Swift effect triggered! +20% move speed for 3s`);
        }
        
        // Subclasses implement actual logic
        return true;
    }

    useSkill(skillName, targetVector, gameEngine) {
        // Default implementation: just use the base ability
        // In the future, this should switch on skillName
        console.log(`Using skill: ${skillName}`);
        return this.useAbility(targetVector, gameEngine, skillName);
    }

    updateState(newState) {
        if (this.isRemote) {
            if (newState === 'ATTACKING') {
                if (this.state !== 'ATTACKING') {
                    this.setAttackingState(true);
                }
            } else if (newState === 'DEAD') {
                this.die();
            } else {
                if (this.attackTimer) {
                    clearTimeout(this.attackTimer);
                    this.attackTimer = null;
                }
                if (this.state === 'ATTACKING' && this.currentAction) {
                    this.currentAction.setEffectiveTimeScale(1.0);
                }
                this.state = newState;
            }
        } else {
            this.state = newState;
        }
    }

    update(dt, collisionManager, player, activeEntities) {
        super.update(dt);

        // Stun Logic
        if (this.stunTimer > 0) {
            this.stunTimer -= dt;
            if (this.stunTimer <= 0) {
                this.stunTimer = 0;
                // Resume Idle if not dead
                if (this.state !== 'DEAD') {
                    this.state = 'IDLE';
                    this.playAnimation('Idle');
                }
            } else {
                // While stunned, ensure state is STUNNED or IDLE and don't move
                if (this.state !== 'DEAD') {
                    // Optional: Play stun animation if available
                    // this.playAnimation('Stun'); 
                    return; // Skip movement and other updates
                }
            }
        }

        // Guardian Roar Buff Logic
        if (this.guardianRoarTimer > 0) {
            this.guardianRoarTimer -= dt;
            if (this.guardianRoarTimer <= 0) {
                this.guardianRoarTimer = 0;
            }
        }

        // Slow Logic
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) {
                this.slowTimer = 0;
                this.slowFactor = 0;
            }
        }

        // Last Stand Logic
        if (this.lastStandTimer > 0) {
            this.lastStandTimer -= dt;
            if (this.lastStandTimer <= 0) {
                this.lastStandTimer = 0;
                this.lastStandDamageBoost = 0;
            }
        }

        // Cleric Buffs/Debuffs Logic
        if (this.blessingResolveTimer > 0) {
            this.blessingResolveTimer -= dt;
            if (this.blessingResolveTimer <= 0) {
                this.blessingResolveTimer = 0;
                this.blessingResolveReduction = 0;
            }
        }
        if (this.divineInterventionTimer > 0) {
            this.divineInterventionTimer -= dt;
            if (this.divineInterventionTimer <= 0) {
                this.divineInterventionTimer = 0;
            }
        }
        if (this.blessingZealTimer > 0) {
            this.blessingZealTimer -= dt;
            if (this.blessingZealTimer <= 0) {
                this.blessingZealTimer = 0;
                this.blessingZealFactor = 0;
            }
        }
        if (this.markWeaknessTimer > 0) {
            this.markWeaknessTimer -= dt;
            if (this.markWeaknessTimer <= 0) {
                this.markWeaknessTimer = 0;
                this.markWeaknessFactor = 0;
            }
        }

        // Rogue Debuffs Logic
        if (this.weakPointMarkTimer > 0) {
            this.weakPointMarkTimer -= dt;
            if (this.weakPointMarkTimer <= 0) {
                this.weakPointMarkTimer = 0;
            }
        }
        if (this.bleedTimer > 0) {
            this.bleedTimer -= dt;
            
            // Bleed Tick (every 1s)
            if (!this.bleedTickTimer) this.bleedTickTimer = 0;
            this.bleedTickTimer += dt;
            if (this.bleedTickTimer >= 1.0) {
                this.bleedTickTimer -= 1.0;
                const bleedDmg = this.bleedTickDamage > 0 ? this.bleedTickDamage : 5 * this.bleedStacks;
                this.takeDamage(bleedDmg);
                // Visual
                // if (floatingTextManager) floatingTextManager.spawn(bleedDmg, this.position, '#ff0000');
            }

            if (this.bleedTimer <= 0) {
                this.bleedTimer = 0;
                this.bleedStacks = 0;
                this.bleedTickDamage = 0;
            }
        }

        // Rogue Branch C Logic
        if (this.accuracyReductionTimer > 0) this.accuracyReductionTimer -= dt;
        if (this.healingReductionTimer > 0) this.healingReductionTimer -= dt;
        if (this.rootTimer > 0) this.rootTimer -= dt;
        if (this.speedBoostTimer > 0) {
            this.speedBoostTimer -= dt;
            if (this.speedBoostTimer <= 0) {
                this.speedBoostTimer = 0;
                this.speedBoostFactor = 0;
            }
        }
        
        if (this.stealthTimer > 0) {
            this.stealthTimer -= dt;
            if (this.mesh) {
                this.mesh.traverse(child => {
                    if (child.isMesh) {
                        child.material.transparent = true;
                        child.material.opacity = 0.3;
                    }
                });
            }
            if (this.stealthTimer <= 0) {
                // Restore opacity
                if (this.mesh) {
                    this.mesh.traverse(child => {
                        if (child.isMesh) {
                            child.material.opacity = 1.0;
                        }
                    });
                }
            }
        }

        if (this.poisonTimer > 0) {
            this.poisonTimer -= dt;
            
            // Poison Tick (every 1s)
            if (!this.poisonTickTimer) this.poisonTickTimer = 0;
            this.poisonTickTimer += dt;
            if (this.poisonTickTimer >= 1.0) {
                this.poisonTickTimer -= 1.0;
                const poisonDmg = this.poisonTickDamage > 0 ? this.poisonTickDamage : 3 * this.poisonStacks; // Lower base dmg than bleed but reduces healing
                this.takeDamage(poisonDmg);
                // Visual
                // if (floatingTextManager) floatingTextManager.spawn(poisonDmg, this.position, '#00ff00');
            }

            if (this.poisonTimer <= 0) {
                this.poisonTimer = 0;
                this.poisonStacks = 0;
                this.poisonTickDamage = 0;
            }
        }

        // Wizard Control Logic
        if (this.frozenTimer > 0) {
            this.frozenTimer -= dt;
            // Visual: Turn blue
            if (this.mesh) {
                this.mesh.traverse(child => {
                    if (child.isMesh && child.material) {
                        if (!child.userData.originalColor) child.userData.originalColor = child.material.color.getHex();
                        child.material.color.setHex(0x00ffff);
                    }
                });
            }
            if (this.frozenTimer <= 0) {
                // Restore color
                if (this.mesh) {
                    this.mesh.traverse(child => {
                        if (child.isMesh && child.material && child.userData.originalColor !== undefined) {
                            child.material.color.setHex(child.userData.originalColor);
                        }
                    });
                }
            }
        }
        
        if (this.hasteTimer > 0) {
            this.hasteTimer -= dt;
            if (this.hasteTimer <= 0) {
                this.hasteFactor = 0;
            }
        }

        if (this.spellFocusTimer > 0) {
            this.spellFocusTimer -= dt;
            if (this.spellFocusTimer <= 0) {
                this.spellFocusTimer = 0;
            }
        }

        if (this.arcaneShieldTimer > 0) {
            this.arcaneShieldTimer -= dt;
            if (this.arcaneShieldTimer <= 0) {
                this.arcaneShieldTimer = 0;
            }
        }
        
        // Swift unique effect timer
        if (this.swiftBuffTimer > 0) {
            this.swiftBuffTimer -= dt;
        }

        if (this.isRemote) {
            // Interpolate Position
            let movedDistance = 0;
            if (this.targetServerPosition) {
                const lerpFactor = Math.min(1, Math.max(0, 10.0 * dt));
                TEMP_VEC.copy(this.position); // Save old pos
                this.position.lerp(this.targetServerPosition, lerpFactor);
                movedDistance = this.position.distanceTo(TEMP_VEC);
                
                // Snap if very close to avoid micro-jitter
                if (this.position.distanceTo(this.targetServerPosition) < 0.05) {
                    this.position.copy(this.targetServerPosition);
                }
            }

            // Interpolate Rotation
            if (this.targetServerRotation !== undefined) {
                TEMP_QUAT.setFromAxisAngle(UP_VEC, this.targetServerRotation);
                this.rotation.slerp(TEMP_QUAT, Math.min(1, Math.max(0, 10.0 * dt)));
            } else if (movedDistance > 0.001) {
                // Fallback: Face movement direction if no server rotation provided
                // This ensures entities don't slide sideways if the server omits rotation
                // Use TEMP_VEC to calculate look target without cloning
                TEMP_VEC.copy(this.targetServerPosition).sub(this.position).add(this.position);
                TEMP_VEC.y = this.position.y;
                
                if (this.mesh) {
                    this.mesh.lookAt(TEMP_VEC);
                    this.rotation.copy(this.mesh.quaternion);
                }
            }

            // Apply Entity Separation (Visual De-stacking)
            // Decay offset
            this.visualOffset.lerp(ZERO_VEC, 2.0 * dt);

            // Note: activeEntities parameter is now actually chunkManager
            if (collisionManager && activeEntities) {
                // If this is a remote entity, ignore the local player for separation
                // to prevent fighting with server position updates (chasing).
                const ignore = this.isRemote ? player : null;
                const separation = collisionManager.checkEntityCollision(this, activeEntities, ignore);
                if (separation) {
                    // Separation is purely visual. Near the local player, we keep the "spread out" look
                    // but avoid pushing enemies *away* from the player (which makes melee hits look wrong).
                    if (player && player.position) {
                        const rx = this.position.x - player.position.x;
                        const rz = this.position.z - player.position.z;
                        const distSq = rx * rx + rz * rz;
                        let offsetStrength = 7.5;
                        let maxVisualOffset = 2.0;

                        // Apply only when near the player (combat cluster).
                        if (distSq < 9.0 * 9.0 && distSq > 0.0001) {
                            offsetStrength = 3.0;
                            maxVisualOffset = 0.6;
                            const invLen = 1.0 / Math.sqrt(distSq);
                            const ux = rx * invLen;
                            const uz = rz * invLen;

                            // Reduce outward radial component (dot > 0 means pushing farther from player).
                            // Keep a small amount so enemies can still "make room" instead of stacking,
                            // but avoid large visual gaps where melee hits look out-of-range.
                            const dot = separation.x * ux + separation.z * uz;
                            if (dot > 0) {
                                separation.x -= ux * dot * 0.75;
                                separation.z -= uz * dot * 0.75;
                            }
                        }

                        // Add to visual offset instead of position to avoid fighting Lerp
                        this.visualOffset.add(separation.multiplyScalar(offsetStrength * dt));
                        // Clamp to avoid extreme offsets
                        if (this.visualOffset.length() > maxVisualOffset) {
                            this.visualOffset.setLength(maxVisualOffset);
                        }
                    } else {
                        this.visualOffset.add(separation.multiplyScalar(7.5 * dt));
                        if (this.visualOffset.length() > 2.0) {
                            this.visualOffset.setLength(2.0);
                        }
                    }
                }
            }

            // Update Mesh
            if (this.mesh) {
                // Combine logical position (Server) with visual offset (Client Separation)
                this.mesh.position.copy(this.position).add(this.visualOffset);
                this.mesh.quaternion.copy(this.rotation);
            }

            // Animation Logic (Remote)
            if (this.state === 'DEAD') {
                // Ensure death animation is playing/played
                if (this.currentAction !== this.animations['Death'] && this.animations['Death']) {
                    this.playAnimation('Death', false);
                }
            } else if (this.state === 'JUMPING') {
                if (!this.jumpAnimationRestore) {
                    this.playJumpAnimation(this.jumpVisualState);
                } else {
                    this.syncJumpAnimationToVisualState(this.jumpVisualState);
                }
            } else if (this.isCharging) {
                const moveAnim = this.getMovementAnimationName(true);
                if (moveAnim) this.playAnimation(moveAnim);
            } else if (this.state === 'ATTACKING') {
                this.playAnimation('Attack', false);
                // Scale animation speed for remote entities
                if (this.currentAction && this.stats.attackSpeed) {
                    const cooldown = this.stats.attackSpeed;
                    const clipDuration = this.currentAction.getClip().duration;

                    // Play slightly faster (90% of cooldown) to ensure it finishes before server state reset
                    // For RootboundWarden, play even faster (70%) to align hit with server damage (35%)
                    let speedFactor = 0.9;
                    if (this.type === 'RootboundWarden') {
                        speedFactor = 0.7;
                    }

                    const timeScale = clipDuration / (cooldown * speedFactor);
                    this.currentAction.setEffectiveTimeScale(timeScale);
                }
            } else if (this.state === 'MOVING') {
                const moveAnim = this.getMovementAnimationName(this.isRunning);
                if (moveAnim) this.playAnimation(moveAnim);
            } else {
                this.playAnimation('Idle');
            }

            if (this.mixer) {
                this.mixer.update(dt);
            }
            return;
        }
        
        // Cooldowns
        if (this.abilityCooldown > 0) {
            this.abilityCooldown -= dt;
        }

        // Update per-skill cooldowns
        for (const skill in this.cooldowns) {
            if (this.cooldowns[skill] > 0) {
                this.cooldowns[skill] -= dt;
                if (this.cooldowns[skill] < 0) this.cooldowns[skill] = 0;
            }
        }

        // Regeneration Logic (1 second tick)
        if (this.state !== 'DEAD' && !this.isMultiplayer && !this.isRemote) {
            this.regenTimer += dt;
            if (this.regenTimer >= 1.0) {
                this.regenTimer -= 1.0;
                
                // Regenerate HP
                if (this.stats.hp < this.stats.maxHp) {
                    let regenAmount = this.stats.hpRegen;
                    if (this.healingReductionTimer > 0) {
                        regenAmount *= (1 - this.healingReductionFactor);
                    }
                    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + regenAmount);
                }
                
                // Regenerate Mana
                if (this.stats.mana < this.stats.maxMana) {
                    this.stats.mana = Math.min(this.stats.maxMana, this.stats.mana + this.stats.manaRegen);
                }
            }
        }

        if (this.mixer) {
            this.mixer.update(dt);
        }
        
        if (this.state === 'MOVING' && this.targetPosition) {
            // Root/Freeze Check
            if (this.rootTimer > 0 || this.frozenTimer > 0) {
                this.state = 'IDLE';
                this.velocity.set(0, 0, 0);
                this.playAnimation('Idle');
                return;
            }

            // Use temp vector for direction calculation to avoid allocation
            TEMP_VEC2.subVectors(this.targetPosition, this.position);
            const distance = TEMP_VEC2.length();
            
            if (distance < 0.1) {
                this.position.copy(this.targetPosition);
                this.targetPosition = null;
                this.state = 'IDLE';
                this.velocity.set(0, 0, 0);
                this.playAnimation('Idle');
                if (this.currentAction) this.currentAction.setEffectiveTimeScale(1.0); // Reset speed for Idle
            } else {
                TEMP_VEC2.normalize();
                
                // Determine Speed
                let currentSpeed = this.stats.speed;
                if (!this.isRunning) {
                    currentSpeed *= 0.5; // Walk speed is half (for enemies)
                }
                
                // Apply Slow
                if (this.slowTimer > 0) {
                    currentSpeed *= (1 - this.slowFactor);
                }

                // Apply Speed Boost
                if (this.speedBoostTimer > 0) {
                    currentSpeed *= (1 + this.speedBoostFactor);
                }

                let moveDist = currentSpeed * dt;
                // Prevent overshoot (Fix for high speed jitter)
                if (moveDist > distance) {
                    moveDist = distance;
                }

                this.velocity.copy(TEMP_VEC2).multiplyScalar(moveDist);
                
                // Proposed new position - use temp vector
                TEMP_VEC3.copy(this.position).add(this.velocity);
                
                // Check Collision
                if (collisionManager) {
                    // 1. Static World Collision
                    const correctedPos = collisionManager.checkCollision(TEMP_VEC3, this.radius, this.position); 
                    if (correctedPos) {
                        this.position.copy(correctedPos);
                    } else {
                        this.position.copy(TEMP_VEC3);
                    }

                    // 2. Dynamic Entity Collision (Separation)
                    if (activeEntities) {
                        const separation = collisionManager.checkEntityCollision(this, activeEntities);
                        if (separation) {
                            // Apply separation force
                            // We add it to the position directly. 
                            // Since we are moving every frame, this acts as a sliding force.
                            this.position.add(separation.multiplyScalar(0.5));
                            
                            // Re-check static collision to ensure we didn't get pushed into a wall
                            const finalCheck = collisionManager.checkCollision(this.position, this.radius, this.position);
                            if (finalCheck) {
                                this.position.copy(finalCheck);
                            }
                        }
                    }
                } else {
                    this.position.copy(TEMP_VEC3);
                }

                // Ground Clamp: Ensure we never go below ground
                if (this.position.y < 0) {
                    this.position.y = 0;
                }
                
                // Rotate to face movement - use temp vector instead of allocating
                TEMP_VEC.set(this.targetPosition.x, this.position.y, this.targetPosition.z);
                if (this.mesh) {
                    this.mesh.lookAt(TEMP_VEC);
                    this.rotation.copy(this.mesh.quaternion);
                }
                
                // Update Animation Speed based on movement type
                const moveAnim = this.getMovementAnimationName(this.isRunning);
                if (moveAnim) this.playAnimation(moveAnim);

                // Scale animation speed with movement speed
                if (this.currentAction && this.scaleAnimSpeed) {
                    // Base speed is ~3.0. If speed is 6.0, anim plays 2x faster.
                    const animSpeed = Math.max(1.0, currentSpeed / 3.0); 
                    this.currentAction.setEffectiveTimeScale(animSpeed);
                }
            }
        }
    }

    cleanse() {
        this.stunTimer = 0;
        this.slowTimer = 0;
        this.slowFactor = 0;
        this.markWeaknessTimer = 0;
        this.markWeaknessFactor = 0;
        this.bleedTimer = 0;
        this.bleedStacks = 0;
        this.bleedTickDamage = 0;
        this.weakPointMarkTimer = 0;
        // Add other debuffs here if they exist (poison, bleed, etc.)
        console.log(`${this.id} was cleansed!`);
    }

    takeDamage(amount, attacker = null) {
        if (this.state === 'DEAD' || this.isMultiplayer || this.isRemote) return;
        
        let finalAmount = amount;
        
        // Damage Reductions (Buffs)
        if (this.guardianRoarTimer > 0) {
            finalAmount *= (1 - this.guardianRoarReduction);
        }
        if (this.blessingResolveTimer > 0) {
            finalAmount *= (1 - this.blessingResolveReduction);
        }

        // Damage Increases (Debuffs)
        if (this.markWeaknessTimer > 0) {
            finalAmount *= (1 + this.markWeaknessFactor);
        }
        
        // Shield Absorption
        if (this.shieldHP > 0) {
            const absorbed = Math.min(this.shieldHP, finalAmount);
            this.shieldHP -= absorbed;
            finalAmount -= absorbed;
            console.log(`${this.id} shield absorbed ${absorbed}. Remaining Shield: ${this.shieldHP}`);
            if (finalAmount <= 0) return; // Fully absorbed
        }
        
        // Divine Intervention Check
        if (this.divineInterventionActive && (this.stats.hp - finalAmount <= 0)) {
            this.stats.hp = this.stats.maxHp * 0.30; // Heal to 30%
            this.divineInterventionActive = false;
            this.divineInterventionTimer = 0;
            console.log(`${this.id} was saved by Divine Intervention!`);
            return; 
        }

        this.stats.hp -= finalAmount;
        console.log(`${this.id} took ${finalAmount} damage (was ${amount}). HP: ${this.stats.hp}`);
        
        // Thorns unique effect - reflect 10% damage back to attacker
        if (this.hasThornsEffect && attacker && attacker.stats && attacker !== this) {
            const reflectDamage = Math.floor(finalAmount * 0.1);
            if (reflectDamage > 0) {
                console.log(`${this.id} reflects ${reflectDamage} damage to ${attacker.id} (Thorns)`);
                attacker.takeDamage(reflectDamage, null); // null to prevent infinite loop
            }
        }
        
        if (this.stats.hp <= 0) {
            // Trigger onKill effects for the attacker before dying
            if (attacker && attacker !== this) {
                this.triggerOnKillEffects(attacker);
            }
            this.die();
        }
    }
    
    // Called when this entity is killed by an attacker
    triggerOnKillEffects(killer) {
        if (!killer) return;
        
        // Vampiric effect - restore 5% HP on kill
        if (killer.hasVampiricEffect) {
            const healAmount = Math.floor(killer.stats.maxHp * 0.05);
            killer.stats.hp = Math.min(killer.stats.maxHp, killer.stats.hp + healAmount);
            console.log(`${killer.id} healed ${healAmount} HP from Vampiric effect`);
        }
        
        // Explosive effect - dealt via callback if set (GameEngine sets this)
        // This needs access to nearby entities, so we use a callback pattern
        if (killer.hasExplosiveEffect && this.onExplosiveDeath) {
            const explosionDamage = Math.floor(killer.stats.damage * 0.5);
            this.onExplosiveDeath(this.position, explosionDamage, killer);
            console.log(`${this.id} exploded for ${explosionDamage} damage (Explosive effect)`);
        }
    }

    die() {
        if (this.state === 'DEAD') return;
        this.state = 'DEAD';
        this.targetPosition = null;
        if (this.attackTimer) {
            clearTimeout(this.attackTimer);
            this.attackTimer = null;
        }
        this.playAnimation('Death', false); 
        // timeSinceDeath is managed by GameEngine
        this.cancelAbilities();
        // Do not set isActive = false, so animation plays
    }

    cancelAbilities() {
        // Override in subclasses
    }

    getAttackHitDelay() {
        let cooldown = this.stats.attackSpeed || 1.0;
        if (this.hasteTimer > 0) {
            cooldown /= (1 + this.hasteFactor);
        }
        return (cooldown * 1000) * 0.35; // 35% through animation
    }

    attack(target, onHit = null) {
        if (this.state === 'DEAD') return false;
        if (target && target.state === 'DEAD') return false; // Don't attack dead targets
        
        // Frozen Check
        if (this.frozenTimer > 0) return false;

        // Accuracy Check (Blindness)
        if (this.accuracyReductionTimer > 0) {
            if (Math.random() < this.accuracyReductionFactor) {
                console.log(`${this.id} missed due to blindness!`);
                // Trigger cooldown anyway to prevent spamming until hit
                this.lastAttackTime = Date.now();
                return false;
            }
        }

        // Attack Speed Check
        const now = Date.now();
        let cooldownMs = this.stats.attackSpeed * 1000;
        
        // Apply Attack Speed Buffs
        if (this.blessingZealTimer > 0) {
            cooldownMs /= (1 + this.blessingZealFactor);
        }
        if (this.hasteTimer > 0) {
            cooldownMs /= (1 + this.hasteFactor);
        }

        if (now - this.lastAttackTime < cooldownMs) {
            return false;
        }
        this.lastAttackTime = now;
        
        if (this.attackTimer) {
            clearTimeout(this.attackTimer);
            this.attackTimer = null;
        }

        this.state = 'ATTACKING';
        this.playAnimation('Attack', false, true);
        
        // Scale animation speed to match cooldown exactly (Slow attack = Slow animation)
        let effectiveCooldown = cooldownMs / 1000;
        let timeScale = 1.0;
        let clipDuration = 1.0;

        if (this.currentAction) {
            clipDuration = this.currentAction.getClip().duration;
            // Scale to fit cooldown
            timeScale = clipDuration / effectiveCooldown;
            this.currentAction.setEffectiveTimeScale(timeScale);
        }
        
        const duration = cooldownMs;
        // Hit happens at 35% of the animation (which is now exactly the cooldown duration)
        const hitDelay = duration * 0.35;

        // Face target
        const lookTarget = new THREE.Vector3(target.position.x, this.position.y, target.position.z);
        if (this.mesh) {
            this.mesh.lookAt(lookTarget);
            this.rotation.copy(this.mesh.quaternion);
        }

        // Deal damage after a delay
        this.attackTimer = setTimeout(() => {
            if (this.state === 'DEAD') return;

            if (target && target.stats.hp > 0) {
                const baseDmg = this.stats.damage;
                const variance = (Math.random() * 0.4) + 0.8;
                let finalDmg = Math.floor(baseDmg * variance);
                
                // Unique Effect: Berserker - +30% damage when below 30% HP
                if (this.hasBerserkerEffect && this.stats.hp < this.stats.maxHp * 0.3) {
                    finalDmg = Math.floor(finalDmg * 1.3);
                    console.log(`${this.id} Berserker proc! +30% damage`);
                }
                
                // Unique Effect: Executioner - +25% damage to enemies below 25% HP
                if (this.hasExecutionerEffect && target.stats.hp < target.stats.maxHp * 0.25) {
                    finalDmg = Math.floor(finalDmg * 1.25);
                    console.log(`${this.id} Executioner proc! +25% damage to low HP target`);
                }
                
                // Unique Effect: Lucky - 10% chance to deal double damage
                if (this.hasLuckyEffect && Math.random() < 0.1) {
                    finalDmg = Math.floor(finalDmg * 2);
                    console.log(`${this.id} Lucky proc! Double damage!`);
                }
                
                target.takeDamage(finalDmg, this);
                
                if (onHit) onHit(finalDmg, target);
            }
            this.attackTimer = null;
        }, hitDelay);
        
        // Reset state when animation finishes
        setTimeout(() => {
            if (this.state === 'ATTACKING') {
                this.state = 'IDLE';
                this.playAnimation('Idle');
                if (this.currentAction) this.currentAction.setEffectiveTimeScale(1.0);
            }
        }, duration);
        
        return true;
    }

    performSkill(targetVector) {
        if (this.state === 'DEAD') return;
        console.log(`${this.constructor.name} performing skill at`, targetVector);
        this.state = 'ATTACKING';
        this.playAnimation('Attack', false); // Assuming 'Attack' is the animation name
        
        // Rotate to face target
        const lookTarget = new THREE.Vector3(targetVector.x, this.position.y, targetVector.z);
        if (this.mesh) {
            this.mesh.lookAt(lookTarget);
            this.rotation.copy(this.mesh.quaternion);
        }

        // Reset to IDLE after a short delay (placeholder for animation duration)
        // Ideally, we listen for the mixer 'finished' event
        if (this.mixer) {
            const onFinished = (e) => {
                // Ensure we only handle the attack animation finishing
                if (e.action === this.animations['Attack']) {
                    this.mixer.removeEventListener('finished', onFinished); // Cleanup
                    
                    if (this.state === 'ATTACKING') {
                        this.state = 'IDLE';
                        this.playAnimation('Idle');
                    }
                }
            };
            this.mixer.addEventListener('finished', onFinished);
        } else {
             setTimeout(() => {
                if (this.state === 'ATTACKING') this.state = 'IDLE';
            }, 500);
        }
    }

    respawn(x, z) {
        this.position.set(x, 0, z);
        this.stats.hp = this.stats.maxHp;
        this.state = 'IDLE';
        this.isActive = true;
        this.playAnimation('Idle');
        
        // Reset visual rotation if needed
        this.rotation.set(0, 0, 0, 1);
        if (this.mesh) {
            this.mesh.quaternion.copy(this.rotation);
        }
        
        console.log(`${this.id} respawned at ${x}, ${z}`);
    }

    gainXp(amount) {
        if (this.isMultiplayer || this.isRemote) return;
        this.xp += amount;
        console.log(`${this.id} gained ${amount} XP. Total: ${this.xp}/${this.xpToNextLevel}`);
        
        if (this.xp >= this.xpToNextLevel) {
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.xp -= this.xpToNextLevel;
        // Match server exponential curve (1.2)
        this.xpToNextLevel = Math.floor(100 * Math.pow(1.2, this.level - 1));
        
        this.statPoints += 3;
        
        // Recalculate to apply level scaling
        this.recalculateStats();
        
        // Heal on level up
        this.stats.hp = this.stats.maxHp;
        this.stats.mana = this.stats.maxMana;
        
        console.log(`${this.id} leveled up to ${this.level}! Points: ${this.statPoints}`);
    }
    increaseStat(statName) {
        if (this.isMultiplayer || this.isRemote) return false;
        if (this.statPoints > 0 && this.baseStats[statName] !== undefined) {
            this.baseStats[statName]++;
            this.statPoints--;
            this.recalculateStats();
            return true;
        }
        return false;
    }

    recalculateStats() {
        // 1. Start with Base Stats
        // Optimization: Avoid object spread { ...this.baseStats }
        const totalStats = this._tempStats || {
            strength: 0, intelligence: 0, dexterity: 0, wisdom: 0, vitality: 0,
            damage: 0, defense: 0
        };
        this._tempStats = totalStats;
        const bonusStats = {
            critChance: 0,
            poisonDamage: 0,
            fireDamage: 0,
            cdr: 0,
            manaRegen: 0,
            healingDone: 0,
            holyDamage: 0,
            moveSpeed: 0,
            allResist: 0,
            lifesteal: 0
        };

        const applyItemStats = (statsMap) => {
            if (!statsMap) return;

            for (const [stat, value] of Object.entries(statsMap)) {
                if (totalStats[stat] !== undefined) {
                    totalStats[stat] += value;
                } else if (stat === 'damage') {
                    totalStats.damage += value;
                } else if (stat === 'defense') {
                    totalStats.defense += value;
                } else if (bonusStats[stat] !== undefined) {
                    bonusStats[stat] += value;
                }
            }
        };
        
        totalStats.strength = this.baseStats.strength;
        totalStats.intelligence = this.baseStats.intelligence;
        totalStats.dexterity = this.baseStats.dexterity;
        totalStats.wisdom = this.baseStats.wisdom;
        totalStats.vitality = this.baseStats.vitality;
        
        // Initialize derived stats that accumulate
        totalStats.damage = 0;
        totalStats.defense = 0;

        // Add Equipment Stats
        for (const slot in this.equipment) {
            const item = this.equipment[slot];
            if (item) {
                applyItemStats(item.stats);

                // Add socketed gem stats
                if (item.gems && Array.isArray(item.gems)) {
                    for (const gem of item.gems) {
                        if (gem) applyItemStats(gem.stats);
                    }
                }
            }
        }

        // Calculate Set Bonuses
        this.activeSetBonuses = calculateSetBonuses(this.equipment);
        for (const setId in this.activeSetBonuses) {
            const setBonus = this.activeSetBonuses[setId];
            if (setBonus.stats) {
                for (const stat in setBonus.stats) {
                    // Handle percentage-based bonuses
                    if (stat === 'maxHealth') {
                        // Applied later as percentage
                    } else if (stat === 'armor') {
                        totalStats.defense += setBonus.stats[stat];
                    } else if (bonusStats[stat] !== undefined) {
                        bonusStats[stat] += setBonus.stats[stat];
                    } else if (totalStats[stat] !== undefined) {
                        totalStats[stat] += setBonus.stats[stat];
                    }
                }
            }
        }

        // Get Unique Effects from equipment
        this.activeUniqueEffects = getEquippedUniqueEffects(this.equipment);

        // Update Total Stats in this.stats
        this.stats.strength = totalStats.strength;
        this.stats.dexterity = totalStats.dexterity;
        this.stats.intelligence = totalStats.intelligence;
        this.stats.wisdom = totalStats.wisdom;
        this.stats.vitality = totalStats.vitality;

        // 2. Recalculate derived stats based on Total Attributes
        const levelBonus = (this.level - 1) * 5; 
        
        // Vit: Increase health and health regen
        let baseMaxHp = (totalStats.vitality * 10) + levelBonus;
        
        // Apply maxHealth percentage bonus from set bonuses
        for (const setId in this.activeSetBonuses) {
            const setBonus = this.activeSetBonuses[setId];
            if (setBonus.stats && setBonus.stats.maxHealth) {
                baseMaxHp = Math.floor(baseMaxHp * (1 + setBonus.stats.maxHealth / 100));
            }
        }
        
        this.stats.maxHp = baseMaxHp;
        this.stats.hpRegen = totalStats.vitality * 0.5;
        
        // Apply regenerative unique effect
        if (this.activeUniqueEffects) {
            for (const effect of this.activeUniqueEffects) {
                if (effect.id === 'regenerative') {
                    this.stats.hpRegen += this.stats.maxHp * 0.01; // +1% HP regen per second
                }
            }
        }

        // Int: Increase max mana and reduces ability cooldown (up to 50% max)
        this.stats.maxMana = (totalStats.intelligence * 10) + levelBonus;
        this.stats.cooldownReduction = Math.min(0.5, (totalStats.intelligence * 0.01) + (bonusStats.cdr / 100));

        // Strength: Melee damage increase
        // Base Damage from Stats + Weapon Damage
        this.stats.damage = (totalStats.strength * 2) + totalStats.damage;
        
        // Apply berserker unique effect (checked during combat, but flag here)
        this.hasBerserkerEffect = false;
        this.hasGuardianEffect = false;
        this.hasExecutionerEffect = false;
        this.hasLuckyEffect = false;
        this.hasEfficientEffect = false;
        this.hasSwiftEffect = false;
        this.hasThornsEffect = false;
        this.hasVampiricEffect = false;
        this.hasExplosiveEffect = false;
        
        if (this.activeUniqueEffects) {
            for (const effect of this.activeUniqueEffects) {
                if (effect.id === 'berserker') this.hasBerserkerEffect = true;
                if (effect.id === 'guardian') this.hasGuardianEffect = true;
                if (effect.id === 'executioner') this.hasExecutionerEffect = true;
                if (effect.id === 'lucky') this.hasLuckyEffect = true;
                if (effect.id === 'efficient') this.hasEfficientEffect = true;
                if (effect.id === 'swift') this.hasSwiftEffect = true;
                if (effect.id === 'thorns') this.hasThornsEffect = true;
                if (effect.id === 'vampiric') this.hasVampiricEffect = true;
                if (effect.id === 'explosive') this.hasExplosiveEffect = true;
            }
        }

        // Defense
        this.stats.defense = totalStats.defense;
        if (bonusStats.allResist > 0) {
            this.stats.defense = Math.floor(this.stats.defense * (1 + (bonusStats.allResist / 100)));
        }
        
        // Apply guardian effect if above 80% HP
        if (this.hasGuardianEffect && this.stats.hp > this.stats.maxHp * 0.8) {
            this.stats.defense = Math.floor(this.stats.defense * 1.2); // +20% armor
        }

        // Dex: Movement speed and melee attack speed
        // Cap movement speed at 300% of base movement (derived from base stats)
        
        // Calculate Speed
        this.stats.speed = (3 + (totalStats.dexterity * 0.5)) * 1.2;
        if (bonusStats.moveSpeed > 0) {
            this.stats.speed *= (1 + (bonusStats.moveSpeed / 100));
        }
        
        // Haste Buff
        if (this.hasteTimer > 0) {
            this.stats.speed *= (1 + this.hasteFactor);
            this.stats.cooldownReduction = Math.min(0.8, this.stats.cooldownReduction + 0.2); // +20% CDR
        }
        
        // Swift Unique Effect - +20% move speed for 3s after skill use
        if (this.swiftBuffTimer > 0) {
            this.stats.speed *= 1.2;
        }

        // Cap Speed (Max = 3x Speed at 10 Dex)
        const refDex = 10;
        const refSpeed = (3 + (refDex * 0.5)) * 1.2; // ~9.6
        const maxSpeed = refSpeed * 3.0; // ~28.8

        if (this.stats.speed > maxSpeed) {
            this.stats.speed = maxSpeed;
        }

        // Attack Speed (Seconds Per Attack)
        // Base 5.0s, scales down with Dex, min 1.0s
        const speedMult = 1.0 + (totalStats.dexterity * 0.02);
        let cooldown = 5.0 / speedMult;
        if (cooldown < 1.0) cooldown = 1.0;
        
        this.stats.attackSpeed = cooldown;

        // Wisdom: Mana regen and cast speed
        this.stats.manaRegen = totalStats.wisdom * 0.5;
        if (bonusStats.manaRegen > 0) {
            this.stats.manaRegen *= (1 + (bonusStats.manaRegen / 100));
        }
        this.stats.castSpeed = 1 + (totalStats.wisdom / 5) * 0.01;
        this.stats.critChanceBonus = bonusStats.critChance / 100;
        this.stats.poisonDamageBonus = bonusStats.poisonDamage / 100;
        this.stats.fireDamageBonus = bonusStats.fireDamage / 100;
        this.stats.healingDoneBonus = bonusStats.healingDone / 100;
        this.stats.holyDamageBonus = bonusStats.holyDamage / 100;
        this.stats.lifestealBonus = bonusStats.lifesteal / 100;
        this.stats.allResistBonus = bonusStats.allResist / 100;
        
        // Mana cost reduction from efficient effect
        this.stats.manaCostReduction = this.hasEfficientEffect ? 0.1 : 0;

        // Clamp current HP/Mana
        if (this.stats.hp > this.stats.maxHp) this.stats.hp = this.stats.maxHp;
        if (this.stats.mana > this.stats.maxMana) this.stats.mana = this.stats.maxMana;
    }

    equipItem(item) {
        if (!item || !item.slot) return false;
        
        if (this.level < item.level) {
            console.log(`Cannot equip ${item.name}. Level ${item.level} required.`);
            return false;
        }

        let targetSlot = item.slot;
        if (item.slot === 'ring') {
             if (!this.equipment.ring1) targetSlot = 'ring1';
             else if (!this.equipment.ring2) targetSlot = 'ring2';
             else targetSlot = 'ring1';
        } else if (item.slot === 'trinket') {
             if (!this.equipment.trinket1) targetSlot = 'trinket1';
             else if (!this.equipment.trinket2) targetSlot = 'trinket2';
             else targetSlot = 'trinket1';
        }

        // Unequip current item in slot if exists
        const currentItem = this.equipment[targetSlot];
        if (currentItem) {
            this.addToInventory(currentItem);
        }
        
        this.equipment[targetSlot] = item;
        this.recalculateStats();
        console.log(`${this.id} equipped ${item.name} to ${targetSlot}`);
        return true;
    }

    unequipItem(slot) {
        const item = this.equipment[slot];
        if (item) {
            if (this.addToInventory(item)) {
                this.equipment[slot] = null;
                this.recalculateStats();
                console.log(`${this.id} unequipped ${item.name}`);
                return true;
            }
        }
        return false;
    }

    addToInventory(item) {
        // Find first empty slot. Treat null/undefined and placeholder objects without id as empty.
        const index = this.inventory.findIndex(slot => !slot || !slot.id);
        if (index !== -1) {
            this.inventory[index] = item;
            return true;
        }
        console.log("Inventory full!");
        return false;
    }

    setAttackingState(restartAnimation = true) {
        if (this.state === 'DEAD') return;
        
        if (this.attackTimer) {
            clearTimeout(this.attackTimer);
            this.attackTimer = null;
        }

        this.state = 'ATTACKING';
        this.playAnimation('Attack', false, restartAnimation);
        
        // Scale animation speed
        const cooldown = this.stats.attackSpeed || 1.0;

        if (this.currentAction) {
            const clipDuration = this.currentAction.getClip().duration;
            // Play slightly faster (90% of cooldown) to ensure it finishes before state reset
            const timeScale = clipDuration / (cooldown * 0.9);
            this.currentAction.setEffectiveTimeScale(timeScale);
        }

        const duration = cooldown * 1000;

        this.attackTimer = setTimeout(() => {
            if (this.state === 'ATTACKING') {
                this.state = 'IDLE';
                this.playAnimation('Idle');
                if (this.currentAction) this.currentAction.setEffectiveTimeScale(1.0);
            }
            this.attackTimer = null;
        }, duration);
    }
}
