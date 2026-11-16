import * as THREE from 'three';
import { createOpaqueSkinnedColorGeometry, groupOpaqueSkinnedColorMeshes,
    haveCompatibleOpaqueSkinnedColorState } from './OpaqueSkinnedColorGeometry.js';

const owners = new WeakMap();
const under = (node, ancestor) => { for (; node; node = node.parent) if (node === ancestor) return true; return false; };
const visible = node => { for (; node; node = node.parent) if (!node.visible) return false; return true; };
const attributeState = attribute => ({ attribute, array: attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array,
    version: attribute.isInterleavedBufferAttribute ? attribute.data.version : attribute.version,
    offset: attribute.offset, stride: attribute.data?.stride, count: attribute.count,
    itemSize: attribute.itemSize, normalized: attribute.normalized, gpuType: attribute.gpuType });
const sameAttribute = (attribute, saved) => {
    if (!attribute) return false;
    // Preserve every live layout/storage/version check without constructing
    // temporary snapshots and entry tuples for each source draw.
    const array = attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array;
    const version = attribute.isInterleavedBufferAttribute ? attribute.data.version : attribute.version;
    const offset = attribute.offset, stride = attribute.data?.stride, count = attribute.count;
    const itemSize = attribute.itemSize, normalized = attribute.normalized, gpuType = attribute.gpuType;
    return Object.is(attribute, saved.attribute) && Object.is(array, saved.array) &&
        Object.is(version, saved.version) && Object.is(offset, saved.offset) &&
        Object.is(stride, saved.stride) && Object.is(count, saved.count) &&
        Object.is(itemSize, saved.itemSize) && Object.is(normalized, saved.normalized) &&
        Object.is(gpuType, saved.gpuType);
};
const geometryState = geometry => ({ geometry, index: attributeState(geometry.index),
    attributes: Object.entries(geometry.attributes).map(([name, attribute]) => [name, attributeState(attribute)]) });
const sameGeometry = (geometry, saved) => geometry === saved.geometry && geometry.index &&
    sameAttribute(geometry.index, saved.index) && Object.keys(geometry.attributes).length === saved.attributes.length &&
    saved.attributes.every(([name, attribute]) => sameAttribute(geometry.attributes[name], attribute)) &&
    !geometry.groups.length && geometry.drawRange.start === 0 && geometry.drawRange.count === Infinity &&
    Object.values(geometry.morphAttributes).every(values => !values.length);
const sourceState = mesh => ({ mesh, ...geometryState(mesh.geometry), material: mesh.material,
    skeleton: mesh.skeleton, bones: mesh.skeleton.bones.slice() });
const sameSource = saved => saved.mesh.material === saved.material && saved.mesh.skeleton === saved.skeleton &&
    saved.mesh.skeleton.bones.length === saved.bones.length && saved.bones.every((bone, i) => saved.mesh.skeleton.bones[i] === bone) &&
    sameGeometry(saved.mesh.geometry, saved);
const sameValues = (a, b) => a.length === b.length && a.every((value, i) => Object.is(value, b[i]));

// Explicit registered roots only. No automatic scene registration or default
// activation. Geometry is owned; every material, skeleton and source stays borrowed.
export class OpaqueSkinnedColorBatches {
    constructor(renderer, scene, camera, { prepare = null } = {}) {
        if (owners.has(renderer) || typeof renderer.render !== 'function' || typeof renderer.renderBufferDirect !== 'function' ||
            !scene?.isScene || !camera?.isOrthographicCamera) throw new Error('One orthographic opaque color owner per renderer required');
        this.renderer = renderer; this.scene = scene; this.camera = camera; this.prepare = prepare;
        this.roots = new Map(); this.entries = new Map(); this.ownedProxies = new WeakSet(); this.retired = new WeakSet();
        this.enabled = true; this.disposed = false; this.context = null; this.suspended = 0;
        this.lastBatches = 0; this.lastSavedSubmissions = 0;
        this.frustum = new THREE.Frustum(); this.projection = new THREE.Matrix4();
        this.originalRender = renderer.render; this.originalDirect = renderer.renderBufferDirect; this.originalBefore = scene.onBeforeRender;
        this.beforeDescriptor = Object.getOwnPropertyDescriptor(scene, 'onBeforeRender');
        this.renderDescriptor = Object.getOwnPropertyDescriptor(renderer, 'render');
        this.directDescriptor = Object.getOwnPropertyDescriptor(renderer, 'renderBufferDirect');
        this.beforeWrapper = (...args) => {
            const result = this.originalBefore.apply(scene, args);
            if (!this.disposed && !this.suspended && this.context && args[0] === renderer && args[2] === camera) this.activate();
            return result;
        };
        this.directWrapper = (...args) => this.renderDirect(args);
        this.renderWrapper = (...args) => this.render(args);
        try {
            scene.onBeforeRender = this.beforeWrapper; renderer.renderBufferDirect = this.directWrapper; renderer.render = this.renderWrapper;
        } catch (error) { this.restoreHooks(); throw error; }
        owners.set(renderer, this);
    }

