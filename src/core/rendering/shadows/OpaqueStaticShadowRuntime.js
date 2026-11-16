import { isOpaqueStaticShadowMesh } from './OpaqueStaticShadowGeometry.js';

const under = (node, ancestor) => {
    for (; node; node = node.parent) if (node === ancestor) return true;
    return false;
};
const visible = node => { for (; node; node = node.parent) if (!node.visible) return false; return true; };
const state = mesh => ({ geometry: mesh.geometry, material: mesh.material, castShadow: mesh.castShadow,
    visible: visible(mesh), layers: mesh.layers.mask, side: mesh.material?.side, shadowSide: mesh.material?.shadowSide,
    eligible: isOpaqueStaticShadowMesh(mesh) });
const sameState = (mesh, saved) => {
    const current = state(mesh);
    return Object.keys(saved).every(key => Object.is(current[key], saved[key]));
};

// Register only qualified town constructors, using the existing directional
// owner. No second renderer wrapper or steady-frame scene traversal is needed.
export class OpaqueStaticShadowRuntime {
    constructor(owner, scene, groups = []) {
        this.owner = owner; this.scene = scene; this.groups = [...new Set(groups.filter(Boolean))];
        this.roots = new Map(); this.retired = new WeakSet(); this.disposed = false;
        this.added = event => this.track(event.child);
        this.removed = event => this.untrack(event.child);
        this.groupAdded = event => this.scan(event.target);
        this.groupRemoved = event => {
            for (const root of this.roots.keys()) if (under(root, event.target)) this.untrack(root);
        };
        for (const group of this.groups) {
            group.addEventListener('childadded', this.added); group.addEventListener('childremoved', this.removed);
            group.addEventListener('added', this.groupAdded); group.addEventListener('removed', this.groupRemoved);
            this.scan(group);
        }
    }

    track(root) {
        if (this.disposed || root?.userData.opaqueStaticShadowRoot !== true || !under(root, this.scene) || this.roots.has(root)) return;
        this.roots.set(root, { entries: new Set(), sources: new Map(), nodes: new Set(), listeners: new Map(), dirty: true });
    }

    scan(group) { for (const root of group.children) this.track(root); }

    release(record) {
        for (const entry of record.entries) this.owner.unregister(entry);
        record.entries.clear();
        for (const node of record.nodes) {
            node.removeEventListener('childadded', record.changed); node.removeEventListener('childremoved', record.changed);
        }
        record.nodes.clear();
        for (const [geometry, listener] of record.listeners) geometry.removeEventListener('dispose', listener);
        record.listeners.clear(); record.sources.clear();
    }

    untrack(root) {
        const record = this.roots.get(root); if (!record) return;
        this.roots.delete(root); this.release(record);
    }

    synchronize() {
        if (this.disposed) return;
        for (const [root, record] of this.roots) {
            if (!under(root, this.scene) || root.userData.opaqueStaticShadowRoot !== true) { this.untrack(root); continue; }
            if (!record.dirty && [...record.sources].every(([mesh, saved]) => sameState(mesh, saved) && under(mesh, root)) &&
                [...record.entries].every(entry => this.owner.valid(entry))) continue;
            this.release(record); record.dirty = false;
            record.changed = () => { record.dirty = true; };
            root.traverse(node => {
                record.nodes.add(node);
                node.addEventListener('childadded', record.changed); node.addEventListener('childremoved', record.changed);
                if (node.isMesh && !node.isSkinnedMesh && !node.isInstancedMesh && !node.isBatchedMesh && node.geometry)
                    record.sources.set(node, state(node));
            });
            for (const geometry of new Set([...record.sources.values()].map(saved => saved.geometry))) {
                const listener = () => { this.retired.add(geometry); record.dirty = true; };
                geometry.addEventListener('dispose', listener); record.listeners.set(geometry, listener);
            }
            // An asynchronously disposed source must not be reconstructed by a
            // late frame. A replacement geometry identity can recover normally.
            if ([...record.sources.values()].some(saved => this.retired.has(saved.geometry))) continue;
            const previous = new Set(this.owner.entries);
            this.owner.register(root, { staticOnly: true });
            for (const entry of this.owner.entries) if (!previous.has(entry)) record.entries.add(entry);
        }
    }

    reset() { for (const record of this.roots.values()) { this.release(record); record.dirty = true; } }
    clear() { for (const root of this.roots.keys()) this.untrack(root); }

    dispose() {
        if (this.disposed) return; this.disposed = true;
        for (const group of this.groups) {
            group.removeEventListener('childadded', this.added); group.removeEventListener('childremoved', this.removed);
            group.removeEventListener('added', this.groupAdded); group.removeEventListener('removed', this.groupRemoved);
        }
        this.groups.length = 0; this.clear();
    }
}
