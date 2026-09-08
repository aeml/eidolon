import { expect } from '@playwright/test';
import { projectEntity, readPlayerState } from './helpers.js';

// The fresh reader brings ordinary roaming enemies to a site. Clear its
// immediate approach with earned basic/class attacks before trying to read;
// never change target priority, enemy state, credit, gear or player protection.
export async function clearFreshInvestigationApproach(page, site) {
    const started = Date.now();
    const engaged = new Set();
    for (let attempt = 0; attempt < 160; attempt++) {
        const player = await readPlayerState(page);
        expect(player.state, 'Fresh investigation combat must remain survivable').not.toBe('DEAD');
        const target = await page.evaluate(({ x, z }) => {
            const game = window.game;
            const enemies = [...game.remotePlayers.values()].filter(entity =>
                game.isHostileActorTarget(entity) &&
                Math.hypot(entity.position.x - x, entity.position.z - z) < 9);
            enemies.sort((a, b) => game.player.position.distanceTo(a.position) -
                game.player.position.distanceTo(b.position));
            return enemies[0]?.id || null;
        }, site);
        if (!target) {
            console.log('[fresh-investigation-combat]', JSON.stringify({ site: site.id,
                engaged: engaged.size, seconds: (Date.now() - started) / 1000,
                note: 'Targets engaged, not a count of distinct observed kills.' }));
            return;
        }
        engaged.add(target);
        const point = await projectEntity(page, target);
        if (point?.visible) {
            await page.mouse.click(point.x, point.y);
            if (await page.evaluate(() => window.game.player.abilityCooldown <= 0)) {
                await page.mouse.click(point.x, point.y, { button: 'right' });
            }
        }
        await page.waitForTimeout(250);
    }
    throw new Error(`Fresh investigation approach remains contested at ${site.id}`);
}
