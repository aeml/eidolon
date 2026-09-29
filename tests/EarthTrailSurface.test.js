import * as THREE from 'three';
import { sampleEarthTrail, createEarthTrailMaps } from '../src/art/EarthTrailSurface.js';
import { createEarthPathNetwork } from '../src/art/ProceduralWorldPaths.js';

test('trail material wraps every surface channel and keeps soft clear outer edges', () => {
    for (let x = 0; x <= 256; x += 7) for (let y = -256; y <= 256; y += 31) {
        expect(sampleEarthTrail(x, y)).toEqual(sampleEarthTrail(x, y + 256));
    }
    for (let y = 0; y < 256; y += 11) {
        expect(sampleEarthTrail(0, y).alpha).toBe(0);
        expect(sampleEarthTrail(256, y).alpha).toBe(0);
        expect(sampleEarthTrail(128, y).alpha).toBe(215);
        expect(sampleEarthTrail(74, y).roughness).toBeLessThan(sampleEarthTrail(128, y).roughness);
    }
});

test('Low retains registered albedo, normal and roughness features from High', () => {
    const high = createEarthTrailMaps(), low = createEarthTrailMaps('low');
    for (const key of Object.keys(high)) {
        const a = high[key], b = low[key];
        expect(a.colorSpace).toBe(key === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace);
        expect(a.wrapT).toBe(THREE.RepeatWrapping);
        expect(a.generateMipmaps).toBe(true);
        for (let y = 0; y < 128; y += 9) for (let x = 0; x < 128; x += 7) {
            expect(a.image.data.slice((y * 2 * 256 + x * 2) * 4, (y * 2 * 256 + x * 2) * 4 + 4))
                .toEqual(b.image.data.slice((y * 128 + x) * 4, (y * 128 + x) * 4 + 4));
        }
        a.dispose(); b.dispose();
    }
});

test('network owns one shared material and quality-sized maps without changing ground geometry', () => {
    const group = createEarthPathNetwork({ quality: 'low' }), material = group.children[0].material;
    expect(new Set(group.children.map(mesh => mesh.material)).size).toBe(1);
    expect(material.map.image.width).toBe(128);
    expect(material.normalMap.image.width).toBe(128);
    expect(material.depthWrite).toBe(false);
    for (const mesh of group.children) mesh.geometry.dispose();
    for (const key of ['map', 'normalMap', 'roughnessMap']) material[key].dispose();
    material.dispose();
});
