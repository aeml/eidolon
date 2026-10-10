import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

export async function prepareFittedRigidParty(page, testInfo) {
    const installed = await page.evaluate(async () => {
        const THREE = await import('three');
        const { batchFittedRigidSurfaces } = await import('/src/art/FittedRigidSurfaceBatches.js');
        const game = window.game, owner = game.renderSystem.actorGameplayGeometry;
        const actors = [game.player, ...game.remotePlayers.values()].filter(actor => actor.mesh?.userData.authoredClass);
        if (actors.length !== 4 || !owner) throw Error('Four supplied equipped roots and their actual geometry owner required');
        const pairs = []; let saved = 0;
        for (const actor of actors) {
            if (actor.mesh.userData.equipmentVisualItemCount !== 14) throw Error('Complete fitted outfit required');
            const mounts = []; actor.mesh.traverse(node => {
                if (node.userData.authoredEquipment && ['mainHand', 'offHand'].includes(node.userData.slot)) mounts.push(node);
            });
            for (const mount of mounts) {
                const animatedTargets = new Set((actor.mesh.userData.animations || []).flatMap(clip =>
                    clip.tracks.map(track => THREE.PropertyBinding.parseTrackName(track.name).nodeName)));
                saved += batchFittedRigidSurfaces(mount, { animatedTargets });
                mount.traverse(mesh => {
                    if (!mesh.name.startsWith('FittedRigidBatch_')) return;
                    const sources = mesh.userData.fittedBatchSources.map(name => mesh.parent.children.find(child => child.name === name));
                    if (sources.some(source => !source)) throw Error('Missing preserved rigid source');
                    pairs.push({ mesh, sources });
                });
            }
            actor.mesh.dispatchEvent({ type: 'equipmentvisualschanged' });
        }
        window.__fittedRigidParty = { pairs, owner };
        return { saved, batches: pairs.length, actorClasses: actors.map(actor => actor.mesh.userData.authoredClass) };
    });
    await expect.poll(() => page.evaluate(() => window.__fittedRigidParty.owner.delivery.jobs.size), { timeout: 30_000 }).toBe(0);
    const proof = await page.evaluate(() => {
        const game = window.game, render = game.renderSystem;
        const { pairs, owner } = window.__fittedRigidParty;
        if (owner.delivery.stats.failed) throw Error('Real geometry worker failed');
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const originalNow = Object.getOwnPropertyDescriptor(performance, 'now'), frozen = performance.now();
        const capture = enabled => {
            for (const { mesh, sources } of pairs) { mesh.visible = enabled; for (const source of sources) source.visible = !enabled; }
            render.render(); context.drawImage(canvas, 0, 0);
            return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                pixels: context.getImageData(0, 0, copy.width, copy.height).data };
        };
        try {
            Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            capture(false); capture(true); capture(false);
            const reference = capture(false), candidate = capture(true), again = capture(false);
            let changedRGB = 0, unstableRGB = 0;
            for (let i = 0; i < reference.pixels.length; i++) if (i % 4 !== 3) {
                changedRGB += reference.pixels[i] !== candidate.pixels[i] ? 1 : 0;
                unstableRGB += reference.pixels[i] !== again.pixels[i] ? 1 : 0;
            }
            return { changedRGB, unstableRGB, reference: { calls: reference.calls, triangles: reference.triangles },
                candidate: { calls: candidate.calls, triangles: candidate.triangles },
                restored: !owner.pass.active.length && [...owner.pass.entries.values()].every(entry => entry.mesh.geometry === entry.source),
                scope: 'Same frozen actual connected full scene; only exact sibling rigid gear submission changes. Original per-primitive worker derivatives remain registered; merged derivatives preserve those triangle rows. Leaves candidate for subsequent normal180frame profile; diagnostic opt-in only.' };
        } finally {
            for (const { mesh, sources } of pairs) { mesh.visible = true; for (const source of sources) source.visible = false; }
            if (originalNow) Object.defineProperty(performance, 'now', originalNow); else delete performance.now;
        }
    });
    await writeFile(testInfo.outputPath('fitted-rigid-party.json'), JSON.stringify({ installed, ...proof }, null, 2));
    expect(proof.changedRGB).toBe(0); expect(proof.unstableRGB).toBe(0); expect(proof.restored).toBe(true);
    expect(proof.candidate.triangles).toBe(proof.reference.triangles);
    expect(proof.candidate.calls).toBeLessThan(proof.reference.calls);
}
