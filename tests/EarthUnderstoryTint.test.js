import * as THREE from 'three';
import { earthUnderstoryTint, createEarthUnderstoryPlacements } from '../src/art/EarthUnderstory.js';

test('plant tones stay deterministic, subtle and independent of cells, order and graphics quality', () => {
    const high = createEarthUnderstoryPlacements('high'), low = createEarthUnderstoryPlacements('low');
    const byPosition = new Map(high.map(p => [`${p.x},${p.z}`, earthUnderstoryTint(p).toArray()]));
    const tones = new Set(), scratch = new THREE.Color();
    for (const plant of low) {
        const tint = earthUnderstoryTint(plant, scratch);
        expect(tint).toBe(scratch);
        expect(tint.toArray()).toEqual(byPosition.get(`${plant.x},${plant.z}`));
        expect(tint.toArray()).toEqual(earthUnderstoryTint({ ...plant, renderCell: 'different', quality: 'high' }).toArray());
        tones.add(tint.toArray().map(v => v.toFixed(2)).join(','));
        for (const channel of tint.toArray()) {
            expect(channel).toBeGreaterThan(.73); expect(channel).toBeLessThan(1.07);
        }
    }
    expect(tones.size).toBeGreaterThan(50);
});
