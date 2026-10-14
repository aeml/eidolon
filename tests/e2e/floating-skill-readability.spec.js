import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('skill messages stay readable at phone edges, rotate and retire', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { FloatingTextManager } = await import('/src/ui/FloatingTextManager.js');
        document.getElementById('start-screen').style.display = 'none';
        const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 100);
        camera.position.set(0, 0, 20); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
        const manager = new FloatingTextManager(camera);
        window.__skillText = manager;
        for (const [text, x, y] of [['SERAPH SUMMONED!', -9, 0], ['DIVINE INTERVENTION PROTECTS YOUR ALLIES', 9, -5]]) {
            manager.spawn(text, new THREE.Vector3(x, y, 0), '#ffd36b');
        }
        manager.update(.01);
    });
    const labels = page.locator('#ui-layer > div').filter({ hasText: /SERAPH SUMMONED!|DIVINE INTERVENTION PROTECTS YOUR ALLIES/ });
    await expect(labels).toHaveCount(2);
    const check = async () => {
        for (const label of await labels.all()) {
            const box = await label.boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(11);
            expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width - 11);
            expect(box.y).toBeGreaterThanOrEqual(11);
            expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height - 11);
            await expect(label).toHaveCSS('pointer-events', 'none');
            expect(await label.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        }
    };
    await check();
    await page.screenshot({ path: testInfo.outputPath('phone-skill-messages.png') });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => window.__skillText.update(.1));
    await check();
    await page.evaluate(() => { const m = window.__skillText; m.texts[0].position.x = 100; m.update(.1); });
    await expect(labels.first()).toHaveCSS('visibility', 'hidden');
    const recycled = await page.evaluate(async () => {
        const THREE = await import('three');
        const m = window.__skillText, old = new Set(m.texts.map(t => t.el));
        m.update(2); m.spawn('1287', new THREE.Vector3()); m.update(.15);
        const t = m.texts[0];
        return { reused: old.has(t.el), width: t.el.style.width, maxWidth: t.el.style.maxWidth, visibility: t.el.style.visibility, text: t.el.textContent };
    });
    expect(recycled).toEqual({ reused: true, width: '', maxWidth: '', visibility: 'visible', text: '1287' });
    await page.evaluate(() => window.__skillText.dispose());
    await expect(labels).toHaveCount(0);
    expect(failures, failures.join('\n')).toEqual([]);
});
