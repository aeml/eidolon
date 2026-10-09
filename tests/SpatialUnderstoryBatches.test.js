import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createEarthUnderstory, createEarthUnderstoryPlacements, earthUnderstoryScale,
    earthUnderstoryTint } from '../src/art/EarthUnderstory.js';
import { createWoodlandUnderstoryGeometry } from '../src/art/WoodlandUnderstoryGeometry.js';
import { WOODLAND_WIND_REACH } from '../src/art/WoodlandWindMaterial.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

test.each(['high', 'low'])('%s sectors conserve exact recipe, transform and tint for every plant', quality => {
    const terrainElevation = { sample: (x, z) => 2 + Math.sin(x * .03) + Math.cos(z * .02) };
    const root = createEarthUnderstory({ quality, terrainElevation, spatialBatches: true });
    const plants = createEarthUnderstoryPlacements(quality), transform = new THREE.Object3D();
    const expected = new Map(), actual = new Map(), matrix = new THREE.Matrix4(), color = new THREE.Color();
    const key = (variant, matrix) => `${variant}:${Array.from(matrix.elements).join(',')}`;
    for (const plant of plants) {
        transform.position.set(plant.x, terrainElevation.sample(plant.x, plant.z), plant.z);
        transform.rotation.set(0, plant.rotation, 0); transform.scale.fromArray(earthUnderstoryScale(plant));
        transform.updateMatrix(); matrix.fromArray(new Float32Array(transform.matrix.elements));
        expected.set(key(plant.variant, matrix), Array.from(new Float32Array(earthUnderstoryTint(plant).toArray())));
    }
    const shapes = ['bracken', 'sedge'].map(createWoodlandUnderstoryGeometry);
    try {
        expect(root.children.length).toBeLessThan(350);
        for (const mesh of root.children) {
            expect(mesh.isBatchedMesh).toBe(true);
            expect(mesh.castShadow).toBe(false);
            expect(mesh.perObjectFrustumCulled).toBe(true);
            expect(mesh.sortObjects).toBe(false);
            expect(mesh.boundingBox.isEmpty()).toBe(false);
            expect(mesh.boundingSphere.radius).toBeLessThan(50);
            for (let id = 0; id < mesh.instanceCount; id++) {
                const variant = mesh.getGeometryIdAt(id);
                mesh.getMatrixAt(id, matrix); mesh.getColorAt(id, color);
                const identity = key(variant, matrix);
                if (actual.has(identity)) throw new Error('duplicate plant');
                actual.set(identity, color.toArray());
            }
            // Copied source shapes keep all exact vertex/normal/color bytes.
            for (const [variant, source] of shapes.entries()) {
                const range = mesh.getGeometryRangeAt(variant);
                for (const [name, attribute] of Object.entries(source.attributes)) {
                    const offset = range.vertexStart * attribute.itemSize;
                    const copied = mesh.geometry.attributes[name].array.subarray(offset, offset + attribute.array.length);
                    if (!copied.every((value, i) => value === attribute.array[i])) throw new Error(`changed ${name} shape`);
                }
            }
        }
        expect(root.userData.plantCount).toBe(plants.length);
        expect(actual).toEqual(expected);
    } finally {
        shapes.forEach(geometry => geometry.dispose());
        RenderSystem.prototype.disposeObjectResources.call({}, root);
    }
});

test('sector and per-plant bounds include the entire rooted wind envelope and parent transforms', () => {
    const root = createEarthUnderstory({ quality: 'low', terrainElevation: { sample: () => 3 }, spatialBatches: true });
    root.position.set(4, 2, -7); root.rotation.y = .7; root.scale.set(1.1, 1.3, .8); root.updateMatrixWorld(true);
    const point = new THREE.Vector3(), matrix = new THREE.Matrix4(), box = new THREE.Box3(), sphere = new THREE.Sphere();
    try {
        for (const mesh of root.children) {
            const sectorBox = mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
            const sectorSphere = mesh.boundingSphere.clone().applyMatrix4(mesh.matrixWorld);
            // Test first and last plants in every sector, both source recipes
            // and every actual blade vertex with all four worst wind corners.
            for (const id of new Set([0, mesh.instanceCount - 1])) {
                mesh.getMatrixAt(id, matrix);
                const variant = mesh.getGeometryIdAt(id), range = mesh.getGeometryRangeAt(variant);
                mesh.getBoundingBoxAt(variant, box); mesh.getBoundingSphereAt(variant, sphere);
                matrix.premultiply(mesh.matrixWorld); box.applyMatrix4(matrix); sphere.applyMatrix4(matrix);
                const position = mesh.geometry.attributes.position;
                for (let i = range.vertexStart; i < range.vertexStart + range.vertexCount; i++) {
                    for (const x of [-1, 1]) for (const z of [-1, 1]) {
                        point.fromBufferAttribute(position, i);
                        point.x += x * WOODLAND_WIND_REACH * point.y * point.y;
                        point.z += z * WOODLAND_WIND_REACH * point.y * point.y;
                        point.applyMatrix4(matrix);
                        if (!box.containsPoint(point) || !sphere.containsPoint(point) ||
                            !sectorBox.containsPoint(point) || !sectorSphere.containsPoint(point)) {
                            throw new Error('moving blade escaped wind-padded bounds');
                        }
                    }
                }
            }
        }
    } finally { RenderSystem.prototype.disposeObjectResources.call({}, root); }
});

test('sector resources release matrix, color, indirection and geometry exactly once on scene clear', () => {
    const root = createEarthUnderstory({ quality: 'low', spatialBatches: true }), mesh = root.children[0];
    const spies = [mesh.geometry, mesh._matricesTexture, mesh._colorsTexture, mesh._indirectTexture, mesh.material]
        .map(object => jest.spyOn(object, 'dispose'));
    RenderSystem.prototype.disposeObjectResources.call({}, root);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
});
