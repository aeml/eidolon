import * as THREE from 'three';
import { createProceduralTerrainTexture, createTerrainSurfaceMaps } from './ProceduralRealmTerrain.js';

export function lanternholdGateStoneWeight(x, z) {
    const distance = Math.max(Math.abs(x) - 100, Math.abs(z - 200) - 100);
    const wear = Math.sin(x * .7 + Math.sin(z * .31)) * Math.cos(z * .53) * 1.8;
    const t = Math.max(0, Math.min(1, (distance + wear + 8) / 32));
    return 1 - t * t * (3 - 2 * t);
}

// Extend only the four town-gate routes. The original outdoor UV origin stays
// unchanged, so the rest of each trail retains its exact surface registration.
export function extendLanternholdGatePath(path) {
    const starts = { 'north-trail': [0, 116], 'south-trail': [0, 284],
        'west-trail': [-84, 200], 'bastion-road': [84, 200] };
    const start = starts[path.id];
    return start ? { ...path, points: [start, ...path.points], uvOffset: -16 / 6 } : path;
}

export function applyLanternholdGateRoad(material, quality) {
    const stone = createProceduralTerrainTexture('town', { quality });
    const surface = createTerrainSurfaceMaps('town', quality);
    material.userData.gateRoadMaps = { stone, ...surface };
    const maps = Object.values(material.userData.gateRoadMaps);
    material.customProgramCacheKey = () => 'lanternhold-gate-road-v1';
    material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, { gateStone: { value: stone }, gateNormal: { value: surface.normalMap },
            gateRoughness: { value: surface.roughnessMap }, gateTint: { value: new THREE.Color(0xe0d8ca) } });
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGateWorld;')
            .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGateWorld = (modelMatrix * vec4(transformed, 1.)).xz;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
            varying vec2 vGateWorld;
            uniform sampler2D gateStone, gateNormal, gateRoughness;
            uniform vec3 gateTint;
        `).replace('#include <map_fragment>', `#include <map_fragment>
            float gateDistance = max(abs(vGateWorld.x) - 100., abs(vGateWorld.y - 200.) - 100.);
            float gateWear = sin(vGateWorld.x * .7 + sin(vGateWorld.y * .31)) * cos(vGateWorld.y * .53) * 1.8;
            float gateStoneWeight = 1. - smoothstep(-8., 24., gateDistance + gateWear);
            vec2 gateStoneUV = vec2(vGateWorld.x + 100., 300. - vGateWorld.y) * .14;
            diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(gateStone, gateStoneUV).rgb * gateTint, gateStoneWeight);
            // Feather the short indoor overlap into its existing paving. The
            // trail alpha continues to soften both shoulders outside the gate.
            diffuseColor.a *= smoothstep(-16., -10., gateDistance);
        `).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
            roughnessFactor = mix(roughnessFactor, texture2D(gateRoughness, gateStoneUV).g * .94, gateStoneWeight);
        `).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            vec3 gateN = texture2D(gateNormal, gateStoneUV).xyz * 2. - 1.;
            vec3 gateViewNormal = normalize(mat3(viewMatrix) * vec3(gateN.x, gateN.z, -gateN.y));
            normal = normalize(mix(normal, gateViewNormal, gateStoneWeight));
        `);
    };
    const release = () => { maps.forEach(map => map.dispose()); material.removeEventListener('dispose', release); };
    material.addEventListener('dispose', release);
    return material;
}
