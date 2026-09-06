import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, openGame } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 15_000 });

function seedDisposableLegacySave(username) {
    const container = process.env.EIDOLON_E2E_LEGACY_MONGO_CONTAINER;
    const port = process.env.EIDOLON_E2E_LEGACY_MONGO_PORT;
    if (!/^eidolon-isolated-qa-mongo-[a-z0-9_.-]+$/.test(container || '') || !/^\d+$/.test(port || '') ||
        process.env.EIDOLON_E2E_REGISTER !== '1' || !/^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(process.env.EIDOLON_E2E_WS_URL || '')) {
        throw new Error('Legacy fixture requires an explicitly disposable local Mongo and loopback QA server');
    }
    const gem = { id: 'legacy-loose-gem', name: 'Chipped Sapphire', type: 'GEM', slot: 'gem', rarity: 'Common',
        level: 1, stack: 5, max_stack: 20, gem_type: 'Sapphire', gem_quality: 'Chipped',
        stats: { intelligence: 999 }, stat_scale_version: 1 };
    const inventory = Array.from({ length: 25 }, (_, index) => ({ id: `legacy-sword-${index}`, name: 'Iron Sword',
        type: 'WEAPON', slot: 'mainHand', level: 1, stack: 1, max_stack: 1, rarity: 'Common',
        stats: { damage: 2 }, stat_scale_version: 1 }));
    inventory[0] = { ...gem, id: 'existing-bag-gem', stack: 18 };
    const character = { name: username, class: 'Wizard', level: 1, xp: 0, gold: 0, x: -1.25, y: 0, z: 200,
        stats: { strength: 10, dexterity: 10, intelligence: 10, wisdom: 10, vitality: 10 },
        inventory, equipment: { gem }, stash: [], quests: [], unlocked_skills: ['Fireball'] };
    const script = `
        if (!db.getSiblingDB('admin').auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) throw Error('Fixture auth failed');
        const result = db.getSiblingDB('eidolon').users.updateOne(
            { username: ${JSON.stringify(username)}, 'characters.0': { $exists: false } },
            { $set: { characters: [${JSON.stringify(character)}] } });
        if (result.matchedCount !== 1 || result.modifiedCount !== 1) throw Error('Fixture requires one newly registered empty account');
    `;
    try {
        // Credentials stay in the existing disposable container environment;
        // account data goes over stdin, never command arguments or test output.
        execFileSync('docker', ['exec', '-i', container, 'mongosh', '--quiet', '--port', port, '--file', '/dev/stdin'],
            { input: script, stdio: ['pipe', 'pipe', 'pipe'], timeout: 20_000 });
    } catch {
        throw new Error('Could not seed the disposable legacy inventory fixture');
    }
}

