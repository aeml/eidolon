import { Material } from 'three';

const STYLES = Object.freeze({ birch: 1, pine: 2, willow: 3 });
const DETAIL = /* glsl */`
varying vec2 vEidolonBarkUV;
float eidolonBarkHash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * .1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}
float eidolonBarkNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(eidolonBarkHash(i), eidolonBarkHash(i + vec2(1., 0.)), f.x),
        mix(eidolonBarkHash(i + vec2(0., 1.)), eidolonBarkHash(i + 1.), f.x), f.y);
}
// UVs remain attached to the original stem through fixed-part baking and
// instancing. Circular fields agree at U=0/1; rotating a tree cannot rotate
// its grain away from the trunk or introduce a world-projection seam.
vec3 eidolonBarkSurface(vec2 uv) {
    float angle = uv.x * 6.28318530718;
    vec2 circle = vec2(cos(angle), sin(angle));
    float broad = eidolonBarkNoise(circle * 2.2 + vec2(uv.y * .3, uv.y * 2.8));
    float weather = eidolonBarkNoise(circle * 4.1 + vec2(uv.y * .7, uv.y * 7.));
#if EIDOLON_BARK == 1
    // Broken lenticels and shallow peeling plates, not uniform zebra stripes.
    float scarPhase = uv.y * 24. + broad * 1.7;
    float scarFootprint = max(fwidth(scarPhase), .001);
    float scar = 1. - smoothstep(.025 + scarFootprint, .10 + scarFootprint, abs(fract(scarPhase) - .5));
    scar *= smoothstep(.5, .72, weather) * (1. - smoothstep(.2, .7, scarFootprint));
    return vec3(.86 + broad * .22 - scar * .38, .89 + weather * .07, broad * .004 - scar * .006);
#else
    // Irregular axial ridges give pine and willow their own coarse/fine grain.
    float ridgePhase = angle * (EIDOLON_BARK == 2 ? 10. : 16.) + broad * 3. + uv.y * .8;
    float ridgeFootprint = max(fwidth(ridgePhase), .001);
    float detail = 1. - smoothstep(.6, 2.4, ridgeFootprint);
    float ridge = mix(.5, .5 + .5 * sin(ridgePhase), detail);
    float cleft = (1. - smoothstep(.12, .42, ridge)) * detail;
    float relief = EIDOLON_BARK == 2 ? .016 : .009;
    return vec3(.86 + broad * .20 + ridge * .10 - cleft * .17,
        .88 + weather * .09, ridge * relief * detail + broad * .004);
#endif
}
vec3 eidolonBarkReliefNormal(vec3 n, float height) {
    vec3 dx = dFdx(-vViewPosition), dy = dFdy(-vViewPosition);
    vec3 r1 = cross(dy, n), r2 = cross(n, dx);
    float determinant = dot(dx, r1);
    vec3 gradient = sign(determinant) * (dFdx(height) * r1 + dFdy(height) * r2);
    return normalize(max(abs(determinant), 1e-8) * n - gradient);
}
`;

export function applyWoodlandBarkDetail(material, style) {
    if (!material?.isMeshStandardMaterial || !Object.hasOwn(STYLES, style)) throw new TypeError('Woodland bark requires a standard material and a supported tree style');
    if (material.userData.woodlandBark === style) return material;
    if (material.onBeforeCompile !== Material.prototype.onBeforeCompile) throw new Error('Woodland bark cannot replace an existing shader hook');
    material.userData.woodlandBark = style;
    material.customProgramCacheKey = () => `eidolon-woodland-bark-v1:${style}`;
    material.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vEidolonBarkUV;')
            .replace('#include <uv_vertex>', '#include <uv_vertex>\nvEidolonBarkUV = uv;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n#define EIDOLON_BARK ${STYLES[style]}\n${DETAIL}`)
            .replace('#include <map_fragment>', '#include <map_fragment>\nvec3 eidolonBark = eidolonBarkSurface(vEidolonBarkUV);\ndiffuseColor.rgb *= eidolonBark.x;')
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(mix(roughnessFactor, eidolonBark.y, .55), .65, 1.);')
            .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = eidolonBarkReliefNormal(normal, eidolonBark.z);');
    };
    material.needsUpdate = true;
    return material;
}
