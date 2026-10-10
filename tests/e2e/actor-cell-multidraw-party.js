import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

export async function prepareActorCellMultiDrawParty(page, testInfo) {
    const proof = await page.evaluate(async () => {
        const { ActorInstanceMultiDraw } = await import('/src/art/ActorInstanceMultiDraw.js');
        const render = window.game.renderSystem, owner = render.actorInstances;
        if (!owner?.enabled || owner.multiDraw) throw Error('One existing actor instance owner required');
        owner.multiDraw = new ActorInstanceMultiDraw(owner.group);
        const frozen = performance.now(), descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const capture = enabled => {
            owner.multiDraw.enabled = enabled; render.render(); context.drawImage(canvas, 0, 0);
            return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                geometries: render.renderer.info.memory.geometries, textures: render.renderer.info.memory.textures,
                pixels: context.getImageData(0, 0, copy.width, copy.height).data };
        };
        try {
            Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            capture(false); capture(true); capture(false);
            const reference = capture(false), candidate = capture(true);
            const allocated = [...owner.multiDraw.entries.values()].reduce((total, { mesh }) => ({
                groups: total.groups + 1,
                geometryBytes: total.geometryBytes + Object.values(mesh.geometry.attributes).reduce((n, attr) => n + attr.array.byteLength, 0) + (mesh.geometry.index?.array.byteLength || 0),
                matrixTextureBytes: total.matrixTextureBytes + mesh._matricesTexture.image.data.byteLength,
                indirectTextureBytes: total.indirectTextureBytes + mesh._indirectTexture.image.data.byteLength
            }), { groups: 0, geometryBytes: 0, matrixTextureBytes: 0, indirectTextureBytes: 0 });
            const again = capture(false);
            let changedRGB = 0, unstableRGB = 0;
            for (let i = 0; i < reference.pixels.length; i++) if (i % 4 !== 3) {
                changedRGB += reference.pixels[i] !== candidate.pixels[i] ? 1 : 0;
                unstableRGB += reference.pixels[i] !== again.pixels[i] ? 1 : 0;
            }
            const strip = ({ pixels: _pixels, ...counts }) => counts;
            owner.multiDraw.enabled = true;
            return { reference: strip(reference), candidate: strip(candidate), referenceAgain: strip(again),
                changedRGB, unstableRGB, allocated,
                restored: !owner.hidden.length && !owner.multiDraw.hidden.length && !owner.group.visible && !owner.multiDraw.group.visible,
                scope: 'Same frozen actual four-class party; stock multi-draw on existing exact cell origins/materials/geometry/float32 matrices with original whole-bucket per-camera culling and color/shadow ordering. Candidate selected only for following private normal180frame profile. No production/default enablement or historical performance waiver.' };
        } finally {
            owner.multiDraw.enabled = true;
            if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now;
        }
    });
    await writeFile(testInfo.outputPath('actor-cell-multidraw-party.json'), JSON.stringify(proof, null, 2));
    expect(proof.changedRGB).toBe(0); expect(proof.unstableRGB).toBe(0); expect(proof.restored).toBe(true);
    expect(proof.candidate.calls).toBeLessThan(proof.reference.calls);
    expect(proof.candidate.triangles).toBe(proof.reference.triangles);
    expect(proof.referenceAgain.geometries).toBe(proof.reference.geometries);
    expect(proof.referenceAgain.textures).toBe(proof.reference.textures);
}
