import * as THREE from 'three';
import { createDarkRealmStreetMaterial, sampleDarkRealmStreet } from '../src/art/DarkRealmStreetSurface.js';
import { createDarkRealmScene } from '../src/art/ProceduralDarkRealm.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { darkRealmFixture } from './darkRealmFixture.js';

test('paving signals remain seamless, finite, nonemissive and physically bounded', () => {
    const colors = [], roughness = [], heights = [];
    let maximumSeamDelta = 0, bounded = true;
    for (let y = 0; y < 79; y++) for (let x = 0; x < 83; x++) {
        const u = x / 83, v = y / 79, a = sampleDarkRealmStreet(u, v);
        const b = sampleDarkRealmStreet(u - 2, v + 3);
        [...a.color, a.height, a.roughness].forEach((n, i) => { maximumSeamDelta = Math.max(maximumSeamDelta, Math.abs(n - [...b.color, b.height, b.roughness][i])); });
        bounded &&= a.height >= 0 && a.height < .025 && a.roughness >= .8 && a.roughness <= .98 &&
            a.color.every(n => Number.isFinite(n) && n >= 49 && n <= 113);
        colors.push(a.color[0]); roughness.push(a.roughness); heights.push(a.height);
    }
    expect(maximumSeamDelta).toBeLessThan(1e-9); expect(bounded).toBe(true);
    expect(Math.max(...colors) - Math.min(...colors)).toBeGreaterThan(15);
    expect(Math.max(...roughness) - Math.min(...roughness)).toBeGreaterThan(.1);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(.015);
});

test.each([['high', 256], ['low', 128]])('%s union floors share one correctly encoded map set and dispose it once', (quality, size) => {
    const scene = new THREE.Group(), root = createDarkRealmScene(scene, darkRealmFixture(), null, { quality });
    const floors = root.children.filter(n => n.name === 'dark-realm-union-floor'), material = floors[0].material;
    expect(new Set(floors.map(n => n.material)).size).toBe(1);
    expect(material.userData.darkRealmStreet).toBe(true); expect(material.emissiveMap).toBeNull();
    expect(material.displacementMap).toBeNull(); expect(material.roughness).toBe(1);
    const calls = [];
    for (const [i, key] of ['map', 'normalMap', 'roughnessMap'].entries()) {
        const texture = material[key]; expect(texture.image.width).toBe(size); expect(texture.image.height).toBe(size);
        expect(texture.colorSpace).toBe(i === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace);
        expect(texture.wrapS).toBe(THREE.RepeatWrapping); expect(texture.wrapT).toBe(THREE.RepeatWrapping);
        expect(texture.generateMipmaps).toBe(true); expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
        let count = 0; texture.addEventListener('dispose', () => count++); calls.push(() => count);
    }
    const normals = material.normalMap.image.data;
    let validNormals = true;
    for (let i = 0; i < normals.length; i += 4) {
        const n = [normals[i], normals[i + 1], normals[i + 2]].map(n => n / 255 * 2 - 1);
        validNormals &&= Math.abs(Math.hypot(...n) - 1) < .005 && n[2] > .98;
    }
    expect(validNormals).toBe(true);
    RenderSystem.prototype.disposeObjectResources.call({}, root);
    expect(calls.map(fn => fn())).toEqual([1, 1, 1]);
});

test('macro weathering compiles at actual far-origin positions without changing geometry', () => {
    const material = createDarkRealmStreetMaterial(), shader = {
        vertexShader: '#include <worldpos_vertex>', fragmentShader: '#include <color_fragment>\n#include <roughnessmap_fragment>'
    };
    material.onBeforeCompile(shader, {});
    expect(shader.vertexShader).toContain('modelMatrix * vec4(transformed, 1.0)');
    expect(shader.fragmentShader).toContain('elementalFloorWeather');
    expect(material.customProgramCacheKey()).toContain('dark_realm');
    expect(material.userData.elementalFloorPatina).toBe('dark_realm');
});
