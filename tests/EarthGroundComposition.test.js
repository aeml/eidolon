import * as THREE from 'three';
import { sampleEarthGround, createEarthCompositionMask, createForestFloorDetail, applyEarthGroundComposition } from '../src/art/EarthGroundComposition.js';
import { EARTH_PATHS } from '../src/data/worldPopulation.js';
import { PROCEDURAL_FOLIAGE_RECIPES, createProceduralFoliagePlacements } from '../src/data/worldFoliage.js';
import { WORLD_REGIONS } from '../src/data/worldGeography.js';

test('forest floor follows actual woodland and leaves worn trail centers clear', () => {
    for (const recipe of PROCEDURAL_FOLIAGE_RECIPES.filter(r => r.region === 'earth')) {
        for (const tree of createProceduralFoliagePlacements(recipe)) {
            const sample = sampleEarthGround(tree.x, tree.z);
            expect(sample.canopy).toBeGreaterThan(.9);
            expect(Object.values(sample).every(v => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
        }
    }
    for (const path of EARTH_PATHS) for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1], b = path.points[i];
        const sample = sampleEarthGround((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        expect(sample.trail).toBe(1);
        expect(sample.canopy).toBeLessThanOrEqual(.1);
        expect(sample.stone).toBeLessThanOrEqual(.15 + Number.EPSILON);
        expect(sample.meadow).toBe(0);
    }
});

test.each([createEarthCompositionMask, createForestFloorDetail])('%p retains world features across quality without color-space distortion', create => {
    const high = create('high'), low = create('low'), duplicate = create('low');
    expect(high.colorSpace).toBe(THREE.NoColorSpace);
    expect(low.image.data).toEqual(duplicate.image.data);
    const hs = high.image.width, ls = low.image.width;
    expect(hs).toBe(ls * 2);
    for (let y = 0; y < ls; y += 11) for (let x = 0; x < ls; x += 13) {
        const a = (y * 2 * hs + x * 2) * 4, b = (y * ls + x) * 4;
        expect(high.image.data.slice(a, a + 4)).toEqual(low.image.data.slice(b, b + 4));
        if (create === createEarthCompositionMask) {
            const region = WORLD_REGIONS.earth;
            const sample = sampleEarthGround(region.minX + x / ls * (region.maxX - region.minX),
                region.minZ + y / ls * (region.maxZ - region.minZ));
            expect(Array.from(low.image.data.slice(b, b + 4)))
                .toEqual([sample.canopy, sample.trail, sample.stone, sample.meadow].map(v => Math.round(v * 255)));
        }
    }
    high.dispose(); low.dispose(); duplicate.dispose();
});

test('bedrock reuses detail alpha for varied plates and narrow fracture seams', () => {
    const texture = createForestFloorDetail('low');
    const heights = [];
    for (let i = 3; i < texture.image.data.length; i += 4) heights.push(texture.image.data[i]);
    const seams = heights.filter(value => value < 32).length;
    expect(seams / heights.length).toBeGreaterThan(.02);
    expect(seams / heights.length).toBeLessThan(.25);
    expect(new Set(heights).size).toBeGreaterThan(100);
    expect(texture.generateMipmaps).toBe(true);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    texture.dispose();
});

test('owns and releases only the two added maps once; leaves ground depth behavior unchanged', () => {
    const shared = new THREE.Texture(), material = new THREE.MeshStandardMaterial({ map: shared });
    applyEarthGroundComposition(material, 'low');
    const { mask, detail } = material.userData.earthGroundComposition;
    const counts = [0, 0, 0];
    [mask, detail, shared].forEach((texture, i) => texture.addEventListener('dispose', () => counts[i]++));
    expect(material.transparent).toBe(false); expect(material.depthWrite).toBe(true);
    expect(material.map).toBe(shared);
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <worldpos_vertex>',
        fragmentShader: '#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>' };
    material.onBeforeCompile(shader);
    expect(shader.uniforms.earthComposition.value).toBe(mask);
    expect(shader.fragmentShader).toContain('#include <normal_fragment_maps>');
    expect(shader.fragmentShader).toContain('normalize(vEarthNormal)');
    expect(shader.fragmentShader).toContain('vEarthGround * .12');
    expect(shader.fragmentShader).toContain('earthStone.a * .028');
    expect(shader.fragmentShader).not.toContain('earthBroad.a * .085');
    expect(shader.vertexShader).not.toContain('transformed.y +=');
    material.dispose(); material.dispose();
    expect(counts).toEqual([1, 1, 0]); shared.dispose();
});
