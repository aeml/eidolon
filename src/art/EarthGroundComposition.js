import * as THREE from 'three';
import { EARTH_PATHS, distanceToPath } from '../data/worldPopulation.js';
import { WORLD_REGIONS } from '../data/worldGeography.js';
import { PROCEDURAL_FOLIAGE_RECIPES, createProceduralFoliagePlacements } from '../data/worldFoliage.js';

const clamp = v => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (x, y) => {
    let n = Math.imul(x + 137, 1597334677) ^ Math.imul(y + 83, 3812015801);
    n = Math.imul(n ^ n >>> 16, 2246822519);
    return ((n ^ n >>> 13) >>> 0) / 4294967296;
};
function noise(x, y, period = 0) {
    const ix = Math.floor(x), iy = Math.floor(y), u = smooth(0, 1, x - ix), v = smooth(0, 1, y - iy);
    const sample = period ? (a, b) => hash(((a % period) + period) % period, ((b % period) + period) % period) : hash;
    const a = sample(ix, iy), b = sample(ix + 1, iy), c = sample(ix, iy + 1), d = sample(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// One spatial index, built with the same immutable placements as the trees.
// Sampling never scans the whole forest per pixel or performs per-frame work.
let woodland;
function getWoodland() {
    if (woodland) return woodland;
    woodland = new Map();
    for (const recipe of PROCEDURAL_FOLIAGE_RECIPES.filter(r => r.region === 'earth')) {
        for (const tree of createProceduralFoliagePlacements(recipe)) {
            const key = `${Math.floor(tree.x / 32)}:${Math.floor(tree.z / 32)}`;
            if (!woodland.has(key)) woodland.set(key, []);
            woodland.get(key).push(tree);
        }
    }
    return woodland;
}

const mineralAt = (x, z) => smooth(.48, .77, noise(x * .012 + noise(x * .025, z * .025) * 2, z * .035));
const bastionRoad = EARTH_PATHS.find(path => path.id === 'bastion-road');

// Broad connected heath/moss beds, shared by the ground material and physical
// undergrowth. Keep these larger than a character, not pixel-sized green noise.
export const sampleEarthMeadow = (x, z) => {
    const meadow = smooth(.38, .7,
        noise(x * .025 + 17, z * .025 - 9) * .8 + noise(x * .08, z * .08) * .2);
    // A continuous worn-town / planted-verge / open-fight transition at the
    // first road. Share this field with physical ground cover, not a separate
    // green decal or a uniformly planted combat clearing.
    const gateVerge = 1 - smooth(.25, 1.1, Math.hypot((x - 112) / 11, (z - 170) / 22));
    // Deliberate, irregular meadow shoulders connect the long eastern road.
    // The generic field alone left whole screenfuls bare between landmarks.
    // Preserve the worn centre; placement separately keeps full leaf/wind
    // reach outside every road and the authored encounter/site clearings.
    const roadDistance = x > 190 && x < 790 ? distanceToPath(x, z, bastionRoad.points) : Infinity;
    const edgeWarp = noise(x * .047, z * .041) * 5;
    const shoulder = smooth(6, 10, roadDistance) * (1 - smooth(15 + edgeWarp, 23 + edgeWarp, roadDistance));
    const roadVerge = shoulder * smooth(190, 225, x) * (1 - smooth(755, 790, x)) *
        (.48 + noise(x * .038 + 8, z * .055) * .5);
    return Math.max(meadow, roadVerge, gateVerge * (.8 + noise(x * .08, z * .08) * .2));
};

export function sampleEarthGround(x, z) {
    let canopy = 0, trail = 0;
    const trees = getWoodland(), cx = Math.floor(x / 32), cz = Math.floor(z / 32);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        for (const tree of trees.get(`${cx + dx}:${cz + dz}`) || []) {
            canopy = Math.max(canopy, 1 - smooth(3, 14 * tree.scale, Math.hypot(x - tree.x, z - tree.z)));
        }
    }
    for (const path of EARTH_PATHS) {
        trail = Math.max(trail, 1 - smooth(path.width / 2, path.width / 2 + 9, distanceToPath(x, z, path.points)));
    }
    // Long, irregular mineral exposures tie the open clearings together. These
    // are flush surface materials, not pretend hills or collision geometry.
    const stone = mineralAt(x, z) * (1 - canopy * .85) * (1 - trail * .85);
    return { canopy: canopy * (1 - trail * .9), trail, stone,
        meadow: sampleEarthMeadow(x, z) * (1 - trail) * (1 - canopy * .7) };
}

export function createEarthCompositionMask(quality = 'high') {
    const size = quality === 'low' ? 256 : 512, data = new Uint8Array(size * size * 4);
    const region = WORLD_REGIONS.earth;
    const canopy = new Float64Array(size * size), trails = new Float64Array(size * size);
    const stepX = (region.maxX - region.minX) / size, stepZ = (region.maxZ - region.minZ) / size;
    const stamp = (minX, maxX, minZ, maxZ, channel, sample) => {
        const x0 = Math.max(0, Math.ceil((minX - region.minX) / stepX)), x1 = Math.min(size - 1, Math.floor((maxX - region.minX) / stepX));
        const z0 = Math.max(0, Math.ceil((minZ - region.minZ) / stepZ)), z1 = Math.min(size - 1, Math.floor((maxZ - region.minZ) / stepZ));
        for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
            const at = z * size + x;
            channel[at] = Math.max(channel[at], sample(region.minX + x * stepX, region.minZ + z * stepZ));
        }
    };
    // Rasterize only each tree/segment's affected rectangle instead of testing
    // every tree bucket and every route against every pixel in the whole realm.
    for (const trees of getWoodland().values()) for (const tree of trees) {
        const radius = 14 * tree.scale;
        stamp(tree.x - radius, tree.x + radius, tree.z - radius, tree.z + radius, canopy,
            (x, z) => 1 - smooth(3, radius, Math.hypot(x - tree.x, z - tree.z)));
    }
    for (const path of EARTH_PATHS) for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1], b = path.points[i], segment = [a, b], radius = path.width / 2 + 9;
        stamp(Math.min(a[0], b[0]) - radius, Math.max(a[0], b[0]) + radius,
            Math.min(a[1], b[1]) - radius, Math.max(a[1], b[1]) + radius, trails,
            (x, z) => 1 - smooth(path.width / 2, radius, distanceToPath(x, z, segment)));
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const cell = y * size + x, at = cell * 4, cover = canopy[cell], trail = trails[cell];
        data[at] = Math.round(cover * (1 - trail * .9) * 255); data[at + 1] = Math.round(trail * 255);
        data[at + 2] = Math.round(mineralAt(region.minX + x * stepX, region.minZ + y * stepZ) *
            (1 - cover * .85) * (1 - trail * .85) * 255);
        data[at + 3] = Math.round(sampleEarthMeadow(region.minX + x * stepX,
            region.minZ + y * stepZ) * (1 - trail) * (1 - cover * .7) * 255);
    }
    const texture = new THREE.DataTexture(data, size, size);
    texture.name = 'Gloamwood woodland, trail and mineral composition';
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

