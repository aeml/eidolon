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
        await page.evaluate(() => window.__unlockFixture.ui.toggleSkillTree());
        const previewBranches = page.locator('[data-desktop-build-key^="branch:"], [data-build-action^="branch:"]');
        await expect(previewBranches).toHaveCount(3);
        for (const button of await previewBranches.all()) await expect(button).toBeDisabled();
        await page.evaluate(() => window.__unlockFixture.ui.skillTree.close());
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

for (const [width, height] of [[1280, 900], [390, 844]]) {
    test(`${width}: reward confirmation survives pressed-pointer updates`, async ({ page, baseURL, context }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const ui = new UIManager(mobile);
            const choices = Array.from({ length: 6 }, (_, i) => ({ id: `offer-${i}`, name: `Saved reward ${i}`,
                rarity: ['Uncommon', 'Rare', 'Legendary'][i % 3], level: 12, slot: 'chest', stats: { defense: 10 + i } }));
            const player = { id: 'reward-control-fixture', subType: 'Fighter', meshType: 'Fighter', abilityName: 'Charge',
                abilityCooldown: 0, xp: 0, xpToNextLevel: 1000, level: 12, selectedBranch: 'A',
                position: { x: 20, z: 215 }, stats: { hp: 200, maxHp: 200, mana: 100, maxMana: 100 },
                quests: [{ id: 'chronicle_earned', title: 'Earned chapter', category: 'chronicle', completed: true,
                    accepted: true, rewardChoiceLevel: 12, rewardChoices: choices }] };
            window.__rewardControlFixture = { ui, player, claims: [] };
            ui.quest.onClaimQuestItem = (questId, itemId) => window.__rewardControlFixture.claims.push({ questId, itemId });
            ui.showHUD(); ui.updatePlayerStats(player); ui.updateXP(player); ui.quest.toggleJournal();
        }, width < 600);
        const journal = page.locator('#quest-journal');
        const input = journal.locator('[data-reward-item="offer-2"]');
        const confirm = journal.locator('[data-reward-claim="chronicle_earned"]');
        let touch, pressed = false;
        try {
            await input.check();
            await expect(confirm).toHaveText('Claim Saved reward 2');
            await confirm.scrollIntoViewIfNeeded();
            await page.evaluate(() => { window.__rewardControlFixture.button = document.querySelector('#journal-list [data-reward-claim]'); });
            const bounds = await confirm.boundingBox(), x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
            if (width < 600) {
                touch = await context.newCDPSession(page);
                await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
            } else { await page.mouse.move(x, y); await page.mouse.down(); }
            pressed = true;
            await page.evaluate(() => { const { ui, player } = window.__rewardControlFixture; ui.quest.updateJournal(JSON.parse(JSON.stringify(player.quests))); });
            expect(await page.evaluate(() => window.__rewardControlFixture.button === document.querySelector('#journal-list [data-reward-claim]'))).toBe(true);
            expect(await page.evaluate(() => window.__rewardControlFixture.claims)).toEqual([]);
            if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            else await page.mouse.up();
            pressed = false;
            await expect.poll(() => page.evaluate(() => window.__rewardControlFixture.claims)).toEqual([{ questId: 'chronicle_earned', itemId: 'offer-2' }]);
            await expect(confirm).toBeDisabled();
            await page.evaluate(() => window.__rewardControlFixture.ui.quest.handleQuestActionError('Make one free bag slot. Your choices are retained.'));
            await expect(confirm).toBeEnabled(); await expect(input).toBeChecked();
            expect(await page.evaluate(() => window.__rewardControlFixture.button === document.querySelector('#journal-list [data-reward-claim]'))).toBe(true);
            await expect(journal.getByRole('alert')).toContainText('free bag slot');
            await page.screenshot({ path: testInfo.outputPath('reward-retry-retains-controls.png') });
            if (touch) {
                const next = await confirm.boundingBox(), point = { x: next.x + next.width / 2, y: next.y + next.height / 2 };
                await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
                await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            } else { await confirm.focus(); await page.keyboard.press('Space'); }
            await expect.poll(() => page.evaluate(() => window.__rewardControlFixture.claims.length)).toBe(2);
            expect(await page.evaluate(() => window.__rewardControlFixture.claims.every(claim => claim.questId === 'chronicle_earned' && claim.itemId === 'offer-2'))).toBe(true);
            expect(failures, failures.join('\n')).toEqual([]);
        } finally {
            if (pressed) {
                if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                else await page.mouse.up();
            }
            await touch?.detach();
            await page.evaluate(() => window.__rewardControlFixture?.ui.dispose());
        }
    });
}

