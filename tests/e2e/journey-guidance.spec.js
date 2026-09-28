import { test, expect } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const width of [1280, 390]) test(`class and journey guidance remain readable at ${width}px`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    // Present the existing new-character state without creating an account or
    // choosing a class. This checks layout/copy, not authenticated progression.
    await page.evaluate(() => {
        document.getElementById('login-panel').style.display = 'none';
        document.getElementById('class-selection-container').style.display = 'flex';
    });
    for (const [name, stat] of Object.entries({ Fighter: 'Strength', Rogue: 'Dexterity', Wizard: 'Intelligence', Cleric: 'Wisdom' })) {
        const button = page.locator(`.class-btn[data-type="${name}"]`);
        await button.scrollIntoViewIfNeeded(); await expect(button).toBeInViewport();
        await expect(button).toContainText(`Primary stat: ${stat}`);
        const box = await button.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(await button.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath('class-guidance.png') });
    await page.evaluate(async mobile => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        document.getElementById('start-screen').style.display = 'none';
        if (mobile) document.body.classList.add('mobile-mode');
        window.__journeyUI = new UIManager(mobile);
        window.__journeyUI.toggleHelp();
    }, width < 600);
    const help = page.locator('#help-screen'), guide = page.locator('#help-first-hour-guide');
    await expect(help).toBeVisible();
    if (width < 600) {
        expect(await page.evaluate(() => document.getElementById('help-first-hour-guide').getBoundingClientRect().top <
            document.querySelector('#help-screen .help-guide').getBoundingClientRect().top)).toBe(true);
    }
    await guide.locator('.help-guide__title').scrollIntoViewIfNeeded();
    await expect(guide).toContainText('Starting Your Journey');
    await page.screenshot({ path: testInfo.outputPath('journey-guidance.png') });
    for (const phrase of ['Archmage Ilyra', 'Skill Tree (K)', 'Well Rested', 'Places & lore']) {
        const entry = guide.locator(':scope > div').filter({ hasText: phrase }).first();
        await entry.scrollIntoViewIfNeeded();
        expect(await entry.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    }
    await page.locator('#btn-close-help-header').click(); await expect(help).toBeHidden();
    expect(failures, failures.join('\n')).toEqual([]);
});
