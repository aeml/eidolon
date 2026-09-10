import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { upgradeEarnedEquipment, readEarnedGear } from './earned-equipment-upgrades.js';
import { upgradeEarnedStoredEquipment } from './earned-stash-upgrades.js';
import { openEarnedStash, storeEarnedSpareEquipment } from './earned-stash-storage.js';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, openGame } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 15_000 });

// Explicit interface/persistence fixture, NEVER earned progression evidence.
// Refuse nonlocal servers and anything but a newly registered empty account.
function seedUpgradeFixture(username) {
    const container = process.env.EIDOLON_E2E_UPGRADES_MONGO_CONTAINER;
    const port = process.env.EIDOLON_E2E_UPGRADES_MONGO_PORT;
    if (!/^eidolon-isolated-qa-mongo-[a-z0-9_.-]+$/.test(container || '') || !/^\d+$/.test(port || '') ||
        process.env.EIDOLON_E2E_REGISTER !== '1' || !/^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(process.env.EIDOLON_E2E_WS_URL || '')) {
        throw new Error('Equipment fixture requires disposable Mongo and a loopback QA server');
    }
    const gear = (id, slot, stats, level = 1) => ({ id, name: slot === 'mainHand' ? 'Wooden Staff' : 'Ring',
        type: slot === 'mainHand' ? 'WEAPON' : 'ACCESSORY', slot, stats, level, rarity: 'Common',
        value: level * 25, stack: 1, max_stack: 1, stat_scale_version: 1 });
    const inventory = [gear('upgrade-staff', 'mainHand', { damage: 4 }),
        gear('upgrade-ring', 'ring', { intelligence: 4 }),
        gear('future-staff', 'mainHand', { damage: 100 }, 2),
        ...Array.from({ length: 22 }, (_, index) => ({ id: `upgrade-material-${index}`,
            name: 'Eidolon Shard', type: 'MATERIAL', slot: 'material', level: 1,
            rarity: 'Common', stack: 1, max_stack: 999, stat_scale_version: 1 }))];
    const character = { name: username, class: 'Wizard', level: 1, xp: 0, gold: 0,
        x: -1.25, y: 0, z: 200, stats: { strength: 10, dexterity: 10, intelligence: 10, wisdom: 10, vitality: 10 },
        inventory, equipment: { mainHand: gear('old-staff', 'mainHand', { damage: 1 }),
            ring1: gear('strong-ring', 'ring', { intelligence: 8 }), ring2: gear('old-ring', 'ring', { intelligence: 1 }) },
        stash: [gear('stored-ring', 'ring', { intelligence: 7 })], quests: [], unlocked_skills: ['Fireball'] };
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
        throw new Error('Could not seed disposable equipment upgrade fixture');
    }
}

