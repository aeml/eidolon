import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, openGame, projectEntity } from './helpers.js';
import { openDungeonGuide } from './dungeon-guide.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 15_000 });

function seedForgeFixture(username) {
    const container = process.env.EIDOLON_E2E_FORGE_MONGO_CONTAINER;
    const port = process.env.EIDOLON_E2E_FORGE_MONGO_PORT;
    if (!/^eidolon-isolated-qa-mongo-[a-z0-9_.-]+$/.test(container || '') || !/^\d+$/.test(port || '') ||
        process.env.EIDOLON_E2E_REGISTER !== '1' || !/^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(process.env.EIDOLON_E2E_WS_URL || '')) {
        throw new Error('Forge fixture requires disposable local Mongo and a loopback QA server');
    }
    const item = { id: 'forge-staff', name: 'Wooden Staff', type: 'WEAPON', slot: 'mainHand',
        rarity: 'Common', level: 30, potency: 0, stats: { damage: 30 }, stat_scale_version: 1 };
    const inventory = [
        { id: 'forge-shards', name: 'Eidolon Shard', type: 'MATERIAL', rarity: 'Common', level: 1, stack: 11, max_stack: 999 },
        { id: 'forge-hearts', name: 'Eidolon Heart', type: 'MATERIAL', rarity: 'Common', level: 1, stack: 3, max_stack: 999 }
    ];
    const character = { name: username, class: 'Wizard', level: 100, xp: 0, gold: 0,
        x: -20, y: 0, z: 216, stats: { strength: 10, dexterity: 10, intelligence: 10, wisdom: 10, vitality: 10 },
        inventory, equipment: { mainHand: item }, stash: [], quests: [], unlocked_skills: ['Fireball'] };
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
    } catch {
        throw new Error('Could not seed disposable forge fixture');
    }
}

test('forge purchases refresh the open selection and guide choices match dungeon families', async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    test.skip(!process.env.EIDOLON_E2E_FORGE_MONGO_CONTAINER, 'Requires the isolated forge fixture');
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL);
    await openGame(page);
    await page.locator('#auth-username').fill(credentials.username);
    await page.locator('#auth-password').fill(credentials.password);
    await page.locator('#auth-email').fill(`${credentials.username}@example.invalid`);
    await page.locator('#btn-register').click();
    await expect(page.locator('#auth-status')).toContainText('Registration successful');
    // Explicit functional fixture, not earned progression. Only normal UI purchases follow.
    seedForgeFixture(credentials.username);
    await loginAndEnterWorld(page, credentials);
    async function interact(id, selector) {
        let point;
        await expect.poll(async () => { point = await projectEntity(page, id); return point?.visible; }).toBe(true);
        await page.mouse.click(point.x, point.y);
        try {
            await expect(page.locator(selector)).toBeVisible({ timeout: 30_000 });
        } catch (error) {
            console.log('[forge-guide] interaction diagnostic', JSON.stringify(await page.evaluate(id => {
                const game = window.game, entity = game.remotePlayers.get(id);
                return { id, player: game.player.position.toArray(), state: game.player.state,
                    target: game.player.targetPosition?.toArray(), pending: game.pendingInteraction?.id,
                    hovered: game.hoveredEntity?.id, entity: entity?.position.toArray(),
                    range: entity && game.getInteractionRangeForEntity(entity),
                    forgeOpen: game.uiManager.forge.isOpen, paused: game.uiManager.isEscMenuOpen };
            }, id)));
            throw error;
        }
    }
    await interact('forge-1', '#forge-screen');
    await page.locator('#forge-equipment-list [data-slot="mainHand"]').click();
    await page.locator('#btn-forge-upgrade-1').click();
    await expect(page.locator('#forge-equipment-list .level-indicator')).toHaveText('Lvl 31');
    await expect(page.locator('#forge-upgrade-stats')).toContainText('Level: 31');
    await page.locator('#btn-forge-upgrade-10').click();
    await expect(page.locator('#forge-equipment-list .level-indicator')).toHaveText('Lvl 41');
    await expect(page.locator('#forge-upgrade-stats')).toContainText('Shards Available: 0');
    await expect(page.locator('#btn-forge-upgrade-1')).toBeDisabled();
    await page.locator('#tab-forge-potency').click();
    await page.locator('#forge-potency-list [data-slot="mainHand"]').click();
    await page.locator('#btn-forge-potency').click();
    await expect(page.locator('#forge-potency-stats')).toContainText('Potency: +1');
    await expect(page.locator('#forge-potency-cost-value')).toHaveText('2');
    await page.locator('#btn-forge-potency').click();
    await expect(page.locator('#forge-potency-stats')).toContainText('Potency: +2');
    await expect(page.locator('#forge-potency-cost-value')).toHaveText('4');
    await expect(page.locator('#forge-potency-stats')).toContainText('Hearts Available: 0');
    await expect(page.locator('#btn-forge-potency')).toBeDisabled();
    await expect(page.locator('#forge-panel-potency')).toBeVisible();
    expect(await page.evaluate(() => window.game.uiManager.forge.selectedForgePotencySlot)).toBe('mainHand');
    const savedItem = await page.evaluate(() => JSON.parse(JSON.stringify(window.game.player.equipment.mainHand)));
    await page.locator('#btn-close-forge').click();
    await page.keyboard.press('Escape');
    await page.reload({ waitUntil: 'networkidle' });
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => JSON.parse(JSON.stringify(window.game.player.equipment.mainHand)))).toEqual(savedItem);
    expect(await page.evaluate(() => window.game.player.inventory.filter(Boolean))).toEqual([]);
    // The guide can be outside the forge-side viewport; walk toward it with
    // the existing ordinary-ground-click route before attempting interaction.
    await openDungeonGuide(page);
    for (const [type, levels] of [['molten_core', ['70', '80', '90', '100']],
        ['tempest_spire', ['70', '80', '90', '100']], ['abyssal_well', ['60', '70', '80', '90', '100']]]) {
        await page.locator('#dungeon-type-select').selectOption(type);
        expect(await page.locator('#dungeon-run-level-select option').evaluateAll(options => options.map(option => option.value))).toEqual(levels);
        await expect(page.locator('#btn-enter-dungeon')).toBeEnabled();
    }
    await page.locator('#btn-close-dungeon-menu').click();
    expect(failures, failures.join('\n')).toEqual([]);
    console.log('[forge-guide] +1/+10 levels, two potency ranks, live costs, selected tab, saved item and family choices passed');
});
