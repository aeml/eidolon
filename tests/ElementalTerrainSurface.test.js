import { sampleElementalTerrain } from '../src/art/ElementalTerrainSurface.js';
import { PROCEDURAL_TERRAIN_DEFINITIONS, createProceduralTerrainMaterial } from '../src/art/ProceduralRealmTerrain.js';
import { createHash } from 'node:crypto';

test('Cinder basalt exposes broken flow crust and recessed pores beneath ash', () => {
    let exposed = 0, pitted = 0, ash = 0;
    const seed = PROCEDURAL_TERRAIN_DEFINITIONS.fire.seed;
    for (let y = 0; y < 256; y += 7) for (let x = 0; x < 256; x += 7) {
        const surface = sampleElementalTerrain(x, y, 'fire', seed);
        for (const key of ['crust', 'flow', 'pores']) {
            expect(Number.isFinite(surface[key])).toBe(true);
            expect(surface[key]).toBeGreaterThanOrEqual(0);
            expect(surface[key]).toBeLessThanOrEqual(1);
        }
        if (surface.cover < .1 && surface.crust > .6) exposed++;
        if (surface.cover < .1 && surface.pores > .4) pitted++;
        if (surface.cover > .9) {
            ash++;
            expect(surface.pores).toBeLessThan(.2);
        }
    }
    expect(exposed).toBeGreaterThan(30);
    expect(pitted).toBeGreaterThan(30);
    expect(ash).toBeGreaterThan(50);
});

test('fire albedo and packed roughness use the same basalt/ash field', () => {
    const material = createProceduralTerrainMaterial('fire');
    try {
        for (const [x, y] of [[3, 19], [84, 117], [190, 230], [254, 1]]) {
            const surface = sampleElementalTerrain(x, y, 'fire', PROCEDURAL_TERRAIN_DEFINITIONS.fire.seed);
            const offset = (y * 256 + x) * 4;
            expect(Array.from(material.map.image.data.slice(offset, offset + 3))).toEqual(surface.color);
            expect(material.roughnessMap.image.data[offset + 1]).toBe(Math.round(surface.roughness * 255));
        }
    } finally { material.map.dispose(); material.dispose(); }
});

test.each([
    ['fire', '388a58036a4673025f578bd990172defe335f8dbe483fdfb2fd5fc719bf362f4'],
    ['water', '70ca2b639ac2423d5b7a9a343375c94911c58cd4399b51f8143ee92d8d077472']
])('Air refinement retains qualified %s surface fields exactly', (realm, digest) => {
    const samples = [];
    for (let y = 0; y < 256; y += 8) for (let x = 0; x < 256; x += 8) {
        samples.push(sampleElementalTerrain(x, y, realm, PROCEDURAL_TERRAIN_DEFINITIONS[realm].seed));
    }
    expect(createHash('sha256').update(JSON.stringify(samples)).digest('hex')).toBe(digest);
});

test('Moonfrost albedo and roughness share the registered ice/rime field', () => {
    const material = createProceduralTerrainMaterial('water');
    try {
        for (const [x, y] of [[3, 19], [84, 117], [190, 230], [254, 1]]) {
            const surface = sampleElementalTerrain(x, y, 'water', PROCEDURAL_TERRAIN_DEFINITIONS.water.seed);
            const offset = (y * 256 + x) * 4;
            expect(Array.from(material.map.image.data.slice(offset, offset + 3))).toEqual(surface.color);
            expect(material.roughnessMap.image.data[offset + 1]).toBe(Math.round(surface.roughness * 255));
        }
    } finally { material.map.dispose(); material.dispose(); }
});

test('Moonfrost has exposed ice beds and interrupted stress fractures beneath rougher rime', () => {
    let ice = 0, fractures = 0, rime = 0;
    const seed = PROCEDURAL_TERRAIN_DEFINITIONS.water.seed;
    for (let y = 0; y < 256; y += 7) for (let x = 0; x < 256; x += 7) {
        const sample = sampleElementalTerrain(x, y, 'water', seed);
        expect(Number.isFinite(sample.ice)).toBe(true);
        expect(Number.isFinite(sample.fracture)).toBe(true);
        expect(sample.ice).toBeGreaterThanOrEqual(0);
        expect(sample.ice).toBeLessThanOrEqual(1);
        expect(sample.fracture).toBeGreaterThanOrEqual(0);
        expect(sample.fracture).toBeLessThanOrEqual(1);
        if (sample.ice > .65) ice++;
        if (sample.fracture > .2) fractures++;
        if (sample.cover > .8) {
            rime++;
            expect(sample.ice).toBeLessThan(.26);
            expect(sample.roughness).toBeGreaterThan(.86);
        }
    }
    expect(ice).toBeGreaterThan(20);
    expect(fractures).toBeGreaterThan(10);
    expect(rime).toBeGreaterThan(50);
});

