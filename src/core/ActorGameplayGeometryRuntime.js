import { ActorGameplayGeometry } from './ActorGameplayGeometry.js';
import { ActorGameplayGeometryDelivery } from './ActorGameplayGeometryDelivery.js';

const classes = new Set(['Fighter', 'Rogue', 'Wizard', 'Cleric']);
const inside = (root, scene) => {
    for (let node = root; node; node = node.parent) if (node === scene) return true;
    return false;
};

// Game actors are direct children of the scene/entity ownership groups. Follow
// those bounded groups, never install listeners on every bone or scenery node.
export class ActorGameplayGeometryRuntime {
    constructor(renderer, scene, camera, groups = [scene], options = {}) {
        this.scene = scene; this.groups = [...new Set(groups.filter(Boolean))]; this.disposed = false;
        this.pass = new ActorGameplayGeometry(renderer, scene, camera, options);
        this.delivery = new ActorGameplayGeometryDelivery(this.pass, options);
        this.added = event => this.track(event.child);
        this.removed = event => this.delivery.untrack(event.child);
        this.groupAdded = event => this.scan(event.target);
        this.groupRemoved = event => {
            for (const root of this.delivery.roots.keys()) if (inside(root, event.target)) this.delivery.untrack(root);
        };
        for (const group of this.groups) {
            group.addEventListener('childadded', this.added); group.addEventListener('childremoved', this.removed);
            group.addEventListener('added', this.groupAdded); group.addEventListener('removed', this.groupRemoved);
            this.scan(group);
        }
    }

    track(root) {
        if (!this.disposed && (classes.has(root?.userData.authoredClass) || root?.userData.npcAppearance === 'ilyra-fourfold-archmage') &&
            inside(root, this.scene)) this.delivery.track(root);
    }

    scan(group) { for (const child of group.children) this.track(child); }

    clear() { for (const root of this.delivery.roots.keys()) this.delivery.untrack(root); }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        for (const group of this.groups) {
            group.removeEventListener('childadded', this.added); group.removeEventListener('childremoved', this.removed);
            group.removeEventListener('added', this.groupAdded); group.removeEventListener('removed', this.groupRemoved);
        }
        this.groups.length = 0; this.delivery.dispose(); this.pass.dispose();
    }
}
