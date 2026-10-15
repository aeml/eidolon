import { BatchedMesh, Group, Matrix4, Frustum, Vector4, Object3D } from 'three';
import { shadowInfluenceIntersectsFrustum } from '../core/FoliageShadowInfluence.js';

const sorts = new WeakMap();
export const hasOwnedFoliageDrawSort = mesh => sorts.get(mesh) === mesh.customSort && sorts.has(mesh);
const roots = new WeakMap();
export const getOwnedFoliageDraws = root => roots.get(root);
class OwnedBatch extends BatchedMesh {
    dispose() { if (this.disposed) return; this.disposed = true; super.dispose(); }
}
const identity = new Matrix4();
const layout = geometry => JSON.stringify([Boolean(geometry.index), Object.entries(geometry.attributes).map(([name, a]) =>
    [name, a.itemSize, a.normalized, a.array.constructor.name, a.gpuType])]);

// World construction owns these static placement records. This is not a live
// adapter for arbitrary scene meshes: callers keep mutable scenery on Three's
// ordinary path. The detached construction cells support quality rebuilding;
// only the returned group belongs to the live scene. Original cell spheres,
// swept-shadow bounds and Float32 placements remain unchanged.
export class OwnedFoliageDraws {
    constructor(source, influence, colorCamera) {
        if (!source.userData.proceduralFoliage || source.children.some(mesh => !mesh.isInstancedMesh ||
            mesh.children.length || mesh.instanceColor || mesh.customDepthMaterial || mesh.customDistanceMaterial ||
            mesh.onBeforeRender !== Object3D.prototype.onBeforeRender || mesh.onAfterRender !== Object3D.prototype.onAfterRender ||
            mesh.onBeforeShadow !== Object3D.prototype.onBeforeShadow || mesh.onAfterShadow !== Object3D.prototype.onAfterShadow ||
            mesh.frustumCulled === false || !mesh.boundingBox || !mesh.boundingSphere || mesh.matrixAutoUpdate ||
            !mesh.matrix.equals(identity) || Array.isArray(mesh.material) || mesh.material.transparent || mesh.material.userData.woodlandWind)) {
            throw Error('Static constructor-owned foliage cells required');
        }
        this.group = new Group(); this.group.name = source.name;
        this.group.userData = { ...source.userData, ownedFoliageDraws: true };
        this.group.position.copy(source.position); this.group.quaternion.copy(source.quaternion); this.group.scale.copy(source.scale);
        this.group.matrix.copy(source.matrix); this.group.matrixAutoUpdate = source.matrixAutoUpdate;
        this.group.layers.mask = source.layers.mask; this.group.renderOrder = source.renderOrder; this.group.visible = source.visible;
        this.entries = []; this.influence = influence; this.colorCamera = colorCamera;
        this.source = source; roots.set(this.group, this);
        this.build();
    }

    build() {
        const source = this.source;
        const groups = new Map();
        for (const mesh of source.children) {
            const key = JSON.stringify([mesh.material.uuid, mesh.castShadow, mesh.receiveShadow, mesh.layers.mask,
                mesh.renderOrder, layout(mesh.geometry)]);
            if (!groups.has(key)) groups.set(key, []); groups.get(key).push(mesh);
        }
        const matrix = new Matrix4();
        try {
            for (const cells of groups.values()) {
                const geometries = [...new Set(cells.map(cell => cell.geometry))];
                const count = cells.reduce((sum, cell) => sum + cell.count, 0);
                const mesh = new OwnedBatch(count, geometries.reduce((sum, geometry) => sum + geometry.attributes.position.count, 0),
                    geometries[0].index ? geometries.reduce((sum, geometry) => sum + geometry.index.count, 0) : 0, cells[0].material);
                mesh.name = 'ConstructorOwnedFoliageDraws'; mesh.matrixAutoUpdate = false;
                mesh.frustumCulled = false; mesh.perObjectFrustumCulled = false; mesh.sortObjects = true;
                mesh.castShadow = cells[0].castShadow; mesh.receiveShadow = cells[0].receiveShadow;
                mesh.layers.mask = cells[0].layers.mask; mesh.renderOrder = cells[0].renderOrder;
                this.group.add(mesh);
                const entry = { mesh, matrix: new Matrix4(), matrixValid: false, revision: 0,
                    cells: [], owners: [], views: new WeakMap() };
                this.entries.push(entry);
                const ids = new Map(geometries.map(geometry => [geometry, mesh.addGeometry(geometry)]));
                for (const sourceCell of cells) {
                    const cell = { id: sourceCell.id, visible: sourceCell.visible, sphere: sourceCell.boundingSphere.clone(),
                        box: sourceCell.boundingBox.clone(), worldSphere: sourceCell.boundingSphere.clone(),
                        worldBox: sourceCell.boundingBox.clone() };
                    const index = entry.cells.length; entry.cells.push(cell);
                    for (let i = 0; i < sourceCell.count; i++) {
                        const id = mesh.addInstance(ids.get(sourceCell.geometry)); sourceCell.getMatrixAt(i, matrix);
                        mesh.setMatrixAt(id, matrix); entry.owners[id] = index;
                    }
                }
                const sort = (list, camera) => this.sort(entry, list, camera);
                mesh.setCustomSort(sort); sorts.set(mesh, sort);
            }
        } catch (error) { this.dispose(); throw error; }
    }

