import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';
import { requiresHardwareWebGL } from './browserLaunchPolicy.js';

for (const quality of ['high', 'low']) test(`${quality}: additive status, cast and contact effects preserve their source surfaces in one pass`, async ({ page, baseURL }, testInfo) => {
    test.setTimeout(180000);
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const evidence = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { additiveEffectCorpus } = await import('/tests/additiveEffectCorpus.js');
        const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
        renderer.setSize(256, 256); renderer.setPixelRatio(1);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        const gpu = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        const scene = new THREE.Scene(); scene.background = new THREE.Color(0x17232c);
        const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 1000);
        const cases = additiveEffectCorpus(scene, quality), reports = [];
        for (const entry of cases) entry.root.visible = false;
        const capture = () => {
            renderer.render(scene, camera);
            const bytes = new Uint8Array(256 * 256 * 4); gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
            return { bytes, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
        };
        const compare = (a, b) => {
            let error = 0, changed = 0, maximum = 0;
            for (let index = 0; index < a.length; index += 4) {
                const delta = Math.abs(a[index] - b[index]) + Math.abs(a[index + 1] - b[index + 1]) + Math.abs(a[index + 2] - b[index + 2]);
                error += delta; changed += delta > 8 ? 1 : 0; maximum = Math.max(maximum, delta);
            }
            return { meanRGBError: error / (256 * 256), changedRatio: changed / (256 * 256), maximumRGBError: maximum };
        };
        try {
            for (const entry of cases) {
                entry.root.visible = true;
                for (const time of [.04, .08]) {
                    entry.advance(.04); entry.root.updateMatrixWorld(true);
                    const box = new THREE.Box3().setFromObject(entry.root), center = box.getCenter(new THREE.Vector3());
                    const span = Math.max(14, box.getSize(new THREE.Vector3()).length() * 1.25);
                    camera.left = camera.bottom = -span / 2; camera.right = camera.top = span / 2; camera.updateProjectionMatrix();
                    const materials = new Map(), meshes = [];
                    entry.root.traverseVisible(mesh => {
                        if (!mesh.isMesh) return;
                        meshes.push([mesh, mesh.geometry, mesh.matrixWorld.toArray()]);
                        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
                            if (material.forceSinglePass && material.blending === THREE.AdditiveBlending) materials.set(material, true);
                    });
                    for (const view of [[1, 1.4, 1], [1, .25, -1], [-1, -.6, 1]]) {
                        camera.position.copy(center).add(new THREE.Vector3(...view).normalize().multiplyScalar(span * 2));
                        camera.lookAt(center); camera.updateMatrixWorld(true);
                        let reference, candidate, referenceAgain;
                        try {
                            for (const material of materials.keys()) material.forceSinglePass = false;
                            reference = capture();
                            for (const material of materials.keys()) material.forceSinglePass = true;
                            candidate = capture();
                            for (const material of materials.keys()) material.forceSinglePass = false;
                            referenceAgain = capture();
                        } finally { for (const [material, value] of materials) material.forceSinglePass = value; }
                        reports.push({ kind: entry.kind, label: entry.label, quality, time, view,
                            materials: materials.size, meshes: meshes.length, beforeCalls: reference.calls, afterCalls: candidate.calls,
                            beforeTriangles: reference.triangles, afterTriangles: candidate.triangles,
                            candidate: compare(reference.bytes, candidate.bytes), referenceAgain: compare(reference.bytes, referenceAgain.bytes),
                            sourceIntact: meshes.every(([mesh, geometry, matrix]) => mesh.geometry === geometry &&
                                mesh.matrixWorld.elements.every((value, index) => value === matrix[index])) });
                    }
                }
                entry.root.visible = false;
            }
        } finally {
            for (const entry of cases) entry.dispose(); renderer.dispose(); renderer.forceContextLoss();
        }
        return { gpu, quality, cases: cases.length, reports,
            scope: 'Isolated actual factory corpus: all canonical ability layers, all status definitions and all feedback definitions at two early phases and three front/back oblique views. Exact same geometry, transforms and material properties except forceSinglePass. Technical surface/call-count comparison, not gameplay timing, final art or physical-device acceptance.' };
    }, quality);
    await writeFile(testInfo.outputPath('effect-policy-comparison.json'), JSON.stringify(evidence, null, 2));
    if (requiresHardwareWebGL()) expect(evidence.gpu).not.toMatch(/swiftshader|llvmpipe|software/i);
    expect(evidence.cases).toBeGreaterThan(52);
    for (const report of evidence.reports) {
        expect(report.materials, report.label).toBeGreaterThan(0);
        expect(report.afterCalls, report.label).toBeLessThan(report.beforeCalls);
        expect(report.sourceIntact, report.label).toBe(true);
        expect(report.candidate.meanRGBError, report.label).toBeLessThan(.1);
        expect(report.candidate.changedRatio, report.label).toBeLessThan(.001);
        expect(report.referenceAgain.maximumRGBError, report.label).toBe(0);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
