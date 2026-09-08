import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const config of [
    { width: 390, height: 844, mobile: true, font: 16 },
    { width: 844, height: 390, mobile: true, font: 16 },
    { width: 320, height: 568, mobile: true, font: 20 },
    { width: 1280, height: 720, mobile: false, font: 12 }
]) {
    test(`${config.width}px/${config.font}px: repeatable quest labels and rewards remain legible`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize(config);
        await page.goto('/', { waitUntil: 'networkidle' });
        // An explicit populated UI fixture, not earned reward or economy proof.
        await page.evaluate(async config => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.body.classList.toggle('mobile-mode', config.mobile);
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(config.mobile);
            document.documentElement.style.setProperty('--phone-menu-text-size', `${config.font}px`);
            const quests = [
                { id: 'daily_mythic', target: 'DungeonBossMythic', maxCount: 4, count: 1, accepted: true, rewardXP: 15000000, rewardGold: 30000 },
                { id: 'daily_phoenix', target: 'PhoenixSentinel', maxCount: 100, count: 100, accepted: true, rewardXP: 10000000, rewardGold: 20000 },
                { id: 'daily_cyclone', target: 'CycloneAvatar', maxCount: 100, count: 0, accepted: false, rewardXP: 10000000, rewardGold: 20000 }
            ];
            ui.lastPlayerRef = { id: 'ladder-layout', level: 100, quests };
            ui.showHUD(); ui.quest.toggleJournal();
            window.__ladderLayout = ui;
        }, config);
        const rows = page.locator('.quest-ladder-row');
        await expect(rows).toHaveCount(3);
        await expect(rows.nth(1)).toContainText('Phoenix Sentinels • Ready');
        await expect(rows.nth(2)).toContainText('Cyclone Avatars • Available');
        await expect(rows.nth(1)).toContainText('100 / 100 • 20,000 gold · 10,000,000 Resonance XP');
        for (const row of await rows.all()) {
            await row.scrollIntoViewIfNeeded();
            const measured = await row.evaluate(el => {
                const label = el.querySelector('.quest-ladder-row__label'), value = el.querySelector('.quest-ladder-row__value');
                const box = el.getBoundingClientRect(), left = label.getBoundingClientRect(), right = value.getBoundingClientRect();
                const text = label.firstChild;
                const words = label.textContent.split(/\s+/).filter(word => /^[A-Za-z]+$/.test(word));
                const wholeWords = words.every(word => {
                    const start = text.textContent.indexOf(word), range = document.createRange();
                    range.setStart(text, start); range.setEnd(text, start + word.length);
                    return range.getClientRects().length === 1;
                });
                return { direction: getComputedStyle(el).flexDirection, fullLabel: left.width >= box.width * .95,
                    below: right.top >= left.bottom, fits: el.scrollWidth <= el.clientWidth + 1,
                    labelFont: parseFloat(getComputedStyle(label).fontSize), wholeWords };
            });
            expect(measured.fits).toBe(true);
            if (config.mobile) {
                expect(measured.direction).toBe('column');
                expect(measured.fullLabel).toBe(true);
                expect(measured.below).toBe(true);
                expect(measured.wholeWords).toBe(true);
                expect(measured.labelFont).toBeGreaterThanOrEqual(config.font);
            } else expect(measured.direction).toBe('row');
        }
        await rows.first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath('quest-ladder.png') });
        await page.evaluate(() => window.__ladderLayout.characterPreview.dispose());
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
