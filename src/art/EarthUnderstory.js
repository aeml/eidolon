import * as THREE from 'three';
import { EARTH_LOCATIONS, EARTH_PATHS, distanceToPath } from '../data/worldPopulation.js';
import { sampleEarthMeadow } from './EarthGroundComposition.js';
import { createEarthGroundCoverTuft } from './EarthGroundCover.js';

// First playable art reference: north grove route and east dungeon approach.
// Low vegetation only: no new blockers, server footprints or reward sources.
const BANDS = [[-220, 220, -520, 30], [150, 740, 120, 280]];
const random = (x, z, salt = 0) => {
    let n = Math.imul(x + salt * 79, 1597334677) ^ Math.imul(z - salt * 37, 3812015801);
    n = Math.imul(n ^ n >>> 16, 2246822519);
    return ((n ^ n >>> 13) >>> 0) / 4294967296;
};

export function isEarthUnderstoryClear(x, z, radius = 2.2) {
    if (Math.hypot(x, z - 200) < 165 + radius) return false;
    if (Math.abs(x) < 14 + radius || Math.abs(z - 200) < 14 + radius) return false;
    if (EARTH_LOCATIONS.some(site => Math.hypot(x - site.x, z - site.z) < site.radius + radius + 2)) return false;
    return !EARTH_PATHS.some(path => distanceToPath(x, z, path.points) < path.width / 2 + radius + 2);
}

export function createEarthUnderstoryPlacements(quality = 'high') {
    const plants = [];
    for (const [minX, maxX, minZ, maxZ] of BANDS) {
        for (let gx = minX; gx < maxX; gx += 8) for (let gz = minZ; gz < maxZ; gz += 8) {
            const x = gx + random(gx, gz, 1) * 8, z = gz + random(gx, gz, 2) * 8;
            const cover = sampleEarthMeadow(x, z);
            if (cover < .3 || random(gx, gz, 3) > cover) continue;
            for (let tuft = 0; tuft < 7; tuft++) {
                if (quality === 'low' && tuft % 2) continue;
                const angle = random(gx, gz, tuft + 4) * Math.PI * 2;
                const spread = Math.sqrt(random(gx, gz, tuft + 14)) * 2.1;
                const px = x + Math.cos(angle) * spread, pz = z + Math.sin(angle) * spread;
                if (!isEarthUnderstoryClear(px, pz)) continue;
                plants.push({ x: px, z: pz, rotation: angle,
                    // Read as low fern/heath beds at gameplay zoom, not tiny
                    // isolated sprouts. Same shared meshes and clump count.
                    scale: 1.05 + random(gx, gz, tuft + 24) * .35,
                    variant: random(gx, gz, 34) > .7 ? 0 : 1 });
            }
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
    // These sub-metre plants are background cover, not inspectable landmark
    // foliage. Retain curved blades but omit subpixel fern folds on both tiers.
    const geometries = [12, 13].map(seed => createEarthGroundCoverTuft(seed, 'low'));
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true,
        side: THREE.DoubleSide, roughness: 1 });
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
        // Repeated sphere unions drift wider than these compact cells. The
        // aggregate AABB already includes every transformed plant vertex.
        mesh.boundingSphere = mesh.boundingBox.getBoundingSphere(new THREE.Sphere());
        root.add(mesh);
    }
    return root;
}
