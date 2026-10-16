import { BatchedMesh, Frustum, Group, Matrix4, Vector4 } from 'three';
import { BatchedMaterialVariants } from './BatchedMaterialVariants.js';

const ownedSorts = new WeakMap();
// Identity, rather than a userData flag, qualifies this module's existing
// camera-local sorting callback. Replaced or foreign callbacks stay unknown.
export const hasOwnedActorBatchSort = mesh => ownedSorts.has(mesh) && ownedSorts.get(mesh) === mesh.customSort;

const layout = geometry => JSON.stringify([Boolean(geometry.index), Object.entries(geometry.attributes).map(([name, attr]) =>
    [name, attr.itemSize, attr.normalized, attr.array.constructor.name])]);
const safeGeometry = geometry => geometry?.attributes.position && !geometry.groups.length &&
    geometry.drawRange.start === 0 && geometry.drawRange.count === Infinity && !Object.keys(geometry.morphAttributes).length &&
    Object.values(geometry.attributes).every(attr => !attr.isInterleavedBufferAttribute && !attr.isInstancedBufferAttribute &&
        attr.count === geometry.attributes.position.count && attr.array instanceof Float32Array);


// Private opt-in delivery for already-qualified float32 actor instance buffers.
// Each original cell origin, geometry, material, instance matrix and per-camera
// bucket culling decision is retained. Stock BatchedMesh owns its copied vertex
// buffer and matrix/indirection textures; source buffers/materials stay borrowed.
export class ActorInstanceMultiDraw {
    constructor(parent) {
        this.group = new Group(); this.group.name = 'ActorInstanceMultiDraw'; this.group.visible = false;
        parent.add(this.group); this.entries = new Map(); this.hidden = [];
        this.frustum = new Frustum(); this.projection = new Matrix4(); this.matrix = new Matrix4();
        this.enabled = true; this.perInstanceFrustum = false; this.identities = new WeakMap(); this.nextIdentity = 0;
        this.materialVariants = false; this.materialVariantPool = new BatchedMaterialVariants();
    }

    geometryVersion(geometry) {
        const identity = object => {
            if (!object) return null;
            if (!this.identities.has(object)) this.identities.set(object, ++this.nextIdentity);
            return this.identities.get(object);
        };
        const attribute = attr => attr ? [identity(attr), identity(attr.array), attr.version, attr.count] : null;
        return [geometry.uuid, attribute(geometry.index), Object.entries(geometry.attributes).map(([name, attr]) => [name, attribute(attr)])];
    }