export function createForestFloorDetail(quality = 'high') {
    const size = quality === 'low' ? 128 : 256, data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        // Canonical field retains identical leaf locations on Low. Inspect
        // neighboring wrapped cells so jittered leaves can cross cell/tile
        // edges without a seam or an obvious regular dotted grid.
        const px = x * 256 / size, py = y * 256 / size, cx = Math.floor(px / 32), cy = Math.floor(py / 32);
        const turn = Math.PI * 2 / 256;
        const warpedX = px + Math.sin(py * turn * 4) * 6 + Math.sin((px * 3 + py * 2) * turn) * 3;
        const warpedY = py + Math.sin(px * turn * 3) * 5;
        let leaf = 0, vein = 0, nearest = Infinity, second = Infinity, plateTone = 0;
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
            const ix = cx + ox, iy = cy + oy, wx = (ix + 8) % 8, wy = (iy + 8) % 8;
            const seed = hash(wx, wy);
            // Wrapped cellular plates share the detail map's unused alpha
            // channel. Two closest sites define irregular fracture seams;
            // evaluated at a larger world scale than the fallen leaves.
            const rockX = warpedX - (ix * 32 + hash(wx + 53, wy) * 32);
            const rockY = warpedY - (iy * 32 + hash(wx, wy + 53) * 32);
            const distance = Math.hypot(rockX, rockY) / 32;
            if (distance < nearest) {
                second = nearest; nearest = distance; plateTone = .65 + seed * .35;
            } else if (distance < second) second = distance;
            if (seed < .38) continue;
            const angle = seed * Math.PI * 2;
            const dx = px - (ix * 32 + hash(wx + 31, wy) * 32);
            const dy = py - (iy * 32 + hash(wx, wy + 31) * 32);
            const along = dx * Math.cos(angle) - dy * Math.sin(angle);
            const across = dx * Math.sin(angle) + dy * Math.cos(angle);
            const length = 6 + seed * 6;
            const shape = Math.abs(along) / length + Math.pow(Math.abs(across) / (2 + seed * 4), .7);
            const coverage = 1 - smooth(.8, 1.05, shape);
            leaf = Math.max(leaf, coverage);
            vein = Math.max(vein, coverage * (1 - smooth(.2, 1.25, Math.abs(across))) * (1 - Math.abs(along) / (length + 2)));
        }
        const at = (y * size + x) * 4;
        // Coherent soil aggregates survive mip filtering at normal play zoom.
        // Pure per-texel noise averaged to grey, leaving only blurry realm masks.
        const aggregate = smooth(.28, .74, noise(px / 32, py / 32, 8));
        data[at] = Math.round((.18 + aggregate * .55 + hash(px, py) * .08) * 255);
        data[at + 1] = Math.round(leaf * 255); data[at + 2] = Math.round(vein * 255);
        const fracture = smooth(.005, .12, second - nearest);
        const seamStrength = smooth(-.6, .1, Math.sin(px * turn * 3) * Math.cos(py * turn * 5));
        data[at + 3] = Math.round((1 - (1 - fracture) * seamStrength) * plateTone * 255);
    }
    const texture = new THREE.DataTexture(data, size, size);
    texture.name = 'Gloamwood grain, fallen leaves and fractured bedrock';
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.needsUpdate = true;
    return texture;
}

