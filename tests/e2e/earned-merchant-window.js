import { expect } from '@playwright/test';

// A nearby NPC interaction may have already opened the shop. Clicking again
// toggles it closed; an actual visible shop needs no additional world input.
export async function ensureEarnedMerchantWindow(page, interact) {
    const shop = page.locator('#shop-screen');
    const alreadyOpen = await shop.isVisible();
    if (!alreadyOpen) await interact();
    await expect(shop).toBeVisible();
    await expect(page.locator('#inventory-screen')).toBeVisible();
    return alreadyOpen ? 'already-open' : 'opened';
}
