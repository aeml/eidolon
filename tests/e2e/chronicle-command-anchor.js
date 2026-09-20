import { expect } from '@playwright/test';
import { projectEntity } from './helpers.js';

export async function defeatCommandAnchor(page, site, chapter, beforeCombat) {
    const mask = () => page.evaluate(id => window.game.player.quests.find(q => q.id === id)?.investigationMask || 0, chapter.id);
    const initialMask = await mask();
    expect([1, 3], 'Ash must be genuinely recorded before the anchor fight').toContain(initialMask);
    if (initialMask === 3) {
        console.log('[fire-anchor] authoritative combat evidence already retained; no repeated kill claimed');
        return;
    }
    // It is an ordinary shared overworld enemy. If it died before the ash was
    // recorded, wait for its real ten-second respawn, never fabricate a kill.
    await expect.poll(() => page.evaluate(id => {
        const enemy = window.game.remotePlayers.get(id);
        return Boolean(enemy && enemy.state !== 'DEAD' && enemy.stats?.hp > 0);
    }, site.entityId), { timeout: 20_000 }).toBe(true);
    let sawDeath = false;
    const attacks = {};
    try { await expect.poll(async () => {
        const enemy = await page.evaluate(id => {
            const game = window.game, enemy = game.remotePlayers.get(id);
            const nearby = (game.activeEntitiesCache || []).filter(value => game.isHostileActorTarget(value) &&
                game.player.position.distanceTo(value.position) < 18);
            nearby.sort((a, b) => game.player.position.distanceTo(a.position) - game.player.position.distanceTo(b.position));
            return { deadPlayer: game.player.state === 'DEAD', exists: Boolean(enemy),
                dead: enemy?.state === 'DEAD' || enemy?.stats?.hp <= 0, cooldown: game.player.abilityCooldown,
                nearest: nearby[0]?.id };
        }, site.entityId);
        expect(enemy.deadPlayer, 'Anchor must be defeated through survivable ordinary combat').toBe(false);
        expect(enemy.exists).toBe(true);
        sawDeath ||= enemy.dead;
        if (sawDeath && (await mask() & 2)) return true;
        // Keep ordinary kiting near the authored encounter. An unconstrained
        // retreat can leave the slower anchor behind and recruit a new train
        // of unrelated enemies while the driver never returns to its objective.
        if (enemy.dead || await beforeCombat({ encounter: { x: site.x, z: site.z, radius: 32 } })) return false;
        let point = await projectEntity(page, site.entityId);
        if (!point?.visible && enemy.nearest) point = await projectEntity(page, enemy.nearest);
        if (!point?.visible) return false;
        await page.mouse.move(point.x, point.y);
        await page.waitForTimeout(75);
        const actual = await page.evaluate(() => {
            const game = window.game;
            return game.isHostileActorTarget(game.hoveredEntity) ? game.hoveredEntity.id : null;
        });
        // A player can fight the enemy covering the anchor, including normal
        // Fireball splash. Never make the driver stand idle behind that model.
        // Credit still requires observing this anchor's death after the ash.
        if (!actual) return false;
        await page.mouse.click(point.x, point.y);
        if ((enemy.cooldown || 0) <= 0) await page.mouse.click(point.x, point.y, { button: 'right' });
        attacks[actual] = (attacks[actual] || 0) + 1;
        return false;
    }, { timeout: 240_000, intervals: [250], message: 'Actual command-anchor death grants ordered evidence' }).toBe(true); } catch (error) {
        console.log('[fire-anchor-failure]', JSON.stringify({ attacks, sawDeath,
            ...await page.evaluate(({ enemyId, questId }) => {
                const game = window.game, player = game.player, anchor = game.remotePlayers.get(enemyId);
                return { player: { state: player.state, health: player.stats.hp, position: player.position.toArray() },
                    anchor: { state: anchor?.state, health: anchor?.stats?.hp, position: anchor?.position.toArray() },
                    mask: player.quests.find(q => q.id === questId)?.investigationMask,
                    defense: window.__freshWizardDefense?.counts,
                    nearby: (game.activeEntitiesCache || []).filter(value => game.isHostileActorTarget(value) &&
                        player.position.distanceTo(value.position) < 30).map(value => ({ id: value.id,
                        health: value.stats?.hp, position: value.position.toArray() })) };
            }, { enemyId: site.entityId, questId: chapter.id }) }));
        throw error;
    }
    expect(await mask(), 'Released ember must still be unrecorded after combat').toBe(3);
    console.log('[fire-anchor] actual death observed after ash; mask 1 → 3, ember still unrecorded', JSON.stringify({ attacks }));
}
