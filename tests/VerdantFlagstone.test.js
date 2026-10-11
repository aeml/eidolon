import { sampleVerdantFlagstone } from '../src/art/VerdantFlagstone.js';
import { createProceduralDungeonInteriorKit } from '../src/art/ProceduralDungeonInteriors.js';
import * as THREE from 'three';

test('fitted flagstones do not form uninterrupted horizontal or vertical joint courses', () => {
    let maximum = 0;
    for (let line = 0; line < 256; line++) {
        let horizontal = 0, vertical = 0;
        for (let along = 0; along < 256; along++) {
            horizontal += Number(sampleVerdantFlagstone(along / 4, line / 4).bevel < .15);
            vertical += Number(sampleVerdantFlagstone(line / 4, along / 4).bevel < .15);
        }
        maximum = Math.max(maximum, horizontal / 256, vertical / 256);
    }
    expect(maximum).toBeLessThan(.5);
});

test('registered floor maps retain their256px resolution and own a world-space patina without changing wall shaders', () => {
    const kit = createProceduralDungeonInteriorKit('verdant_bastion_catacombs', { quality: 'low' });
    const floor = kit.floorMaterial(24, 24), wall = kit.wallMaterial(24, 24);
    const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    floor.onBeforeCompile(shader, {});
    expect(shader.vertexShader).toContain('vVerdantFloorWorld = (modelMatrix * vec4(transformed, 1.0)).xz');
    expect(shader.fragmentShader).toContain('verdantWeather');
    expect(wall.userData.verdantFloorPatina).toBeUndefined();
    expect(floor.customProgramCacheKey()).not.toBe(wall.customProgramCacheKey());
    for (const key of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) {
        const map = floor[key];
        expect(map.image.width).toBe(256); expect(map.image.height).toBe(256);
        expect(map.wrapS).toBe(THREE.RepeatWrapping); expect(map.wrapT).toBe(THREE.RepeatWrapping);
        expect(map.repeat.toArray()).toEqual([1, 1]);
    }
    expect(floor.displacementMap).toBeNull();
});
