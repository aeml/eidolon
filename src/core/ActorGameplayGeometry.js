import { Material, Object3D } from 'three';
import { isOwnedFittedSurfaceMaterial } from '../art/FittedEquipmentBatches.js';
import { clonePreparedGeometry } from './PreparedGeometry.js';

const owners = new WeakMap();
const classes = new Set(['Fighter', 'Rogue', 'Wizard', 'Cleric']);
const storage = attribute => attribute.isInterleavedBufferAttribute
    ? { array: attribute.data.array, version: attribute.data.version, stride: attribute.data.stride, offset: attribute.offset }
    : { array: attribute.array, version: attribute.version, stride: attribute.itemSize, offset: 0 };
const captureAttribute = attribute => ({ attribute, ...storage(attribute),
    count: attribute.count, itemSize: attribute.itemSize, normalized: attribute.normalized });
const sameAttribute = (attribute, saved) => {
    const current = storage(attribute);
    return attribute === saved.attribute && current.array === saved.array && current.version === saved.version &&
        current.stride === saved.stride && current.offset === saved.offset && attribute.count === saved.count &&
        attribute.itemSize === saved.itemSize && attribute.normalized === saved.normalized;
};
const snapshot = geometry => ({ index: captureAttribute(geometry.index),
    attributes: Object.entries(geometry.attributes).map(([name, attribute]) => [name, captureAttribute(attribute)]),
    morphs: Object.entries(geometry.morphAttributes).map(([name, attributes]) => [name, attributes.map(captureAttribute)]),
    relative: geometry.morphTargetsRelative,
    rigidSurfacePartitions: geometry.userData.fittedRigidSurfacePartitions,
    partitionRanges: geometry.userData.fittedRigidSurfacePartitions?.map(part =>
        [part.vertexStart, part.vertexCount, part.indexStart, part.indexCount]) });
const unchanged = (geometry, saved) => geometry.index && sameAttribute(geometry.index, saved.index) &&
    Object.keys(geometry.attributes).length === saved.attributes.length && saved.attributes.every(([name, attr]) =>
        geometry.attributes[name] && sameAttribute(geometry.attributes[name], attr)) &&
    Object.keys(geometry.morphAttributes).length === saved.morphs.length && saved.morphs.every(([name, attrs]) =>
        geometry.morphAttributes[name]?.length === attrs.length && attrs.every((attr, index) => sameAttribute(geometry.morphAttributes[name][index], attr))) &&
    geometry.morphTargetsRelative === saved.relative &&
    geometry.userData.fittedRigidSurfacePartitions === saved.rigidSurfacePartitions &&
    (!saved.partitionRanges || saved.rigidSurfacePartitions.length === saved.partitionRanges.length &&
        saved.rigidSurfacePartitions.every((part, i) => part.vertexStart === saved.partitionRanges[i][0] &&
            part.vertexCount === saved.partitionRanges[i][1] && part.indexStart === saved.partitionRanges[i][2] &&
            part.indexCount === saved.partitionRanges[i][3])) && !geometry.groups.length &&
    geometry.drawRange.start === 0 && geometry.drawRange.count === Infinity;
const under = (mesh, ancestor) => {
    for (let node = mesh; node; node = node.parent) if (node === ancestor) return true;
    return false;
};
const actorRoot = mesh => {
    for (let node = mesh; node; node = node.parent) if (classes.has(node.userData.authoredClass)) return node;
    return null;
};
const rigidEquipmentRoot = (mesh, root) => {
    if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.children.length || mesh.skeleton) return null;
    for (let node = mesh; node && node !== root; node = node.parent) if (node.userData.authoredEquipment === true &&
        ['mainHand', 'offHand'].includes(node.userData.slot) && typeof node.userData.fittedItem === 'string' && node.userData.fittedItem) return node;
    return null;
};
const opaque = mesh => {
    const material = mesh.material;
    return !Array.isArray(material) && material?.isMeshStandardMaterial && material.visible &&
        !material.transparent && material.opacity === 1 && !material.alphaTest && !material.alphaHash &&
        !material.alphaMap && !material.displacementMap && !material.clippingPlanes &&
        !mesh.customDepthMaterial && !mesh.customDistanceMaterial &&
        mesh.onBeforeRender === Object3D.prototype.onBeforeRender && mesh.onAfterRender === Object3D.prototype.onAfterRender &&
        mesh.onBeforeShadow === Object3D.prototype.onBeforeShadow && mesh.onAfterShadow === Object3D.prototype.onAfterShadow &&
        (material.onBeforeCompile === Material.prototype.onBeforeCompile || isOwnedFittedSurfaceMaterial(material));
};

