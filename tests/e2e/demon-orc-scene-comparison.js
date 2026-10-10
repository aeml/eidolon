import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

export async function compareDemonOrcScene(page, testInfo) {
    const proof = await page.evaluate(async () => {
        const { createProceduralDemonOrc } = await import('/src/art/ProceduralLegacyEnemies.js');
        const render = window.game.renderSystem, roots = [];
        render.scene.traverseVisible(root => {
            if (root.userData.proceduralActorType === 'DemonOrc') roots.push(root);
        });
        if (!roots.length) throw Error('Actual woodland view must contain DemonOrc roots');
        const pairs = roots.map(root => {
            const source = createProceduralDemonOrc();
            source.traverse(part => {
                if (!part.isGroup) return;
                const current = root.getObjectByName(part.name);
                if (!current?.isGroup) throw Error(`Missing unchanged DemonOrc pivot ${part.name}`);
                part.position.copy(current.position); part.quaternion.copy(current.quaternion); part.scale.copy(current.scale);
                part.matrix.copy(current.matrix); part.matrixAutoUpdate = current.matrixAutoUpdate; part.visible = current.visible;
            });
            const visible = root.visible; source.visible = false; root.parent.add(source);
            return { root, source, visible };
        });
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const frozen = performance.now(), descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
        const capture = candidate => {
            for (const { root, source, visible } of pairs) { root.visible = candidate && visible; source.visible = !candidate && visible; }
            render.render(); context.drawImage(canvas, 0, 0);
            return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                pixels: context.getImageData(0, 0, copy.width, copy.height).data };
        };
        let proof;
        try {
            Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            capture(false); capture(true); capture(false);
            const original = capture(false), candidate = capture(true), again = capture(false);
            let error = 0, changed = 0, unstable = 0, exactChanges = 0;
            for (let i = 0; i < original.pixels.length; i += 4) {
                const delta = Math.max(...[0, 1, 2].map(c => Math.abs(original.pixels[i + c] - candidate.pixels[i + c])));
                error += delta; changed += delta > 8 ? 1 : 0; exactChanges += delta > 0 ? 1 : 0;
                unstable += [0, 1, 2].some(c => original.pixels[i + c] !== again.pixels[i + c]) ? 1 : 0;
            }
            proof = { roots: roots.length, original: { calls: original.calls, triangles: original.triangles },
                candidate: { calls: candidate.calls, triangles: candidate.triangles },
                meanError: error / (copy.width * copy.height), changed: changed / (copy.width * copy.height), exactChanges, unstable };
        } finally {
            for (const { root, source, visible } of pairs) { root.visible = visible; source.removeFromParent(); }
            if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now;
        }
        render.render();
        proof.restored = pairs.every(({ root, source, visible }) => root.visible === visible && !source.parent) &&
            !render.actorInstances.hidden.length && !render.actorInstances.multiDraw.hidden.length;
        proof.scope = 'Same synchronous frozen actual woodland view. Original raw constructors temporarily reproduce every live root and named animation-pivot transform; originals/packed/default delivery/originals again. No camera, authority, animation clock, material or geometry mutation. Temporary source roots removed and original visibility restored. Existing rigid-surface tolerance, not exact pixels. Untimed diagnostic; original raw geometry may warm additional borrowed GPU caches. Separate route profiles carry unchanged budgets.';
        return proof;
    });
    await writeFile(testInfo.outputPath('demon-orc-scene-comparison.json'), JSON.stringify(proof, null, 2));
    expect(proof.meanError).toBeLessThan(.1); expect(proof.changed).toBeLessThan(.001);
    expect(proof.unstable).toBe(0); expect(proof.restored).toBe(true);
    expect(proof.candidate.calls).toBeLessThan(proof.original.calls);
    expect(proof.candidate.triangles).toBeLessThanOrEqual(proof.original.triangles);
}