test.each(['water', 'fire', 'air'])('%s geology wraps exactly and keeps deposits physically coherent', realm => {
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

test.each(['water', 'fire', 'air'])('%s High/Low use the same relief without extra maps or emissive ground', realm => {
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

test('air slate has directional, broken bedding rather than uncorrelated noise or continuous paving joints', () => {
    const seed = PROCEDURAL_TERRAIN_DEFINITIONS.air.seed;
    let along = 0, across = 0, exposed = 0, weathered = 0;
    for (let y = 0; y < 256; y += 3) for (let x = 0; x < 256; x += 3) {
        const surface = sampleElementalTerrain(x, y, 'air', seed);
        along += Math.abs(surface.strata - sampleElementalTerrain(x + 1, y, 'air', seed).strata);
        across += Math.abs(surface.strata - sampleElementalTerrain(x, y + 1, 'air', seed).strata);
        if (surface.strata > .4) exposed++;
        if (surface.strata < .03) weathered++;
    }
    expect(across).toBeGreaterThan(along * 2);
    expect(exposed).toBeGreaterThan(100); expect(weathered).toBeGreaterThan(100);
});

test('air albedo and packed roughness sample the same slate and scree coverage', () => {
    const material = createProceduralTerrainMaterial('air');
    try {
        for (const [x, y] of [[3, 19], [84, 117], [190, 230], [254, 1]]) {
            const surface = sampleElementalTerrain(x, y, 'air', PROCEDURAL_TERRAIN_DEFINITIONS.air.seed);
            const offset = (y * 256 + x) * 4;
            expect(Array.from(material.map.image.data.slice(offset, offset + 3))).toEqual(surface.color);
            expect(material.roughnessMap.image.data[offset + 1]).toBe(Math.round(surface.roughness * 255));
        }
    } finally { material.map.dispose(); material.dispose(); }
});

test('Air slate has shallow interrupted riven faces without complete paving outlines or raised material hills', () => {
    const seed = PROCEDURAL_TERRAIN_DEFINITIONS.air.seed;
    let fractured = 0, shelteredEdges = 0, faces = 0, minimum = Infinity, maximum = -Infinity;
    for (let y = 0; y < 256; y += 3) for (let x = 0; x < 256; x += 3) {
        const surface = sampleElementalTerrain(x, y, 'air', seed);
        for (const key of ['fracture', 'plate']) {
            expect(Number.isFinite(surface[key])).toBe(true);
            expect(surface[key]).toBeGreaterThanOrEqual(0);
            expect(surface[key]).toBeLessThanOrEqual(1);
        }
        minimum = Math.min(minimum, surface.height); maximum = Math.max(maximum, surface.height);
        if (surface.fracture > .2) fractured++;
        if (surface.plate > .65) faces++;
        if (surface.cover > .9) {
            shelteredEdges++;
            expect(surface.fracture).toBeLessThan(.16);
            expect(surface.plate).toBeLessThan(.27);
        }
    }
    expect(fractured).toBeGreaterThan(50); expect(faces).toBeGreaterThan(100);
    expect(shelteredEdges).toBeGreaterThan(100);
    expect(maximum - minimum).toBeLessThan(.075);
});

test('Air fragment descriptors remain bounded/deterministic when another seed is sampled', () => {
    const seed = PROCEDURAL_TERRAIN_DEFINITIONS.air.seed;
    const initial = sampleElementalTerrain(137.25, 62.75, 'air', seed);
    expect(sampleElementalTerrain(137.25, 62.75, 'air', seed ^ 0x3951)).not.toEqual(initial);
    expect(sampleElementalTerrain(137.25, 62.75, 'air', seed)).toEqual(initial);
    expect(sampleElementalTerrain(137.25 + 256, 62.75 - 256, 'air', seed)).toEqual(initial);
});
