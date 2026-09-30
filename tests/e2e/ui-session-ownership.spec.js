import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const phone of [false, true]) test(`${phone ? 'phone' : 'desktop'}: retired UI sessions cannot toggle shared controls or consume a new chat message`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1280, height: 720 });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async phone => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        const clicks = [0, 0, 0], chat = [];
        let current;
        for (let i = 0; i < 3; i++) {
            current?.dispose?.();
            current = new UIManager(phone);
            current.onChatSend = message => chat.push({ session: i, message });
            const toggle = current.toggleSettings;
            current.toggleSettings = function () { clicks[i]++; return toggle.call(this); };
        }
        current.showHUD(); current.toggleChat(true);
        document.getElementById('btn-settings').click();
        const input = document.getElementById('chat-input');
        input.value = 'Session ownership fixture';
        input.focus(); input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        const roots = ['#pvp-window', '.wardrobe-panel', '.ep-wallet-panel', '.equipment-loadouts:not(.wardrobe-panel):not(.ep-wallet-panel)'];
        const windows = roots.map(selector => document.querySelectorAll(selector).length);
        current.dispose?.();
        const after = [...clicks]; document.getElementById('btn-settings').click();
        return { clicks, after, chat, windows, remaining: roots.map(selector => document.querySelectorAll(selector).length),
            sharedControlsRemain: ['inventory-screen', 'quest-journal', 'chat-input'].every(id => Boolean(document.getElementById(id))) };
    }, phone);
    await testInfo.attach('ui-session-ownership', { body: JSON.stringify(result), contentType: 'application/json' });
    expect(result.after).toEqual([0, 0, 1]);
    expect(result.clicks).toEqual(result.after);
    expect(result.chat).toEqual([{ session: 2, message: 'Session ownership fixture' }]);
    expect(result.windows).toEqual([1, 1, 1, 1]); expect(result.remaining).toEqual([0, 0, 0, 0]);
    expect(result.sharedControlsRemain).toBe(true);
    expect(failures, failures.join('\n')).toEqual([]);
});
