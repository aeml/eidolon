import { BatchedMesh, Matrix4, Uint32BufferAttribute } from 'three';

// Only producer-owned, static Earth tree cells. Every original piece and
// Float32 instance matrix survives; compatible pieces share a64m submission
// sector while Three retains individual instance frustum culling. Unsupported
// devices keep the existing InstancedMesh producer, selected by its caller.
const records = new WeakMap();
const identity = new Matrix4();
const treeIds = new Set(['ossuary_birch', 'grave_pine', 'mourning_willow']);
const indexed = geometry => {
    const copy = geometry.clone();
    if (!copy.index) copy.setIndex(new Uint32BufferAttribute(
        Uint32Array.from({ length: copy.attributes.position.count }, (_, i) => i), 1));
    return copy;
};
const indices = geometry => geometry.index?.count ?? geometry.attributes.position.count;
const attributes = geometry => JSON.stringify(Object.entries(geometry.attributes).map(([name, attribute]) =>
    [name, attribute.itemSize, attribute.normalized, attribute.array.constructor.name]).sort());

export const isSpatialWoodlandBatch = mesh => records.has(mesh);
export const getSpatialWoodlandSources = mesh => records.get(mesh)?.sources;

export function batchSpatialWoodlandCells(root, highParts, currentParts = highParts) {
    if (!root.userData.proceduralFoliage || root.userData.region !== 'earth' ||
        !treeIds.has(root.userData.foliageId)) return false;
    const high = new Map(highParts.map(part => [part.name, part]));
    const current = new Map(currentParts.map(part => [part.name, part]));
    const buckets = new Map();
    for (const mesh of root.children) {
        if (!mesh.isInstancedMesh || mesh.children.length || mesh.instanceColor ||
            !mesh.visible || mesh.frustumCulled === false || !mesh.matrix.equals(identity) ||
            Array.isArray(mesh.material) || mesh.material.userData.woodlandWind ||
            !high.has(mesh.name) || mesh.geometry !== current.get(mesh.name)?.geometry ||
            mesh.material !== current.get(mesh.name)?.material ||
            Object.keys(mesh.geometry.morphAttributes).length ||
            mesh.geometry.drawRange.start !== 0 || mesh.geometry.drawRange.count !== Infinity) return false;
        const [x, z] = mesh.userData.foliageCell.split(',').map(Number);
        if (![x, z].every(Number.isFinite)) return false;
        const sector = `${Math.floor(x / 8)},${Math.floor(z / 8)}`;
        const key = JSON.stringify([sector, mesh.material.uuid, mesh.castShadow, mesh.receiveShadow,
            mesh.renderOrder, mesh.layers.mask, attributes(mesh.geometry)]);
        if (!buckets.has(key)) buckets.set(key, { sector, meshes: [] });
        buckets.get(key).meshes.push(mesh);
    }
    const batches = [], matrix = new Matrix4();
    try {
        for (const { sector, meshes } of buckets.values()) {
            const shapes = new Map(meshes.map(mesh => [mesh.name, mesh.geometry]));
            const capacity = [...shapes].reduce((sum, [name, geometry]) =>
                sum + Math.max(geometry.attributes.position.count, high.get(name).geometry.attributes.position.count), 0);
            const indexCapacity = [...shapes].reduce((sum, [name, geometry]) =>
                sum + Math.max(indices(geometry), indices(high.get(name).geometry)), 0);
            const count = meshes.reduce((sum, mesh) => sum + mesh.count, 0);
            const first = meshes[0], batch = new BatchedMesh(count, capacity, indexCapacity, first.material);
            batches.push(batch); batch.name = `woodland-sector:${root.userData.foliageId}:${sector}:${batches.length}`;
            batch.matrixAutoUpdate = false; batch.sortObjects = false; batch.perObjectFrustumCulled = true;
            batch.castShadow = first.castShadow; batch.receiveShadow = first.receiveShadow;
            batch.renderOrder = first.renderOrder; batch.layers.mask = first.layers.mask;
            batch.userData.woodlandSpatialBatch = true;
            const geometries = new Map(), sources = [];
            for (const [name, geometry] of shapes) {
                const copy = indexed(geometry);
                try {
                    const reference = high.get(name).geometry;
                    const id = batch.addGeometry(copy,
                        Math.max(geometry.attributes.position.count, reference.attributes.position.count),
                        Math.max(indices(geometry), indices(reference)));
                    geometries.set(name, { id, geometry });
                } finally { copy.dispose(); }
            }
            for (const mesh of meshes) for (let i = 0; i < mesh.count; i++) {
                const geometryId = geometries.get(mesh.name).id;
                const id = batch.addInstance(geometryId);
                mesh.getMatrixAt(i, matrix); batch.setMatrixAt(id, matrix);
                sources.push(Object.freeze({ name: mesh.name, cell: mesh.userData.foliageCell,
                    placementIndex: mesh.userData.placementIndices[i], instanceId: id, geometryId }));
            }
            batch.computeBoundingBox(); batch.computeBoundingSphere();
            records.set(batch, { geometries, sources: Object.freeze(sources) });
        }
    } catch (error) {
        batches.forEach(batch => batch.dispose()); throw error;
    }
    // Old mesh matrix buffers have not been submitted yet. Release only their
    // mesh-owned resources; original shared geometry/material caches persist.
    for (const mesh of [...root.children]) { root.remove(mesh); mesh.dispose(); }
    root.add(...batches); return true;
}

export function updateSpatialWoodlandQuality(mesh, parts) {
    const record = records.get(mesh);
    if (!record) return false;
    let changed = false;
    for (const [name, entry] of record.geometries) {
        const part = parts.get(name);
        if (!part || part.geometry === entry.geometry) continue;
        const copy = indexed(part.geometry);
        try { mesh.setGeometryAt(entry.id, copy); } finally { copy.dispose(); }
        entry.geometry = part.geometry; changed = true;
    }
    if (changed) { mesh.computeBoundingBox(); mesh.computeBoundingSphere(); }
    return true;
}
