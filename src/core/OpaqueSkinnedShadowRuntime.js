import { OpaqueSkinnedShadowBatches } from './OpaqueSkinnedShadowBatches.js';
import { isOpaqueSkinnedShadowMesh } from './OpaqueSkinnedShadowGeometry.js';

const classes = new Set(['Fighter', 'Rogue', 'Wizard', 'Cleric']);
const under = (node, ancestor) => {
    for (; node; node = node.parent) if (node === ancestor) return true;
    return false;
};
const actor = root => classes.has(root?.userData.authoredClass) || root?.userData.npcAppearance === 'ilyra-fourfold-archmage';
const visible = node => { for (; node; node = node.parent) if (!node.visible) return false; return true; };
const state = mesh => ({ geometry: mesh.geometry, material: mesh.material, skeleton: mesh.skeleton,
    visible: visible(mesh), castShadow: mesh.castShadow, layers: mesh.layers.mask,
    eligible: isOpaqueSkinnedShadowMesh(mesh), side: mesh.material?.side, shadowSide: mesh.material?.shadowSide });
const sameState = (mesh, saved) => mesh.geometry === saved.geometry && mesh.material === saved.material &&
    mesh.skeleton === saved.skeleton && visible(mesh) === saved.visible && mesh.castShadow === saved.castShadow &&
    mesh.layers.mask === saved.layers && isOpaqueSkinnedShadowMesh(mesh) === saved.eligible &&
    mesh.material?.side === saved.side && mesh.material?.shadowSide === saved.shadowSide;

// Explicit pilot only. Synchronize at the ordinary shadow boundary, after the
// existing gameplay geometry owner selects its source or derivative. One live
// variant per actor bounds memory; steady frames never reconstruct buffers.
export class OpaqueSkinnedShadowRuntime {
    constructor(renderer, scene, groups = [scene]) {
        this.scene = scene; this.groups = [...new Set(groups.filter(Boolean))];
        this.roots = new Map(); this.retired = new WeakSet(); this.disposed = false;
        this.owner = new OpaqueSkinnedShadowBatches(renderer, scene, { prepare: () => this.synchronize() });
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
        if (this.disposed || !actor(root) || !under(root, this.scene) || this.roots.has(root)) return;
        const record = { entries: new Set(), sources: new Map(), listeners: new Map(), dirty: true };
        record.changed = () => { record.dirty = true; };
        root.addEventListener('childadded', record.changed); root.addEventListener('childremoved', record.changed);
        this.roots.set(root, record);
    }

    scan(group) { for (const root of group.children) this.track(root); }

    release(record) {
        for (const entry of record.entries) this.owner.unregister(entry);
        record.entries.clear();
        for (const [geometry, listener] of record.listeners) geometry.removeEventListener('dispose', listener);
        record.listeners.clear(); record.sources.clear();
    }

    untrack(root) {
        const record = this.roots.get(root); if (!record) return;
        this.roots.delete(root); this.release(record);
        root.removeEventListener('childadded', record.changed); root.removeEventListener('childremoved', record.changed);
    }

    synchronize() {
        if (this.disposed) return;
        for (const [root, record] of this.roots) {
            if (!under(root, this.scene)) { this.untrack(root); continue; }
            const revision = root.userData.equipmentVisualRevision, quality = root.userData.authoredQuality;
            if (!record.dirty && record.revision === revision && record.quality === quality &&
                [...record.sources].every(([mesh, saved]) => sameState(mesh, saved) && under(mesh, root)) &&
                [...record.entries].every(entry => this.owner.valid(entry))) continue;
            this.release(record); record.revision = revision; record.quality = quality; record.dirty = false;
            root.traverse(mesh => { if (mesh.isSkinnedMesh && mesh.geometry) record.sources.set(mesh, state(mesh)); });
            for (const geometry of new Set([...record.sources.values()].map(saved => saved.geometry))) {
                const listener = () => { this.retired.add(geometry); record.dirty = true; };
                geometry.addEventListener('dispose', listener); record.listeners.set(geometry, listener);
            }
            // Disposed sources must never be resurrected by a late frame.
            if ([...record.sources.values()].some(saved => this.retired.has(saved.geometry))) continue;
            const previous = new Set(this.owner.entries);
            this.owner.register(root);
            for (const entry of this.owner.entries) if (!previous.has(entry)) record.entries.add(entry);
        }
    }

    clear() { for (const root of this.roots.keys()) this.untrack(root); }

    dispose() {
        if (this.disposed) return; this.disposed = true;
        for (const group of this.groups) {
            group.removeEventListener('childadded', this.added); group.removeEventListener('childremoved', this.removed);
            group.removeEventListener('added', this.groupAdded); group.removeEventListener('removed', this.groupRemoved);
        }
        this.groups.length = 0; this.clear(); this.owner.dispose();
    }
}