for (const ready of [false, true]) {
    test(`1280: quest ${ready ? 'turn-in' : 'acceptance'} survives held mouse and keyboard updates`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async ready => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.remove('mobile-mode');
            const ui = new UIManager(false);
            const player = { id: 'conversation-control-fixture', subType: 'Fighter', meshType: 'Fighter', abilityName: 'Charge',
                abilityCooldown: 0, xp: 0, xpToNextLevel: 1000, level: 30, selectedBranch: 'A',
                position: { x: 20, z: 215 }, stats: { hp: 200, maxHp: 200, mana: 100, maxMana: 100 }, quests: [
                    { id: 'chronicle_01_bell_below', category: 'chronicle', chapter: 1, title: 'The Bell That Rang Below',
                        description: 'Help Ilyra save Eidolon.', type: 'KILL', target: 'Skeleton', accepted: ready,
                        completed: false, count: ready ? 3 : 0, maxCount: 3, rewardXP: 500, rewardGold: 90 },
                    { id: 'daily_skeleton', category: 'daily', title: 'Daily Hunt', accepted: true, completed: false, count: 0, maxCount: 3 }
                ] };
            window.__conversationControlFixture = { ui, player, calls: [] };
            ui.quest.onAcceptQuest = id => window.__conversationControlFixture.calls.push({ kind: 'accept', id });
            ui.quest.onCompleteQuest = id => window.__conversationControlFixture.calls.push({ kind: 'complete', id });
            ui.showHUD(); ui.updatePlayerStats(player); ui.updateXP(player); ui.quest.toggleQuestWindow('story');
            window.__conversationControlFixture.button = document.querySelector('#quest-window [data-quest-action]');
        }, ready);
        const action = page.locator(`#quest-window [data-quest-action="${ready ? 'Complete Quest' : 'Accept Quest'}"]`);
        const expected = { kind: ready ? 'complete' : 'accept', id: 'chronicle_01_bell_below' };
        let mouseHeld = false, spaceHeld = false;
        const update = () => page.evaluate(() => {
            const { ui, player } = window.__conversationControlFixture;
            player.quests = JSON.parse(JSON.stringify(player.quests));
            player.quests[1].count++;
            ui.quest.updateQuestWindow(player.quests);
        });
        try {
            await expect(action).toBeEnabled();
            await action.scrollIntoViewIfNeeded();
            const bounds = await action.boundingBox();
            await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            await page.mouse.down(); mouseHeld = true;
            await update();
            expect(await page.evaluate(() => window.__conversationControlFixture.calls)).toEqual([]);
            await page.mouse.up(); mouseHeld = false;
            await expect.poll(() => page.evaluate(() => window.__conversationControlFixture.calls), { timeout: 2000 }).toEqual([expected]);
            expect(await page.evaluate(() => window.__conversationControlFixture.button === document.querySelector('#quest-window [data-quest-action]'))).toBe(true);
            await expect(action).toBeDisabled();
            await page.evaluate(() => window.__conversationControlFixture.ui.quest.handleQuestActionError('Move closer to Ilyra. Your quest is unchanged.'));
            await expect(action).toBeEnabled();
            await expect(page.locator('#quest-window [role="alert"]')).toContainText('quest is unchanged');
            await page.screenshot({ path: testInfo.outputPath('quest-action-explicit-retry.png') });
            await action.focus();
            await page.keyboard.down('Space'); spaceHeld = true;
            await update();
            expect(await page.evaluate(() => window.__conversationControlFixture.calls)).toEqual([expected]);
            await expect(action).toBeFocused();
            await page.keyboard.up('Space'); spaceHeld = false;
            await expect.poll(() => page.evaluate(() => window.__conversationControlFixture.calls), { timeout: 2000 }).toEqual([expected, expected]);
            expect(await page.evaluate(() => window.__conversationControlFixture.button === document.querySelector('#quest-window [data-quest-action]'))).toBe(true);
            expect(await page.evaluate(() => window.__conversationControlFixture.player.quests[0].completed)).toBe(false);
            expect(failures, failures.join('\n')).toEqual([]);
        } finally {
            if (mouseHeld) await page.mouse.up();
            if (spaceHeld) await page.keyboard.up('Space');
            await page.evaluate(() => window.__conversationControlFixture?.ui.dispose());
        }
    });
}