function readDisposableSavedState(username) {
    const container = process.env.EIDOLON_E2E_LEGACY_MONGO_CONTAINER;
    const port = process.env.EIDOLON_E2E_LEGACY_MONGO_PORT;
    if (!/^eidolon-isolated-qa-mongo-[a-z0-9_.-]+$/.test(container || '') || !/^\d+$/.test(port || '')) {
        throw new Error('Saved-state verification requires the disposable legacy fixture');
    }
    const script = `
        let stage = 'authenticate';
        try {
        if (!db.getSiblingDB('admin').auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) throw Error('Fixture auth failed');
        stage = 'read-account';
        const savedAccount = db.getSiblingDB('eidolon').users.findOne({ username: ${JSON.stringify(username)} });
        stage = 'select-character';
        // mongosh's async rewriting mishandles this callback through optional
        // chaining; use ordinary array access after explicit shape checks.
        const characters = savedAccount && savedAccount.characters;
        const saved = Array.isArray(characters) && characters.find(value => value && value.name === ${JSON.stringify(username)});
        if (!saved) throw Error('Missing disposable character');
        stage = 'count-inventory';
        let quantity = 0;
        for (const item of saved.inventory || []) {
            if (item && item.name === 'Chipped Sapphire') quantity += Number(item.stack);
        }
        const equipment = saved.equipment || {};
        print('RECOVERY_RESULT=' + JSON.stringify({ quantity,
            unsupported: Boolean(equipment.gem), weapon: equipment.mainHand ? equipment.mainHand.id : null }));
        } catch (error) {
            const reason = ['is not a function', 'Cannot mix BigInt', 'Do not know how to serialize a BigInt', 'Cannot read properties']
                .find(value => String(error.message).includes(value)) || 'unclassified';
            print('RECOVERY_RESULT=' + JSON.stringify({ error: error.name, stage, reason }));
        }
    `;
    let output = '';
    try {
        output = execFileSync('docker', ['exec', '-i', container, 'mongosh', '--quiet', '--port', port, '--file', '/dev/stdin'],
            { input: script, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8', timeout: 20_000 });
        const record = output.split('\n').find(line => line.startsWith('RECOVERY_RESULT='));
        if (!record) throw new Error('Missing result marker');
        return JSON.parse(record.slice('RECOVERY_RESULT='.length));
    } catch (error) {
        const stderr = String(error.stderr || '');
        const cause = ['Missing disposable character', 'Fixture auth failed', 'TypeError', 'SyntaxError', 'ReferenceError', 'MongoServerError']
            .find(value => stderr.includes(value)) || error.name;
        throw new Error(`Could not inspect disposable saved recovery result: ${JSON.stringify({ cause,
            status: error.status ?? null, outputBytes: output.length, marker: output.includes('RECOVERY_RESULT=') })}`);
    }
}

test('legacy gem recovery rejects a full bag, conserves stacks and persists normal UI recovery', async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    test.skip(!process.env.EIDOLON_E2E_LEGACY_MONGO_CONTAINER, 'Requires the isolated legacy-save fixture route');
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL);
    await openGame(page);
    await page.locator('#auth-username').fill(credentials.username);
    await page.locator('#auth-password').fill(credentials.password);
    await page.locator('#auth-email').fill(`${credentials.username}@example.invalid`);
    await page.locator('#btn-register').click();
    await expect(page.locator('#auth-status')).toContainText('Registration successful');
    // Seed an old save before this new account has ever entered the world.
    // This is persistence/recovery QA, never fresh-progression evidence.
    seedDisposableLegacySave(credentials.username);
    await loginAndEnterWorld(page, credentials);
    const bagGemQuantity = () => page.evaluate(() => window.game.player.inventory.reduce((sum, item) =>
        sum + (item?.name === 'Chipped Sapphire' ? item.stack || 1 : 0), 0));
    expect(await page.evaluate(() => window.game.player.stats.intelligence)).toBe(10);
    expect(await bagGemQuantity()).toBe(18);
    await page.keyboard.press('i');
    const recovery = page.locator('#inventory-recovery');
    await expect(recovery).toBeVisible();
    await recovery.locator('summary').click();
    await recovery.getByRole('button', { name: 'Recover Chipped Sapphire ×5', exact: true }).click();
    await expect(page.locator('#chat-box')).toContainText('Free enough bag space');
    expect(await bagGemQuantity()).toBe(18);
    expect(await page.evaluate(() => window.game.player.equipment.gem.stack)).toBe(5);
    // Free one slot with a normal legal equip, not a fixture rewrite or grant.
    await page.locator('#inventory-grid .inv-slot').nth(24).click();
    await expect.poll(() => page.evaluate(() => window.game.player.equipment.mainHand?.id)).toBe('legacy-sword-24');
    await recovery.getByRole('button', { name: 'Recover Chipped Sapphire ×5', exact: true }).click();
    await expect.poll(bagGemQuantity).toBe(23);
    await expect.poll(() => page.evaluate(() => Boolean(window.game.player.equipment.gem))).toBe(false);
    await expect(recovery).toBeHidden();
    await expect.poll(() => readDisposableSavedState(credentials.username)).toEqual({
        quantity: 23, unsupported: false, weapon: 'legacy-sword-24'
    });
    const gemIndex = await page.evaluate(() => window.game.player.inventory.findIndex(item => item?.type === 'GEM'));
    await page.locator('#inventory-grid .inv-slot').nth(gemIndex).click();
    expect(await bagGemQuantity()).toBe(23);
    expect(await page.evaluate(() => Boolean(window.game.player.equipment.gem))).toBe(false);
    await page.reload({ waitUntil: 'networkidle' });
    await loginAndEnterWorld(page, credentials);
    expect(await bagGemQuantity()).toBe(23);
    expect(await page.evaluate(() => Boolean(window.game.player.equipment.gem))).toBe(false);
    expect(await page.evaluate(() => window.game.player.equipment.mainHand?.id)).toBe('legacy-sword-24');
    expect(await page.evaluate(() => window.game.player.stats.intelligence)).toBe(10);
    expect(failures, failures.join('\n')).toEqual([]);
    console.log('[equipment-recovery] full-bag rejection, legal equip, exact 18+5 gem recovery, rejected gem equip and fresh-login persistence passed');
});
