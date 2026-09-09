import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, height, mobile] of [[1280, 900, false], [390, 844, true], [844, 390, true]]) {
    test(`target level remains visible at ${width}x${height}`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.body.classList.toggle('mobile-mode', mobile);
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(mobile);
            ui.showHUD();
            // Real UI component with a controlled target; layout evidence,
            // not a claim of successful online targeting or combat.
            ui.updateCombatIntent({ entityId: 'level-card-fixture', name: 'Skeleton',
                targetType: 'Skeleton', targetLevel: 7, distance: 4.2, status: 'in_range',
                preview: { basicAttack: 3, ability: 5, abilityName: 'Fireball' } });
        }, mobile);
        const level = page.locator(mobile ? '#combat-intent-name' : '#combat-intent-meta');
        await expect(level).toBeVisible();
        await expect(level).toContainText('Level 7');
        const bounds = await level.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
        await page.locator('#combat-intent-panel').screenshot({ path: testInfo.outputPath('target-card.png') });
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
