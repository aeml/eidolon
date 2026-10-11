import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) {
    const mobile = width < 600 || height < 500;
    test.describe(`${width}: direct trade review`, () => {
        test.use({ hasTouch: mobile, isMobile: mobile, viewport: { width, height } });
        test('partner updates preserve the draft and confirmation waits for acknowledged offer', async ({ page, baseURL }, testInfo) => {
            const failures = collectBrowserFailures(page, baseURL);
            await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
            await page.goto('/', { waitUntil: 'networkidle' });
            // Prepared UI: native input, simulated trade acknowledgement, no item/Gold transfer.
            await page.evaluate(async mobile => {
                const { UIManager } = await import('/src/ui/UIManager.js');
                if (mobile) document.body.classList.add('mobile-mode');
                document.getElementById('start-screen').style.display = 'none';
                const ui = new UIManager(mobile);
                const player = { id: 'player-review-a', inventory: [{ id: 'potion', name: 'Potion', stack: 2 }] };
                const trade = { id: 'review-trade', playerAId: player.id, playerBId: 'player-review-b',
                    offerA: { items: [], gold: 5 }, offerB: { items: [{ id: 'gem', name: 'Ruby' }], gold: 8 } };
                const calls = [];
                ui.lastPlayerRef = player; ui.showHUD(); ui.directTrade.update({ trade, state: 'open' });
                ui.directTrade.onOffer = (...args) => calls.push({ action: 'offer', args });
                ui.directTrade.onConfirm = (...args) => calls.push({ action: 'confirm', args });
                window.__tradeReview = { ui, player, trade, calls };
            }, mobile);
            const panel = page.getByRole('dialog', { name: 'Direct Trade', exact: true });
            const bounds = await panel.boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
            for (const action of await panel.locator('.direct-trade-actions button').all()) {
                expect((await action.boundingBox()).height).toBeGreaterThanOrEqual(44);
            }
            const close = panel.getByRole('button', { name: 'Cancel direct trade' });
            expect(await close.evaluate(node => {
                const box = node.getBoundingClientRect();
                return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
            })).toBe(true);
            const checkbox = panel.getByRole('checkbox', { name: 'Potion ×2' });
            if (mobile) await checkbox.tap();
            else { await checkbox.focus(); await page.keyboard.press('Space'); }
            const gold = panel.getByRole('spinbutton', { name: 'Your gold' });
            await gold.fill('12'); await gold.focus();
            await expect(panel.getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled();
            await page.evaluate(() => {
                const { ui, trade } = window.__tradeReview;
                ui.directTrade.update({ trade: { ...trade, confirmedB: true }, state: 'confirm' });
            });
            await expect(gold).toHaveValue('12'); await expect(gold).toBeFocused(); await expect(checkbox).toBeChecked();
            await expect(panel.locator('#direct-trade-status')).toContainText('Update your offer before confirming');
            await page.screenshot({ path: testInfo.outputPath('direct-trade-unsent-review.png') });
            const offer = panel.getByRole('button', { name: 'Update Offer', exact: true });
            await gold.fill('12.75');
            if (mobile) await offer.tap();
            else { await offer.focus(); await page.keyboard.press('Enter'); }
            await expect(gold).toHaveValue('12');
            expect(await page.evaluate(() => window.__tradeReview.calls)).toEqual([{ action: 'offer', args: ['review-trade', ['potion'], 12] }]);
            expect(await page.evaluate(() => window.__tradeReview.trade.offerA)).toEqual({ items: [], gold: 5 });
            await expect(panel.getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled();
            await gold.fill('5'); await checkbox.setChecked(false);
            await expect(panel.getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled();
            await expect(panel.locator('#direct-trade-status')).toContainText('Waiting for your offer update');
            await checkbox.setChecked(true);
            await gold.fill('13');
            await page.evaluate(() => {
                const { ui, trade, player } = window.__tradeReview;
                ui.directTrade.update({ trade: { ...trade, offerA: { items: player.inventory, gold: 12 } }, state: 'offer' });
            });
            const confirm = panel.getByRole('button', { name: 'Confirm', exact: true });
            await expect(gold).toHaveValue('13'); await expect(confirm).toBeDisabled();
            await gold.fill('12');
            await expect(confirm).toBeEnabled();
            if (mobile) await confirm.tap();
            else { await confirm.focus(); await page.keyboard.press('Space'); }
            expect(await page.evaluate(() => window.__tradeReview.calls.at(-1))).toEqual({ action: 'confirm', args: ['review-trade'] });
            await page.screenshot({ path: testInfo.outputPath('direct-trade-acknowledged-review.png') });
            await page.evaluate(() => window.__tradeReview.ui.dispose());
            await expect(panel).toBeHidden();
            expect(failures, failures.join('\n')).toEqual([]);
        });
    });
}
