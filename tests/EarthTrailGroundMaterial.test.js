import { MeshStandardMaterial, RepeatWrapping, NoColorSpace } from 'three';
import { applyLanternholdGateRoad } from '../src/art/LanternholdGateRoad.js';
import { applyEarthTrailGroundMaterial } from '../src/art/EarthTrailGroundMaterial.js';

for (const quality of ['high', 'low']) test(`${quality}: physical trail maps remain independently owned across world sessions`, () => {
    const a = new MeshStandardMaterial(), b = new MeshStandardMaterial();
    for (const material of [a, b]) {
        applyLanternholdGateRoad(material, quality);
        applyEarthTrailGroundMaterial(material, quality);
    }
    const map = a.userData.earthTrailDetail, other = b.userData.earthTrailDetail;
    expect(map.image.width).toBe(quality === 'low' ? 128 : 256);
    expect(map.wrapS).toBe(RepeatWrapping); expect(map.wrapT).toBe(RepeatWrapping);
    expect(map.colorSpace).toBe(NoColorSpace);
    expect(map.image.data).not.toBe(other.image.data);
    expect(map.image.data).toEqual(other.image.data);
    const original = other.image.data[0]; map.image.data[0] ^= 255;
    expect(other.image.data[0]).toBe(original);
    const tracked = [...Object.values(a.userData.gateRoadMaps), map], counts = tracked.map(() => 0);
    tracked.forEach((texture, index) => texture.addEventListener('dispose', () => counts[index]++));
    let otherDisposed = 0; other.addEventListener('dispose', () => otherDisposed++);
    const compile = a.onBeforeCompile, key = a.customProgramCacheKey();
    applyEarthTrailGroundMaterial(a, quality);
    expect(a.onBeforeCompile).toBe(compile); expect(a.customProgramCacheKey()).toBe(key);
    expect(a.userData.earthTrailDetail).toBe(map);
    a.dispose(); a.dispose();
    expect(counts).toEqual(tracked.map(() => 1)); expect(otherDisposed).toBe(0);
    b.dispose(); expect(otherDisposed).toBe(1);
});

test('a non-Earth material cannot silently lose its shader hook to trail detail', () => {
    const material = new MeshStandardMaterial(), hook = () => {};
    material.onBeforeCompile = hook;
    expect(() => applyEarthTrailGroundMaterial(material, 'high')).toThrow('town-gate');
    expect(material.onBeforeCompile).toBe(hook);
    expect(material.userData.earthTrailDetail).toBeUndefined();
    material.dispose();
});
