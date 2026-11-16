import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

// Untimed same-scene control; keep it after the ordinary frame sample.
export async function compareSingletonScene(page, testInfo, label) {
    const proof = await page.evaluate(() => {
        const render = window.game.renderSystem, owner = render.actorInstances;
        const selected = owner.batchSingletons, canvas = render.renderer.domElement;
        const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const descriptor = Object.getOwnPropertyDescriptor(performance, 'now'), frozen = performance.now();
        const visibility = new Map(); render.scene.traverse(part => visibility.set(part, part.visible));
        const capture = value => {
            owner.batchSingletons = value; render.render(); context.drawImage(canvas, 0, 0);
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                image: copy.toDataURL('image/png').split(',')[1],
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        };
        let proof;
        try {
            Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            capture(false); capture(selected); capture(false);
            const reference = capture(false), candidate = capture(selected), again = capture(false);
            let error = 0, changed = 0, exactChanges = 0, unstable = 0;
            for (let i = 0; i < reference.pixels.length; i += 4) {
                const delta = Math.max(...[0, 1, 2].map(c => Math.abs(reference.pixels[i + c] - candidate.pixels[i + c])));
                error += delta; changed += delta > 8 ? 1 : 0; exactChanges += delta > 0 ? 1 : 0;
                unstable += [0, 1, 2].some(c => reference.pixels[i + c] !== again.pixels[i + c]) ? 1 : 0;
            }
            proof = { quality: render.graphicsQuality, selected,
                reference: { calls: reference.calls, triangles: reference.triangles },
                candidate: { calls: candidate.calls, triangles: candidate.triangles },
                meanError: error / (copy.width * copy.height), changed: changed / (copy.width * copy.height), exactChanges, unstable,
                images: { reference: reference.image, candidate: candidate.image } };
        } finally {
            owner.batchSingletons = selected;
            if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now;
        }
        render.render();
        proof.restored = !owner.hidden.length && !owner.multiDraw.hidden.length &&
            [...visibility].every(([part, visible]) => !part.parent || part.visible === visible);
        proof.scope = 'Same synchronous frozen actual gameplay view, existing owner disabled versus automatic quality selection versus disabled again. No actor, camera, material, geometry or authoritative state changes. GPU caches may warm; outside ordinary frame timing. This controls submissions and visual error, not FPS or total resource use.';
        return proof;
    });
    for (const [name, data] of Object.entries(proof.images))
        await writeFile(testInfo.outputPath(`${label}-singleton-${name}.png`), Buffer.from(data, 'base64'));
    delete proof.images;
    await writeFile(testInfo.outputPath(`${label}-singleton-comparison.json`), JSON.stringify(proof, null, 2));
    expect(proof.selected).toBe(proof.quality === 'high');
    expect(proof.meanError).toBeLessThan(.1); expect(proof.changed).toBeLessThan(.001);
    expect(proof.unstable).toBe(0); expect(proof.restored).toBe(true);
    expect(proof.candidate.calls).toBeLessThanOrEqual(proof.reference.calls);
    if (proof.quality === 'low') { expect(proof.exactChanges).toBe(0); expect(proof.candidate).toEqual(proof.reference); }
    if (proof.quality === 'high' && label === 'town-start') expect(proof.candidate.calls).toBeLessThan(proof.reference.calls);
}
