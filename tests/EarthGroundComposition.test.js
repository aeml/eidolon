import * as THREE from 'three';
import { sampleEarthGround, sampleEarthMeadow, createEarthCompositionMask, createForestFloorDetail, applyEarthGroundComposition } from '../src/art/EarthGroundComposition.js';
import { EARTH_PATHS } from '../src/data/worldPopulation.js';
import { PROCEDURAL_FOLIAGE_RECIPES, createProceduralFoliagePlacements } from '../src/data/worldFoliage.js';
import { WORLD_REGIONS } from '../src/data/worldGeography.js';

test('Bastion meadow shoulders share the plant field while all junction surfaces remain worn', () => {
    for (const x of [260, 340, 420, 620, 700]) {
        const cover = sampleEarthMeadow(x, 212), ground = sampleEarthGround(x, 212);
        expect(cover).toBeGreaterThan(.45);
        expect(ground.meadow).toBeGreaterThan(.2);
        expect(ground.meadow).toBeLessThanOrEqual(cover);
        expect(sampleEarthGround(x, 200).meadow).toBe(0);
    }
    // The southbound milestone path takes priority over the new meadow field.
    expect(sampleEarthGround(520, 212).meadow).toBe(0);
    for (const x of [189.999, 190, 225, 755, 790, 790.001]) {
        const before = sampleEarthMeadow(x - .001, 212), after = sampleEarthMeadow(x + .001, 212);
        expect(Number.isFinite(before) && Number.isFinite(after)).toBe(true);
        expect(Math.abs(before - after)).toBeLessThan(.001);
    }
});

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

test.each(['high', 'low'])('soil aggregates retain coherent detail without a tile-edge jump (%s)', quality => {
    const texture = createForestFloorDetail(quality);
    const { data, width: size } = texture.image;
    const at = (x, y) => data[(y * size + x % size) * 4];
    let nearby = 0, separated = 0, seam = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        nearby += Math.abs(at(x, y) - at(x + 1, y));
        separated += Math.abs(at(x, y) - at(x + size / 8, y));
        if (x === size - 1) seam += Math.abs(at(x, y) - at(0, y));
    }
    // Uncorrelated texel noise fails this: adjacent and distant differences
    // are comparable, so the field disappears into its mean when minified.
    expect(nearby).toBeLessThan(separated * .7);
    expect(seam / size).toBeLessThan(nearby / (size * size) * 1.5);
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
    expect(shader.fragmentShader).toContain('vEarthGround * .74');
    expect(shader.fragmentShader).toContain('vEarthGround * 1.73');
    // Ordinary soil has relief even when canopy, mineral and meadow masks
    // are zero; keep it distinct from the optional forest/rock contributions.
    expect(shader.fragmentShader).toContain('(earthClod * .022 + earthPore * .006) * (1. - earthRock)');
    expect(material.customProgramCacheKey()).toBe('eidolon-earth-ground-composition-v8');
    expect(shader.fragmentShader).not.toContain('earthBroad.a * .085');
    expect(shader.vertexShader).not.toContain('transformed.y +=');
    material.dispose(); material.dispose();
    expect(counts).toEqual([1, 1, 0]); shared.dispose();
});

test.each(['high', 'low'])('ground layers retain registered relief and filtered material boundaries without another map (%s)', quality => {
    const material = new THREE.MeshStandardMaterial();
    applyEarthGroundComposition(material, quality);
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <worldpos_vertex>',
        fragmentShader: '#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>' };
    material.onBeforeCompile(shader);
    expect(Object.keys(shader.uniforms).sort()).toEqual(['earthBounds', 'earthComposition', 'earthDetail']);
    expect(shader.fragmentShader).toContain('earthGrain.r * .72 + earthGrit * .28');
    expect(shader.fragmentShader).toContain('fwidth(earthMossHeight)');
    expect(shader.fragmentShader).toContain('earthWear.a * (1. - earthWear.a)');
    expect(shader.fragmentShader).toContain('earthMossCoverage');
    expect(shader.fragmentShader).toContain('earthLeafCoverage');
    // The same coverage owns color, roughness and relief. A painted brighter
    // leaf must not remain a flat soil normal or borrow a separate random mask.
    expect(shader.fragmentShader.match(/earthLeafCoverage/g).length).toBeGreaterThanOrEqual(4);
    expect(shader.fragmentShader).toContain('earthMossCoverage * earthMoss * .012');
    expect(shader.vertexShader).not.toContain('transformed.y +=');
    const { mask, detail } = material.userData.earthGroundComposition;
    expect(mask.image.width).toBe(quality === 'low' ? 256 : 512);
    expect(detail.image.width).toBe(quality === 'low' ? 128 : 256);
    expect(material.transparent).toBe(false);
    expect(material.emissiveIntensity).toBe(1); // Default black emissive, not added light.
    expect(material.emissive.getHex()).toBe(0);
    material.dispose();
});
