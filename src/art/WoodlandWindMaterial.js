import * as THREE from 'three';

// Maximum local-space displacement, including the small leaf flutter. The
// largest (1.4x) plant still fits its existing 2.2m clearance envelope.
export const WOODLAND_WIND_REACH = .22;

const windShader = `
uniform float woodlandTime;
uniform float woodlandMotion;
vec2 woodlandBend() {
    vec3 anchor = vec3(0.);
    vec2 direction = normalize(vec2(.86, .5));
    #ifdef USE_INSTANCING
        anchor = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
        // Rotate the common breeze into each randomly rotated plant's local
        // frame. Uniform instance scale is retained by the ordinary pipeline.
        direction = vec2(dot(normalize(instanceMatrix[0].xz), direction),
                         dot(normalize(instanceMatrix[2].xz), direction));
    #endif
    float phase = dot(anchor.xz, vec2(.09, .055));
    float gust = .65 + .35 * sin(woodlandTime * .3141592654 - phase * .3);
    float sway = .20 * gust * sin(woodlandTime * 1.2566370614 - phase);
    float flutter = .02 * sin(woodlandTime * 3.7699111843 + phase * 2.7);
    return direction * (sway + flutter) * woodlandMotion;
}
`;

export function createWoodlandWindMaterial({ now = () => performance.now() / 1000,
    motionPreference = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') } = {}) {
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true,
        side: THREE.DoubleSide, roughness: 1 });
    const time = { value: 0 }, motion = { value: 1 };
    material.onBeforeRender = () => {
        const seconds = now();
        time.value = Number.isFinite(seconds) ? seconds : 0;
        motion.value = motionPreference?.matches ? 0 : 1;
    };
    material.onBeforeCompile = shader => {
        shader.uniforms.woodlandTime = time;
        shader.uniforms.woodlandMotion = motion;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${windShader}`)
            .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
                // Analytic normal for x/z shear proportional to height squared.
                // Root vertices (y=0) stay fixed, including on raised terrain.
                vec2 woodlandOffset = woodlandBend();
                float woodlandHeight = max(0., position.y);
                objectNormal.y -= dot(woodlandOffset, objectNormal.xz) * 2. * woodlandHeight;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                transformed.xz += woodlandOffset * woodlandHeight * woodlandHeight;`);
    };
    material.customProgramCacheKey = () => 'woodland-rooted-wind-v1';
    material.userData.woodlandWind = true;
    return material;
}
