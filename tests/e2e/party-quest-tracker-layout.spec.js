import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
    test(`party quest strip stays reachable above healing controls at ${viewport.width}px`, async ({ page }, testInfo) => {
        // UI-only fixture: actual styles/components, no game scene or earned quest claim.
        await page.route('**/src/main.js', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.setViewportSize(viewport);
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { QuestUI } = await import('/src/ui/QuestUI.js');
            const { SocialUI } = await import('/src/ui/SocialUI.js');
            document.getElementById('start-screen').style.display = 'none';
            const ctx = { isMobile: false, getLastPlayer: () => ({ id: 'tracker-layout', quests: [] }) };
            const quest = new QuestUI(ctx), social = new SocialUI(ctx);
            const summary = Array.from({ length: 8 }, (_, index) => ({
                id: `daily_layout_${index}`, badge: 'Daily', title: `Recover the scattered crystal fragments ${index}`,
                progressLabel: `${index} / 10`, hint: 'Return to the town quest giver', progressPct: index * 10
            }));
            quest.loadTrackingPreferences();
            quest.trackedQuestKeys = new Set(summary.map(item => item.id));
            quest.renderObjectivesPanel(summary);
            social.updateParty({ partyId: 'layout-only', members: ['Fighter', 'Cleric', 'Wizard', 'Rogue'].map((name, index) => ({
                id: index ? `ally-${index}` : 'tracker-layout', name, hp: 100, maxHp: 100, role: index === 1 ? 'healer' : 'damage'
            })) });
            window.__partyTrackerLayout = { quest, social };
        });
        const list = page.getByRole('region', { name: 'Tracked quests', exact: true });
        await expect(list).toBeVisible();
        await expect(list.locator('.objective-entry')).toHaveCount(8);
        const tracker = await page.locator('#objectives-panel').boundingBox();
        const roster = await page.locator('#party-panel').boundingBox();
        expect(tracker.height).toBeLessThanOrEqual(66);
        expect(tracker.y + tracker.height).toBeLessThan(roster.y);
        expect(await list.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
        await list.focus();
        await page.keyboard.press('End');
        await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
        await list.locator('.objective-entry').last().hover();
        await expect(list.locator('.objective-entry').last()).toHaveAttribute('title', /fragments 7 · 7 \/ 10/);
        await page.getByRole('button', { name: 'Select Cleric for healing', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Select Cleric for healing', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await page.screenshot({ path: testInfo.outputPath('party-quest-strip.png') });
        await page.evaluate(() => window.__partyTrackerLayout.social.setPartyPanelVisible(false));
        expect((await page.locator('#objectives-panel').boundingBox()).height).toBeGreaterThan(66);
        await page.evaluate(() => {
            window.__partyTrackerLayout.social.setPartyPanelVisible(true);
            window.__partyTrackerLayout.quest.renderObjectivesPanel([]);
        });
        await expect(page.locator('#objectives-panel')).toBeHidden();
    });
}
