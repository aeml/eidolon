import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld,
    openGame, projectEntity } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

async function registerFixture(page, credentials, observer = false) {
    const container = process.env.EIDOLON_E2E_SOCKET_MONGO_CONTAINER;
    const port = process.env.EIDOLON_E2E_SOCKET_MONGO_PORT;
    if (!/^eidolon-isolated-qa-mongo-[a-z0-9_.-]+$/.test(container || '') || !/^\d+$/.test(port || '') ||
        process.env.EIDOLON_E2E_REGISTER !== '1' ||
        !/^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(process.env.EIDOLON_E2E_WS_URL || '')) {
        throw new Error('Socket fixture requires disposable local Mongo and loopback QA');
    }
    await openGame(page);
    await page.locator('#auth-username').fill(credentials.username);
    await page.locator('#auth-password').fill(credentials.password);
    await page.locator('#auth-email').fill(`${credentials.username}@example.invalid`);
    await page.locator('#btn-register').click();
    await expect(page.locator('#auth-status')).toContainText('Registration successful');
    const sword = { id: 'socket-appearance-sword', name: 'Iron Sword', type: 'WEAPON', slot: 'mainHand',
        rarity: 'Rare', level: 30, stats: { damage: 9 }, stat_scale_version: 1, sockets: 1,
        gems: [{ type: 'Ruby', quality: 'Flawed', stats: { strength: 2 } }] };
    const gem = { id: 'socket-appearance-sapphire', name: 'Flawed Sapphire', type: 'GEM', slot: 'gem',
        rarity: 'Common', level: 1, stack: 1, max_stack: 20, gem_type: 'Sapphire', gem_quality: 'Flawed',
        stats: { intelligence: 2 }, stat_scale_version: 1 };
    const character = { name: credentials.username, class: 'Wizard', level: 30, progression_version: 2,
        xp: 0, gold: 0, x: observer ? -17 : -20, y: 0, z: 216,
        stats: { strength: 10, dexterity: 10, intelligence: 10, wisdom: 10, vitality: 10 },
        inventory: observer ? [] : [gem], equipment: observer ? {} : { mainHand: sword },
        stash: [], quests: [], unlocked_skills: ['Fireball'] };
    const script = `
        if (!db.getSiblingDB('admin').auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) throw Error('Fixture auth failed');
        const r = db.getSiblingDB('eidolon').users.updateOne(
            { username: ${JSON.stringify(credentials.username)}, 'characters.0': { $exists: false } },
            { $set: { characters: [${JSON.stringify(character)}] } });
        if (r.matchedCount !== 1 || r.modifiedCount !== 1) throw Error('Requires one newly registered empty account');
    `;
    try {
        execFileSync('docker', ['exec', '-i', container, 'mongosh', '--quiet', '--port', port, '--file', '/dev/stdin'],
            { input: script, stdio: ['pipe', 'pipe', 'pipe'], timeout: 20_000 });
    } catch { throw new Error('Could not seed disposable socket appearance fixture'); }
    await loginAndEnterWorld(page, credentials);
}

const appearance = (page, id = null) => page.evaluate(id => {
    const game = window.game, actor = id ? game.remotePlayers.get(id) : game.player;
    const root = actor?.mesh?.getObjectByName('EquippedVisual_mainHand');
    const socket = root?.getObjectByName('Gear_Socket1');
    const back = root?.getObjectByName('Gear_SocketBack1');
    return { itemId: root?.userData.itemId ?? null, uuid: root?.uuid ?? null,
        color: socket?.material?.color?.getHex() ?? null, backColor: back?.material?.color?.getHex() ?? null,
        gem: actor?.equipment?.mainHand?.gems?.[0]?.type ?? null };
}, id);

async function expectSocket(page, color, gem, id = null) {
    await expect.poll(() => appearance(page, id)).toMatchObject({ itemId: 'socket-appearance-sword',
        color, backColor: color, gem });
    return appearance(page, id);
}

async function openForge(page) {
    await expect.poll(() => page.evaluate(() => {
        const game = window.game;
        return game.player.state === 'IDLE' && !game.player.targetPosition &&
            Math.hypot(game.renderSystem.cameraTarget.x - game.player.position.x,
                game.renderSystem.cameraTarget.z - game.player.position.z) < .05;
    })).toBe(true);
    let point;
    await expect.poll(async () => {
        point = await projectEntity(page, 'forge-1');
        if (!point?.visible) return false;
        await page.mouse.move(point.x, point.y);
        return page.evaluate(() => window.game.hoveredEntity?.id === 'forge-1');
    }).toBe(true);
    await page.mouse.click(point.x, point.y);
    await expect(page.locator('#forge-screen')).toBeVisible();
    await page.locator('#tab-forge-gems').click();
}

