import * as THREE from 'three';
import { EARTH_LOCATIONS, EARTH_PATHS, distanceToPath } from '../data/worldPopulation.js';
import { sampleEarthMeadow } from './EarthGroundComposition.js';
import { createWoodlandUnderstoryGeometry } from './WoodlandUnderstoryGeometry.js';
import { createWoodlandWindMaterial, WOODLAND_WIND_REACH } from './WoodlandWindMaterial.js';
import { STARTER_ROAD_CLEARINGS, LANTERNHOLD_ROAD_CART } from '../data/lanternholdApproach.js';

// First playable art reference: north grove route and east dungeon approach.
// Low vegetation only: no new blockers, server footprints or reward sources.
const BANDS = [[-220, 220, -520, 30], [111, 740, 120, 280]];
const random = (x, z, salt = 0) => {
    let n = Math.imul(x + salt * 79, 1597334677) ^ Math.imul(z - salt * 37, 3812015801);
    n = Math.imul(n ^ n >>> 16, 2246822519);
    return ((n ^ n >>> 13) >>> 0) / 4294967296;
};

export function isEarthUnderstoryClear(x, z, radius = 2.2) {
    // The town is rectangular. The old165m circle stripped all vegetation
    // from the first fights east of the gate, well outside the actual fence.
    if (Math.abs(x) < 105 + radius && Math.abs(z - 200) < 105 + radius) return false;
    if (STARTER_ROAD_CLEARINGS.some(([cx, cz, clear]) => Math.hypot(x - cx, z - cz) < clear + radius)) return false;
    if (Math.hypot(x - LANTERNHOLD_ROAD_CART.x, z - LANTERNHOLD_ROAD_CART.z) < LANTERNHOLD_ROAD_CART.clearing + radius) return false;
    // Low ground cover follows the actual authored road width, not the old
    // 28m tree-trunk exclusion. The path margin below includes full plant
    // reach plus two metres of open shoulder; fight clearings stay separate.
    if (EARTH_LOCATIONS.some(site => Math.hypot(x - site.x, z - site.z) < site.radius + radius + 2)) return false;
    return !EARTH_PATHS.some(path => distanceToPath(x, z, path.points) < path.width / 2 + radius + 2);
}

export function createEarthUnderstoryPlacements(quality = 'high') {
    const plants = [];
    for (const [minX, maxX, minZ, maxZ] of BANDS) {
        for (let gx = minX; gx < maxX; gx += 3) for (let gz = minZ; gz < maxZ; gz += 3) {
            const x = gx + random(gx, gz, 1) * 3, z = gz + random(gx, gz, 2) * 3;
            const cover = sampleEarthMeadow(x, z);
            // Follow the same broad meadow field as the terrain. Continuous
            // irregular beds replace a repeated cluster of stems per anchor.
            // Low removes instances only; it cannot move the patch boundaries.
            if (cover < .32 || random(gx, gz, 3) > cover * .88) continue;
            if (quality === 'low' && random(gx, gz, 60) > .57) continue;
            if (!isEarthUnderstoryClear(x, z)) continue;
            plants.push({ x, z, rotation: random(gx, gz, 4) * Math.PI * 2,
                scale: .7 + random(gx, gz, 24) * .7,
                variant: random(gx, gz, 44) > .75 ? 0 : 1 });
        }
    }
    return plants;
}

export function createEarthUnderstory({ quality = 'high', terrainElevation = null } = {}) {
    const root = new THREE.Group();
    root.name = 'Gloamwood heath and fern beds';
    root.userData.earthUnderstory = true;
    const plants = createEarthUnderstoryPlacements(quality);
    root.userData.plantCount = plants.length;
    const geometries = ['bracken', 'sedge'].map(createWoodlandUnderstoryGeometry);
    const material = createWoodlandWindMaterial();
    const cells = new Map();
    for (const plant of plants) {
        const key = `${Math.floor(plant.x / 32)}:${Math.floor(plant.z / 32)}:${plant.variant}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(plant);
    }
    const transform = new THREE.Object3D();
    for (const [key, entries] of cells) {
        const mesh = new THREE.InstancedMesh(geometries[entries[0].variant], material, entries.length);
        mesh.name = `understory:${key}`;
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        entries.forEach((plant, i) => {
            transform.position.set(plant.x, terrainElevation?.sample(plant.x, plant.z) ?? 0, plant.z);
            transform.rotation.set(0, plant.rotation, 0);
            transform.scale.setScalar(plant.scale);
            transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingBox();
        // GPU-only sway is absent from CPU geometry bounds. Include its full
        // horizontal envelope so patch edges cannot pop out of the frustum.
        const reach = WOODLAND_WIND_REACH * 1.4;
        mesh.boundingBox.expandByVector(new THREE.Vector3(reach, 0, reach));
        // Repeated sphere unions drift wider than these compact cells. The
        // aggregate AABB already includes every transformed plant vertex.
        mesh.boundingSphere = mesh.boundingBox.getBoundingSphere(new THREE.Sphere());
        root.add(mesh);
    }
    return root;
}
