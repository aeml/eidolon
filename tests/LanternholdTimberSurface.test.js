import * as THREE from 'three';
import { sampleLanternholdTimber, mapLanternholdTimberUV, LANTERNHOLD_TIMBER_SPAN } from '../src/art/LanternholdTimberSurface.js';
import { createLanternholdNeighborhood } from '../src/art/LanternholdNeighborhood.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

test('wood has continuous periodic color, shallow relief and varied roughness', () => {
    const samples = Array.from({ length: 1024 }, (_, i) => sampleLanternholdTimber(i % 32 / 32, Math.floor(i / 32) / 32));
    expect(Math.max(...samples.map(s => s.color[0])) - Math.min(...samples.map(s => s.color[0]))).toBeGreaterThan(18);
    expect(Math.max(...samples.map(s => s.height)) - Math.min(...samples.map(s => s.height))).toBeGreaterThan(.001);
    expect(samples.every(s => s.color.every(c => c > 0 && c < 255) && s.roughness >= .8 && s.roughness <= 1 && Math.abs(s.height) < .003)).toBe(true);
    for (const t of [.17, .43, .71]) for (const axis of [0, 1]) {
        const a = axis ? sampleLanternholdTimber(t, 1e-10) : sampleLanternholdTimber(1e-10, t);
        const b = axis ? sampleLanternholdTimber(t, 1 - 1e-10) : sampleLanternholdTimber(1 - 1e-10, t);
        expect(Math.max(...a.color.map((c, i) => Math.abs(c - b.color[i])))).toBeLessThan(1e-6);
        expect(Math.abs(a.height - b.height)).toBeLessThan(1e-8);
        expect(Math.abs(a.roughness - b.roughness)).toBeLessThan(1e-8);
    }
});

test.each([[.48, 3.1, .16], [6.1, .22, .24], [.24, .22, 5.1]])('physical grain coordinates keep tangent handedness on %j construction', (...size) => {
    const geometry = new THREE.BoxGeometry(...size).toNonIndexed(), scale = 1.3;
    const original = geometry.attributes.position.array.slice();
    mapLanternholdTimberUV(geometry, scale, [1.7, .4, -2.1]);
    const { position, normal, uv } = geometry.attributes;
    for (let i = 0; i < position.count; i += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(position, i), b = new THREE.Vector3().fromBufferAttribute(position, i + 1), c = new THREE.Vector3().fromBufferAttribute(position, i + 2);
        const e1 = b.sub(a), e2 = c.sub(a), du1 = uv.getX(i + 1) - uv.getX(i), dv1 = uv.getY(i + 1) - uv.getY(i);
        const du2 = uv.getX(i + 2) - uv.getX(i), dv2 = uv.getY(i + 2) - uv.getY(i), determinant = du1 * dv2 - du2 * dv1;
        expect(determinant).toBeGreaterThan(0);
        const across = e1.clone().multiplyScalar(dv2).addScaledVector(e2, -dv1).divideScalar(determinant);
        const along = e1.clone().multiplyScalar(-du2).addScaledVector(e2, du1).divideScalar(determinant);
        expect(across.length() * scale).toBeCloseTo(LANTERNHOLD_TIMBER_SPAN[0], 4);
        expect(along.length() * scale).toBeCloseTo(LANTERNHOLD_TIMBER_SPAN[1], 4);
        expect(across.cross(along).normalize().dot(new THREE.Vector3().fromBufferAttribute(normal, i))).toBeGreaterThan(.99999);
    }
    expect(position.array).toEqual(original); geometry.dispose();
});

test.each([['high', 256, false], ['low', 128, true]])('%s homes retain six batches and retire their shared map set once', (quality, size, perInstanceFrustum) => {
    const a = createLanternholdNeighborhood(0, 200, { quality, perInstanceFrustum }), b = createLanternholdNeighborhood(0, 200, { quality, perInstanceFrustum });
    const timber = a.children.find(m => m.name === 'residential-shacks:timber').material, frame = a.children.find(m => m.name === 'residential-shacks:frame').material;
    expect(a.children).toHaveLength(6); expect(a.userData.walkFootprints).toHaveLength(15);
    const counts = [];
    for (const [i, key] of ['map', 'normalMap', 'roughnessMap'].entries()) {
        const map = timber[key]; expect(frame[key]).toBe(map);
        expect(map.image.width).toBe(size); expect(map.image.height).toBe(size);
        expect(map.colorSpace).toBe(i === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace);
        expect(map.wrapS).toBe(THREE.RepeatWrapping); expect(map.wrapT).toBe(THREE.RepeatWrapping);
        expect(map.generateMipmaps).toBe(true); expect(map.minFilter).toBe(THREE.LinearMipmapLinearFilter);
        const other = b.children.find(m => m.name === 'residential-shacks:timber').material[key];
        expect(other).not.toBe(map); expect(Buffer.from(other.image.data).equals(Buffer.from(map.image.data))).toBe(true);
        const count = { n: 0 }; map.addEventListener('dispose', () => count.n++); counts.push(count);
    }
    const normals = timber.normalMap.image.data;
    let valid = true;
    for (let i = 0; i < normals.length; i += 4) {
        const n = [normals[i], normals[i + 1], normals[i + 2]].map(x => x / 255 * 2 - 1);
        valid &&= Math.abs(Math.hypot(...n) - 1) < .007 && n[2] > .96;
    }
    expect(valid).toBe(true);
    for (const m of [timber, frame]) { expect(m.emissive.getHex()).toBe(0); expect(m.displacementMap).toBeNull(); }
    RenderSystem.prototype.disposeObjectResources.call({}, a); expect(counts.map(c => c.n)).toEqual([1, 1, 1]);
    RenderSystem.prototype.disposeObjectResources.call({}, b);
});
