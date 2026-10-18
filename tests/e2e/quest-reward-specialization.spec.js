import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Controlled UI fixture, actual UIManager/QuestUI/SkillTree and shipped styles.
// This proves navigation and input/layout, not earned campaign progression.
for (const [width, height] of [[1280, 900], [390, 844]]) {
    test(`${width}: specialization unlock guides to skills and six reward choices remain usable`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const ui = new UIManager(mobile);
            const player = { id: 'unlock-fixture', subType: 'Fighter', meshType: 'Fighter', abilityName: 'Charge', abilityCooldown: 0, xp: 0, xpToNextLevel: 1000, level: 9, position: { x: 20, z: 215 }, stats: { hp: 200, maxHp: 200, mana: 100, maxMana: 100 }, selectedBranch: '', quests: [] };
            ui.showHUD();
            ui.updatePlayerStats(player); ui.updateXP(player);
            window.__unlockFixture = { ui, player, claims: [] };
        }, width < 600);
        await expect(page.locator('.specialization-unlock-notice')).toHaveCount(0);
        await page.evaluate(() => { const { ui, player } = window.__unlockFixture; player.level = 10; ui.updatePlayerStats(player); ui.updateXP(player); });
        const notice = page.getByRole('complementary', { name: 'Specialization unlocked' });
        await expect(notice).toBeVisible();
        const reminder = await notice.boundingBox();
        for (const box of await page.locator('.hotbar-slot:visible').all()) {
            const skill = await box.boundingBox();
            const overlap = Math.min(reminder.x + reminder.width, skill.x + skill.width) > Math.max(reminder.x, skill.x)
                && Math.min(reminder.y + reminder.height, skill.y + skill.height) > Math.max(reminder.y, skill.y);
            expect(overlap).toBe(false);
        }
        await page.screenshot({ path: testInfo.outputPath('specialization-unlock.png') });
        await notice.getByRole('button', { name: 'Choose specialization' }).click();
        await expect(page.locator('#skill-tree-window')).toBeVisible();
        const branch = page.locator('[data-desktop-build-key="branch:A"], [data-build-action="branch:A"]');
        await expect(branch).toBeVisible();
        await expect(branch).toBeFocused();
        await page.evaluate(() => {
            const { ui, player } = window.__unlockFixture;
            player.selectedBranch = 'A'; ui.updatePlayerStats(player); ui.updateXP(player); ui.skillTree.close();
            const choices = Array.from({ length: 6 }, (_, i) => ({ id: `offer-${i}`, name: ['Verdant Sword', 'Keeper’s Shield', 'Grovebound Robes', 'Rainwoven Hood', 'Amber Ring', 'Rootheart Amulet'][i], rarity: ['Uncommon', 'Rare', 'Legendary'][i % 3], level: 12, slot: ['mainHand', 'offHand', 'chest', 'head', 'ring', 'neck'][i], stats: { defense: 10 + i, vitality: 5 + i } }));
            player.quests = [{ id: 'chronicle_earned', category: 'chronicle', title: 'The Keeper’s House', completed: true, accepted: true, rewardChoiceLevel: 12, rewardChoices: choices }];
            ui.quest.onClaimQuestItem = (questId, itemId) => window.__unlockFixture.claims.push({ questId, itemId });
            ui.quest.toggleJournal();
        });
        await expect(notice).toHaveCount(0);
        const journal = page.locator('#quest-journal');
        const radios = journal.locator('.quest-reward-choices input[type=radio]');
        await expect(radios).toHaveCount(6);
        const confirm = journal.locator('.quest-reward-choices__confirm');
        await expect(confirm).toBeDisabled();
        await radios.nth(5).check();
        await expect(confirm).toHaveText('Claim Rootheart Amulet');
        expect(await page.evaluate(() => window.__unlockFixture.claims)).toEqual([]);
        await radios.nth(5).focus();
        await page.evaluate(() => { const { ui, player } = window.__unlockFixture; ui.quest.updateJournal(player.quests); });
        await expect(radios.nth(5)).toBeFocused();
        expect(await journal.locator('#journal-list').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        await confirm.scrollIntoViewIfNeeded();
        const bounds = await confirm.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
        await page.screenshot({ path: testInfo.outputPath('six-item-reward.png') });
        await confirm.click();
        expect(await page.evaluate(() => window.__unlockFixture.claims)).toEqual([{ questId: 'chronicle_earned', itemId: 'offer-5' }]);
        await page.evaluate(() => window.__unlockFixture.ui.quest.handleQuestActionError('Make one free bag slot. Your choices are retained.'));
        await expect(confirm).toBeEnabled();
        await expect(radios.nth(5)).toBeChecked();
        await page.evaluate(() => { const { ui, player } = window.__unlockFixture; player.quests[0].claimedRewardId = 'offer-5'; player.quests[0].rewardChoices = []; ui.quest.updateJournal(player.quests); ui.dispose(); });
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
