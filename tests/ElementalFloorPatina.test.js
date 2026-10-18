import { createHash } from 'node:crypto';
import { MeshStandardMaterial, Material } from 'three';
import { createProceduralDungeonInteriorKit } from '../src/art/ProceduralDungeonInteriors.js';
import { applyElementalFloorPatina } from '../src/art/ElementalFloorPatina.js';
import { sampleElementalDungeonSurface } from '../src/art/ElementalDungeonSurface.js';

const families = ['molten_core', 'tempest_spire', 'abyssal_well', 'umbral_nexus'];
const palette = { shadow: [7, 19, 27], ground: [16, 43, 55], midtone: [44, 72, 86], accent: [90, 190, 220] };

test.each(families)('%s keeps floor mineral albedo readable without brightening its inscriptions', type => {
    let minimum = Infinity, maximum = 0;
    for (let y = 0; y < 64; y += 2) for (let x = 0; x < 64; x += 2) {
        const sample = sampleElementalDungeonSurface(x, y, type, false, palette);
        minimum = Math.min(minimum, ...sample.color); maximum = Math.max(maximum, ...sample.color);
        expect(sample.emissive).toBeLessThanOrEqual(.025);
    }
    expect(minimum).toBeGreaterThan(45);
    expect(maximum).toBeLessThan(132);
});

test('every High/Low wall retains the qualified mineral maps without floor patina', () => {
    const digest = createHash('sha256');
    for (const type of families) for (const quality of ['high', 'low']) {
        const wall = createProceduralDungeonInteriorKit(type, { quality }).wallMaterial(24, 24);
        for (const key of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) digest.update(wall[key].image.data);
        expect(wall.onBeforeCompile).toBe(Material.prototype.onBeforeCompile);
        expect(wall.userData.elementalFloorPatina).toBeUndefined();
    }
    // Wall albedo was deliberately qualified at 2f9e3f783; the floor shader
    // must leave those maps and the wall's ordinary shader hook intact.
    expect(digest.digest('hex')).toBe('ae2f04d600534bece9ecb1522cb78f5aca56adcc14cbccc22da79444995727c8');
});

test('floor variants share existing maps and stay distinct from each other and Verdant', () => {
    const keys = new Set();
    for (const type of families) for (const quality of ['high', 'low']) {
        const kit = createProceduralDungeonInteriorKit(type, { quality });
        const floor = kit.floorMaterial(24, 24), larger = kit.floorMaterial(48, 48);
        expect(kit.floorMaterial(24, 24)).toBe(floor);
        expect(floor.userData.elementalFloorPatina).toBe(type);
        expect(floor.customProgramCacheKey()).toBe(larger.customProgramCacheKey());
        for (const key of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) expect(floor[key].image).toBe(larger[key].image);
        expect(kit.metrics().surfaceTextures).toBe(8);
        keys.add(floor.customProgramCacheKey());
    }
    expect(keys.size).toBe(4);
    const verdant = createProceduralDungeonInteriorKit('verdant_bastion_catacombs').floorMaterial(24, 24);
    expect(verdant.userData.verdantFloorPatina).toBe(true);
    expect(verdant.userData.elementalFloorPatina).toBeUndefined();
    expect(keys.has(verdant.customProgramCacheKey())).toBe(false);
});

test('an unsupported family fails before changing material ownership or shader hooks', () => {
    const material = new MeshStandardMaterial(), before = material.onBeforeCompile, key = material.customProgramCacheKey;
    expect(() => applyElementalFloorPatina(material, 'missing')).toThrow(TypeError);
    expect(material.onBeforeCompile).toBe(before); expect(material.customProgramCacheKey).toBe(key);
    expect(material.userData).toEqual({});
});