test('ordinary Forge gem replacement updates local and observer sockets, bag icon and saved equipment', async ({ page, browser, baseURL }) => {
    test.skip(!process.env.EIDOLON_E2E_SOCKET_MONGO_CONTAINER, 'Explicit isolated socket fixture only');
    test.setTimeout(240_000);
    const owner = credentialsFromEnvironment(), other = credentialsFromEnvironment('_SECONDARY');
    expect(Boolean(owner.username && owner.password && other.username && other.password)).toBe(true);
    const failures = collectBrowserFailures(page, baseURL);
    await registerFixture(page, owner);
    const ownerID = await page.evaluate(() => window.game.player.id);
    const context = await browser.newContext({ baseURL });
    try {
        const observer = await context.newPage();
        const remoteFailures = collectBrowserFailures(observer, baseURL);
        await registerFixture(observer, other, true);
        const original = await expectSocket(page, 0xc42e36, 'Ruby');
        const originalRemote = await expectSocket(observer, 0xc42e36, 'Ruby', ownerID);
        await openForge(page);
        const oldIcon = await page.locator('#forge-gem-equipment .inv-slot').first().evaluate(el => el.style.backgroundImage);
        expect(oldIcon).not.toBe('none');
        await page.locator('#tab-gem-remove').click();
        await page.locator('#forge-gem-remove-equipment .inv-slot').first().click();
        await page.locator('#forge-gem-remove-slots > div').first().click();
        await page.locator('#btn-forge-remove-gem').click();
        await expect.poll(() => appearance(page).then(state => state.gem)).toBeNull();
        await expect.poll(() => appearance(observer, ownerID).then(state => state.gem)).toBeNull();
        await page.locator('#tab-gem-insert').click();
        await page.locator('#forge-gem-equipment .inv-slot').first().click();
        await page.locator('#forge-gem-inventory .inv-slot').first().click();
        await page.locator('#forge-gem-socket-slots [title="Empty socket"]').click();
        await page.locator('#btn-forge-insert-gem').click();
        const updated = await expectSocket(page, 0x315fc5, 'Sapphire');
        const updatedRemote = await expectSocket(observer, 0x315fc5, 'Sapphire', ownerID);
        expect(updated.uuid).not.toBe(original.uuid);
        expect(updatedRemote.uuid).not.toBe(originalRemote.uuid);
        await expect.poll(() => page.evaluate(() => window.game.player.inventory.filter(Boolean).length)).toBe(0);
        // The open Forge must show the socketed item, not its optimistic empty
        // socket state. Read the ordinary item icon resolver as an oracle only.
        const expectedIcon = await page.evaluate(() => window.game.uiManager.getItemIconPath(window.game.player.equipment.mainHand));
        expect(decodeURIComponent(expectedIcon)).toContain('#3566cc');
        await expect.poll(() => page.locator('#forge-gem-equipment .inv-slot').first()
            .evaluate((el, source) => el.style.backgroundImage.includes(source), expectedIcon)).toBe(true);
        const newIcon = await page.locator('#forge-gem-equipment .inv-slot').first().evaluate(el => el.style.backgroundImage);
        expect(newIcon).toContain(expectedIcon);
        expect(newIcon).not.toBe(oldIcon);
        await page.locator('#btn-close-forge').click();
        await page.keyboard.press('c');
        await page.locator('#slot-mainhand').click();
        await expect.poll(() => page.evaluate(() => window.game.player.inventory.some(item => item?.id === 'socket-appearance-sword'))).toBe(true);
        await page.keyboard.press('i');
        const index = await page.evaluate(() => window.game.player.inventory.findIndex(item => item?.id === 'socket-appearance-sword'));
        const bagSlot = page.locator('#inventory-grid .inv-slot').nth(index);
        await expect.poll(() => bagSlot.locator(':scope > div').first().evaluate(el => el.style.backgroundImage)).toBe(newIcon);
        await bagSlot.click();
        await expectSocket(page, 0x315fc5, 'Sapphire');
        await expectSocket(observer, 0x315fc5, 'Sapphire', ownerID);
        await loginAndEnterWorld(page, owner);
        await expectSocket(page, 0x315fc5, 'Sapphire');
        await expectSocket(observer, 0x315fc5, 'Sapphire', ownerID);
        expect(await page.evaluate(() => window.game.player.gold)).toBe(0);
        expect(failures, failures.join('\n')).toEqual([]);
        expect(remoteFailures, remoteFailures.join('\n')).toEqual([]);
        console.log('[forge-socket-appearance] normal removal/insertion, consumed loose gem, refreshed owner/actual observer meshes, bag icon and fresh-login equipment passed');
    } finally { await context.close(); }
});
