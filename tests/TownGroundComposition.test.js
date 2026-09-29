import * as THREE from 'three';
import { createTownCompositionMask, sampleLanternholdGround } from '../src/art/TownGroundComposition.js';
import { createProceduralTerrainMaterial } from '../src/art/ProceduralRealmTerrain.js';

test('connected town surfaces retain paved service courts and gates, with unpaved quiet edges', () => {
    for (const [x, z] of [[0, 100], [0, 300], [-100, 200], [100, 200], [0, 200],
        [-16, 193], [0, 182], [-55, 238], [55, 240], [40, 222], [-40, 229]]) {
        expect(sampleLanternholdGround(x, z).paving).toBeGreaterThan(.85);
    }
    for (const [x, z] of [[-80, 120], [80, 280], [-80, 280], [70, 150]]) {
        expect(sampleLanternholdGround(x, z).paving).toBeLessThan(.05);
    }
    // The north route goes around, not through, the casino shell.
    expect(sampleLanternholdGround(0, 166).paving).toBe(0);
    expect(sampleLanternholdGround(23, 166).paving).toBeGreaterThan(.9);
});

test('mask is deterministic, linear and registered between qualities', () => {
    const high = createTownCompositionMask(), duplicate = createTownCompositionMask(), low = createTownCompositionMask('low');
    expect(high.image.data).toEqual(duplicate.image.data);
    expect(high.colorSpace).toBe(THREE.NoColorSpace);
    expect(high.image.data.byteLength).toBe(256 * 256 * 4);
    expect(low.image.data.byteLength).toBe(128 * 128 * 4);
    for (let y = 0; y < 128; y += 9) for (let x = 0; x < 128; x += 9) {
        expect(low.image.data.slice((y * 128 + x) * 4, (y * 128 + x) * 4 + 4))
            .toEqual(high.image.data.slice((y * 2 * 256 + x * 2) * 4, (y * 2 * 256 + x * 2) * 4 + 4));
    }
    for (const texture of [high, duplicate, low]) texture.dispose();
});

test('town composition preserves depth, geometry and shared albedo ownership', () => {
    const material = createProceduralTerrainMaterial('town', { quality: 'low' });
    const { mask, soilTexture } = material.userData.townGroundComposition;
    const calls = { mask: 0, soil: 0, albedo: 0 };
    mask.addEventListener('dispose', () => calls.mask++);
    soilTexture.addEventListener('dispose', () => calls.soil++);
    material.map.addEventListener('dispose', () => calls.albedo++);
    expect(material.transparent).toBe(false); expect(material.depthWrite).toBe(true);
    expect(material.polygonOffset).toBe(false);
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    material.onBeforeCompile(shader);
    expect(shader.uniforms.townComposition.value).toBe(mask);
    expect(shader.fragmentShader).toContain('mix(townEarth, diffuseColor.rgb, townWear.r)');
    expect(shader.fragmentShader).toContain('mix(townFlatNormal, normal, townWear.r)');
    expect(shader.vertexShader).not.toContain('transformed +=');
    material.dispose(); material.dispose();
    expect(calls).toEqual({ mask: 1, soil: 1, albedo: 0 });
    material.map.dispose();
});