    register(root) {
        if (!this.disposed && root && under(root, this.scene) && !this.roots.has(root)) this.roots.set(root, null);
    }

    refresh(root) {
        if (!this.roots.has(root)) return;
        for (const entry of [...this.entries.values()]) if (entry.root === root) this.retire(entry);
        this.roots.set(root, null);
    }

    unregister(root) {
        this.refresh(root); this.roots.delete(root);
    }

    retire(entry) {
        if (entry.retired) return;
        entry.retired = true; entry.proxy.removeFromParent(); this.entries.delete(entry.key);
        for (const geometry of entry.listening) geometry.removeEventListener('dispose', entry.sourceDisposed);
        entry.listening.clear(); if (!entry.candidateDisposed) entry.geometry.dispose();
    }

    create(root, meshes, key) {
        if (meshes.some(mesh => this.retired.has(mesh.geometry))) return null;
        let geometry;
        try { geometry = createOpaqueSkinnedColorGeometry(meshes); } catch { return null; }
        const proxy = new THREE.SkinnedMesh(geometry, meshes[0].material);
        proxy.name = 'OpaqueSkinnedColorBatch'; proxy.castShadow = false; proxy.frustumCulled = false;
        proxy.matrixAutoUpdate = false; proxy.matrixWorldAutoUpdate = false;
        const entry = { key, root, meshes, proxy, geometry, candidate: geometryState(geometry),
            sources: meshes.map(sourceState), listening: new Set(meshes.map(mesh => mesh.geometry)), retired: false };
        entry.sourceDisposed = event => { this.retired.add(event.target); this.retire(entry); };
        for (const source of entry.listening) source.addEventListener('dispose', entry.sourceDisposed);
        geometry.addEventListener('dispose', () => { entry.candidateDisposed = true; });
        this.ownedProxies.add(proxy); this.entries.set(key, entry); return entry;
    }

    valid(entry) {
        return !entry.retired && !entry.candidateDisposed && this.roots.has(entry.root) && under(entry.root, this.scene) &&
            entry.proxy.material === entry.sources[0].material && entry.proxy.visible && !entry.proxy.castShadow && !entry.proxy.frustumCulled &&
            !entry.proxy.matrixAutoUpdate && !entry.proxy.matrixWorldAutoUpdate &&
            entry.proxy.onBeforeRender === THREE.Object3D.prototype.onBeforeRender &&
            entry.proxy.onAfterRender === THREE.Object3D.prototype.onAfterRender &&
            entry.proxy.geometry === entry.geometry && sameGeometry(entry.geometry, entry.candidate) &&
            entry.sources.every(source => under(source.mesh, entry.root) && sameSource(source)) &&
            haveCompatibleOpaqueSkinnedColorState(entry.meshes);
    }

    eligible(entry) {
        return this.valid(entry) && entry.meshes.every(mesh => this.camera.layers.test(mesh.layers) &&
            (!mesh.frustumCulled || this.frustum.intersectsObject(mesh)));
    }

