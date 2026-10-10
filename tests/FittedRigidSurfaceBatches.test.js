import * as THREE from 'three';
import { batchFittedRigidSurfaces } from '../src/art/FittedRigidSurfaceBatches.js';
import { gameplayRigidIndices } from '../src/art/GameplayRigidIndices.js';
import { applyActorStealthAppearance, restoreActorStealthAppearance } from '../src/entities/ActorStealthAppearance.js';
import { isOwnedFittedSurfaceMaterial } from '../src/art/FittedEquipmentBatches.js';

function fixture() {
    const root = new THREE.Group();
    const sources = [0, 1].map(i => {
        const geometry = new THREE.SphereGeometry(.3, 12, 8).translate(i, 0, 0);
        const material = new THREE.MeshStandardMaterial({ color: i ? '#efc07a' : '#32455a', roughness: .2 + i * .5,
            metalness: .8 - i * .3, emissive: i ? '#113322' : '#221133', emissiveIntensity: .4 + i });
        const mesh = new THREE.Mesh(geometry, material); mesh.name = `source-${i}`;
        mesh.position.set(.2, -.3, .4); mesh.rotation.y = .7; mesh.scale.set(1, 2, 1); root.add(mesh);
        return mesh;
    });
    return { root, sources };
}
const sourceOf = geometry => ({ index: new Uint32Array(geometry.index.array), attributes: Object.fromEntries(
    Object.entries(geometry.attributes).map(([name, attr]) => [name, { itemSize: attr.itemSize, array: attr.array }])) });

test('retains exact source rows, index order, fit transforms and distinct flat PBR surfaces', () => {
    const { root, sources } = fixture();
    const originals = sources.map(source => ({ geometry: source.geometry, material: source.material }));
    expect(batchFittedRigidSurfaces(root)).toBe(1);
    const batch = root.children.at(-1);
    expect(batch.matrix.equals(sources[0].matrix)).toBe(true);
    expect(batch.matrixAutoUpdate).toBe(false);
    expect(isOwnedFittedSurfaceMaterial(batch.material)).toBe(true);
    let vertexStart = 0, indexStart = 0;
    for (const [i, source] of sources.entries()) {
        expect(source.geometry).toBe(originals[i].geometry); expect(source.material).toBe(originals[i].material);
        expect(source.visible).toBe(false);
        for (const [name, attr] of Object.entries(source.geometry.attributes)) {
            const merged = batch.geometry.attributes[name].array;
            expect(Array.from(merged.subarray(vertexStart * attr.itemSize, (vertexStart + attr.count) * attr.itemSize))).toEqual(Array.from(attr.array));
        }
        expect(Array.from(batch.geometry.index.array.subarray(indexStart, indexStart + source.geometry.index.count)))
            .toEqual(Array.from(source.geometry.index.array, index => index + vertexStart));
        const expectedColor = [...source.material.color.toArray(), source.material.roughness].map(Math.fround);
        const expectedGlow = [...source.material.emissive.toArray().map(x => x * source.material.emissiveIntensity), source.material.metalness].map(Math.fround);
        for (let row = vertexStart; row < vertexStart + source.geometry.attributes.position.count; row++) {
            expect(Array.from(batch.geometry.attributes.fittedDiffuseRoughness.array.subarray(row * 4, row * 4 + 4))).toEqual(expectedColor);
            expect(Array.from(batch.geometry.attributes.fittedEmissiveMetalness.array.subarray(row * 4, row * 4 + 4))).toEqual(expectedGlow);
        }
        vertexStart += source.geometry.attributes.position.count; indexStart += source.geometry.index.count;
    }
});

for (const error of [.006, .012]) test(`keeps every existing rigid derivative index at error ${error}`, () => {
    const { root, sources } = fixture();
    const expected = [], vertexStarts = [0, sources[0].geometry.attributes.position.count];
    for (const [i, source] of sources.entries()) expected.push(...gameplayRigidIndices(sourceOf(source.geometry), { error }).indices.map(index => index + vertexStarts[i]));
    batchFittedRigidSurfaces(root);
    const geometry = root.children.at(-1).geometry;
    const result = gameplayRigidIndices({ ...sourceOf(geometry), rigidSurfacePartitions: geometry.userData.fittedRigidSurfacePartitions }, { error });
    expect(Array.from(result.indices)).toEqual(expected);
    expect(result.partitions).toHaveLength(2);
});

for (const change of [mesh => { mesh.position.x += .1; }, mesh => { mesh.onBeforeRender = () => {}; },
    mesh => { mesh.material.transparent = true; }, mesh => { mesh.material.onBeforeCompile = () => {}; },
    mesh => { mesh.material.side = THREE.DoubleSide; }, mesh => { mesh.geometry.addGroup(0, 3, 0); }])
    test('preserves unsupported or incompatible source boundaries', () => {
        const { root, sources } = fixture(); change(sources[1]);
        expect(batchFittedRigidSurfaces(root)).toBe(0); expect(root.children).toEqual(sources);
        expect(sources.every(source => source.visible)).toBe(true);
    });

test('stealth restores original fragment sorting and returns to the owned opaque batch', () => {
    const { root, sources } = fixture(); batchFittedRigidSurfaces(root);
    const batch = root.children.at(-1), actor = { mesh: root }, original = batch.material;
    applyActorStealthAppearance(actor);
    expect(batch.visible).toBe(false); expect(sources.every(source => source.visible && source.material.transparent)).toBe(true);
    restoreActorStealthAppearance(actor);
    expect(batch.visible).toBe(true); expect(batch.material).toBe(original); expect(sources.every(source => !source.visible)).toBe(true);
});

test('rejects indices crossing materials and nonconstant surface values', () => {
    const { root } = fixture(); batchFittedRigidSurfaces(root);
    const geometry = root.children.at(-1).geometry, source = { ...sourceOf(geometry), rigidSurfacePartitions: geometry.userData.fittedRigidSurfacePartitions };
    source.index[0] = geometry.userData.fittedRigidSurfacePartitions[1].vertexStart;
    expect(() => gameplayRigidIndices(source)).toThrow('crosses material partition');
    source.index = new Uint32Array(geometry.index.array);
    source.attributes.fittedDiffuseRoughness.array[4] += .1;
    expect(() => gameplayRigidIndices(source)).toThrow('one flat material');
});


test('keeps explicitly animated source nodes separate beneath their existing pivots', () => {
    const { root, sources } = fixture();
    expect(batchFittedRigidSurfaces(root, { animatedTargets: new Set([sources[0].name]) })).toBe(0);
    expect(root.children).toEqual(sources); expect(sources.every(source => source.visible)).toBe(true);
});
