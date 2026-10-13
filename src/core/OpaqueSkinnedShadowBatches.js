import * as THREE from 'three';
import { hasOwnedActorBatchSort } from '../art/ActorInstanceMultiDraw.js';
import { groupOpaqueSkinnedShadowMeshes, createOpaqueSkinnedShadowGeometry,
    haveCompatibleOpaqueSkinnedShadowState } from './OpaqueSkinnedShadowGeometry.js';
import { groupOpaqueStaticShadowMeshes, createOpaqueStaticShadowGeometry,
    haveCompatibleOpaqueStaticShadowState } from './OpaqueStaticShadowGeometry.js';

const stockShadow = new THREE.DirectionalLight().shadow;
const names = ['position', 'skinIndex', 'skinWeight'];
const equal = (a, b) => a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
const attributeState = attribute => attribute ? ({ attribute, array: attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array,
    buffer: attribute.isInterleavedBufferAttribute ? attribute.data : attribute,
    version: attribute.isInterleavedBufferAttribute ? attribute.data.version : attribute.version,
    offset: attribute.offset, stride: attribute.data?.stride, itemSize: attribute.itemSize,
    count: attribute.count, normalized: attribute.normalized, gpuType: attribute.gpuType }) : null;
const sameAttribute = (attribute, saved) => {
    if (!attribute || !saved) return !attribute && !saved;
    // These checks run for every live source and proxy. Read the same fields
    // without allocating a snapshot and entry tuples on each validation.
    const array = attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array;
    const buffer = attribute.isInterleavedBufferAttribute ? attribute.data : attribute;
    const version = attribute.isInterleavedBufferAttribute ? attribute.data.version : attribute.version;
    const offset = attribute.offset, stride = attribute.data?.stride, itemSize = attribute.itemSize;
    const count = attribute.count, normalized = attribute.normalized, gpuType = attribute.gpuType;
    return Object.is(attribute, saved.attribute) && Object.is(array, saved.array) &&
        Object.is(buffer, saved.buffer) && Object.is(version, saved.version) &&
        Object.is(offset, saved.offset) && Object.is(stride, saved.stride) &&
        Object.is(itemSize, saved.itemSize) && Object.is(count, saved.count) &&
        Object.is(normalized, saved.normalized) && Object.is(gpuType, saved.gpuType);
};
const geometryState = (geometry, attributes = names, ignoreGroups = false) => ({ geometry, names: attributes, ignoreGroups,
    index: attributeState(geometry.index), attributes: attributes.map(name => attributeState(geometry.attributes[name])) });
const sameGeometry = (geometry, saved) => geometry === saved.geometry && sameAttribute(geometry.index, saved.index) &&
    saved.names.every((name, i) => sameAttribute(geometry.attributes[name], saved.attributes[i])) &&
    (saved.ignoreGroups || geometry.groups.length === 0) && geometry.drawRange.start === 0 && geometry.drawRange.count === Infinity &&
    Object.values(geometry.morphAttributes).every(values => values.length === 0);
const visibleIn = (mesh, scene) => {
    for (let node = mesh; node; node = node.parent) {
        if (!node.visible) return false;
        if (node === scene) return true;
    }
    return false;
};
const connectedTo = (mesh, scene) => {
    for (let node = mesh; node; node = node.parent) if (node === scene) return true;
    return false;
};
const stockBatchShadow = object => object.isBatchedMesh &&
    object.onBeforeShadow === THREE.BatchedMesh.prototype.onBeforeShadow &&
    object.onBeforeRender === THREE.BatchedMesh.prototype.onBeforeRender &&
    object.onAfterShadow === THREE.Object3D.prototype.onAfterShadow &&
    (object.customSort === null || hasOwnedActorBatchSort(object));

// RenderSystem owns the runtime that registers these proxies. Each proxy is
// inserted after color projection, only for a stock directional shadow viewport.
// Every source triangle remains; originals return before the color pass.
export class OpaqueSkinnedShadowBatches {
    constructor(renderer, scene, { prepare = null, includeStatic = false } = {}) {
        if (typeof renderer.shadowMap?.render !== 'function' || typeof renderer.render !== 'function') throw new Error('Stock renderer shadow boundary required');
        this.renderer = renderer; this.scene = scene; this.shadowMap = renderer.shadowMap;
        this.originalShadow = this.shadowMap.render; this.originalRender = renderer.render;
        this.entries = new Set(); this.claimed = new Map(); this.active = [];
        this.depth = 0; this.suspended = 0; this.enabled = true; this.disposed = false;
        this.lastBatches = 0; this.lastSavedSubmissions = 0;
        this.prepare = prepare;
        // Isolated opt-in until static scene registration/native proof qualifies.
        // Share one directional boundary so existing skin batches still run.
        this.includeStatic = includeStatic;
        this.shadowWrapper = (...args) => this.renderShadows(args);
        this.renderWrapper = (...args) => this.depth
            ? this.withOriginals(() => this.originalRender.apply(renderer, args))
            : this.originalRender.apply(renderer, args);
        this.shadowMap.render = this.shadowWrapper; renderer.render = this.renderWrapper;
    }

