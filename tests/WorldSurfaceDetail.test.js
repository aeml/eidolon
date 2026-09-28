import { MeshStandardMaterial, MeshBasicMaterial, ShaderLib } from 'three';
import { applyWorldSurfaceDetail } from '../src/art/WorldSurfaceDetail.js';

describe('world surface detail', () => {
    test.each(['stone', 'slate', 'timber', 'fieldstone', 'bark'])('%s retains standard lighting and supports transformed instances', surface => {
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
        const keys = ['stone', 'slate', 'timber', 'fieldstone', 'bark'].map(surface =>
            applyWorldSurfaceDetail(new MeshStandardMaterial(), surface).customProgramCacheKey());
        expect(new Set(keys).size).toBe(5);
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
