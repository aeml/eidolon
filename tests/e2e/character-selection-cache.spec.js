import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

test('selected and all retained characters coexist in the production cache and render offline', async ({ page, context, baseURL }, testInfo) => {
    test.skip(!new URL(baseURL).hostname.match(/^(localhost|127\.0\.0\.1)$/), 'Local asset selection qualification');
    const selection = JSON.parse(await readFile('assets/archetypes/runtime-selection.json', 'utf8'));
    const failures = collectBrowserFailures(page, baseURL);
    await page.goto('/tests/e2e/fixtures/asset-cache-probe.html');
    await page.evaluate(async () => {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(`${baseURL}/sw.js`);
    const cold = await page.evaluate(async selection => {
        const THREE = await import('three');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { createAuthoredFighterInstance, fighterRuntimePath } = await import('/src/art/AuthoredFighter.js');
        const { authoredCharacterPath } = await import('/src/art/AuthoredCharacters.js');
        const { AUTHORED_ASSETS } = await import('/src/assets/authoredEquipment.generated.js');
        const { resolveAssetPath } = await import('/src/assets/assetManifest.js');
        const urls = new Map();
        for (const [name, row] of Object.entries(selection.characters)) for (const quality of ['high', 'low']) {
            const variant = row.variants[quality], path = authoredCharacterPath(name, quality);
            if (path !== `./${variant.file}` || (name === 'Fighter' && fighterRuntimePath(quality) !== path)) throw new Error('Selected loader path mismatch');
            if (AUTHORED_ASSETS.previousCharacters[name][quality] !== `./${variant.baselineFile}`) throw new Error('Previous path mismatch');
            const retained = row.previousVariants?.[quality] || [];
            if (JSON.stringify(AUTHORED_ASSETS.retainedCharacters[name][quality]) !== JSON.stringify(retained.map(v => `./${v.file}`))) throw new Error('Retained path mismatch');
            for (const [file, hash] of [[variant.file, variant.sha256], [variant.baselineFile, variant.baselineSHA256],
                ...retained.map(v => [v.file, v.sha256])]) {
                const url = new URL(resolveAssetPath(`./${file}`), document.baseURI).href;
                if (new URL(url).searchParams.get('v') !== hash.slice(0, 16)) throw new Error('Asset version mismatch');
                urls.set(url, hash);
            }
        }
        const digest = async response => {
            if (!response.ok) throw new Error(`Asset HTTP ${response.status}`);
            return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await response.arrayBuffer()))]
                .map(byte => byte.toString(16).padStart(2, '0')).join('');
        };
        const hashes = async () => {
            const result = [];
            for (const [url, expected] of urls) {
                const sha256 = await digest(await fetch(url));
                if (sha256 !== expected) throw new Error('Served character hash mismatch');
                result.push({ url, sha256 });
            }
            return result;
        };
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(390, 844); document.body.appendChild(renderer.domElement);
        const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        const gpu = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xffffff, 0x303030, 3));
        const camera = new THREE.PerspectiveCamera(45, 390 / 844, .1, 30);
        camera.position.set(0, 2.3, 8); camera.lookAt(0, 2.3, 0);
        const render = async () => {
            const rows = [];
            // Force fresh GLTF parsing on the warm/offline pass, rather than
            // passing because MeshFactory still holds the cold scene objects.
            MeshFactory.cache = {}; MeshFactory.inflight = {};
            for (const name of Object.keys(selection.characters)) for (const quality of ['high', 'low']) {
                const variant = selection.characters[name].variants[quality];
                const files = [...new Set([variant.file, variant.baselineFile,
                    ...(selection.characters[name].previousVariants?.[quality] || []).map(v => v.file)])];
                for (const file of files) {
                    const path = `./${file}`, source = await MeshFactory.loadModel(path);
                    const actor = createAuthoredFighterInstance(source, { actorClass: name, quality, equipmentLoader: path => MeshFactory.loadModel(path) });
                    const mixer = new THREE.AnimationMixer(actor);
                    mixer.clipAction(actor.userData.animations.find(clip => clip.name === 'Idle')).play();
                    mixer.update(.25); scene.add(actor); actor.updateMatrixWorld(true); renderer.render(scene, camera);
                    let skins = 0; actor.traverse(part => { if (part.isSkinnedMesh) skins++; });
                    rows.push({ name, quality, path, authoredClass: actor.userData.authoredClass,
                        fallback: Boolean(actor.userData.assetFallback), skins, drawCalls: renderer.info.render.calls,
                        triangles: renderer.info.render.triangles, glError: gl.getError() });
                    scene.remove(actor); mixer.stopAllAction(); mixer.uncacheRoot(actor); actor.userData.disposeInstance();
                }
            }
            return rows;
        };
        window.__characterCache = { hashes, render, urls: [...urls.keys()], digest, renderer };
        return { hashes: await hashes(), renders: await render(), gpu };
    }, selection);
    expect(cold.hashes).toHaveLength(16);
    expect(cold.renders).toHaveLength(16);
    expect(cold.gpu).not.toMatch(/swiftshader|llvmpipe|software/i);
    // The worker writes asynchronously with waitUntil; require every exact
    // versioned request to exist before testing offline consumption.
    await expect.poll(() => page.evaluate(async () => {
        const cache = await caches.open('eidolon-assets-2026-09-04-11');
        return (await Promise.all(window.__characterCache.urls.map(url => cache.match(url)))).filter(Boolean).length;
    })).toBe(16);
    const cached = await page.evaluate(async () => {
        const cache = await caches.open('eidolon-assets-2026-09-04-11'), rows = [];
        for (const url of window.__characterCache.urls) rows.push({ url, sha256: await window.__characterCache.digest(await cache.match(url)) });
        return rows;
    });
    expect(cached).toEqual(cold.hashes);
    await context.setOffline(true);
    let offline;
    try {
        offline = await page.evaluate(async () => ({ hashes: await window.__characterCache.hashes(), renders: await window.__characterCache.render() }));
    } finally { await context.setOffline(false); }
    expect(offline.hashes).toEqual(cold.hashes);
    expect(offline.renders).toEqual(cold.renders);
    for (const row of cold.renders) {
        expect(row.authoredClass).toBe(row.name); expect(row.fallback).toBe(false);
        expect(row.skins).toBeGreaterThan(0); expect(row.drawCalls).toBeGreaterThan(0);
        expect(row.triangles).toBeGreaterThan(0); expect(row.glError).toBe(0);
    }
    await page.evaluate(() => window.__characterCache.renderer.dispose());
    await writeFile(testInfo.outputPath('character-selection-cache.json'), JSON.stringify({ cold, cached, offline }, null, 2));
    expect(failures, failures.join('\n')).toEqual([]);
});
