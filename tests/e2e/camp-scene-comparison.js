import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

export async function compareCampScene(page, testInfo) {
    const proof = await page.evaluate(async () => {
        const { createLanternholdCampPlacements, createProceduralLanternholdCampField } = await import('/src/art/ProceduralLanternholdArchitecture.js');
        const render = window.game.renderSystem;
        const selected = render.instanceEnvironmentGroup.getObjectByName('Lanternhold:Pilgrim Vigil Field');
        if (!selected || selected.userData.instanceCount !== 15 || !selected.children.every(mesh => mesh.isBatchedMesh))
            throw Error('Normal startup must automatically select all nine native camp buckets');
        const original = createProceduralLanternholdCampField(createLanternholdCampPlacements(0, 200));
        original.position.copy(selected.position); original.quaternion.copy(selected.quaternion); original.scale.copy(selected.scale);
        for (let i = 0; i < original.children.length; i++) {
            const source = original.children[i], live = selected.children[i];
            source.material = live.material; source.castShadow = live.castShadow; source.receiveShadow = live.receiveShadow;
            source.layers.mask = live.layers.mask; source.renderOrder = live.renderOrder;
            source.position.copy(live.position); source.quaternion.copy(live.quaternion); source.scale.copy(live.scale);
        }
        const parent = selected.parent, visible = selected.visible, descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
        const frozen = performance.now(), canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const capture = candidate => {
            selected.visible = candidate; original.visible = !candidate; render.render(); context.drawImage(canvas, 0, 0);
            return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                pixels: context.getImageData(0, 0, copy.width, copy.height).data };
        };
        let proof;
        try {
            parent.add(original); Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            capture(false); capture(true); capture(false);
            const reference = capture(false), candidate = capture(true), again = capture(false);
            let changedRGB = 0, unstableRGB = 0;
            for (let i = 0; i < reference.pixels.length; i += 4) for (let c = 0; c < 3; c++) {
                changedRGB += reference.pixels[i + c] !== candidate.pixels[i + c] ? 1 : 0;
                unstableRGB += reference.pixels[i + c] !== again.pixels[i + c] ? 1 : 0;
            }
            proof = { quality: render.graphicsQuality, automaticNativeSelection: true, camps: 15, buckets: 9,
                fullOriginalTriangleInventory: original.children.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count / 3 * mesh.count, 0),
                reference: { calls: reference.calls, triangles: reference.triangles },
                candidate: { calls: candidate.calls, triangles: candidate.triangles }, changedRGB, unstableRGB };
        } finally {
            selected.visible = visible; original.removeFromParent(); original.children.forEach(mesh => mesh.dispose());
            if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now;
        }
        proof.restored = selected.visible === visible && selected.parent === parent && original.parent === null;
        proof.scope = 'Synchronous frozen actual town scene after fixed60warmup+180startup frames. All15original camps/nine material buckets, source geometry, deterministic transforms and live shadow/material settings; ordinary default selected automatically by real renderer capability. Original instancing/selected/reference again. Source reference can warm additional borrowed GPU caches; not a timing or zero-VRAM claim. Original uninstrumented route/party gates remain authoritative.';
        return proof;
    });
    await writeFile(testInfo.outputPath('camp-scene-comparison.json'), JSON.stringify(proof, null, 2));
    expect(proof.fullOriginalTriangleInventory).toBe(19740);
    expect(proof.changedRGB).toBe(0); expect(proof.unstableRGB).toBe(0); expect(proof.restored).toBe(true);
    expect(proof.candidate.calls).toBeLessThan(proof.reference.calls);
    expect(proof.candidate.triangles).toBeLessThan(proof.reference.triangles);
}
