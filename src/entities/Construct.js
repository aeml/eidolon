import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';

export class Construct extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.CONSTRUCT);
        this.xpValue = 250; // High XP reward
        
        // AI State
        this.sightRange = 60; 
        this.attackRange = 4.0;
        this.roamRadius = 20;
        this.roamTimer = 0;
        this.roamInterval = 5; 
        
        this.radius = 2.5; // Large collision radius
        this.isRunning = false; // Slow moving

        this.initMesh();
    }

    async initMesh() {
        try {
            const mesh = await MeshFactory.createMeshForType('Construct');
            if (mesh) {
                this.setMesh(mesh);
            }
        } catch (e) {
            console.error("Construct: initMesh failed", e);
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
                    this.move(player.position);
                }
            } else {
                // Roam
                this.roamTimer += dt;
                if (this.roamTimer > this.roamInterval) {
                    this.roamTimer = 0;
                    const roamTarget = this.position.clone().add(
                        new THREE.Vector3(
                            (Math.random() - 0.5) * this.roamRadius,
                            0,
                            (Math.random() - 0.5) * this.roamRadius
                        )
                    );
                    this.move(roamTarget);
                }
            }
        }
    }
}
