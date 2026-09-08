import { createProceduralPvPArena } from '../src/art/ProceduralPvPArena.js';

test('arena has one canonical floor, low boundaries and no invisible gameplay objects', () => {
    const layout = { walkRects: [{ x: 0, z: 0, width: 50.5, height: 34.5 }] };
    const arena = createProceduralPvPArena(layout);
    const floors = arena.children.filter(mesh => mesh.name === 'PvPArenaFloor');
    expect(floors).toHaveLength(1);
    expect(floors[0].geometry.parameters).toMatchObject({ width: 50.5, height: 34.5 });
    expect(floors[0].material.map.name).toContain('lanternhold-vigil-stone');
    expect(floors[0].material.map.repeat.toArray()).toEqual([50.5 / 12, 34.5 / 12]);
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
