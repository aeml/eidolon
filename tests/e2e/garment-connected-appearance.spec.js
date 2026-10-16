import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { BASE_ITEMS, squishFlatItemStat } from '../../src/core/ItemSystem.js';
import { profileGameplayScene } from './scene-performance.js';
import { profileWorldGpuTime } from './world-gpu-observation.js';
import { summarizePartyCPUProfile } from './party-cpu-summary.js';
import { requiresHardwareWebGL } from './browserLaunchPolicy.js';
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

const classGear = {
    Fighter: names,
    Rogue: { ...names, head: 'Leather Cap', chest: 'Leather Tunic', legs: 'Leather Pants',
        feet: 'Leather Boots', gloves: 'Leather Gloves', shoulders: 'Reinforced Spaulders',
        belt: 'Studded Belt', mainHand: 'Steel Dagger', offHand: 'Iron Sword' },
    Cleric: { ...names, chest: 'Robes', legs: 'Leather Pants', gloves: 'Silk Gloves',
        belt: 'Studded Belt', mainHand: 'Cleric Mace' },
    Wizard: { ...names, head: 'Silk Hood', chest: 'Robes', legs: 'Silk Skirt', feet: 'Sandals',
        gloves: 'Silk Gloves', shoulders: 'Velvet Mantle', belt: 'Silk Sash',
        mainHand: 'Wooden Staff', offHand: 'Spell Tome' }
};
const classLooks = {
    Fighter: [['iron-oath-regalia-v1', 'Iron Oath Regalia', 'outfit', 25],
        ['grovekeeper-blade-v1', 'Grovekeeper Blade', 'mainHand', 15],
        ['grovekeeper-shield-v1', 'Grovekeeper Shield', 'offHand', 12]],
    Rogue: [['nightglass-cowl-v1', 'Nightglass Cowl', 'outfit', 25],
        ['skyweaver-dagger-v1', 'Skyweaver Dagger', 'mainHand', 15],
        ['grovekeeper-blade-v1', 'Grovekeeper Blade', 'mainHand', 15]],
    Cleric: [['dawn-reliquary-v1', 'Dawn Reliquary', 'outfit', 25],
        ['tidekeeper-mace-v1', 'Tidekeeper Mace', 'mainHand', 15],
        ['grovekeeper-shield-v1', 'Grovekeeper Shield', 'offHand', 12]],
    Wizard: [['astral-sovereign-v1', 'Astral Sovereign', 'outfit', 25],
        ['hearthkeeper-staff-v1', 'Hearthkeeper Staff', 'mainHand', 15],
        ['skyweaver-tome-v1', 'Skyweaver Tome', 'offHand', 12]]
};

async function attachJSON(testInfo, name, value) {
    const path = testInfo.outputPath(`${name}.json`);
    await writeFile(path, JSON.stringify(value));
    await testInfo.attach(name, { path, contentType: 'application/json' });
}

