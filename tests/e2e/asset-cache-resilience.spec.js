import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const mode of ['denied-open', 'failed-read', 'quota-and-network']) {
    test(`real low-detail Fighter renders despite ${mode}`, async ({ page, baseURL }) => {
        test.skip(!new URL(baseURL).hostname.match(/^(localhost|127\.0\.0\.1)$/), 'Fault fixture is local-only');
        const failures = collectBrowserFailures(page, baseURL);
        await page.goto('/tests/e2e/fixtures/asset-cache-probe.html');
        await page.evaluate(async mode => {
            await navigator.serviceWorker.register(`/tests/e2e/fixtures/asset-cache-probe-worker.js?mode=${mode}`);
            await navigator.serviceWorker.ready;
        }, mode);
        await page.reload();
        await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
        const evidence = await page.evaluate(async () => {
            const THREE = await import('three');
            const { MeshFactory } = await import('/src/utils/MeshFactory.js');
            const { createAuthoredFighterInstance, fighterRuntimePath } = await import('/src/art/AuthoredFighter.js');
            const source = await MeshFactory.loadModel(fighterRuntimePath('low'));
            const actor = createAuthoredFighterInstance(source, { quality: 'low' });
            let skins = 0;
            actor.traverse(part => { if (part.isSkinnedMesh) skins++; });
            const renderer = new THREE.WebGLRenderer();
            renderer.setSize(390, 844);
            document.body.appendChild(renderer.domElement);
            const scene = new THREE.Scene();
            scene.add(actor, new THREE.HemisphereLight(0xffffff, 0x303030, 3));
            const camera = new THREE.PerspectiveCamera(45, 390 / 844, .1, 30);
            camera.position.set(0, 2.3, 8); camera.lookAt(0, 2.3, 0);
            const mixer = new THREE.AnimationMixer(actor);
            mixer.clipAction(actor.userData.animations.find(clip => clip.name === 'Idle')).play();
            mixer.update(.25); renderer.render(scene, camera);
            const attempts = await new Promise(resolve => {
                const channel = new MessageChannel();
                channel.port1.onmessage = event => { channel.port1.close(); resolve(event.data); };
                navigator.serviceWorker.controller.postMessage('fixture-model-attempts', [channel.port2]);
            });
            const result = { authoredClass: actor.userData.authoredClass, quality: actor.userData.authoredQuality,
                fallback: Boolean(actor.userData.assetFallback), skins, attempts, drawCalls: renderer.info.render.calls };
            mixer.stopAllAction(); mixer.uncacheRoot(actor); actor.userData.disposeInstance(); renderer.dispose();
            return result;
        });
        expect(evidence).toMatchObject({ authoredClass: 'Fighter', quality: 'low', fallback: false, skins: 11,
            attempts: mode === 'quota-and-network' ? 2 : 1 });
        expect(evidence.drawCalls).toBeGreaterThan(0);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
