import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';

export class Imp extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.IMP);
        this.xpValue = 100; // Medium XP reward
        
        // AI State
        this.sightRange = 45; 
        this.attackRange = 2.0;
        this.roamRadius = 12;
        this.roamTimer = 0;
        this.roamInterval = 3; 
        
        this.radius = 1.0; // Smaller collision radius
        this.isRunning = false; // Enemies always walk

        this.initMesh();
    }

    async initMesh() {
        try {
            const mesh = await MeshFactory.createMeshForType('Imp');
            if (mesh) {
                this.setMesh(mesh);
            }
        } catch (e) {
            console.error("Imp: initMesh failed", e);
        }
    }

    update(dt, collisionManager, player) {
        super.update(dt, collisionManager);

        if (this.state === 'DEAD') return;

        // AI Logic
        if (player && player.state !== 'DEAD') {
            const dist = this.position.distanceTo(player.position);

            if (dist < this.sightRange) {
                // Player seen!
                if (dist < this.attackRange) {
                    // Attack!
                    this.attack(player);
                } else {
                    // Chase!
                    this.targetPosition = player.position.clone();
                    this.move(this.targetPosition, collisionManager);
                }
            } else {
                // Roam
                this.roamTimer += dt;
                if (this.roamTimer > this.roamInterval) {
                    this.roamTimer = 0;
                    // Pick random point near current pos
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * this.roamRadius;
                    this.targetPosition = new THREE.Vector3(
                        this.position.x + Math.cos(angle) * dist,
                        0,
                        this.position.z + Math.sin(angle) * dist
                    );
                }
                
                if (this.targetPosition) {
                    this.move(this.targetPosition, collisionManager);
                    if (this.position.distanceTo(this.targetPosition) < 0.5) {
                        this.targetPosition = null;
                        this.state = 'IDLE';
                        this.playAnimation('Idle');
                    }
                }
            }
        }
    }
}
