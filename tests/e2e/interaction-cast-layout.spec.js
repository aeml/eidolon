import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const cases = [
    [390, 844, 1], [390, 844, 1.2], [320, 568, 1], [568, 320, 1]
];
for (const [width, height, scale] of cases) for (const hand of ['right', 'left']) {
    test(`${width}x${height} ${hand} hand scale${scale}: cast progress leaves thumb controls visible`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.setViewportSize({ width, height });
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async ({ scale, hand }) => {
            const THREE = await import('three');
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            document.body.classList.add('mobile-mode');
            localStorage.setItem('eidolon.phoneControlHand', hand);
            localStorage.setItem('eidolon.phoneControlSize', String(scale * 100));
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(true);
            const input = new InputManager(new THREE.PerspectiveCamera(), new THREE.Scene());
            input.setupMobileControls(); ui.showHUD(); ui.toggleChat(true);
            if (document.documentElement.dataset.phoneControlHand !== hand ||
                Number(getComputedStyle(document.body).getPropertyValue('--phone-control-scale')) !== scale) {
                throw Error('The real saved control preferences were not applied');
            }
            ui.interactionCast.handle({ id: 1, kind: 'recall', state: 'started', duration: 3 });
            window.__castLayout = { ui, input };
        }, { scale, hand });
        try {
            const panel = page.locator('#interaction-cast');
            await expect(panel).toBeVisible();
            const bounds = await panel.boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.y).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
            const controls = page.locator('#joystick-zone, #mobile-actions, #hotbar-container');
            const measured = [];
            for (let i = 0; i < await controls.count(); i++) {
                const control = controls.nth(i);
                await expect(control).toBeVisible();
                const b = await control.boundingBox();
                measured.push({ id: await control.getAttribute('id'), ...b });
                const overlaps = bounds.x < b.x + b.width && bounds.x + bounds.width > b.x &&
                    bounds.y < b.y + b.height && bounds.y + bounds.height > b.y;
                expect(overlaps, `Cast panel covers ${measured.at(-1).id}`).toBe(false);
            }
            expect(measured).toHaveLength(3);
            await expect(panel).toHaveCSS('pointer-events', 'none');
            await expect(panel).toContainText('Move to cancel');
            await testInfo.attach('cast-and-control-bounds', { body: JSON.stringify({ width, height, scale, hand, panel: bounds, controls: measured }), contentType: 'application/json' });
            await page.screenshot({ path: testInfo.outputPath('cast-controls.png') });
        } finally {
            await page.evaluate(() => {
                const { ui, input } = window.__castLayout;
                input.dispose(); ui.dispose();
            });
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
