import { Actor } from './Actor.js';
import { spawnEffectSceneFallback } from './EffectSceneFallback.js';

export class AvengingSeraph extends Actor {
    constructor(id) {
        super(id, 'AvengingSeraph');
        console.log(`AvengingSeraph constructor called for ${id}`);
        this.meshType = 'AvengingSeraph';
        this.name = 'Avenging Seraph';
        this.radius = 1.5;
    }

    spawnVisualEffect(gameEngine, position, color, type) {
        if (!gameEngine || (!gameEngine.effectScene && !gameEngine.scene && typeof gameEngine.spawnTransientEffect !== 'function')) return;
        if (typeof gameEngine.spawnTransientEffect === 'function' && gameEngine.spawnTransientEffect(type, position, color, { source: this })) {
            return;
        }

        spawnEffectSceneFallback(gameEngine, position, color, type);
    }
}
