import { createQualityRasterCache } from './QualityRasterCache.js';
import * as THREE from 'three';
import { LANTERNHOLD_COURTYARDS } from '../data/worldPopulation.js';
import { WORLD_REGIONS } from '../data/worldGeography.js';
import { createLanternholdPavingMaps } from './LanternholdPaving.js';
import { LANTERNHOLD_HOMES, LANTERNHOLD_HOME_SCALE, LANTERNHOLD_RESIDENTIAL_PATHS, LANTERNHOLD_WEST_SERVICE_PATH } from '../data/lanternholdNeighborhood.js';

// Surface composition, not navigation data: branches connect service courts
// and gate approaches, bending around the casino and larger service buildings.
const ROUTES = [
    { width: 9, points: [[0, 100], [21, 133], [23, 179], [9, 190], [0, 202], [0, 300]] },
    { width: 8, points: [...[...LANTERNHOLD_WEST_SERVICE_PATH].reverse(), [0, 219], [40, 222], [51, 209], [100, 200]] },
    { width: 6, points: [[-40, 229], [-55, 238]] },
    { width: 6, points: [[40, 222], [55, 240]] },
    { width: 6, points: [[12, 230], [28, 235], [42, 234], [55, 240]] },
    { width: 7, points: [[-22, 216], [-13, 202], [-9, 189], [0, 182]] },
    ...LANTERNHOLD_RESIDENTIAL_PATHS,
    ...LANTERNHOLD_HOMES.map(home => ({ width: 2.4, points: [[home.x + Math.sin(home.rotation) * 3 * LANTERNHOLD_HOME_SCALE, home.z + Math.cos(home.rotation) * 3 * LANTERNHOLD_HOME_SCALE],
        [home.x + Math.sin(home.rotation) * 12, home.z + Math.cos(home.rotation) * 12]] }))
];
const COURTS = [
    { x: 0, z: 200, rx: 19, rz: 19 },
    { x: -19, z: 198, rx: 13, rz: 17 },
    { x: -28, z: 210, rx: 8, rz: 8 }, // Existing stash approach remains intact.
    // Overlap its working apron with the actual forge at (-28, 218).
    { x: -28, z: 218, rx: 8, rz: 8 },
    // Meet the west-facing trading-post door and merchant at (22.5, 200),
    // joining the main square to the eastern service court without a soil gap.
    { x: 24, z: 200, rx: 9, rz: 8 },
    { x: 26, z: 212, rx: 13, rz: 10 },
    { x: 28, z: 235, rx: 13, rz: 12 },
    ...LANTERNHOLD_COURTYARDS.map(site => ({ x: site.x, z: site.z, rx: 12, rz: 12 }))
];
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (lo, hi, value) => { const t = clamp((value - lo) / (hi - lo)); return t * t * (3 - 2 * t); };
// Reuse the actual immutable town placement/rotation field. Bake into the
// existing mask, not fifteen decals, extra textures or per-frame updates.
const CAMPS = LANTERNHOLD_HOMES.map(camp => ({
    ...camp, cos: Math.cos(camp.rotation), sin: Math.sin(camp.rotation)
}));

function sampleCampTraffic(x, z) {
    let campTraffic = 0;
    for (const camp of CAMPS) {
        const dx = x - camp.x, dz = z - camp.z;
        // Skip distant sites before rotating into their local hearth space.
        if (Math.abs(dx) > 5 * LANTERNHOLD_HOME_SCALE || Math.abs(dz) > 5 * LANTERNHOLD_HOME_SCALE) continue;
        const lx = (dx * camp.cos - dz * camp.sin) / LANTERNHOLD_HOME_SCALE;
        const lz = (dx * camp.sin + dz * camp.cos) / LANTERNHOLD_HOME_SCALE;
        // Doorway wear replaces the retired tent/hearth scorch marks.
        campTraffic = Math.max(campTraffic, (1 - smooth(.7, 1.7, Math.abs(lx))) *
            smooth(2.2, 2.8, lz) * (1 - smooth(3.2, 5, lz)));
    }
    return campTraffic;
}

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
    const hearth = 0, campTraffic = sampleCampTraffic(x, z);
    traffic = Math.max(traffic, campTraffic * .72);
    const damp = (1 - traffic) * (.35 + .25 * weather);
    return { paving, traffic, damp, hearth, campTraffic };
}