    register(root, { staticOnly = false } = {}) {
        if (this.depth) throw new Error('Register shadow batches between renderer passes');
        if (this.disposed || !connectedTo(root, this.scene)) return 0;
        let count = 0;
        const groups = staticOnly ? [] : groupOpaqueSkinnedShadowMeshes(root).map(meshes => ({ meshes, isStatic: false }));
        if (staticOnly || this.includeStatic) groups.push(...groupOpaqueStaticShadowMeshes(root).map(meshes => ({ meshes, isStatic: true })));
        for (const { meshes, isStatic } of groups) {
            if (meshes.some(mesh => this.claimed.has(mesh))) continue;
            let geometry;
            try { geometry = isStatic ? createOpaqueStaticShadowGeometry(meshes) : createOpaqueSkinnedShadowGeometry(meshes); } catch { continue; }
            const material = new THREE.MeshBasicMaterial({ side: meshes[0].material.side });
            material.shadowSide = meshes[0].material.shadowSide;
            const proxy = isStatic ? new THREE.Mesh(geometry, material) : new THREE.SkinnedMesh(geometry, material);
            proxy.name = isStatic ? 'OpaqueStaticShadowBatch' : 'OpaqueSkinnedShadowBatch'; proxy.castShadow = true;
            proxy.frustumCulled = false; proxy.matrixAutoUpdate = false; proxy.matrixWorldAutoUpdate = false;
            const palettes = new Map();
            const palette = skeleton => {
                if (!palettes.has(skeleton)) palettes.set(skeleton, { skeleton, bones: skeleton.bones.slice(),
                    inverses: skeleton.boneInverses.map(matrix => matrix.elements.slice()) });
                return palettes.get(skeleton);
            };
            const attributes = isStatic ? ['position'] : names;
            const entry = { meshes, proxy, geometry, material, isStatic, candidate: geometryState(geometry, attributes), sources: meshes.map(mesh => ({
                mesh, ...geometryState(mesh.geometry, attributes, isStatic), ...(isStatic ? {} : {
                    ...palette(mesh.skeleton), bindMode: mesh.bindMode, bind: mesh.bindMatrix.elements.slice()
                })
            })) };
            entry.retire = () => this.unregister(entry);
            for (const source of new Set(meshes.map(mesh => mesh.geometry))) source.addEventListener('dispose', entry.retire);
            this.entries.add(entry); for (const mesh of meshes) this.claimed.set(mesh, entry);
            count++;
        }
        return count;
    }

    valid(entry) {
        // Captured palette snapshots are shared by sources with the same
        // skeleton. Validate each live palette once per synchronous call.
        const palettes = new Set();
        return this.entries.has(entry) && entry.proxy.material === entry.material && sameGeometry(entry.proxy.geometry, entry.candidate) &&
            entry.sources.every(source => {
                const { mesh, skeleton } = source;
                if (!connectedTo(mesh, this.scene) || !sameGeometry(mesh.geometry, source)) return false;
                if (entry.isStatic) return true;
                if (mesh.skeleton !== skeleton || mesh.bindMode !== source.bindMode || !equal(mesh.bindMatrix.elements, source.bind)) return false;
                if (palettes.has(skeleton)) return true;
                palettes.add(skeleton);
                return equal(skeleton.bones, source.bones) && skeleton.boneInverses.length === source.inverses.length &&
                    skeleton.boneInverses.every((matrix, i) => equal(matrix.elements, source.inverses[i]));
            });
    }

    unregister(entry) {
        if (!this.entries.delete(entry)) return;
        this.restore([entry]); this.active = this.active.filter(current => current !== entry);
        for (const source of new Set(entry.sources.map(source => source.geometry))) source.removeEventListener('dispose', entry.retire);
        for (const mesh of entry.meshes) this.claimed.delete(mesh);
        entry.geometry.dispose(); entry.material.dispose();
        // The shared original skeleton and its bone texture are never owned here.
    }

    restore(entries) {
        for (const entry of entries) {
            entry.proxy.removeFromParent();
            if (entry.swapped) for (const mesh of entry.meshes) mesh.castShadow = true;
            entry.swapped = false;
        }
    }

