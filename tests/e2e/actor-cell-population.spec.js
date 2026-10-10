import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
for (const quality of ['high', 'low']) test(`${quality}: recorded three-cell actor population keeps exact original GPU delivery`, async ({ page, baseURL }, testInfo) => {
    const population = JSON.parse(await readFile(new URL('../fixtures/actor-cell-population.json', import.meta.url), 'utf8'));
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async ({ quality, population }) => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { ActorInstanceMultiDraw } = await import('/src/art/ActorInstanceMultiDraw.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        const basis = await MeshFactory.createMeshForType('Skeleton');
        const sources = population.rows.map(row => {
            const shape = basis.getObjectByName(row.name);
            if (!shape?.isMesh || (shape.geometry.index?.count ?? null) !== row.indices) throw Error(`Recorded source shape mismatch: ${row.name}`);
            const attributes = Object.entries(shape.geometry.attributes).map(([name, attr]) =>
                [name, attr.itemSize, attr.normalized, attr.array.constructor.name, attr.isInterleavedBufferAttribute === true]);
            if (JSON.stringify(attributes) !== JSON.stringify(row.attributes)) throw Error(`Recorded attribute layout mismatch: ${row.name}`);
            const source = new THREE.InstancedMesh(shape.geometry, shape.material, row.count);
            source.matrixAutoUpdate = false; source.matrix.fromArray(row.origin); source.matrixWorld.copy(source.matrix);
            source.instanceMatrix.array.set(row.matrices); source.instanceMatrix.needsUpdate = true; source.computeBoundingSphere();
            source.castShadow = row.castShadow; source.receiveShadow = row.receiveShadow;
            source.renderOrder = row.renderOrder; source.layers.mask = row.layers; source.name = row.name;
            render.scene.add(source); return source;
        });
        const owner = new ActorInstanceMultiDraw(render.scene), beforeHook = render.scene.onBeforeRender, afterHook = render.scene.onAfterRender;
        render.scene.onBeforeRender = function (...args) { beforeHook.apply(this, args); owner.beginFrame(args[0], args[2], sources); };
        render.scene.onAfterRender = function (...args) { owner.endFrame(); afterHook.apply(this, args); };
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: 0x4a4842, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; render.scene.add(floor);
        render.applyLightingPreset('town', true);
        const copy = document.createElement('canvas'), canvas = render.renderer.domElement;
        copy.width = canvas.width; copy.height = canvas.height; const context = copy.getContext('2d', { willReadFrequently: true });
        const capture = enabled => {
            owner.enabled = enabled;
            try { render.render(); context.drawImage(canvas, 0, 0); }
            finally { owner.endFrame(); }
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        };
        const reports = [];
        try {
            for (const [cellZ, zoom, far] of [[-128, 18, false], [-192, 18, false], [-256, 18, false], [-192, 26, false], [-192, 18, true]]) {
                const offset = far ? new THREE.Vector3(50000, 0, 20000) : new THREE.Vector3();
                sources.forEach((source, i) => { source.matrix.fromArray(population.rows[i].origin); source.matrix.elements[12] += offset.x; source.matrix.elements[14] += offset.z; });
                const target = offset.clone().add(new THREE.Vector3(-128, 0, cellZ));
                floor.position.copy(target); render.setZoom(zoom); render.setCameraTarget(target); render.updateEnvironmentLighting(target, 0);
                const frozen = performance.now(), descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
                let reference, candidate, again;
                try {
                    Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
                    capture(false); capture(true); capture(false);
                    reference = capture(false); candidate = capture(true); again = capture(false);
                } finally { if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now; }
                let changedRGB = 0, unstableRGB = 0;
                for (let i = 0; i < reference.pixels.length; i++) if (i % 4 !== 3) {
                    changedRGB += reference.pixels[i] !== candidate.pixels[i] ? 1 : 0;
                    unstableRGB += reference.pixels[i] !== again.pixels[i] ? 1 : 0;
                }
                const strip = ({ pixels: _pixels, ...counts }) => counts;
                reports.push({ cellZ, zoom, far, changedRGB, unstableRGB, reference: strip(reference), candidate: strip(candidate) });
            }
        } finally {
            owner.dispose(); render.scene.onBeforeRender = beforeHook; render.scene.onAfterRender = afterHook;
            sources.forEach(source => { source.removeFromParent(); source.dispose(); });
            MeshFactory.releaseMesh('Skeleton', basis); floor.removeFromParent(); render.disposeObjectResources(floor); render.dispose();
        }
        return reports;
    }, { quality, population });
    await writeFile(testInfo.outputPath('actor-cell-population.json'), JSON.stringify(result, null, 2));
    for (const row of result) {
        expect(row.changedRGB).toBe(0); expect(row.unstableRGB).toBe(0);
        expect(row.candidate.triangles).toBe(row.reference.triangles);
        if (quality === 'low' && row.cellZ === -128) {
            // This recorded cell has no actor in the Low camera and no shadow
            // pass. Keep that negative culling control exact; there is only
            // the two-triangle floor and no actor submission to consolidate.
            expect(row.reference.calls).toBe(1); expect(row.reference.triangles).toBe(2);
            expect(row.candidate.calls).toBe(1);
        } else expect(row.candidate.calls).toBeLessThan(row.reference.calls);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
