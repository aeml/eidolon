import * as THREE from 'three';
import { Entity } from './Entity.js';
import { Actor } from './Actor.js';
import { disposeSceneMesh } from './EffectSceneFallback.js';

export class AreaOfEffect extends Entity {
    constructor(gameEngine, owner, position, config) {
        super(gameEngine.getUniqueId ? gameEngine.getUniqueId() : Math.random().toString(36).substr(2, 9));
        this.gameEngine = gameEngine;
        this.type = 'AreaOfEffect';
        this.owner = owner;
        this.position.copy(position);
        
        this.radius = config.radius || 3.0;
        this.duration = config.duration || 5.0;
        this.damage = config.damage || 0;
        this.damageInterval = config.damageInterval || 1.0; // Seconds between ticks
        this.tickTimer = 0;
        this.elapsedTime = 0;
        this.color = config.color || 0xff0000;
        this.visualType = config.visualType || 'cylinder'; // cylinder, sphere, ring
        
        this.onTick = config.onTick || null; // Custom logic per tick
        this.onExpire = config.onExpire || null; // Custom logic on expire
        
        this.isHostile = config.isHostile !== undefined ? config.isHostile : true; // Damages enemies?
        
        this.mesh = this.createVisual();
    }
    
    createVisual() {
        let geometry;
        let material = new THREE.MeshBasicMaterial({ 
            color: this.color, 
            transparent: true, 
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        
        if (this.visualType === 'cylinder') {
            geometry = new THREE.CylinderGeometry(this.radius, this.radius, 0.2, 32);
        } else if (this.visualType === 'sphere') {
            geometry = new THREE.SphereGeometry(this.radius, 32, 32);
        } else if (this.visualType === 'ring') {
            geometry = new THREE.RingGeometry(this.radius * 0.9, this.radius, 32);
            geometry.rotateX(-Math.PI / 2);
        } else {
            geometry = new THREE.CylinderGeometry(this.radius, this.radius, 0.2, 32);
        }
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(this.position);
        // Lift slightly off ground to avoid z-fighting
        if (this.visualType !== 'sphere') {
            mesh.position.y += 0.1;
        }
        
        return mesh;
    }
    
    update(dt, collisionManager, player, chunkManager, floatingTextManager) {
        this.elapsedTime += dt;
        if (this.elapsedTime >= this.duration) {
            this.isActive = false;
            if (this.onExpire) this.onExpire(this.gameEngine, this);
            return;
        }
        
        // Pulse effect
        if (this.mesh) {
            const pulse = 0.4 + Math.sin(this.elapsedTime * 5) * 0.1;
            this.mesh.material.opacity = pulse;
            
            // Rotate if ring
            if (this.visualType === 'ring') {
                this.mesh.rotation.z += dt;
            }
        }
        
        // Damage Tick
        this.tickTimer += dt;
        if (this.tickTimer >= this.damageInterval) {
            this.tickTimer = 0;
            this.performTick(chunkManager);
        }
    }
    
    performTick(chunkManager) {
        if (this.damage > 0) {
            const entities = chunkManager ? chunkManager.getActiveEntities() : [];
            for (const entity of entities) {
                if (!entity.isActive || entity.state === 'DEAD') continue;
                if (entity === this.owner) continue;
                if (!(entity instanceof Actor)) continue;
                if (typeof entity.takeDamage !== 'function') continue;
                if (entity.constructor.name === 'LootDrop') continue;
                if (entity.constructor.name === 'AreaOfEffect') continue;
                if (entity.constructor.name === 'Projectile') continue;
                
                // Faction check (simple version: if owner is Player, hit non-Players)
                // Assuming owner is Actor. 
                // If isHostile is true, we damage enemies of the owner.
                // For now, simple check: if owner is same class as target, skip (friendly fire off)
                // But monsters are different classes.
                // Let's use the standard check:
                // If owner is player (or friendly), hit enemies.
                // If owner is enemy, hit players.
                
                // Simplified: If owner is defined, check if target is different "team"
                // For this codebase, usually Players vs everything else.
                // But we have PVP potentially?
                // Let's stick to: If owner is defined, don't hit owner.
                // If owner is a Player (or subclass), hit non-Players.
                
                let isEnemy = true;
                if (this.owner) {
                    const ownerIsPlayer = (this.owner.constructor.name === 'Fighter' || 
                                         this.owner.constructor.name === 'Rogue' || 
                                         this.owner.constructor.name === 'Cleric' || 
                                         this.owner.constructor.name === 'Wizard');
                    
                    const targetIsPlayer = (entity.constructor.name === 'Fighter' || 
                                          entity.constructor.name === 'Rogue' || 
                                          entity.constructor.name === 'Cleric' || 
                                          entity.constructor.name === 'Wizard');
                                          
                    if (ownerIsPlayer && targetIsPlayer) isEnemy = false;
                    if (!ownerIsPlayer && !targetIsPlayer) isEnemy = false;
                }
                
                if (!isEnemy) continue;

                const dist = this.position.distanceTo(entity.position);
                if (dist <= this.radius) {
                    entity.takeDamage(this.damage);
                    if (this.gameEngine.floatingTextManager) {
                        this.gameEngine.floatingTextManager.spawn(Math.floor(this.damage), entity.position, '#ff8800');
                    }
                }
            }
        }
        
        if (this.onTick) {
            this.onTick(this.gameEngine, this);
        }
    }

    dispose() {
        if (this.mesh) {
            disposeSceneMesh(this.mesh);
            this.mesh = null;
        }
    }
}