    activate() {
        if (!this.enabled || !this.context) return;
        this.prepare?.(); this.lastBatches = 0; this.lastSavedSubmissions = 0;
        this.projection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.projection, this.camera.coordinateSystem, this.renderer.reversedDepthBuffer);
        const used = new Set();
        for (const [root, savedGroups] of this.roots) {
            if (!under(root, this.scene)) { this.unregister(root); continue; }
            // A hidden initial/equip generation has no visible groups yet.
            // Defer discovery instead of permanently caching that empty list.
            if (!visible(root)) continue;
            const groups = savedGroups || groupOpaqueSkinnedColorMeshes(root);
            if (!savedGroups) this.roots.set(root, groups);
            for (const meshes of groups) {
                const key = `${root.id}:${meshes.map(mesh => mesh.id).join(',')}`;
                if (!meshes.every(mesh => under(mesh, root)) || !haveCompatibleOpaqueSkinnedColorState(meshes)) continue;
                used.add(key); let entry = this.entries.get(key);
                if (entry && !this.valid(entry)) { this.retire(entry); entry = null; }
                if (!entry) entry = this.create(root, meshes, key);
                if (!entry || !this.eligible(entry)) continue;
                const first = meshes[0], proxy = entry.proxy;
                proxy.skeleton = first.skeleton; proxy.bindMode = first.bindMode;
                proxy.bindMatrix.copy(first.bindMatrix); proxy.bindMatrixInverse.copy(first.bindMatrixInverse);
                proxy.matrix.copy(first.matrix); proxy.matrixWorld.copy(first.matrixWorld);
                proxy.layers.mask = first.layers.mask; proxy.receiveShadow = first.receiveShadow; proxy.renderOrder = first.renderOrder;
                first.parent.add(proxy); this.context.active.push(entry); this.context.proxies.set(proxy, entry);
                for (const mesh of meshes) this.context.sources.set(mesh, entry);
                this.lastBatches++; this.lastSavedSubmissions += meshes.length - 1;
            }
        }
        for (const [key, entry] of this.entries) if (!used.has(key)) this.retire(entry);
    }

    drawValid(entry) {
        const first = entry.meshes[0];
        return this.valid(entry) && entry.proxy.material === first.material && entry.proxy.skeleton === first.skeleton &&
            entry.proxy.bindMode === first.bindMode && entry.proxy.receiveShadow === first.receiveShadow &&
            entry.proxy.layers.mask === first.layers.mask && entry.proxy.renderOrder === first.renderOrder &&
            entry.proxy.visible && !entry.proxy.castShadow && !entry.proxy.frustumCulled &&
            sameValues(entry.proxy.matrixWorld.elements, first.matrixWorld.elements) &&
            sameValues(entry.proxy.bindMatrix.elements, first.bindMatrix.elements) &&
            sameValues(entry.proxy.bindMatrixInverse.elements, first.bindMatrixInverse.elements);
    }

    renderDirect(args) {
        const [camera, scene, geometry, material, object, group] = args, context = this.context;
        const target = !this.disposed && !this.suspended && context && camera === this.camera && scene === this.scene;
        if (this.ownedProxies.has(object)) {
            const entry = target && context.proxies.get(object);
            if (!entry || !this.drawValid(entry)) return;
        } else if (target && group === null) {
            const entry = context.sources.get(object);
            if (entry && geometry === object.geometry && material === object.material && this.drawValid(entry)) return;
        }
        return this.originalDirect.apply(this.renderer, args);
    }

    end(context) {
        for (const entry of context.active) entry.proxy.removeFromParent();
        context.active.length = 0; context.sources.clear(); context.proxies.clear();
    }

    render(args) {
        if (this.disposed) return this.originalRender.apply(this.renderer, args);
        if (this.context) {
            const context = this.context, parents = context.active.map(entry => [entry, entry.proxy.parent]);
            for (const [entry] of parents) entry.proxy.removeFromParent(); this.suspended++;
            try { return this.originalRender.apply(this.renderer, args); }
            finally {
                this.suspended--;
                for (const [entry, parent] of parents) if (parent && this.valid(entry)) parent.add(entry.proxy);
            }
        }
        if (args[0] !== this.scene || args[1] !== this.camera || !this.enabled) return this.originalRender.apply(this.renderer, args);
        const context = { active: [], sources: new Map(), proxies: new Map() }; this.context = context;
        try { return this.originalRender.apply(this.renderer, args); }
        finally { this.end(context); this.context = null; if (this.restorePending) this.restoreHooks(); }
    }

    reset() { for (const root of this.roots.keys()) this.refresh(root); }
    clear() { for (const root of [...this.roots.keys()]) this.unregister(root); }

    restoreHooks() {
        for (const [target, key, wrapper, descriptor] of [
            [this.scene, 'onBeforeRender', this.beforeWrapper, this.beforeDescriptor],
            [this.renderer, 'renderBufferDirect', this.directWrapper, this.directDescriptor],
            [this.renderer, 'render', this.renderWrapper, this.renderDescriptor]
        ]) if (target[key] === wrapper) {
            if (descriptor) Object.defineProperty(target, key, descriptor); else delete target[key];
        }
        this.restorePending = false;
        if (owners.get(this.renderer) === this) owners.delete(this.renderer);
    }

    dispose() {
        if (this.disposed) return; this.disposed = true;
        if (this.context) this.end(this.context); this.clear();
        if (this.context) this.restorePending = true; else this.restoreHooks();
    }
}
