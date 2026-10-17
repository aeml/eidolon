import { createProceduralPvPArena } from '../src/art/ProceduralPvPArena.js';
import { Box3, Group, Raycaster, Vector3 } from 'three';
import { Entity } from '../src/entities/Entity.js';

test('decorative court and team inlays cannot cover party markers when players cross them', () => {
    const arena = createProceduralPvPArena({ walkRects: [{ width: 50.5, height: 34.5 }] });
    const actor = new Entity('arena-inlay-crossing'); actor.mesh = new Group();
    actor.mesh.userData.bounds = { radius: 1.25 }; actor.setPartyHighlight(true);
    const marker = actor.mesh.getObjectByName('PartyRing');
    const inlays = arena.children.filter(part => part.geometry?.type === 'RingGeometry');
    try {
        expect(inlays).toHaveLength(4);
        arena.updateMatrixWorld(true);
        for (const inlay of inlays) {
            const target = new Vector3(inlay.position.x + inlay.geometry.parameters.outerRadius - .04, .05, inlay.position.z);
            actor.mesh.position.set(target.x - 1.1, 0, target.z); actor.mesh.updateMatrixWorld(true);
            const hits = new Raycaster(new Vector3(target.x, 100, target.z), new Vector3(0, -1, 0)).intersectObjects([inlay, marker]);
            expect(hits[0]?.object.name).toBe('PartyRing');
            expect(inlay.position.y).toBeGreaterThan(0);
            expect(inlay.position.y).toBeLessThan(marker.position.y);
        }
    } finally {
        actor.setPartyHighlight(false);
        const materials = new Set();
        arena.traverse(part => { part.geometry?.dispose(); if (part.material) materials.add(part.material); });
        materials.forEach(material => { material.map?.dispose(); material.dispose(); });
    }
});

test('the canonical arena floor does not occlude an ordinary party marker at server height zero', () => {
    const arena = createProceduralPvPArena({ walkRects: [{ width: 50.5, height: 34.5 }] });
    const actor = new Entity('arena-marker-grounding'); actor.mesh = new Group();
    actor.mesh.userData.bounds = { radius: 1.25 }; actor.setPartyHighlight(true);
    const floor = arena.getObjectByName('PvPArenaFloor'), marker = actor.mesh.getObjectByName('PartyRing');
    const target = new Vector3(1.1, .05, 0), camera = new Vector3(100, 100, 100);
    try {
        arena.updateMatrixWorld(true); actor.mesh.updateMatrixWorld(true);
        expect(marker.material.depthTest).toBe(true);
        const hits = new Raycaster(camera, target.clone().sub(camera).normalize()).intersectObjects([floor, marker]);
        expect(hits[0]?.object.name).toBe('PartyRing');
        expect(floor.position.y).toBe(0);
    } finally {
        actor.setPartyHighlight(false);
        const materials = new Set();
        arena.traverse(part => { part.geometry?.dispose(); if (part.material) materials.add(part.material); });
        materials.forEach(material => { material.map?.dispose(); material.dispose(); });
    }
});

test('arena has one canonical floor, low boundaries and no invisible gameplay objects', () => {
    const layout = { walkRects: [{ x: 0, z: 0, width: 50.5, height: 34.5 }] };
    const arena = createProceduralPvPArena(layout);
    const floors = arena.children.filter(mesh => mesh.name === 'PvPArenaFloor');
    expect(floors).toHaveLength(1);
    expect(floors[0].geometry.parameters).toMatchObject({ width: 50.5, height: 34.5 });
    expect(floors[0].material.map.name).toContain('lanternhold-vigil-stone');
    expect(floors[0].material.map.repeat.toArray()).toEqual([50.5 / 12, 34.5 / 12]);
    expect(floors[0].position.y).toBe(0);
    const foundation = new Box3().setFromObject(arena.getObjectByName('PvPArenaFoundation'));
    for (const base of arena.children.filter(mesh => mesh.name === 'PvPArenaBeaconBase')) {
        const bounds = new Box3().setFromObject(base);
        expect(bounds.min.x).toBeGreaterThanOrEqual(foundation.min.x - 1e-5);
        expect(bounds.max.x).toBeLessThanOrEqual(foundation.max.x + 1e-5);
        expect(bounds.min.z).toBeGreaterThanOrEqual(foundation.min.z - 1e-5);
        expect(bounds.max.z).toBeLessThanOrEqual(foundation.max.z + 1e-5);
    }
    expect(floors[0].material.userData.worldSurfaceDetail).toBe('fortress');
    const boundaries = arena.children.filter(mesh => mesh.name === 'PvPArenaBoundary');
    expect(boundaries).toHaveLength(4);
    for (const mesh of boundaries) {
        const box = new Box3().setFromObject(mesh);
        const width = mesh.position.x ? .5 : 51.5, depth = mesh.position.x ? 34.5 : .5;
        expect(box.min.x).toBeCloseTo(mesh.position.x - width / 2, 5);
        expect(box.max.x).toBeCloseTo(mesh.position.x + width / 2, 5);
        expect(box.min.z).toBeCloseTo(mesh.position.z - depth / 2, 5);
        expect(box.max.z).toBeCloseTo(mesh.position.z + depth / 2, 5);
        expect(box.min.y).toBeCloseTo(0, 5); expect(box.max.y).toBeCloseTo(.7, 5);
    }
    expect(arena.children.every(mesh => mesh.position.y < 3)).toBe(true);
    expect(arena.children.length).toBeLessThan(25);
    expect(layout.walkRects[0].width).toBe(50.5);
    const materials = new Set();
    arena.traverse(mesh => { mesh.geometry?.dispose(); if (mesh.material) materials.add(mesh.material); });
    materials.forEach(material => { material.map?.dispose(); material.dispose(); });
});

test('a missing or invalid arena contract does not silently build town scenery', () => {
    for (const layout of [null, {}, { walkRects: [{ width: -1, height: 32 }] }]) {
        expect(() => createProceduralPvPArena(layout)).toThrow('authoritative floor');
    }
});
