import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, actionTimeout: 12_000 });

for (const [width, height] of [[360, 800], [390, 844], [844, 390]]) {
    test(`${width}x${height}: phone conversations and a long journal remain readable and reachable`, async ({ page, context, baseURL }) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        // Real UI and markup, seeded narrative/progress for layout coverage only.
        // A simulated acknowledgement below is not campaign progression evidence.
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.body.classList.add('mobile-mode');
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(true);
            const story = { id: 'chronicle_02_memory', category: 'chronicle', chapter: 2,
                title: 'The Memories Beneath the Rootheart', type: 'COLLECT', target: 'Elderroot Memory Seed',
                description: '“The Rootheart remembers every promise made beneath its branches. Bring me its scattered seeds, and we can find the path to the crystal chamber.”',
                lore: 'Before Malachar broke the covenant, the four Eidolons gave their voices freely. The roots carried their song from village to village. '.repeat(8),
                count: 0, maxCount: 4, rewardXP: 8000, rewardGold: 150, accepted: false, completed: false };
            const quests = [{ ...story, id: 'chronicle_01_bell_below', chapter: 1, completed: true }, story,
                ...Array.from({ length: 16 }, (_, i) => ({ id: `daily-${i}`, category: 'daily', title: `Lanternhold expedition contract ${i + 1}`,
                    type: 'KILL', target: 'Skeleton', accepted: true, completed: false, count: i % 3, maxCount: 3, rewardXP: 500, rewardGold: 90 }))];
            const player = { id: 'phone-quest-layout', level: 30, position: { x: 200, z: 200 }, quests };
            const calls = [];
            ui.lastPlayerRef = player;
            ui.quest.onAcceptQuest = id => calls.push(['accept', id]);
            ui.quest.onCompleteQuest = id => calls.push(['complete', id]);
            window.__phoneQuest = { ui, player, calls };
            ui.showHUD(); ui.toggleChat(true); ui.quest.toggleQuestWindow('story');
        });
        const conversation = page.locator('#quest-window');
        const list = page.locator('#quest-list');
        const accept = page.getByRole('button', { name: 'Accept Quest', exact: true });
        await expect(accept).toBeInViewport();
        expect(await conversation.locator('.quest-dialogue__speech').evaluate(el => getComputedStyle(el).fontSize)).toBe('16px');
        await list.locator('summary').scrollIntoViewIfNeeded();
        await list.locator('summary').tap();
        await expect(list.locator('details')).toHaveAttribute('open', '');
        const cdp = await context.newCDPSession(page);
        const rect = await list.boundingBox();
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 7, x: rect.x + 80, y: rect.y + rect.height - 20 }] });
        for (let i = 1; i <= 6; i++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 7, x: rect.x + 80, y: rect.y + rect.height - 20 - i * (rect.height - 50) / 6 }] });
            await page.waitForTimeout(25);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
        await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(20);
        await expect(accept).toBeInViewport();
        await page.screenshot({ path: `/tmp/eidolon-phone-quest-${width}.png` });
        // A state update can arrive between touch-down and release. Keep the
        // primary action mounted so the browser can complete that same tap.
        const actionBox = await accept.boundingBox();
        const actionTouch = await context.newCDPSession(page);
        await actionTouch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
            { id: 9, x: actionBox.x + actionBox.width / 2, y: actionBox.y + actionBox.height / 2 }
        ] });
        await page.evaluate(() => {
            const { ui, player } = window.__phoneQuest;
            player.quests[2].count = 1; ui.quest.updateQuestWindow(player.quests);
        });
        await actionTouch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await actionTouch.detach();
        expect(await page.evaluate(() => window.__phoneQuest.calls)).toEqual([['accept', 'chronicle_02_memory']]);
        await expect(page.getByRole('button', { name: 'Waiting for reply…', exact: true })).toBeDisabled();
        await page.evaluate(() => {
            const { ui, player } = window.__phoneQuest;
            player.quests[1].accepted = true; player.quests[1].count = 4;
            ui.quest.updateQuestWindow(player.quests);
        });
        const complete = page.getByRole('button', { name: 'Complete Quest', exact: true });
        await expect(complete).toBeInViewport();
        await complete.tap();
        await expect(list).not.toContainText('QUEST COMPLETE');
        await page.evaluate(() => {
            const { ui, player } = window.__phoneQuest;
            player.quests[1].completed = true; ui.quest.updateQuestWindow(player.quests);
        });
        await expect(list).toContainText('QUEST COMPLETE');
        await page.getByRole('button', { name: 'Continue conversation', exact: true }).tap();
        await page.locator('#btn-close-quest').tap();
        await page.evaluate(() => window.__phoneQuest.ui.quest.toggleQuestWindow('daily'));
        const lastContract = list.locator('.quest-contract').last();
        await lastContract.scrollIntoViewIfNeeded();
        const contractScroll = await list.evaluate(el => el.scrollTop);
        await lastContract.tap();
        await page.getByRole('button', { name: 'Back to contracts', exact: true }).tap();
        expect(await list.evaluate(el => el.scrollTop)).toBeCloseTo(contractScroll, 0);
        await expect(lastContract).toBeInViewport();
        await page.locator('#btn-close-quest').tap();
        await page.evaluate(() => window.__phoneQuest.ui.quest.toggleJournal());
        const journal = page.locator('#quest-journal');
        const journalList = page.locator('#journal-list');
        await journalList.locator('summary').tap();
        await expect(journalList.locator('details')).toHaveAttribute('open', '');
        const lastTrack = journalList.locator('.quest-tracking-control').last();
        await lastTrack.scrollIntoViewIfNeeded();
        expect((await lastTrack.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await lastTrack.tap();
        await expect(journalList.locator('[data-quest-track="daily-15"]')).toBeChecked();
        const scroll = await journalList.evaluate(el => el.scrollTop);
        await page.evaluate(() => {
            const { ui, player } = window.__phoneQuest;
            player.quests.at(-1).count = 2; ui.quest.updateJournal(player.quests);
        });
        await expect(journalList.locator('details')).toHaveAttribute('open', '');
        expect(await journalList.evaluate(el => el.scrollTop)).toBeCloseTo(scroll, 0);
        expect(await journalList.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        const chat = await page.locator('#chat-box').boundingBox();
        const bounds = await journal.boundingBox();
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(chat.y);
        await page.screenshot({ path: `/tmp/eidolon-phone-journal-${width}.png` });
        await page.locator('#btn-close-journal').tap();
        const tracker = page.locator('#objectives-panel');
        await expect(tracker.locator('.objective-entry')).toHaveCount(1);
        for (const button of await tracker.locator('button').all()) {
            const box = await button.boundingBox();
            expect(box.height).toBeGreaterThanOrEqual(44);
            expect(await button.evaluate(el => {
                const box = el.getBoundingClientRect();
                return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
            }), 'Tracker actions are not clipped or covered').toBe(true);
        }
        await tracker.getByRole('button', { name: 'Show next tracked objective' }).tap();
        const title = await tracker.locator('.objective-entry__title').boundingBox();
        const count = await tracker.locator('.objective-entry__status').boundingBox();
        expect(title.x + title.width, 'Long quest titles must not run into their progress count').toBeLessThanOrEqual(count.x - 3);
        await page.screenshot({ path: `/tmp/eidolon-phone-tracker-${width}.png` });
        await tracker.getByRole('button', { name: 'Journal', exact: true }).tap();
        await expect(journal).toBeVisible();
        await expect(page.locator('#chat-box')).toBeVisible();
        await page.evaluate(() => window.__phoneQuest.ui.characterPreview.dispose());
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
