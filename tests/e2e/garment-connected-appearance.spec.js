import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { BASE_ITEMS, squishFlatItemStat } from '../../src/core/ItemSystem.js';
import { profileGameplayScene } from './scene-performance.js';
import { summarizePartyCPUProfile } from './party-cpu-summary.js';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld,
    openGame, projectEntity } from './helpers.js';

// Returning prepared characters only, against disposable authenticated Mongo.
// Purchases, selections, gear changes and reconnect use the ordinary client.
// This supplies rendered replication evidence, not earned EP or a campaign.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const legacy = { head: { baseName: 'Silk Hood', rarity: 'Rare', slot: 'head' } };
const names = { head: 'Iron Helm', chest: 'Plate Mail', legs: 'Plate Greaves',
    feet: 'Iron Boots', gloves: 'Iron Gauntlets', shoulders: 'Steel Pauldrons',
    belt: 'Plated Girdle', mainHand: 'Iron Sword', offHand: 'Wooden Shield',
    ring1: 'Ruby Ring', ring2: 'Silver Ring', neck: 'Necklace',
    trinket1: 'Amulet of Power', trinket2: 'Orb of Mana' };

async function registerReturningFixture(page, credentials, observer = false) {
    const container = process.env.EIDOLON_E2E_SOCKET_MONGO_CONTAINER;
    const port = process.env.EIDOLON_E2E_SOCKET_MONGO_PORT;
    if (!/^eidolon-isolated-qa-mongo-[a-z0-9_.-]+$/.test(container || '') || !/^\d+$/.test(port || '') ||
        process.env.EIDOLON_E2E_REGISTER !== '1' ||
        !/^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(process.env.EIDOLON_E2E_WS_URL || '')) {
        throw new Error('Garment fixture requires disposable local Mongo and loopback QA');
    }
    await page.addInitScript(() => localStorage.setItem('eidolon.graphicsQuality', 'high'));
    await openGame(page);
    await page.locator('#auth-username').fill(credentials.username);
    await page.locator('#auth-password').fill(credentials.password);
    await page.locator('#auth-email').fill(`${credentials.username}@example.invalid`);
    await page.locator('#btn-register').click();
    await expect(page.locator('#auth-status')).toContainText('Registration successful');
    const equipment = Object.fromEntries(Object.entries(names).map(([slot, name]) => {
        const base = BASE_ITEMS.find(item => item.name === name);
        if (!base) throw new Error(`Missing canonical equipment: ${name}`);
        return [slot, { id: `garment-connected-${slot}`, name, type: base.type, slot: base.slot,
            rarity: 'Common', level: 1, stack: 1, max_stack: 1, stat_scale_version: 1,
            stats: { [base.baseStat]: squishFlatItemStat(base.baseStat, base.baseValue) } }];
    }));
    const character = { name: credentials.username, class: 'Fighter', level: 30,
        progression_version: 2, xp: 0, gold: 1234, ep: observer ? 0 : 100,
        x: observer ? 15 : 12, y: 0, z: 188,
        stats: { strength: 10, dexterity: 10, intelligence: 10, wisdom: 10, vitality: 10 },
        inventory: [], equipment: observer ? {} : equipment, stash: [], quests: [],
        unlocked_skills: [], appearances: observer ? {} : legacy,
        appearance_collection: observer ? {} : { 'Silk Hood|Rare': legacy.head } };
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
    } catch { throw new Error('Could not seed disposable returning garment fixture'); }
    await page.bringToFront();
    await loginAndEnterWorld(page, credentials);
}

const renderedAppearance = (page, id = null) => page.evaluate(id => {
    const game = window.game, actor = id ? game.remotePlayers.get(id) : game.player;
    const root = actor?.mesh, held = new Set(), body = new Set();
    root?.traverse(part => {
        if (!part.userData.garmentId) return;
        (['mainHand', 'offHand'].includes(part.userData.slot) ? held : body).add(part.userData.garmentId);
    });
    return { ready: Boolean(root?.userData.equipmentVisualSignature),
        quality: root?.userData.authoredQuality, garment: root?.userData.equipmentVisualGarment,
        held: [...held].sort(), body: [...body].sort(), items: root?.userData.equipmentVisualItemCount,
        missing: root?.userData.equipmentVisualMissing || [], fallback: root?.userData.equipmentVisualFallback || [],
        appearances: actor?.appearances, equipment: actor?.equipment,
        signature: root?.userData.equipmentVisualSignature, gold: actor?.gold, ep: actor?.ep,
        level: actor?.level, xp: actor?.xp, stats: actor?.baseStats };
}, id);

async function openVeyra(page) {
    let point;
    await expect.poll(async () => {
        point = await projectEntity(page, 'vip-cosmetic-vendor');
        if (!point?.visible) return false;
        await page.mouse.move(point.x, point.y);
        return page.evaluate(() => window.game.hoveredEntity?.id === 'vip-cosmetic-vendor');
    }).toBe(true);
    await page.mouse.click(point.x, point.y);
    await expect(page.getByRole('dialog', { name: 'Veyra’s cosmetic wardrobe' })).toBeVisible();
}

