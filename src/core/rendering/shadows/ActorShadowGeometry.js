import * as THREE from 'three';

const attributes = ['position', 'skinIndex', 'skinWeight'];
const storage = attribute => attribute.isInterleavedBufferAttribute
    ? { array: attribute.data.array, version: attribute.data.version, stride: attribute.data.stride, offset: attribute.offset }
    : { array: attribute.array, version: attribute.version, stride: attribute.itemSize, offset: 0 };
const snapshotAttribute = attribute => ({ attribute, ...storage(attribute),
    count: attribute.count, itemSize: attribute.itemSize, normalized: attribute.normalized });
const sameAttribute = (attribute, saved) => {
    const current = storage(attribute);
    return attribute === saved.attribute && current.array === saved.array && current.version === saved.version &&
        current.stride === saved.stride && current.offset === saved.offset && attribute.count === saved.count &&
        attribute.itemSize === saved.itemSize && attribute.normalized === saved.normalized;
};
const snapshot = geometry => ({ index: snapshotAttribute(geometry.index),
    attributes: attributes.map(name => snapshotAttribute(geometry.attributes[name])),
    morphs: (geometry.morphAttributes.position || []).map(snapshotAttribute), relative: geometry.morphTargetsRelative });
const unchanged = (geometry, saved) => geometry.index && sameAttribute(geometry.index, saved.index) &&
    attributes.every((name, index) => geometry.attributes[name] && sameAttribute(geometry.attributes[name], saved.attributes[index])) &&
    (geometry.morphAttributes.position || []).length === saved.morphs.length &&
    saved.morphs.every((morph, index) => sameAttribute(geometry.morphAttributes.position[index], morph)) &&
    geometry.morphTargetsRelative === saved.relative && geometry.groups.length === 0 &&
    geometry.drawRange.start === 0 && geometry.drawRange.count === Infinity;

function eligible(mesh) {
    const material = mesh.material, geometry = mesh.geometry;
    return mesh.isSkinnedMesh && !mesh.isInstancedMesh && !mesh.isBatchedMesh &&
        mesh.castShadow && !Array.isArray(material) &&
        (material?.isMeshStandardMaterial || material?.isMeshPhysicalMaterial) && material.visible &&
        !material.transparent && material.opacity === 1 && !material.alphaTest && !material.alphaHash &&
        !material.alphaMap && !material.displacementMap && !material.clippingPlanes &&
        !mesh.customDepthMaterial && !mesh.customDistanceMaterial &&
        mesh.onBeforeShadow === THREE.Object3D.prototype.onBeforeShadow &&
        mesh.onAfterShadow === THREE.Object3D.prototype.onAfterShadow &&
        geometry?.isBufferGeometry && geometry.index && geometry.groups.length === 0 &&
        geometry.drawRange.start === 0 && geometry.drawRange.count === Infinity &&
        attributes.every(name => geometry.attributes[name]) && !geometry.index.isInterleavedBufferAttribute &&
        !geometry.attributes.skinIndex.normalized &&
        Object.keys(geometry.morphAttributes).every(name => ['position', 'normal'].includes(name));
}

function underScene(mesh, scene) {
    for (let node = mesh; node; node = node.parent) if (node === scene) return true;
    return false;
}

function visibleUnderScene(mesh, scene) {
    for (let node = mesh; node; node = node.parent) {
        if (!node.visible) return false;
        if (node === scene) return true;
    }
    return false;
}

function equalOwnedAttribute(candidate, source) {
    const original = storage(source);
    return candidate && !candidate.isInterleavedBufferAttribute && candidate !== source && candidate.array !== original.array &&
        candidate.itemSize === source.itemSize && candidate.normalized === source.normalized &&
        candidate.array.constructor === original.array.constructor && candidate.array.length === source.count * source.itemSize &&
        candidate.array.every((value, index) => Object.is(value,
            original.array[Math.floor(index / source.itemSize) * original.stride + original.offset + index % source.itemSize]));
}

function copyOwnedAttribute(source) {
    const original = storage(source), array = new original.array.constructor(source.count * source.itemSize);
    for (let vertex = 0; vertex < source.count; vertex++) for (let channel = 0; channel < source.itemSize; channel++) {
        array[vertex * source.itemSize + channel] = original.array[vertex * original.stride + original.offset + channel];
    }
    return new THREE.BufferAttribute(array, source.itemSize, source.normalized);
}

// Independent buffers are essential: Three removes a disposed geometry's
// attributes from its GPU cache even when another geometry shares those arrays.
export function createOwnedShadowGeometry(source, indices = source.index.array) {
    const geometry = new THREE.BufferGeometry();
    for (const name of attributes) geometry.setAttribute(name, copyOwnedAttribute(source.attributes[name]));
    if (source.morphAttributes.position?.length) geometry.morphAttributes.position = source.morphAttributes.position.map(copyOwnedAttribute);
    geometry.morphTargetsRelative = source.morphTargetsRelative;
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    geometry.boundingBox = source.boundingBox?.clone() || null;
    geometry.boundingSphere = source.boundingSphere?.clone() || null;
    return geometry;
}

