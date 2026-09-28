import { Material } from 'three';

// Material detail in physical world units, including merged/instanced buildings.
// Retains MeshStandardMaterial lighting, shadows, fog and quality settings. No
// downloaded textures, per-frame updates, extra meshes or displaced colliders.
const SURFACES = Object.freeze({ stone: 1, slate: 2, timber: 3 });

const FRAGMENT = /* glsl */`
varying vec3 vEidolonSurface;
float eidolonHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float eidolonNoise(vec2 p) {
    vec2 cell = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(eidolonHash(cell), eidolonHash(cell + vec2(1., 0.)), f.x),
        mix(eidolonHash(cell + vec2(0., 1.)), eidolonHash(cell + 1.), f.x), f.y);
}
// Returns color multiplier, roughness target and a small physical relief height.
vec3 eidolonSurface(vec3 p) {
    vec3 axis = abs(cross(dFdx(p), dFdy(p)));
    vec2 uv = axis.y > max(axis.x, axis.z) ? p.xz : (axis.x > axis.z ? p.zy : p.xy);
    float weather = eidolonNoise(p.xz * .23 + p.y * .17);
#if EIDOLON_SURFACE == 3
    // Subtle, interrupted fibres rather than deep stripes on cross-beams.
    float grain = eidolonNoise(uv * vec2(22., 1.8));
    float fade = 1. - smoothstep(.2, .8, max(fwidth(uv.x * 22.), fwidth(uv.y * 1.8)));
    grain = mix(.5, grain, fade);
    return vec3(.78 + grain * .36 + weather * .16, .88 + grain * .09, grain * .004);
#else
    vec2 tileSize = EIDOLON_SURFACE == 2 ? vec2(.62, .46) : vec2(1.05, .56);
    vec2 tile = uv / tileSize;
    float row = floor(tile.y);
    tile.x += mod(row, 2.) * .5;
    vec2 cell = floor(tile), f = fract(tile);
    // Derivative-filter joints, then fade subpixel courses to their mean. This
    // avoids moire when the camera zooms out, especially without postprocessing.
    vec2 footprint = max(fwidth(uv / tileSize), vec2(.001));
    vec2 edge = min(f, 1. - f);
    vec2 inside = smoothstep(vec2(.025) - footprint * .5,
        vec2(.065) + footprint * .5, edge);
    float coverage = inside.x * inside.y;
    float seed = eidolonHash(cell);
    float face = .88 + seed * .28 + weather * .12;
#if EIDOLON_SURFACE == 2
    // Lapped slate has a lighter lower lip and a shaded upper overlap.
    face *= .84 + .22 * smoothstep(.08, .8, f.y);
#endif
    float detail = 1. - smoothstep(.3, .9, max(footprint.x, footprint.y));
    float shade = mix(.93, mix(.52, face, coverage), detail);
    float height = coverage * (EIDOLON_SURFACE == 2 ? .013 : .023) * detail;
    return vec3(shade, mix(.98, .80 + seed * .12, coverage), height);
#endif
}
vec3 eidolonReliefNormal(vec3 n, float height) {
    vec3 dx = dFdx(-vViewPosition), dy = dFdy(-vViewPosition);
    vec3 r1 = cross(dy, n), r2 = cross(n, dx);
    float determinant = dot(dx, r1);
    vec3 gradient = sign(determinant) * (dFdx(height) * r1 + dFdy(height) * r2);
    return normalize(max(abs(determinant), 1e-8) * n - gradient);
}
`;

export function applyWorldSurfaceDetail(material, surface) {
    if (!material?.isMeshStandardMaterial || !Object.hasOwn(SURFACES, surface)) {
        throw new TypeError('World surface detail requires a standard material and a supported surface');
    }
    // Own this hook explicitly: do not silently overwrite another shader patch.
    if (material.userData.worldSurfaceDetail === surface) return material;
    if (material.userData.worldSurfaceDetail) throw new Error('World surface detail is already configured');
    if (material.onBeforeCompile !== Material.prototype.onBeforeCompile) {
        throw new Error('World surface detail cannot replace an existing shader hook');
    }
    material.userData.worldSurfaceDetail = surface;
    material.customProgramCacheKey = () => `eidolon-world-surface-v1:${surface}`;
    material.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <common>',
            '#include <common>\nvarying vec3 vEidolonSurface;');
        shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', /* glsl */`
            #include <worldpos_vertex>
            vec4 eidolonPosition = vec4(transformed, 1.);
            #ifdef USE_BATCHING
                eidolonPosition = batchingMatrix * eidolonPosition;
            #endif
            #ifdef USE_INSTANCING
                eidolonPosition = instanceMatrix * eidolonPosition;
            #endif
            vEidolonSurface = (modelMatrix * eidolonPosition).xyz;
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
            `#include <common>\n#define EIDOLON_SURFACE ${SURFACES[surface]}\n${FRAGMENT}`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', /* glsl */`
            #include <map_fragment>
            vec3 eidolonDetail = eidolonSurface(vEidolonSurface);
            diffuseColor.rgb *= eidolonDetail.x;
        `).replace('#include <roughnessmap_fragment>', /* glsl */`
            #include <roughnessmap_fragment>
            roughnessFactor = clamp(mix(roughnessFactor, eidolonDetail.y, .55), .05, 1.);
        `).replace('#include <normal_fragment_maps>', /* glsl */`
            #include <normal_fragment_maps>
            normal = eidolonReliefNormal(normal, eidolonDetail.z);
        `);
    };
    material.needsUpdate = true;
    return material;
}
