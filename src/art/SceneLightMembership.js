import { Light, Object3D } from 'three';

// Membership follows Three's add/remove/attach/clear events. Visibility,
// castShadow, transforms and shadow settings remain live frame inputs.
// Watch leaves too: a previously empty object can acquire a nested light.
// Custom hierarchy/event/visibility methods present at registration keep the
// full ordinary scan. Type flags and hierarchy methods are construction-time
// contracts; live graph changes use Three's normal mutation APIs.
export class SceneLightMembership {
    constructor(scene) {
        this.scene = scene; this.nodes = new Set(); this.lights = new Set();
        this.dirty = false; this.fallback = false; this.builds = 0;
        this.onAdded = event => {
            // Three reuses its event object; a reentrant listener can clear
            // child before this listener runs. Rebuild rather than miss it.
            if (!event.child) this.dirty = true;
            else this.attach(event.child);
        };
        this.onRemoved = event => {
            if (!event.child) { this.dirty = true; return; }
            // Earlier listeners may already have reparented this subtree.
            if (this.connected(event.child)) return;
            this.walk(event.child, node => {
                this.unwatch(node); this.nodes.delete(node); this.lights.delete(node);
            });
            if (this.fallback) this.dirty = true;
        };
        this.rebuild();
    }

    connected(node) {
        for (; node; node = node.parent) if (node === this.scene) return true;
        return false;
    }

    walk(root, visit) {
        const stack = [root];
        while (stack.length) {
            const node = stack.pop(); visit(node);
            for (const child of node.children) stack.push(child);
        }
    }

    attach(root) {
        if (!this.connected(root)) return;
        this.walk(root, node => {
            if (this.nodes.has(node)) return;
            this.nodes.add(node);
            if (node instanceof Light) this.lights.add(node);
            else if (node.isLight) this.fallback = true;
            for (const method of ['add', 'remove', 'attach', 'clear', 'dispatchEvent',
                'addEventListener', 'removeEventListener', 'traverseVisible']) {
                if (node[method] !== Object3D.prototype[method]) this.fallback = true;
            }
            Object3D.prototype.addEventListener.call(node, 'childadded', this.onAdded);
            Object3D.prototype.addEventListener.call(node, 'childremoved', this.onRemoved);
        });
    }

    unwatch(node) {
        Object3D.prototype.removeEventListener.call(node, 'childadded', this.onAdded);
        Object3D.prototype.removeEventListener.call(node, 'childremoved', this.onRemoved);
    }

    rebuild() {
        for (const node of this.nodes) this.unwatch(node);
        this.nodes.clear(); this.lights.clear(); this.fallback = false; this.dirty = false;
        this.attach(this.scene); this.builds++;
    }

    forEachVisible(visit) {
        if (this.dirty) this.rebuild();
        this.visibilityChecks = 0;
        if (this.fallback) { this.scene.traverseVisible(visit); return; }
        for (const light of this.lights) {
            let visible = true, connected = false;
            for (let node = light; node; node = node.parent) {
                this.visibilityChecks++;
                if (node.visible === false) { visible = false; break; }
                if (node === this.scene) { connected = true; break; }
            }
            if (visible && connected) visit(light);
        }
    }

    dispose() {
        for (const node of this.nodes) this.unwatch(node);
        this.nodes.clear(); this.lights.clear(); this.scene = null;
    }
}
