import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('Dark King keeps his identity through production animation and regional lighting', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
    await page.locator('#gallery-actor').selectOption('UmbraPrime');
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.actorType === 'UmbraPrime' && window.__eidolonAnimationGallery?.ready);
    expect(await page.evaluate(() => window.__eidolonAnimationGalleryController.actor.mesh.userData.proceduralActorType)).toBe('UmbraPrime');
    await page.evaluate(() => {
        const gallery = window.__eidolonAnimationGalleryController;
        gallery.remoteActor.mesh.visible = false;
        gallery.targetActor.mesh.visible = false;
        gallery.renderSystem.applyLightingPreset('umbral_nexus', true);
        document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach((element) => { element.style.display = 'none'; });
    });
    for (const quality of ['high', 'low']) {
    await page.evaluate((quality) => window.__eidolonAnimationGalleryController.renderSystem.setGraphicsQuality(quality), quality);
    for (const state of ['Idle', 'Run', 'Attack', 'Death']) {
        await page.evaluate((state) => {
            const actor = window.__eidolonAnimationGalleryController.actor;
            actor.mixer.timeScale = 1;
            actor.mixer.stopAllAction();
            actor.state = state === 'Idle' ? 'IDLE' : state === 'Run' ? 'MOVING' : state === 'Death' ? 'DEAD' : 'ATTACKING';
            actor.playAnimation(state, state === 'Idle' || state === 'Run', true);
            actor.currentAction.stopFading();
            actor.currentAction.setEffectiveWeight(1);
            actor.mixer.setTime(state === 'Death' ? 0.8 : 0.21);
            actor.mixer.timeScale = 0;
        }, state);
        await page.screenshot({ path: testInfo.outputPath(`king-${quality}-${state}.png`) });
    }
    }
    for (const [view, yaw] of [['side', Math.PI / 2], ['back', Math.PI]]) {
        await page.evaluate((yaw) => {
            const actor = window.__eidolonAnimationGalleryController.actor;
            actor.mixer.stopAllAction();
            actor.mesh.userData.resetPose();
            actor.state = 'IDLE';
            actor.rotation.set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
            actor.previousRotation.copy(actor.rotation);
            actor.render(1);
        }, yaw);
        await page.screenshot({ path: testInfo.outputPath(`king-${view}.png`) });
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
