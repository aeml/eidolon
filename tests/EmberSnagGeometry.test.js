import * as THREE from 'three';
import { createEmberSnagGeometry, EMBER_SNAG_SOCKETS } from '../src/art/EmberSnagGeometry.js';
import { getProceduralFoliageArchetype } from '../src/art/ProceduralRealmFoliage.js';
import { getFoliageRenderBatches } from '../src/art/FoliageRenderBatches.js';

test('charred timber is deterministic, finite, smoothly shaded and inside the existing sightline apron', () => {
    const geometry = createEmberSnagGeometry(), repeat = createEmberSnagGeometry();
    try {
        expect(geometry.attributes.position.array).toEqual(repeat.attributes.position.array);
        expect(geometry.attributes.position.count / 3).toBe(204);
        expect([...geometry.attributes.position.array, ...geometry.attributes.normal.array,
            ...geometry.attributes.uv.array].every(Number.isFinite)).toBe(true);
        const normal = geometry.attributes.normal, position = geometry.attributes.position;
        for (let index = 0; index < position.count; index++) {
            expect(Math.hypot(normal.getX(index), normal.getY(index), normal.getZ(index))).toBeCloseTo(1, 5);
            expect(Math.hypot(position.getX(index), position.getZ(index)) * 1.3).toBeLessThan(8);
        }
        expect(geometry.boundingBox.min.y).toBeGreaterThan(-.35);
        expect(geometry.boundingBox.max.y).toBeGreaterThan(5.9);
    } finally { geometry.dispose(); repeat.dispose(); }
});

test('ember tips use the fork sockets and keep the same opaque bark/glow batch count on both settings', () => {
    const parts = getProceduralFoliageArchetype('ember_snag');
    expect(parts).toHaveLength(4);
    expect(parts[0].geometry.userData.emberSnag).toBe(true);
    expect(parts[0].material.userData.woodlandBark).toBe('pine');
    expect(parts[0].material.flatShading).toBe(false);
    for (let index = 0; index < 2; index++) {
        expect(new THREE.Vector3().setFromMatrixPosition(parts[index + 1].matrix).toArray()).toEqual(EMBER_SNAG_SOCKETS[index]);
        expect(parts[index + 1].castShadow).toBe(false);
    }
    const high = getFoliageRenderBatches('ember_snag'), low = getFoliageRenderBatches('ember_snag', 'low');
    expect(high).toHaveLength(2); expect(low).toHaveLength(2);
    for (let index = 0; index < high.length; index++) {
        expect(low[index].material).toBe(high[index].material);
        expect(low[index].material.transparent).toBe(false);
        expect(low[index].geometry.attributes.position.array).toEqual(high[index].geometry.attributes.position.array);
    }
});
