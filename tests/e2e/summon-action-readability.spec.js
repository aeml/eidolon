import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('desktop summon smite labels retain attribution above a readable model', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { FloatingTextManager } = await import('/src/ui/FloatingTextManager.js');
        const { AvengingSeraph } = await import('/src/entities/AvengingSeraph.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(false), summon = new AvengingSeraph('ally');
        await summon.ensureMesh(); render.entityGroup.add(summon.mesh);
        render.setCameraTarget(summon.position); render.setZoom(15);
        const floating = new FloatingTextManager(render.camera), engine = Object.create(GameEngine.prototype);
        Object.assign(engine, { isMobile: false, player: { id: 'self', position: summon.position },
            floatingTextManager: floating, readabilityFeedbackTimestamps: new Map() });
        engine.showRemoteActionReadability(summon, 'Smite');
        floating.update(.15); render.render();
        window.__summonLabel = { render, summon, floating, engine };
    });
    const label = page.locator('.floating-text--compact-action');
    await expect(label).toHaveCount(1);
    await expect(label).toHaveAttribute('aria-label', 'AVENGING SERAPH: SMITE');
    await expect(label.locator('[data-floating-source]')).toHaveText('AVENGING SERAPH');
    await expect(label.locator('[data-floating-action]')).toHaveText('SMITE');
    const bounds = await label.boundingBox();
    expect(bounds.width).toBeLessThanOrEqual(216);
    expect(bounds.height).toBeLessThanOrEqual(48);
    await expect(label).toHaveCSS('pointer-events', 'none');
    const feet = await page.evaluate(() => {
        const q = window.__summonLabel, point = q.summon.position.clone().project(q.render.camera);
        return { x: (point.x+1)*innerWidth/2, y: (1-point.y)*innerHeight/2 };
    });
    expect(bounds.y+bounds.height).toBeLessThan(feet.y-30);
    await page.screenshot({ path: testInfo.outputPath('seraph-compact-smite.png') });
    await page.evaluate(() => {
        const q = window.__summonLabel; q.floating.update(2);
        q.summon.dispose(); q.floating.dispose(); q.render.dispose();
    });
    await expect(label).toHaveCount(0);
    expect(failures, failures.join('\n')).toEqual([]);
});
