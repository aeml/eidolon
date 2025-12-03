import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';

export class Cleric extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.CLERIC);
        this.scaleAnimSpeed = false;
        this.meshType = 'Cleric';

        this.abilityName = "Guardian Spirits";
        this.abilityDescription = "Summon spirits that orbit you and damage nearby enemies.";
        this.abilityManaCost = 40;
        this.abilityMaxCooldown = 10.0;
        
        this.spiritsActive = false;
        this.spiritDuration = 0;
        this.spirits = []; // Array of meshes
    }

    useAbility(targetVector, gameEngine) {
        if (!super.useAbility(targetVector, gameEngine)) return;

        console.log("Cleric used Guardian Spirits!");
        this.playAnimation('Attack', false, true); // Cast animation
        
        this.spiritsActive = true;
        this.spiritDuration = 8.0; // Lasts 8 seconds
        
        this.createSpirits();
    }

    createSpirits() {
        if (this.mesh && this.spirits.length === 0) {
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
        } else if (!this.mesh) {
            // Retry later if mesh not ready
            setTimeout(() => {
                if (this.spiritsActive) this.createSpirits();
            }, 100);
        }
    }

    onMeshReady(mesh) {
        if (this.spiritsActive) {
            this.createSpirits();
        }
    }

    cancelAbilities() {
        this.spiritsActive = false;
        this.spirits.forEach(s => {
            if (this.mesh) this.mesh.remove(s.mesh);
        });
        this.spirits = [];
    }

    update(dt, collisionManager, player, activeEntities, floatingTextManager) {
        super.update(dt, collisionManager, player, activeEntities, floatingTextManager);

        if (this.spiritsActive) {
            // Only decrement duration in singleplayer
            // if (!this.isMultiplayer && !this.isRemote) {
            //     this.spiritDuration -= dt;
            // }
            
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
            if (activeEntities) {
                this.spiritDamageTimer = (this.spiritDamageTimer || 0) + dt;
                if (this.spiritDamageTimer > 0.5) {
                    this.spiritDamageTimer = 0;
                    
                    const damageRadius = 3.5;
                    const damage = 10 + (this.stats.wisdom * 1.0);

                    for (const entity of activeEntities) {
                        if (entity === this || entity.state === 'DEAD' || !entity.isActive) continue;
                        if (entity.constructor.name === 'LootDrop') continue;
                        if (entity.constructor.name === 'DwarfSalesman') continue;
                        
                        const d = this.position.distanceTo(entity.position);
                        if (d < damageRadius) {
                             // if (!this.isMultiplayer && !this.isRemote) {
                             //    entity.takeDamage(damage);
                             // }
                             
                             // if (floatingTextManager && !this.isMultiplayer) {
                             //     floatingTextManager.spawn(Math.floor(damage), entity.position, '#ffffff');
                             // }
                        }
                    }
                }
            }
            
            // if (!this.isMultiplayer && !this.isRemote && this.spiritDuration <= 0) {
            //     this.spiritsActive = false;
            //     this.spirits.forEach(s => {
            //         if (s.mesh.parent) s.mesh.parent.remove(s.mesh);
            //     });
            //     this.spirits = [];
            // }
        }
    }
}