    activate(entries, frustum, camera) {
        for (const entry of entries) {
            if (!this.valid(entry)) { this.unregister(entry); continue; }
            const compatible = entry.isStatic ? haveCompatibleOpaqueStaticShadowState : haveCompatibleOpaqueSkinnedShadowState;
            if (!compatible(entry.meshes) || !entry.meshes.every(mesh =>
                visibleIn(mesh, this.scene) && mesh.layers.test(camera.layers) &&
                (!mesh.frustumCulled || frustum.intersectsObject(mesh)))) continue;
            const first = entry.meshes[0], proxy = entry.proxy;
            if (!entry.isStatic) {
                proxy.skeleton = first.skeleton; proxy.bindMode = first.bindMode;
                proxy.bindMatrix.copy(first.bindMatrix); proxy.bindMatrixInverse.copy(first.bindMatrixInverse);
            }
            proxy.matrixWorld.copy(first.matrixWorld); proxy.layers.mask = first.layers.mask;
            proxy.material.side = first.material.side; proxy.material.shadowSide = first.material.shadowSide;
            for (const mesh of entry.meshes) mesh.castShadow = false;
            entry.swapped = true; this.active.push(entry); this.scene.add(proxy);
        }
    }

    withOriginals(callback) {
        const saved = this.active, context = this.context;
        this.restore(saved); this.active = []; this.suspended++;
        try { return callback(); }
        finally {
            this.suspended--;
            if (!this.disposed && this.enabled && context) this.activate(saved, context.frustum, context.camera);
        }
    }

    renderShadows(args) {
        // Composer fullscreen scenes must not erase the last world result.
        if (args[1] !== this.scene) return this.originalShadow.apply(this.shadowMap, args);
        if (this.depth) return this.withOriginals(() => this.originalShadow.apply(this.shadowMap, args));
        this.lastBatches = 0; this.lastSavedSubmissions = 0;
        const [lights, scene, camera] = args, shadowMap = this.shadowMap;
        if (this.disposed || !this.enabled || scene !== this.scene || this.renderer.shadowMap !== shadowMap ||
            !shadowMap.enabled || shadowMap.autoUpdate === false && shadowMap.needsUpdate === false ||
            ![THREE.BasicShadowMap, THREE.PCFShadowMap, THREE.PCFSoftShadowMap].includes(shadowMap.type) ||
            !camera?.layers || !Array.isArray(lights) || !lights.length || !lights.every(light =>
                light.isDirectionalLight && light.shadow?.isDirectionalLightShadow && light.shadow.camera?.isOrthographicCamera &&
                light.shadow.updateMatrices === stockShadow.updateMatrices && light.shadow.getFrustum === stockShadow.getFrustum &&
                light.shadow.getViewportCount === stockShadow.getViewportCount && light.shadow.getViewportCount() === 1)) {
            return this.originalShadow.apply(shadowMap, args);
        }
        let customHook = false;
        scene.traverseVisible(object => {
            if (object.castShadow && (object.isMesh || object.isLine || object.isPoints) &&
                (object.onBeforeShadow !== THREE.Object3D.prototype.onBeforeShadow ||
                 object.onAfterShadow !== THREE.Object3D.prototype.onAfterShadow) && !stockBatchShadow(object)) customHook = true;
        });
        if (customHook) return this.originalShadow.apply(shadowMap, args);
        // The color-geometry owner has already selected this frame's buffers.
        // Prepare outside the shadow recursion so nested renders use originals.
        this.prepare?.();
        const hooks = [];
        this.depth++;
        try {
            for (const light of new Set(lights)) {
                const shadow = light.shadow, original = shadow.updateMatrices;
                const wrapper = (...matrixArgs) => {
                    if (this.suspended) return original.apply(shadow, matrixArgs);
                    this.restore(this.active); this.active = [];
                    const result = original.apply(shadow, matrixArgs);
                    this.context = { frustum: shadow.getFrustum().clone(), camera };
                    this.activate([...this.entries], this.context.frustum, camera);
                    this.lastBatches += this.active.length;
                    this.lastSavedSubmissions += this.active.reduce((sum, entry) => sum + entry.meshes.length - 1, 0);
                    return result;
                };
                hooks.push({ shadow, original, wrapper, descriptor: Object.getOwnPropertyDescriptor(shadow, 'updateMatrices') });
                shadow.updateMatrices = wrapper;
            }
            return this.originalShadow.apply(shadowMap, args);
        } finally {
            this.restore(this.active); this.active = []; this.context = null; this.depth--;
            for (const { shadow, wrapper, descriptor } of hooks) if (shadow.updateMatrices === wrapper) {
                if (descriptor) Object.defineProperty(shadow, 'updateMatrices', descriptor);
                else delete shadow.updateMatrices;
            }
        }
    }

    dispose() {
        this.disposed = true;
        for (const entry of [...this.entries]) this.unregister(entry);
        if (this.shadowMap.render === this.shadowWrapper) this.shadowMap.render = this.originalShadow;
        if (this.renderer.render === this.renderWrapper) this.renderer.render = this.originalRender;
    }
}
