import * as THREE from 'three';
import { WOODLAND_WIND_REACH } from './WoodlandWindMaterial.js';

// These sectors never edit their recipes after construction. Three's stock
// BatchedMesh owns its geometry exclusively, so retain that implementation's
// per-sector texture cleanup while releasing our shared recipe only at the
// last sector. An empty, never-uploaded geometry isolates the stock dispose.
function shareSectorGeometry(mesh, owner) {
    if (owner.geometry) {
        mesh.geometry.dispose();
        mesh.geometry = owner.geometry;
    } else owner.geometry = mesh.geometry;
    owner.references++;
    const dispose = mesh.dispose;
    let disposed = false;
    // Keep an ordinary BatchedMesh: stock cloning/copying retains its normal
    // independent geometry ownership rather than copying this field's owner.
    mesh.dispose = function () {
        if (disposed) return;
        disposed = true;
        const geometry = this.geometry;
        this.geometry = owner.disposalGeometry;
        try { dispose.call(this); }
        finally {
            this.geometry = geometry;
            if (--owner.references === 0) owner.geometry.dispose();
        }
    };
}

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
    const owner = { geometry: null, references: 0, disposalGeometry: new THREE.BufferGeometry() };
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
        // Let stock Three establish each sector's geometry ranges and bounds.
        // Only its identical immutable vertex storage is shared; matrices,
        // colors, visibility, indirection and camera preparation stay separate.
        shareSectorGeometry(mesh, owner);
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
    // Each batch owns Three's matrix/color/indirection textures; the complete
    // field owns one packed recipe. Source recipes are no longer needed.
    geometries.forEach(geometry => geometry.dispose());
    return meshes;
}
