import { Material } from 'three';

// Material detail in physical world units, including merged/instanced buildings.
// Retains MeshStandardMaterial lighting, shadows, fog and quality settings. No
// downloaded textures, per-frame updates, extra meshes or displaced colliders.
const SURFACES = Object.freeze({ stone: 1, slate: 2, timber: 3, fieldstone: 4, bark: 5, 'stratified-rock': 6, fortress: 7, 'weathered-masonry': 8 });

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
#if EIDOLON_SURFACE == 6
// One continuous mineral field in physical world space. A dominant face
// projection swaps coordinates at a cleave and paints unrelated patches on
// either side. Fixed registered planes retain detail on every orientation,
// without UV seams or an abrupt normal-dependent projection switch.
float eidolonRockNoise(vec3 p) {
    float mineral = (eidolonNoise(p.xy) + eidolonNoise(p.yz + vec2(19., 31.)) +
        eidolonNoise(p.zx + vec2(37., 11.))) / 3.;
    return clamp(.5 + (mineral - .5) * 1.5, 0., 1.);
}
#endif
// Returns color multiplier, roughness target and a small physical relief height.
vec3 eidolonSurface(vec3 p) {
    vec3 axis = abs(cross(dFdx(p), dFdy(p)));
    vec2 uv = axis.y > max(axis.x, axis.z) ? p.xz : (axis.x > axis.z ? p.zy : p.xy);
    float weather = eidolonNoise(p.xz * .23 + p.y * .17);
#if EIDOLON_SURFACE == 6
    float strata = p.y * 1.2 + p.x * .13 - p.z * .08 + eidolonNoise(p.xz * .3) * 1.3;
    float footprint = max(fwidth(strata), .001);
    float joint = 1. - smoothstep(.025 - footprint, .09 + footprint, abs(fract(strata) - .5));
    float fade = (1. - smoothstep(.2, .6, footprint)) * smoothstep(.2, .65, weather);
    fade *= 1. - smoothstep(.3, .8, axis.y / max(length(axis), .00001));
    // Broad mineral breakup must read at play distance. Fine grain alone is
    // subpixel there and leaves the outcrop looking like plain polygon faces.
    float cleave = eidolonRockNoise(p * 1.6 + vec3(weather, -weather, weather * .5));
    vec3 grainFootprint = fwidth(p * 5.);
    float grainFade = 1. - smoothstep(.25, .8, max(grainFootprint.x, max(grainFootprint.y, grainFootprint.z)));
    float grain = mix(.5, eidolonRockNoise(p * 5.), grainFade);
    return vec3(.63 + weather * .26 + cleave * .3 + grain * .1 - joint * fade * .12,
        .79 + cleave * .13 + grain * .07,
        cleave * .12 + grain * .018 * grainFade - joint * fade * .035);
#elif EIDOLON_SURFACE == 5
    float grain = eidolonNoise(uv * vec2(7., .85) + vec2(weather * .3, 0.));
    float detail = 1. - smoothstep(.25, .8, max(fwidth(uv.x * 7.), fwidth(uv.y * .85)));
    grain = mix(.5, grain, detail);
    return vec3(.58 + grain * .38 + weather * .16, .91 + grain * .07, grain * .045 * detail);
#elif EIDOLON_SURFACE == 4
    // Carved natural blocks have their own geometric joints: do not paint an
    // unrelated rectangular brick grid across a curved vault or fallen stone.
    float grain = eidolonNoise(uv * 7.);
    float detail = 1. - smoothstep(.25, .8, max(fwidth(uv.x * 7.), fwidth(uv.y * 7.)));
    grain = mix(.5, grain, detail);
    return vec3(.72 + weather * .34 + grain * .15, .91 + grain * .07, grain * .012 * detail);
#elif EIDOLON_SURFACE == 3
    // Subtle, interrupted fibres rather than deep stripes on cross-beams.
    float grain = eidolonNoise(uv * vec2(22., 1.8));
    float fade = 1. - smoothstep(.2, .8, max(fwidth(uv.x * 22.), fwidth(uv.y * 1.8)));
    grain = mix(.5, grain, fade);
    return vec3(.78 + grain * .36 + weather * .16, .88 + grain * .09, grain * .004);
#else
#if EIDOLON_SURFACE == 8
    // Town walls are dressed, weathered blocks rather than a high-contrast
    // perfect brick stencil. Preserve the old horizontal paving field below:
    // courtyards share this material with their well/bench construction.
    if (axis.y <= max(axis.x, axis.z)) {
        vec2 masonryTileSize = vec2(1.05, .56);
        vec2 masonryWarp = vec2(eidolonNoise(uv * 1.7 + vec2(7., 13.)),
            eidolonNoise(uv * 2.3 + vec2(31., 5.))) - .5;
        vec2 masonryTile = uv / masonryTileSize + masonryWarp * vec2(.06, .04);
        float masonryRow = floor(masonryTile.y);
        masonryTile.x += mod(masonryRow, 2.) * .5 + (eidolonHash(vec2(masonryRow, 17.)) - .5) * .4;
        vec2 masonryCell = floor(masonryTile), masonryFace = fract(masonryTile);
        vec2 masonryFootprint = max(fwidth(masonryTile), vec2(.001));
        vec2 masonryEdge = min(masonryFace, 1. - masonryFace);
        vec2 masonryInside = smoothstep(vec2(.019) - masonryFootprint * .5,
            vec2(.062) + masonryFootprint * .5, masonryEdge);
        float masonryCoverage = masonryInside.x * masonryInside.y;
        float masonrySeed = eidolonHash(masonryCell);
        float masonryDetail = 1. - smoothstep(.3, .9, max(masonryFootprint.x, masonryFootprint.y));
        float masonryGrainFade = 1. - smoothstep(.25, .8, max(fwidth(uv.x * 5.), fwidth(uv.y * 5.)));
        float masonryGrain = mix(.5, eidolonNoise(uv * 5. + masonryWarp), masonryGrainFade);
        float masonryTone = .86 + masonrySeed * .18 + weather * .12 + masonryGrain * .08;
        float masonryShade = mix(.95, mix(.72, masonryTone, masonryCoverage), masonryDetail);
        float masonryHeight = (masonryCoverage * .021 + masonryGrain * .004 * masonryGrainFade) * masonryDetail;
        return vec3(masonryShade, mix(.98, .86 + masonrySeed * .08, masonryCoverage), masonryHeight);
    }
#endif
#if EIDOLON_SURFACE == 7
    // Horizontal foundation caps are worn stone, not wall courses turned
    // sideways into oversized paving. Reserve ashlar joints for vertical faces.
    if (axis.y > max(axis.x, axis.z)) {
        float grain = eidolonNoise(uv * 1.8);
        return vec3(.74 + weather * .28 + grain * .14, .9 + grain * .08, grain * .018);
    }
#endif
    vec2 tileSize = EIDOLON_SURFACE == 7 ? vec2(2.8, 1.4) : (EIDOLON_SURFACE == 2 ? vec2(.62, .46) : vec2(1.05, .56));
    vec2 tile = uv / tileSize;
    float row = floor(tile.y);
    tile.x += mod(row, 2.) * .5;
#if EIDOLON_SURFACE == 7
    tile.x += (eidolonHash(vec2(row, 17.)) - .5) * .35;
#endif
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
    float shade = mix(.93, mix(EIDOLON_SURFACE == 7 ? .7 : .52, face, coverage), detail);
    float height = coverage * (EIDOLON_SURFACE == 7 ? .028 : (EIDOLON_SURFACE == 2 ? .013 : .023)) * detail;
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
    material.customProgramCacheKey = () => `eidolon-world-surface-v${surface === 'stratified-rock' ? 3 : 1}:${surface}`;
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
