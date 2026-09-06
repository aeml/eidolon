import { devices, expect, test } from '@playwright/test';

test.use({ hasTouch: true, isMobile: true, userAgent: devices['Pixel 7'].userAgent });

test('a populated phone party roster never intercepts the joystick or combat controls', async ({ page, context }) => {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        const { InputManager } = await import('/src/core/InputManager.js');
        document.body.classList.add('mobile-mode'); document.getElementById('start-screen').style.display = 'none';
        const ui = new UIManager(true); window.__partyPhoneUI = ui;
        const input = new InputManager(null, null); input.setupMobileControls(); window.__partyPhoneInput = input;
        ui.showHUD(); ui.toggleChat(true);
        ui.lastPlayerRef = { id: 'member-0', name: 'Phone Adventurer' };
        ui.social.updateParty({ partyId: 'layout-party', leaderId: 'member-0', members: Array.from({ length: 5 }, (_, index) => ({
            id: `member-${index}`, name: `Long Named Adventurer ${index}`, level: 30, subType: 'Fighter', hp: 100, maxHp: 100
        })) });
    });
    const cdp = await context.newCDPSession(page);
    try {
        for (const [width, height] of [[390, 844], [844, 390], [568, 320]]) {
            await page.setViewportSize({ width, height });
            await expect(page.locator('#party-panel')).toBeVisible();
            for (const target of await page.locator('#joystick-zone, #mobile-actions .mobile-btn, #hotbar-container .hotbar-slot').all()) {
                await expect(target).toBeInViewport();
                expect(await target.evaluate(element => {
                    const rect = element.getBoundingClientRect();
                    return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
                }), `${width}x${height}: populated party must not intercept ${await target.getAttribute('id')}`).toBe(true);
            }
            const stick = await page.locator('#joystick-zone').boundingBox();
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 92,
                x: stick.x + stick.width / 2 + 24, y: stick.y + stick.height / 2 }] });
            await expect.poll(() => page.evaluate(() => window.__partyPhoneInput.joystickVector.length())).toBeGreaterThan(0);
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await expect.poll(() => page.evaluate(() => window.__partyPhoneInput.joystickVector.length())).toBe(0);
            await page.screenshot({ path: `/tmp/eidolon-phone-party-controls-${width}.png` });
        }
    } finally {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }).catch(() => {}); await cdp.detach();
        await page.evaluate(() => { window.__partyPhoneInput.dispose(); window.__partyPhoneUI.characterPreview.dispose(); });
    }
});

test('phone HUD keeps thumb targets and expandable permanent chat usable in both orientations', async ({ page }, testInfo) => {
    for (const [width, height] of [[390, 844], [844, 390]]) {
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            const { Minimap } = await import('/src/ui/Minimap.js');
            document.body.classList.add('mobile-mode');
            document.getElementById('start-screen').style.display = 'none';
            window.__phoneUI = new UIManager(true);
            window.__phoneMinimap = new Minimap();
            window.__phoneInput = new InputManager(null, null);
            window.__phoneInput.setupMobileControls();
            window.__phoneInput.subscribe('onEscape', () => window.__phoneUI.handleEscape());
            window.__phoneUI.showHUD();
            window.__phoneUI.toggleChat(true);
        });
        await page.screenshot({ path: testInfo.outputPath(`phone-hud-${width}-${height}.png`) });
        const targets = page.locator('#mobile-ui .mobile-btn, #hotbar-container .hotbar-slot');
        for (const target of await targets.all()) {
            await expect(target).toBeInViewport();
            const bounds = await target.boundingBox();
            expect(bounds.width).toBeGreaterThanOrEqual(44);
            expect(bounds.height).toBeGreaterThanOrEqual(44);
            expect(await target.evaluate(element => {
                const rect = element.getBoundingClientRect();
                return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
            })).toBe(true);
        }
        const toggle = page.getByRole('button', { name: 'Open chat history' });
        await expect(toggle).toBeVisible();
        expect((await page.locator('#chat-box').boundingBox()).height).toBeLessThanOrEqual(56);
        await page.evaluate(() => window.__phoneUI.chat.addMessage('Ilyra', 'The crystals need you.'));
        await expect(toggle).toContainText('1 new');
        await toggle.tap();
        await expect(page.locator('#chat-messages')).toBeVisible();
        await expect(page.locator('#chat-messages')).toContainText('The crystals need you.');
        await expect(page.locator('#chat-input')).toBeInViewport();
        await page.getByRole('button', { name: 'Collapse chat history' }).tap();
        await expect(toggle).toBeVisible();
        await expect(page.locator('#chat-box')).toBeVisible();
        await page.getByRole('button', { name: 'Menu', exact: true }).tap();
        await expect(page.locator('#esc-menu')).toBeVisible();
        await page.getByRole('button', { name: 'Skills & Runes', exact: true }).tap();
        await expect(page.locator('#esc-menu')).toBeHidden();
        await expect(page.locator('#skill-tree-window')).toBeVisible();
        await page.locator('#btn-close-skills').tap();
        await expect(page.locator('#skill-tree-window')).toBeHidden();
        await page.evaluate(() => {
            window.__phoneUI.onMobileTargetClear = () => {
                window.__targetCleared = true;
                document.getElementById('combat-intent-panel').style.display = 'none';
            };
            document.getElementById('combat-intent-name').textContent = 'Selected Skeleton';
            document.getElementById('combat-intent-status').textContent = 'In range';
            document.getElementById('combat-intent-panel').style.display = 'block';
        });
        await page.screenshot({ path: testInfo.outputPath(`phone-target-${width}-${height}.png`) });
        const clearTarget = page.getByRole('button', { name: 'Clear target and cancel pursuit' });
        const clearBounds = await clearTarget.boundingBox();
        expect(clearBounds.width).toBeGreaterThanOrEqual(44);
        expect(clearBounds.height).toBeGreaterThanOrEqual(44);
        await clearTarget.tap();
        expect(await page.evaluate(() => window.__targetCleared)).toBe(true);
        await expect(page.locator('#combat-intent-panel')).toBeHidden();
        await page.evaluate(() => window.__phoneInput.dispose());
    }
});
