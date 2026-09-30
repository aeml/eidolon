import * as THREE from 'three';
import { createLanternholdStreetFurniture } from '../src/art/LanternholdStreetFurniture.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { createProceduralLanternholdStructure, getLanternholdWalkCollider } from '../src/art/ProceduralLanternholdArchitecture.js';

test('planted street edges keep matching High/Low solids and bounded owned batches', () => {
    const high = createLanternholdStreetFurniture(), low = createLanternholdStreetFurniture({ quality: 'low' });
    expect(high.userData.walkFootprints).toEqual(low.userData.walkFootprints);
    expect(high.userData.walkFootprints).toHaveLength(4);
    for (const group of [high, low]) {
        const meshes = [];
        group.traverse(part => { if (part.isMesh) meshes.push(part); expect(part.isLight).not.toBe(true); });
        expect(meshes).toHaveLength(6);
        expect(meshes.every(mesh => mesh.isBatchedMesh && mesh.perObjectFrustumCulled)).toBe(true);
        expect(meshes.every(mesh => mesh.geometry.attributes.position.array.every(Number.isFinite))).toBe(true);
        const bounds = new THREE.Box3().setFromObject(group);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-6);
        expect(bounds.max.y).toBeLessThan(6);
        for (const side of [-1, 1]) {
            const leaves = group.getObjectByName('street-rest-edges:leaves');
            const cell = leaves.userData.streetCells.find(cell => cell.name === `street-rest-edge:${side}:leaves`);
            const leafBounds = leaves.getBoundingBoxAt(cell.geometryId, new THREE.Box3())
                .applyMatrix4(leaves.getMatrixAt(cell.instanceId, new THREE.Matrix4()));
            expect(leafBounds.min.x).toBeGreaterThan(side * 19 - 1.1);
            expect(leafBounds.max.x).toBeLessThan(side * 19 + 1.1);
        }
        RenderSystem.prototype.disposeObjectResources.call({}, group);
    }
});

test.each(['high', 'low'])('%s street cells retain source geometry, transforms, materials and shadow flags', quality => {
    const options = { quality, cx: 37, cz: -40 };
    const source = createLanternholdStreetFurniture({ ...options, multiDraw: false });
    const batched = createLanternholdStreetFurniture(options);
    source.updateMatrixWorld(true); batched.updateMatrixWorld(true);
    let cells = 0, error = 0;
    for (const mesh of batched.children.filter(child => child.isBatchedMesh)) {
        expect(mesh.sortObjects).toBe(false); expect(mesh.perObjectFrustumCulled).toBe(true);
        for (const cell of mesh.userData.streetCells) {
            cells++;
            const original = source.getObjectByName(cell.name), geometry = original.geometry;
            const matrix = mesh.getMatrixAt(cell.instanceId, new THREE.Matrix4());
            // Instance matrices use the renderer's Float32 texture storage.
            for (let i = 0; i < 16; i++) expect(Math.abs(matrix.elements[i] - original.matrixWorld.elements[i])).toBeLessThan(1e-7);
            expect(mesh.castShadow).toBe(original.castShadow); expect(mesh.receiveShadow).toBe(original.receiveShadow);
            expect(mesh.material.toJSON()).toEqual({ ...original.material.toJSON(), uuid: mesh.material.uuid });
            const range = mesh.getGeometryRangeAt(cell.geometryId, {});
            expect(range.vertexCount).toBe(geometry.attributes.position.count);
            for (const [name, attribute] of Object.entries(geometry.attributes)) {
                const actual = mesh.geometry.attributes[name];
                for (let i = 0; i < attribute.array.length; i++) {
                    error = Math.max(error, Math.abs(actual.array[range.vertexStart * attribute.itemSize + i] - attribute.array[i]));
                }
            }
            const bounds = mesh.getBoundingBoxAt(cell.geometryId, new THREE.Box3());
            geometry.computeBoundingBox(); expect(bounds.equals(geometry.boundingBox)).toBe(true);
        }
    }
    expect(cells).toBe(12); expect(error).toBe(0);
    expect(batched.userData.walkFootprints).toEqual(source.userData.walkFootprints);
    RenderSystem.prototype.disposeObjectResources.call({}, source);
    RenderSystem.prototype.disposeObjectResources.call({}, batched);
});

test('production town attaches solid furniture while preserving central service approaches', async () => {
    const scene = new THREE.Group(), collision = new CollisionManager();
    await new WorldGenerator(scene, collision).loadBuildings(0, 200);
    for (const [kind, x, z, yaw] of [['trading_house', -22, 185, Math.PI / 4], ['forge', -28, 218, Math.PI / 2], ['stash', -16, 193, 0]]) {
        const mesh = createProceduralLanternholdStructure(kind); mesh.position.set(x, .5, z); mesh.rotation.y = yaw;
        collision.addOrientedCollider(getLanternholdWalkCollider(mesh));
    }
    const streets = scene.getObjectByName('Lanternhold planted street edges');
    expect(streets).toBeTruthy();
    for (const f of streets.userData.walkFootprints) {
        expect(collision.checkCollision(new THREE.Vector3(f.x, 0, f.z), .7)).toBeTruthy();
    }
    const services = [[-20, 200], [22.5, 200], [20, 215], [0, 220], [0, 240], [28, 229], [-23, 218], [-16, 196], [0, 181]];
    for (const [x, z] of services) for (let step = 0; step <= 60; step++) {
        const point = new THREE.Vector3(x * step / 60, 0, 200 + (z - 200) * step / 60);
        expect({ x, z, step, blocked: Boolean(collision.checkCollision(point, 1.25)) })
            .toEqual({ x, z, step, blocked: false });
    }
    const ownBoxes = streets.userData.walkFootprints.map(f => new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(f.x, f.y, f.z), new THREE.Vector3(f.width, f.height, f.depth)));
    for (const own of ownBoxes) for (const other of collision.colliders) {
        if (ownBoxes.some(box => box.equals(other))) continue;
        expect(other.intersectsBox(own)).toBe(false);
    }
    RenderSystem.prototype.disposeObjectResources.call({}, scene);
});
