import { Material } from 'three';

const FRAGMENT = /* glsl */`
uniform float uLanternholdWindowDetail;
varying vec3 vLanternholdWindowWorld;
vec3 lanternholdGlassSurface() {
    vec3 axis = abs(cross(dFdx(vLanternholdWindowWorld), dFdy(vLanternholdWindowWorld)));
    vec2 uv = (axis.x > axis.z ? vLanternholdWindowWorld.zy : vLanternholdWindowWorld.xy) / .32;
    vec2 diamond = vec2(uv.x + uv.y, uv.y - uv.x);
    vec2 cell = floor(diamond), f = fract(diamond);
    float footprint = max(fwidth(diamond.x), fwidth(diamond.y));
    float edge = min(min(f.x, 1. - f.x), min(f.y, 1. - f.y));
    float lead = 1. - smoothstep(.018, .018 + max(footprint, .00001) * .8, edge);
    // Resolve distant bars to their average coverage rather than shimmering.
    lead = mix(lead, .07, smoothstep(.4, 1., footprint));
    float seed = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
    float crown = sin(uv.x * 1.7) * sin(uv.y * 1.3);
    float glow = mix(.76 + seed * .20 + crown * .025, .065, lead);
    float roughness = mix(.28 + seed * .12, .84, lead);
    float height = (lead * .0012 + crown * .00025) * (1. - smoothstep(.25, .8, footprint));
    return vec3(glow, roughness, height);
}
vec3 lanternholdGlassNormal(vec3 n, float height) {
    vec3 dx = dFdx(-vViewPosition), dy = dFdy(-vViewPosition);
    vec3 r1 = cross(dy, n), r2 = cross(n, dx);
    float determinant = dot(dx, r1);
    vec3 gradient = sign(determinant) * (dFdx(height) * r1 + dFdy(height) * r2);
    return normalize(max(abs(determinant), 1e-8) * n - gradient);
}
`;

// Opaque, sealed household windows: the existing panes retain their physical
// light/fog response and foreground reveal. World units keep the same small
// lead diamonds on front and gable glazing, including instanced/batched homes.
export function applyLanternholdWindowSurface(material) {
    if (!material?.isMeshStandardMaterial) throw new TypeError('Window surface requires a standard material');
    if (material.userData.lanternholdWindowSurface) return material;
    if (material.onBeforeCompile !== Material.prototype.onBeforeCompile) {
        throw new Error('Window surface cannot replace an existing shader hook');
    }
    const amount = { value: 1 };
    material.userData.lanternholdWindowSurface = { amount };
    material.customProgramCacheKey = () => 'lanternhold-household-glass-v1';
    material.onBeforeCompile = shader => {
        shader.uniforms.uLanternholdWindowDetail = amount;
        shader.vertexShader = shader.vertexShader.replace('#include <common>',
            '#include <common>\nvarying vec3 vLanternholdWindowWorld;')
            .replace('#include <worldpos_vertex>', /* glsl */`
                #include <worldpos_vertex>
                vec4 lanternholdWindowPosition = vec4(transformed, 1.);
                #ifdef USE_BATCHING
                    lanternholdWindowPosition = batchingMatrix * lanternholdWindowPosition;
                #endif
                #ifdef USE_INSTANCING
                    lanternholdWindowPosition = instanceMatrix * lanternholdWindowPosition;
                #endif
                vLanternholdWindowWorld = (modelMatrix * lanternholdWindowPosition).xyz;
            `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${FRAGMENT}`)
            .replace('#include <map_fragment>', /* glsl */`
                #include <map_fragment>
                vec3 lanternholdGlass = lanternholdGlassSurface();
                if (uLanternholdWindowDetail > 0.) {
                    diffuseColor.rgb *= mix(1., .30 + lanternholdGlass.x * .70, uLanternholdWindowDetail);
                }
            `).replace('#include <roughnessmap_fragment>', /* glsl */`
                #include <roughnessmap_fragment>
                if (uLanternholdWindowDetail > 0.) {
                    roughnessFactor = mix(roughnessFactor, lanternholdGlass.y, uLanternholdWindowDetail);
                }
            `).replace('#include <normal_fragment_maps>', /* glsl */`
                #include <normal_fragment_maps>
                if (uLanternholdWindowDetail > 0.) {
                    normal = lanternholdGlassNormal(normal, lanternholdGlass.z * uLanternholdWindowDetail);
                }
            `).replace('#include <emissivemap_fragment>', /* glsl */`
                #include <emissivemap_fragment>
                if (uLanternholdWindowDetail > 0.) {
                    totalEmissiveRadiance *= mix(1., lanternholdGlass.x, uLanternholdWindowDetail);
                }
            `);
    };
    material.needsUpdate = true;
    return material;
}