// Prepared index-only derivatives, explicitly installed by QA for now. No
// source assets, rig, gear masks or collision geometry are modified. A single
// whole-scene render owns the selected color AND ordinary shadow geometry.
export class ActorGameplayGeometry {
    constructor(renderer, scene, camera, { enterPixels = 42, exitPixels = 47 } = {}) {
        if (owners.has(renderer) || typeof renderer.render !== 'function' || !camera?.isOrthographicCamera ||
            !Number.isFinite(enterPixels) || enterPixels <= 0 || !Number.isFinite(exitPixels) || exitPixels <= enterPixels)
            throw new Error('One orthographic gameplay geometry owner and ordered pixel thresholds required');
        this.renderer = renderer; this.scene = scene; this.camera = camera;
        this.enterPixels = enterPixels; this.exitPixels = exitPixels;
        this.entries = new Map(); this.retireListeners = new Set(); this.enabled = true; this.disposed = false;
        this.active = []; this.reduced = false; this.lastSwaps = 0;
        this.original = renderer.render;
        this.wrapper = (...args) => this.render(args);
        renderer.render = this.wrapper; owners.set(renderer, this);
    }

    capture(mesh) {
        const source = mesh.geometry, root = actorRoot(mesh);
        if (this.disposed || !root || !under(root, this.scene) || !opaque(mesh) ||
            !source?.isBufferGeometry || !source.index || source.index.isInterleavedBufferAttribute || source.groups.length ||
            source.drawRange.start !== 0 || source.drawRange.count !== Infinity ||
            !['position', 'normal'].every(name => source.attributes[name])) return null;
        const equipmentRoot = rigidEquipmentRoot(mesh, root);
        const generation = { mesh, source, root, quality: root.userData.authoredQuality,
            revision: root.userData.equipmentVisualRevision, material: mesh.material, sourceState: snapshot(source) };
        if (equipmentRoot && source.attributes.uv && !Object.keys(source.morphAttributes).length &&
            !source.attributes.skinIndex && !source.attributes.skinWeight) {
            return { ...generation, kind: 'rigid', equipmentRoot, slot: equipmentRoot.userData.slot, item: equipmentRoot.userData.fittedItem };
        }
        if (!mesh.isSkinnedMesh || !mesh.skeleton || !source.attributes.skinIndex || !source.attributes.skinWeight) return null;
        return { ...generation, kind: 'skinned', skeleton: mesh.skeleton, bones: mesh.skeleton.bones.slice(),
            inverses: mesh.skeleton.boneInverses.slice(), bindMode: mesh.bindMode, bindMatrix: mesh.bindMatrix.elements.slice() };
    }

    register(mesh, indices) {
        const generation = this.capture(mesh);
        if (!generation || mesh.geometry === this.entries.get(mesh)?.candidate) return false;
        const { source } = generation;
        if (!(indices instanceof Uint32Array) || !indices.length || indices.length % 3 || indices.length > source.index.count)
            throw new Error('Prepared bounded triangle indices required');
        const referenced = new Set(source.index.array);
        if ([...indices].some(index => !referenced.has(index))) throw new Error('Prepared index references a new source vertex');
        // Independent buffers: disposing shared geometry attributes would evict
        // the live source buffers from Three's GPU cache.
        const candidate = clonePreparedGeometry(source, indices);
        const shared = Object.entries(source.attributes).some(([name, attr]) => storage(attr).array === storage(candidate.attributes[name]).array) ||
            Object.entries(source.morphAttributes).some(([name, attrs]) => attrs.some((attr, index) =>
                storage(attr).array === storage(candidate.morphAttributes[name][index]).array));
        if (shared) { candidate.dispose(); throw new Error('Prepared geometry must own independent attribute storage'); }
        this.unregister(mesh);
        const entry = { ...generation, candidate, candidateState: snapshot(candidate) };
        entry.retire = () => this.unregister(mesh, 'source-disposed');
        source.addEventListener('dispose', entry.retire); this.entries.set(mesh, entry);
        return true;
    }