export function applyEarthGroundComposition(material, quality = 'high') {
    const mask = createEarthCompositionMask(quality), detail = createForestFloorDetail(quality);
    const region = WORLD_REGIONS.earth;
    material.userData.earthGroundComposition = { mask, detail };
    material.customProgramCacheKey = () => 'eidolon-earth-ground-composition-v11';
    material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, { earthComposition: { value: mask }, earthDetail: { value: detail },
            earthBounds: { value: new THREE.Vector4(region.minX, region.minZ, region.maxX - region.minX, region.maxZ - region.minZ) } });
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vEarthGround;\nvarying vec3 vEarthNormal;')
            .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
                vec3 earthWorldPosition = (modelMatrix * vec4(transformed, 1.)).xyz;
                vEarthGround = earthWorldPosition.xz;
                vEarthNormal = normalize(mat3(modelMatrix) * normal);`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
            varying vec2 vEarthGround;
            varying vec3 vEarthNormal;
            uniform sampler2D earthComposition;
            uniform sampler2D earthDetail;
            uniform vec4 earthBounds;
        `).replace('#include <map_fragment>', `#include <map_fragment>
            vec4 earthWear = texture2D(earthComposition, (vEarthGround - earthBounds.xy) / earthBounds.zw);
            vec4 earthBroad = texture2D(earthDetail, vEarthGround * .043 + vec2(.37, .19));
            // Continuous physical-space warping breaks the visible five-metre
            // litter stencil. Only coherent soil and canonical realm fields
            // drive the warp: the detail alpha's sharp fracture boundaries
            // would fold the litter and create streaks. No tile/hash-cell
            // seams or new fetches; authored road/bed masks stay registered.
            vec2 earthDomain = vEarthGround + (earthBroad.rr - .5) * vec2(1.4, -1.2)
                + earthWear.ra * vec2(.8, -.9);
            vec3 earthGrain = texture2D(earthDetail, earthDomain * .18).rgb;
            // Physical-scale soil aggregates, independent of the broad realm
            // color map. The second scale supplies grit between larger clods
            // without another texture or a screen-space noise overlay.
            vec2 earthGritDomain = mat2(.8, -.6, .6, .8) * earthDomain;
            float earthGrit = texture2D(earthDetail, earthGritDomain * .74 + vec2(.13, .47)).r;
            float earthFineGrit = texture2D(earthDetail, earthDomain.yx * 1.73 + vec2(.51, .29)).r;
            // Small fractured stone and broad mineral weathering have separate
            // scales. Drawing the broad cellular seams at full contrast made
            // the whole clearing resemble a tiled pavement.
            vec4 earthStone = texture2D(earthDetail, vEarthGround * .12 + vec2(-.21, .63));
            float earthScatter = earthBroad.r;
            // Break the large mask edges with registered soil detail rather
            // than blending every material into a uniform brown-green wash.
            earthWear.a = smoothstep(.12, .72, earthWear.a + (earthScatter - .5) * .35);
            earthWear.r = smoothstep(.06, .94, earthWear.r + (earthScatter - .5) * .18);
            // Interpolated authored vertex normals keep material boundaries
            // smooth. Face derivatives visibly outlined the terrain triangles.
            vec3 earthFace = normalize(vEarthNormal);
            float earthExposure = smoothstep(.001, .018, 1. - abs(earthFace.y));
            float earthRock = max(earthWear.b * .75,
                earthExposure * .9 * (1. - earthWear.r * .9) * (1. - earthWear.g));
            // Keep weathering independent of the fracture mask: using its
            // dark seams as soil coverage drew a complete black crack network.
            earthRock *= .65 + earthBroad.r * .35;
            // Exposed shoulders retain soil between mineral fragments. A
            // full replacement turned whole hillsides into pale cracked paving.
            earthRock = smoothstep(.14, .8, earthRock) * .72;
            // Character-scale aggregates survive gameplay minification. The
            // smaller grit fills their faces rather than owning every clod.
            float earthClod = smoothstep(.25, .69, earthGrain.r * .72 + earthGrit * .28);
            float earthPore = smoothstep(.22, .65, earthFineGrit);
            // Moss cushions and soil aggregates occupy different physical
            // scales. Reusing the clod field for both flattened their height
            // blend into a translucent green wash at ordinary play distance.
            float earthMoss = smoothstep(.28, .65, earthBroad.r * .68 + earthGrit * .32);
            // Height-sensitive blending exposes dry clod faces between moss
            // cushions instead of painting a translucent green wash. Restrict
            // breakup to the transition: zero/one authored coverage stays
            // zero/one, so worn roads and planted beds keep their meaning.
            float earthMossHeight = earthWear.a + (earthMoss - earthClod) * .34 *
                4. * earthWear.a * (1. - earthWear.a);
            float earthLayerFilter = min(.16, fwidth(earthMossHeight));
            float earthMossCoverage = smoothstep(.38 - earthLayerFilter, .62 + earthLayerFilter, earthMossHeight);
            // The canopy layer used to overwrite every moss contribution,
            // leaving a uniformly dark forest bed. Reuse the existing broad
            // and fine samples for sheltered, irregular cushions; do not paint
            // over worn routes or expose a new geometry/texture workload.
            float earthShelteredMoss = smoothstep(.42, .68,
                earthBroad.r * .72 + earthMoss * .28) * earthWear.r * (1. - earthWear.g);
            // Smoothstep re-amplifies the mip-filtered grain at long views.
            // Fade fibre contrast toward its mean, keeping the broad moss
            // cushions and authored coverage, rather than sparkling speckles.
            float earthFiberFootprint = max(fwidth(earthGritDomain.x * .74), fwidth(earthGritDomain.y * .74));
            float earthFiberDetail = 1. - smoothstep(.14, .65, earthFiberFootprint);
            float earthMossFiber = mix(.5, smoothstep(.28, .72, earthGrit * .65 + earthFineGrit * .35), earthFiberDetail);
            float earthLeafCoverage = earthGrain.g * earthWear.r;
            // These are linear reflectances, lit by the existing physical
            // lights/shadows, never emissive colors or baked fake highlights.
            // Damp crevices and dry aggregate faces share the relief field;
            // don't inherit a blurry broad color stain as the entire soil bed.
            vec3 earthSoil = mix(vec3(.058, .045, .029), vec3(.087, .067, .043), earthClod);
            earthSoil *= mix(.92, 1.06, earthPore);
            vec3 forestBed = earthSoil * vec3(.53, .55, .46);
            vec3 fallenLeaf = mix(vec3(.065, .038, .016), vec3(.17, .115, .052), earthScatter);
            fallenLeaf *= .9 + earthGrain.b * .1;
            vec3 heathBed = mix(vec3(.046, .068, .029), vec3(.054, .076, .034), earthMossFiber);
            heathBed *= mix(.96, 1.04, earthMossFiber) * mix(.96, 1.04, earthClod);
            diffuseColor.rgb = mix(earthSoil, heathBed, earthMossCoverage);
            diffuseColor.rgb = mix(diffuseColor.rgb, forestBed, earthWear.r);
            diffuseColor.rgb = mix(diffuseColor.rgb, heathBed, earthShelteredMoss * .72);
            diffuseColor.rgb = mix(diffuseColor.rgb, fallenLeaf, earthLeafCoverage);
            diffuseColor.rgb = mix(diffuseColor.rgb, fallenLeaf,
                earthGrain.g * earthWear.a * (1. - earthWear.r) * .22);
            // Cool slate separates exposed stone from warmer soil and heath;
            // an olive tint on all three made the entire scene read as mud.
            float earthMineralTone = earthStone.a * .4 + earthBroad.r * .6;
            vec3 mineral = mix(vec3(.083, .093, .098), vec3(.133, .145, .148), earthMineralTone);
            mineral *= .86 + earthGrain.r * .24;
            diffuseColor.rgb = mix(diffuseColor.rgb, mineral, earthRock);
            diffuseColor.rgb *= mix(.94, 1.08, earthWear.g) * (.94 + earthGrain.r * .12);
        `).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
            roughnessFactor = mix(roughnessFactor, .92 + earthGrain.r * .07, earthWear.r);
            roughnessFactor = mix(roughnessFactor, .81 + earthStone.a * .15, earthRock);
            roughnessFactor = mix(roughnessFactor, .87 + earthPore * .12,
                (1. - earthWear.r) * (1. - earthRock));
            roughnessFactor = mix(roughnessFactor, .88 + earthPore * .08, earthLeafCoverage * (1. - earthRock));
            roughnessFactor = mix(roughnessFactor, .96,
                max(earthMossCoverage, earthShelteredMoss) * (1. - earthRock));
        `).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            float earthRelief = (earthClod * .022 + earthPore * .006) * (1. - earthRock)
                + earthMossCoverage * earthMoss * .012
                + earthShelteredMoss * earthMossFiber * .018
                + earthLeafCoverage * (.018 + earthGrain.b * .01)
                + (earthStone.a * .028 + earthBroad.r * .012) * earthRock;
            vec3 earthDx = dFdx(-vViewPosition), earthDy = dFdy(-vViewPosition);
            vec3 earthR1 = cross(earthDy, normal), earthR2 = cross(normal, earthDx);
            float earthDet = dot(earthDx, earthR1);
            normal = normalize(max(abs(earthDet), 1e-8) * normal - sign(earthDet) *
                (dFdx(earthRelief) * earthR1 + dFdy(earthRelief) * earthR2));
        `);
    };
    const release = () => { mask.dispose(); detail.dispose(); material.removeEventListener('dispose', release); };
    material.addEventListener('dispose', release);
    return material;
}
