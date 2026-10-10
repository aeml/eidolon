import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
for (const quality of ['high', 'low']) test(`${quality}: default actor multi-draw returns pooled roots and has an exact extension fallback`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        const owner = render.actorInstances, multi = owner.multiDraw;
        if (!multi?.enabled || !multi.perInstanceFrustum) throw Error('Default startup owner missing');
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x4a4842, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; render.scene.add(floor);
        render.setZoom(18); render.setCameraTarget(new THREE.Vector3(0, 1, 0));
        render.applyLightingPreset('town', true); render.updateEnvironmentLighting(new THREE.Vector3(), 0);
        const rows = [], pooled = new Set(); let models = [], fallback;
        const memory = () => ({ ...render.renderer.info.memory });
        try {
            for (let cycle = 0; cycle < 3; cycle++) {
                for (let i = 0; i < 6; i++) {
                    const mesh = await MeshFactory.createMeshForType('Skeleton');
                    mesh.position.set((i % 3 - 1) * 12, 0, i < 3 ? -3 : 3);
                    if (cycle && pooled.has(mesh)) rows.push({ phase: 'pooled-root-return', cycle });
                    render.entityGroup.add(mesh); models.push(mesh);
                }
                render.render();
                rows.push({ phase: 'populated', cycle, roots: owner.roots.size, groups: multi.entries.size, memory: memory(),
                    restored: !owner.hidden.length && !multi.hidden.length && !owner.group.visible && !multi.group.visible });
                if (!cycle) {
                    const canvas = render.renderer.domElement, copy = document.createElement('canvas');
                    copy.width = canvas.width; copy.height = canvas.height;
                    const context = copy.getContext('2d', { willReadFrequently: true });
                    const has = render.renderer.extensions.has, descriptor = Object.getOwnPropertyDescriptor(render.renderer.extensions, 'has');
                    const now = Object.getOwnPropertyDescriptor(performance, 'now'), frozen = performance.now();
                    try {
                        Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
                        render.render(); context.drawImage(canvas, 0, 0);
                        const reference = context.getImageData(0, 0, copy.width, copy.height).data;
                        render.renderer.extensions.has = function (name) { return name === 'WEBGL_multi_draw' ? false : has.call(this, name); };
                        render.render(); context.drawImage(canvas, 0, 0);
                        const candidate = context.getImageData(0, 0, copy.width, copy.height).data;
                        let changedRGB = 0;
                        for (let i = 0; i < reference.length; i++) if (i % 4 !== 3) changedRGB += reference[i] !== candidate[i] ? 1 : 0;
                        fallback = { changedRGB, groups: multi.entries.size, originalsRestored: models.every(root => root.visible) && !owner.hidden.length && !multi.hidden.length };
                    } finally {
                        if (descriptor) Object.defineProperty(render.renderer.extensions, 'has', descriptor); else delete render.renderer.extensions.has;
                        if (now) Object.defineProperty(performance, 'now', now); else delete performance.now;
                    }
                    render.render();
                }
                for (const mesh of models) { mesh.removeFromParent(); pooled.add(mesh); MeshFactory.releaseMesh('Skeleton', mesh); }
                models = []; render.render();
                rows.push({ phase: 'retired', cycle, roots: owner.roots.size, groups: multi.entries.size, memory: memory() });
            }
        } finally {
            for (const mesh of models) { mesh.removeFromParent(); MeshFactory.releaseMesh('Skeleton', mesh); }
            floor.removeFromParent(); render.disposeObjectResources(floor); render.dispose();
        }
        return { rows, fallback, disposed: multi.disposed && multi.entries.size === 0 && multi.group.parent === null && owner.roots.size === 0 };
    }, quality);
    await writeFile(testInfo.outputPath('default-actor-cell-lifecycle.json'), JSON.stringify(result, null, 2));
    expect(result.fallback.changedRGB).toBe(0); expect(result.fallback.groups).toBe(0); expect(result.fallback.originalsRestored).toBe(true);
    const retired = result.rows.filter(row => row.phase === 'retired');
    expect(retired).toHaveLength(3);
    for (const row of retired) { expect(row.roots).toBe(0); expect(row.groups).toBe(0); expect(row.memory).toEqual(retired[0].memory); }
    for (const row of result.rows.filter(row => row.phase === 'populated')) {
        expect(row.roots).toBe(6); expect(row.groups).toBeGreaterThan(0); expect(row.restored).toBe(true);
    }
    expect(result.rows.filter(row => row.phase === 'pooled-root-return')).toHaveLength(12);
    expect(result.disposed).toBe(true); expect(failures, failures.join('\n')).toEqual([]);
});
