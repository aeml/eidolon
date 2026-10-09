import * as THREE from 'three';
import { createTownCompositionMask, sampleLanternholdGround } from '../src/art/TownGroundComposition.js';
import { createProceduralTerrainMaterial } from '../src/art/ProceduralRealmTerrain.js';
import { createLanternholdCampPlacements } from '../src/art/ProceduralLanternholdArchitecture.js';

test('compacted camp ground follows tent entrances and their real rotated hearth paths', () => {
    for (const camp of createLanternholdCampPlacements(0, 200)) {
        const point = (x, z) => [camp.x + Math.cos(camp.rotation) * x + Math.sin(camp.rotation) * z,
            camp.z - Math.sin(camp.rotation) * x + Math.cos(camp.rotation) * z];
        for (const local of [[-.55, -.45], [-.55, 1.02], [.9, 1.46], [2.35, 1.9]]) {
            const sample = sampleLanternholdGround(...point(...local));
            expect(sample.campTraffic).toBe(1);
            expect(sample.traffic).toBeGreaterThanOrEqual(.72);
            expect(sample.damp).toBeLessThanOrEqual(.28 * .6);
        }
        expect(sampleLanternholdGround(...point(-3.5, -3.5)).campTraffic).toBe(0);
        expect(sampleLanternholdGround(...point(4.35, 1.9)).campTraffic).toBe(0);
    }
    for (const [x, z] of [[0, 200], [-28, 210], [0, 182], [23, 166]])
        expect(sampleLanternholdGround(x, z).campTraffic).toBe(0);
});

test('charcoal wear follows every actual rotated camp hearth and leaves service paths unchanged', () => {
    const camps = createLanternholdCampPlacements(0, 200);
    for (const camp of camps) {
        const point = (x, z) => [camp.x + Math.cos(camp.rotation) * x + Math.sin(camp.rotation) * z,
            camp.z - Math.sin(camp.rotation) * x + Math.cos(camp.rotation) * z];
        expect(sampleLanternholdGround(...point(2.35, 1.9)).hearth).toBe(1);
        expect(sampleLanternholdGround(...point(-.55, -.45)).hearth).toBe(0);
        expect(sampleLanternholdGround(...point(4.35, 1.9)).hearth).toBe(0);
    }
    for (const [x, z] of [[0, 200], [-28, 210], [0, 182], [23, 166]])
        expect(sampleLanternholdGround(x, z).hearth).toBe(0);
});

test('connected town surfaces retain paved service courts and gates, with unpaved quiet edges', () => {
    for (const [x, z] of [[0, 100], [0, 300], [-100, 200], [100, 200], [0, 200],
        [-28, 210], [0, 182], [-55, 238], [55, 240], [40, 222], [-40, 229]]) {
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
    const { mask, soilTexture, paving } = material.userData.townGroundComposition;
    const calls = { mask: 0, soil: 0, albedo: 0, court: 0, surface: 0 };
    paving.color.addEventListener('dispose', () => calls.court++);
    paving.surface.addEventListener('dispose', () => calls.surface++);
    mask.addEventListener('dispose', () => calls.mask++);
    soilTexture.addEventListener('dispose', () => calls.soil++);
    material.map.addEventListener('dispose', () => calls.albedo++);
    expect(material.transparent).toBe(false); expect(material.depthWrite).toBe(true);
    expect(material.polygonOffset).toBe(false);
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    material.onBeforeCompile(shader);
    expect(shader.uniforms.townComposition.value).toBe(mask);
    expect(shader.uniforms.townCourt.value).toBe(paving.color);
    expect(material.customProgramCacheKey()).toBe('eidolon-town-ground-composition-v3');
    expect(shader.fragmentShader).toContain('vec4 townWear = texture2D(townComposition');
    expect(shader.fragmentShader).toContain('vec3(.48, .44, .40), townWear.a');
    expect(shader.fragmentShader).toContain('mix(townEarth, diffuseColor.rgb, townWear.r)');
    expect(shader.fragmentShader).toContain('mix(townFlatNormal, normal, townWear.r)');
    expect(shader.vertexShader).not.toContain('transformed +=');
    material.dispose(); material.dispose();
    expect(calls).toEqual({ mask: 1, soil: 1, albedo: 0, court: 1, surface: 1 });
    material.map.dispose();
});
