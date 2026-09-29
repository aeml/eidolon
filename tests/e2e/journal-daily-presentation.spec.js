import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Controlled presentation fixture: actual QuestUI, DOM and shipped CSS, not a
// claimed earned quest completion or authorization to change server rewards.
for (const [width, height] of [[1280, 720], [390, 844]]) {
    test(`${width}x${height}: many contracts remain navigable with readable progress and stable tracking`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const { QuestUI } = await import('/src/ui/QuestUI.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const quests = [
                { id: 'chronicle_01', category: 'chronicle', chapter: 1, title: 'The First Covenant', accepted: true, count: 1, maxCount: 3 },
                ...Array.from({ length: 12 }, (_, i) => ({ id: `daily_crowd_${i}`, title: `Contract ${i + 1}: Echoes beneath the abandoned watchtower`,
                    accepted: true, target: 'Skeleton', count: i === 8 ? 30 : i, maxCount: 30, rewardXP: 200, rewardGold: 25 }))
            ];
            const player = { id: 'many-contracts', quests };
            const ui = new QuestUI({ isMobile: mobile, getLastPlayer: () => player });
            ui.questJournal.style.display = 'flex';
            ui.updateJournal(quests);
            window.__manyContracts = { ui, player };
        }, width < 600);
        const journal = page.locator('#quest-journal');
        const navigation = journal.getByRole('group', { name: 'Quest journal sections' });
        const contracts = navigation.getByRole('button', { name: 'Contracts (12)', exact: true });
        await contracts.click();
        await expect(journal.locator('.chronicle-journal')).toBeHidden();
        await expect(journal.locator('.quest-journal-entry').first()).toHaveAttribute('data-quest-id', 'daily_crowd_8');
        await page.evaluate(() => window.__manyContracts.ui.updateJournal(window.__manyContracts.player.quests));
        await expect(contracts).toBeFocused();
        await expect(contracts).toHaveAttribute('aria-pressed', 'true');
        await journal.locator('.quest-repeatable-ladder > summary').click();
        const count = journal.locator('.quest-journal-entry__count').first();
        expect(await count.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(13);
        await page.screenshot({ path: testInfo.outputPath('contracts-ready-first.png') });

        const track = journal.locator('[data-quest-track="daily_crowd_11"]');
        await track.scrollIntoViewIfNeeded();
        const before = await journal.locator('#journal-list').evaluate(node => node.scrollTop);
        expect(before).toBeGreaterThan(0);
        await track.check();
        await expect(track).toBeFocused();
        expect(await journal.locator('#journal-list').evaluate(node => node.scrollTop)).toBeCloseTo(before, 0);
        expect(await journal.locator('#journal-list').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        const navBounds = await navigation.boundingBox();
        expect(navBounds.y).toBeGreaterThanOrEqual(0);
        expect(navBounds.y + navBounds.height).toBeLessThan(height);
        expect((await contracts.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: testInfo.outputPath('contracts-track-deep-list.png') });
        await navigation.getByRole('button', { name: 'Story', exact: true }).click();
        await expect(journal.locator('.chronicle-journal')).toBeVisible();
        await expect(journal.locator('.quest-journal-entry').first()).toBeHidden();
        expect(await journal.locator('#journal-list').evaluate(node => node.scrollTop)).toBe(0);
        expect(await page.evaluate(() => window.__manyContracts.player.quests.some(q => q.completed))).toBe(false);
        if (width >= 600) {
            const scroll = await page.evaluate(() => {
                const { ui, player } = window.__manyContracts;
                ui.closeJournal();
                ui.trackedQuestKeys = new Set(['story', ...player.quests.filter(q => q.id.startsWith('daily_')).map(q => q.id)]);
                ui.updateJournal(player.quests);
                ui.objectivesList.scrollTop = ui.objectivesList.scrollHeight;
                const before = ui.objectivesList.scrollTop;
                player.quests[1].count++;
                ui.updateJournal(player.quests);
                return { before, after: ui.objectivesList.scrollTop };
            });
            expect(scroll.before).toBeGreaterThan(0);
            expect(scroll.after).toBeCloseTo(scroll.before, 0);
            await page.screenshot({ path: testInfo.outputPath('all-tracked-scroll-retained.png') });
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test(`${width}x${height}: ready quest replaces town recovery guidance without claiming it`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const { QuestUI } = await import('/src/ui/QuestUI.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const quest = { id: 'chronicle_02_seeds_first_grove', category: 'chronicle', chapter: 2,
                title: 'Seeds of the First Grove', accepted: true, completed: false,
                type: 'COLLECT', count: 7, maxCount: 8, target: 'Verdant Memory Seed', rewardXP: 200, rewardGold: 25 };
            const player = { id: 'ready-guidance-presentation', level: 8, position: { x: 0, z: 200 }, quests: [quest] };
            const recovery = { reason: 'recall' };
            const ui = new QuestUI({ isMobile: mobile, getLastPlayer: () => player,
                getCurrentInstanceId: () => '', getCurrentInstanceType: () => 'overworld',
                getOnboardingRecoveryContext: () => recovery });
            ui.updateJournal(player.quests);
            window.__readyGuidance = { ui, player, quest, recovery };
        }, width < 600);
        const panel = page.locator('#objectives-panel');
        const primary = panel.locator('.objective-entry').first();
        await expect(primary).toContainText('Re-orient after recalling');
        for (const reason of ['recall', 'respawn']) {
            await page.evaluate(reason => {
                const { ui, player, quest, recovery } = window.__readyGuidance;
                recovery.reason = reason;
                quest.count = 8;
                ui.updateJournal(player.quests);
            }, reason);
            await expect(primary.locator('.objective-entry__title')).toHaveText('Seeds of the First Grove');
            await expect(primary.locator('.objective-entry__status')).toHaveText('Ready');
            const hint = primary.locator('.objective-entry__hint');
            await expect(hint).toContainText('Speak to Archmage Ilyra in town and click Complete Quest');
            if (width < 600) {
                // Phone HUD deliberately stays one compact, thumb-sized row;
                // the existing journal is the readable detail view.
                await expect(hint).toBeHidden();
                expect((await primary.boundingBox()).height).toBeGreaterThanOrEqual(44);
                await primary.click();
                const journal = page.locator('#quest-journal');
                await expect(journal).toBeVisible();
                await expect(journal).toContainText('Ready to complete — return to Archmage Ilyra');
                await page.screenshot({ path: testInfo.outputPath(`ready-journal-${reason}.png`) });
                await page.locator('#btn-close-journal').click();
                await expect(journal).toBeHidden();
                await expect(primary).toBeVisible();
            } else {
                await expect(hint).toBeVisible();
            }
            await expect(panel).not.toContainText(/Re-orient after recalling|Recover in town and re-orient/);
            expect(await page.evaluate(() => window.__readyGuidance.quest.completed)).toBe(false);
            const bounds = await primary.boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
            await page.screenshot({ path: testInfo.outputPath(`ready-after-${reason}.png`) });
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test(`${width}x${height}: story journal keeps optional dailies compact and preserves reading focus`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const { QuestUI } = await import('/src/ui/QuestUI.js');
            const { chronicleInvestigations } = await import('/src/data/chronicleInvestigations.generated.js');
            const diary = chronicleInvestigations.find(chapter => chapter.id === 'chronicle_earth_keepers_house');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const quests = [
                { id: 'chronicle_01', category: 'chronicle', chapter: 1, title: 'A promise remembered', completed: true, lore: 'The four keepers chose to protect one another.' },
                { id: diary.id, category: 'chronicle', chapter: 2, type: 'INVESTIGATE', title: diary.title,
                    accepted: true, count: 0, maxCount: diary.sites.length, description: diary.acceptance,
                    objectiveText: diary.directions, rewardXP: 200, rewardGold: 25 },
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
