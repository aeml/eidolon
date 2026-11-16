import { OpaqueSkinnedColorBatches } from './OpaqueSkinnedColorBatches.js';
const classes = new Set(['Fighter', 'Rogue', 'Wizard', 'Cleric']);
const under = (node, ancestor) => { for (; node; node = node.parent) if (node === ancestor) return true; return false; };
const actor = root => classes.has(root?.userData.authoredClass) || root?.userData.npcAppearance === 'ilyra-fourfold-archmage';

// Bounded actor ownership groups, with refresh only at explicit appearance/
// quality generations. Invalid registered sources always retain original rendering.
export class OpaqueSkinnedColorRuntime {
    constructor(renderer, scene, camera, groups = [scene]) {
        this.scene = scene; this.groups = [...new Set(groups.filter(Boolean))]; this.roots = new Map(); this.disposed = false;
        this.owner = new OpaqueSkinnedColorBatches(renderer, scene, camera, { prepare: () => this.synchronize() });
        this.added = event => this.track(event.child); this.removed = event => this.untrack(event.child);
        this.groupAdded = event => this.scan(event.target);
        this.groupRemoved = event => { for (const root of this.roots.keys()) if (under(root, event.target)) this.untrack(root); };
        for (const group of this.groups) {
            group.addEventListener('childadded', this.added); group.addEventListener('childremoved', this.removed);
            group.addEventListener('added', this.groupAdded); group.addEventListener('removed', this.groupRemoved); this.scan(group);
        }
    }
    scan(group) { for (const root of group.children) this.track(root); }
    track(root) {
        if (this.disposed || !actor(root) || !under(root, this.scene) || this.roots.has(root)) return;
        const record = { dirty: true };
        record.changed = event => { if (!this.owner.ownedProxies.has(event.child)) record.dirty = true; };
        root.addEventListener('childadded', record.changed); root.addEventListener('childremoved', record.changed);
        root.addEventListener('appearancechanged', record.changed);
        this.roots.set(root, record); this.owner.register(root);
    }
    untrack(root) {
        const record = this.roots.get(root); if (!record) return;
        root.removeEventListener('childadded', record.changed); root.removeEventListener('childremoved', record.changed);
        root.removeEventListener('appearancechanged', record.changed);
        this.roots.delete(root); this.owner.unregister(root);
    }
    synchronize() {
        for (const [root, record] of this.roots) {
            if (!under(root, this.scene)) { this.untrack(root); continue; }
            const revision = root.userData.equipmentVisualRevision, quality = root.userData.authoredQuality;
            if (record.dirty || record.revision !== revision || record.quality !== quality) {
                this.owner.refresh(root); record.dirty = false; record.revision = revision; record.quality = quality;
            }
        }
    }
    reset() { this.owner.reset(); for (const record of this.roots.values()) record.dirty = true; }
    clear() { for (const root of [...this.roots.keys()]) this.untrack(root); }
    dispose() {
        if (this.disposed) return; this.disposed = true;
        for (const group of this.groups) {
            group.removeEventListener('childadded', this.added); group.removeEventListener('childremoved', this.removed);
            group.removeEventListener('added', this.groupAdded); group.removeEventListener('removed', this.groupRemoved);
        }
        this.clear(); this.groups.length = 0; this.owner.dispose();
    }
}