    sort(entry, list, camera) {
        const { mesh, cells, owners } = entry;
        if (!entry.matrixValid || !entry.matrix.equals(mesh.matrixWorld)) {
            entry.matrix.copy(mesh.matrixWorld); entry.matrixValid = true; entry.revision++;
            for (const cell of cells) {
                cell.worldSphere.copy(cell.sphere).applyMatrix4(mesh.matrixWorld);
                cell.worldBox.copy(cell.box).applyMatrix4(mesh.matrixWorld);
            }
        }
        let view = entry.views.get(camera);
        if (!view) {
            view = { projection: new Matrix4(), current: new Matrix4(), frustum: new Frustum(), point: new Vector4(),
                revision: -1, shadowRevision: -1, visible: [], depths: [] };
            entry.views.set(camera, view);
        }
        const influence = this.influence;
        const shadows = Boolean(this.group.userData.region === 'earth' && !mesh.material.userData.woodlandWind && mesh.castShadow && influence.enabled && !influence.disposed && influence.shadowActive);
        view.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        if (view.revision !== entry.revision || view.shadows !== shadows || view.shadowRevision !== influence.shadowRevision ||
            !view.projection.equals(view.current) || view.coordinates !== camera.coordinateSystem || view.reversed !== camera.reversedDepth) {
            view.projection.copy(view.current); view.revision = entry.revision;
            view.shadows = shadows; view.shadowRevision = influence.shadowRevision;
            view.coordinates = camera.coordinateSystem; view.reversed = camera.reversedDepth;
            view.frustum.setFromProjectionMatrix(view.current, view.coordinates, view.reversed);
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                view.visible[i] = cell.visible && view.frustum.intersectsSphere(cell.worldSphere) &&
                    (!shadows || shadowInfluenceIntersectsFrustum(cell.worldBox, influence.sun, influence.frustum));
                const point = view.point.set(cell.worldSphere.center.x, cell.worldSphere.center.y, cell.worldSphere.center.z, 1).applyMatrix4(view.current);
                view.depths[i] = camera === this.colorCamera ? point.z / point.w : 0;
            }
        }
        let length = 0;
        for (const row of list) if (view.visible[owners[row.index]]) list[length++] = row;
        list.length = length;
        list.sort((a, b) => view.depths[owners[a.index]] - view.depths[owners[b.index]] ||
            cells[owners[a.index]].id - cells[owners[b.index]].id || a.index - b.index);
    }

    rebuild(update) {
        if (this.disposed) return;
        // Construct replacement buffers before releasing the current renderer
        // ownership. The returned root, placement metadata and colliders stay.
        update(this.source);
        const replacement = new OwnedFoliageDraws(this.source, this.influence, this.colorCamera);
        for (const { mesh } of this.entries) { sorts.delete(mesh); mesh.dispose(); }
        this.group.clear();
        // Sort callbacks belong to the replacement owner; retain the same live
        // root so its transforms/visibility and world registration survive.
        this.group.add(...replacement.group.children);
        replacement.group = this.group;
        roots.set(this.group, replacement);
        this.group.userData.foliageQuality = this.source.userData.foliageQuality;
        this.entries = []; this.disposed = true;
        return replacement;
    }

    dispose() {
        if (this.disposed) return; this.disposed = true;
        roots.delete(this.group); this.group.removeFromParent();
        for (const { mesh } of this.entries) { sorts.delete(mesh); mesh.dispose(); }
        this.group.clear(); this.entries.length = 0;
    }
}
