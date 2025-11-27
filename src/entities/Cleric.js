import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';

export class Cleric extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.CLERIC);
        this.scaleAnimSpeed = false;
        this.initMesh();

        this.abilityName = "Guardian Spirits";
        this.abilityDescription = "Summon spirits that orbit you and damage nearby enemies.";
        this.abilityManaCost = 40;
        this.abilityMaxCooldown = 10.0;
        
        this.spiritsActive = false;
        this.spiritDuration = 0;
        this.spirits = []; // Array of meshes
    }

    async initMesh() {
        const mesh = await MeshFactory.createMeshForType('Cleric');
        this.setMesh(mesh);
    }

    useAbility(targetVector, gameEngine) {
        if (!super.useAbility(targetVector, gameEngine)) return;

        console.log("Cleric used Guardian Spirits!");
        this.playAnimation('Attack', false); // Cast animation
        
        this.spiritsActive = true;
        this.spiritDuration = 8.0; // Lasts 8 seconds
        
        // Create visual spirits
        if (this.mesh) {
            for (let i = 0; i < 3; i++) {
                const geo = new THREE.SphereGeometry(0.3, 8, 8);
                const mat = new THREE.MeshStandardMaterial({ 
                    color: 0xffff00, 
                    emissive: 0xffd700,
                    emissiveIntensity: 1
                });
                const spirit = new THREE.Mesh(geo, mat);
                this.mesh.add(spirit); // Attach to player
                this.spirits.push({ mesh: spirit, angle: (i / 3) * Math.PI * 2 });
            }
        }
    }

    cancelAbilities() {
        this.spiritsActive = false;
        this.spirits.forEach(s => {
            if (this.mesh) this.mesh.remove(s.mesh);
        });
        this.spirits = [];
    }

    update(dt, collisionManager) {
        super.update(dt, collisionManager);

        if (this.spiritsActive) {
            this.spiritDuration -= dt;
            
            // Rotate spirits
            const radius = 3.0; // Increased visual radius to match larger damage area
            const speed = 3.0;
            
            this.spirits.forEach(s => {
                s.angle += speed * dt;
                s.mesh.position.set(
                    Math.cos(s.angle) * radius,
                    1.0 + Math.sin(s.angle * 2) * 0.2, // Bob up and down
                    Math.sin(s.angle) * radius
                );
            });

            // Damage Logic (Area check)
            // This needs access to enemies list, which we don't have easily here without passing it down.
            // For now, we'll rely on GameEngine to handle the damage tick or pass enemies in update.
            // But since we don't have enemies here, let's just handle visuals here and damage in GameEngine?
            // Or we can emit an event?
            
            if (this.spiritDuration <= 0) {
                this.spiritsActive = false;
                this.spirits.forEach(s => {
                    if (s.mesh.parent) s.mesh.parent.remove(s.mesh);
                });
                this.spirits = [];
            }
        }
    }
}