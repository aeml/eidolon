import { test, expect } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const mobile of [false, true]) test.describe(`Quest action review ${mobile ? 'phone' : 'desktop'}`, () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, isMobile: mobile });
    test('long dialogue keeps manual acceptance and turn-in reachable and waits for acknowledgement', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.goto('/', { waitUntil: 'networkidle' });
        // Controlled response timing proves UI behavior, not earned rewards.
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { getChronicleInvestigation } = await import('/src/core/ChronicleInvestigation.js');
            const authored = getChronicleInvestigation('chronicle_earth_keepers_house');
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(mobile);
            const quest = { id: authored.id, category: 'chronicle', type: 'INVESTIGATE', chapter: 2, title: authored.title,
                description: Array(4).fill(authored.acceptance).join('\n\n'), objectiveText: 'Recover Mara’s diary from the abandoned house.',
                rewardXP: 1200, rewardGold: 50, count: 0, maxCount: 1, accepted: false, completed: false };
            const state = { ui, quest, accepts: 0, claims: 0 }; window.__actionReview = state;
            ui.lastPlayerRef = { id: 'action-reader', level: 10, quests: [quest] };
            ui.quest.onAcceptQuest = () => state.accepts++;
            ui.quest.onCompleteQuest = () => state.claims++;
            ui.showHUD(); ui.quest.toggleQuestWindow('story');
        }, mobile);
        const activate = async locator => mobile ? locator.tap() : locator.click();
        const questWindow = page.locator('#quest-window');
        const accept = questWindow.getByRole('button', { name: 'Accept Quest', exact: true });
        const brief = questWindow.getByRole('region', { name: 'Quest objectives and rewards' });
        await expect(brief).toContainText('Available quest');
        await expect(brief).toContainText('Recover Mara’s diary');
        await expect(accept).toBeInViewport();
        await page.screenshot({ path: testInfo.outputPath('available-with-actions.png') });
        await activate(accept);
        await expect(questWindow.getByRole('button', { name: 'Waiting for reply…', exact: true })).toBeDisabled();
        await expect(page.locator('.quest-dialogue[data-quest-state]')).toHaveAttribute('aria-busy', 'true');
        expect(await page.evaluate(() => window.__actionReview.quest.accepted)).toBe(false);
        await page.evaluate(() => window.__actionReview.ui.quest.handleQuestActionError('The conversation was interrupted. Please try again.'));
        await expect(questWindow.getByRole('alert')).toContainText('Please try again');
        await expect(accept).toBeEnabled();
        await activate(accept);
        await page.evaluate(() => {
            const { ui, quest } = window.__actionReview; quest.accepted = true; ui.quest.updateQuestWindow([quest]);
        });
        await expect(brief).toContainText('In progress');
        await expect(questWindow.getByRole('button', { name: 'Complete Quest', exact: true })).toHaveCount(0);
        await page.evaluate(() => {
            const { ui, quest } = window.__actionReview; quest.count = 1; ui.quest.updateQuestWindow([quest]);
        });
        const complete = questWindow.getByRole('button', { name: 'Complete Quest', exact: true });
        await expect(brief).toContainText('Ready to turn in');
        await expect(complete).toBeInViewport();
        await page.screenshot({ path: testInfo.outputPath('ready-with-actions.png') });
        await activate(complete);
        expect(await page.evaluate(() => window.__actionReview.quest.completed)).toBe(false);
        await page.evaluate(() => {
            const { ui, quest } = window.__actionReview; quest.completed = true; ui.quest.updateQuestWindow([quest]);
        });
        await expect(questWindow).toContainText('QUEST COMPLETE');
        await expect(questWindow).toContainText('Reward received');
        expect(await page.evaluate(() => [window.__actionReview.accepts, window.__actionReview.claims])).toEqual([2, 1]);
        await page.evaluate(() => window.__actionReview.ui.quest.openWitnessConversation('chronicle-witness-mara'));
        const shelter = questWindow.locator('[data-witness-topic="shelter"]');
        const summary = shelter.locator('summary');
        await activate(summary); await summary.focus();
        const scroll = await questWindow.locator('#quest-list').evaluate(element => { element.scrollTop = 80; return element.scrollTop; });
        await page.evaluate(() => {
            const { ui, quest } = window.__actionReview;
            ui.quest.updateQuestWindow([{ ...quest, investigationMask: 1 }]);
        });
        await expect(summary).toBeFocused(); await expect(shelter).toHaveJSProperty('open', true);
        expect(await questWindow.locator('#quest-list').evaluate(element => element.scrollTop)).toBe(scroll);
        const target = await summary.boundingBox(); expect(target.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: testInfo.outputPath('witness-topic-refresh.png') });
        if (mobile) await summary.tap(); else await page.keyboard.press('Space');
        await expect(shelter).toHaveJSProperty('open', false);
        const door = questWindow.locator('[data-witness-topic="door"]');
        await door.locator('summary').focus();
        await page.evaluate(() => {
            const { ui, quest } = window.__actionReview; ui.quest.updateQuestWindow([quest]);
        });
        await expect(door).toHaveCount(0);
        await expect(questWindow.locator('.quest-conversation__intro')).toBeFocused();
        await page.locator('#btn-close-quest').focus();
        await page.evaluate(() => {
            const { ui, quest } = window.__actionReview; ui.quest.updateQuestWindow([{ ...quest, investigationMask: 1 }]);
        });
        await expect(page.locator('#btn-close-quest')).toBeFocused();
        expect(await page.evaluate(() => [window.__actionReview.accepts, window.__actionReview.claims])).toEqual([2, 1]);
        await page.locator('#btn-close-quest').click();
        await page.evaluate(() => window.__actionReview.ui.dispose());
        expect(failures, failures.join('\n')).toEqual([]);
    });
});
