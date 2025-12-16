import * as THREE from 'three';
import { Entity } from './Entity.js';

// Optimization: Reusable temporary objects to avoid GC
const TEMP_VEC = new THREE.Vector3();
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
        
        console.log(`Actor ${id} init: Mana Stat = ${this.manaStatName}, Value = ${manaStatValue}`);

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
            castSpeed: 1 + (this.baseStats.wisdom / 5) * 0.01
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
        this.speedBoostTimer = 0;
        this.speedBoostFactor = 0;

        // Wizard Debuffs/Buffs
        this.frozenTimer = 0; // Stun + Visual
        this.shieldHP = 0; // Absorbs damage
        this.hasteTimer = 0; // Speed + CDR
        this.hasteFactor = 0;

        // Hotbar & Skills
        this.hotbar = [null, null, null, null];
        this.unlockedSkills = [];
        this.cooldowns = {}; // Map of skillName -> cooldown timer

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
            console.log(`Scaled up Elite ${this.id} (${this.constructor.name})`);
        }
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
                this.playAnimation('Run');
            } else {
                if (this.animations['Idle']) {
                    this.playAnimation('Idle');
                }
            }
        }
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
    }

    move(targetVector) {
        if (this.state === 'DEAD') return;
        this.targetPosition = targetVector.clone();
        
        // Only trigger animation if changing state
        if (this.state !== 'MOVING') {
            this.state = 'MOVING';
            this.playAnimation('Walk'); // Or 'Run'
        }
    }

    useAbility(targetVector, gameEngine, skillNameOverride = null) {
        // Base implementation checks costs
        if (this.state === 'DEAD' || this.stunTimer > 0) return false;
        
        // Bypass checks for remote entities (visual only)
        if (this.isRemote) {
            return true;
        }

        const skillName = skillNameOverride || this.abilityName;

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
        const cost = this.abilityManaCost * (1 - (this.stats.manaCostReduction || 0));
        
        if (this.stats.mana < cost) {
            console.log("Not enough mana");
            return false;
        }

        this.stats.mana -= cost;
        
        // Apply Cooldown Reduction
        const cdr = this.stats.cooldownReduction || 0;
        const maxCd = this.abilityMaxCooldown * (1 - cdr);
        
        // Set Cooldown
        if (skillName) {
            this.cooldowns[skillName] = maxCd;
        }
        
        // Also set global cooldown for legacy support / base ability
        if (!skillNameOverride) {
            this.abilityCooldown = maxCd;
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
                // If already attacking, just extend the state without restarting animation
                const restart = this.state !== 'ATTACKING';
                this.setAttackingState(restart);
            } else if (newState === 'DEAD') {
                this.die();
            } else {
                // If we are currently attacking, we ignore other state updates 
                // until the local timer expires to prevent cutting off animations.
                if (this.state !== 'ATTACKING') {
                    this.state = newState;
                }
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
                const bleedDmg = 5 * this.bleedStacks;
                this.takeDamage(bleedDmg);
                // Visual
                // if (floatingTextManager) floatingTextManager.spawn(bleedDmg, this.position, '#ff0000');
            }

            if (this.bleedTimer <= 0) {
                this.bleedTimer = 0;
                this.bleedStacks = 0;
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
                const poisonDmg = 3 * this.poisonStacks; // Lower base dmg than bleed but reduces healing
                this.takeDamage(poisonDmg);
                // Visual
                // if (floatingTextManager) floatingTextManager.spawn(poisonDmg, this.position, '#00ff00');
            }

            if (this.poisonTimer <= 0) {
                this.poisonTimer = 0;
                this.poisonStacks = 0;
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

        if (this.isRemote) {
            // Interpolate Position
            let movedDistance = 0;
            if (this.targetServerPosition) {
                const lerpFactor = 10.0 * dt;
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
                this.rotation.slerp(TEMP_QUAT, 10.0 * dt);
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
                    // Add to visual offset instead of position to avoid fighting Lerp
                    this.visualOffset.add(separation.multiplyScalar(5.0 * dt));
                    // Clamp to avoid extreme offsets
                    if (this.visualOffset.length() > 1.5) {
                        this.visualOffset.setLength(1.5);
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
            } else if (this.state === 'ATTACKING') {
                this.playAnimation('Attack', false);
                // Scale animation speed for remote entities
                if (this.currentAction && this.stats.attackSpeed) {
                    const cooldown = this.stats.attackSpeed;
                    const clipDuration = this.currentAction.getClip().duration;
                    // Play slightly faster (90% of cooldown) to ensure it finishes before server state reset
                    const timeScale = clipDuration / (cooldown * 0.9);
                    this.currentAction.setEffectiveTimeScale(timeScale);
                }
            } else if (this.isCharging) {
                this.playAnimation('Run');
            } else if (this.state === 'MOVING') {
                this.playAnimation('Run');
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

            const direction = new THREE.Vector3().subVectors(this.targetPosition, this.position);
            const distance = direction.length();
            
            if (distance < 0.1) {
                this.position.copy(this.targetPosition);
                this.targetPosition = null;
                this.state = 'IDLE';
                this.velocity.set(0, 0, 0);
                this.playAnimation('Idle');
                if (this.currentAction) this.currentAction.setEffectiveTimeScale(1.0); // Reset speed for Idle
            } else {
                direction.normalize();
                
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

                this.velocity.copy(direction).multiplyScalar(moveDist);
                
                // Proposed new position
                const nextPos = this.position.clone().add(this.velocity);
                
                // Check Collision
                if (collisionManager) {
                    // 1. Static World Collision
                    const correctedPos = collisionManager.checkCollision(nextPos, this.radius, this.position); 
                    if (correctedPos) {
                        this.position.copy(correctedPos);
                    } else {
                        this.position.copy(nextPos);
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
                    this.position.copy(nextPos);
                }
                
                // Rotate to face movement
                const lookTarget = new THREE.Vector3(this.targetPosition.x, this.position.y, this.targetPosition.z);
                if (this.mesh) {
                    this.mesh.lookAt(lookTarget);
                    this.rotation.copy(this.mesh.quaternion);
                }
                
                // Update Animation Speed based on movement type
                if (this.isRunning) {
                     this.playAnimation('Run');
                } else {
                     this.playAnimation('Walk');
                }

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
        this.weakPointMarkTimer = 0;
        // Add other debuffs here if they exist (poison, bleed, etc.)
        console.log(`${this.id} was cleansed!`);
    }

    takeDamage(amount) {
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
            console.log(`${this.id} was saved by Divine Intervention!`);
            return; 
        }

        this.stats.hp -= finalAmount;
        console.log(`${this.id} took ${finalAmount} damage (was ${amount}). HP: ${this.stats.hp}`);
        if (this.stats.hp <= 0) {
            this.die();
        }
    }

    die() {
        if (this.state === 'DEAD') return;
        this.state = 'DEAD';
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
                const finalDmg = Math.floor(baseDmg * variance);
                target.takeDamage(finalDmg);
                
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
            if (item && item.stats) {
                for (const stat in item.stats) {
                    if (totalStats[stat] !== undefined) {
                        totalStats[stat] += item.stats[stat];
                    } else {
                        // Handle direct damage/defense stats on items
                        if (stat === 'damage') totalStats.damage += item.stats.damage;
                        if (stat === 'defense') totalStats.defense += item.stats.defense;
                    }
                }
            }
        }

        // Update Total Stats in this.stats
        this.stats.strength = totalStats.strength;
        this.stats.dexterity = totalStats.dexterity;
        this.stats.intelligence = totalStats.intelligence;
        this.stats.wisdom = totalStats.wisdom;
        this.stats.vitality = totalStats.vitality;

        // 2. Recalculate derived stats based on Total Attributes
        const levelBonus = (this.level - 1) * 5; 
        
        // Vit: Increase health and health regen
        this.stats.maxHp = (totalStats.vitality * 10) + levelBonus;
        this.stats.hpRegen = totalStats.vitality * 0.5;

        // Int: Increase max mana and reduces ability cooldown (up to 50% max)
        this.stats.maxMana = (totalStats.intelligence * 10) + levelBonus;
        this.stats.cooldownReduction = Math.min(0.5, totalStats.intelligence * 0.01);

        // Strength: Melee damage increase
        // Base Damage from Stats + Weapon Damage
        this.stats.damage = (totalStats.strength * 2) + totalStats.damage;

        // Defense
        this.stats.defense = totalStats.defense;

        // Dex: Movement speed and melee attack speed
        // Cap movement speed at 300% of base movement (derived from base stats)
        
        // Calculate Speed
        this.stats.speed = (3 + (totalStats.dexterity * 0.5)) * 1.2;
        
        // Haste Buff
        if (this.hasteTimer > 0) {
            this.stats.speed *= (1 + this.hasteFactor);
            this.stats.cooldownReduction = Math.min(0.8, this.stats.cooldownReduction + 0.2); // +20% CDR
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
        this.stats.castSpeed = 1 + (totalStats.wisdom / 5) * 0.01;
        
        this.stats.manaCostReduction = 0;

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
        // Find first empty slot
        const index = this.inventory.findIndex(slot => slot === null);
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