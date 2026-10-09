import * as THREE from 'three';
import { LANTERNHOLD_COURTYARDS } from '../data/worldPopulation.js';
import { WORLD_REGIONS } from '../data/worldGeography.js';
import { createLanternholdPavingMaps } from './LanternholdPaving.js';
import { createLanternholdCampPlacements } from './ProceduralLanternholdArchitecture.js';

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
// Reuse the actual immutable town placement/rotation field. Bake into the
// existing mask, not fifteen decals, extra textures or per-frame updates.
const CAMPS = createLanternholdCampPlacements(0, 200).map(camp => ({
    ...camp, cos: Math.cos(camp.rotation), sin: Math.sin(camp.rotation)
}));

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
    let hearth = 0, campTraffic = 0;
    for (const camp of CAMPS) {
        const dx = x - camp.x, dz = z - camp.z;
        // Skip distant sites before rotating into their local hearth space.
        if (Math.abs(dx) > 5 || Math.abs(dz) > 5) continue;
        const lx = dx * camp.cos - dz * camp.sin;
        const lz = dx * camp.sin + dz * camp.cos;
        const distance = Math.hypot(lx - 2.35, lz - 1.9);
        hearth = Math.max(hearth, 1 - smooth(.35, 1.8 + weather * .12, distance));
        // Wear follows the tent entrance and the walk to its actual hearth,
        // not a repeated circle around every prop. Bake into the existing
        // traffic channel; preserve roads, paving, geometry and navigation.
        // Canvas is centred at(-.55,-.45), with its opening1.47m forward.
        const tentDistance = Math.hypot((lx + .55) / 1.7, (lz + .45) / 2.1);
        const pathX = 2.9, pathZ = .88;
        const t = clamp(((lx + .55) * pathX + (lz - 1.02) * pathZ) / (pathX * pathX + pathZ * pathZ));
        const pathDistance = Math.hypot(lx + .55 - pathX * t, lz - 1.02 - pathZ * t);
        campTraffic = Math.max(campTraffic, 1 - smooth(.68, 1.15, tentDistance),
            1 - smooth(.3, .95 + weather * .05, pathDistance));
    }
    traffic = Math.max(traffic, campTraffic * .72);
    const damp = (1 - traffic) * (.35 + .25 * weather);
    return { paving, traffic, damp, hearth, campTraffic };
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
        data[at + 2] = Math.round(sample.damp * 255); data[at + 3] = Math.round(sample.hearth * 255);
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
    material.customProgramCacheKey = () => 'eidolon-town-ground-composition-v3';
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
            vec4 townWear = texture2D(townComposition, (vTownGround - townBounds.xy) / townBounds.zw);
            vec3 townEarth = texture2D(townSoil, vTownGround * .11).rgb;
            townEarth *= mix(.85, 1.08, townWear.g);
            diffuseColor.rgb = mix(townEarth, diffuseColor.rgb, townWear.r);
            diffuseColor.rgb *= 1. - townWear.b * .12;
            vec2 courtUV = vec2(vTownGround.x, 200. - vTownGround.y) / 32. + .5;
            vec4 courtColor = texture2D(townCourt, courtUV);
            vec4 courtSurface = texture2D(townCourtSurface, courtUV);
            float courtWeight = courtColor.a * townWear.r;
            diffuseColor.rgb = mix(diffuseColor.rgb, courtColor.rgb, courtWeight);
            // Flush, feathered charcoal wear under the real hearths. Retain
            // the existing soil detail/lighting rather than a black disk.
            diffuseColor.rgb *= mix(vec3(1.), vec3(.48, .44, .40), townWear.a);
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
