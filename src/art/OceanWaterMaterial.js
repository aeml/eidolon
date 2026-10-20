import * as THREE from 'three';
import { WORLD_GEOGRAPHY } from '../data/worldGeography.js';

// World-space waves keep their scale as the camera moves. Analytic slopes give
// the single ocean plane moving reflections without tessellation or extra passes.
export function createOceanWaterMaterial(texture) {
    return new THREE.ShaderMaterial({
        name: 'EidolicOceanWater',
        uniforms: {
            uMap: { value: texture }, uTime: { value: 0 },
            uShores: { value: WORLD_GEOGRAPHY.regions.filter(r => r.id !== 'town')
                .map(r => new THREE.Vector4(r.minX, r.minZ, r.maxX, r.maxZ)) }
        },
        vertexShader: `
            varying vec3 vWorldPos;
            void main() {
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorldPos = world.xyz;
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: `
            uniform sampler2D uMap;
            uniform float uTime;
            uniform vec4 uShores[4];
            varying vec3 vWorldPos;
            void main() {
                vec2 p = vWorldPos.xz;
                float t = uTime;
                vec2 d1 = normalize(vec2(1.0, .38));
                vec2 d2 = normalize(vec2(-.52, 1.0));
                vec2 d3 = normalize(vec2(.72, -.9));
                float a = dot(p, d1) * .72 - t * .85;
                float b = dot(p, d2) * 1.43 - t * 1.15;
                float c = dot(p, d3) * 3.1 + t * 1.5;
                vec2 slope = d1 * cos(a) * .24 + d2 * cos(b) * .045 + d3 * cos(c) * .025;
                vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
                vec3 viewDir = normalize(cameraPosition - vWorldPos);
                float fresnel = .025 + .975 * pow(1.0 - max(dot(normal, viewDir), 0.0), 5.0);
                vec3 reflection = reflect(-viewDir, normal);
                vec3 sky = mix(vec3(.16, .28, .34), vec3(.54, .68, .72), smoothstep(-.1, .85, reflection.y));
                vec3 sunDir = normalize(vec3(-.45, .78, -.44));
                float glint = pow(max(dot(reflection, sunDir), 0.0), 24.0);
                float grain = texture2D(uMap, p * .018 + slope * .025).g;
                float wave = .5 + .5 * sin(a + sin(b) * .45);
                vec3 deep = mix(vec3(.008, .035, .055), vec3(.025, .18, .21), wave * .65 + grain * .15);
                float shore = 10000.0;
                for (int i = 0; i < 4; i++) {
                    vec2 outside = max(max(uShores[i].xy - p, p - uShores[i].zw), vec2(0.0));
                    shore = min(shore, length(outside));
                }
                float shallows = 1.0 - smoothstep(0.0, 16.0, shore);
                deep = mix(deep, vec3(.055, .22, .24), shallows * .65);
                float crest = pow(.5 + .5 * sin(a + sin(b) * .25), 12.0);
                vec3 color = mix(deep, sky, .08 + fresnel * .72);
                color += vec3(.1, .18, .19) * crest * .24 + vec3(.85, .86, .75) * glint * .065;
                // Broken foam follows the land outline; it never paints inland
                // terrain or turns the entire ocean into a glowing rim.
                float breaker = sin(shore * 2.8 - t * 1.4 + sin(dot(p, d2) * .6) * .65);
                float foam = smoothstep(.65, .94, breaker) * (1.0 - smoothstep(.5, 4.5, shore));
                foam *= .35 + .65 * smoothstep(.25, .75, grain + sin(b) * .16);
                color = mix(color, vec3(.58, .75, .73), foam * .65);
                gl_FragColor = vec4(color, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
        transparent: false, depthWrite: false
    });
}
