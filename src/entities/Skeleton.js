import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';

export class Skeleton extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.SKELETON || { STATS: { STRENGTH: 3, STAMINA: 3, DEXTERITY: 3, INTELLIGENCE: 1, WISDOM: 1 } });
        this.xpValue = 50; // XP reward for killing
        
        // AI State
        this.sightRange = 45; // Increased from 15 to 45 (3x)
        this.attackRange = 2.5;
        this.roamRadius = 10;
        this.roamTimer = 0;
        this.roamInterval = 3; // Seconds between roams
        
        this.initMesh();
    }

    async initMesh() {
        try {
            const mesh = await MeshFactory.createMeshForType('Skeleton');
            if (mesh) {
                this.setMesh(mesh);
            }
        } catch (e) {
            console.error("Skeleton: initMesh failed", e);
        }
    }

    update(dt, collisionManager, player) {
        // Run base Actor update (handles movement, animations, etc.)
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
                    // Only update path occasionally or if target moved significantly? 
                    // For now, just update target position every frame is fine for simple AI
                    this.move(player.position);
                }
                return; // Skip roam logic if chasing/attacking
            }
        }

        // Roam Logic (if not chasing)
        if (this.state === 'IDLE') {
            this.roamTimer -= dt;
            if (this.roamTimer <= 0) {
                this.roam();
                this.roamTimer = this.roamInterval + Math.random() * 2; // Randomize interval
            }
        }
    }

    roam() {
        // Pick a random point nearby
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
