import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ hasTouch: true, isMobile: true });
test('combo benefits and limits remain readable on portrait and landscape phones', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        document.body.classList.add('mobile-mode');
        document.getElementById('start-screen').style.display = 'none';
        const ui = new UIManager(true);
        ui.lastPlayerRef = { id: 'combo-layout', subType: 'Rogue', level: 100,
            selectedBranch: 'A', talentRanks: {}, skillRunes: {}, unlockedSkills: [] };
        ui.showHUD(); ui.skillTree.toggle();
        window.__comboLayout = ui;
    });
    const content = page.locator('#skill-tree-content');
    for (const [width, height] of [[390, 844], [844, 390]]) {
        await page.setViewportSize({ width, height });
        for (const className of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
            await page.evaluate(className => {
                const ui = window.__comboLayout;
                ui.lastPlayerRef.subType = className;
                ui.skillTree.skillTreeMode = 'combos';
                ui.skillTree.renderSkillTree(className);
            }, className);
            const cards = content.locator('article');
            await expect(cards).toHaveCount(className === 'Fighter' ? 5 : 4);
            for (const card of await cards.all()) {
                await card.scrollIntoViewIfNeeded();
                expect(await card.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
                const box = await card.boundingBox();
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(width);
            }
            expect(await content.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
            await page.screenshot({ path: testInfo.outputPath(`${className}-${width}.png`) });
        }
    }
    await page.locator('#btn-close-skills').tap();
    await expect(page.locator('#skill-tree-window')).toBeHidden();
    await page.evaluate(() => window.__comboLayout.characterPreview.dispose());
    expect(failures, failures.join('\n')).toEqual([]);
});
