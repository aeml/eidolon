import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

export async function compareSavedCharacterAdditiveEffects(page, testInfo) {
    await expect.poll(() => page.evaluate(() => window.game.player.mesh?.userData.equipmentVisualItemCount)).toBe(14);
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.slice(0, 4))).toEqual(['Charge', 'Whirlwind', 'Shield Slam', 'Iron Fortress']);
    await page.keyboard.press('4');
    await expect.poll(() => page.evaluate(() => window.game.player.ironFortressTimer)).toBeGreaterThan(0);
    const evidence = await page.evaluate(async () => {
        const THREE = await import('three');
        const game = window.game, render = game.renderSystem, renderer = render.renderer;
        const size = renderer.getDrawingBufferSize(new THREE.Vector2());
        const target = new THREE.WebGLRenderTarget(size.x, size.y);
        const priorTarget = renderer.getRenderTarget(), priorReset = renderer.info.autoReset;
        const materials = new Map();
        render.effectGroup.traverseVisible(mesh => {
            if (!mesh.isMesh) return;
            for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
                if (material.forceSinglePass && material.blending === THREE.AdditiveBlending && !material.wireframe)
                    materials.set(material, material.forceSinglePass);
            }
        });
        const capture = single => {
            for (const material of materials.keys()) material.forceSinglePass = single;
            renderer.setRenderTarget(target);
            renderer.info.autoReset = false; renderer.info.reset();
            try { renderer.render(render.scene, render.camera); }
            finally { render.actorInstances?.endFrame(); render.foliageShadowInfluence?.endFrame(); }
            const pixels = new Uint8Array(size.x * size.y * 4);
            renderer.readRenderTargetPixels(target, 0, 0, size.x, size.y, pixels);
            return { pixels, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
        };
        const compare = (a, b) => {
            let error = 0, changed = 0, maximum = 0;
            for (let index = 0; index < a.length; index += 4) {
                const delta = Math.abs(a[index] - b[index]) + Math.abs(a[index + 1] - b[index + 1]) + Math.abs(a[index + 2] - b[index + 2]);
                error += delta; changed += delta > 8 ? 1 : 0; maximum = Math.max(maximum, delta);
            }
            return { meanRGBError: error / (size.x * size.y), changedRatio: changed / (size.x * size.y), maximumRGBError: maximum };
        };
        try {
            const reference = capture(false), candidate = capture(true), referenceAgain = capture(false);
            return { materials: materials.size, width: size.x, height: size.y,
                reference: { calls: reference.calls, triangles: reference.triangles },
                candidate: { calls: candidate.calls, triangles: candidate.triangles, ...compare(reference.pixels, candidate.pixels) },
                referenceAgain: compare(reference.pixels, referenceAgain.pixels),
                quality: render.graphicsQuality, hp: game.player.stats.hp,
                equippedItems: game.player.mesh.userData.equipmentVisualItemCount, activeSeconds: game.player.ironFortressTimer,
                scope: 'Saved equipped Fighter; normal hotbar input and server-replicated Iron Fortress. Same actual world/camera/effects, synchronous reference/candidate/reference-again source renders to an owned target; no simulation advancement between captures. Source surface/call comparison excludes postprocessing and is not a timing or device certificate.' };
        } finally {
            for (const [material, value] of materials) material.forceSinglePass = value;
            renderer.setRenderTarget(priorTarget); renderer.info.autoReset = priorReset; target.dispose();
        }
    });
    await writeFile(testInfo.outputPath('saved-additive-effect-comparison.json'), JSON.stringify(evidence, null, 2));
    expect(evidence.materials).toBeGreaterThan(0);
    expect(evidence.activeSeconds).toBeGreaterThan(0); expect(evidence.hp).toBeGreaterThan(0);
    expect(evidence.equippedItems).toBe(14);
    expect(evidence.candidate.calls).toBeLessThan(evidence.reference.calls);
    expect(evidence.candidate.meanRGBError).toBeLessThan(.1);
    expect(evidence.candidate.changedRatio).toBeLessThan(.001);
    expect(evidence.referenceAgain.maximumRGBError).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('saved-additive-effect-hud.png') });
}
