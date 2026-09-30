import { BatchedMesh, Matrix4 } from 'three';

// Per-model GPU buffers, never cache-owned materials or source geometry.
const models = new WeakMap();
const inverse = new Matrix4(), matrix = new Matrix4();

function restore(bucket) {
    if (bucket.active) bucket.entries.forEach(({ part, visible }) => { part.visible = visible; });
    bucket.active = false;
    if (bucket.mesh) bucket.mesh.visible = false;
}

export function clearAnimatedEquipmentBatches(root) {
    const state = models.get(root);
    if (!state) return;
    state.buckets.forEach(bucket => {
        restore(bucket);
        bucket.mesh?.removeFromParent(); bucket.mesh?.dispose();
    });
    models.delete(root);
}

export function suspendAnimatedEquipmentBatches(root, suspended) {
    const state = models.get(root);
    if (!state) return;
    state.suspended = suspended;
    if (suspended) state.buckets.forEach(restore);
}

export function registerAnimatedEquipmentBatches(root) {
    clearAnimatedEquipmentBatches(root);
    const buckets = new Map();
    root.traverse(group => {
        if (!group.userData.equipmentVisual) return;
        for (const part of group.children) {
            if (!part.isMesh || !part.visible || part.isSkinnedMesh || part.children.length ||
                Array.isArray(part.material) || part.material.transparent || part.customDepthMaterial ||
                part.customDistanceMaterial || Object.keys(part.geometry.morphAttributes).length) continue;
            const attributes = Object.entries(part.geometry.attributes).map(([name, attribute]) =>
                `${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array.constructor.name}`).sort().join(',');
            const key = [part.material.uuid, part.castShadow, part.receiveShadow,
                part.renderOrder, part.layers.mask, Boolean(part.geometry.index), attributes].join(':');
            if (!buckets.has(key)) buckets.set(key, { entries: [], material: part.material, active: false, mesh: null });
            buckets.get(key).entries.push({ part, geometry: part.geometry, visible: part.visible, instance: null,
                castShadow: part.castShadow, receiveShadow: part.receiveShadow,
                renderOrder: part.renderOrder, layers: part.layers.mask });
        }
    });
    const compatible = [...buckets.values()].filter(bucket => bucket.entries.length > 1);
    if (compatible.length) models.set(root, { buckets: compatible, suspended: false });
}

function createBatch(root, bucket) {
    const geometries = [...new Set(bucket.entries.map(({ part }) => part.geometry))];
    const vertices = geometries.reduce((sum, geometry) => sum + geometry.attributes.position.count, 0);
    const indices = geometries.reduce((sum, geometry) => sum + (geometry.index?.count || 0), 0);
    const batch = new BatchedMesh(bucket.entries.length, vertices, indices, bucket.material);
    batch.name = `AnimatedEquipmentBatch_${bucket.entries[0].part.name}`;
    batch.userData.animatedEquipmentBatch = true;
    // Scene teardown and later actor/pool cleanup can encounter the same owner.
    const dispose = batch.dispose.bind(batch);
    batch.dispose = () => {
        if (batch.userData.equipmentBatchDisposed) return;
        batch.userData.equipmentBatchDisposed = true; dispose();
    };
    const first = bucket.entries[0].part;
    batch.castShadow = first.castShadow; batch.receiveShadow = first.receiveShadow;
    batch.renderOrder = first.renderOrder; batch.layers.mask = first.layers.mask;
    batch.frustumCulled = false; // Dynamic instance bounds, not a stale whole-rig sphere.
    batch.sortObjects = false; // Opaque pieces retain exact materials.
    const ids = new Map(geometries.map(geometry => [geometry, batch.addGeometry(geometry)]));
    bucket.entries.forEach(entry => { entry.instance = batch.addInstance(ids.get(entry.part.geometry)); });
    bucket.entries.forEach(entry => { entry.matrix = null; });
    root.add(batch); bucket.mesh = batch;
}

function belongsTo(part, root) {
    for (let parent = part.parent; parent; parent = parent.parent) if (parent === root) return true;
    return false;
}

function parentsVisible(part, root) {
    for (let parent = part.parent; parent && parent !== root; parent = parent.parent) if (!parent.visible) return false;
    return true;
}

// Run before renderer traversal: original source visibility and per-instance
// animated matrices must be current for both the camera and shadow passes.
export function updateAnimatedEquipmentBatches(scene, renderer) {
    const started = scene.userData.profileEquipmentBatches ? performance.now() : null;
    let matrixUploads = 0, activeBatches = 0;
    const supported = Boolean(renderer.extensions?.has('WEBGL_multi_draw'));
    scene.traverse(root => {
        const state = models.get(root);
        if (!state) return;
        if (!root.visible || !parentsVisible(root, scene)) return;
        if (!supported || state.suspended) { state.buckets.forEach(restore); return; }
        root.updateWorldMatrix(true, true);
        inverse.copy(root.matrixWorld).invert();
        for (const bucket of state.buckets) {
            if (bucket.entries.some(entry => entry.part.material !== bucket.material || entry.part.material.transparent ||
                entry.part.geometry !== entry.geometry || entry.part.castShadow !== entry.castShadow ||
                entry.part.receiveShadow !== entry.receiveShadow || entry.part.renderOrder !== entry.renderOrder ||
                entry.part.layers.mask !== entry.layers || !belongsTo(entry.part, root) ||
                entry.part.matrixWorld.determinant() <= 0)) { restore(bucket); continue; }
            if (bucket.mesh?.userData.equipmentBatchDisposed) { bucket.mesh.removeFromParent(); bucket.mesh = null; }
            if (!bucket.mesh) createBatch(root, bucket);
            const batch = bucket.mesh;
            for (const entry of bucket.entries) {
                matrix.multiplyMatrices(inverse, entry.part.matrixWorld);
                if (!entry.matrix?.equals(matrix)) {
                    batch.setMatrixAt(entry.instance, matrix);
                    (entry.matrix ??= new Matrix4()).copy(matrix); matrixUploads++;
                }
                batch.setVisibleAt(entry.instance, parentsVisible(entry.part, root));
                entry.part.visible = false;
            }
            bucket.active = true; batch.visible = true;
            activeBatches++;
        }
    });
    if (started !== null) scene.userData.equipmentBatchProfile = { cpuMs: performance.now() - started, matrixUploads, activeBatches };
}
