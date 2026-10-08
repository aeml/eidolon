import { MeshBasicMaterial, MeshStandardMaterial, ShaderLib } from 'three';
import { applyWoodlandBarkDetail } from '../src/art/WoodlandBarkMaterial.js';
import { getProceduralFoliageArchetype } from '../src/art/ProceduralRealmFoliage.js';

test.each(['birch', 'pine', 'willow'])('%s bark retains standard lighting/opacity and separates color, roughness and normal relief', style => {
    const material = new MeshStandardMaterial({ color: 0x504435, roughness: .92 });
    const original = { color: material.color.getHex(), roughness: material.roughness };
    expect(applyWoodlandBarkDetail(material, style)).toBe(material);
    const shader = { ...ShaderLib.standard };
    material.onBeforeCompile(shader);
    for (const marker of ['eidolonBarkSurface(vEidolonBarkUV)', 'diffuseColor.rgb *= eidolonBark.x', 'eidolonBark.y',
        'eidolonBarkReliefNormal(normal, eidolonBark.z)', '#include <lights_fragment_begin>', '#include <fog_fragment>',
        'cos(angle)', 'sin(angle)', 'fwidth(ridgePhase)', 'fwidth(scarPhase)']) {
        expect({ marker, present: shader.fragmentShader.includes(marker) }).toEqual({ marker, present: true });
    }
    expect(shader.vertexShader).toContain('vEidolonBarkUV = uv;');
    expect({ color: material.color.getHex(), roughness: material.roughness }).toEqual(original);
    expect(material.transparent).toBe(false); expect(material.opacity).toBe(1);
    for (const map of ['map', 'normalMap', 'roughnessMap', 'bumpMap']) expect(material[map]).toBeNull();
    const version = material.version, hook = material.onBeforeCompile;
    applyWoodlandBarkDetail(material, style);
    expect(material.version).toBe(version); expect(material.onBeforeCompile).toBe(hook);
});

test('tree styles cannot alias shader programs or replace another hook', () => {
    const keys = ['birch', 'pine', 'willow'].map(style => applyWoodlandBarkDetail(new MeshStandardMaterial(), style).customProgramCacheKey());
    expect(new Set(keys).size).toBe(3);
    expect(() => applyWoodlandBarkDetail(new MeshBasicMaterial(), 'birch')).toThrow(TypeError);
    expect(() => applyWoodlandBarkDetail(new MeshStandardMaterial(), 'unknown')).toThrow(TypeError);
    const material = new MeshStandardMaterial(); material.onBeforeCompile = () => {};
    expect(() => applyWoodlandBarkDetail(material, 'birch')).toThrow('existing shader hook');
    const configured = applyWoodlandBarkDetail(new MeshStandardMaterial(), 'birch');
    expect(() => applyWoodlandBarkDetail(configured, 'pine')).toThrow('existing shader hook');
});

test.each([['ossuary_birch', 'birch'], ['grave_pine', 'pine'], ['mourning_willow', 'willow']])('%s assigns only its stem the correct bark without changing shadows or geometry UVs', (id, style) => {
    const parts = getProceduralFoliageArchetype(id), stem = parts[0];
    expect(stem.material.userData.woodlandBark).toBe(style);
    expect(stem.geometry.attributes.uv.count).toBe(stem.geometry.attributes.position.count);
    expect(stem.geometry.attributes.uv.array.every(Number.isFinite)).toBe(true);
    expect(stem.castShadow).toBe(true); expect(stem.receiveShadow).toBe(true);
    for (const part of parts.slice(1)) expect(part.material.userData.woodlandBark).toBeUndefined();
});
