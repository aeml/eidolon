import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createAuthoredIlyraInstance, ILYRA_MODEL_PATH } from '../src/art/AuthoredIlyra.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';
import { QuestNPC } from '../src/entities/QuestNPC.js';
import { Actor } from '../src/entities/Actor.js';
import { getAssetVersion } from '../src/assets/assetManifest.js';

function fixture() {
    const scene = new THREE.Group();
    const bones = Array.from({ length: 53 }, (_, i) => Object.assign(new THREE.Bone(), { name: `IlyraBone${i}` }));
    bones.slice(1).forEach(bone => bones[0].add(bone)); scene.add(bones[0]);
    const geometry = new THREE.BoxGeometry(1, 2, 1), count = geometry.attributes.position.count;
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
    const weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) weights[i * 4] = 1;
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    for (const name of ['Ilyra_FourfoldCostume', 'Ilyra_HeadAndHands']) {
        const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
        mesh.name = name; scene.add(mesh); mesh.bind(new THREE.Skeleton(bones));
    }
    return { scene, animations: [new THREE.AnimationClip('Idle', 1, [])] };
}

test('Ilyra GLB is a complete embedded NPC asset with its own content cache key', () => {
    const bytes = fs.readFileSync(ILYRA_MODEL_PATH);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    expect(bytes.length).toBeLessThan(1_600_000);
    expect(getAssetVersion(ILYRA_MODEL_PATH)).toBe(createHash('sha256').update(bytes).digest('hex').slice(0, 16));
    expect(json.skins.map(skin => skin.joints.length)).toEqual([53]);
    expect(json.animations.map(clip => clip.name)).toEqual(['Idle']);
    expect(json.meshes).toHaveLength(11);
    expect(json.meshes.reduce((sum, mesh) => sum + mesh.primitives.length, 0)).toBe(20);
    expect(json.nodes.some(node => node.name === 'Ilyra_FourfoldCostume')).toBe(true);
    expect(json.nodes.some(node => /Undershorts|Cube|Legendary/i.test(node.name))).toBe(false);
    expect([...(json.buffers || []), ...(json.images || [])].some(value => value.uri)).toBe(false);
});

test('instances keep independent bones and clips while sharing immutable costume resources', () => {
    const source = fixture(), a = createAuthoredIlyraInstance(source), b = createAuthoredIlyraInstance(source);
    const first = a.getObjectByName('Ilyra_FourfoldCostume'), second = b.getObjectByName('Ilyra_FourfoldCostume');
    expect(first.skeleton.bones[0]).not.toBe(second.skeleton.bones[0]);
    expect(first.geometry).toBe(second.geometry);
    expect(first.material).toBe(second.material);
    expect(a.userData.animations[0]).not.toBe(b.userData.animations[0]);
    first.skeleton.bones[0].position.x = 8;
    expect(second.skeleton.bones[0].position.x).toBe(0);
    a.userData.resetPose(); expect(first.skeleton.bones[0].position.x).toBe(0);
    const disposeGeometry = jest.spyOn(first.geometry, 'dispose');
    a.userData.disposeInstance(); a.userData.disposeInstance();
    expect(disposeGeometry).not.toHaveBeenCalled(); disposeGeometry.mockRestore();
});

test('incomplete or unskinned costume falls back instead of displaying the bare player body', () => {
    const source = fixture(); source.scene.remove(source.scene.getObjectByName('Ilyra_FourfoldCostume'));
    expect(() => createAuthoredIlyraInstance(source)).toThrow('Complete dressed');
    const invalid = fixture(); invalid.scene.getObjectByName('Ilyra_FourfoldCostume').skeleton.bones.pop();
    expect(() => createAuthoredIlyraInstance(invalid)).toThrow('Invalid Ilyra skin');
});

test('story equipment updates cannot strip either authored or procedural NPC clothing', () => {
    const spy = jest.spyOn(Actor.prototype, 'syncEquipmentVisuals').mockReturnValue(true);
    try {
        const story = new QuestNPC('ilyra', { story: true }), daily = new QuestNPC('daily');
        expect(story.meshType).toBe('ArchmageIlyra'); expect(story.type).toBe('QuestNPC');
        expect(story.syncEquipmentVisuals({})).toBe(false);
        expect(spy).not.toHaveBeenCalled();
        expect(daily.meshType).toBe('QuestNPC'); expect(daily.syncEquipmentVisuals({})).toBe(true);
    } finally { spy.mockRestore(); }
});

test('factory recovers from a dressed fallback and resets pooled NPC poses', async () => {
    const pool = MeshFactory.pool; MeshFactory.pool = {};
    const load = jest.spyOn(MeshFactory, 'loadModelWithTimeout').mockRejectedValueOnce(new Error('offline')).mockResolvedValue(fixture());
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
        const fallback = await MeshFactory.createMeshForType('ArchmageIlyra');
        expect(fallback.userData.assetFallback).toBe(true);
        expect(fallback.children.length).toBeGreaterThan(0);
        MeshFactory.releaseMesh('ArchmageIlyra', fallback);
        expect(MeshFactory.pool.ArchmageIlyra).toEqual([]);
        const actual = await MeshFactory.createMeshForType('ArchmageIlyra');
        actual.getObjectByName('IlyraBone0').position.x = 9;
        MeshFactory.releaseMesh('ArchmageIlyra', actual);
        const reused = await MeshFactory.createMeshForType('ArchmageIlyra');
        expect(reused).toBe(actual); expect(reused.getObjectByName('IlyraBone0').position.x).toBe(0);
        expect(reused.getObjectByName('Ilyra_FourfoldCostume').visible).toBe(true);
        expect(load).toHaveBeenCalledTimes(2);
    } finally { MeshFactory.pool = pool; load.mockRestore(); warn.mockRestore(); }
});
