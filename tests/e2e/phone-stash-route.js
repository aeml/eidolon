import { expect } from '@playwright/test';
import { loginAndEnterWorld, projectEntity } from './helpers.js';
import { readPhoneInventoryState } from './phone-inventory-observation.js';

export async function openPhoneStash(page) {
    let target, previous, stableSamples = 0;
    // setViewportSize can return before resize/ResizeObserver has updated the
    // orthographic camera. A visible projection from the previous orientation
    // is not yet a usable tap coordinate. Observe rendered, stable projections;
    // do not force a camera update, raycast, interaction or player position.
    await expect.poll(async () => {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        target = await projectEntity(page, 'stash-1');
        stableSamples = target?.visible && previous?.visible &&
            Math.hypot(target.x - previous.x, target.y - previous.y) < 0.5 ? stableSamples + 1 : 0;
        previous = target;
        return stableSamples >= 2;
    }, { intervals: [50], message: 'The rendered stash projection must settle before a real tap' }).toBe(true);
    await page.touchscreen.tap(target.x, target.y);
    console.log('[phone-stash] tap receipt', JSON.stringify({ target, state: await readPhoneInventoryState(page) }));
    await expect(page.locator('#stash-screen'), 'Normal town stash interaction must open storage').toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#inventory-screen')).toBeHidden();
}

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
        await openPhoneStash(page);
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
