import { expect } from '@playwright/test';
import { loginAndEnterWorld, projectEntity } from './helpers.js';

export async function verifyPhoneStash(page, credentials, itemId) {
    const ownership = () => page.evaluate(id => {
        const p = window.game.player;
        const describe = item => item ? JSON.parse(JSON.stringify(item)) : null;
        return { bag: describe(p.inventory.find(item => item?.id === id)),
            stash: describe(p.stash?.find(item => item?.id === id)) };
    }, itemId);
    const original = (await ownership()).bag;
    expect(original).toBeTruthy();
    async function openStash() {
        let target;
        await expect.poll(async () => { target = await projectEntity(page, 'stash-1'); return target?.visible; }).toBe(true);
        await page.touchscreen.tap(target.x, target.y);
        await expect(page.locator('#stash-screen'), 'Normal town stash interaction must open storage').toBeVisible({ timeout: 30_000 });
        await expect(page.locator('#inventory-screen')).toBeHidden();
    }
    for (const [width, height] of [[390, 844], [844, 390]]) {
        await page.setViewportSize({ width, height });
        await openStash();
        await page.locator('#phone-stash-bag-tab').tap();
        const row = page.locator('#phone-stash-list button').and(page.locator(`[data-item-id="${itemId}"]`));
        await row.scrollIntoViewIfNeeded(); await row.tap();
        expect(await ownership()).toEqual({ bag: original, stash: null });
        await page.locator('#phone-item-stash').tap();
        await expect.poll(ownership).toEqual({ bag: null, stash: original });
        await page.locator('#btn-close-stash').tap();
        await loginAndEnterWorld(page, credentials);
        expect(await ownership()).toEqual({ bag: null, stash: original });
        await openStash(); await page.locator('#phone-stash-stored-tab').tap();
        await row.scrollIntoViewIfNeeded(); await row.tap();
        expect(await ownership()).toEqual({ bag: null, stash: original });
        await page.locator('#phone-item-withdraw').tap();
        await expect.poll(ownership).toEqual({ bag: original, stash: null });
        await page.locator('#btn-close-stash').tap();
        await loginAndEnterWorld(page, credentials);
        expect(await ownership()).toEqual({ bag: original, stash: null });
        console.log(`[phone-stash] ${width}x${height}: ordinary town interaction, explicit store/withdraw and saved complete item passed`);
    }
}
