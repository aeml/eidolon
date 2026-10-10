import { Box3, Frustum, Material, Matrix4, Object3D, Vector3, WebGLCoordinateSystem } from 'three';
import { isOwnedRigidSurfaceMaterial } from './RigidSurfaceBatches.js';
import { getShadowFilterWorldPadding, shadowInfluenceIntersectsFrustum } from '../core/FoliageShadowInfluence.js';

const finiteBox = box => !box.isEmpty() && Number.isFinite(box.min.x) && Number.isFinite(box.min.y) &&
    Number.isFinite(box.min.z) && Number.isFinite(box.max.x) && Number.isFinite(box.max.y) && Number.isFinite(box.max.z);

// Optional policy for the existing frame-owned actor batches. Production has
// no policy selected. Reject only undeformed rigid leaves whose entire box and
// every known, filter-padded incoming shadow are outside the actual camera.
export class ActorInstanceView {
    constructor() {
        this.enabled = true; this.bounds = new WeakMap(); this.worldBounds = new WeakMap();
        this.projection = new Matrix4(); this.frustum = new Frustum();
        this.sun = new Vector3(); this.target = new Vector3();
        this.shadows = []; this.valid = false;
        this.stats = {};
    }

    beginFrame(renderer, scene, camera) {
        this.valid = false; this.shadows.length = 0; this.shadowConservative = false;
        this.stats = { checked: 0, culled: 0, boundsBuilt: 0, worldBoundsBuilt: 0, worldBoundsReused: 0,
            lightScanNodes: 0, unknownShadow: false };
        if (!this.enabled || this.disposed || !renderer || !camera || camera.isArrayCamera || camera.reversedDepth || scene.overrideMaterial ||
            camera.coordinateSystem !== WebGLCoordinateSystem ||
            ![...camera.projectionMatrix.elements, ...camera.matrixWorldInverse.elements].every(Number.isFinite)) return;
        this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.projection);
        if (this.frustum.planes.some(p => !Number.isFinite(p.constant) || !p.normal.toArray().every(Number.isFinite) || !p.normal.lengthSq())) return;
        for (const plane of this.frustum.planes) plane.constant += .0001;
        this.valid = true;
        if (renderer.shadowMap?.enabled === false) return;
        if (renderer.shadowMap?.enabled !== true) { this.shadowConservative = true; this.stats.unknownShadow = true; return; }
        // Inspect the actual visible light set, including late/nested lights.
        // An unrecognized casting light keeps all original casting leaves.
        scene.traverseVisible(object => {
            this.stats.lightScanNodes++;
            if (!object.isLight || !object.castShadow || this.shadowConservative) return;
            const padding = object.isDirectionalLight ? getShadowFilterWorldPadding(object.shadow,
                renderer.shadowMap.type, renderer.capabilities?.maxTextureSize) : null;
            if (padding === null) { this.shadowConservative = true; return; }
            object.getWorldPosition(this.sun); object.target.getWorldPosition(this.target);
            this.sun.sub(this.target).normalize();
            if (!this.sun.toArray().every(Number.isFinite) || this.sun.y < .1) { this.shadowConservative = true; return; }
            const frustum = this.frustum.clone();
            for (const plane of frustum.planes) plane.constant += padding;
            this.shadows.push({ sun: this.sun.clone(), frustum });
        });
        this.stats.unknownShadow = this.shadowConservative;
    }

    rejects(part) {
        if (!this.valid || !this.enabled || this.disposed) return false;
        const geometry = part.geometry, material = part.material, position = geometry?.attributes.position;
        if (!part.isMesh || part.isSkinnedMesh || part.isInstancedMesh || part.children.length || part.frustumCulled === false ||
            !material?.isMeshStandardMaterial || Array.isArray(material) || material.displacementMap ||
            material.onBeforeCompile !== Material.prototype.onBeforeCompile && !isOwnedRigidSurfaceMaterial(material) ||
            part.customDepthMaterial || part.customDistanceMaterial ||
            part.onBeforeRender !== Object3D.prototype.onBeforeRender || part.onAfterRender !== Object3D.prototype.onAfterRender ||
            part.onBeforeShadow !== Object3D.prototype.onBeforeShadow || part.onAfterShadow !== Object3D.prototype.onAfterShadow ||
            Object.keys(geometry.morphAttributes).length || !position || position.itemSize !== 3 ||
            position.isInterleavedBufferAttribute || !(position.array instanceof Float32Array) ||
            !part.matrixWorld.elements.every(Number.isFinite)) return false;
        const m = part.matrixWorld.elements;
        if (m[3] !== 0 || m[7] !== 0 || m[11] !== 0 || m[15] !== 1 ||
            part.castShadow && this.shadowConservative) return false;
        this.stats.checked++;
        let cached = this.bounds.get(geometry);
        if (!cached || cached.position !== position || cached.array !== position.array || cached.version !== position.version ||
            cached.count !== position.count || cached.normalized !== position.normalized) {
            const box = new Box3().setFromBufferAttribute(position);
            cached = { position, array: position.array, version: position.version, count: position.count,
                normalized: position.normalized, box, valid: finiteBox(box) };
            this.bounds.set(geometry, cached); this.stats.boundsBuilt++;
        }
        if (!cached.valid) return false;
        // Cache only the exact world box. Eligibility, camera and every live
        // light/shadow decision are still checked for each current frame.
        // Local-box identity changes whenever the existing source/version
        // contract rebuilds geometry bounds; matrix equality includes direct
        // writes, animation, reparenting and manual-world control.
        let world = this.worldBounds.get(part);
        if (!world) {
            world = { local: null, matrix: new Matrix4(), box: new Box3() };
            this.worldBounds.set(part, world);
        }
        if (world.local !== cached.box || !world.matrix.equals(part.matrixWorld)) {
            world.local = cached.box; world.matrix.copy(part.matrixWorld);
            world.box.copy(cached.box).applyMatrix4(part.matrixWorld);
            world.valid = finiteBox(world.box); this.stats.worldBoundsBuilt++;
        } else this.stats.worldBoundsReused++;
        if (!world.valid || this.frustum.intersectsBox(world.box)) return false;
        if (part.castShadow && this.shadows.some(shadow => shadowInfluenceIntersectsFrustum(world.box, shadow.sun, shadow.frustum))) return false;
        this.stats.culled++;
        return true;
    }

    dispose() {
        this.disposed = true; this.enabled = false; this.valid = false;
        this.bounds = new WeakMap(); this.worldBounds = new WeakMap(); this.shadows.length = 0;
    }
}
