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

        // Derived Stats
        this.stats = {
            ...baseStats,
            strength: baseStats.STRENGTH,
            intelligence: baseStats.INTELLIGENCE,
            dexterity: baseStats.DEXTERITY,
            wisdom: baseStats.WISDOM,
            vitality: baseStats.STAMINA,
            maxHp: baseStats.STAMINA * 10,
            hp: baseStats.STAMINA * 10,
            maxMana: baseStats.INTELLIGENCE * 10,
            mana: baseStats.INTELLIGENCE * 10,
            speed: 3 + (baseStats.DEXTERITY * 0.5), // Base 3 + bonus
            damage: baseStats.STRENGTH * 2, // Base physical damage
            defense: 0 // Base defense
        };

        // Progression
        this.level = 1;
        this.xp = 0;
        this.xpToNextLevel = 100;
        this.statPoints = 0;
        
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
    }

    setMesh(mesh) {
        super.setMesh(mesh);
        
        // Setup Animation Mixer if mesh has animations
        if (mesh.userData.animations && mesh.userData.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(mesh);
            
            // Map animations by name (assuming standard naming conventions)
            // You might need to adjust these names based on your actual GLB file
            mesh.userData.animations.forEach(clip => {
                this.animations[clip.name] = this.mixer.clipAction(clip);
            });

            // Start Idle
            this.playAnimation('Idle');
        }
    }

    playAnimation(name, loop = true) {
        if (!this.mixer || !this.animations[name]) return;
        
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

    update(dt, collisionManager) {
        super.update(dt);
        
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
            } else {
                direction.normalize();
                this.velocity.copy(direction).multiplyScalar(this.stats.speed * dt);
                
                // Proposed new position
                const nextPos = this.position.clone().add(this.velocity);
                
                // Check Collision
                if (collisionManager) {
                    const correctedPos = collisionManager.checkCollision(nextPos, 0.5); // 0.5 radius
                    if (correctedPos) {
                        // Collision occurred, use corrected position
                        this.position.copy(correctedPos);
                        
                        // If we hit a wall, we might want to stop or slide. 
                        // For now, sliding is handled by the checkCollision pushing us out.
                        // But if we are stuck, maybe stop?
                        // this.targetPosition = null; // Optional: Stop on collision
                    } else {
                        this.position.copy(nextPos);
                    }
                } else {
                    this.position.copy(nextPos);
                }
                
                // Rotate to face movement
                // Simple lookAt logic for Y-axis rotation
                const lookTarget = new THREE.Vector3(this.targetPosition.x, this.position.y, this.targetPosition.z);
                if (this.mesh) {
                    this.mesh.lookAt(lookTarget);
                    this.rotation.copy(this.mesh.quaternion);
                }
            }
        }
    }

    takeDamage(amount) {
        this.stats.hp -= amount;
        console.log(`${this.id} took ${amount} damage. HP: ${this.stats.hp}`);
        if (this.stats.hp <= 0) {
            this.die();
        }
    }

    die() {
        this.state = 'DEAD';
        this.playAnimation('Death', false); // Assuming Death animation exists
        // Disable collision/interaction?
        this.isActive = false; // Will stop updating/rendering eventually
    }

    attack(target) {
        if (this.state === 'DEAD' || this.state === 'ATTACKING') return;
        
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
        
        // Auto-increase HP/Damage slightly as base growth? 
        // Or rely purely on stats? Let's keep a small base growth + stat points.
        this.stats.maxHp += 5; 
        this.stats.hp = this.stats.maxHp;
        
        console.log(`${this.id} leveled up to ${this.level}! Points: ${this.statPoints}`);
    }

    increaseStat(statName) {
        if (this.statPoints > 0 && this.stats[statName] !== undefined) {
            this.stats[statName]++;
            this.statPoints--;
            this.recalculateStats();
            return true;
        }
        return false;
    }

    recalculateStats() {
        // Recalculate derived stats based on attributes
        // Note: We add base values to the calculation if needed, or just use raw stats
        // For now, let's stick to the formulas in constructor
        
        // We preserve the "base growth" added in levelUp by not fully resetting maxHp to just vitality*10
        // But that gets complicated. Let's make derived stats purely dependent on attributes for now, 
        // plus maybe a level bonus.
        
        const levelBonus = (this.level - 1) * 5; // 5 HP per level automatically?
        
        this.stats.maxHp = (this.stats.vitality * 10) + levelBonus;
        this.stats.maxMana = (this.stats.intelligence * 10) + levelBonus;
        this.stats.damage = this.stats.strength * 2;
        this.stats.speed = 3 + (this.stats.dexterity * 0.5);
        
        // Heal up to new max? Or just keep current percentage?
        // Let's just clamp current HP
        if (this.stats.hp > this.stats.maxHp) this.stats.hp = this.stats.maxHp;
    }
}