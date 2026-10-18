import { Box3, Material, Matrix4, Object3D } from 'three';
import { ActorInstanceView } from './ActorInstanceView.js';
import { isOwnedRigidSurfaceMaterial } from './RigidSurfaceBatches.js';
import { shadowInfluenceIntersectsFrustum } from '../core/FoliageShadowInfluence.js';

const ownedRoot = root => root.userData.proceduralEnemyFamily === true ||
    root.userData.proceduralTownActor === true || root.userData.proceduralHumanoid === true;
const connectedVisible = (root, scene) => {
    for (let node = root; node; node = node.parent) {
        if (!node.visible) return false;
        if (node === scene) return true;
    }
    return false;
};
const finiteBox = box => !box.isEmpty() && Number.isFinite(box.min.x) && Number.isFinite(box.min.y) &&
    Number.isFinite(box.min.z) && Number.isFinite(box.max.x) && Number.isFinite(box.max.y) && Number.isFinite(box.max.z);
const affine = matrix => matrix.elements.every(Number.isFinite) && matrix.elements[3] === 0 &&
    matrix.elements[7] === 0 && matrix.elements[11] === 0 && matrix.elements[15] === 1;

// Frame-owned shadow policy. Original color submissions remain intact.
// Rigid leaves use their live pivot matrices. Supplied skins, morphs, custom
// deformation and unknown lighting keep the original shadow path. The visible
// camera's full padded light-ray volume includes raised receivers and roofs.
export class ActorShadowInfluence {
    constructor(scene, watchedGroups = [scene]) {
        this.scene = scene; this.enabled = true;
        this.view = new ActorInstanceView(); this.roots = new Set(); this.omitted = [];
        this.bounds = new WeakMap(); this.world = new Box3(); this.instanceBox = new Box3();
        this.matrix = new Matrix4(); this.worldMatrix = new Matrix4();
        this.onAdded = event => event.child.traverse(root => { if (ownedRoot(root)) this.roots.add(root); });
        this.onRemoved = event => {
            event.child.traverse(root => this.roots.delete(root));
        };
        scene.traverse(root => { if (ownedRoot(root)) this.roots.add(root); });
        this.watchedGroups = [...new Set(watchedGroups.filter(Boolean))];
        for (const group of this.watchedGroups) {
            group.addEventListener('childadded', this.onAdded);
            group.addEventListener('childremoved', this.onRemoved);
        }
        this.visit = part => {
            if (part.castShadow && part.material?.onBeforeRender === Material.prototype.onBeforeRender && this.view.rejects(part)) this.omit(part);
        };
    }

    omit(part) {
        this.omitted.push(part); part.castShadow = false; this.stats.omitted++;
    }

    rejectsBatch(part) {
        const material = part.material, geometry = part.geometry, position = geometry?.attributes.position;
        if (!part.isInstancedMesh || part.isSkinnedMesh || part.children.length || part.frustumCulled === false ||
            !material?.isMeshStandardMaterial || Array.isArray(material) || material.displacementMap ||
            material.onBeforeCompile !== Material.prototype.onBeforeCompile && !isOwnedRigidSurfaceMaterial(material) ||
            material.onBeforeRender !== Material.prototype.onBeforeRender ||
            part.customDepthMaterial || part.customDistanceMaterial ||
            part.onBeforeRender !== Object3D.prototype.onBeforeRender || part.onAfterRender !== Object3D.prototype.onAfterRender ||
            part.onBeforeShadow !== Object3D.prototype.onBeforeShadow || part.onAfterShadow !== Object3D.prototype.onAfterShadow ||
            Object.keys(geometry.morphAttributes).length || !position || position.itemSize !== 3 ||
            position.isInterleavedBufferAttribute || !(position.array instanceof Float32Array) || !affine(part.matrixWorld) ||
            !Number.isInteger(part.count) || part.count <= 0 || part.count > part.instanceMatrix.count ||
            !(part.instanceMatrix.array instanceof Float32Array) || part.instanceMatrix.itemSize !== 16 ||
            part.morphTexture) return false;
        let cached = this.bounds.get(geometry);
        if (!cached || cached.position !== position || cached.array !== position.array || cached.version !== position.version ||
            cached.count !== position.count || cached.normalized !== position.normalized) {
            const box = new Box3().setFromBufferAttribute(position);
            cached = { position, array: position.array, version: position.version, count: position.count,
                normalized: position.normalized, box, valid: finiteBox(box) };
            this.bounds.set(geometry, cached);
        }
        if (!cached.valid) return false;
        // Read the actual current float32 instance attributes after batching.
        // Never trust a previous sphere/box or a root's unrounded transform.
        this.world.makeEmpty();
        for (let i = 0; i < part.count; i++) {
            part.getMatrixAt(i, this.matrix);
            if (!affine(this.matrix)) return false;
            this.worldMatrix.multiplyMatrices(part.matrixWorld, this.matrix);
            this.instanceBox.copy(cached.box).applyMatrix4(this.worldMatrix);
            if (!finiteBox(this.instanceBox)) return false;
            this.world.union(this.instanceBox);
        }
        this.stats.checkedBatches++;
        if (this.view.frustum.intersectsBox(this.world)) return false;
        return !this.view.shadows.some(shadow => shadowInfluenceIntersectsFrustum(this.world, shadow.sun, shadow.frustum));
    }

    beginFrame(renderer, scene, camera, batches = []) {
        this.endFrame();
        this.stats = { omitted: 0, checkedBatches: 0, unknownShadow: false, lightScanNodes: 0 };
        if (this.disposed || !this.enabled || scene !== this.scene || renderer?.shadowMap?.enabled !== true) return;
        // Reuse the qualified live-camera/light/filter validation. This scans
        // the actual visible scene, including late and nested casting lights;
        // no declared light roster can silently miss a new source of shadows.
        this.view.beginFrame(renderer, scene, camera);
        this.stats.unknownShadow = this.view.shadowConservative;
        this.stats.lightScanNodes = this.view.stats.lightScanNodes;
        if (!this.view.valid || this.view.shadowConservative || !this.view.shadows.length) return;
        for (const root of this.roots) {
            if (!connectedVisible(root, scene)) continue;
            // Nested owned roots are visited by their outer owner only.
            let nested = false;
            for (let node = root.parent; node && node !== scene; node = node.parent) if (this.roots.has(node)) nested = true;
            if (!nested) root.traverseVisible(this.visit);
        }
        for (const batch of batches) if (batch.visible && batch.castShadow && this.rejectsBatch(batch)) this.omit(batch);
    }

    endFrame() {
        for (const part of this.omitted) part.castShadow = true;
        this.omitted.length = 0;
    }

    dispose() {
        this.endFrame();
        if (this.disposed) return;
        this.disposed = true; this.enabled = false; this.view.dispose();
        for (const group of this.watchedGroups) {
            group.removeEventListener('childadded', this.onAdded);
            group.removeEventListener('childremoved', this.onRemoved);
        }
        this.watchedGroups.length = 0; this.roots.clear(); this.bounds = new WeakMap(); this.scene = null;
    }
}
