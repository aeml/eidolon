import { jest } from '@jest/globals';
import * as THREE from 'three';
import { DUNGEON_INTERIOR_IDS, createProceduralDungeonInteriorKit, createDungeonRoomStatePresentation,
    applyDungeonRoomStatePresentation, animateDungeonRoomStatePresentation } from '../src/art/ProceduralDungeonInteriors.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { Entity } from '../src/entities/Entity.js';
import { createDungeonEntryWard } from '../src/art/DungeonEntryWard.js';
import { getRegionTheme } from '../src/art/darkFantasyTheme.js';

test('walkable entry threshold preserves ordinary party markers without weakening depth testing', () => {
    const ward = createDungeonEntryWard(getRegionTheme('verdant_bastion_catacombs'));
    const actor = new Entity('ward-threshold-marker'); actor.mesh = new THREE.Group();
    actor.mesh.position.set(-1.1, 0, 0); actor.mesh.userData.bounds = { radius: 1.25 }; actor.setPartyHighlight(true);
    try {
        ward.updateMatrixWorld(true); actor.mesh.updateMatrixWorld(true);
        const opaque = ward.children.filter(part => part.isMesh && !part.material.transparent);
        const marker = actor.mesh.getObjectByName('PartyRing'), target = new THREE.Vector3(0, .05, 0);
        const camera = target.clone().add(new THREE.Vector3(100, 100, 100));
        const hits = new THREE.Raycaster(camera, target.clone().sub(camera).normalize()).intersectObjects([...opaque, marker]);
        expect(marker.material.depthTest).toBe(true); expect(hits[0]?.object.name).toBe('PartyRing');
    } finally { actor.setPartyHighlight(false); RenderSystem.prototype.disposeObjectResources.call({}, ward); }
});

