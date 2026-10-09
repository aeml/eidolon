import * as THREE from 'three';
import { jest } from '@jest/globals';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { getFoliageRenderBatches, updateFoliageRenderQuality } from '../src/art/FoliageRenderBatches.js';
import { batchSpatialWoodlandCells, getSpatialWoodlandSources, isSpatialWoodlandBatch } from '../src/art/SpatialWoodlandBatches.js';
import { FoliageShadowInfluence } from '../src/core/FoliageShadowInfluence.js';

async function world(quality, spatial) {
    const scene = new THREE.Scene(), colliders = [], terrain = { sample: (x, z) => Math.sin(x / 90) * 2 + Math.cos(z / 80) };
    const generator = new WorldGenerator(scene, { addCollider: box => colliders.push(box) }, {
        graphicsQuality: quality, terrainElevation: terrain, woodlandSpatialBatches: spatial, understorySpatialBatches: true
    });
    await generator.loadTrees(0, 200);
    return { scene, colliders, roots: scene.children.filter(root => root.userData.region === 'earth') };
}

function verify(source, candidate, quality) {
    const original = new Map();
    for (const root of source.roots) for (const mesh of root.children) original.set(`${root.userData.foliageId}:${mesh.name}:${mesh.userData.foliageCell}`, mesh);
    let matrices = 0, positionError = 0, normalError = 0, attributeError = 0, indexError = 0, candidateTriangles = 0;
    const matrix = new THREE.Matrix4(), referenceMatrix = new THREE.Matrix4(), actual = new THREE.Vector3(), expected = new THREE.Vector3();
    const seen = new Set();
    for (const root of candidate.roots) {
        const parts = new Map(getFoliageRenderBatches(root.userData.foliageId, quality).map(part => [part.name, part]));
        for (const mesh of root.children) {
            expect(isSpatialWoodlandBatch(mesh)).toBe(true);
            const geometries = new Set();
            for (const entry of getSpatialWoodlandSources(mesh)) {
                const reference = original.get(`${root.userData.foliageId}:${entry.name}:${entry.cell}`);
                const slot = reference.userData.placementIndices.indexOf(entry.placementIndex);
                const key = `${root.userData.foliageId}:${entry.name}:${entry.placementIndex}`;
                expect(seen.has(key)).toBe(false); seen.add(key);
                reference.getMatrixAt(slot, referenceMatrix); mesh.getMatrixAt(entry.instanceId, matrix);
                expect(matrix.elements).toEqual(referenceMatrix.elements); matrices++;
                expect(mesh.material).toBe(reference.material); expect(mesh.castShadow).toBe(reference.castShadow);
                expect(mesh.receiveShadow).toBe(reference.receiveShadow);
                const geometry = parts.get(entry.name).geometry;
                const count = geometry.index?.count ?? geometry.attributes.position.count;
                const range = mesh.getGeometryRangeAt(entry.geometryId, {});
                candidateTriangles += range.indexCount / 3;
                expect(range.indexCount).toBe(count);
                expect(range.vertexCount).toBe(geometry.attributes.position.count);
                if (geometries.has(entry.geometryId)) continue;
                geometries.add(entry.geometryId);
                for (let i = 0; i < count; i++) {
                    const index = geometry.index ? geometry.index.getX(i) : i;
                    indexError = Math.max(indexError, Math.abs(mesh.geometry.index.getX(range.indexStart + i) - range.vertexStart - index));
                }
                for (let index = 0; index < geometry.attributes.position.count; index++) {
                    const offset = range.vertexStart + index;
                    for (const [name, attribute] of Object.entries(geometry.attributes)) for (let c = 0; c < attribute.itemSize; c++) {
                        attributeError = Math.max(attributeError, Math.abs(attribute.getComponent(index, c) - mesh.geometry.attributes[name].getComponent(offset, c)));
                    }
                }
                // Every source attribute and index plus every live matrix is
                // proven exact above. These sample transformed vectors also
                // check the coordinate/normal convention without repeating
                // identical affine math for every triangle-index occurrence.
                const normal = new THREE.Matrix3().getNormalMatrix(matrix);
                for (const index of [0, Math.floor(geometry.attributes.position.count / 2), geometry.attributes.position.count - 1]) {
                    const offset = range.vertexStart + index;
                    actual.fromBufferAttribute(mesh.geometry.attributes.position, offset).applyMatrix4(matrix);
                    expected.fromBufferAttribute(geometry.attributes.position, index).applyMatrix4(referenceMatrix);
                    positionError = Math.max(positionError, actual.distanceTo(expected));
                    actual.fromBufferAttribute(mesh.geometry.attributes.normal, offset).applyNormalMatrix(normal);
                    expected.fromBufferAttribute(geometry.attributes.normal, index).applyNormalMatrix(normal);
                    normalError = Math.max(normalError, actual.distanceTo(expected));
                }
            }
        }
    }
    const sourceInstances = [...original.values()].reduce((sum, mesh) => sum + mesh.count, 0);
    const sourceTriangles = [...original.values()].reduce((sum, mesh) => sum + mesh.count * (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
    expect(matrices).toBe(sourceInstances); expect(candidateTriangles).toBe(sourceTriangles);
    expect(positionError).toBe(0); expect(normalError).toBe(0); expect(attributeError).toBe(0);
    expect(indexError).toBe(0);
}

test.each(['high', 'low'])('%s spatial woodland retains all original Float32 matrices, attributes, triangles, materials and colliders', async quality => {
    const source = await world(quality, false), candidate = await world(quality, true);
    expect(candidate.colliders).toEqual(source.colliders);
    verify(source, candidate, quality);
    expect(candidate.roots.reduce((n, root) => n + root.children.length, 0))
        .toBeLessThan(source.roots.reduce((n, root) => n + root.children.length, 0));
    for (const root of candidate.scene.children.filter(root => root.userData.region && root.userData.region !== 'earth')) {
        expect(root.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    }
});

test('low-high-low quality changes preserve instance IDs, matrices and geometry allocation while updating every original shape', async () => {
    const source = await world('low', false), candidate = await world('low', true);
    const before = candidate.roots.flatMap(root => root.children).map(mesh => ({ mesh, geometry: mesh.geometry,
        matrices: getSpatialWoodlandSources(mesh).map(entry => mesh.getMatrixAt(entry.instanceId, new THREE.Matrix4()).elements) }));
    for (const quality of ['high', 'low']) {
        updateFoliageRenderQuality(candidate.scene, quality); updateFoliageRenderQuality(source.scene, quality);
        verify(source, candidate, quality);
        for (const record of before) {
            expect(record.mesh.geometry).toBe(record.geometry);
            expect(getSpatialWoodlandSources(record.mesh).map(entry => record.mesh.getMatrixAt(entry.instanceId, new THREE.Matrix4()).elements)).toEqual(record.matrices);
        }
    }
});

test('unsupported source state keeps all original cells and shared resources', async () => {
    const source = await world('high', false), root = source.roots[0], children = [...root.children];
    children[0].material = children[0].material.clone();
    expect(batchSpatialWoodlandCells(root, getFoliageRenderBatches(root.userData.foliageId, 'high'))).toBe(false);
    expect(root.children).toEqual(children);
});

test('owned batch shadow proof follows live bounds/material/camera state and always restores visibility', async () => {
    const candidate = await world('high', true), scene = candidate.scene;
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 200);
    camera.up.set(0, 0, -1); camera.position.set(0, 100, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    const light = new THREE.DirectionalLight(); light.position.set(50, 100, 0); scene.add(light, light.target); scene.updateMatrixWorld(true);
    const controller = new FoliageShadowInfluence(scene);
    try {
        controller.beginFrame(scene, camera, light);
        const hidden = [...controller.hidden]; expect(hidden.length).toBeGreaterThan(0);
        expect(hidden.every(isSpatialWoodlandBatch)).toBe(true);
        controller.endFrame(); expect(hidden.every(mesh => mesh.visible)).toBe(true);
        const mesh = hidden[0], original = mesh.boundingBox.clone();
        mesh.boundingBox.union(new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1)));
        controller.beginFrame(scene, camera, light); expect(mesh.visible).toBe(true); expect(mesh.castShadow).toBe(true); controller.endFrame();
        mesh.boundingBox.copy(original); controller.beginFrame(scene, camera, light); expect(mesh.visible).toBe(false); controller.endFrame();
        mesh.material.userData.woodlandWind = true;
        try { controller.beginFrame(scene, camera, light); expect(mesh.visible).toBe(true); expect(mesh.castShadow).toBe(true); }
        finally { controller.endFrame(); delete mesh.material.userData.woodlandWind; }
        controller.beginFrame(scene, camera, light, THREE.VSMShadowMap); expect(mesh.visible).toBe(true); controller.endFrame();
    } finally { controller.dispose(); }
});

test('disposing a spatial mesh releases owned geometry and indirection resources without disposing shared source materials', async () => {
    const candidate = await world('high', true), mesh = candidate.roots[0].children[0];
    const disposed = jest.fn(), shared = jest.spyOn(mesh.material, 'dispose'); mesh.geometry.addEventListener('dispose', disposed);
    try { mesh.dispose(); expect(disposed).toHaveBeenCalledTimes(1); expect(shared).not.toHaveBeenCalled(); }
    finally { shared.mockRestore(); }
});
