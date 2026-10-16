import { Material, MeshStandardMaterial } from 'three';
import { isOwnedRigidSurfaceMaterial } from './RigidSurfaceBatches.js';

const supported = source => {
    if (source?.constructor !== MeshStandardMaterial || source.type !== 'MeshStandardMaterial' ||
        source.onBeforeRender !== Material.prototype.onBeforeRender ||
        !(source.onBeforeCompile === Material.prototype.onBeforeCompile &&
          source.customProgramCacheKey === Material.prototype.customProgramCacheKey || isOwnedRigidSurfaceMaterial(source))) return false;
    // Built-in copy serializes metadata. Complex metadata/custom accessors keep
    // the borrowed path; no user callbacks or recursive graphs are cloned.
    return Object.values(Object.getOwnPropertyDescriptors(source.userData)).every(descriptor =>
        Object.hasOwn(descriptor, 'value') && (descriptor.value === null ||
        ['string', 'number', 'boolean', 'undefined'].includes(typeof descriptor.value)));
};

// One owner per multi-draw runtime, not a renderer/global material cache.
// Geometry and textures stay borrowed; all owned materials retire with usage.
export class BatchedMaterialVariants {
    constructor() {
        this.entries = new Map(); this.frame = new Map();
        this.created = 0; this.retired = 0; this.synchronizations = 0; this.fallbacks = 0;
    }

    beginFrame() { this.frame.clear(); }

    use(source) {
        if (this.frame.has(source)) return this.frame.get(source);
        let entry = this.entries.get(source);
        try {
            if (!supported(source)) {
                this.frame.set(source, source); this.fallbacks++; return source;
            }
            if (!entry) {
                entry = { material: new MeshStandardMaterial(), sourceVersion: undefined };
                entry.sourceDisposed = () => this.retire(source, entry);
                this.entries.set(source, entry); source.addEventListener('dispose', entry.sourceDisposed); this.created++;
            }
            // Synchronize all built-in mutable appearance values every frame,
            // once per source, while keeping the BatchedMesh shader state apart.
            entry.material.copy(source);
            // Standard copy resets defines and omits callbacks. Preserve the
            // supported source's exact shader contract explicitly.
            entry.material.defines = { ...source.defines };
            entry.material.onBeforeCompile = source.onBeforeCompile;
            entry.material.customProgramCacheKey = source.customProgramCacheKey;
            entry.material.onBeforeRender = source.onBeforeRender;
            if (entry.sourceVersion !== source.version) {
                entry.material.needsUpdate = true; entry.sourceVersion = source.version;
            }
            this.synchronizations++; this.frame.set(source, entry.material); return entry.material;
        } catch {
            // Copy failures retain the original render path. endFrame retires
            // any partial owned copy after proxies have selected their material.
            this.frame.set(source, source); this.fallbacks++; return source;
        }
    }

    retire(source, entry) {
        if (this.entries.get(source) !== entry) return;
        this.entries.delete(source); this.frame.delete(source);
        source.removeEventListener('dispose', entry.sourceDisposed); entry.material.dispose(); this.retired++;
    }

    endFrame() {
        for (const [source, entry] of this.entries) if (this.frame.get(source) !== entry.material) this.retire(source, entry);
        this.frame.clear();
    }

    clear() {
        for (const [source, entry] of this.entries) this.retire(source, entry);
        this.frame.clear();
    }
}