    current(entry) {
        const { mesh, root } = entry;
        return !this.disposed && mesh.geometry === entry.source && under(mesh, root) && under(root, this.scene) &&
            actorRoot(mesh) === root && root.userData.authoredQuality === entry.quality &&
            root.userData.equipmentVisualRevision === entry.revision && mesh.material === entry.material &&
            unchanged(entry.source, entry.sourceState) && (entry.kind === 'rigid'
                ? rigidEquipmentRoot(mesh, root) === entry.equipmentRoot && entry.equipmentRoot.userData.slot === entry.slot &&
                    entry.equipmentRoot.userData.fittedItem === entry.item && !Object.keys(entry.source.morphAttributes).length &&
                    !entry.source.attributes.skinIndex && !entry.source.attributes.skinWeight
                : mesh.isSkinnedMesh && mesh.skeleton === entry.skeleton && mesh.skeleton.bones.length === entry.bones.length &&
                    entry.bones.every((bone, index) => mesh.skeleton.bones[index] === bone) &&
                    mesh.skeleton.boneInverses.length === entry.inverses.length &&
                    entry.inverses.every((matrix, index) => mesh.skeleton.boneInverses[index] === matrix) &&
                    mesh.bindMode === entry.bindMode && mesh.bindMatrix.elements.every((value, index) => value === entry.bindMatrix[index]));
    }

    valid(entry) {
        return this.entries.get(entry.mesh) === entry && this.current(entry) && unchanged(entry.candidate, entry.candidateState);
    }

    unregister(mesh, reason = 'unregistered') {
        const entry = this.entries.get(mesh);
        if (!entry) return;
        if (mesh.geometry === entry.candidate) mesh.geometry = entry.source;
        this.entries.delete(mesh); entry.source.removeEventListener('dispose', entry.retire); entry.candidate.dispose();
        for (const listener of this.retireListeners) listener(entry, reason);
    }

    restore(entries) {
        for (const entry of entries) if (entry.mesh.geometry === entry.candidate) entry.mesh.geometry = entry.source;
    }

    render(args) {
        const suspended = this.active; this.restore(suspended); this.active = [];
        try {
            if (!this.disposed && args[0] === this.scene && args[1] === this.camera) {
                const span = (this.camera.top - this.camera.bottom) / this.camera.zoom;
                const pixels = this.renderer.domElement?.height / span;
                if (!Number.isFinite(pixels) || pixels <= 0) this.reduced = false;
                else if (pixels <= this.enterPixels) this.reduced = true;
                else if (pixels >= this.exitPixels) this.reduced = false;
                for (const entry of this.entries.values()) {
                    if (!this.valid(entry)) { this.unregister(entry.mesh, 'generation-changed'); continue; }
                    if (!this.enabled || !this.reduced || !opaque(entry.mesh)) continue;
                    entry.mesh.geometry = entry.candidate; this.active.push(entry);
                }
            }
            if (args[0] === this.scene && args[1] === this.camera) this.lastSwaps = this.active.length;
            return this.original.apply(this.renderer, args);
        } finally {
            this.restore(this.active);
            this.active = suspended.filter(entry => this.valid(entry) && opaque(entry.mesh));
            for (const entry of this.active) entry.mesh.geometry = entry.candidate;
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.restore(this.active);
        for (const mesh of this.entries.keys()) this.unregister(mesh);
        if (this.renderer.render === this.wrapper) this.renderer.render = this.original;
        if (owners.get(this.renderer) === this) owners.delete(this.renderer);
    }
}
