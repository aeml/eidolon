import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';

export class DemonOrc extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.DEMON_ORC);
        this.xpValue = 150; // Higher XP reward
        
        // AI State
        this.sightRange = 50; 
        this.attackRange = 3.0;
        this.roamRadius = 15;
        this.roamTimer = 0;
        this.roamInterval = 4; 
        
        this.radius = 2.0; // Larger collision radius
        this.isRunning = false; // Enemies always walk

        this.initMesh();
    }

    async initMesh() {
        try {
            const mesh = await MeshFactory.createMeshForType('DemonOrc');
            if (mesh) {
                this.setMesh(mesh);
            }
        } catch (e) {
            console.error("DemonOrc: initMesh failed", e);
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
                return; 
            }
        }

        // Roam Logic
        if (this.state === 'IDLE') {
            this.roamTimer -= dt;
            if (this.roamTimer <= 0) {
                this.roam();
                this.roamTimer = this.roamInterval + Math.random() * 2; 
            }
        }
    }

    roam() {
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
}
