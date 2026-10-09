import { DynamicDrawUsage, Group, InstancedMesh, Material, Matrix4, Object3D } from 'three';

const inside = (part, ancestor, visible = false) => {
    for (let node = part; node; node = node.parent) {
        if (visible && !node.visible) return false;
        if (node === ancestor) return true;
    }
    return false;
};

// Supplied/skinned actors and unreviewed enemy families retain their original
// path. The constructor-batched Skeleton owns immutable leaves below live
// animation pivots, just like the existing procedural humanoid fallback.
const ownedRigidActor = root => root?.userData.proceduralHumanoid ||
    (root?.userData.proceduralEnemyFamily === true && root.userData.proceduralActorType === 'Skeleton' &&
        Boolean(root.userData.humanoidRenderBatches));

const candidate = part => part.isMesh && !part.isInstancedMesh && !part.isSkinnedMesh && !part.children.length &&
    part.material?.isMeshStandardMaterial && !Array.isArray(part.material) && part.geometry?.attributes.position;

const eligible = part => candidate(part) && part.material.visible && !part.material.transparent && !part.material.alphaHash &&
    part.material.onBeforeCompile === Material.prototype.onBeforeCompile && !part.customDepthMaterial && !part.customDistanceMaterial &&
    part.onBeforeRender === Object3D.prototype.onBeforeRender && part.onAfterRender === Object3D.prototype.onAfterRender &&
    part.onBeforeShadow === Object3D.prototype.onBeforeShadow && part.onAfterShadow === Object3D.prototype.onAfterShadow &&
    !Object.keys(part.geometry.morphAttributes).length && part.matrixWorld.determinant() > 0;

// Frame-owned presentation only: original actor visibility is restored before
// update/input/gear/stealth logic can run. Geometry/materials remain borrowed.
// Standard instance attributes, never per-piece GPU matrix/indirection textures.
export class ActorInstanceBatches {
    constructor(scene, watchedGroups = [scene]) {
        this.scene = scene;
        this.group = new Group(); this.group.name = 'OpaqueActorInstances'; this.group.visible = false;
        scene.add(this.group);
        this.batches = new Map(); this.hidden = []; this.inverse = new Matrix4(); this.matrix = new Matrix4();
        this.enabled = true;
        this.roots = new Map(); this.roster = []; this.buckets = new Map(); this.dirty = true;
        scene.traverse(root => this.register(root));
        this.watchedGroups = [...new Set(watchedGroups)];
        this.onAdded = event => event.child.traverse(root => this.register(root));
        this.onRemoved = event => {
            for (const root of this.roots.keys()) if (inside(root, event.child)) {
                this.roots.delete(root); this.dirty = true;
            }
        };
        for (const group of this.watchedGroups) {
            group.addEventListener('childadded', this.onAdded);
            group.addEventListener('childremoved', this.onRemoved);
        }
        this.before = scene.onBeforeRender; this.after = scene.onAfterRender;
        this.beforeHook = (...args) => { this.before.apply(scene, args); this.beginFrame(); };
        this.afterHook = (...args) => { this.endFrame(); this.after.apply(scene, args); };
        scene.onBeforeRender = this.beforeHook; scene.onAfterRender = this.afterHook;
    }

    register(root) {
        if (this.disposed || !ownedRigidActor(root) || this.roots.has(root)) return;
        this.roots.set(root, {}); this.dirty = true;
    }

