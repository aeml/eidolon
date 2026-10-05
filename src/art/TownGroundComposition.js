import * as THREE from 'three';
import { LANTERNHOLD_COURTYARDS } from '../data/worldPopulation.js';
import { WORLD_REGIONS } from '../data/worldGeography.js';
import { createLanternholdPavingMaps } from './LanternholdPaving.js';

// Surface composition, not navigation data: branches connect service courts
// and gate approaches, bending around the casino and larger service buildings.
const ROUTES = [
    { width: 9, points: [[0, 100], [21, 133], [23, 179], [9, 190], [0, 202], [0, 300]] },
    { width: 8, points: [[-100, 200], [-48, 218], [-40, 229], [-13, 227], [0, 219], [40, 222], [51, 209], [100, 200]] },
    { width: 6, points: [[-40, 229], [-55, 238]] },
    { width: 6, points: [[40, 222], [55, 240]] },
    { width: 6, points: [[12, 230], [28, 235], [42, 234], [55, 240]] },
    { width: 7, points: [[-22, 216], [-13, 202], [-9, 189], [0, 182]] }
];
const COURTS = [
    { x: 0, z: 200, rx: 19, rz: 19 },
    { x: -19, z: 198, rx: 13, rz: 17 },
    { x: -28, z: 210, rx: 8, rz: 8 }, // Relocated smithy–stash–forge service court.
    { x: 26, z: 212, rx: 13, rz: 10 },
    { x: 28, z: 235, rx: 13, rz: 12 },
    ...LANTERNHOLD_COURTYARDS.map(site => ({ x: site.x, z: site.z, rx: 12, rz: 12 }))
];
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (lo, hi, value) => { const t = clamp((value - lo) / (hi - lo)); return t * t * (3 - 2 * t); };

export function sampleLanternholdGround(x, z) {
    let paving = 0, traffic = 0;
    const weather = Math.sin(x * .17 + Math.sin(z * .09)) * Math.cos(z * .13 - x * .035);
    for (const route of ROUTES) for (let i = 1; i < route.points.length; i++) {
        const [ax, az] = route.points[i - 1], [bx, bz] = route.points[i];
        const dx = bx - ax, dz = bz - az;
        const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz));
        const distance = Math.hypot(x - ax - t * dx, z - az - t * dz);
        paving = Math.max(paving, 1 - smooth(route.width / 2 - 1, route.width / 2 + 2.4, distance + weather * .7));
        traffic = Math.max(traffic, 1 - smooth(1, route.width / 2 + 1, distance));
    }
    for (const court of COURTS) {
        const distance = Math.hypot((x - court.x) / court.rx, (z - court.z) / court.rz);
        paving = Math.max(paving, 1 - smooth(.8, 1.15, distance + weather * .025));
    }
    const damp = (1 - traffic) * (.35 + .25 * weather);
    return { paving, traffic, damp };
}

export function createTownCompositionMask(quality = 'high') {
    const size = quality === 'low' ? 128 : 256, data = new Uint8Array(size * size * 4);
    const region = WORLD_REGIONS.town;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const sample = sampleLanternholdGround(region.minX + x / size * (region.maxX - region.minX),
            region.minZ + y / size * (region.maxZ - region.minZ));
        const at = (y * size + x) * 4;
        data[at] = Math.round(sample.paving * 255);
        data[at + 1] = Math.round(sample.traffic * 255);
        data[at + 2] = Math.round(sample.damp * 255); data[at + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, size, size);
    texture.name = 'Lanternhold connected courts and worn verges';
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

// Retains one ground mesh/draw and the existing opaque depth/shadow behavior.
// This material owns only the mask and supplied soil map, never shared albedo.
export function applyTownGroundComposition(material, soilTexture, quality = 'high') {
    const mask = createTownCompositionMask(quality), region = WORLD_REGIONS.town;
    const paving = createLanternholdPavingMaps(quality);
    const uniforms = {
        townComposition: { value: mask }, townSoil: { value: soilTexture },
        townCourt: { value: paving.color }, townCourtSurface: { value: paving.surface },
        townBounds: { value: new THREE.Vector4(region.minX, region.minZ,
            region.maxX - region.minX, region.maxZ - region.minZ) }
    };
    material.userData.townGroundComposition = { mask, soilTexture, paving };
    material.customProgramCacheKey = () => 'eidolon-town-ground-composition-v2';
    material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vTownGround;')
            .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTownGround = (modelMatrix * vec4(transformed, 1.)).xz;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
            varying vec2 vTownGround;
            uniform sampler2D townComposition;
            uniform sampler2D townSoil;
            uniform sampler2D townCourt;
            uniform sampler2D townCourtSurface;
            uniform vec4 townBounds;
        `).replace('#include <map_fragment>', `#include <map_fragment>
            vec3 townWear = texture2D(townComposition, (vTownGround - townBounds.xy) / townBounds.zw).rgb;
            vec3 townEarth = texture2D(townSoil, vTownGround * .11).rgb;
            townEarth *= mix(.85, 1.08, townWear.g);
            diffuseColor.rgb = mix(townEarth, diffuseColor.rgb, townWear.r);
            diffuseColor.rgb *= 1. - townWear.b * .12;
            vec2 courtUV = vec2(vTownGround.x, 200. - vTownGround.y) / 32. + .5;
            vec4 courtColor = texture2D(townCourt, courtUV);
            vec4 courtSurface = texture2D(townCourtSurface, courtUV);
            float courtWeight = courtColor.a * townWear.r;
            diffuseColor.rgb = mix(diffuseColor.rgb, courtColor.rgb, courtWeight);
        `).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
            roughnessFactor = mix(.98, roughnessFactor, townWear.r);
            roughnessFactor = mix(roughnessFactor, courtSurface.a, courtWeight);
        `).replace('#include <normal_fragment_maps>', `
            vec3 townFlatNormal = normal;
            #include <normal_fragment_maps>
            normal = normalize(mix(townFlatNormal, normal, townWear.r));
            #ifdef USE_NORMALMAP_TANGENTSPACE
                normal = normalize(mix(normal, normalize(tbn * (courtSurface.rgb * 2. - 1.)), courtWeight));
            #endif
        `);
    };
    const release = () => {
        mask.dispose(); soilTexture.dispose(); paving.color.dispose(); paving.surface.dispose();
        material.removeEventListener('dispose', release);
    };
    material.addEventListener('dispose', release);
    material.needsUpdate = true;
    return material;
}
