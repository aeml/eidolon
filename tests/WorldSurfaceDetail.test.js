import { MeshStandardMaterial, MeshBasicMaterial, ShaderLib } from 'three';
import { applyWorldSurfaceDetail } from '../src/art/WorldSurfaceDetail.js';

describe('world surface detail', () => {
    test.each(['stone', 'slate', 'timber', 'fieldstone', 'bark', 'stratified-rock', 'fortress', 'weathered-masonry'])('%s retains standard lighting and supports transformed instances', surface => {
        const material = new MeshStandardMaterial({ roughness: .91 });
        const color = material.color.clone();
        expect(applyWorldSurfaceDetail(material, surface)).toBe(material);
        const shader = { ...ShaderLib.standard };
        material.onBeforeCompile(shader);
        expect(shader.vertexShader).toContain('instanceMatrix * eidolonPosition');
        expect(shader.vertexShader).toContain('batchingMatrix * eidolonPosition');
        expect(shader.vertexShader).toContain('modelMatrix * eidolonPosition');
        expect(shader.fragmentShader).toContain('#include <lights_fragment_begin>');
        expect(shader.fragmentShader).toContain('#include <fog_fragment>');
        expect(shader.fragmentShader).toContain('#include <normal_fragment_maps>');
        expect(shader.fragmentShader).toContain('fwidth(uv / tileSize)');
        expect(material.color).toEqual(color);
        expect(material.roughness).toBe(.91);
        expect(material.map).toBeNull();
        const version = material.version;
        expect(applyWorldSurfaceDetail(material, surface)).toBe(material);
        expect(material.version).toBe(version);
    });

    test('surface variants cannot accidentally reuse one compiled shader', () => {
        const keys = ['stone', 'slate', 'timber', 'fieldstone', 'bark', 'stratified-rock', 'fortress', 'weathered-masonry'].map(surface =>
            applyWorldSurfaceDetail(new MeshStandardMaterial(), surface).customProgramCacheKey());
        expect(new Set(keys).size).toBe(8);
    });

    test('weathered masonry breaks up vertical courses without changing horizontal paving or adding textures', () => {
        const material = applyWorldSurfaceDetail(new MeshStandardMaterial(), 'weathered-masonry');
        const shader = { ...ShaderLib.standard }; material.onBeforeCompile(shader);
        for (const patch of ['#define EIDOLON_SURFACE 8', 'if (axis.y <= max(axis.x, axis.z))',
            'vec2 masonryTileSize = vec2(1.05, .56)', 'float masonryRow = floor(masonryTile.y)',
            'vec2 masonryFootprint = max(fwidth(masonryTile), vec2(.001))',
            'float masonryGrainFade = 1. - smoothstep', 'eidolonReliefNormal(normal, eidolonDetail.z)']) {
            expect({ patch, present: shader.fragmentShader.includes(patch) }).toEqual({ patch, present: true });
        }
        expect(material.customProgramCacheKey()).toBe('eidolon-world-surface-v1:weathered-masonry');
        expect(material.normalMap).toBeNull(); expect(material.roughnessMap).toBeNull();
        expect(material.emissiveIntensity).toBe(1); expect(material.emissive.getHex()).toBe(0);
        material.dispose();
    });

    test('rock mineral detail stays registered across differently oriented faces', () => {
        const material = applyWorldSurfaceDetail(new MeshStandardMaterial(), 'stratified-rock');
        const shader = { ...ShaderLib.standard }; material.onBeforeCompile(shader);
        for (const patch of ['float eidolonRockNoise(vec3 p)', 'eidolonRockNoise(p * 1.6', 'eidolonRockNoise(p * 5.)',
            'vec3 eidolonRockTint(vec3 p)', 'diffuseColor.rgb *= eidolonRockTint(vEidolonSurface)',
            'smoothstep(.35, .85, up)', 'float strata = p.y * .58', 'fade *= smoothstep(.38, .58, cleave)',
            'cleave * .065', 'joint * fade * .012']) {
            // A failure should identify the missing hook, not dump a complete
            // generated GLSL program into every CI log.
            expect({ patch, present: shader.fragmentShader.includes(patch) }).toEqual({ patch, present: true });
        }
        expect(shader.fragmentShader).not.toContain('cleave * 1.8');
        expect(material.customProgramCacheKey()).toBe('eidolon-world-surface-v5:stratified-rock');
    });

    test('rejects invalid usage and protects existing shader customizations', () => {
        expect(() => applyWorldSurfaceDetail(new MeshBasicMaterial(), 'stone')).toThrow(TypeError);
        expect(() => applyWorldSurfaceDetail(new MeshStandardMaterial(), 'lava')).toThrow(TypeError);
        const material = applyWorldSurfaceDetail(new MeshStandardMaterial(), 'stone');
        expect(() => applyWorldSurfaceDetail(material, 'slate')).toThrow('already configured');
        const customized = new MeshStandardMaterial();
        customized.onBeforeCompile = () => {};
        expect(() => applyWorldSurfaceDetail(customized, 'stone')).toThrow('existing shader hook');
    });
});
