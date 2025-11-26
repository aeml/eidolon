import * as THREE from 'three';
import { Entity } from './Entity.js';

export class Actor extends Entity {
    constructor(id, stats) {
        super(id);
        this.stats = {
            hp: stats.HP || 100,
            maxHp: stats.HP || 100,
            speed: stats.SPEED || 5,
            ...stats
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

    update(dt) {
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
                this.position.add(this.velocity);
                
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
        if (this.stats.hp <= 0) {
            this.stats.hp = 0;
            this.state = 'DEAD';
            console.log(`${this.constructor.name} died.`);
            this.playAnimation('Death', false);
        }
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
}