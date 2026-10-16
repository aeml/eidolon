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

for (const phone of [false, true]) test(`${phone ? 'phone' : 'desktop'}: guild drafts and calendar input survive live roster updates`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: phone ? 390 : 1280, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await mountGuild(page, phone);
    await page.evaluate(() => {
        const { ui, guild, controller, sent } = window.__guild;
        ui.lastPlayerRef.id = 'player-Alice';
        guild.permissions = { ...guild.permissions, invite: true, manage_motd: true, manage_events: true };
        guild.motd = 'Meet at the east gate.';
        guild.activities = [{ id: 'verdant', name: 'Verdant Bastion' }]; guild.events = [];
        guild.members.push(...Array.from({ length: 16 }, (_, index) => ({ username: `Companion${index + 1}`, rank: 'member', online: false })));
        controller.handleMessage({ type: 'guild_update', payload: { guild } });
        ui.social.guild.onInvite = name => sent.push({ unexpectedInvite: name });
        ui.social.guild.onSetMOTD = message => sent.push({ unexpectedMessage: message });
        ui.social.guild.onEvent = payload => sent.push({ unexpectedEvent: payload });
    });
    const frame = page.locator('#social-window'), panel = page.locator('#tab-panel-guild');
    const scrollOwner = phone ? frame : panel;
    const invite = panel.getByLabel('Guild invite username');
    const message = panel.getByLabel('Guild message of the day');
    await invite.fill('Future companion'); await message.fill('Bring a key for the expedition.');
    await message.focus();
    await message.evaluate(input => input.setSelectionRange(6, 9));
    const before = await scrollOwner.evaluate(node => node.scrollTop);
    await page.evaluate(() => {
        const { guild, controller } = window.__guild;
        guild.members[1].online = true; guild.members[1].level = 31; guild.members[1].class = 'Rogue';
        controller.handleMessage({ type: 'guild_update', payload: { guild } });
    });
    await expect(invite).toHaveValue('Future companion');
    await expect(message).toHaveValue('Bring a key for the expedition.'); await expect(message).toBeFocused();
    expect(await message.evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual([6, 9]);
    expect(await scrollOwner.evaluate(node => node.scrollTop)).toBeCloseTo(before, 0);
    await expect(message).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('guild-message-draft.png') });
    const schedule = panel.locator('.guild-events > details > summary');
    await schedule.scrollIntoViewIfNeeded(); await schedule.click();
    const title = panel.getByLabel('Event title', { exact: true });
    await title.fill('Evening expedition'); await title.focus();
    const calendarScroll = await scrollOwner.evaluate(node => node.scrollTop);
    expect(calendarScroll).toBeGreaterThan(0);
    await page.evaluate(() => {
        const { guild, controller } = window.__guild;
        guild.bank.gold += 5;
        controller.handleMessage({ type: 'guild_update', payload: { guild } });
    });
    await expect(title).toHaveValue('Evening expedition'); await expect(title).toBeFocused(); await expect(title).toBeInViewport();
    expect(await scrollOwner.evaluate(node => node.scrollTop)).toBeCloseTo(calendarScroll, 0);
    await page.screenshot({ path: testInfo.outputPath('guild-calendar-draft.png') });
    expect(await page.evaluate(() => window.__guild.sent)).toEqual([]);
    await page.evaluate(() => {
        const { ui, guild, controller } = window.__guild;
        ui.lastPlayerRef.id = 'player-Eve';
        controller.handleMessage({ type: 'guild_update', payload: { guild } });
    });
    await expect(invite).toHaveValue(''); await expect(title).toHaveValue('');
    await page.evaluate(() => window.__guild.ui.dispose());
    expect(failures, failures.join('\n')).toEqual([]);
});
