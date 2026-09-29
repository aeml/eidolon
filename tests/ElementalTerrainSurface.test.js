import { sampleElementalTerrain } from '../src/art/ElementalTerrainSurface.js';
import { PROCEDURAL_TERRAIN_DEFINITIONS, createProceduralTerrainMaterial } from '../src/art/ProceduralRealmTerrain.js';

test.each(['water', 'fire'])('%s geology wraps exactly and keeps deposits physically coherent', realm => {
    const seed = PROCEDURAL_TERRAIN_DEFINITIONS[realm].seed;
    let bare = 0, covered = 0, bareRoughness = 0, coveredRoughness = 0;
    for (let y = 0; y < 256; y += 7) for (let x = 0; x < 256; x += 7) {
        const surface = sampleElementalTerrain(x, y, realm, seed);
        expect(sampleElementalTerrain(x + 256, y - 256, realm, seed)).toEqual(surface);
        expect(surface.color.every(c => Number.isInteger(c) && c > 25 && c < 160)).toBe(true);
        expect(Math.max(...surface.color) - Math.min(...surface.color)).toBeLessThan(35);
        expect(surface.height).toBeGreaterThan(.15); expect(surface.height).toBeLessThan(.4);
        expect(surface.roughness).toBeGreaterThanOrEqual(.6); expect(surface.roughness).toBeLessThan(1);
        if (surface.cover < .1) { bare++; bareRoughness += surface.roughness; }
        if (surface.cover > .8) { covered++; coveredRoughness += surface.roughness; }
    }
    expect(bare).toBeGreaterThan(50); expect(covered).toBeGreaterThan(50);
    expect(coveredRoughness / covered - bareRoughness / bare).toBeGreaterThan(.1);
});

test.each(['water', 'fire'])('%s High/Low use the same relief without extra maps or emissive ground', realm => {
    const high = createProceduralTerrainMaterial(realm), low = createProceduralTerrainMaterial(realm, { quality: 'low' });
    for (const key of ['map', 'normalMap', 'roughnessMap']) {
        const a = high[key].image, b = low[key].image;
        expect(a.data.byteLength).toBe(256 * 256 * 4); expect(b.data.byteLength).toBe(128 * 128 * 4);
        for (let y = 0; y < 128; y += 13) for (let x = 0; x < 128; x += 13) {
            expect(b.data.slice((y * 128 + x) * 4, (y * 128 + x) * 4 + 4))
                .toEqual(a.data.slice((y * 2 * 256 + x * 2) * 4, (y * 2 * 256 + x * 2) * 4 + 4));
        }
    }
    for (const material of [high, low]) {
        expect(Object.values(material).filter(value => value?.isTexture)).toHaveLength(3);
        expect(material.emissiveIntensity).toBe(0);
        let normalDisposals = 0, roughnessDisposals = 0;
        material.normalMap.addEventListener('dispose', () => normalDisposals++);
        material.roughnessMap.addEventListener('dispose', () => roughnessDisposals++);
        material.dispose(); material.dispose();
        expect(normalDisposals).toBe(1); expect(roughnessDisposals).toBe(1);
        material.map.dispose();
    }
});