async function openCharacter(page) {
    if (!await page.locator('#character-sheet').isVisible()) await page.keyboard.press('c');
    await expect(page.locator('#character-sheet')).toBeVisible();
}

async function chooseOutfit(page, key) {
    await openCharacter(page);
    await page.locator('[data-garment-slot="outfit"]').click();
    const wardrobe = page.locator('#character-sheet .wardrobe-panel');
    await expect(wardrobe.getByRole('button', { name: 'Apply appearance', exact: true })).toBeEnabled();
    await wardrobe.getByLabel('Collected appearance', { exact: true }).selectOption(key);
    await wardrobe.getByRole('button', { name: 'Apply appearance', exact: true }).click();
    await expect(wardrobe.getByRole('status')).toContainText('Appearance updated');
}

async function chooseLowQuality(page) {
    await page.bringToFront();
    await page.keyboard.press('Escape');
    await page.locator('#btn-settings').click();
    await page.locator('#graphics-quality').selectOption('low');
    await page.locator('#btn-close-settings').click();
    if (await page.locator('#btn-resume').isVisible()) await page.locator('#btn-resume').click();
    await expect.poll(() => renderedAppearance(page)).toMatchObject({ quality: 'low' });
}

test('purchased independent garments render locally and remotely through gear changes and relogin', async ({ page, browser, baseURL }, testInfo) => {
    test.skip(!process.env.EIDOLON_E2E_SOCKET_MONGO_CONTAINER, 'Explicit disposable socket fixture only');
    test.setTimeout(300_000);
    const owner = { ...credentialsFromEnvironment(), characterClass: 'Fighter' };
    const other = { ...credentialsFromEnvironment('_SECONDARY'), characterClass: 'Fighter' };
    expect(Boolean(owner.username && owner.password && other.username && other.password)).toBe(true);
    const failures = collectBrowserFailures(page, baseURL), phases = [];
    await registerReturningFixture(page, owner);
    const ownerID = await page.evaluate(() => window.game.player.id);
    const context = await browser.newContext({ baseURL });
    let observer;
    let remoteFailures = [];
    try {
        observer = await context.newPage();
        remoteFailures = collectBrowserFailures(observer, baseURL);
        await registerReturningFixture(observer, other, true);
        const renderer = await page.evaluate(() => {
            const gl = window.game.renderSystem.renderer.getContext();
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
        });
        await expect.poll(() => renderedAppearance(page)).toMatchObject({ ready: true, items: 14, garment: '', missing: [], fallback: [] });
        await expect.poll(() => renderedAppearance(observer, ownerID)).toMatchObject({ ready: true, items: 14, garment: '', missing: [], fallback: [] });
        const original = await renderedAppearance(page);
        const expected = { ...legacy };
        const hands = ['grovekeeper-blade-v1', 'grovekeeper-shield-v1'];
        let remaining = 100;
        // An outfit renders seven modeled body sections and two real held
        // slots. Real rings/neck/trinkets remain equipped but are suppressed.
        const check = async (name, garment, held = hands, items = garment ? 9 : 14) => {
            const model = { ready: true, garment, held, items, missing: [], fallback: [] };
            await expect.poll(() => renderedAppearance(page)).toMatchObject({ ...model, appearances: expected, gold: 1234, ep: remaining, level: 30, xp: 0 });
            await expect.poll(() => renderedAppearance(observer, ownerID)).toMatchObject({ ...model, appearances: expected });
            const local = await renderedAppearance(page), remote = await renderedAppearance(observer, ownerID);
            expect(local.appearances).toEqual(expected);
            expect(remote.appearances).toEqual(expected);
            expect(local.equipment).toEqual(remote.equipment);
            expect(local.signature).toBe(remote.signature);
            expect(local.stats).toEqual(original.stats);
            phases.push({ name, local, remote });
        };
        await page.bringToFront();
        await openVeyra(page);
        const vendor = page.getByRole('dialog', { name: 'Veyra’s cosmetic wardrobe' });
        for (const [id, name, slot, price] of [
            ['iron-oath-regalia-v1', 'Iron Oath Regalia', 'outfit', 25],
            ['grovekeeper-blade-v1', 'Grovekeeper Blade', 'mainHand', 15],
            ['grovekeeper-shield-v1', 'Grovekeeper Shield', 'offHand', 12]
        ]) {
            await vendor.locator(`[data-offer-id="${id}"]`).click();
            await vendor.getByRole('button', { name: `Unlock for ${price} EP`, exact: true }).click();
            await vendor.getByRole('button', { name: 'Confirm EP purchase', exact: true }).click();
            remaining -= price;
            await expect.poll(() => page.evaluate(() => window.game.player.ep)).toBe(remaining);
            await vendor.getByRole('button', { name: slot === 'outfit' ? 'Apply complete outfit' : 'Apply owned look', exact: true }).click();
            expected[slot] = { baseName: name, rarity: 'Common', slot };
            await expect.poll(() => renderedAppearance(page)).toMatchObject({ appearances: expected });
        }
        await vendor.getByRole('button', { name: 'Close', exact: true }).click();
        await check('purchased-three-independent-slots', 'iron-oath-regalia-v1');
        expect((await renderedAppearance(page)).equipment).toEqual(original.equipment);
        await openCharacter(page);
        await expect.poll(() => page.evaluate(() => window.game.uiManager.characterPreview?.model?.userData.equipmentVisualSignature))
            .toBe((await renderedAppearance(page)).signature);
        await page.screenshot({ path: testInfo.outputPath('confirmed-character-garments.png') });
        // Removing real gear under an outfit must not create a cosmetic weapon.
        await page.locator('#slot-mainhand').click();
        await check('empty-real-weapon', 'iron-oath-regalia-v1', ['grovekeeper-shield-v1'], 8);
        if (!await page.locator('#inventory-screen').isVisible()) await page.keyboard.press('i');
        const index = await page.evaluate(() => window.game.player.inventory.findIndex(item => item?.id === 'garment-connected-mainHand'));
        expect(index).toBeGreaterThanOrEqual(0);
        await page.locator('#inventory-grid .inv-slot').nth(index).click();
        await check('real-weapon-restored', 'iron-oath-regalia-v1');
        expect((await renderedAppearance(page)).equipment).toEqual(original.equipment);
        await page.locator('#btn-close-character').click();
        if (await page.locator('#inventory-screen').isVisible()) await page.keyboard.press('i');
        if (process.env.EIDOLON_E2E_GARMENT_CPU === '1') {
            await page.bringToFront();
            const frames = await profileGameplayScene(page, 'current-town-rendered-wardrobe', { phases: true });
            await testInfo.attach('current-town-wardrobe-frame-diagnosis', { body: JSON.stringify(frames), contentType: 'application/json' });
            const cdp = await page.context().newCDPSession(page);
            try {
                await cdp.send('Profiler.enable');
                await cdp.send('Profiler.start');
                await page.waitForTimeout(5000);
                const { profile } = await cdp.send('Profiler.stop');
                const summary = summarizePartyCPUProfile(profile, new URL(baseURL).origin);
                // Only allowlisted source/function/caller identities survive.
                // Never retain raw profiles, URL queries or account data.
                await testInfo.attach('current-town-wardrobe-cpu-functions', { body: JSON.stringify(summary), contentType: 'application/json' });
            } finally { await cdp.detach(); }
        }
        await chooseLowQuality(page);
        await chooseLowQuality(observer);
        await check('low-quality-local-and-remote', 'iron-oath-regalia-v1');
        await expect.poll(() => renderedAppearance(observer, ownerID)).toMatchObject({ quality: 'low' });
        await page.bringToFront();
        await loginAndEnterWorld(page, owner);
        await check('saved-selection-relogin', 'iron-oath-regalia-v1');
        await chooseOutfit(page, ''); delete expected.outfit;
        await check('clear-outfit-retains-hand-and-legacy-looks', '');
        await loginAndEnterWorld(page, owner);
        await check('cleared-outfit-relogin', '');
        expect((await renderedAppearance(page)).equipment).toEqual(original.equipment);
        expect(failures, failures.join('\n')).toEqual([]);
        expect(remoteFailures, remoteFailures.join('\n')).toEqual([]);
        await testInfo.attach('rendered-wardrobe-phases', { body: JSON.stringify({ renderer, scope: 'Prepared returning Fighter, actual local/observer models and normal UI/socket/save paths; not earned EP, all-class fit or frame-time qualification.', phases }), contentType: 'application/json' });
    } catch (error) {
        const readiness = async current => current && !current.isClosed() ? current.evaluate(() => {
            const game = window.game;
            return { visibility: document.visibilityState,
                loadingVisible: Boolean(document.getElementById('loading-screen')?.offsetParent),
                firstState: Boolean(game?._firstStateReceived), destroyed: Boolean(game?.isDestroyed),
                socketState: game?.network?.socket?.readyState,
                calls: game?.renderSystem?.renderer?.info?.render?.calls,
                triangles: game?.renderSystem?.renderer?.info?.render?.triangles,
                initialViewFrames: game?.renderSystem?._initialViewPreparation?.frames };
        }).catch(() => ({ unavailable: true })) : null;
        await testInfo.attach('wardrobe-failure-readiness', { body: JSON.stringify({
            owner: await readiness(page), observer: await readiness(observer), failures, remoteFailures
        }), contentType: 'application/json' });
        throw error;
    } finally { await context.close(); }
});
