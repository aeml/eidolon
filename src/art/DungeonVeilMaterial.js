import * as THREE from 'three';

// A dark aperture with slow, layered currents, rather than a uniformly
// emissive disc. UV space survives entrance batching; no extra render target,
// texture or transparent layer is needed. StandardMaterial retains fog and
// vViewPosition for the landmark's hero cutaway shader.
export function createDungeonVeilMaterial(color) {
    const time = { value: 0 };
    const tint = { value: new THREE.Color(color) };
    const material = new THREE.MeshStandardMaterial({
        color: 0x070b0d, roughness: 1, envMapIntensity: 0,
        side: THREE.DoubleSide
    });
    material.defines = { ...material.defines, USE_UV: '' };
    material.userData.dungeonVeilTime = time;
    material.onBeforeCompile = shader => {
        shader.uniforms.dungeonVeilTime = time;
        shader.uniforms.dungeonVeilTint = tint;
        shader.fragmentShader = `
            uniform float dungeonVeilTime;
            uniform vec3 dungeonVeilTint;
            float veilHash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }
            float veilNoise(vec2 p) {
                vec2 cell = floor(p), f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(veilHash(cell), veilHash(cell + vec2(1, 0)), f.x),
                    mix(veilHash(cell + vec2(0, 1)), veilHash(cell + vec2(1, 1)), f.x), f.y);
            }
            float veilCloud(vec2 p) {
                return veilNoise(p) * .57 + veilNoise(p * 2.03 + 11.7) * .29
                    + veilNoise(p * 4.09 - 5.3) * .14;
            }
        ${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
            #include <emissivemap_fragment>
            vec2 veilPoint = vUv * 2.0 - 1.0;
            float veilRadius = length(veilPoint);
            float veilClock = dungeonVeilTime * .12;
            float veilFront = veilCloud(veilPoint * 3.8 + vec2(veilClock, -veilClock * .6));
            float veilBack = veilCloud(veilPoint * 6.1 + vec2(-veilClock * .4, veilClock * .3));
            float veilDepth = smoothstep(.12, .86, veilRadius);
            float veilRim = exp(-abs(veilRadius - .88 - (veilFront - .5) * .09) * 38.0);
            float veilMist = smoothstep(.38, .79, veilFront) * (.3 + veilBack * .7);
            float veilEdge = 1.0 - smoothstep(.93, 1.0, veilRadius);
            totalEmissiveRadiance += dungeonVeilTint * veilEdge *
                (.012 + veilDepth * veilMist * .24 + veilRim * (.12 + veilBack * .26));
        `);
    };
    material.customProgramCacheKey = () => 'dungeon-veil-v1';
    return material;
}
