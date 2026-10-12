import * as THREE from 'three';
import { createDarkDistrictRoofMaterial, sampleDarkDistrictRoof, DARK_DISTRICT_ROOF_SPAN } from '../src/art/DarkDistrictRoofMaterial.js';
import { createDarkDistrictArchitectureGeometry } from '../src/art/DarkDistrictArchitectureGeometry.js';
import { createDarkRealmScene } from '../src/art/ProceduralDarkRealm.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { darkRealmFixture } from './darkRealmFixture.js';

test('slate signals wrap seamlessly with finite, bounded physical relief and roughness', () => {
    let maximumDelta = 0, bounded = true;
    const colors = [], heights = [], roughness = [];
    for (let y = 0; y < 79; y++) for (let x = 0; x < 83; x++) {
        const u = x / 83, v = y / 79, a = sampleDarkDistrictRoof(u, v), b = sampleDarkDistrictRoof(u - 2, v + 3);
        const values = s => [...s.color, s.height, s.roughness];
        values(a).forEach((value, i) => { maximumDelta = Math.max(maximumDelta, Math.abs(value - values(b)[i])); });
        bounded &&= values(a).every(Number.isFinite) && a.color.every(n => n >= 36 && n < 100) &&
            a.height >= 0 && a.height <= .02 && a.roughness >= .82 && a.roughness <= .98;
        colors.push(a.color[0]); heights.push(a.height); roughness.push(a.roughness);
    }
    expect(bounded).toBe(true); expect(maximumDelta).toBeLessThan(1e-9);
    expect(Math.max(...colors) - Math.min(...colors)).toBeGreaterThan(35);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(.015);
    expect(Math.max(...roughness) - Math.min(...roughness)).toBeGreaterThan(.10);
    for (const t of [.13, .37, .79]) {
        const a = sampleDarkDistrictRoof(t, 1e-10), b = sampleDarkDistrictRoof(t, 1 - 1e-10);
        expect(Math.abs(a.height - b.height)).toBeLessThan(1e-8);
        expect(Math.max(...a.color.map((n, i) => Math.abs(n - b.color[i])))).toBeLessThan(1e-8);
    }
});

test.each(['shore', 'archive', 'foundry', 'city'])('%s roof UVs retain physical scale and outward tangent orientation on every hip', recipe => {
    const parts = createDarkDistrictArchitectureGeometry(recipe), roof = parts.roof;
    try {
        const p = roof.attributes.position, uv = roof.attributes.uv, n = roof.attributes.normal;
        const a = new THREE.Vector3(), b = a.clone(), c = a.clone();
        for (let i = 0; i < p.count; i += 3) {
            a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
            const e1 = b.clone().sub(a), e2 = c.clone().sub(a);
            const du1 = uv.getX(i + 1) - uv.getX(i), dv1 = uv.getY(i + 1) - uv.getY(i);
            const du2 = uv.getX(i + 2) - uv.getX(i), dv2 = uv.getY(i + 2) - uv.getY(i);
            const determinant = du1 * dv2 - du2 * dv1;
            expect(determinant).toBeGreaterThan(0);
            const tangent = e1.clone().multiplyScalar(dv2).addScaledVector(e2, -dv1).divideScalar(determinant);
            const down = e1.clone().multiplyScalar(-du2).addScaledVector(e2, du1).divideScalar(determinant);
            expect(tangent.length()).toBeCloseTo(DARK_DISTRICT_ROOF_SPAN, 5);
            expect(down.length()).toBeCloseTo(DARK_DISTRICT_ROOF_SPAN, 5);
            expect(Math.abs(tangent.dot(down))).toBeLessThan(1e-5);
            expect(tangent.cross(down).normalize().dot(new THREE.Vector3().fromBufferAttribute(n, i))).toBeGreaterThan(.99999);
            if (n.getY(i) > 0) expect(down.y).toBeLessThan(0);
        }
    } finally { Object.values(parts).forEach(g => g.dispose()); }
});

test.each([['high', 256], ['low', 128]])('%s all district roofs share one scene-owned PBR map set and retire it once', (quality, size) => {
    const root = createDarkRealmScene(new THREE.Group(), darkRealmFixture(), null, { quality });
    const roofs = root.children.filter(n => n.material?.userData.darkDistrictRoof), material = roofs[0].material;
    expect(roofs).toHaveLength(1); expect(roofs[0].geometry.attributes.position.count / 3).toBe(32 * 8);
    expect(material.emissive.getHex()).toBe(0); expect(material.displacementMap).toBeNull();
    const counters = [];
    for (const [i, key] of ['map', 'normalMap', 'roughnessMap'].entries()) {
        const texture = material[key]; expect(texture.image.width).toBe(size); expect(texture.image.height).toBe(size);
        expect(texture.colorSpace).toBe(i === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace);
        expect(texture.wrapS).toBe(THREE.RepeatWrapping); expect(texture.wrapT).toBe(THREE.RepeatWrapping);
        expect(texture.generateMipmaps).toBe(true); expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
        let count = 0; texture.addEventListener('dispose', () => count++); counters.push(() => count);
    }
    const normal = material.normalMap.image.data;
    let valid = true;
    for (let i = 0; i < normal.length; i += 4) {
        const n = [normal[i], normal[i + 1], normal[i + 2]].map(n => n / 255 * 2 - 1);
        valid &&= Math.abs(Math.hypot(...n) - 1) < .007 && n[2] > .96;
    }
    expect(valid).toBe(true);
    RenderSystem.prototype.disposeObjectResources.call({}, root);
    expect(counters.map(fn => fn())).toEqual([1, 1, 1]);
});

test('independent scene owners receive deterministic but separately owned roof maps', () => {
    const a = createDarkDistrictRoofMaterial('low'), b = createDarkDistrictRoofMaterial('low');
    try {
        for (const key of ['map', 'normalMap', 'roughnessMap']) {
            expect(a[key]).not.toBe(b[key]); expect(a[key].image.data).toEqual(b[key].image.data);
        }
    } finally { for (const m of [a, b]) { for (const key of ['map', 'normalMap', 'roughnessMap']) m[key].dispose(); m.dispose(); } }
});
