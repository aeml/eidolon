import * as THREE from 'three';
import { Entity } from './Entity.js';

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
            hpRegen: this.baseStats.vitality * 0.1,
            manaRegen: this.baseStats.wisdom * 0.1,
            attackSpeed: 1 + (this.baseStats.dexterity / 5) * 0.01,
            cooldownReduction: Math.min(0.5, this.baseStats.intelligence * 0.005),
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

        // Inventory & Equipment
        this.inventory = new Array(25).fill(null); // 25 slots
        this.equipment = {
            head: null,
            chest: null,
            legs: null,
            feet: null,
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

            // Start Idle if available
            if (this.animations['Idle']) {
                this.playAnimation('Idle');
            }
        }
    }

    playAnimation(name, loop = true) {
        if (!this.mixer) return;
        
        // Fallback or check if animation exists
        if (!this.animations[name]) {
            // console.warn(`Animation ${name} not found for ${this.id}`);
            return;
        }
        
        const action = this.animations[name];
        if (this.currentAction === action) return;

        if (this.currentAction) {
            this.currentAction.fadeOut(0.2);
        }

        action.reset().fadeIn(0.2).play();
        action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
        action.clampWhenFinished = !loop;
        
        this.currentAction = action;
    }

    move(targetVector) {
        if (this.state === 'DEAD') return;
        this.targetPosition = targetVector.clone();
        this.state = 'MOVING';
        this.playAnimation('Walk'); // Or 'Run'
    }

    useAbility(targetVector, gameEngine) {
        // Base implementation checks costs
        if (this.state === 'DEAD') return false;
        if (this.abilityCooldown > 0) {
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
        this.abilityCooldown = this.abilityMaxCooldown * (1 - cdr);
        
        // Subclasses implement actual logic
        return true;
    }

    update(dt, collisionManager) {
        super.update(dt);
        
        // Cooldowns
        if (this.abilityCooldown > 0) {
            this.abilityCooldown -= dt;
        }

        // Regeneration Logic (1 second tick)
        if (this.state !== 'DEAD') {
            this.regenTimer += dt;
            if (this.regenTimer >= 1.0) {
                this.regenTimer -= 1.0;
                
                // Regenerate HP
                if (this.stats.hp < this.stats.maxHp) {
                    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.hpRegen);
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
                    const correctedPos = collisionManager.checkCollision(nextPos, 0.5); // 0.5 radius
                    if (correctedPos) {
                        // Collision occurred, use corrected position
                        this.position.copy(correctedPos);
                    } else {
                        this.position.copy(nextPos);
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

    takeDamage(amount) {
        if (this.state === 'DEAD') return;
        this.stats.hp -= amount;
        console.log(`${this.id} took ${amount} damage. HP: ${this.stats.hp}`);
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

    attack(target) {
        if (this.state === 'DEAD' || this.state === 'ATTACKING') return;
        if (target && target.state === 'DEAD') return; // Don't attack dead targets
        
        // Simple cooldown check could go here
        
        this.state = 'ATTACKING';
        this.playAnimation('Attack', false);
        
        // Face target
        const lookTarget = new THREE.Vector3(target.position.x, this.position.y, target.position.z);
        if (this.mesh) {
            this.mesh.lookAt(lookTarget);
            this.rotation.copy(this.mesh.quaternion);
        }

        // Deal damage after a delay (sync with animation hit)
        setTimeout(() => {
            // Check if we died during the swing
            if (this.state === 'DEAD') return;

            if (target && target.stats.hp > 0) {
                // Calculate damage based on stats
                // Random variance +/- 20%
                const baseDmg = this.stats.damage;
                const variance = (Math.random() * 0.4) + 0.8; // 0.8 to 1.2
                const finalDmg = Math.floor(baseDmg * variance);
                
                target.takeDamage(finalDmg);

                if (target.stats.hp <= 0) {
                    const xp = target.xpValue || 10;
                    this.gainXp(xp);
                }
            }
            this.state = 'IDLE';
            this.playAnimation('Idle');
        }, 500); // 500ms delay for hit
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
        this.xp += amount;
        console.log(`${this.id} gained ${amount} XP. Total: ${this.xp}/${this.xpToNextLevel}`);
        
        if (this.xp >= this.xpToNextLevel) {
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.xp -= this.xpToNextLevel;
        this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5); // Curve
        
        this.statPoints += 3;
        
        // Recalculate to apply level scaling
        this.recalculateStats();
        
        // Heal on level up
        this.stats.hp = this.stats.maxHp;
        this.stats.mana = this.stats.maxMana;
        
        console.log(`${this.id} leveled up to ${this.level}! Points: ${this.statPoints}`);
    }

    increaseStat(statName) {
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
        const totalStats = { ...this.baseStats };
        
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
        this.stats.hpRegen = totalStats.vitality * 0.1;

        // Int: Increase max mana and reduces ability cooldown (up to 50% max)
        this.stats.maxMana = (totalStats.intelligence * 10) + levelBonus;
        this.stats.cooldownReduction = Math.min(0.5, totalStats.intelligence * 0.005);

        // Strength: Melee damage increase
        // Base Damage from Stats + Weapon Damage
        this.stats.damage = (totalStats.strength * 2) + totalStats.damage;

        // Defense
        this.stats.defense = totalStats.defense;

        // Dex: Movement speed and melee attack speed
        this.stats.speed = (3 + (totalStats.dexterity * 0.5)) * 1.2;
        this.stats.attackSpeed = 1 + (totalStats.dexterity / 5) * 0.01;

        // Wisdom: Mana regen and cast speed
        this.stats.manaRegen = totalStats.wisdom * 0.1;
        this.stats.castSpeed = 1 + (totalStats.wisdom / 5) * 0.01;
        
        this.stats.manaCostReduction = 0;

        // Clamp current HP/Mana
        if (this.stats.hp > this.stats.maxHp) this.stats.hp = this.stats.maxHp;
        if (this.stats.mana > this.stats.maxMana) this.stats.mana = this.stats.maxMana;
    }

    equipItem(item) {
        if (!item || !item.slot) return false;
        
        // Unequip current item in slot if exists
        const currentItem = this.equipment[item.slot];
        if (currentItem) {
            this.addToInventory(currentItem);
        }
        
        this.equipment[item.slot] = item;
        this.recalculateStats();
        console.log(`${this.id} equipped ${item.name}`);
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
}