test('normal full-bag upgrades target paired slots and preserve all items after login', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(180_000);
    test.skip(!process.env.EIDOLON_E2E_UPGRADES_MONGO_CONTAINER, 'Requires the isolated equipment fixture');
    expect(testInfo.retry).toBe(0);
    const credentials = credentialsFromEnvironment();
    credentials.username += `-${testInfo.repeatEachIndex}`;
    const failures = collectBrowserFailures(page, baseURL);
    await openGame(page);
    await page.locator('#auth-username').fill(credentials.username);
    await page.locator('#auth-password').fill(credentials.password);
    await page.locator('#auth-email').fill(`${credentials.username}@example.invalid`);
    await page.locator('#btn-register').click();
    await expect(page.locator('#auth-status')).toContainText('Registration successful');
    seedUpgradeFixture(credentials.username);
    await loginAndEnterWorld(page, credentials);
    expect((await readEarnedGear(page)).inventory.filter(item => item?.id)).toHaveLength(25);
    await page.keyboard.press('c');
    await expect(page.locator('#character-sheet')).toBeVisible();
    for (const id of ['slot-mainhand', 'slot-ring2']) {
        expect(await page.locator(`#${id}`).evaluate(slot => {
            const rect = slot.getBoundingClientRect();
            return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === slot;
        }), 'Decorative equipment artwork must not split the native drop target').toBe(true);
    }
    await page.locator('#btn-close-character').click();
    await page.evaluate(() => {
        window.__gearDragEvents = [];
        window.__gearRefreshes = 0;
        const refreshed = new Set();
        for (const type of ['dragstart', 'dragenter', 'dragover', 'drop', 'dragend']) {
            document.addEventListener(type, event => {
                const target = event.target.closest?.('.inv-slot, .equip-slot');
                if (target) window.__gearDragEvents.push({ type, id: target.id, classes: target.className,
                    data: ['dragstart', 'drop'].includes(type) ? event.dataTransfer?.getData('text/plain') : null });
                if (window.__gearDragEvents.length > 60) window.__gearDragEvents.shift();
                if (type === 'dragstart') refreshed.clear();
                const slots = { 'slot-mainhand': ['mainHand', 'MAIN HAND'], 'slot-ring2': ['ring2', 'RING 2'] };
                if (type === 'dragover' && slots[target?.id] && !refreshed.has(target.id)) {
                    refreshed.add(target.id);
                    const [slot, label] = slots[target.id];
                    // Exercise a real UI refresh DURING the gesture, as a health/
                    // mana update does. No player state or network action is injected.
                    window.game.uiManager.inventory.updateEquipSlot(target.id, window.game.player.equipment[slot], label, slot);
                    window.__gearRefreshes++;
                }
            }, true);
        }
    });
    let receipts;
    try {
        receipts = await upgradeEarnedEquipment(page);
    } catch (error) {
        console.log('[equipment-upgrade-fixture-failure]', JSON.stringify({ gear: await readEarnedGear(page),
            events: await page.evaluate(() => window.__gearDragEvents) }));
        await page.screenshot({ path: testInfo.outputPath('upgrade-failure.png') });
        throw error;
    }
    expect(receipts.map(({ slot }) => slot)).toEqual(['mainHand', 'ring2']);
    expect(await page.evaluate(() => window.__gearRefreshes)).toBeGreaterThanOrEqual(2);
    const prepared = await readEarnedGear(page);
    expect(prepared.equipment.mainHand.id).toBe('upgrade-staff');
    expect(prepared.equipment.ring1.id).toBe('strong-ring');
    expect(prepared.equipment.ring2.id).toBe('upgrade-ring');
    expect(prepared.inventory.filter(item => item?.id)).toHaveLength(25);
    expect(prepared.inventory.map(item => item?.id)).toEqual(expect.arrayContaining(['old-staff', 'old-ring', 'future-staff']));
    await loginAndEnterWorld(page, credentials);
    expect(await readEarnedGear(page)).toEqual(prepared);
    expect(await upgradeEarnedEquipment(page)).toEqual([]);
    // Storage is read through its real interaction, and full-bag failure must
    // precede any withdrawal. Make room with an ordinary preserved deposit.
    await expect(upgradeEarnedStoredEquipment(page)).rejects.toThrow('one free bag slot');
    const opened = await readEarnedGear(page);
    expect(opened.stash.some(item => item?.id === 'stored-ring')).toBe(true);
    expect(opened.inventory.filter(item => item?.id)).toHaveLength(25);
    await storeEarnedSpareEquipment(page, [{ id: 'old-ring' }], readEarnedGear);
    if (await page.locator('#inventory-screen').isVisible()) await page.locator('#btn-close-inventory').click();
    const stored = await upgradeEarnedStoredEquipment(page);
    expect(stored.withdrawn.map(item => item.id)).toEqual(['stored-ring']);
    expect(stored.upgrades.map(item => item.slot)).toEqual(['ring2']);
    const final = await readEarnedGear(page);
    expect(final.equipment.ring1.id).toBe('strong-ring');
    expect(final.equipment.ring2.id).toBe('stored-ring');
    expect(final.inventory.filter(item => item?.id)).toHaveLength(25);
    expect(final.inventory.some(item => item?.id === 'upgrade-ring')).toBe(true);
    expect(final.stash.some(item => item?.id === 'old-ring')).toBe(true);
    const owned = state => [...state.inventory, ...state.stash, ...Object.values(state.equipment)]
        .filter(item => item?.id).sort((a, b) => a.id.localeCompare(b.id));
    expect(owned(final)).toEqual(owned(opened));
    for (const key of ['level', 'gold', 'xp']) expect(final[key]).toBe(opened[key]);
    await loginAndEnterWorld(page, credentials);
    await openEarnedStash(page);
    expect(await readEarnedGear(page)).toEqual(final);
    await page.locator('#btn-close-stash').click();
    await page.locator('#btn-close-inventory').click();
    await page.keyboard.press('i');
    if (!await page.locator('#character-sheet').isVisible()) await page.keyboard.press('c');
    await expect(page.locator('#character-sheet')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('upgraded-equipment.png') });
    expect(failures, failures.join('\n')).toEqual([]);
    console.log('[equipment-upgrade-fixture] actual full-bag drags, stored upgrade, ordinary deposit/withdrawal, paired slot, exact ownership and login persistence passed; prepared fixture, not earned progression');
});
