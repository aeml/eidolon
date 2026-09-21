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
        const { darkRealmChapters } = await import('/src/data/chronicleCatalog.js');
        const { createChronicleSiteModel } = await import('/src/art/ChronicleSiteModels.js');
        const { Wizard } = await import('/src/entities/Wizard.js');
        const gallery = window.__eidolonAnimationGalleryController;
        gallery.cleanupPresentation();
        const render = gallery.renderSystem;
        [gallery.actor, gallery.remoteActor, gallery.targetActor].forEach(actor => { if (actor?.mesh) actor.mesh.visible = false; });
        render.staticEnvironmentGroup.visible = false;
        render.scene.children.filter(child => child.type === 'GridHelper').forEach(child => { child.visible = false; });
        const layout = darkRealmFixture();
        const root = createDarkRealmScene(render.instanceEnvironmentGroup, layout);
        const sites = darkRealmChapters.flatMap(chapter => chapter.sites || []);
        for (const site of sites) {
            const model = createChronicleSiteModel(site, 'dark');
            model.mesh.position.set(site.x, 0, site.z);
            model.beacon.visible = true; // Presentation fixture, not an earned discovery.
            render.instanceEnvironmentGroup.add(model.mesh);
        }
        const reader = new Wizard('dark-realm-reader');
        reader.isRemote = true;
        await reader.ensureMesh();
        render.entityGroup.add(reader.mesh);
        window.__darkRealmSiteView = (model, phone) => {
            const site = sites.find(site => site.model === model);
            const focus = new THREE.Vector3(site.x, 0, site.z);
            reader.position.copy(focus).add(new THREE.Vector3(3, 0, 3));
            reader.update(1 / 60, null, null, []);
            render.setGraphicsQuality(phone ? 'low' : 'high');
            render.setEnvironmentContext('dark_realm', focus, true);
            render.setZoom(phone ? 11 : 15);
            render.camera.zoom = 1; render.camera.updateProjectionMatrix();
            render.camera.position.copy(focus).add(new THREE.Vector3(30, 40, 30));
            gallery.controls.target.copy(focus); gallery.controls.update();
            return { sites: sites.length, actorVisible: Boolean(reader.mesh.visible) };
        };
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
    for (const [model, phone] of [['flood_shelter', false], ['tide_lens', false], ['tide_lens', true]]) {
        await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1280, height: 720 });
        const facts = await page.evaluate(({ model, phone }) => window.__darkRealmSiteView(model, phone), { model, phone });
        expect(facts).toEqual({ sites: 38, actorVisible: true });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.screenshot({ path: testInfo.outputPath(`${model}-${phone ? 'phone' : 'desktop'}.png`) });
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
