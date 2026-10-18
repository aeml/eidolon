import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { isMeshyFighterSelected, MESHY_FIGHTER_PATHS } from '../src/art/MeshyFighter.js';
import { resolveAssetPath } from '../src/assets/assetManifest.js';
import { jest } from '@jest/globals';
import { MeshFactory } from '../src/utils/MeshFactory.js';

test('experimental Fighter selection requires the explicit play link', () => {
    expect(isMeshyFighterSelected('?fighterModel=meshy')).toBe(true);
    for (const search of ['', '?fighterModel=standard', '?fighterModel=unknown', '?model=meshy']) expect(isMeshyFighterSelected(search)).toBe(false);
});

test('a failed optional pilot falls back without populating the experimental asset pool', async () => {
    const original = globalThis.location.href;
    window.history.replaceState({}, '', '?fighterModel=meshy');
    const load = jest.spyOn(MeshFactory, 'loadModelWithTimeout').mockRejectedValue(new Error('Unavailable pilot'));
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const pool = MeshFactory.pool; MeshFactory.pool = {};
    try {
        const fallback = await MeshFactory.createMeshForType('Fighter', { quality: 'high' });
        expect(load).toHaveBeenCalledWith(MESHY_FIGHTER_PATHS.high, 15000);
        expect(fallback.userData.assetFallback).toBe(true);
        MeshFactory.releaseMesh('Fighter', fallback);
        expect(MeshFactory.pool['Fighter:high:meshy']).toBeUndefined();
        expect(Object.values(MeshFactory.pool).flat()).toHaveLength(0);
    } finally {
        MeshFactory.pool = pool; load.mockRestore(); warning.mockRestore();
        window.history.replaceState({}, '', original);
    }
});

test.each(['high', 'low'])('delivered %s pilot has its complete rig, six motions, in-place hips and matching asset pin', quality => {
    const bytes = fs.readFileSync(MESHY_FIGHTER_PATHS[quality]);
    const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    const manifest = JSON.parse(fs.readFileSync('assets/archetypes/Fighter/meshy-pilot-manifest.json'));
    const hash = createHash('sha256').update(bytes).digest('hex');
    expect(hash).toBe(manifest.variants[quality].sha256);
    expect(resolveAssetPath(MESHY_FIGHTER_PATHS[quality])).toContain(hash.slice(0, 16));
    expect(bytes.length).toBeLessThan(quality === 'high' ? 3_200_000 : 1_600_000);
    expect(document.skins.map(skin => skin.joints.length)).toEqual([24]);
    expect(document.animations.map(clip => clip.name)).toEqual(['Idle', 'Walk', 'Run', 'Attack', 'HitReaction', 'Death']);
    expect(document.nodes.some(node => node.name === 'Fighter_Body')).toBe(true);
    const pelvis = document.nodes.findIndex(node => node.name === 'pelvis');
    const binary = 28 + bytes.readUInt32LE(12);
    for (const animation of document.animations) for (const channel of animation.channels) {
        if (channel.target.node !== pelvis || channel.target.path !== 'translation') continue;
        const accessor = document.accessors[animation.samplers[channel.sampler].output];
        const view = document.bufferViews[accessor.bufferView], stride = view.byteStride || 12;
        const start = binary + (view.byteOffset || 0) + (accessor.byteOffset || 0);
        for (let i = 0; i < accessor.count; i++) for (const component of [0, 2]) {
            expect(bytes.readFloatLE(start + i * stride + component * 4)).toBeCloseTo(document.nodes[pelvis].translation[component], 6);
        }
    }
    expect(document.images.every(image => image.bufferView !== undefined && !image.uri)).toBe(true);
});
