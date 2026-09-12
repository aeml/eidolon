import { readPlayerStateInPage } from './groundInputObservations.js';
import { projectGroundOffsetInPage } from './groundInputProjection.js';
import { isEarnedRetreatPathClear } from './wizardHuntControls.js';

// One synchronous browser observation for a single strict path. No input,
// movement, hover assignment, path substitution or scaling occurs here.
export function prepareGroundInputInPage({ deltaX, deltaZ }) {
    const game = window.game;
    if (!game?.player) return { before: null, clear: false, target: null };
    const before = readPlayerStateInPage({ observeClicks: true });
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaZ) || !Math.hypot(deltaX, deltaZ) ||
        before.state === 'DEAD' || !(before.health > 0) || !game.collisionManager) {
        return { before, clear: false, target: null };
    }
    const clear = isEarnedRetreatPathClear(game.collisionManager, game.player.position,
        game.player.radius || 1.25, { x: deltaX, z: deltaZ });
    return { before, clear, target: clear ? projectGroundOffsetInPage({ deltaX, deltaZ, allowScaling: false }) : null };
}
