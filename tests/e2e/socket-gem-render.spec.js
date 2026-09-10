import { expect, test } from '@playwright/test';
import { compareAuraPixels } from '../auraPixelComparison.js';
import { collectBrowserFailures } from './helpers.js';

// Prepared production-renderer/actor scene, not Forge, network replication,
// earned equipment or physical-phone evidence. Compare identical fixed poses.
test('seven socket palettes render consistently across supported records on all four class rigs', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(180_000);
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1280, height: 720 });
    // This comparator measures generic RGB differences despite its original
    // aura-specific name; neutral sockets supply the visible-signal baseline.
    await page.addInitScript({ content: `window.__compareSocketPixels = (${compareAuraPixels.toString()});` });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const metadata = await page.evaluate(async () => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { applyProceduralEquipment } = await import('/src/art/ProceduralEquipment.js');
        const { getProceduralItemIcon } = await import('/src/art/ProceduralIcons.js');
        const { GEM_TYPES } = await import('/src/core/ItemSystem.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(false);
        document.body.appendChild(render.renderer.domElement);
        const actors = [], classes = ['Fighter', 'Rogue', 'Wizard', 'Cleric'];
        for (const [index, name] of classes.entries()) {
            const Actor = (await import(`/src/entities/${name}.js`))[name];
            const actor = new Actor(`socket-preview-${index}`);
            await actor.ensureMesh();
            actor.position.set((index - 1.5) * 3.2, 0, 0);
            actor.mesh.position.copy(actor.position);
            render.scene.add(actor.mesh); actors.push(actor);
        }
        render.cameraOffset.set(0, 12, 18);
        render.setCameraTarget(new THREE.Vector3(0, 1, 0)); render.setZoom(8);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30),
            new THREE.MeshStandardMaterial({ color: 0x29352d }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = -.05; render.scene.add(ground);
        const legend = document.createElement('div');
        Object.assign(legend.style, { position: 'fixed', left: '24px', top: '24px', zIndex: 1000,
            color: 'white', background: '#15151be8', padding: '12px', font: '16px sans-serif' });
        const title = document.createElement('div'); legend.appendChild(title);
        const icons = [document.createElement('img'), document.createElement('img')];
        for (const icon of icons) { icon.width = icon.height = 72; legend.appendChild(icon); }
        document.body.appendChild(legend);
        const labels = document.createElement('div'); document.body.appendChild(labels);
        for (const [index, name] of classes.entries()) {
            const label = document.createElement('div'); label.textContent = name;
            Object.assign(label.style, { position: 'fixed', zIndex: 1000, color: 'white',
                background: '#15151be8', padding: '8px', font: '16px sans-serif',
                left: `${index % 2 * innerWidth / 2 + 16}px`, top: `${Math.floor(index / 2) * innerHeight / 2 + 16}px` });
            labels.appendChild(label);
        }
        const target = new THREE.WebGLRenderTarget(768, 432);
        const sword = gem => ({ id: 'same-socketed-sword', name: 'Iron Sword', baseName: 'Iron Sword',
            type: 'WEAPON', slot: 'mainHand', level: 1, rarity: 'Rare', sockets: 1, gems: [gem] });
        const apply = gem => actors.map(actor => applyProceduralEquipment(actor.mesh, { mainHand: sword(gem) }));
        const capture = () => {
            const previous = render.renderer.getRenderTarget(), pixels = new Uint8Array(768 * 432 * 4);
            try {
                render.renderer.setRenderTarget(target); render.renderer.render(render.scene, render.camera);
                render.renderer.readRenderTargetPixels(target, 0, 0, 768, 432, pixels);
                return pixels;
            } finally { render.renderer.setRenderTarget(previous); }
        };
        window.__socketPreview = {
            async compare(type, quality) {
                labels.style.display = 'none'; legend.style.top = '24px'; legend.style.bottom = 'auto';
                icons.forEach(icon => icon.style.display = '');
                render.setGraphicsQuality(quality);
                apply({ type: 'Unknown' }); const neutral = capture();
                const canonicalGem = { type: GEM_TYPES[type].name, quality: 'Flawed' };
                apply(canonicalGem); const canonical = capture();
                const variants = [];
                for (const gem of [{ type, quality: 'Flawed' }, { gemType: type, quality: 'Flawed' },
                    { gemType: GEM_TYPES[type].name, quality: 'Flawed' }]) {
                    const results = apply(gem);
                    variants.push({ pixels: window.__compareSocketPixels(capture(), canonical, neutral),
                        changed: results.map(result => result.changed),
                        iconsEqual: getProceduralItemIcon(sword(gem)) === getProceduralItemIcon(sword(canonicalGem)) });
                }
                title.textContent = `${GEM_TYPES[type].name} • ${quality} • Fighter / Rogue / Wizard / Cleric`;
                icons[0].src = getProceduralItemIcon(sword(canonicalGem));
                icons[1].src = getProceduralItemIcon(sword({ gemType: type, quality: 'Flawed' }));
                icons[0].alt = 'Canonical socket icon'; icons[1].alt = 'Equivalent enum socket icon';
                await Promise.all(icons.map(icon => icon.decode()));
                render.renderer.render(render.scene, render.camera);
                return { variants, sockets: actors.map(actor => {
                    const socket = actor.mesh.getObjectByName('Gear_Socket1');
                    return { color: socket?.material.color.getHex(),
                        item: actor.mesh.getObjectByName('EquippedVisual_mainHand')?.userData.itemId };
                }) };
            },
            closeups() {
                // Inspect the actual attached weapon in place, not a detached
                // replacement mesh or enlarged gem. Four cameras face each
                // socket's local front; only this prepared review view changes.
                labels.style.display = ''; legend.style.top = 'auto'; legend.style.bottom = '4px';
                icons.forEach(icon => icon.style.display = 'none');
                const renderer = render.renderer, size = renderer.getSize(new THREE.Vector2()), views = [];
                renderer.setScissorTest(true);
                try {
                    for (const [index, actor] of actors.entries()) {
                        actor.mesh.updateMatrixWorld(true);
                        const item = actor.mesh.getObjectByName('EquippedVisual_mainHand');
                        const socket = actor.mesh.getObjectByName('Gear_Socket1');
                        const box = new THREE.Box3().setFromObject(item), center = box.getCenter(new THREE.Vector3());
                        const extent = box.getSize(new THREE.Vector3());
                        const front = new THREE.Vector3(0, 0, 1).applyQuaternion(socket.getWorldQuaternion(new THREE.Quaternion()));
                        const camera = new THREE.PerspectiveCamera(35, size.x / size.y, .01, 100);
                        camera.position.copy(center).addScaledVector(front, Math.max(.5, extent.length() * 1.8));
                        camera.lookAt(center); camera.updateMatrixWorld();
                        const projected = socket.getWorldPosition(new THREE.Vector3()).project(camera);
                        views.push({ className: classes[index], extent: extent.toArray(), projected: projected.toArray() });
                        const x = index % 2 * size.x / 2, y = (1 - Math.floor(index / 2)) * size.y / 2;
                        renderer.setViewport(x, y, size.x / 2, size.y / 2);
                        renderer.setScissor(x, y, size.x / 2, size.y / 2);
                        renderer.render(render.scene, camera);
                    }
                } finally { renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x, size.y); }
                return views;
            },
            dispose() { actors.forEach(actor => actor.dispose()); target.dispose();
                ground.geometry.dispose(); ground.material.dispose(); render.dispose(); legend.remove(); labels.remove(); }
        };
        const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        return { classes, gems: Object.keys(GEM_TYPES).filter(type => type === type.toUpperCase()),
            renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
    });
    const results = [];
    try {
        expect(metadata.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        expect(metadata.gems).toHaveLength(7);
        for (const quality of ['high', 'low']) for (const type of metadata.gems) {
            const result = await page.evaluate(({ type, quality }) => window.__socketPreview.compare(type, quality), { type, quality });
            results.push({ type, quality, ...result });
            expect(result.sockets).toHaveLength(4);
            for (const socket of result.sockets) {
                expect(socket.item).toBe('same-socketed-sword');
                expect(socket.color).not.toBe(0x26262d);
            }
            for (const variant of result.variants) {
                expect(variant.pixels.referenceSignal, 'socket color must actually affect rendered pixels').toBeGreaterThan(0);
                expect(variant.pixels.absoluteDifference).toBe(0);
                expect(variant.changed).toEqual([false, false, false, false]);
                expect(variant.iconsEqual).toBe(true);
            }
            await page.screenshot({ path: testInfo.outputPath(`sockets-${type.toLowerCase()}-${quality}.png`) });
            const closeups = await page.evaluate(() => window.__socketPreview.closeups());
            for (const view of closeups) {
                expect(view.extent.every(value => Number.isFinite(value) && value > 0)).toBe(true);
                expect(view.projected.every(value => Number.isFinite(value) && Math.abs(value) < 1)).toBe(true);
            }
            results.at(-1).closeups = closeups;
            await page.screenshot({ path: testInfo.outputPath(`socket-details-${type.toLowerCase()}-${quality}.png`) });
        }
        await testInfo.attach('socket-render-evidence', { body: JSON.stringify({ metadata, results }, null, 2), contentType: 'application/json' });
        expect(failures, failures.join('\n')).toEqual([]);
    } finally { await page.evaluate(() => window.__socketPreview.dispose()); }
});