async function registerReturningFixture(page, credentials, observer = false) {
    const container = process.env.EIDOLON_E2E_SOCKET_MONGO_CONTAINER;
    const port = process.env.EIDOLON_E2E_SOCKET_MONGO_PORT;
    if (!/^eidolon-isolated-qa-mongo-[a-z0-9_.-]+$/.test(container || '') || !/^\d+$/.test(port || '') ||
        process.env.EIDOLON_E2E_REGISTER !== '1' ||
        !/^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(process.env.EIDOLON_E2E_WS_URL || '')) {
        throw new Error('Garment fixture requires disposable local Mongo and loopback QA');
    }
    await page.addInitScript(() => {
        if (!localStorage.getItem('eidolon.graphicsQuality')) localStorage.setItem('eidolon.graphicsQuality', 'high');
    });
    await openGame(page);
    await page.locator('#auth-username').fill(credentials.username);
    await page.locator('#auth-password').fill(credentials.password);
    await page.locator('#auth-email').fill(`${credentials.username}@example.invalid`);
    await page.locator('#btn-register').click();
    await expect(page.locator('#auth-status')).toContainText('Registration successful');
    const equipment = Object.fromEntries(Object.entries(classGear[credentials.characterClass]).map(([slot, name]) => {
        const base = BASE_ITEMS.find(item => item.name === name);
        if (!base) throw new Error(`Missing canonical equipment: ${name}`);
        return [slot, { id: `garment-connected-${slot}`, name, type: base.type, slot: base.slot,
            rarity: 'Common', level: 1, stack: 1, max_stack: 1, stat_scale_version: 1,
            stats: { [base.baseStat]: squishFlatItemStat(base.baseStat, base.baseValue) } }];
    }));
    const character = { name: credentials.username, class: credentials.characterClass, level: 30,
        progression_version: 2, xp: 0, gold: 1234, ep: observer ? 0 : 100,
        x: observer ? 15 : 12, y: 0, z: 188,
        stats: { strength: 10, dexterity: 10, intelligence: 10, wisdom: 10, vitality: 10 },
        inventory: [], equipment: observer ? {} : equipment, stash: [], quests: [],
        unlocked_skills: [],
        // BSON field names differ from the ordinary wire appearance shape.
        appearances: observer ? {} : { head: { base_name: legacy.head.baseName, rarity: legacy.head.rarity, slot: 'head' } },
        appearance_collection: observer ? {} : { 'Silk Hood|Rare': { base_name: legacy.head.baseName, rarity: legacy.head.rarity, slot: 'head' } } };
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
    const root = actor?.mesh, held = new Set(), body = new Set(), heldBySlot = {};
    root?.traverse(part => {
        if (!part.userData.garmentId) return;
        (['mainHand', 'offHand'].includes(part.userData.slot) ? held : body).add(part.userData.garmentId);
        if (['mainHand', 'offHand'].includes(part.userData.slot)) {
            (heldBySlot[part.userData.slot] ||= new Set()).add(part.userData.garmentId);
        }
    });
    return { ready: Boolean(root?.userData.equipmentVisualSignature),
        actorClass: root?.userData.authoredClass,
        heldBySlot: Object.fromEntries(Object.entries(heldBySlot).map(([slot, ids]) => [slot, [...ids].sort()])),
        quality: root?.userData.authoredQuality, garment: root?.userData.equipmentVisualGarment,
        held: [...held].sort(), body: [...body].sort(), items: root?.userData.equipmentVisualItemCount,
        missing: root?.userData.equipmentVisualMissing || [], fallback: root?.userData.equipmentVisualFallback || [],
        appearances: actor?.appearances,
        // Inventory adds presentation metadata to the owner's rarity. Remote
        // wire items retain its canonical name; compare the same real rarity.
        equipment: Object.fromEntries(Object.entries(actor?.equipment || {}).map(([slot, item]) =>
            [slot, { ...item, rarity: typeof item.rarity === 'string' ? item.rarity : item.rarity?.name }])),
        signature: root?.userData.equipmentVisualSignature, gold: actor?.gold,
        level: actor?.level, xp: actor?.xp, stats: actor?.baseStats,
        // Untimed preparation context only; functional readiness is separate
        // from later gameplay-distance index preparation and frame budgets.
        worldPreparation: game.renderSystem.actorGameplayGeometry ? {
            pending: game.renderSystem.actorGameplayGeometry.delivery.jobs.size,
            installed: game.renderSystem.actorGameplayGeometry.pass.entries.size,
            reduced: game.renderSystem.actorGameplayGeometry.pass.reduced
        } : null };
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

async function chooseAppearance(page, slot, key) {
    await openCharacter(page);
    await page.locator(`[data-garment-slot="${slot}"]`).click();
    const wardrobe = page.locator('#character-sheet .wardrobe-panel');
    await expect(wardrobe.getByRole('button', { name: 'Apply appearance', exact: true })).toBeEnabled();
    await wardrobe.getByLabel('Collected appearance', { exact: true }).selectOption(key);
    await wardrobe.getByRole('button', { name: 'Apply appearance', exact: true }).click();
    await expect(wardrobe.getByRole('status')).toContainText('Appearance updated');
}

async function chooseLowQuality(page, credentials) {
    await page.bringToFront();
    await page.keyboard.press('Escape');
    await page.locator('#btn-settings').click();
    let prompt = '';
    page.once('dialog', async dialog => { prompt = dialog.message(); await dialog.dismiss(); });
    await page.locator('#graphics-quality').selectOption('low');
    expect(prompt).toContain('need a reload');
    await page.locator('#btn-close-settings').click();
    if (await page.locator('#btn-resume').isVisible()) await page.locator('#btn-resume').click();
    await expect.poll(() => page.evaluate(() => window.game.renderSystem.graphicsQuality)).toBe('low');
    // The supported UI explicitly retains owned actor meshes until reload.
    // Re-enter through the ordinary login with the saved Low preference.
    await loginAndEnterWorld(page, credentials);
    await expect.poll(() => renderedAppearance(page)).toMatchObject({ quality: 'low' });
}

async function expectPrivateWallet(page, ep) {
    await openCharacter(page);
    const wallet = page.locator('#character-sheet .ep-wallet-panel');
    if (await wallet.getAttribute('open') === null) await wallet.locator('summary').click();
    await expect(wallet.locator('[data-balance]')).toHaveText(`${ep} EP · 1,234 Gold`);
    await wallet.locator('summary').click();
}

for (const actorClass of Object.keys(classLooks)) test(`${actorClass}: purchased independent garments render locally and remotely through gear changes and relogin`, async ({ page, browser, baseURL }, testInfo) => {
    test.skip(!process.env.EIDOLON_E2E_SOCKET_MONGO_CONTAINER, 'Explicit disposable socket fixture only');
    test.setTimeout(300_000);
    const owner = { ...credentialsFromEnvironment(), characterClass: actorClass };
    owner.username += `-${actorClass.toLowerCase()}`;
    const other = { ...credentialsFromEnvironment('_SECONDARY'), characterClass: actorClass };
    other.username += `-${actorClass.toLowerCase()}`;
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
        if (requiresHardwareWebGL()) expect(renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        await expect.poll(() => renderedAppearance(page)).toMatchObject({ ready: true, items: 14, garment: '', appearances: legacy, missing: [], fallback: [] });
        await expect.poll(() => renderedAppearance(observer, ownerID)).toMatchObject({ ready: true, items: 14, garment: '', appearances: legacy, missing: [], fallback: [] });
        const original = await renderedAppearance(page);
        const expected = { ...legacy };
        const offers = classLooks[actorClass], outfitID = offers[0][0];
        const handIDs = { mainHand: offers[1][0], offHand: offers[2][0] };
        const hands = Object.values(handIDs).sort();
        let remaining = 100;
        // An outfit renders seven modeled body sections and two real held
        // slots. Real rings/neck/trinkets remain equipped but are suppressed.
        const check = async (name, garment, held = hands, items = garment ? 9 : 14) => {
            const model = { ready: true, actorClass, garment, held, items, missing: [], fallback: [],
                heldBySlot: Object.fromEntries(Object.entries(handIDs).filter(([, id]) => held.includes(id))
                    .map(([slot, id]) => [slot, [id]])) };
            await expect.poll(() => renderedAppearance(page)).toMatchObject({ ...model, appearances: expected, gold: 1234, level: 30, xp: 0 });
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
        for (const [index, [id, name, slot, price]] of offers.entries()) {
            await vendor.locator(`[data-offer-id="${id}"]`).click();
            await vendor.getByRole('button', { name: `Unlock for ${price} EP`, exact: true }).click();
            await vendor.getByRole('button', { name: 'Confirm EP purchase', exact: true }).click();
            remaining -= price;
            // EP is intentionally absent from shared actor frames. Confirm
            // the actual private vendor acknowledgement through its menu.
            await expect(vendor.getByText(`${remaining} EP · Permanent cosmetic unlocks`, { exact: true })).toBeVisible();
            // A weapon unlock can also be selected for the Rogue's real
            // offhand. Veyra's default action targets its primary weapon slot;
            // choose the offhand explicitly in the normal Wardrobe after buying.
            if (!(actorClass === 'Rogue' && index === 2)) {
                await vendor.getByRole('button', { name: slot === 'outfit' ? 'Apply complete outfit' : 'Apply owned look', exact: true }).click();
                expected[slot] = { baseName: name, rarity: 'Common', slot };
                await expect.poll(() => renderedAppearance(page)).toMatchObject({ appearances: expected });
            }
        }
        await vendor.getByRole('button', { name: 'Close', exact: true }).click();
        if (actorClass === 'Rogue') {
            await chooseAppearance(page, 'offHand', `${offers[2][1]}|Common`);
            expected.offHand = { baseName: offers[2][1], rarity: 'Common', slot: 'mainHand' };
        }
        expect(remaining).toBe(actorClass === 'Rogue' ? 45 : 48);
        await check('purchased-three-independent-slots', outfitID);
        expect((await renderedAppearance(page)).equipment).toEqual(original.equipment);
        await openCharacter(page);
        await expect.poll(() => page.evaluate(() => window.game.uiManager.characterPreview?.model?.userData.equipmentVisualSignature))
            .toBe((await renderedAppearance(page)).signature);
        expect(await page.evaluate(() => window.game.uiManager.characterPreview.model.userData.authoredClass)).toBe(actorClass);

        const wardrobe = page.locator('#character-sheet .wardrobe-panel');
        if (await wardrobe.getAttribute('open') === null) await wardrobe.locator('summary').click();
        await wardrobe.getByRole('button', { name: 'View character', exact: true }).click();
        await expect(page.locator('#character-preview')).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole('button', { name: 'Reset character view', exact: true })).toBeFocused();
        await page.screenshot({ path: testInfo.outputPath('confirmed-character-garments.png') });
        // Removing real gear under an outfit must not create a cosmetic weapon.
        await page.locator('#slot-mainhand').click();
        await check('empty-real-weapon', outfitID, [handIDs.offHand], 8);
        if (!await page.locator('#inventory-screen').isVisible()) await page.keyboard.press('i');
        const index = await page.evaluate(() => window.game.player.inventory.findIndex(item => item?.id === 'garment-connected-mainHand'));
        expect(index).toBeGreaterThanOrEqual(0);
        await page.locator('#inventory-grid .inv-slot').nth(index).click();
        await check('real-weapon-restored', outfitID);
        expect((await renderedAppearance(page)).equipment).toEqual(original.equipment);
        await page.locator('#btn-close-character').click();
        if (await page.locator('#inventory-screen').isVisible()) await page.keyboard.press('i');
        if (process.env.EIDOLON_E2E_GARMENT_CPU === '1') {
            await page.bringToFront();
            const frames = await profileGameplayScene(page, 'current-town-rendered-wardrobe', { phases: true });
            await attachJSON(testInfo, 'current-town-wardrobe-frame-diagnosis', frames);
            const cdp = await page.context().newCDPSession(page);
            try {
                await cdp.send('Profiler.enable');
                await cdp.send('Profiler.start');
                await page.waitForTimeout(5000);
                const { profile } = await cdp.send('Profiler.stop');
                const summary = summarizePartyCPUProfile(profile, new URL(baseURL).origin);
                // Only allowlisted source/function/caller identities survive.
                // Never retain raw profiles, URL queries or account data.
                await attachJSON(testInfo, 'current-town-wardrobe-cpu-functions', summary);
            } finally { await cdp.detach(); }
            // GPU queries run after both CPU profilers have restored hooks.
            const gpuCounter = await page.evaluate(() => {
                const gl = window.game.renderSystem.renderer.getContext();
                const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
                return ext ? gl.getQuery(ext.TIME_ELAPSED_EXT, ext.QUERY_COUNTER_BITS_EXT) : 0;
            });
            await attachJSON(testInfo, 'current-town-gpu-counter-availability', { gpuCounter });
            if (Number.isInteger(gpuCounter) && gpuCounter >= 30) {
                const gpu = await profileWorldGpuTime(page, 'current-town-rendered-wardrobe-separate-gpu');
                await attachJSON(testInfo, 'current-town-wardrobe-gpu-diagnosis', gpu);
            }
        }
        await chooseLowQuality(page, owner);
        await chooseLowQuality(observer, other);
        await check('low-quality-local-and-remote', outfitID);
        await expect.poll(() => renderedAppearance(observer, ownerID)).toMatchObject({ quality: 'low' });
        await page.bringToFront();
        await loginAndEnterWorld(page, owner);
        await check('saved-selection-relogin', outfitID);
        await expectPrivateWallet(page, remaining);
        await page.locator('#slot-chest').click();
        await check('real-chest-removed-under-outfit', outfitID);
        await chooseAppearance(page, 'outfit', ''); delete expected.outfit;
        await check('clear-outfit-restores-current-gear-and-retained-looks', '', hands, 13);
        if (!await page.locator('#inventory-screen').isVisible()) await page.keyboard.press('i');
        const chest = await page.evaluate(() => window.game.player.inventory.findIndex(item => item?.id === 'garment-connected-chest'));
        expect(chest).toBeGreaterThanOrEqual(0);
        await page.locator('#inventory-grid .inv-slot').nth(chest).click();
        await check('real-chest-restored-after-clearing-outfit', '');
        await loginAndEnterWorld(page, owner);
        await check('cleared-outfit-relogin', '');
        await expectPrivateWallet(page, remaining);
        expect((await renderedAppearance(page)).equipment).toEqual(original.equipment);
        expect(failures, failures.join('\n')).toEqual([]);
        expect(remoteFailures, remoteFailures.join('\n')).toEqual([]);
        await attachJSON(testInfo, 'rendered-wardrobe-phases', { renderer, actorClass, scope: 'Prepared returning class-specific real gear/outfit/hands, actual local/observer models and normal UI/socket/save paths. High/savedLow, legal Rogue offhand weapon, returning/cleared sessions; not earned EP, all-pose/old-binary/physical-device/frame-time or final owner art qualification.', phases });
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
        await attachJSON(testInfo, 'wardrobe-failure-readiness', {
            owner: await readiness(page), observer: await readiness(observer), failures, remoteFailures
        });
        throw error;
    } finally { await context.close(); }
});
