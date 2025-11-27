import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';
import { Projectile } from './Projectile.js';

export class Rogue extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.ROGUE);
        this.meshType = 'Rogue';

        this.abilityName = "Throw Dagger";
        this.abilityDescription = "Throw a dagger for high single-target damage.";
        this.abilityManaCost = 15;
        this.abilityMaxCooldown = 1.0;
        this.scaleAnimSpeed = false; // Rogue animations are static speed
    }

    useAbility(targetVector, gameEngine) {
        if (!super.useAbility(targetVector, gameEngine)) return;

        console.log("Rogue used Throw Dagger!");
        this.playAnimation('Attack', false);
        
        const startPos = this.position.clone();
        startPos.y += 1.0;
        
        const dagger = new Projectile(this, 'Dagger', startPos, targetVector);
        
        // Damage Calculation: Base 15 + (Dexterity * 1.5)
        dagger.damage = 15 + (this.stats.dexterity * 1.5);
        
        gameEngine.addEntity(dagger);
        gameEngine.projectiles.push(dagger);
    }
}