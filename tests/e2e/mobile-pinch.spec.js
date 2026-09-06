import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('browser touch targets isolate canvas pinches from menu gestures', async ({ page, context }) => {
    // Input-routing fixture, not evidence of a playable phone HUD or real-device
    // performance. Browser-generated touch targets exercise the production class.
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { InputManager } = await import('/src/core/InputManager.js');
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999;background:#14202b;touch-action:none';
        document.body.appendChild(canvas);
        const menu = document.createElement('div');
        menu.textContent = 'Menu gesture fixture';
        menu.style.cssText = 'position:fixed;left:0;top:0;width:120px;height:120px;z-index:100000;background:#fff;color:#000';
        document.body.appendChild(menu);
        const input = new InputManager(null, null, canvas);
        window.__pinchInput = input;
        window.__pinchDeltas = [];
        window.__worldTaps = [];
        input.subscribe('onZoom', delta => window.__pinchDeltas.push(delta));
        input.subscribe('onClick', event => window.__worldTaps.push({ x: event?.clientX, y: event?.clientY }));
        input.setupMobileControls();
    });
    const cdp = await context.newCDPSession(page);
    const touches = (x, y, distance) => [{ id: 1, x, y }, { id: 2, x: x + distance, y }];
    const send = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    try {
        await send('touchStart', touches(150, 300, 50));
        await send('touchMove', touches(150, 300, 100));
        await send('touchEnd', []);
        await expect.poll(() => page.evaluate(() => window.__pinchDeltas.length)).toBe(1);
        const delta = await page.evaluate(() => window.__pinchDeltas[0]);
        expect(delta).toBeCloseTo(-4 * Math.log(2), 5);

        await send('touchStart', touches(20, 50, 30));
        await send('touchMove', touches(20, 50, 70));
        await send('touchEnd', []);
        expect(await page.evaluate(() => window.__pinchDeltas.length)).toBe(1);

        // One finger starts in the menu and the other in the game canvas.
        await send('touchStart', touches(60, 80, 120));
        await send('touchMove', touches(60, 80, 180));
        await send('touchCancel', []);
        expect(await page.evaluate(() => window.__pinchDeltas.length)).toBe(1);
        expect(await page.evaluate(() => window.__pinchInput.pinchState)).toBeNull();
        expect(await page.evaluate(() => window.__worldTaps)).toEqual([]);

        await send('touchStart', [{ id: 1, x: 150, y: 300 }]);
        await send('touchEnd', []);
        expect(await page.evaluate(() => window.__worldTaps)).toEqual([{ x: 150, y: 300 }]);
        await send('touchStart', [{ id: 1, x: 150, y: 300 }]);
        await send('touchMove', [{ id: 1, x: 200, y: 300 }]);
        await send('touchEnd', []);
        expect(await page.evaluate(() => window.__worldTaps)).toHaveLength(1);
    } finally {
        await page.evaluate(() => window.__pinchInput.dispose());
        await cdp.detach();
    }
});
