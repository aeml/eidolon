import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, projectGroundOffset } from './helpers.js';
import { backendOriginBrowserArgs, hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';

test.use({ viewport: { width: 1280, height: 720 }, trace: 'off', screenshot: 'off', video: 'off' });

test('desktop party selection directs real support casts despite a different cursor target', async ({ page, browser, baseURL }) => {
    test.skip(process.env.EIDOLON_E2E_DESKTOP_SUPPORT !== '1', 'Explicit disposable two-client support check');
    test.setTimeout(240_000);
    expect(process.env.EIDOLON_E2E_REGISTER).toBe('1');
    expect(process.env.EIDOLON_E2E_WS_URL).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\/ws$/);
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL);
    const lastCommands = new Map();
    async function command(target, value) {
        const delay = Math.max(0, 1100 - (Date.now() - (lastCommands.get(target) || 0)));
        if (delay) await target.waitForTimeout(delay);
        lastCommands.set(target, Date.now());
        await target.locator('body').press('Enter');
        await expect(target.locator('#chat-input')).toBeFocused();
        await target.locator('#chat-input').fill(value);
        await target.locator('#chat-input').press('Enter');
    }
    async function ready(target, lowHealth = false) {
        const before = await target.evaluate(() => window.game.animationQAReadySequence || 0);
        await command(target, `/qa-animation-ready${lowHealth ? ' low-health' : ''}`);
        await expect.poll(() => target.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(before);
    }
    await loginAndEnterWorld(page, credentials);
    // Prepared casting fixture only: no earned leveling or encounter claim.
    await command(page, '/level 100');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    await expect(skills).toBeVisible();
    await skills.getByRole('button', { name: 'Skills', exact: true }).click();
    await page.locator('.skill-branch').first().getByRole('button', { name: 'Select Spec' }).click();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar?.[0])).toBe('Healing Light');
    await page.keyboard.press('Escape');
    await expect(skills).toBeHidden();

    const second = await browser.browserType().launch({
        executablePath: process.env.EIDOLON_E2E_BROWSER_PATH || undefined,
        headless: process.env.EIDOLON_E2E_HEADLESS !== '0',
        args: [...hardwareWebGLBrowserArgs(), ...backendOriginBrowserArgs(process.env.EIDOLON_E2E_BACKEND_ORIGIN_IP)]
    });
    try {
        const ally = await (await second.newContext({ baseURL, viewport: { width: 1280, height: 720 } })).newPage();
        const allyFailures = collectBrowserFailures(ally, baseURL);
        await loginAndEnterWorld(ally, { ...credentials, username: `${credentials.username}-ally`, characterClass: 'Fighter' });
        await command(ally, '/level 100');
        await expect.poll(() => ally.evaluate(() => window.game.player.level)).toBe(100);
        const allyId = await ally.evaluate(() => window.game.player.id);
        const casterId = await page.evaluate(() => window.game.player.id);
        await page.keyboard.press('o');
        await expect(page.locator('#social-window')).toBeVisible();
        await page.locator('#party-invite-input').fill(`${credentials.username}-ally`);
        await page.locator('#btn-invite-party').click();
        await expect(ally.locator('#party-request-modal')).toBeVisible();
        await ally.locator('#btn-accept-party').click();
        await expect.poll(() => page.evaluate(() => window.game.uiManager.social.partyData?.members?.length)).toBe(2);
        await page.keyboard.press('Escape');
        await expect(page.locator('#social-window')).toBeHidden();
        await expect.poll(() => page.evaluate(id => Boolean(window.game.remotePlayers.get(id)), allyId)).toBe(true);
        await page.evaluate(() => {
            const game = window.game, receive = game.handleServerMessage.bind(game);
            window.__desktopSupportHeals = [];
            game.handleServerMessage = message => {
                if (message.type === 'heal') window.__desktopSupportHeals.push(message.payload);
                return receive(message);
            };
        });
        for (const [width, height] of [[1280, 720], [1440, 900]]) {
            await page.setViewportSize({ width, height });
            const target = page.locator(`[data-party-support-target="${allyId}"]`);
            await expect(target).toBeVisible();
            await target.click();
            await expect(target).toHaveAttribute('aria-pressed', 'true');
            expect(await page.evaluate(() => window.game.getDesktopSupportTarget()?.id)).toBe(allyId);
            for (const [slot, skill] of [[0, 'Healing Light'], [3, 'Divine Intervention']]) {
                expect(await page.evaluate(index => window.game.player.hotbar?.[index], slot)).toBe(skill);
                await ready(ally, true);
                await ready(page);
                const before = await ally.evaluate(() => window.game.player.stats.hp);
                const casterHP = await page.evaluate(() => { window.__desktopSupportHeals = []; return window.game.player.stats.hp; });
                // Aim at the caster, not the selected ally. Roster intent must win.
                const cursor = await projectGroundOffset(page, 0, 0);
                expect(cursor?.canvas).toBeTruthy();
                await page.mouse.move(cursor.x, cursor.y);
                await page.keyboard.press(String(slot + 1));
                await expect.poll(() => page.evaluate(({ casterId, allyId }) => window.__desktopSupportHeals.filter(
                    heal => heal.sourceId === casterId && heal.targetId === allyId && heal.amount > 0
                ).length, { casterId, allyId })).toBe(1);
                await expect.poll(() => ally.evaluate(() => window.game.player.stats.hp)).toBeGreaterThan(before);
                expect(await page.evaluate(() => window.game.player.stats.hp)).toBe(casterHP);
                console.log(`[desktop-support] ${width}x${height}: ${skill}, selected ally received authoritative healing`);
            }
            await page.getByRole('button', { name: /^Clear healing target/ }).click();
            await expect(target).toHaveAttribute('aria-pressed', 'false');
            expect(await page.evaluate(() => window.game.uiManager.social.selectedSupportTargetId)).toBeNull();
        }
        expect(allyFailures, allyFailures.join('\n')).toEqual([]);
    } finally {
        await second.close();
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
