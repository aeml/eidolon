import { seedReturningCharacter } from './chronicle-returning-fixture.js';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, openGame, projectEntity } from './helpers.js';
import { openIlyra } from './chronicle-earth-route.js';
import { earnInvestigation } from './chronicle-investigation-route.js';
import { createEarnedWizardDefense } from './earned-wizard-defense.js';
import { chronicleInvestigations } from '../../src/data/chronicleInvestigations.generated.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 20_000 });

const realm = process.env.EIDOLON_E2E_INVESTIGATION_REALM || 'water';
const realmRoutes = {
    water: [[0, 230], [55, 230], [80, 200], [125, 200], [145, -200], [145, -550], [0, -575], [0, -625]],
    fire: [[0, 230], [-55, 230], [-80, 200], [-125, 200], [-500, 200], [-900, 200], [-1030, 200], [-1130, 245]],
    air: [[0, 230], [55, 230], [80, 200], [125, 200], [500, 200], [900, 200], [1030, 200], [1110, 245]]
};
if (!Object.hasOwn(realmRoutes, realm)) throw new Error('Investigation realm must be water, fire or air');

async function clearPursuingHostiles(page, site, beforeCombat) {
    const engaged = new Set();
    try { await expect.poll(async () => {
        if (await beforeCombat()) return false;
        const state = await page.evaluate(() => {
            const game = window.game, player = game.player;
            const enemies = (game.activeEntitiesCache || []).filter(enemy => game.isHostileActorTarget(enemy) &&
                player.position.distanceTo(enemy.position) < 14);
            enemies.sort((a, b) => player.position.distanceTo(a.position) - player.position.distanceTo(b.position));
            return { dead: player.state === 'DEAD', id: enemies[0]?.id, cooldown: player.abilityCooldown };
        });
        expect(state.dead, 'Prepared returning character must survive ordinary field combat').toBe(false);
        if (!state.id) return true;
        const point = await projectEntity(page, state.id);
        if (!point?.visible) return false;
        await page.mouse.move(point.x, point.y);
        const actual = await page.evaluate(() => {
            const game = window.game;
            return game.isHostileActorTarget(game.hoveredEntity) ? game.hoveredEntity.id : null;
        });
        if (!actual) return false;
        // Actual left-click pursuit/basic attack and Wizard's right-click
        // Fireball. No despawn, invulnerability, damage or kill-credit grants.
        await page.mouse.click(point.x, point.y);
        if ((state.cooldown || 0) <= 0) await page.mouse.click(point.x, point.y, { button: 'right' });
        engaged.add(actual);
        return false;
    }, { timeout: 180_000, intervals: [250], message: `Clear ordinary pursuers before inspecting ${site.id}` }).toBe(true); } catch (error) {
        console.log(`[${realm}-site-failure]`, JSON.stringify(await page.evaluate(site => {
            const game = window.game, player = game.player;
            return { site, position: player.position.toArray(), state: player.state, health: player.stats.hp,
                maximumHealth: player.stats.maxHp, damage: player.stats.damage, shield: player.shieldHP,
                target: player.targetEntity?.id, hovered: game.hoveredEntity?.id,
                defense: window.__freshWizardDefense?.counts,
                nearby: (game.activeEntitiesCache || []).filter(enemy => game.isHostileActorTarget(enemy) &&
                    player.position.distanceTo(enemy.position) < 30).map(enemy => ({ id: enemy.id,
                    health: enemy.stats?.hp, level: enemy.level, position: enemy.position.toArray() })) };
        }, site.id)));
        throw error;
    }
    if (engaged.size) console.log(`[${realm}-site-combat] ${site.id}: engaged ${engaged.size} actual pursuers; nearby hostile area cleared`);
}

