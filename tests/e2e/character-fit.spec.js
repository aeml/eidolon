import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const type of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
    test(`${type} equipment stays attached in fixed front, side and back movement poses`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
        await page.locator('#gallery-actor').selectOption(type);
        await page.waitForFunction((type) => window.__eidolonAnimationGallery?.ready && window.__eidolonAnimationGallery.actorType === type, type);
        await page.locator('#gallery-equip-all').click();
        for (const state of ['Idle', 'Run', 'Attack']) {
            await page.locator('#gallery-state').selectOption(state);
            await page.locator('#gallery-play-state').click();
            for (const [view, yaw] of [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]]) {
                const pose = await page.evaluate(({ yaw, state }) => {
                    const gallery = window.__eidolonAnimationGalleryController;
                    const actors = [gallery.actor, gallery.remoteActor];
                    for (const actor of actors) {
                        actor.mixer.timeScale = 1;
                        actor.mixer.stopAllAction();
                        actor.state = state === 'Idle' ? 'IDLE' : state === 'Run' ? 'MOVING' : 'ATTACKING';
                        actor.playAnimation(state, state !== 'Attack', true);
                        actor.currentAction.stopFading();
                        actor.currentAction.setEffectiveWeight(1);
                        actor.mixer.setTime(0.21);
                        actor.mixer.timeScale = 0;
                        // Entity.render owns the mesh transform; set the source
                        // quaternion, not a mesh value the next frame replaces.
                        actor.rotation.set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
                        actor.previousRotation.copy(actor.rotation);
                        actor.render(1);
                    }
                    gallery.updateMetrics();
                    return actors.map((actor) => ({
                        time: actor.currentAction.time,
                        weight: actor.currentAction.getEffectiveWeight(),
                        attached: Object.values(actor.mesh.userData.equipmentAnchors).flat().every((name) =>
                            actor.mesh.getObjectByName(name)?.children.some((child) => child.userData.equipmentVisual))
                    }));
                }, { yaw, state });
                for (const actor of pose) {
                    expect(actor.time).toBeCloseTo(0.21);
                    expect(actor.weight).toBe(1);
                    expect(actor.attached).toBe(true);
                }
                const metrics = await page.evaluate(() => window.__eidolonAnimationGallery);
                expect(metrics.equipmentLocalItems).toBe(14);
                expect(metrics.equipmentRemoteItems).toBe(14);
                expect(metrics.currentAnimation).toBe(state);
                expect(metrics.nonFiniteTransforms).toBe(0);
                await page.screenshot({ path: testInfo.outputPath(`${type}-${state}-${view}.png`) });
            }
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