// Explicitly installed pilot, currently unused by RenderSystem. Registration
// transfers ownership of the independent depth buffers, never of color data.
// Depth candidates must be prepared for the exact live geometry after coverage
// and fitting; a new mask/equip generation invalidates its old registration.
export class ActorShadowGeometry {
    constructor(renderer, scene) {
        if (typeof renderer.shadowMap?.render !== 'function' || typeof renderer.render !== 'function') throw new Error('Stock shadow pass required');
        this.renderer = renderer; this.scene = scene; this.shadowMap = renderer.shadowMap;
        this.original = this.shadowMap.render; this.entries = new Map(); this.owned = new WeakSet();
        this.enabled = true; this.disposed = false; this.active = []; this.depth = 0;
        this.lastSwaps = 0;
        this.wrapper = (...args) => this.render(args);
        this.originalRender = renderer.render;
        this.renderWrapper = (...args) => {
            if (!this.depth) return this.originalRender.apply(renderer, args);
            const suspended = this.active; this.restore(suspended); this.active = [];
            try { return this.originalRender.apply(renderer, args); }
            finally {
                this.active = suspended.filter(entry => this.valid(entry) && eligible(entry.mesh));
                for (const entry of this.active) entry.mesh.geometry = entry.geometry;
            }
        };
        this.shadowMap.render = this.wrapper;
        renderer.render = this.renderWrapper;
    }

    register(mesh, geometry) {
        if (this.depth) throw new Error('Register shadow geometry between renderer passes');
        if (this.disposed || !underScene(mesh, this.scene) || !eligible(mesh)) return false;
        const source = mesh.geometry, morphs = source.morphAttributes.position || [];
        if (geometry === source || this.owned.has(geometry) || !geometry?.index ||
            geometry.index === source.index || geometry.index.array === source.index.array ||
            geometry.index.count % 3 || geometry.index.count > source.index.count || !geometry.index.count && source.index.count ||
            geometry.groups.length || geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity ||
            geometry.morphTargetsRelative !== source.morphTargetsRelative ||
            Object.keys(geometry.attributes).some(name => !attributes.includes(name)) ||
            Object.keys(geometry.morphAttributes).some(name => name !== 'position') ||
            !attributes.every(name => equalOwnedAttribute(geometry.attributes[name], source.attributes[name])) ||
            (geometry.morphAttributes.position || []).length !== morphs.length ||
            !morphs.every((attribute, index) => equalOwnedAttribute(geometry.morphAttributes.position[index], attribute))) {
            throw new Error('Shadow geometry must own exact source position/skin/morph buffers and a bounded triangle index');
        }
        const vertices = new Set(source.index.array);
        if ([...geometry.index.array].some(vertex => !Number.isInteger(vertex) || !vertices.has(vertex))) throw new Error('Shadow index references a new source vertex');
        this.unregister(mesh);
        const entry = { mesh, source, geometry, skeleton: mesh.skeleton, bindMode: mesh.bindMode,
            bindMatrix: mesh.bindMatrix.elements.slice(), sourceState: snapshot(source), candidateState: snapshot(geometry) };
        entry.retire = () => this.unregister(mesh);
        source.addEventListener('dispose', entry.retire);
        this.entries.set(mesh, entry); this.owned.add(geometry);
        return true;
    }

    unregister(mesh) {
        const entry = this.entries.get(mesh);
        if (!entry) return;
        if (mesh.geometry === entry.geometry) mesh.geometry = entry.source;
        this.entries.delete(mesh); entry.source.removeEventListener('dispose', entry.retire);
        entry.geometry.dispose();
    }

    valid(entry) {
        const { mesh, source, geometry } = entry;
        return this.entries.get(mesh) === entry && mesh.geometry === source && underScene(mesh, this.scene) &&
            unchanged(source, entry.sourceState) && unchanged(geometry, entry.candidateState) &&
            mesh.skeleton === entry.skeleton && mesh.bindMode === entry.bindMode &&
            mesh.bindMatrix.elements.every((value, index) => value === entry.bindMatrix[index]);
    }

    restore(entries) {
        for (const { mesh, source, geometry } of entries) if (mesh.geometry === geometry) mesh.geometry = source;
    }

    render(args) {
        // Direct nested shadow calls also use originals. The renderer wrapper
        // suspends earlier, before nested scene projection captures geometry.
        if (this.depth) {
            const suspended = this.active; this.restore(suspended); this.active = [];
            try { return this.original.apply(this.shadowMap, args); }
            finally {
                this.active = suspended.filter(entry => this.valid(entry) && eligible(entry.mesh));
                for (const entry of this.active) entry.mesh.geometry = entry.geometry;
            }
        }
        this.lastSwaps = 0;
        if (this.disposed || !this.enabled || args[1] !== this.scene || this.renderer.shadowMap !== this.shadowMap ||
            !this.shadowMap.enabled || ![THREE.BasicShadowMap, THREE.PCFShadowMap, THREE.PCFSoftShadowMap].includes(this.shadowMap.type)) {
            return this.original.apply(this.shadowMap, args);
        }
        this.depth++;
        try {
            for (const entry of this.entries.values()) {
                if (!this.valid(entry)) { this.unregister(entry.mesh); continue; }
                if (!eligible(entry.mesh) || !visibleUnderScene(entry.mesh, this.scene)) continue;
                entry.mesh.geometry = entry.geometry; this.active.push(entry);
            }
            this.lastSwaps = this.active.length;
            return this.original.apply(this.shadowMap, args);
        } finally {
            this.restore(this.active); this.active = []; this.depth--;
        }
    }

    dispose() {
        this.disposed = true; this.restore(this.active);
        for (const mesh of this.entries.keys()) this.unregister(mesh);
        if (this.shadowMap.render === this.wrapper) this.shadowMap.render = this.original;
        if (this.renderer.render === this.renderWrapper) this.renderer.render = this.originalRender;
    }
}
