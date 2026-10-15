import { Color } from 'three';
import { createEarthSurfaceDetail, EARTH_SURFACE_TILE_METRES } from './EarthSurfaceDetail.js';

// Travel routes use crushed local aggregate. The shared physical grit field
// supplies shape; each realm owns its mineral/dust response, without borrowing
// Earth's moss/grass channel or turning a worn route into glowing terrain.
const profiles = {
    Water: { dust: 0x7a8586, stone: 0x646e76, roughness: .86, trackPolish: .20 },
    Fire: { dust: 0x665a4b, stone: 0x484644, roughness: .99, trackPolish: .07 },
    Air: { dust: 0x817a86, stone: 0x6c6b76, roughness: .96, trackPolish: .10 }
};

export function applyElementalTrailGroundMaterial(material, realm, quality = 'high') {
    const profile = profiles[realm];
    if (!profile) throw new TypeError(`Unsupported elemental trail: ${realm}`);
    if (material.userData.elementalTrailDetail) return material;
    const detail = createEarthSurfaceDetail(quality);
    material.userData.elementalTrailDetail = detail;
    material.userData.elementalTrailRealm = realm;
    const previousCompile = material.onBeforeCompile, previousKey = material.customProgramCacheKey();
    material.customProgramCacheKey = () => `${previousKey}:elemental-world-trail-v1`;
    material.onBeforeCompile = shader => {
        previousCompile(shader);
        Object.assign(shader.uniforms, {
            elementalTrailDetail: { value: detail }, elementalTrailTile: { value: EARTH_SURFACE_TILE_METRES },
            elementalTrailDust: { value: new Color(profile.dust) }, elementalTrailStone: { value: new Color(profile.stone) },
            elementalTrailRoughness: { value: profile.roughness }, elementalTrailPolish: { value: profile.trackPolish }
        });
        shader.vertexShader = 'varying vec2 vElementalTrailWorld;\n' + shader.vertexShader.replace(
            '#include <worldpos_vertex>', '#include <worldpos_vertex>\nvElementalTrailWorld = (modelMatrix * vec4(transformed, 1.)).xz;');
        shader.fragmentShader = 'varying vec2 vElementalTrailWorld;\n' + shader.fragmentShader.replace('#include <common>', `#include <common>
            uniform sampler2D elementalTrailDetail;
            uniform float elementalTrailTile, elementalTrailRoughness, elementalTrailPolish;
            uniform vec3 elementalTrailDust, elementalTrailStone;
        `).replace('#include <map_fragment>', `
            #include <map_fragment>
            vec4 trailAggregate = texture2D(elementalTrailDetail, vElementalTrailWorld / elementalTrailTile);
            float trailTracks = exp(-pow((vMapUv.x - .29) / .065, 2.))
                + exp(-pow((vMapUv.x - .71) / .065, 2.));
            float trailShoulder = smoothstep(.16, .39, abs(vMapUv.x - .5));
            float trailStone = trailAggregate.g * (.35 + trailShoulder * .65);
            vec3 trailDustColor = elementalTrailDust * (.83 + trailAggregate.r * .24 - trailTracks * .10);
            vec3 trailStoneColor = elementalTrailStone * (.86 + trailAggregate.a * .14);
            diffuseColor.rgb = diffuse * mix(trailDustColor, trailStoneColor, trailStone);
            float trailHeight = trailAggregate.r * .008 + trailAggregate.a * .024 - trailTracks * .004;
        `).replace('#include <roughnessmap_fragment>', `
            float roughnessFactor = roughness * (elementalTrailRoughness - trailTracks * elementalTrailPolish - trailStone * .06);
        `).replace('#include <normal_fragment_maps>', `
            vec3 trailDx = dFdx(-vViewPosition), trailDy = dFdy(-vViewPosition);
            vec3 trailR1 = cross(trailDy, normal), trailR2 = cross(normal, trailDx);
            float trailDet = dot(trailDx, trailR1) * faceDirection;
            vec3 trailGradient = sign(trailDet) * (dFdx(trailHeight) * trailR1 + dFdy(trailHeight) * trailR2);
            if (abs(trailDet) > 1e-8) normal = normalize(abs(trailDet) * normal - trailGradient);
        `);
    };
    const release = () => { detail.dispose(); material.removeEventListener('dispose', release); };
    material.addEventListener('dispose', release);
    material.needsUpdate = true;
    return material;
}
