import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, openGame, projectEntity } from './helpers.js';
import { openIlyra } from './chronicle-earth-route.js';
import { earnInvestigation } from './chronicle-investigation-route.js';
import { createEarnedWizardDefense } from './earned-wizard-defense.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 20_000 });

async function clearPursuingHostiles(page, site, beforeCombat) {
    const engaged = new Set();
    await expect.poll(async () => {
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
    }, { timeout: 180_000, intervals: [250], message: `Clear ordinary pursuers before inspecting ${site.id}` }).toBe(true);
    if (engaged.size) console.log(`[water-site-combat] ${site.id}: engaged ${engaged.size} actual pursuers; nearby hostile area cleared`);
}

function seedReturningCharacter(username) {
    const container = process.env.EIDOLON_E2E_INVESTIGATION_MONGO_CONTAINER;
    const port = process.env.EIDOLON_E2E_INVESTIGATION_MONGO_PORT;
    if (!/^eidolon-isolated-qa-mongo-[a-z0-9_.-]+$/.test(container || '') || !/^\d+$/.test(port || '') ||
        process.env.EIDOLON_E2E_REGISTER !== '1' || !/^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(process.env.EIDOLON_E2E_WS_URL || '')) {
        throw new Error('Returning-story fixture requires disposable authenticated local Mongo and loopback QA');
    }
    // Explicit old-save functional fixture through the four original dungeons.
    // No investigation or raid is seeded. This is not earned leveling evidence.
    const milestones = [
        ['chronicle_01_bell_below', 'KILL', 'Skeleton', 3],
        ['chronicle_02_seeds_first_grove', 'COLLECT', 'Verdant Memory Seed', 4],
        ['chronicle_03_roots_remember', 'KILL', 'HollowSentinel', 1],
        ['chronicle_04_pearls_without_tides', 'COLLECT', 'Moon-Tide Pearl', 4],
        ['chronicle_05_drowned_name', 'KILL', 'Thalorath', 1],
        ['chronicle_06_ash_refuses_cool', 'COLLECT', 'Cinderheart Ore', 4],
        ['chronicle_07_crown_of_embers', 'KILL', 'LordInfernax', 1],
        ['chronicle_08_feathers_thunder', 'COLLECT', 'Stormglass Pinion', 4],
        ['chronicle_09_sky_answers', 'KILL', 'Zephyrion', 1]
    ];
    const character = { name: username, class: 'Wizard', level: 100, xp: 0, gold: 0,
        x: -1.25, y: 0, z: 200,
        // Canonical Wizard level-100 growth and a common level-100 staff
        // (round(12 * (1 + 100 * .15) / 25) = 8 damage), without talents.
        stats: { strength: 208, dexterity: 109, intelligence: 119, wisdom: 109, vitality: 208 },
        inventory: [], stash: [], unlocked_skills: ['Fireball'],
        equipment: { mainHand: { id: 'returning-staff', name: 'Wooden Staff', type: 'WEAPON', slot: 'mainHand',
            rarity: 'Common', level: 100, potency: 0, stats: { damage: 8 }, stat_scale_version: 1 } },
        quests: milestones.map(([id, type, target, count], index) => ({ id, type, target, count, max_count: count,
            accepted: true, completed: true, category: 'chronicle', chapter: index + 1, reward_xp: 0, reward_gold: 0 })) };
    const script = `
        if (!db.getSiblingDB('admin').auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) throw Error('Fixture auth failed');
        const result = db.getSiblingDB('eidolon').users.updateOne(
            { username: ${JSON.stringify(username)}, 'characters.0': { $exists: false } },
            { $set: { characters: [${JSON.stringify(character)}] } });
        if (result.matchedCount !== 1 || result.modifiedCount !== 1) throw Error('Requires one newly registered empty account');
    `;
    try {
        execFileSync('docker', ['exec', '-i', container, 'mongosh', '--quiet', '--port', port, '--file', '/dev/stdin'],
            { input: script, stdio: ['pipe', 'pipe', 'pipe'], timeout: 20_000 });
    } catch { throw new Error('Could not seed disposable returning-story fixture'); }
}

test('returning character earns Water records through ordinary travel and manual catch-up turn-ins', async ({ page, baseURL }, testInfo) => {
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
    const beforeCombat = await createEarnedWizardDefense(page);
    const ids = ['chronicle_water_flood_shelter', 'chronicle_water_false_reflection'];
    for (const id of ids) {
        const initial = await page.evaluate(id => window.game.player.quests.find(q => q.id === id), id);
        expect(initial.legacyOptional).toBe(true);
        expect(initial.accepted).toBe(false);
        expect(initial.investigationMask || 0).toBe(0);
        await earnInvestigation(page, id, openIlyra,
            (site, stage) => page.screenshot({ path: testInfo.outputPath(`${site.id}-${stage}.png`) }), {
                waypoints: [[0, 230], [55, 230], [80, 200], [125, 200], [145, -200], [145, -550], [0, -575], [0, -625]],
                beforeInspect: site => clearPursuingHostiles(page, site, beforeCombat),
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
    console.log('[water-investigations] local veteran fixture; actual field discoveries, manual rewards and reconnect passed');
    expect(failures, failures.join('\n')).toEqual([]);
});
