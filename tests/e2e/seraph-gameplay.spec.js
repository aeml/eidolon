import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    enterAndExitDungeon, loginAndEnterWorld, moveByGroundClick, projectNearestHostile,
    returnToTown, useVerdantQAWaypoint, zoomOutForPortal } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('Seraph training persists, changes actual smites and lifetime, and cleans up on recall', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires disposable Seraph QA');
    const credentials = credentialsFromEnvironment();
    expect(testInfo.retry).toBeLessThanOrEqual(1);
    if (testInfo.retry) credentials.username += `-retry${testInfo.retry}`;
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    await ensureDungeonReadyLevel(page);
    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    await skills.locator('.skill-branch').filter({ hasText: 'Battle Cleric' })
        .getByRole('button', { name: 'Select Spec', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.includes('Avenging Seraph'))).toBe(true);
    await page.locator('#btn-close-skills').click();

    async function observe() {
        await page.evaluate(() => {
            const game = window.game;
            window.__seraphQA = { results: [], hits: [], births: {}, removals: {}, ranks: { ...game.player.talentRanks } };
            const handle = game.handleServerMessage.bind(game);
            game.handleServerMessage = message => {
                const qa = window.__seraphQA, now = performance.now();
                if (message.type === 'ability_result' && message.payload?.skillName === 'Avenging Seraph') {
                    qa.results.push({ ...message.payload, at: now });
                }
                if (message.type === 'damage' && message.payload?.sourceId?.startsWith('summon-seraph-')) {
                    qa.hits.push({ ...message.payload, at: now });
                }
                const states = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
                for (const state of Object.values(states || {})) {
                    if (state.id === game.player.id && state.talentRanks) qa.ranks = { ...state.talentRanks };
                    if (state.subType === 'AvengingSeraph' && state.ownerId === game.player.id && !qa.births[state.id]) {
                        qa.births[state.id] = now;
                    }
                }
                // Creation loads its model asynchronously; an absent replica
                // immediately after a birth packet is not a removal. Observe
                // the authoritative deletion/full-state absence instead.
                for (const id of message.type === 'delta' ? message.payload?.r || [] : []) {
                    if (qa.births[id] && !qa.removals[id]) qa.removals[id] = now;
                }
                if (message.type === 'state') {
                    const present = new Set(Object.values(states || {}).map(state => state.id));
                    for (const id of Object.keys(qa.births)) {
                        if (!present.has(id) && !qa.removals[id]) qa.removals[id] = now;
                    }
                }
                return handle(message);
            };
        });
    }

    async function closeApproachedDungeonMenu() {
        // A moving camera can bring the entrance under the last ground click.
        // Dismiss the resulting real service menu through its visible control
        // before using chat; never force a click through its modal backdrop.
        const dungeonClose = page.locator('#btn-close-dungeon-menu');
        if (await dungeonClose.isVisible()) {
            await dungeonClose.click();
            await expect(page.locator('#dungeon-menu-backdrop')).toBeHidden();
            return true;
        }
        return false;
    }

    async function walk(deltaX, deltaZ, options) {
        await closeApproachedDungeonMenu();
        try {
            await moveByGroundClick(page, deltaX, deltaZ, options);
        } catch (error) {
            // Only a planner that issued no input may retry after removing a
            // confirmed modal. Never suppress an issued movement failure.
            if (error.name !== 'GroundInputUnavailableError' || !await closeApproachedDungeonMenu()) throw error;
            await moveByGroundClick(page, deltaX, deltaZ, options);
        }
        await closeApproachedDungeonMenu();
    }

    async function ready() {
        await closeApproachedDungeonMenu();
        const sequence = await page.evaluate(() => window.game.animationQAReadySequence || 0);
        await page.locator('#chat-tab-chat').click({ timeout: 5_000 });
        await page.locator('#chat-input').click();
        await page.locator('#chat-input').fill('/qa-animation-ready');
        await page.locator('#chat-input').press('Enter');
        await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(sequence);
    }

    async function cast() {
        await ready();
        const before = await page.evaluate(() => ({ ids: Object.keys(window.__seraphQA.births), results: window.__seraphQA.results.length }));
        const slot = await page.evaluate(() => window.game.player.hotbar.indexOf('Avenging Seraph'));
        await page.keyboard.press(String(slot+1));
        await expect.poll(() => page.evaluate(() => window.__seraphQA.results.length)).toBe(before.results+1);
        expect(await page.evaluate(() => window.__seraphQA.results.at(-1))).toMatchObject({ accepted: true });
        await expect.poll(() => page.evaluate(ids => Object.keys(window.__seraphQA.births).filter(id => !ids.includes(id)).length, before.ids)).toBe(1);
        const id = await page.evaluate(ids => Object.keys(window.__seraphQA.births).find(id => !ids.includes(id)), before.ids);
        await expect.poll(() => page.evaluate(id => {
            const game = window.game, actor = game.remotePlayers.get(id);
            if (!actor?.mesh) return false;
            let renderedMeshes = 0;
            actor.mesh.traverse(child => { if (child.isMesh && child.visible && child.geometry) renderedMeshes++; });
            return actor.isActive && actor.mesh.visible && actor.mesh.parent !== null && renderedMeshes > 3;
        }, id)).toBe(true);
        return id;
    }

    async function lifetime(rank) {
        const id = await cast();
        const duration = 15*(1+.02*rank);
        // Separate the summoned silhouette from its owner after the birth
        // flash, using normal movement rather than repositioning either actor.
        await walk(0, -7);
        await expect.poll(() => page.evaluate(id => {
            const game = window.game, summon = game.remotePlayers.get(id);
            return summon ? summon.position.distanceTo(game.player.position) : 100;
        }, id)).toBeLessThan(4);
        await page.screenshot({ path: testInfo.outputPath(`seraph-town-technique-${rank}.png`) });
        // Observe real server time; never change clocks or summon state.
        if (rank > 0) {
            const age = await page.evaluate(id => performance.now()-window.__seraphQA.births[id], id);
            await page.waitForTimeout(Math.max(0, 15_250-age));
            expect(await page.evaluate(id => window.game.remotePlayers.has(id), id)).toBe(true);
        }
        await expect.poll(() => page.evaluate(id => window.__seraphQA.removals[id] || 0, id), { timeout: 19_000 }).toBeGreaterThan(0);
        const elapsed = await page.evaluate(id => (window.__seraphQA.removals[id]-window.__seraphQA.births[id])/1000, id);
        expect(elapsed).toBeGreaterThan(duration-.8);
        expect(elapsed).toBeLessThan(duration+1);
        console.log(`[seraph-lifetime] rank ${rank}: ${elapsed.toFixed(2)} seconds, expected ${duration}`);
    }

    async function attack(rank, label) {
        await useVerdantQAWaypoint(page);
        await page.waitForTimeout(1100);
        // Keep the approach ground inside the canvas rather than projecting
        // eight-unit backward steps beneath the bottom HUD at close zoom.
        await zoomOutForPortal(page);
        // Leave the entrance facade before fighting so the model and impacts
        // can actually be inspected, not merely counted behind architecture.
        // moveByGroundClick returns after initial movement, not arrival at the
        // clicked point. Prove the exit coordinate instead of counting clicks.
        for (let step = 0; step < 20; step++) {
            const z = await page.evaluate(() => window.game.player.position.z);
            if (z >= 240) break;
            await walk(0, 10, { minimumDistance: 5, timeout: 3_000 });
        }
        expect(await page.evaluate(() => window.game.player.position.z),
            'Seraph combat must leave the Verdant entrance facade').toBeGreaterThanOrEqual(240);
        let target = await projectNearestHostile(page, 'InfernoTitan');
        for (let step = 0; !target && step < 12; step++) {
            // The population is randomized. Navigate toward an observed live
            // Titan, then require ordinary rendered acquisition; do not assume
            // twelve short movements along +Z will bring one onto the canvas.
            const offset = await page.evaluate(() => {
                const game = window.game, player = game.player;
                const nearest = [...game.remotePlayers.values()]
                    .filter(e => (e.subType || e.constructor?.name) === 'InfernoTitan' &&
                        e.state !== 'DEAD' && (e.health ?? e.stats?.hp ?? 0) > 0)
                    .sort((a, b) => a.position.distanceTo(player.position)-b.position.distanceTo(player.position))[0];
                if (!nearest) return { x: 0, z: 10 };
                const dx = nearest.position.x-player.position.x, dz = nearest.position.z-player.position.z;
                const scale = Math.min(10, Math.hypot(dx, dz))/Math.max(1, Math.hypot(dx, dz));
                return { x: dx*scale, z: dz*scale };
            });
            await walk(offset.x, offset.z);
            target = await projectNearestHostile(page, 'InfernoTitan');
        }
        if (!target) {
            console.log('[seraph-target-search]', JSON.stringify(await page.evaluate(() => {
                const game = window.game, p = game.player;
                return { player: { x: p.position.x, z: p.position.z, state: p.state },
                    activeCount: game.activeEntitiesCache?.length,
                    nearby: [...game.remotePlayers.values()]
                        .filter(e => (e.subType || e.constructor?.name) === 'InfernoTitan')
                        .map(e => ({ id: e.id, x: e.position.x, z: e.position.z,
                            distance: e.position.distanceTo(p.position), state: e.state,
                            hp: e.health ?? e.stats?.hp, active: e.isActive,
                            rendered: Boolean(e.mesh?.parent), cached: game.activeEntitiesCache?.includes(e) }))
                        .sort((a, b) => a.distance-b.distance).slice(0, 8) };
            })));
            await page.screenshot({ path: testInfo.outputPath(`seraph-target-search-${label}.png`) });
        }
        expect(target).not.toBeNull();
        for (let step = 0; step < 15; step++) {
            const offset = await page.evaluate(id => {
                const enemy = window.game.remotePlayers.get(id), player = window.game.player;
                return enemy ? { x: enemy.position.x-player.position.x, z: enemy.position.z-player.position.z } : null;
            }, target.id);
            expect(offset).not.toBeNull();
            const distance = Math.hypot(offset.x, offset.z);
            if (distance < 10) break;
            const scale = Math.min(8, distance-7)/distance;
            await walk(offset.x*scale, offset.z*scale);
        }
        const expected = await page.evaluate(rank => {
            const p = window.game.player;
            return Math.floor(Math.floor((50+2*p.stats.wisdom)*(1+.04*rank)+1e-9)*(1+(p.stats.holyDamageBonus || 0)));
        }, rank);
        const id = await cast();
        await expect.poll(() => page.evaluate(id => window.__seraphQA.hits.filter(hit => hit.sourceId === id).length, id)).toBeGreaterThan(1);
        const hits = await page.evaluate(id => window.__seraphQA.hits.filter(hit => hit.sourceId === id), id);
        expect(hits.some(hit => hit.amount === expected), 'real summon must deliver the trained noncritical smite').toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`seraph-combat-${label}.png`) });
        console.log(`[seraph-combat] ${label}: rank ${rank}, expected ${expected}, observed ${hits.map(hit => hit.amount).join(',')}`);
        await returnToTown(page);
        // Recalling within the same overworld need not invalidate the owner.
        // Allow the old summon to expire before the next independent cast.
        await expect.poll(() => page.evaluate(id => window.game.remotePlayers.has(id), id), { timeout: 19_000 }).toBe(false);
    }

    await observe();
    await lifetime(0);
    await attack(0, 'baseline');
    await page.keyboard.press('k');
    await skills.getByRole('button', { name: 'Talents', exact: true }).click();
    for (const [id, title] of [['CLR_17', 'Avenging Seraph - Mastery'], ['CLR_18', 'Avenging Seraph - Technique']]) {
        for (let rank = 1; rank <= 5; rank++) {
            const node = skills.locator('.skill-node').filter({ has: page.locator('.skill-node-title', { hasText: title }) });
            // click retries through normal authoritative rerenders; waiting on
            // the optimistic local rank alone can race the server's refresh.
            await node.click();
            await expect.poll(() => page.evaluate(id => window.__seraphQA.ranks[id], id)).toBe(rank);
        }
    }
    await page.locator('#btn-close-skills').click();
    await lifetime(5);
    await attack(5, 'trained');
    await page.reload({ waitUntil: 'networkidle' });
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => [window.game.player.talentRanks?.CLR_17, window.game.player.talentRanks?.CLR_18])).toEqual([5, 5]);
    await observe();
    await attack(5, 'saved');
    let dungeonSummon;
    await enterAndExitDungeon(page, { resetRun: true, beforeExit: async () => { dungeonSummon = await cast(); } });
    await expect.poll(() => page.evaluate(id => window.game.remotePlayers.has(id), dungeonSummon)).toBe(false);
    console.log('[seraph-transition] ordinary dungeon recall removes the summoned replica');
    expect(failures, failures.join('\n')).toEqual([]);
});