    refreshRoster() {
        for (const [root, snapshot] of this.roots) {
            if (!ownedRigidActor(root) || !inside(root, this.scene)) { this.roots.delete(root); this.dirty = true; continue; }
            const cell = `${Math.floor((root.matrixWorld.elements[12] + 32) / 64)},${Math.floor((root.matrixWorld.elements[14] + 32) / 64)}`;
            const revision = `${root.userData.equipmentVisualRevision || 0}:${root.userData.equipmentVisualSignature || ''}`;
            if (cell !== snapshot.cell || revision !== snapshot.revision) this.dirty = true;
            snapshot.cell = cell; snapshot.revision = revision;
        }
        for (const entry of this.roster) {
            const { part } = entry;
            if (part.geometry !== entry.geometry || part.material !== entry.material || part.layers.mask !== entry.layers ||
                part.castShadow !== entry.castShadow || part.receiveShadow !== entry.receiveShadow || part.renderOrder !== entry.renderOrder ||
                !inside(part, entry.root)) { this.dirty = true; break; }
        }
        if (!this.dirty) return;
        this.roster = []; this.buckets.clear(); this.dirty = false;
        for (const [root, snapshot] of this.roots) root.traverse(part => {
            if (!candidate(part)) return;
            const key = [snapshot.cell, part.geometry.uuid, part.material.uuid, part.castShadow, part.receiveShadow,
                part.renderOrder, part.layers.mask].join(':');
            const entry = { root, part, geometry: part.geometry, material: part.material, layers: part.layers.mask,
                castShadow: part.castShadow, receiveShadow: part.receiveShadow, renderOrder: part.renderOrder };
            this.roster.push(entry);
            if (!this.buckets.has(key)) this.buckets.set(key, []);
            this.buckets.get(key).push(entry);
        });
    }

    beginFrame() {
        this.endFrame();
        if (this.disposed || !this.enabled) return;
        this.refreshRoster();
        const used = new Set();
        this.group.matrixWorld.copy(this.scene.matrixWorld);
        try {
            for (const [key, entries] of this.buckets) {
                const parts = entries.filter(entry => inside(entry.part, this.scene, true) && eligible(entry.part)).map(entry => entry.part);
                if (parts.length < 2) continue;
                let batch = this.batches.get(key);
                if (batch && batch.instanceMatrix.count < parts.length) {
                    batch.removeFromParent(); batch.dispose(); this.batches.delete(key); batch = null;
                }
                if (!batch) {
                    batch = new InstancedMesh(parts[0].geometry, parts[0].material, 2 ** Math.ceil(Math.log2(parts.length)));
                    batch.name = `ActorInstances_${parts[0].name}`;
                    batch.instanceMatrix.setUsage(DynamicDrawUsage); batch.matrixAutoUpdate = false;
                    batch.castShadow = parts[0].castShadow; batch.receiveShadow = parts[0].receiveShadow;
                    batch.renderOrder = parts[0].renderOrder; batch.layers.mask = parts[0].layers.mask;
                    this.batches.set(key, batch); this.group.add(batch);
                }
                used.add(key); batch.visible = true; batch.count = parts.length;
                // Store small cell-relative float32 attributes. Full dungeon
                // coordinates here discard fractional gear/animation offsets;
                // the double-precision model-view transform owns the origin.
                const sourceWorld = parts[0].matrixWorld.elements;
                batch.matrixWorld.makeTranslation(Math.floor((sourceWorld[12] + 32) / 64) * 64, 0,
                    Math.floor((sourceWorld[14] + 32) / 64) * 64);
                this.inverse.copy(batch.matrixWorld).invert();
                parts.forEach((part, index) => batch.setMatrixAt(index, this.matrix.multiplyMatrices(this.inverse, part.matrixWorld)));
                batch.instanceMatrix.needsUpdate = true; batch.computeBoundingSphere();
                for (const part of parts) { this.hidden.push(part); part.visible = false; }
            }
            for (const [key, batch] of this.batches) if (!used.has(key)) {
                batch.removeFromParent(); batch.dispose(); this.batches.delete(key);
            }
            this.group.visible = used.size > 0;
        } catch (error) { this.endFrame(); throw error; }
    }

    endFrame() {
        this.hidden.forEach(part => { part.visible = true; }); this.hidden.length = 0;
        this.group.visible = false;
    }

    clear() {
        this.endFrame();
        for (const batch of this.batches.values()) { batch.removeFromParent(); batch.dispose(); }
        this.batches.clear(); this.buckets.clear(); this.roots.clear(); this.roster = []; this.dirty = true;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.endFrame();
        if (this.scene.onBeforeRender === this.beforeHook) this.scene.onBeforeRender = this.before;
        if (this.scene.onAfterRender === this.afterHook) this.scene.onAfterRender = this.after;
        for (const group of this.watchedGroups) {
            group.removeEventListener('childadded', this.onAdded);
            group.removeEventListener('childremoved', this.onRemoved);
        }
        this.watchedGroups.length = 0;
        this.clear(); this.group.removeFromParent();
    }
}