const createTownCompositionMaskRaster = createQualityRasterCache(256, 128, size => {
    const data = new Uint8Array(size * size * 4), region = WORLD_REGIONS.town;
    const width = region.maxX - region.minX, depth = region.maxZ - region.minZ;
    const paving = new Float64Array(size * size), traffic = new Float64Array(size * size);
    const weather = new Float64Array(size * size);
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
        const x = region.minX + col / size * width, z = region.minZ + row / size * depth;
        weather[row * size + col] = Math.sin(x * .17 + Math.sin(z * .09)) * Math.cos(z * .13 - x * .035);
    }
    // Each contribution is zero outside these conservative bounds. Stamp only
    // its support, retaining the original per-pixel arithmetic and max union.
    // Weather moves route edges by at most .7m and court radii by at most .025.
    const stamp = (minX, maxX, minZ, maxZ, sample) => {
        const x0 = Math.max(0, Math.floor((minX - region.minX) / width * size));
        const x1 = Math.min(size - 1, Math.ceil((maxX - region.minX) / width * size));
        const z0 = Math.max(0, Math.floor((minZ - region.minZ) / depth * size));
        const z1 = Math.min(size - 1, Math.ceil((maxZ - region.minZ) / depth * size));
        for (let row = z0; row <= z1; row++) for (let col = x0; col <= x1; col++) {
            sample(region.minX + col / size * width, region.minZ + row / size * depth, row * size + col);
        }
    };
    for (const route of ROUTES) for (let i = 1; i < route.points.length; i++) {
        const [ax, az] = route.points[i - 1], [bx, bz] = route.points[i];
        const dx = bx - ax, dz = bz - az, radius = route.width / 2 + 3.1;
        stamp(Math.min(ax, bx) - radius, Math.max(ax, bx) + radius,
            Math.min(az, bz) - radius, Math.max(az, bz) + radius, (x, z, at) => {
                const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz));
                const distance = Math.hypot(x - ax - t * dx, z - az - t * dz);
                paving[at] = Math.max(paving[at], 1 - smooth(route.width / 2 - 1, route.width / 2 + 2.4, distance + weather[at] * .7));
                traffic[at] = Math.max(traffic[at], 1 - smooth(1, route.width / 2 + 1, distance));
            });
    }
    for (const court of COURTS) {
        stamp(court.x - court.rx * 1.175, court.x + court.rx * 1.175,
            court.z - court.rz * 1.175, court.z + court.rz * 1.175, (x, z, at) => {
                const distance = Math.hypot((x - court.x) / court.rx, (z - court.z) / court.rz);
                paving[at] = Math.max(paving[at], 1 - smooth(.8, 1.15, distance + weather[at] * .025));
            });
    }
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
        const cell = row * size + col, at = cell * 4;
        const campTraffic = sampleCampTraffic(region.minX + col / size * width, region.minZ + row / size * depth);
        const wear = Math.max(traffic[cell], campTraffic * .72);
        data[at] = Math.round(paving[cell] * 255);
        data[at + 1] = Math.round(wear * 255);
        data[at + 2] = Math.round((1 - wear) * (.35 + .25 * weather[cell]) * 255);
        // Homes have doorway wear, not the retired tent/hearth scorch channel.
        data[at + 3] = 0;
    }
    return data;
});

export function createTownCompositionMask(quality = 'high') {
    const { size, data } = createTownCompositionMaskRaster(quality);
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
