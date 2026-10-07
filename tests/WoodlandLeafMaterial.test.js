import { MeshBasicMaterial, MeshStandardMaterial, ShaderChunk, ShaderLib } from 'three';
import { getProceduralFoliageArchetype } from '../src/art/ProceduralRealmFoliage.js';
import { applyWoodlandLeafDetail } from '../src/art/WoodlandLeafMaterial.js';

test('leaf customization preserves every upstream lighting operation except the diffuse response', () => {
    const shader = { ...ShaderLib.standard };
    applyWoodlandLeafDetail(new MeshStandardMaterial()).onBeforeCompile(shader);
    const upstream = ShaderChunk.lights_physical_pars_fragment;
    const start = shader.fragmentShader.indexOf(upstream.slice(0, 80));
    const endMarker = upstream.slice(-80);
    const end = shader.fragmentShader.indexOf(endMarker, start) + endMarker.length;
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const patchedLighting = shader.fragmentShader.slice(start, end);
    const originalDiffuse = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
    const normalized = patchedLighting.replace(/\s*float eidolonLeafDot =[^]*?reflectedLight\.directDiffuse \+= eidolonLeafLight[^;]+;/,
        `\n\t${originalDiffuse}`);
    // Compare tokens, not injected indentation; report a bounded error rather
    // than dumping the complete upstream shader into deployment logs.
    expect({ unchangedOtherLighting: normalized.replace(/\s+/g, ' ').trim() === upstream.replace(/\s+/g, ' ').trim() })
        .toEqual({ unchangedOtherLighting: true });
});

test('leaf detail is idempotent and cannot replace another material customization', () => {
    const material = new MeshStandardMaterial();
    expect(applyWoodlandLeafDetail(material)).toBe(material);
    const version = material.version, hook = material.onBeforeCompile;
    expect(applyWoodlandLeafDetail(material)).toBe(material);
    expect(material.version).toBe(version);
    expect(material.onBeforeCompile).toBe(hook);
    expect(material.customProgramCacheKey()).toBe('eidolon-woodland-leaf-v1');
    expect(() => applyWoodlandLeafDetail(new MeshBasicMaterial())).toThrow(TypeError);
    const customized = new MeshStandardMaterial(); customized.onBeforeCompile = () => {};
    expect(() => applyWoodlandLeafDetail(customized)).toThrow('existing shader hook');
});

test.each(['ossuary_birch', 'mourning_willow'])('%s uses shadow-aware thin-leaf shading without transparency or extra textures', id => {
    const parts = getProceduralFoliageArchetype(id).filter(part => part.geometry.userData.woodlandCrown === 'leaf');
    expect(parts.length).toBeGreaterThan(0);
    for (const part of parts) {
        const { material } = part;
        expect(material.userData.woodlandLeafDetail).toBe(true);
        const shader = { ...ShaderLib.standard };
        material.onBeforeCompile(shader);
        for (const marker of ['eidolonLeafVeins', 'directLight.color * BRDF_Lambert', '#include <lights_fragment_begin>', '#include <fog_fragment>']) {
            expect({ marker, present: shader.fragmentShader.includes(marker) }).toEqual({ marker, present: true });
        }
        expect(shader.vertexShader.includes('vEidolonLeafUV = uv')).toBe(true);
        expect(material.transparent).toBe(false);
        expect(material.opacity).toBe(1);
        expect(material.alphaTest).toBe(0);
        expect(material.map).toBeNull();
        expect(material.emissive.getHex()).toBe(0);
        expect(part.castShadow).toBe(true);
        expect(part.receiveShadow).toBe(true);
    }
});
