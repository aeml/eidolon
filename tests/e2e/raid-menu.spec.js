import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

async function setupMenu(page) {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        const { InputManager } = await import('/src/core/InputManager.js');
        document.getElementById('start-screen').style.display = 'none';
        const ui = new UIManager(false);
        const input = new InputManager({}, {});
        // Reproduce the live multiplayer binding; Enter on buttons must not
        // move focus into chat before the browser activates the button.
        input.subscribe('onChat', () => ui.chatInput.focus());
        input.subscribe('onEscape', () => ui.handleEscape());
        ui.toggleChat(true);
        const sent = [];
        window.__raidMenuFixture = { ui, input, sent };
        window.game = {
            network: { send: (type, payload) => sent.push({ type, payload }) },
            socket: { send: (message) => sent.push(JSON.parse(message)) }
        };
    });
}

test('populated raid choices preserve story gates, party authority and responsive controls', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await setupMenu(page);
    for (const [width, height] of [[1440, 1000], [1280, 600], [390, 844], [320, 640]]) {
        await page.setViewportSize({ width, height });
        for (const state of ['sealed', 'ready', 'follower']) {
            await page.evaluate((state) => {
                const unlocked = state !== 'sealed';
                window.__raidMenuFixture.ui.showDungeonMenu({
                    playerLevel: 100, isLeader: state !== 'follower', hasInstance: false,
                    crystalsRestored: unlocked, darkRealmOpen: unlocked,
                    elementalRaidAccess: Object.fromEntries(['earth', 'water', 'fire', 'air'].map((element) => [`${element}_crystal_raid`, unlocked])),
                    quests: []
                });
            }, state);
            const menu = page.locator('#dungeon-menu');
            await expect(menu).toBeVisible();
            await expect(menu.locator('.elemental-raid-card')).toHaveCount(4);
            await menu.getByRole('tab', { name: 'Raids', exact: true }).click();
            await expect(page.locator('#adventure-dungeons')).toBeHidden();
            await expect(page.locator('#adventure-raids')).toBeVisible();
            const enter = menu.getByRole('button', { name: 'Enter Dark Realm Raid', exact: true });
            if (state === 'ready') await expect(enter).toBeEnabled();
            else await expect(enter).toBeDisabled();
            await menu.screenshot({ path: testInfo.outputPath(`raids-${state}-${width}.png`) });
            const bounds = await menu.boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.y).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
            expect(await menu.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
            await enter.scrollIntoViewIfNeeded();
            await expect(page.locator('#btn-close-dungeon-menu')).toBeInViewport();
            await page.locator('#btn-close-dungeon-menu').click();
            await expect(menu).toHaveCount(0);
        }
    }
    await expect(page.locator('#chat-box')).toBeVisible();
    expect(failures, failures.join('\n')).toEqual([]);
});

test('adventure tabs keep keyboard focus and send the selected dungeon or raid action', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await setupMenu(page);
    const open = async (playerLevel = 100) => page.evaluate((playerLevel) => {
        const opener = document.getElementById('chat-input');
        opener.focus();
        window.__raidMenuFixture.ui.showDungeonMenu({
            playerLevel, isLeader: true, hasInstance: false,
            elementalRaidAccess: playerLevel >= 100 ? { earth_crystal_raid: true } : {}, quests: []
        });
    }, playerLevel);
    await open();
    const close = page.locator('#btn-close-dungeon-menu');
    const dungeons = page.getByRole('tab', { name: 'Dungeons', exact: true });
    const raids = page.getByRole('tab', { name: 'Raids', exact: true });
    await expect(close).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dungeons).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(raids).toBeFocused();
    await expect(raids).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(dungeons).toBeFocused();
    await page.keyboard.press('End');
    await expect(raids).toBeFocused();
    const earth = page.locator('[data-raid-type="earth_crystal_raid"]');
    await page.keyboard.press('Tab');
    await expect(earth.getByRole('button', { name: 'Form Elemental Raid' })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(earth.getByRole('button', { name: 'Enter Rootheart Sanctum' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(earth.getByRole('button', { name: 'Enter Rootheart Sanctum' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#dungeon-menu')).toHaveCount(0);
    await expect(page.locator('#chat-input')).toBeFocused();
    expect(await page.evaluate(() => window.__raidMenuFixture.sent)).toEqual([
        { type: 'raid_convert', payload: { raidType: 'earth_crystal_raid' } },
        { type: 'raid_enter', payload: { raidType: 'earth_crystal_raid' } }
    ]);

    await open();
    await page.locator('#dungeon-type-select').selectOption('abyssal_well');
    await page.locator('#dungeon-run-level-select').selectOption('60');
    await page.locator('#diff-btn-heroic').click();
    await expect(page.locator('#diff-btn-heroic')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#dungeon-menu').screenshot({ path: testInfo.outputPath('dungeon-heroic.png') });
    await page.locator('#btn-enter-dungeon').click();
    expect(await page.evaluate(() => window.__raidMenuFixture.sent.at(-1))).toEqual({
        type: 'enter_dungeon', payload: { dungeonType: 'abyssal_well', difficulty: 'heroic', runLevel: 60 }
    });
    await open(1);
    await raids.click();
    await expect(page.getByText('Your first crystal raid awaits at level 30.', { exact: false })).toBeVisible();
    await expect(page.locator('.elemental-raid-card')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('#dungeon-menu')).toHaveCount(0);
    await expect(page.locator('#chat-box')).toBeVisible();
    await expect(page.locator('#chat-input')).toBeFocused();
    expect(await page.evaluate(() => window.__raidMenuFixture.ui.isEscMenuOpen)).toBe(false);
    expect(failures, failures.join('\n')).toEqual([]);
});
