import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, height] of [[1280, 720], [390, 844]]) {
    test(`${width}x${height}: combat card shows cast cost without invented damage`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        // Presentation fixture using the real controller/UI/CSS. No claim of
        // an actual server cast, combat outcome or physical-phone verification.
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { AbilityController } = await import('/src/core/AbilityController.js');
            const { GameEngine } = await import('/src/core/GameEngine.js');
            const { Vector3 } = await import('three');
            document.getElementById('start-screen').style.display = 'none';
            const ui = Object.create(UIManager.prototype);
            Object.assign(ui, { isMobile: mobile,
                combatIntentPanel: document.getElementById('combat-intent-panel'),
                combatIntentName: document.getElementById('combat-intent-name'),
                combatIntentMeta: document.getElementById('combat-intent-meta'),
                combatIntentStatus: document.getElementById('combat-intent-status'),
                combatIntentPreviewBasic: document.getElementById('combat-intent-preview-basic'),
                combatIntentPreviewAbility: document.getElementById('combat-intent-preview-ability'),
                combatIntentPreviewAbilityLabel: document.getElementById('combat-intent-preview-ability-label') });
            const player = { constructor: { name: 'Wizard' }, abilityName: 'Fireball', stats: { damage: 5 },
                position: new Vector3(0, 0, 200), safeZoneId: '' };
            const controller = new AbilityController({ player });
            const target = { id: 'imp', name: 'Imp', subType: 'Imp', level: 20,
                constructor: { name: 'Imp' }, position: new Vector3(11.2, 0, 200) };
            const engine = Object.create(GameEngine.prototype);
            Object.assign(engine, { player, abilityController: controller, getEffectiveCombatTarget: () => target });
            const refresh = () => ui.updateCombatIntent(engine.buildCombatIntentState());
            window.__combatPreview = { player, refresh, ui };
            refresh();
        }, width < 600);
        await expect(page.locator('#combat-intent-preview-basic')).toHaveText('5');
        await expect(page.locator('#combat-intent-preview-ability')).toHaveText('30 MP');
        await expect(page.locator('#combat-intent-panel')).not.toContainText('~');
        await page.evaluate(() => {
            window.__combatPreview.player.stats.manaCostReduction = .1;
            window.__combatPreview.refresh();
        });
        await expect(page.locator('#combat-intent-preview-ability')).toHaveText('27 MP');
        if (width > 600) await expect(page.getByText('Attack power', { exact: true })).toBeVisible();
        else await expect(page.locator('#combat-intent-name')).toHaveText('Level 20 • Imp');
        const bounds = await page.locator('#combat-intent-panel').boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
        await page.screenshot({ path: testInfo.outputPath('combat-card.png') });
        await page.evaluate(() => {
            window.__combatPreview.player.safeZoneId = 'lanternhold';
            window.__combatPreview.refresh();
        });
        await expect(page.locator('#combat-intent-status')).toHaveText('Leave the safe zone');
        await expect(page.locator('#combat-intent-status')).not.toHaveClass(/is-in-range/);
        await page.screenshot({ path: testInfo.outputPath('safe-zone-warning.png') });
        await page.evaluate(() => {
            window.__combatPreview.player.safeZoneId = '';
            window.__combatPreview.refresh();
        });
        await expect(page.locator('#combat-intent-status')).toHaveText('In Range');
        await page.evaluate(() => window.__combatPreview.ui.clearCombatIntent());
        await expect(page.locator('#combat-intent-panel')).toBeHidden();
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
