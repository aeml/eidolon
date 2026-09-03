import { Entity } from './Entity.js';
import { Actor } from './Actor.js';
import {
    createProceduralAreaField,
    releaseProceduralAreaField,
    updateProceduralAreaField
} from '../art/ProceduralAreaFields.js';

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
        this.effectType = config.effectType;
        
        this.onTick = config.onTick || null; // Custom logic per tick
        this.onExpire = config.onExpire || null; // Custom logic on expire
        
        this.isHostile = config.isHostile !== undefined ? config.isHostile : true; // Damages enemies?
        
        this.mesh = this.createVisual();
    }
    
    createVisual() {
        const quality = this.gameEngine?.uiManager?.getGraphicsQuality?.() || 'high';
        const field = createProceduralAreaField(this.effectType, this.radius, { quality });
        field.position.copy(this.position);
        return field;
    }
    
    update(dt, collisionManager, player, chunkManager, floatingTextManager) {
        this.elapsedTime += dt;
        if (this.elapsedTime >= this.duration) {
            this.isActive = false;
            if (this.onExpire) this.onExpire(this.gameEngine, this);
            return;
        }
        
        updateProceduralAreaField(this.mesh, this.elapsedTime, dt);
        
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
            releaseProceduralAreaField(this.mesh);
            this.mesh = null;
        }
    }
}
