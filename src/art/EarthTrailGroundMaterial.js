import { Color } from 'three';
import { createEarthSurfaceDetail, EARTH_SURFACE_TILE_METRES } from './EarthSurfaceDetail.js';

// A route's across-road UV still owns its shoulders and wheel tracks. Soil
// aggregate uses physical world coordinates so a miter cannot stretch pebbles
// into an apparent embankment. Reuse the ground's registered soil/stone field.
export function applyEarthTrailGroundMaterial(material, quality) {
    if (!material.userData.gateRoadMaps) throw new Error('Earth trail detail requires the town-gate material');
    if (material.userData.earthTrailDetail) return material;
    const detail = createEarthSurfaceDetail(quality);
    material.userData.earthTrailDetail = detail;
    const previousCompile = material.onBeforeCompile, previousKey = material.customProgramCacheKey();
    material.customProgramCacheKey = () => `${previousKey}:earth-world-trail-v1`;
    material.onBeforeCompile = shader => {
        previousCompile(shader);
        Object.assign(shader.uniforms, {
            trailWorldDetail: { value: detail }, trailTileMetres: { value: EARTH_SURFACE_TILE_METRES },
            trailSoil: { value: new Color(0x625541) }, trailGravel: { value: new Color(0x706a60) }
        });
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
            uniform sampler2D trailWorldDetail;
            uniform float trailTileMetres;
            uniform vec3 trailSoil, trailGravel;
        `).replace('#include <map_fragment>', `
            #include <map_fragment>
            vec4 trailSurface = texture2D(trailWorldDetail, vGateWorld / trailTileMetres);
            float trailAcross = vMapUv.x;
            float trailTracks = exp(-pow((trailAcross - .29) / .065, 2.))
                + exp(-pow((trailAcross - .71) / .065, 2.));
            float trailShoulder = smoothstep(.16, .39, abs(trailAcross - .5));
            float trailStone = trailSurface.g * (.45 + trailShoulder * .55);
            vec3 trailSoilColor = trailSoil * (.80 + trailSurface.r * .30 - trailTracks * .13);
            vec3 trailStoneColor = trailGravel * (.82 + trailSurface.a * .18);
            diffuseColor.rgb = diffuse * mix(trailSoilColor, trailStoneColor, trailStone);
            float trailHeight = trailSurface.r * .012 + trailSurface.a * .035 - trailTracks * .006;
        `).replace('#include <roughnessmap_fragment>', `
            float roughnessFactor = roughness * (.93 - trailTracks * .11 - trailStone * .08);
        `).replace('#include <normal_fragment_maps>', `
            // Surface gradients preserve the actual terrain normal and world
            // height scale, including raised ribbons and rotated camera views.
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
