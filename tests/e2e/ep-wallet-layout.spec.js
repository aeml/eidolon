import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) test(`EP wallet confirmation is usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async (mobile) => {
        const { EPWalletUI } = await import('/src/ui/EPWalletUI.js');
        document.getElementById('start-screen').style.display = 'none';
        document.body.classList.toggle('mobile-mode', mobile);
        const sheet = document.getElementById('character-sheet');
        // Match toggleManagedWindow: phone CSS turns display:block into a
        // column, while forcing display:flex here would create a fake row.
        sheet.style.display = 'block';
        const host = sheet.querySelector('.char-sheet-body');
        host.replaceChildren();
        window.__epRequests = [];
        const ui = new EPWalletUI({ host, getPlayer: () => ({ id: 'ep-layout-player' }), send: (type, payload) => {
            window.__epRequests.push({ type, payload });
            if (type === 'get_ep_wallet') ui.handleResult({ success: true, ep: 8, gold: 3000000, goldPerEP: 1000000 });
            else ui.handleResult({ id: payload.id, success: true, ep: 10, gold: 1000000, goldPerEP: 1000000, message: 'Exchange saved.' });
        } });
        ui.root.open = true;
    }, width === 390);
    const wallet = page.locator('.ep-wallet-panel');
    await expect(wallet.locator('[data-balance]')).toContainText('8 EP');
    await wallet.getByLabel('EP to receive').fill('2');
    await wallet.getByRole('button', { name: 'Review exchange' }).click();
    await expect(wallet.locator('[data-confirmation]')).toContainText('2,000,000 Gold');
    await expect(wallet.locator('[data-confirmation]')).toContainText('no exchange back');
    const confirm = wallet.getByRole('button', { name: 'Confirm permanent exchange' });
    await confirm.scrollIntoViewIfNeeded();
    expect((await confirm.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect((await wallet.boundingBox()).width).toBeGreaterThan(280);
    expect(await wallet.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `/tmp/eidolon-ep-confirmation-${width}.png` });
    await confirm.click();
    await expect(wallet.locator('[role="status"]')).toHaveText('Exchange saved.');
    await expect(wallet.locator('[data-balance]')).toContainText('10 EP');
    const requests = await page.evaluate(() => window.__epRequests.filter(r => r.type === 'exchange_gold_for_ep'));
    expect(requests).toHaveLength(1);
    expect(requests[0].payload).toMatchObject({ amount: 2, confirmed: true });
});
