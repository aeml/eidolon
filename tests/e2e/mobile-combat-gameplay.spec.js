import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';
import { approachEncounter, selectLiveTarget } from './mobile-helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent,
    actionTimeout: 12_000, trace: 'off', screenshot: 'off', video: 'off' });


async function withHeldJoystick(page, context, action) {
    const cdp = await context.newCDPSession(page);
    const bounds = await page.locator('#joystick-zone').boundingBox();
    const stick = { id: 41, x: bounds.x + bounds.width / 2 + 24, y: bounds.y + bounds.height / 2 };
    const before = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
    try {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [stick] });
        await expect.poll(() => page.evaluate(before => Math.hypot(window.game.player.position.x - before.x,
            window.game.player.position.z - before.z), before), { intervals: [25, 50], timeout: 5000 }).toBeGreaterThan(0.25);
        await action(cdp, stick);
    } finally {
        if (!page.isClosed()) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await cdp.detach();
        }
    }
    await expect.poll(() => page.evaluate(() => window.game.inputManager.joystickVector.lengthSq())).toBe(0);
}

async function runPhoneCombat({ page, baseURL, context }) {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated disposable QA account');
    test.setTimeout(180_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.isMobile)).toBe(true);
    // Setup only: the allowlisted waypoint approaches a normal live enemy. It
    // grants no kill/quest completion and does not replace targeting or damage.
    await approachEncounter(page);
    await page.evaluate(() => {
        const game = window.game;
        window.__phoneCombatCommands = [];
        const send = game.network.send.bind(game.network);
        game.network.send = (type, payload) => {
            if (type === 'attack' || type === 'ability') window.__phoneCombatCommands.push({ type, targetId: payload.targetId });
            return send(type, payload);
        };
    });
    // Reproject in a bounded retry if authoritative movement changes the hitbox
    // before touch release. Every acquisition still uses an actual browser tap.
    let target = await selectLiveTarget(page);
    await expect.poll(() => page.evaluate(() => window.game.getMobileCombatTarget()?.id)).toBe(target.id);
    expect(await page.evaluate(() => window.__phoneCombatCommands)).toEqual([]);
    expect(await page.evaluate(() => window.game.pendingInteraction)).toBeNull();
    await expect(page.locator('#combat-intent-panel')).toBeVisible();
    expect(await page.evaluate(() => window.game.combatTargetHighlight?.visible)).toBe(true);
    const hpBefore = await page.evaluate(id => window.game.chunkManager.getActiveEntities().find(e => e.id === id)?.stats.hp, target.id);
    await withHeldJoystick(page, context, async (cdp, stick) => {
        expect(await page.evaluate(() => window.game.getMobileCombatTarget()?.id)).toBe(target.id);
        const ability = await page.locator('#btn-mobile-ability').boundingBox();
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [stick,
            { id: 42, x: ability.x + ability.width / 2, y: ability.y + ability.height / 2 }] });
        await expect.poll(() => page.evaluate(() => window.__phoneCombatCommands.find(command => command.type === 'ability')?.targetId)).toBe(target.id);
        expect(await page.evaluate(() => window.game.inputManager.joystickVector.lengthSq())).toBeGreaterThan(0);
    });
    await expect.poll(() => page.evaluate(() => window.__phoneCombatCommands.find(command => command.type === 'ability')?.targetId)).toBe(target.id);
    await expect.poll(() => page.evaluate(id => {
        const enemy = window.game.chunkManager.getActiveEntities().find(e => e.id === id);
        return enemy?.state === 'DEAD' ? 0 : enemy?.stats.hp ?? Infinity;
    }, target.id), { timeout: 20_000 }).toBeLessThan(hpBefore);
    console.log('[phone-combat] browser tap selected without attacking; Skill caused authoritative health loss on that target');

    // Reacquire a live encounter if the spell killed this one, then prove the
    // separate basic-attack button's selected id before clearing pursuit.
    await approachEncounter(page);
    target = await selectLiveTarget(page);
    await expect.poll(() => page.evaluate(() => window.game.getMobileCombatTarget()?.id)).toBe(target.id);
    await page.locator('#btn-mobile-attack').tap();
    await expect.poll(() => page.evaluate(() => window.__phoneCombatCommands.find(command => command.type === 'attack')?.targetId)).toBe(target.id);
    await withHeldJoystick(page, context, async () => {
        expect(await page.evaluate(() => window.game.pendingInteraction)).toBeNull();
        expect(await page.evaluate(() => window.game.getMobileCombatTarget()?.id)).toBe(target.id);
    });
    expect(await page.evaluate(() => window.game.pendingInteraction)).toBeNull();
    await page.locator('#btn-mobile-target-clear').tap();
    await expect(page.locator('#combat-intent-panel')).toBeHidden();
    expect(await page.evaluate(() => window.game.pendingInteraction)).toBeNull();
    expect(await page.evaluate(() => window.game.getMobileCombatTarget())).toBeNull();
    const commandsAfterClear = await page.evaluate(() => window.__phoneCombatCommands.length);
    await page.waitForTimeout(1_100);
    expect(await page.evaluate(() => window.__phoneCombatCommands.length)).toBe(commandsAfterClear);
    console.log('[phone-combat] two-thumb cast retained selection; joystick took over pursuit; Clear Target removed the highlight');
    expect(failures, failures.join('\n')).toEqual([]);
}

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    test.describe(`${viewport.width}x${viewport.height}`, () => {
        test.use({ viewport });
        test('phone taps select an authoritative enemy and Attack and Skill honor it', runPhoneCombat);
    });
}
