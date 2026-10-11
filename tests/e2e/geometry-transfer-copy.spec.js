import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('actual GLTFLoader character and fitted buffers retain exact worker payloads with bounded copy cost', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    // This probe decodes actual supplied assets without creating a renderer,
    // registering an account or competing for a gameplay WebGL context.
    await page.route('**/__geometry-copy-check__', route => route.fulfill({ contentType: 'text/html', body:
        '<script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script>' }));
    await page.goto('/__geometry-copy-check__');
    const report = await page.evaluate(async () => {
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        const { copyGameplayGeometry } = await import('/src/core/ActorGameplayGeometryDelivery.js');
        const { copyGameplayGeometry: copyReference } = await import('/tests/fixtures/geometry-copy-reference.js');
        const selection = await (await fetch('/assets/archetypes/runtime-selection.json')).json();
        const wearable = await (await fetch('/assets/equipment/runtime/manifest.json')).json();
        const referenceAttribute = attribute => {
            const array = new Float32Array(attribute.count * attribute.itemSize);
            for (let i = 0; i < array.length; i++) array[i] = attribute.getComponent(Math.floor(i / attribute.itemSize), i % attribute.itemSize);
            return { itemSize: attribute.itemSize, array };
        };
        const bytesEqual = (left, right) => left.byteLength === right.byteLength &&
            new Uint8Array(left.buffer, left.byteOffset, left.byteLength).every((value, i) => value === new Uint8Array(right.buffer, right.byteOffset, right.byteLength)[i]);
        const rows = [];
        for (const [actorClass, actor] of Object.entries(selection.characters)) for (const quality of ['high', 'low']) {
            const fit = wearable.sources.find(row => row.actorClass === actorClass && row.itemID === 'iron-helm' && row.tier === 'standard');
            if (!fit) throw new Error(`Missing actual fitted helmet: ${actorClass}`);
            for (const [kind, asset] of [['character', actor.variants[quality]], ['fitted', fit.variants[quality]]]) {
                const response = await fetch(`/${asset.file}`);
                if (!response.ok) throw new Error(`Asset load failed: ${asset.file}`);
                const bytes = await response.arrayBuffer();
                const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
                if (sha256 !== asset.sha256) throw new Error(`Asset hash mismatch: ${asset.file}`);
                const gltf = await new GLTFLoader().parseAsync(bytes, new URL('.', response.url).href);
                const geometries = new Set(), materials = new Set(), textures = new Set();
                const generations = [], counts = { packedFloat: 0, interleavedFloat: 0, other: 0, integer: 0, skipped: 0 };
                try {
                    gltf.scene.traverse(mesh => {
                        if (!mesh.isMesh) return;
                        geometries.add(mesh.geometry);
                        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
                        const generation = { source: mesh.geometry, mesh, kind: 'color' };
                        const actual = copyGameplayGeometry(generation, 16 * 1024 * 1024);
                        if (!actual) { counts.skipped++; return; }
                        const reference = copyReference(generation, 16 * 1024 * 1024), expected = reference.source;
                        if (actual.kind !== reference.kind || actual.bytes !== reference.bytes || actual.transfers.length !== reference.transfers.length) throw new Error('Worker payload layout mismatch');
                        if (!bytesEqual(actual.source.index, expected.index)) throw new Error('Index copy mismatch');
                        const attributes = [...Object.entries(mesh.geometry.attributes), ...Object.values(mesh.geometry.morphAttributes).flat().map((attribute, i) => [`morph:${i}`, attribute])];
                        for (const [name, attribute] of attributes) {
                            const decoded = referenceAttribute(attribute);
                            const copied = name.startsWith('morph:') ? null : actual.source.attributes[name];
                            if (copied && (copied.itemSize !== decoded.itemSize || !bytesEqual(copied.array, decoded.array))) throw new Error(`Attribute copy mismatch: ${name}`);
                            if (actual.transfers.includes(attribute.array.buffer)) throw new Error('Source buffer transferred');
                            if (attribute.array instanceof Float32Array && !attribute.normalized) counts[attribute.isInterleavedBufferAttribute ? 'interleavedFloat' : 'packedFloat']++;
                            else {
                                counts.other++;
                                if (!attribute.normalized && (attribute.array instanceof Uint8Array || attribute.array instanceof Uint16Array)) counts.integer++;
                            }
                        }
                        for (const [index, target] of (expected.morphTargets || []).entries()) for (const name of ['position', 'normal']) {
                            if (!bytesEqual(actual.source.morphTargets[index][name].array, target[name].array)) throw new Error('Morph copy mismatch');
                        }
                        const transferred = structuredClone(actual.source, { transfer: actual.transfers });
                        if (!transferred.index.length || !mesh.geometry.index.array.length || !Object.values(mesh.geometry.attributes).every(attribute => attribute.array.length)) throw new Error('Copy transfer damaged source');
                        generations.push(generation);
                    });
                    if (!generations.length) throw new Error(`No worker-eligible actual meshes: ${asset.file}`);
                    const run = candidate => {
                        let copied = 0;
                        for (const generation of generations) copied += (candidate ? copyGameplayGeometry : copyReference)(generation, 16 * 1024 * 1024).bytes;
                        return copied;
                    };
                    for (let i = 0; i < 4; i++) { run(false); run(true); }
                    const blocks = [];
                    for (const variant of ['reference', 'candidate', 'candidate', 'reference']) {
                        const samples = [];
                        for (let i = 0; i < 12; i++) { const started = performance.now(); run(variant === 'candidate'); samples.push(performance.now() - started); }
                        const ordered = [...samples].sort((a, b) => a - b);
                        blocks.push({ variant, samples, medianMs: ordered[Math.floor(ordered.length / 2)], p95Ms: ordered[Math.floor(ordered.length * .95)] });
                    }
                    rows.push({ actorClass, quality, kind, file: asset.file, bytes: bytes.byteLength, sha256, meshes: generations.length, counts, exact: true, sourceBuffersRetainedAfterTransfer: true, blocks });
                } finally {
                    for (const geometry of geometries) geometry.dispose();
                    for (const material of materials) { for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); material.dispose(); }
                    for (const texture of textures) { texture.image?.close?.(); texture.dispose(); }
                }
            }
        }
        return { scope: 'Actual GLTFLoader inputs, exact worker copies and transfer ownership, synchronous ABBA copy-only timings. No render/frame-rate/device acceptance.', rows };
    });
    await writeFile(testInfo.outputPath('geometry-transfer-copy.json'), JSON.stringify(report, null, 2));
    expect(report.rows).toHaveLength(16);
    expect(report.rows.every(row => row.exact && row.sourceBuffersRetainedAfterTransfer && row.meshes > 0)).toBe(true);
    expect(report.rows.reduce((sum, row) => sum + row.counts.interleavedFloat, 0)).toBeGreaterThan(0);
    expect(report.rows.reduce((sum, row) => sum + row.counts.packedFloat, 0)).toBeGreaterThan(0);
    expect(report.rows.reduce((sum, row) => sum + row.counts.integer, 0)).toBeGreaterThan(0);
    expect(failures, failures.join('\n')).toEqual([]);
});
