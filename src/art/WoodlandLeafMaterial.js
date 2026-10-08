import { Material, ShaderChunk } from 'three';

// Thin folded leaves keep standard specular/fog/shadows and their opaque
// silhouettes. Only diffuse light wraps gently around a blade. directLight.color
// has already received the ordinary shadow mask; no unshadowed emissive fill.
const DIFFUSE = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
const LEAF_DIFFUSE = /* glsl */`
    float eidolonLeafDot = dot( geometryNormal, directLight.direction );
    float eidolonLeafWrap = saturate( ( eidolonLeafDot + .35 ) / 1.35 ) * .75;
    float eidolonLeafLight = max( dotNL, eidolonLeafWrap ) + saturate( -eidolonLeafDot ) * .10;
    reflectedLight.directDiffuse += eidolonLeafLight * directLight.color * BRDF_Lambert( material.diffuseColor );
`;
const DETAIL = /* glsl */`
varying vec2 vEidolonLeafUV;
float eidolonLeafVeins(vec2 uv) {
    float footprint = max(fwidth(uv.x), fwidth(uv.y));
    float fade = 1. - smoothstep(.08, .22, footprint);
    float spine = 1. - smoothstep(.012, .032 + footprint, abs(uv.x - .5));
    float branch = abs(fract(uv.y * 5. - abs(uv.x - .5) * 3.2) - .5);
    float ribs = 1. - smoothstep(.025, .065 + footprint * 5., branch);
    return max(spine, ribs * .48) * fade;
}
`;

export function applyWoodlandLeafDetail(material) {
    if (!material?.isMeshStandardMaterial) throw new TypeError('Leaf detail requires a standard material');
    if (material.userData.woodlandLeafDetail) return material;
    if (material.onBeforeCompile !== Material.prototype.onBeforeCompile) {
        throw new Error('Leaf detail cannot replace an existing shader hook');
    }
    if (!ShaderChunk.lights_physical_pars_fragment.includes(DIFFUSE)) {
        throw new Error('Unsupported standard diffuse lighting contract');
    }
    const lighting = ShaderChunk.lights_physical_pars_fragment.replace(DIFFUSE, LEAF_DIFFUSE);
    material.userData.woodlandLeafDetail = true;
    material.customProgramCacheKey = () => 'eidolon-woodland-leaf-v1';
    material.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <common>',
            '#include <common>\nvarying vec2 vEidolonLeafUV;')
            .replace('#include <uv_vertex>', '#include <uv_vertex>\nvEidolonLeafUV = uv;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
            `#include <common>\n${DETAIL}`)
            .replace('#include <lights_physical_pars_fragment>', lighting)
            .replace('#include <map_fragment>', /* glsl */`
                #include <map_fragment>
                float eidolonVeins = eidolonLeafVeins(vEidolonLeafUV);
                diffuseColor.rgb *= mix(vec3(1.), vec3(.94, .98, .88), eidolonVeins);
            `)
            .replace('#include <roughnessmap_fragment>', /* glsl */`
                #include <roughnessmap_fragment>
                roughnessFactor = clamp(roughnessFactor - .12 + eidolonVeins * .06, .65, 1.);
            `);
    };
    material.needsUpdate = true;
    return material;
}