async function defeatCommandAnchor(page, site, chapter, beforeCombat) {
    const mask = () => page.evaluate(id => window.game.player.quests.find(q => q.id === id)?.investigationMask || 0, chapter.id);
    expect(await mask(), 'Ash must be genuinely recorded before the anchor fight').toBe(1);
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


test(`returning character earns ${realm} records through ordinary travel and manual catch-up turn-ins`, async ({ page, baseURL }, testInfo) => {
    test.skip(!process.env.EIDOLON_E2E_INVESTIGATION_MONGO_CONTAINER, 'Requires isolated returning-character fixture');
    test.setTimeout(900_000);
    const credentials = credentialsFromEnvironment();
    if (testInfo.retry) credentials.username += `-retry${testInfo.retry}`;
    const failures = collectBrowserFailures(page, baseURL);
    await openGame(page);
    await page.locator('#auth-username').fill(credentials.username);
    await page.locator('#auth-password').fill(credentials.password);
    await page.locator('#auth-email').fill(`${credentials.username}@example.invalid`);
    await page.locator('#btn-register').click();
    await expect(page.locator('#auth-status')).toContainText('Registration successful');
    seedReturningCharacter(credentials.username);
    await loginAndEnterWorld(page, credentials);
    // Choose the available control branch normally, then use its actual
    // defensive hotbar inputs and ordinary kiting rather than tanking a crowd.
    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    await skills.getByRole('button', { name: 'Skills', exact: true }).click();
    await skills.locator('.skill-branch').filter({ hasText: 'Control & Utility' }).getByRole('button', { name: 'Select Spec' }).click();
    await expect.poll(() => page.evaluate(() => window.game.player.selectedBranch)).toBe('C');
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.includes('Arcane Shield'))).toBe(true);
    await page.locator('#btn-close-skills').click();
    // The same ordinary Ctrl-click used during travel also permits retreat
    // when a hostile model covers the projected ground. Other hunt baselines
    // retain their existing walking-only defense default.
    const beforeCombat = await createEarnedWizardDefense(page, { allowJumpFallback: true, useCrowdControl: true });
    const chapters = chronicleInvestigations.filter(chapter => chapter.realm === realm);
    const ids = chapters.map(chapter => chapter.id);
    for (const id of ids) {
        const initial = await page.evaluate(id => window.game.player.quests.find(q => q.id === id), id);
        expect(initial.legacyOptional).toBe(true);
        expect(initial.accepted).toBe(false);
        expect(initial.investigationMask || 0).toBe(0);
        await earnInvestigation(page, id, openIlyra,
            (site, stage) => page.screenshot({ path: testInfo.outputPath(`${site.id}-${stage}.png`) }), {
                waypoints: realmRoutes[realm],
                beforeInspect: async site => {
                    if (realm === 'fire' && ['cold_ash', 'released_ember'].includes(site.id)) {
                        const released = site.id === 'released_ember';
                        await expect.poll(() => page.evaluate(() => {
                            const model = window.game.remotePlayers.get('chronicle-site-released_ember')?.siteModel;
                            return { bound: model?.boundEmber?.visible, released: model?.releasedEmber?.visible };
                        })).toEqual({ bound: !released, released });
                    }
                    await clearPursuingHostiles(page, site, beforeCombat);
                },
                defeatSite: (site, chapter) => defeatCommandAnchor(page, site, chapter, beforeCombat),
                selectChapter: async chapter => {
                    const other = page.locator('#quest-list details').filter({ has: page.locator('summary').filter({ hasText: 'Other discoveries' }) });
                    if (await other.getAttribute('open') === null) await other.locator('summary').click();
                    await other.getByRole('button', { name: chapter.title, exact: true }).click();
                }
            });
    }
    await page.reload({ waitUntil: 'networkidle' });
    await loginAndEnterWorld(page, credentials);
    for (const id of ids) {
        const quest = await page.evaluate(id => window.game.player.quests.find(q => q.id === id), id);
        expect(quest.completed).toBe(true);
        expect(quest.count).toBe(quest.maxCount);
        expect(quest.investigationMask).toBe(id === ids[0] ? 1 : 7);
        expect(quest.grantedXP || 0).toBe(0);
        expect(quest.grantedResonanceXP).toBeGreaterThan(0);
        expect(quest.grantedGold).toBeGreaterThan(0);
    }
    const saved = await page.evaluate(() => window.game.player.quests);
    expect(saved.find(q => q.id === 'chronicle_09_sky_answers').completed).toBe(true);
    expect(saved.find(q => q.id === 'chronicle_10_rootheart_raid').completed).toBe(false);
    await page.keyboard.press('j');
    await expect(page.locator('#quest-journal')).toBeVisible();
    for (const site of chapters.flatMap(chapter => chapter.sites)) {
        const record = page.locator(`#journal-list details[data-discovery-id="${site.id}"]`);
        await record.locator('summary').scrollIntoViewIfNeeded();
        if (await record.getAttribute('open') === null) await record.locator('summary').click();
        await expect(record).toHaveAttribute('open', '');
        await expect(record).toContainText(site.text.replace(/\n\s*\n/g, ''));
    }
    await page.locator('#btn-close-journal').click();
    console.log(`[${realm}-investigations] local veteran fixture; actual field discoveries, manual rewards, reconnect and journal rereading passed`);
    expect(failures, failures.join('\n')).toEqual([]);
});
