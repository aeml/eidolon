import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ hasTouch: true, isMobile: true });

for (const [width, height] of [[390, 844], [844, 390], [568, 320]]) {
    test(`${width}x${height}: populated objectives cannot cover expanded chat after rotation`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.body.classList.add('mobile-mode');
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(true);
            const quests = [{ id: 'chronicle_01_bell_below', category: 'chronicle', chapter: 1,
                title: 'The Bell Beneath the Roots', type: 'COLLECT', target: 'Memory Seed',
                accepted: false, completed: false, count: 0, maxCount: 4 }];
            ui.lastPlayerRef = { id: 'chat-layout', level: 30, quests, position: { x: 0, z: 200 } };
            ui.showHUD(); ui.toggleChat(true); ui.quest.updateJournal(quests);
            ui.chat.addMessage('Ilyra', 'The four crystals need your help.');
            window.__chatLayers = ui;
        });
        const tracker = page.locator('#objectives-panel');
        await expect(tracker).toBeVisible();
        await page.getByRole('button', { name: 'Open chat history' }).tap();
        await page.setViewportSize({ width, height });
        const collapse = page.getByRole('button', { name: 'Collapse chat history' });
        await expect(collapse).toBeInViewport();
        await page.screenshot({ path: testInfo.outputPath(`populated-chat-${width}-${height}.png`) });
        for (const target of [collapse, page.locator('#chat-tab-chat'), page.locator('#chat-input')]) {
            expect(await target.evaluate(element => {
                const rect = element.getBoundingClientRect();
                return element.contains(document.elementFromPoint(rect.x+rect.width/2, rect.y+rect.height/2));
            }), 'visible chat controls must actually receive a touch with the objective populated').toBe(true);
        }
        await page.locator('#chat-input').tap();
        await expect(page.locator('#chat-input')).toBeFocused();
        await page.locator('#chat-input').fill('The crystals need us.');
        await page.locator('#chat-input').press('Enter');
        await collapse.tap();
        await expect(page.locator('#chat-box')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Open chat history' })).toBeVisible();
        await tracker.getByRole('button', { name: /^Open journal:/ }).tap();
        await expect(page.locator('#quest-journal')).toBeVisible();
        await page.evaluate(() => window.__chatLayers.characterPreview.dispose());
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