    beginFrame(renderer, camera, sources) {
        this.endFrame();
        this.materialVariantPool.beginFrame();
        if (this.disposed || !this.enabled || !renderer?.extensions?.has('WEBGL_multi_draw') || camera?.isArrayCamera) {
            this.clearEntries(); return;
        }
        this.colorCamera = camera;
        const groups = new Map();
        for (const source of sources) {
            if (!source.visible || !source.isInstancedMesh || source.morphTexture || !safeGeometry(source.geometry)) continue;
            const key = JSON.stringify([source.matrixWorld.elements, source.material.uuid, source.castShadow,
                source.receiveShadow, source.layers.mask, source.renderOrder, source.frustumCulled, layout(source.geometry)]);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(source);
        }
        const used = new Set();
        try {
            for (const [key, group] of groups) {
                if (group.length < 2) continue;
                used.add(key);
                const material = this.materialVariants ? this.materialVariantPool.use(group[0].material) : group[0].material;
                const geometries = [...new Set(group.map(source => source.geometry))];
                const signature = JSON.stringify([geometries.map(geometry => this.geometryVersion(geometry)), group.map(source =>
                    [source.uuid, source.instanceMatrix.count])]);
                let entry = this.entries.get(key);
                if (entry && entry.signature !== signature) { entry.mesh.removeFromParent(); entry.mesh.dispose(); this.entries.delete(key); entry = null; }
                if (!entry) {
                    const capacity = group.reduce((n, source) => n + source.instanceMatrix.count, 0);
                    const vertices = geometries.reduce((n, geometry) => n + geometry.attributes.position.count, 0);
                    const indices = geometries[0].index ? geometries.reduce((n, geometry) => n + geometry.index.count, 0) : 0;
                    const mesh = new BatchedMesh(capacity, vertices, indices, material);
                    mesh.name = 'ActorCellMultiDraw'; mesh.matrixAutoUpdate = false; mesh.frustumCulled = false;
                    mesh.perObjectFrustumCulled = false;
                    mesh.castShadow = group[0].castShadow; mesh.receiveShadow = group[0].receiveShadow;
                    mesh.layers.mask = group[0].layers.mask; mesh.renderOrder = group[0].renderOrder;
                    const ids = new Map(geometries.map(geometry => [geometry, mesh.addGeometry(geometry)]));
                    const owners = [], sourceSlots = group.map(source => {
                        const slots = [];
                        for (let i = 0; i < source.instanceMatrix.count; i++) {
                            const id = mesh.addInstance(ids.get(source.geometry));
                            owners[id] = source; slots.push(id); mesh.setVisibleAt(id, false);
                        }
                        return { source, slots };
                    });
                    // Cull whole original buckets with Three's same sphere
                    // test. Keep original object-id/instance order for equal
                    // material/origin color submissions. Shadow passes retain scene order.
                    mesh.setCustomSort((list, passCamera) => {
                        this.projection.multiplyMatrices(passCamera.projectionMatrix, passCamera.matrixWorldInverse);
                        this.frustum.setFromProjectionMatrix(this.projection, passCamera.coordinateSystem, passCamera.reversedDepth);
                        const visible = new Map(group.map(source => [source,
                            !source.frustumCulled || this.frustum.intersectsObject(source)]));
                        let count = 0;
                        for (const row of list) if (visible.get(owners[row.index])) list[count++] = row;
                        list.length = count;
                        const depth = new Map();
                        if (passCamera === this.colorCamera) for (const source of group) depth.set(source,
                            new Vector4().copy(source.boundingSphere.center).applyMatrix4(source.matrixWorld).applyMatrix4(this.projection).z);
                        list.sort((a, b) => (depth.get(owners[a.index]) || 0) - (depth.get(owners[b.index]) || 0) ||
                            owners[a.index].id - owners[b.index].id || a.index - b.index);
                    });
                    ownedSorts.set(mesh, mesh.customSort);
                    entry = { mesh, signature, sourceSlots }; this.entries.set(key, entry); this.group.add(mesh);
                }
                // Optional stock per-instance clipping follows the same pass
                // camera. Displaced geometry and explicit no-cull buckets keep
                // the qualified whole-original-bucket path.
                entry.mesh.material = material;
                entry.mesh.perObjectFrustumCulled = this.perInstanceFrustum &&
                    group[0].frustumCulled && !group[0].material.displacementMap;
                entry.mesh.matrixWorld.copy(group[0].matrixWorld);
                for (const { source, slots } of entry.sourceSlots) {
                    for (let i = 0; i < slots.length; i++) {
                        entry.mesh.setVisibleAt(slots[i], i < source.count);
                        if (i < source.count) { source.getMatrixAt(i, this.matrix); entry.mesh.setMatrixAt(slots[i], this.matrix); }
                    }
                    this.hidden.push(source); source.visible = false;
                }
                entry.mesh.visible = true;
            }
            for (const [key, entry] of this.entries) if (!used.has(key)) {
                entry.mesh.removeFromParent(); entry.mesh.dispose(); this.entries.delete(key);
            }
            this.materialVariantPool.endFrame();
            this.group.visible = used.size > 0;
        } catch (error) { this.endFrame(); this.clearEntries(); throw error; }
    }

    endFrame() {
        for (const source of this.hidden) source.visible = true;
        this.hidden.length = 0; this.group.visible = false;
    }

    clearEntries() {
        for (const { mesh } of this.entries.values()) { mesh.removeFromParent(); mesh.dispose(); }
        this.entries.clear();
        this.materialVariantPool.clear();
    }

    clear() { this.endFrame(); this.clearEntries(); }
    dispose() { if (this.disposed) return; this.disposed = true; this.clear(); this.group.removeFromParent(); }
}
