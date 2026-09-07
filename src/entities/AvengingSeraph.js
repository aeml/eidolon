import { Actor } from './Actor.js';
import { spawnEffectSceneFallback } from './EffectSceneFallback.js';
import { updateOfflineSeraph } from './SeraphSummon.js';

export class AvengingSeraph extends Actor {
    constructor(id) {
        super(id, 'AvengingSeraph');
        this.meshType = 'AvengingSeraph';
        this.name = 'Avenging Seraph';
        this.radius = 1.5;
    }

    update(dt, ...args) {
        if (this.offlineOwner && !updateOfflineSeraph(this, dt)) return;
        super.update(dt, ...args);
    }

    dispose() {
        this.offlineOwner?.offlineSeraphs?.delete(this);
        this.offlineOwner = null;
        this.isActive = false;
        super.dispose();
    }

    spawnVisualEffect(gameEngine, position, color, type) {
        if (!gameEngine || (!gameEngine.effectScene && !gameEngine.scene && typeof gameEngine.spawnTransientEffect !== 'function')) return;
        if (typeof gameEngine.spawnTransientEffect === 'function' && gameEngine.spawnTransientEffect(type, position, color, { source: this })) {
            return;
        }

        spawnEffectSceneFallback(gameEngine, position, color, type);
    }
}
