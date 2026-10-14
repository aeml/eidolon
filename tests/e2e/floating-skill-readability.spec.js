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

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    test(`${viewport.width}: simultaneous party and skill feedback stays separate in motion`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize(viewport);
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const THREE = await import('three');
            const { FloatingTextManager } = await import('/src/ui/FloatingTextManager.js');
            document.getElementById('start-screen').style.display = 'none';
            const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 100);
            camera.position.set(0, 0, 20); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
            const manager = new FloatingTextManager(camera); window.__skillText = manager;
            ['SERAPH SUMMONED!', 'INTERVENTION UP', 'WARD +120', 'ROOTED', 'ZEAL', 'SMITE'].forEach((text, i) => {
                manager.spawn(text, new THREE.Vector3(), '#ffd36b', '24px', i % 2 ? {
                    compactActorAction: { source: i === 5 ? 'AVENGING SERAPH' : 'ALLY', action: text, anchorHeight: 2.5 }
                } : {});
            });
        });
        const check = async dt => {
            const boxes = await page.evaluate(dt => {
                const m = window.__skillText; m.update(dt);
                return m.texts.map(t => {
                    const b = t.el.getBoundingClientRect();
                    return { x: b.x, right: b.right, y: b.y, bottom: b.bottom, text: t.el.textContent, visible: getComputedStyle(t.el).visibility };
                });
            }, dt);
            expect(boxes).toHaveLength(6);
            for (const [i, a] of boxes.entries()) {
                expect(a.visible).toBe('visible');
                expect(a.x).toBeGreaterThanOrEqual(11); expect(a.right).toBeLessThanOrEqual(page.viewportSize().width - 11);
                expect(a.y).toBeGreaterThanOrEqual(11); expect(a.bottom).toBeLessThanOrEqual(page.viewportSize().height - 11);
                for (const b of boxes.slice(i + 1)) {
                    expect(a.bottom <= b.y || b.bottom <= a.y || a.right <= b.x || b.right <= a.x,
                        `${a.text} overlaps ${b.text}`).toBe(true);
                }
            }
        };
        for (const dt of [.01, .05, .14, .2]) await check(dt);
        await page.screenshot({ path: testInfo.outputPath('party-feedback.png') });
        await page.setViewportSize({ width: 844, height: 390 });
        await check(.1);
        await page.evaluate(() => {
            const m = window.__skillText;
            for (const t of m.texts) t.position.set(9, 6, 0);
        });
        await check(.1);
        await page.evaluate(() => { window.__skillText.update(2); window.__skillText.dispose(); });
        expect(failures, failures.join('\n')).toEqual([]);
    });
}

test('system and in-game reduced motion keep combat feedback stationary and visible', async ({ page, baseURL }) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { FloatingTextManager } = await import('/src/ui/FloatingTextManager.js');
        const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 100);
        camera.position.z = 20; camera.updateMatrixWorld(true);
        window.__skillText = new FloatingTextManager(camera);
        for (const text of ['120', 'DANGER']) window.__skillText.spawn(text, new THREE.Vector3());
    });
    const sample = dt => page.evaluate(dt => {
        const m = window.__skillText; m.update(dt);
        return m.texts.map(t => ({ text: t.el.textContent, transform: t.el.style.transform, opacity: t.el.style.opacity }));
    }, dt);
    const initial = await sample(0);
    expect(initial.every(t => t.opacity === '1' && t.transform.endsWith('scale(1)'))).toBe(true);
    expect(await sample(.2)).toEqual(initial);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    expect(await sample(.1)).not.toEqual(initial);
    await page.evaluate(async () => {
        const { installUIManagerSettings } = await import('/src/ui/UIManagerSettings.js');
        class Settings {}
        installUIManagerSettings(Settings);
        new Settings().setMotionPreference('reduced');
    });
    const reduced = await sample(0);
    expect(await sample(.2)).toEqual(reduced);
    await sample(2);
    expect(await page.evaluate(() => window.__skillText.texts.length)).toBe(0);
    await page.evaluate(() => window.__skillText.dispose());
    expect(failures, failures.join('\n')).toEqual([]);
});
