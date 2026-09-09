import { expect } from '@playwright/test';
import { earthExpeditionSearchAnchor, levelAppropriateExpeditionTargets } from '../expeditionCombatTargets.js';
import { moveByGroundClick, projectEntity, readPlayerState } from './helpers.js';

// Shared ordinary target acquisition for fresh and prepared quest routes.
// No waypoint, enemy mutation or progression grant is performed here.
export async function findExpeditionTarget(page, hunt, deadline = Infinity) {
    // The original Skeleton fallback lay in level-ten territory. Walk back
    // toward the authored starter band if streaming shows no appropriate foe.
    const fallback = earthExpeditionSearchAnchor(hunt);
    for (let step = 0; step < 100 && Date.now() < deadline; step++) {
        expect((await readPlayerState(page)).state, 'Ordinary expedition travel must be survivable').not.toBe('DEAD');
        const observed = await page.evaluate(hunt => {
            const game = window.game;
            return [...game.remotePlayers.values()].filter(enemy => enemy.isActive && enemy.state !== 'DEAD' &&
                (enemy.subType || enemy.constructor.name) === hunt.enemy && enemy.level >= hunt.minEnemyLevel &&
                (enemy.health ?? enemy.stats?.hp) > 0).map(enemy => ({ id: enemy.id, level: enemy.level,
                x: enemy.position.x, z: enemy.position.z, rendered: game.activeEntitiesCache.includes(enemy),
                distance: game.player.position.distanceTo(enemy.position) })).sort((a, b) => a.distance - b.distance);
        }, hunt);
        const candidates = levelAppropriateExpeditionTargets(observed, hunt.minEnemyLevel,
            (await readPlayerState(page)).level);
        for (const enemy of candidates.slice(0, 6)) {
            if (!enemy.rendered) continue;
            const point = await projectEntity(page, enemy.id);
            if (point?.visible) return enemy;
        }
        const target = candidates[0] || fallback;
        const player = await readPlayerState(page);
        const dx = target.x - player.x, dz = target.z - player.z;
        const scale = Math.min(1, 12 / Math.max(1, Math.hypot(dx, dz)));
        // Ordinary travel can cross town while seeking the authored band. Use
        // the real move-only gesture so a newly hovered NPC cannot open a
        // conversation between the ground projection and the actual click.
        await moveByGroundClick(page, dx * scale, dz * scale, { moveOnly: true });
    }
    throw new Error(`No reachable ${hunt.enemy} level ${hunt.minEnemyLevel}+ after bounded ordinary travel`);
}
