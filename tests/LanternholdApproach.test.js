import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createLanternholdRoadCart } from '../src/art/LanternholdRoadCart.js';
import { STARTER_ROAD_CLEARINGS, LANTERNHOLD_ROAD_CART } from '../src/data/lanternholdApproach.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { createEarthUnderstoryPlacements } from '../src/art/EarthUnderstory.js';
import { Actor } from '../src/entities/Actor.js';

test('approach dressing respects the authored starter centres and exposes matching render/spawn solids', () => {
    const source = readFileSync(new URL('../server/internal/game/starter_encounters.go', import.meta.url), 'utf8');
    const block = source.split('var lanternholdStarterSpawns =')[1].split('\n}')[0];
    const points = [...block.matchAll(/\{(\d+), (\d+)\}/g)].map(match => [+match[1], +match[2]]);
    expect(STARTER_ROAD_CLEARINGS.map(([x, z]) => [x, z])).toEqual(points);
    const high = createLanternholdRoadCart(), low = createLanternholdRoadCart({ quality: 'low' });
    expect(high.userData.walkFootprints).toEqual(low.userData.walkFootprints);
    const data = JSON.parse(readFileSync(new URL('../server/internal/game/content/world-population-footprints.json', import.meta.url)));
    expect(data.footprints.filter(f => f.siteId === 'lanternhold-road-cart')).toEqual(
        high.userData.walkFootprints.map(({ siteId, x, z, width, depth }) => ({ siteId, x, z, width, depth })));
    for (const root of [high, low]) {
        expect(root.children).toHaveLength(4);
        expect(root.children.every(mesh => [...mesh.geometry.attributes.position.array].every(Number.isFinite))).toBe(true);
        const bounds = new THREE.Box3().setFromObject(root);
        expect(bounds.min.y).toBeGreaterThanOrEqual(0);
        expect(bounds.max.y).toBeLessThan(3.5);
        const projected = new THREE.Vector3();
        root.updateMatrixWorld(true);
        for (const mesh of root.children) {
            const vertices = mesh.geometry.attributes.position;
            for (let i = 0; i < vertices.count; i++) {
                projected.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld);
                expect(root.userData.walkFootprints.some(f => Math.abs(projected.x - f.x) <= f.width / 2 + 1e-5
                    && Math.abs(projected.z - f.z) <= f.depth / 2 + 1e-5)).toBe(true);
            }
        }
        RenderSystem.prototype.disposeObjectResources.call({}, root);
    }
    const raised = createLanternholdRoadCart({ terrainElevation: { sample: () => 3 } });
    expect(raised.position.y).toBe(3); expect(raised.userData.walkFootprints[0].y).toBe(4.75);
    RenderSystem.prototype.disposeObjectResources.call({}, raised);
});

test('first-road low planting has real density outside clear fighting and travel space', () => {
    const plants = createEarthUnderstoryPlacements();
    expect(plants.filter(p => p.x > 115 && p.x < 165 && p.z > 140 && p.z < 270).length).toBeGreaterThan(20);
    expect(plants.filter(p => p.x > 107 && p.x < 132 && p.z > 155 && p.z < 195).length).toBeGreaterThan(5);
    for (const p of plants) {
        for (const [x, z, radius] of STARTER_ROAD_CLEARINGS) expect(Math.hypot(p.x - x, p.z - z)).toBeGreaterThanOrEqual(radius + 2.2);
        expect(Math.hypot(p.x - LANTERNHOLD_ROAD_CART.x, p.z - LANTERNHOLD_ROAD_CART.z)).toBeGreaterThanOrEqual(9.2);
    }
});

test('cart attaches in production without covering roads, first fights or existing scenery', async () => {
    const scene = new THREE.Group(), collision = new CollisionManager();
    await new WorldGenerator(scene, collision).loadBuildings(0, 200);
    const cart = scene.getObjectByName('Lanternhold stranded supply cart'); expect(cart).toBeTruthy();
    const boxes = cart.userData.walkFootprints.map(f => new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(f.x, f.y, f.z), new THREE.Vector3(f.width, f.height, f.depth)));
    expect(collision.checkCollision(new THREE.Vector3(LANTERNHOLD_ROAD_CART.x, 0, LANTERNHOLD_ROAD_CART.z), 1.25)).toBeTruthy();
    for (const [x, z, radius] of STARTER_ROAD_CLEARINGS) for (let angle = 0; angle < 16; angle++) {
        const point = new THREE.Vector3(x + Math.cos(angle * Math.PI / 8) * radius, 0, z + Math.sin(angle * Math.PI / 8) * radius);
        for (const box of boxes) expect(box.clone().expandByScalar(1.25).containsPoint(point)).toBe(false);
    }
    for (let x = 101; x <= 190; x++) expect(collision.checkCollision(new THREE.Vector3(x, 0, 200), 1.25)).toBeFalsy();
    for (const own of boxes) for (const other of collision.colliders) {
        if (!boxes.some(box => box.equals(other))) expect(other.intersectsBox(own)).toBe(false);
    }
    // Existing saved positions may predate this prop. Retain ordinary overlap
    // recovery rather than requiring a relog or teleport out of its body.
    const actor = new Actor('cart-saved-position', {}); actor.radius = 1.25; actor.isMultiplayer = true;
    const center = new THREE.Vector3(LANTERNHOLD_ROAD_CART.x, 0, LANTERNHOLD_ROAD_CART.z);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        actor.position.copy(center); actor.move(center.clone().add(new THREE.Vector3(dx * 6, 0, dz * 6)));
        actor.update(1 / 60, collision, null, null);
        const sphere = new THREE.Sphere(actor.position, actor.radius - .001);
        expect(collision.colliders.some(box => box.intersectsSphere(sphere))).toBe(false);
        expect(actor.position.distanceTo(center)).toBeLessThan(6);
    }
    actor.dispose();
    RenderSystem.prototype.disposeObjectResources.call({}, scene);
});
