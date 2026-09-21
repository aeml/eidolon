import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('Dark Realm circuit renders at real scene coordinates on desktop and phone', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { createDarkRealmScene } = await import('/src/art/ProceduralDarkRealm.js');
        const { darkRealmFixture } = await import('/tests/darkRealmFixture.js');
        const gallery = window.__eidolonAnimationGalleryController;
        gallery.cleanupPresentation();
        const render = gallery.renderSystem;
        [gallery.actor, gallery.remoteActor, gallery.targetActor].forEach(actor => { if (actor?.mesh) actor.mesh.visible = false; });
        render.staticEnvironmentGroup.visible = false;
        render.scene.children.filter(child => child.type === 'GridHelper').forEach(child => { child.visible = false; });
        const layout = darkRealmFixture();
        const root = createDarkRealmScene(render.instanceEnvironmentGroup, layout);
        window.__darkRealmView = (index, phone) => {
            const room = layout.rooms[index];
            const focus = new THREE.Vector3(room.x, 0, room.z);
            render.setGraphicsQuality(phone ? 'low' : 'high');
            render.setEnvironmentContext('dark_realm', focus, true);
            gallery.controls.maxDistance = 1000;
            render.setZoom(30);
            render.camera.zoom = index === 0 ? .3 : .15;
            render.camera.updateProjectionMatrix();
            render.camera.position.copy(focus).add(new THREE.Vector3(200, 350, 240));
            gallery.controls.target.copy(focus);
            gallery.controls.update();
            const bounds = new THREE.Box3().setFromObject(root);
            return { floors: root.children.filter(n => n.name === 'dark-realm-union-floor').length,
                finite: [...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite) };
        };
        document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach(node => { node.style.display = 'none'; });
    });
    for (const [name, index, phone] of [['camp-desktop', 0, false], ['city-desktop', 4, false], ['camp-phone', 0, true]]) {
        if (phone) await page.setViewportSize({ width: 390, height: 844 });
        const facts = await page.evaluate(({ index, phone }) => window.__darkRealmView(index, phone), { index, phone });
        expect(facts.finite).toBe(true);
        expect(facts.floors).toBeGreaterThan(4);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
