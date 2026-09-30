import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

async function mountGuild(page, phone) {
    await page.evaluate(async phone => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        const { SocialPresenceController } = await import('/src/core/SocialPresenceController.js');
        document.body.classList.toggle('mobile-mode', phone);
        document.getElementById('start-screen').style.display = 'none';
        const ui = new UIManager(phone), sent = [];
        ui.lastPlayerRef = { name: 'Alice', inventory: [{ id: 'earned-blade', name: 'Rare Earned Blade', stack: 1 }] };
        ui.showHUD(); ui.social.toggleSocial(true);
        const controller = new SocialPresenceController({ network: {}, uiManager: ui, remotePlayers: new Map() });
        const guild = { id: 'g1', name: 'Lantern Wardens', tag: 'WARD', leaderId: 'player-Alice',
            permissions: { disband: true, set_rank: true, kick: true, withdraw_bank: true },
            members: [{ playerId: 'player-Alice', username: 'Alice', rank: 'leader', online: true, class: 'Fighter', level: 75 },
                { playerId: 'player-Bob', username: 'Bob', rank: 'member', online: false }], bank: { gold: 500, items: [] }, audit: [] };
        controller.handleMessage({ type: 'guild_update', payload: { guild } });
        ui.social.guild.onBankDeposit = payload => sent.push({ ...payload });
        ui.social.guild.onLeave = () => sent.push('leave');
        window.__guild = { ui, sent, controller, guild };
    }, phone);
    await page.getByRole('tab', { name: 'Guild', exact: true }).click();
}

for (const phone of [false, true]) test(`${phone ? 'phone' : 'desktop'}: guild bank retry identity and destructive confirmations`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: phone ? 390 : 1280, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(() => sessionStorage.clear());
    await mountGuild(page, phone);
    try {
        await page.locator('[data-guild-gold]').fill('125');
        await page.getByRole('button', { name: 'Deposit', exact: true }).click();
        const original = await page.evaluate(() => window.__guild.sent[0]);
        expect(original.gold).toBe(125);
        expect(original.requestId).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
        await expect(page.getByRole('button', { name: 'Deposit', exact: true })).toBeDisabled();
        await page.evaluate(requestId => {
            const { controller, guild } = window.__guild;
            controller.handleMessage({ type: 'guild_update', payload: { guild: { ...guild, bank: { gold: 625, items: [] } } } });
            controller.handleMessage({ type: 'guild_bank_result', payload: { requestId, status: 'pending', message: 'Transfer awaiting recovery.' } });
        }, original.requestId);
        await page.getByRole('button', { name: 'Retry Transfer', exact: true }).click();
        expect(await page.evaluate(() => window.__guild.sent)).toEqual([original, original]);
        await page.screenshot({ path: testInfo.outputPath('guild-transfer-pending.png') });
        await page.evaluate(() => window.__guild.ui.dispose());
        await page.reload({ waitUntil: 'networkidle' });
        await mountGuild(page, phone);
        await expect(page.getByRole('button', { name: 'Deposit', exact: true })).toBeDisabled();
        await page.getByRole('button', { name: 'Retry Transfer', exact: true }).click();
        expect(await page.evaluate(() => window.__guild.sent)).toEqual([original]);
        await page.evaluate(requestId => window.__guild.controller.handleMessage({ type: 'guild_bank_result',
            payload: { requestId, status: 'complete', message: 'Guild bank transfer complete.' } }), original.requestId);
        await expect(page.getByRole('button', { name: 'Deposit', exact: true })).toBeEnabled();
        await expect(page.getByRole('status').filter({ hasText: 'Guild bank transfer complete.' })).toBeVisible();
        await page.getByRole('button', { name: 'Leave Guild', exact: true }).click();
        await expect(page.getByRole('alertdialog', { name: 'Leave Guild' })).toContainText('bank contributions stay with the guild');
        expect(await page.evaluate(() => window.__guild.sent)).toEqual([original]);
        await page.screenshot({ path: testInfo.outputPath('guild-leave-confirmation.png') });
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(page.getByRole('alertdialog')).toHaveCount(0);
        await page.getByRole('button', { name: 'Leave Guild', exact: true }).click();
        await page.getByRole('button', { name: 'Confirm Leave Guild', exact: true }).click();
        expect(await page.evaluate(() => window.__guild.sent)).toEqual([original, 'leave']);
        expect(failures, failures.join('\n')).toEqual([]);
    } finally { await page.evaluate(() => { window.__guild?.ui.dispose(); delete window.__guild; }); }
});
