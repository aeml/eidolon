import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Real UIManager/ChatUI/styles and callbacks; authoritative routing and friend
// persistence are checked separately against a disposable MongoDB in Go.
for (const phone of [false, true]) test(`${phone ? 'phone' : 'desktop'}: channel composition remains private and chat stays available`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: phone ? 390 : 1280, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async phone => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        document.body.classList.toggle('mobile-mode', phone);
        document.getElementById('start-screen').style.display = 'none';
        const ui = new UIManager(phone), sent = [];
        ui.onChatSend = message => sent.push(message);
        ui.showHUD(); ui.toggleChat(true);
        ui.chat.addMessage('Ayla', 'Regroup near Ilyra', { channel: 'party' });
        ui.chat.addMessage('Borin', 'The next expedition is ready', { channel: 'guild' });
        ui.chat.addMessage('Selen', 'Private meeting details', { channel: 'whisper' });
        window.__community = { ui, sent };
    }, phone);
    try {
        if (phone) await page.getByRole('button', { name: 'Open chat history' }).click();
        for (const [channel, outgoing, hint] of [['party', '/party meet at the gate', 'Message your party'],
            ['guild', '/guild meet at the gate', 'Message your guild'],
            ['whisper', '/r meet at the gate', 'Reply to last whisper']]) {
            await page.locator(`[data-chat-tab="${channel}"]`).click();
            // Use the same public focus path as the game's Enter shortcut.
            await page.evaluate(() => window.__community.ui.chat.focusChatInput());
            await expect(page.locator('#chat-input')).toHaveAttribute('placeholder', new RegExp(hint));
            await page.locator('#chat-input').fill('meet at the gate');
            await page.locator('#chat-input').press('Enter');
            expect(await page.evaluate(() => window.__community.sent.at(-1))).toBe(outgoing);
            await expect(page.locator('#chat-box')).toBeVisible();
        }
        await page.locator('#chat-input').fill('/w Ayla explicit private route');
        await page.locator('#chat-input').press('Enter');
        expect(await page.evaluate(() => window.__community.sent.at(-1))).toBe('/w Ayla explicit private route');
        await page.locator('#chat-input').focus(); await page.keyboard.press('Escape');
        await expect(page.locator('[data-chat-tab="chat"]')).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#chat-box')).toBeVisible();
        await page.locator('#chat-input').fill('hello current world'); await page.locator('#chat-input').press('Enter');
        expect(await page.evaluate(() => window.__community.sent)).toEqual([
            '/party meet at the gate', '/guild meet at the gate', '/r meet at the gate',
            '/w Ayla explicit private route', 'hello current world'
        ]);
        await page.screenshot({ path: testInfo.outputPath('community-chat.png') });
        expect(failures, failures.join('\n')).toEqual([]);
    } finally { await page.evaluate(() => { window.__community?.ui.dispose(); delete window.__community; }); }
});
