import * as THREE from 'three';
import { WOODLAND_WIND_REACH } from './WoodlandWindMaterial.js';

// A sector is rejected by Three before per-plant draw preparation. Retain
// every original plant and two shared shape recipes in its small batch;
// neither the entire world's plants nor thousands of scene leaves need a
// per-frame visibility visit. No distance LOD, removed blades or new placement.
export function createSpatialUnderstoryBatches({ plants, geometries, material,
    terrainElevation, scaleForPlant, tintForPlant }) {
    const sectors = new Map(), sectorSize = 32;
    for (const plant of plants) {
        const key = `${Math.floor(plant.x / sectorSize)}:${Math.floor(plant.z / sectorSize)}`;
        if (!sectors.has(key)) sectors.set(key, []);
        sectors.get(key).push(plant);
    }
    // GPU sway stays rooted in original local coordinates. BatchedMesh copies
    // these conservative recipe bounds for its live per-plant frustum tests.
    // The source height is <1, so .22 bounds every possible wind phase.
    for (const geometry of geometries) {
        geometry.boundingBox.expandByVector(new THREE.Vector3(WOODLAND_WIND_REACH, 0, WOODLAND_WIND_REACH))
            .expandByScalar(.000001);
        geometry.boundingSphere.radius += WOODLAND_WIND_REACH + .000001;
    }
    const meshes = [], transform = new THREE.Object3D(), tint = new THREE.Color();
    const vertices = geometries.reduce((sum, geometry) => sum + geometry.attributes.position.count, 0);
    for (const [key, entries] of sectors) {
        const mesh = new THREE.BatchedMesh(entries.length, vertices, 0, material);
        mesh.name = `understory-sector:${key}`;
        mesh.sortObjects = false;
        mesh.perObjectFrustumCulled = true;
        mesh.receiveShadow = true; mesh.castShadow = false;
        mesh.matrixAutoUpdate = false;
        mesh.userData.understorySpatialBatch = true;
        const shapes = geometries.map(geometry => mesh.addGeometry(geometry));
        for (const plant of entries) {
            const id = mesh.addInstance(shapes[plant.variant]);
            transform.position.set(plant.x, terrainElevation?.sample(plant.x, plant.z) ?? 0, plant.z);
            transform.rotation.set(0, plant.rotation, 0);
            transform.scale.fromArray(scaleForPlant(plant)); transform.updateMatrix();
            mesh.setMatrixAt(id, transform.matrix);
            mesh.setColorAt(id, tintForPlant(plant, tint));
        }
        mesh.computeBoundingBox(); mesh.computeBoundingSphere();
        meshes.push(mesh);
    }
    // Each batch owns its copy and Three's matrix/color/indirection textures.
    // Production scene disposal already releases BatchedMesh ownership once.
    geometries.forEach(geometry => geometry.dispose());
    return meshes;
}
