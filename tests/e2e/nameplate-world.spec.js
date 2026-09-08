import { devices, expect, test } from '@playwright/test';
import { credentialsFromEnvironment, loginAndEnterWorld, projectEntity } from './helpers.js';
import { openIlyra } from './chronicle-earth-route.js';
import { walkToIlyra } from './mobile-ilyra.js';

// Disposable real-server scene, no level/gear/quest grants. Account labels and
// DOM transcripts are hidden only for the explicit world screenshot.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    test.describe(`${viewport.width}`, () => {
        const mobile = viewport.width < 900;
        test.use({ viewport, hasTouch: mobile, isMobile: mobile,
            ...(mobile ? { userAgent: devices['Pixel 7'].userAgent } : {}) });
        test('real town renders readable Ilyra label and still opens her quest', async ({ page, context }, testInfo) => {
            const credentials = credentialsFromEnvironment();
            test.skip(!credentials.username || !credentials.password, 'Needs a disposable character');
            expect(process.env.EIDOLON_E2E_REGISTER).toBe('1');
            credentials.username += `-names-${viewport.width}`;
            await page.setViewportSize(viewport);
            await loginAndEnterWorld(page, credentials);
            if (mobile) await walkToIlyra(page, context);
            else await openIlyra(page);
            await expect(page.locator('#quest-window')).toContainText('Ilyra');
            if (mobile) await page.locator('#btn-close-quest').tap();
            else await page.locator('#btn-close-quest').click();
            if (!mobile) await expect.poll(async () => {
                const point = await projectEntity(page, 'story-wizard-1');
                if (!point?.visible) return false;
                await page.mouse.move(point.x, point.y);
                return page.evaluate(() => window.game.hoveredEntity?.id === 'story-wizard-1');
            }).toBe(true);
            await expect.poll(() => page.evaluate(() => {
                const game = window.game, npc = game.remotePlayers.get('story-wizard-1');
                return Boolean(game.nameplatePresentation && npc?.nameTag?.visible && npc.questMarker?.visible);
            })).toBe(true);
            const result = await page.evaluate(async () => {
                const { Vector3 } = await import('three');
                const game = window.game, camera = game.renderSystem.camera;
                const npc = game.remotePlayers.get('story-wizard-1');
                const scale = npc.nameTag.getWorldScale(new Vector3());
                return { height: scale.y / ((camera.top - camera.bottom) / camera.zoom) * innerHeight,
                    marker: npc.questMarker.userData.symbol,
                    labels: game.nameplatePresentation.visibleIds.size, mobile: game.isMobile,
                    frame: game.frameCount, level: game.player.level };
            });
            expect(result.height).toBeCloseTo(22, 2);
            expect(result.marker).toBe('!');
            expect(result.level).toBe(1);
            expect(result.labels).toBeLessThanOrEqual(result.mobile ? 8 : 12);
            await expect.poll(() => page.evaluate(() => window.game.frameCount)).toBeGreaterThan(result.frame + 3);
            try {
                await page.evaluate(() => {
                    const game = window.game;
                    window.__nameplateCapture = { suspended: game.nameplatePresentation.suspended, hidden: [] };
                    game.nameplatePresentation.suspended = true;
                    for (const entity of new Set([game.player, ...game.chunkManager.getActiveEntities()])) {
                        if (entity.nameTag && (entity === game.player || game.isPlayerClassEntity(entity))) {
                            window.__nameplateCapture.hidden.push([entity.nameTag, entity.nameTag.visible]);
                            entity.nameTag.visible = false;
                        }
                    }
                    game.renderSystem.render();
                });
                await page.screenshot({ path: testInfo.outputPath('town-nameplate.png'),
                    style: 'body > :not(canvas), body > :not(canvas) * { visibility: hidden !important; }' });
            } finally {
                await page.evaluate(() => {
                    const state = window.__nameplateCapture;
                    if (!state) return;
                    for (const [tag, visible] of state.hidden) tag.visible = visible;
                    window.game.nameplatePresentation.suspended = state.suspended;
                    delete window.__nameplateCapture;
                });
            }
        });
    });
}
