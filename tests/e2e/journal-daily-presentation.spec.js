import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Controlled presentation fixture: actual QuestUI, DOM and shipped CSS, not a
// claimed earned quest completion or authorization to change server rewards.
for (const [width, height] of [[1280, 720], [390, 844]]) {
    test(`${width}x${height}: story journal keeps optional dailies compact and preserves reading focus`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const { QuestUI } = await import('/src/ui/QuestUI.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const quests = [
                { id: 'chronicle_01', category: 'chronicle', chapter: 1, title: 'A promise remembered', completed: true, lore: 'The four keepers chose to protect one another.' },
                { id: 'chronicle_02_seeds_first_grove', category: 'chronicle', chapter: 2, title: 'Seeds of the First Grove',
                    type: 'COLLECT', accepted: true, count: 0, maxCount: 8, target: 'Verdant Memory Seed',
                    objectiveText: "Recover 8 Verdant Memory Seeds from Earth-realm creatures and return to Ilyra to prepare the Rootheart's future repair.",
                    description: 'Collect Verdant Memory Seeds.', rewardXP: 200, rewardGold: 25 },
                { id: 'daily_phoenix', target: 'PhoenixSentinel', count: 0, maxCount: 100, rewardXP: 396250, rewardGold: 900 },
                { id: 'daily_skeleton', target: 'Skeleton', count: 0, maxCount: 100, rewardXP: 18250, rewardGold: 100 },
                { id: 'daily_imp', target: 'Imp', count: 0, maxCount: 100, rewardXP: 20000, rewardGold: 150 }
            ];
            const player = { id: 'journal-presentation', level: 2, quests };
            const ui = new QuestUI({ isMobile: mobile, getLastPlayer: () => player,
                getServerEpochSeconds: () => Date.UTC(2026, 8, 9, 16, 0, 0) / 1000 });
            ui.questJournal.style.display = 'flex';
            ui.updateJournal(quests);
            window.__journalPresentation = { ui, quests };
        }, width < 600);
        const journal = page.locator('#quest-journal');
        const dailies = journal.locator('details.quest-repeatable-ladder');
        const summary = dailies.locator(':scope > summary');
        await expect(journal).toBeVisible();
        await expect(journal).toContainText("Recover 8 Verdant Memory Seeds from Earth-realm creatures and return to Ilyra to prepare the Rootheart's future repair.");
        await expect(journal).not.toContainText('Defeat 8 Verdant Memory Seeds');
        await summary.scrollIntoViewIfNeeded();
        await expect(dailies).not.toHaveAttribute('open', '');
        await expect(dailies.locator('.quest-ladder-row').first()).toBeHidden();
        const bounds = await journal.boundingBox(), touchBounds = await summary.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        expect(touchBounds.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: testInfo.outputPath('story-compact.png') });

        await summary.focus();
        await page.keyboard.press('Enter');
        await expect(dailies).toHaveAttribute('open', '');
        await page.evaluate(() => {
            const { ui, quests } = window.__journalPresentation;
            ui.updateJournal(quests);
        });
        await expect(summary).toBeFocused();
        await expect(dailies).toHaveAttribute('open', '');
        await expect(dailies).not.toContainText(/fastest|highest-value/i);
        await page.screenshot({ path: testInfo.outputPath('daily-expanded.png') });
        await page.keyboard.press('Enter');
        await expect(dailies).not.toHaveAttribute('open', '');
        const archive = journal.locator('.quest-chronicle-archive');
        await archive.locator(':scope > summary').focus();
        await page.keyboard.press('Enter');
        await page.evaluate(() => {
            const { ui, quests } = window.__journalPresentation;
            ui.updateJournal(quests);
        });
        await expect(archive).toHaveAttribute('open', '');
        await expect(archive.locator(':scope > summary')).toBeFocused();
        await expect(dailies).not.toHaveAttribute('open', '');
        await expect(archive).toContainText('The four keepers chose to protect one another.');
        await page.evaluate(() => {
            const { ui, quests } = window.__journalPresentation;
            Object.assign(quests.find(quest => quest.id === 'daily_skeleton'), { accepted: true, count: 100 });
            Object.assign(quests.find(quest => quest.id === 'daily_imp'), { accepted: true, count: 10 });
            ui.updateJournal(quests);
        });
        await summary.scrollIntoViewIfNeeded();
        await summary.click();
        await expect(dailies.locator('.quest-ladder-row__label')).toHaveText([
            'Skeletons • Ready', 'Imps • Active', 'Phoenix Sentinels • Available'
        ]);
        await page.screenshot({ path: testInfo.outputPath('accepted-work-first.png') });
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
