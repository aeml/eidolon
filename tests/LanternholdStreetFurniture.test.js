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
        expect(meshes).toHaveLength(12);
        expect(meshes.every(mesh => mesh.geometry.attributes.position.array.every(Number.isFinite))).toBe(true);
        const bounds = new THREE.Box3().setFromObject(group);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-6);
        expect(bounds.max.y).toBeLessThan(6);
        for (const side of [-1, 1]) {
            const leafBounds = new THREE.Box3().setFromObject(group.getObjectByName(`street-rest-edge:${side}:leaves`));
            expect(leafBounds.min.x).toBeGreaterThan(side * 19 - 1.1);
            expect(leafBounds.max.x).toBeLessThan(side * 19 + 1.1);
        }
        RenderSystem.prototype.disposeObjectResources.call({}, group);
    }
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