test.each(DUNGEON_INTERIOR_IDS)('%s entry ward is grounded, bounded and keeps its physical opening stable across room states', type => {
    const room = { x: 280, z: -350, width: 40, height: 40, type: 'start' };
    const root = createDungeonRoomStatePresentation(type, room, 0, { worldSpace: true });
    const ward = root.getObjectByName('DungeonEntryWard'), veil = root.getObjectByName('DungeonExitPortal');
    expect(ward.children).toHaveLength(3);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(ward);
    expect(box.min.y).toBeGreaterThanOrEqual(0);
    expect(box.max.y).toBeLessThan(10);
    expect(box.min.x).toBeGreaterThan(room.x - 4); expect(box.max.x).toBeLessThan(room.x + 4);
    expect(box.min.z).toBeGreaterThan(room.z - 5); expect(box.max.z).toBeLessThan(room.z - 2);
    let triangles = 0;
    ward.traverse(part => {
        expect(part.userData.visualOnly).toBe(true);
        if (!part.isMesh) return;
        triangles += (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3;
        expect(part.geometry.groups).toHaveLength(0);
        expect([...part.geometry.attributes.position.array, ...part.geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
    });
    expect(triangles).toBeLessThan(4000);
    // A real geometric opening through the stone, not an opaque frame filling
    // the hero's route. No collider or new interaction is registered by the art.
    const ray = new THREE.Raycaster(new THREE.Vector3(room.x, 3, room.z + 5), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(ward.getObjectByName('DungeonEntryWard:Masonry'))).toHaveLength(0);
    const position = veil.position.clone(), rotation = veil.quaternion.clone(), scale = veil.scale.clone();
    for (const objectiveRoomIndex of [0, 1, -1, 0]) {
        applyDungeonRoomStatePresentation(root, { cleared: objectiveRoomIndex === -1 }, { currentRoomIndex: 0, objectiveRoomIndex });
        expect(veil.material.opacity).toBe(objectiveRoomIndex === -1 ? .9 : .18);
        animateDungeonRoomStatePresentation(root, 2.5);
        expect(veil.material.userData.dungeonVeilTime.value).toBe(2.5);
        expect(veil.position.equals(position) && veil.quaternion.equals(rotation) && veil.scale.equals(scale)).toBe(true);
        expect(root.userData.exitReady).toBe(objectiveRoomIndex === -1);
        expect(veil.material.opacity).toBeGreaterThan(0); expect(veil.material.opacity).toBeLessThanOrEqual(.94);
    }
    RenderSystem.prototype.disposeObjectResources.call({}, root);
});

test('room teardown releases each entry-ward material and geometry once; non-entry rooms allocate no ward', () => {
    const root = createDungeonRoomStatePresentation('verdant_bastion_catacombs', { type: 'start', width: 120 }, 0);
    const ward = root.getObjectByName('DungeonEntryWard'), disposals = [];
    for (const part of ward.children) disposals.push(jest.spyOn(part.geometry, 'dispose'), jest.spyOn(part.material, 'dispose'));
    RenderSystem.prototype.disposeObjectResources.call({}, root);
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
    const ordinary = createDungeonRoomStatePresentation('verdant_bastion_catacombs', { type: 'normal' }, 1);
    expect(ordinary.getObjectByName('DungeonEntryWard')).toBeUndefined();
    RenderSystem.prototype.disposeObjectResources.call({}, ordinary);
});


test.each(['high', 'low'])('%s entry finish shares the kit maps without sharing mutable material state', quality => {
    const kit = createProceduralDungeonInteriorKit('verdant_bastion_catacombs', { quality });
    const room = kit.createRoomDressing({ type: 'start', width: 120, height: 120 }, 0, { optimized: false });
    const ward = room.getObjectByName('DungeonEntryWard');
    try {
        for (const [name, shared] of [['Masonry', room.getObjectByName('entry:left-vigil:base').material],
            ['Ironwork', room.getObjectByName('entry:left-vigil:shaft').material]]) {
            const own = ward.getObjectByName(`DungeonEntryWard:${name}`).material;
            expect(own).not.toBe(shared); expect(own.vertexColors).toBe(true);
            for (const key of ['map', 'normalMap', 'roughnessMap']) {
                expect(own[key]).toBe(shared[key]);
                expect(own[key].image.width).toBe(quality === 'low' ? 64 : 128);
            }
            expect(own.normalScale.equals(shared.normalScale)).toBe(true);
            expect(own.normalScale).not.toBe(shared.normalScale);
            own.color.multiplyScalar(.5); expect(own.color.equals(shared.color)).toBe(false);
        }
        expect(ward.getObjectByName('DungeonExitPortal').material.transparent).toBe(true);
    } finally { RenderSystem.prototype.disposeObjectResources.call({}, room); }
});

test('entry finish keeps equal grain density across masonry courses and the wide threshold', () => {
    const ward = createDungeonEntryWard(getRegionTheme('verdant_bastion_catacombs'));
    try {
        const geometry = ward.getObjectByName('DungeonEntryWard:Masonry').geometry;
        const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
        const front = [], top = [];
        for (let i = 0; i < p.count; i++) {
            if (n.getZ(i) > .999 && p.getX(i) > 2.8 && p.getY(i) > .3 && p.getY(i) < 3.4 && p.getZ(i) > .3) front.push(i);
            if (n.getY(i) > .999 && p.getY(i) < .03) top.push(i);
        }
        const a = front[0], b = front.find(i => Math.abs(p.getX(i) - p.getX(a)) < 1e-6 && Math.abs(p.getY(i) - p.getY(a)) > .7);
        const c = front.find(i => Math.abs(p.getY(i) - p.getY(a)) < 1e-6 && Math.abs(p.getX(i) - p.getX(a)) > .5);
        const d = top[0], e = top.find(i => Math.abs(p.getZ(i) - p.getZ(d)) < 1e-6 && Math.abs(p.getX(i) - p.getX(d)) > 2);
        expect([a, b, c, d, e].every(Number.isInteger)).toBe(true);
        const density = (first, second) => Math.hypot(uv.getX(first) - uv.getX(second), uv.getY(first) - uv.getY(second)) /
            Math.hypot(p.getX(first) - p.getX(second), p.getY(first) - p.getY(second), p.getZ(first) - p.getZ(second));
        expect(density(a, b)).toBeGreaterThan(.1);
        expect(density(a, b)).toBeCloseTo(density(a, c), 5);
        expect(density(a, b)).toBeCloseTo(density(d, e), 5);
    } finally { RenderSystem.prototype.disposeObjectResources.call({}, ward); }
});

test('masonry and iron bevels retain usable texture area on every physical face', () => {
    const ward = createDungeonEntryWard(getRegionTheme('verdant_bastion_catacombs'));
    try {
        for (const name of ['Masonry', 'Ironwork']) {
            const geometry = ward.getObjectByName(`DungeonEntryWard:${name}`).geometry;
            const p = geometry.attributes.position, uv = geometry.attributes.uv;
            const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
            for (let i = 0; i < p.count; i += 3) {
                a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
                const area = b.sub(a).cross(c.sub(a)).length();
                if (area < 1e-10) continue;
                const textureArea = Math.abs((uv.getX(i + 1) - uv.getX(i)) * (uv.getY(i + 2) - uv.getY(i)) -
                    (uv.getY(i + 1) - uv.getY(i)) * (uv.getX(i + 2) - uv.getX(i)));
                expect(textureArea / area).toBeGreaterThan(.3);
            }
        }
    } finally { RenderSystem.prototype.disposeObjectResources.call({}, ward); }
});
