import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, userAgent: devices['Pixel 7'].userAgent });

async function boot(page) {
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { UIManager } = await import('/src/ui/UIManager.js');
        const { InputManager } = await import('/src/core/InputManager.js');
        const { TouchAbilityAim } = await import('/src/core/TouchAbilityAim.js');
        document.body.classList.add('mobile-mode');
        document.getElementById('start-screen').style.display = 'none';
        const ui = new UIManager(true), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
        camera.position.set(0, 10, 10); camera.lookAt(0, 0, 0);
        const input = new InputManager(camera, scene); input.setupMobileControls();
        const casts = [], interruptions = [];
        const engine = { inputManager: input, renderSystem: { scene, camera }, uiManager: ui,
            player: { position: new THREE.Vector3(), abilityName: 'Fireball', hotbar: ['Fireball'], state: 'IDLE' },
            abilityController: { canGroundAim: () => true, getAbilityCastRange: () => 12,
                performAbility: (...args) => casts.push(args.length ? 'aim' : 'tap'), performHotbarAbility: () => casts.push('slot') } };
        const aim = new TouchAbilityAim(engine);
        ui.onPhoneMenuOpen = () => input.clearInputState();
        input.subscribe('onInterruption', () => interruptions.push('interrupted'));
        ui.showHUD(); ui.toggleChat(true);
        window.__phoneSession = { ui, input, aim, engine, casts, interruptions };
    });
}

async function cleanup(page) {
    await page.evaluate(() => {
        const s = window.__phoneSession;
        s.input.dispose(); s.ui.viewportLayout.dispose(); s.ui.characterPreview.dispose(); s.ui.social.phoneParty.dispose();
    });
}

for (const [width, height] of [[390, 844], [844, 390]]) {
    test(`${width}x${height}: repeated two-thumb aiming releases movement and survives interruption`, async ({ page, context, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height }); await page.goto('/', { waitUntil: 'networkidle' });
        await boot(page);
        const cdp = await context.newCDPSession(page);
        const send = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
        const centers = async () => {
            const stick = await page.locator('#joystick-zone').boundingBox();
            const skill = await page.locator('#btn-mobile-ability').boundingBox();
            return { move: { id: 1, x: stick.x + stick.width / 2 + 20, y: stick.y + stick.height / 2 },
                skill: { id: 2, x: skill.x + skill.width / 2, y: skill.y + skill.height / 2 } };
        };
        try {
            const { move, skill } = await centers();
            for (let i = 0; i < 12; i++) {
                await send('touchStart', [move]);
                await send('touchStart', [move, skill]);
                await send('touchMove', [move, { ...skill, x: skill.x - 60 }]);
                if (i === 0) {
                    await expect(page.locator('.touch-ability-aim-hint')).toContainText('Fireball');
                    await page.screenshot({ path: testInfo.outputPath('two-thumb-aim.png') });
                }
                await send(i % 3 === 0 ? 'touchCancel' : 'touchEnd', []);
                expect(await page.evaluate(() => window.__phoneSession.input.joystickVector.lengthSq())).toBe(0);
            }
            expect(await page.evaluate(() => window.__phoneSession.casts)).toHaveLength(8);
            // Changing layout while holding both thumbs must discard the gesture.
            await send('touchStart', [move]); await send('touchStart', [move, skill]);
            await page.setViewportSize({ width: height, height: width });
            await send('touchEnd', []);
            expect(await page.evaluate(() => window.__phoneSession.casts)).toHaveLength(8);
            expect(await page.evaluate(() => window.__phoneSession.input.joystickVector.lengthSq())).toBe(0);
            expect(await page.evaluate(() => window.__phoneSession.aim.gesture)).toBeNull();
            const next = await centers();
            await send('touchStart', [next.skill]);
            await page.evaluate(() => window.__phoneSession.ui.toggleJournal());
            await send('touchEnd', []);
            expect(await page.evaluate(() => window.__phoneSession.casts)).toHaveLength(8);
            await page.evaluate(() => window.__phoneSession.ui.quest.closeJournal());
            await send('touchStart', [next.skill]); await send('touchEnd', []);
            expect(await page.evaluate(() => window.__phoneSession.casts)).toHaveLength(9);
            await send('touchStart', [next.move]); await send('touchStart', [next.move, next.skill]);
            await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
            await send('touchEnd', []);
            expect(await page.evaluate(() => window.__phoneSession.casts)).toHaveLength(9);
            expect(await page.evaluate(() => window.__phoneSession.input.joystickVector.lengthSq())).toBe(0);
        } finally { await cleanup(page); await cdp.detach(); }
        expect(failures, failures.join('\n')).toEqual([]);
    });
}

test('phone editors fit a reduced visual viewport and restore the original layout without camera zoom', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/', { waitUntil: 'networkidle' });
    await boot(page);
    try {
        await page.evaluate(() => window.__phoneSession.ui.toggleTradingHouse());
        const trading = page.locator('#trading-house-screen');
        const original = await trading.boundingBox();
        await page.locator('#trading-search-input').focus();
        // Desktop Chrome has no phone OS keyboard. Simulate its viewport report,
        // not renderer/canvas resizing; this is not actual-device certification.
        await page.evaluate(() => {
            const viewport = Object.assign(new EventTarget(), { height: 380, offsetTop: 15, scale: 1 });
            window.__phoneViewportOriginal = Object.getOwnPropertyDescriptor(window, 'visualViewport');
            Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
            window.__phoneSession.ui.viewportLayout.refresh();
        });
        await expect(page.locator('body')).toHaveAttribute('data-phone-keyboard', 'true');
        const compact = await trading.boundingBox();
        expect(compact.x).toBeGreaterThanOrEqual(0);
        expect(compact.x + compact.width).toBeLessThanOrEqual(390);
        expect(compact.y).toBeGreaterThanOrEqual(15);
        expect(compact.y + compact.height).toBeLessThanOrEqual(395);
        await expect(page.locator('#trading-search-input')).toBeInViewport();
        await page.screenshot({ path: testInfo.outputPath('phone-keyboard-search.png') });
        await page.locator('#trading-search-input').evaluate(node => node.blur());
        await expect(page.locator('body')).not.toHaveAttribute('data-phone-keyboard', 'true');
        const restored = await trading.boundingBox();
        expect(restored.height).toBeCloseTo(original.height, 0);
        await page.evaluate(() => {
            Object.defineProperty(window, 'visualViewport', window.__phoneViewportOriginal);
        });
    } finally {
        await page.evaluate(() => {
            if (window.__phoneViewportOriginal) Object.defineProperty(window, 'visualViewport', window.__phoneViewportOriginal);
        });
        await cleanup(page);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
