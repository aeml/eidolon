import { jest } from '@jest/globals';
import * as THREE from 'three';
import { createLanternholdCampPlacements, createProceduralLanternholdCampField } from '../src/art/ProceduralLanternholdArchitecture.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';

const placements = createLanternholdCampPlacements(0, 200);
const cameraAt = (x, z, span) => {
    const camera = new THREE.OrthographicCamera(-span, span, span, -span, .1, 1000);
    camera.position.set(x, 200, z); camera.up.set(0, 0, -1); camera.lookAt(x, 0, z);
    camera.updateMatrixWorld(true); return camera;
};
const release = field => field.children.forEach(mesh => mesh.dispose());

test('camp derivatives retain every source vertex, surface attribute, material and original transform', () => {
    const reference = createProceduralLanternholdCampField(placements);
    const selected = createProceduralLanternholdCampField(placements, { perInstanceFrustum: true });
    try {
        expect(selected.userData).toEqual(reference.userData);
        expect(selected.children).toHaveLength(9);
        for (let index = 0; index < reference.children.length; index++) {
            const original = reference.children[index], candidate = selected.children[index];
            expect(candidate.isBatchedMesh).toBe(true); expect(candidate.material).toBe(original.material);
            expect(candidate.perObjectFrustumCulled).toBe(true); expect(candidate.sortObjects).toBe(false);
            expect(Object.keys(candidate.geometry.attributes)).toEqual(Object.keys(original.geometry.attributes));
            for (const [name, attribute] of Object.entries(original.geometry.attributes)) {
                const copied = candidate.geometry.attributes[name];
                expect(copied.array).not.toBe(attribute.array);
                expect(copied.itemSize).toBe(attribute.itemSize); expect(copied.normalized).toBe(attribute.normalized);
                expect(copied.array).toEqual(attribute.array);
            }
            expect(candidate.geometry.index).toBe(original.geometry.index);
            for (let i = 0; i < placements.length; i++) {
                const source = new THREE.Matrix4(), copied = new THREE.Matrix4();
                original.getMatrixAt(i, source); candidate.getMatrixAt(i, copied);
                expect(copied.elements).toEqual(source.elements);
                expect(candidate.getVisibleAt(i)).toBe(true);
            }
            expect(candidate.boundingBox.min.distanceTo(original.boundingBox.min)).toBeLessThan(1e-4);
            expect(candidate.boundingBox.max.distanceTo(original.boundingBox.max)).toBeLessThan(1e-4);
            const disposeSource = jest.spyOn(original.geometry, 'dispose'), disposeMaterial = jest.spyOn(original.material, 'dispose');
            candidate.dispose();
            expect(disposeSource).not.toHaveBeenCalled(); expect(disposeMaterial).not.toHaveBeenCalled();
            disposeSource.mockRestore(); disposeMaterial.mockRestore();
        }
    } finally { release(reference); }
});

test('each color and shadow camera independently clips camps without retiring or moving any instance', () => {
    const field = createProceduralLanternholdCampField(placements, { perInstanceFrustum: true });
    const local = cameraAt(0, 200, 15), shadow = cameraAt(0, 200, 150);
    field.updateMatrixWorld(true);
    try {
        for (const mesh of field.children) {
            const before = Array.from({ length: placements.length }, (_, i) => mesh.getMatrixAt(i, new THREE.Matrix4()).elements.slice());
            mesh.onBeforeRender(null, null, local, mesh.geometry, mesh.material);
            expect(mesh._multiDrawCount).toBe(0);
            mesh.onBeforeShadow(null, null, local, shadow, mesh.geometry, mesh.material);
            expect(mesh._multiDrawCount).toBe(15);
            mesh.onBeforeRender(null, null, local, mesh.geometry, mesh.material);
            expect(mesh._multiDrawCount).toBe(0);
            for (let i = 0; i < placements.length; i++) {
                expect(mesh.getMatrixAt(i, new THREE.Matrix4()).elements).toEqual(before[i]);
                expect(mesh.getVisibleAt(i)).toBe(true);
            }
        }
    } finally { release(field); }
});

test('existing default, missing capability and empty placement paths retain instancing', () => {
    for (const options of [{}, { perInstanceFrustum: false }]) {
        const field = createProceduralLanternholdCampField(placements, options);
        try { expect(field.children.every(mesh => mesh.isInstancedMesh && mesh.count === 15)).toBe(true); }
        finally { release(field); }
    }
    const field = createProceduralLanternholdCampField([], { perInstanceFrustum: true });
    try { expect(field.children.every(mesh => mesh.isInstancedMesh && mesh.count === 0)).toBe(true); }
    finally { release(field); }
});

test('world-generation uses the coherent residential ward with either renderer capability', async () => {
    const results = [];
    for (const [quality, supported] of [['high', false], ['high', true], ['low', false], ['low', true], ['medium', false]]) {
        const scene = new THREE.Group(), collision = { addCollider: jest.fn(), addOrientedCollider: jest.fn(), addCircularCollider: jest.fn() };
        const world = new WorldGenerator(scene, collision, { campInstanceFrustum: supported, graphicsQuality: quality });
        await world.loadBuildings(0, 200);
        const field = scene.getObjectByName('Lanternhold residential wards');
        expect(field.userData.walkFootprints).toHaveLength(15);
        const clipped = supported || quality === 'low';
        expect(field.children.every(mesh => clipped ? mesh.isBatchedMesh : mesh.isInstancedMesh)).toBe(true);
        expect(world.campInstanceFrustum).toBe(supported);
        results.push({ colliders: collision.addCollider.mock.calls, oriented: collision.addOrientedCollider.mock.calls,
            circles: collision.addCircularCollider.mock.calls });
        release(field);
    }
    for (const result of results.slice(1)) expect(result).toEqual(results[0]);
});
