import * as THREE from 'three';
import { getEquipmentSurfaceMaps } from '../src/art/EquipmentSurfaceMaps.js';
import { createProceduralEquipmentVisual } from '../src/art/ProceduralEquipment.js';

test.each(['cloth', 'leather', 'metal', 'wood'])('%s has bounded shared, mip-filtered material maps', surface => {
    const maps = getEquipmentSurfaceMaps(surface);
    expect(getEquipmentSurfaceMaps(surface)).toBe(maps);
    expect(Object.isFrozen(maps)).toBe(true);
    expect(maps.bumpScale).toBeLessThanOrEqual(.006);
    let bytes = 0;
    for (const key of ['map', 'roughnessMap', 'bumpMap']) {
        const texture = maps[key]; bytes += texture.image.data.byteLength;
        expect(texture.image.width).toBe(64); expect(texture.image.height).toBe(64);
        expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
        expect(texture.wrapS).toBe(THREE.RepeatWrapping); expect(texture.wrapT).toBe(THREE.RepeatWrapping);
        expect(texture.generateMipmaps).toBe(true);
        expect(texture.colorSpace).toBe(key === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace);
        expect(new Set(texture.image.data.filter((_, i) => i % 4 === 0)).size).toBeGreaterThan(10);
    }
    expect(bytes).toBe(49152);
});

test('invalid surface names do not grow a fallback cache', () => {
    expect(() => getEquipmentSurfaceMaps('plastic')).toThrow(TypeError);
});

test('batching and appearance material clones retain the same surfaces without texturing rarity sigils', () => {
    const item = { id: 'robes', baseName: 'Robes', level: 30, rarity: 'Uncommon' };
    const original = createProceduralEquipmentVisual(item), batched = createProceduralEquipmentVisual(item, {batch: true});
    const material = original.getObjectByName('Gear_Torso').material;
    expect(batched.getObjectByName('Gear_Torso').material).toBe(material);
    const copy = material.clone();
    expect(copy.map).toBe(material.map); expect(copy.bumpMap).toBe(material.bumpMap);
    expect(copy.roughnessMap).toBe(material.roughnessMap);
    expect(original.getObjectByName('Gear_RobeStole').material.metalness).toBe(.02);
    expect(original.getObjectByName('Gear_ChestSigil').material.map).toBeNull();
    copy.dispose();
    expect(getEquipmentSurfaceMaps('cloth').map).toBe(material.map);
});
