import { Actor } from './Actor.js';

export class AvengingSeraph extends Actor {
    constructor(id) {
        super(id, 'AvengingSeraph');
        console.log(`AvengingSeraph constructor called for ${id}`);
        this.meshType = 'AvengingSeraph';
        this.name = 'Avenging Seraph';
        this.radius = 1.5;
    }

    spawnVisualEffect(gameEngine, position, color, type) {
        if (!gameEngine || !gameEngine.scene) return;
        if (typeof gameEngine.spawnTransientEffect === 'function' && gameEngine.spawnTransientEffect(type, position, color, { source: this })) {
            return;
        }

        gameEngine.spawnTransientEffect?.('impact', position, color, { source: this });
    }
}
