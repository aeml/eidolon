import { BasicShadowMap, Box3, Frustum, Material, Matrix4, Object3D, PCFShadowMap, PCFSoftShadowMap, Vector3, WebGLCoordinateSystem } from 'three';
import { ActorInstanceBatches } from './ActorInstanceBatches.js';
import { isOwnedRigidSurfaceMaterial } from './RigidSurfaceBatches.js';
import { getShadowFilterWorldPadding, shadowInfluenceIntersectsFrustum } from '../core/FoliageShadowInfluence.js';

const owners = new WeakMap();
const finiteMatrix = matrix => matrix?.elements.every(Number.isFinite);

// Explicit, unselected experiment. Read the actual renderer light list after
// scene projection. Omit only complete, existing opaque actor batches whose
// geometry and every filter-padded incoming shadow miss the current view.
// No instance rows, matrices, geometry, color visibility or buffers change.
export class ActorInstanceShadowView {
    constructor(renderer, scene, instances) {
        if (!(instances instanceof ActorInstanceBatches) || instances.scene !== scene ||
            typeof renderer.shadowMap?.render !== 'function' || owners.has(renderer)) {
            throw new Error('One shadow-view owner requires the existing actor batches');
        }
        this.renderer = renderer; this.scene = scene; this.instances = instances;
        this.shadowMap = renderer.shadowMap; this.original = this.shadowMap.render;
        this.enabled = true; this.depth = 0; this.active = []; this.stats = {};
        this.projection = new Matrix4(); this.frustum = new Frustum();
        this.box = new Box3();
        this.sun = new Vector3(); this.target = new Vector3(); this.shadows = [];
        this.wrapper = (...args) => this.render(args);
        this.shadowMap.render = this.wrapper; owners.set(renderer, this);
    }

    restore() {
        for (const batch of this.active) if (batch.castShadow === false) batch.castShadow = true;
        this.active.length = 0;
    }

    prepare(lights, scene, camera) {
        const { renderer, instances, shadowMap } = this;
        this.shadows.length = 0;
        if (this.disposed || !this.enabled || scene !== this.scene ||
            renderer.shadowMap !== shadowMap || !shadowMap.enabled ||
            ![BasicShadowMap, PCFShadowMap, PCFSoftShadowMap].includes(shadowMap.type) ||
            shadowMap.autoUpdate === false && shadowMap.needsUpdate === false ||
            instances.disposed || !instances.enabled || !instances.group.visible ||
            instances.group.parent !== scene || !Array.isArray(lights) || !lights.length ||
            !camera || camera.isArrayCamera || camera.reversedDepth ||
            camera.coordinateSystem !== WebGLCoordinateSystem || scene.overrideMaterial ||
            !finiteMatrix(camera.projectionMatrix) || !finiteMatrix(camera.matrixWorldInverse)) return false;
        this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.projection);
        if (this.frustum.planes.some(plane => !Number.isFinite(plane.constant) ||
            !plane.normal.toArray().every(Number.isFinite) || !plane.normal.lengthSq())) return false;
        for (const plane of this.frustum.planes) plane.constant += .0001;
        for (const light of lights) {
            this.stats.lights++;
            if (!light?.isDirectionalLight || !light.castShadow || !light.target) return false;
            const padding = getShadowFilterWorldPadding(light.shadow, shadowMap.type, renderer.capabilities?.maxTextureSize);
            if (padding === null) return false;
            light.getWorldPosition(this.sun); light.target.getWorldPosition(this.target);
            this.sun.sub(this.target).normalize();
            if (!this.sun.toArray().every(Number.isFinite) || this.sun.y < .1) return false;
            const frustum = this.frustum.clone();
            for (const plane of frustum.planes) plane.constant += padding;
            this.shadows.push({ sun: this.sun.clone(), frustum });
        }
        return true;
    }

    rejects(batch) {
        const material = batch.material, sphere = batch.boundingSphere;
        if (batch.parent !== this.instances.group || !batch.visible || !batch.isInstancedMesh ||
            !batch.castShadow || batch.children.length || batch.frustumCulled === false ||
            !Number.isInteger(batch.count) || batch.count <= 0 || batch.count > batch.instanceMatrix.count ||
            !sphere || !Number.isFinite(sphere.radius) || sphere.radius < 0 ||
            !sphere.center.toArray().every(Number.isFinite) || !finiteMatrix(batch.matrixWorld) ||
            !material?.isMeshStandardMaterial || Array.isArray(material) || !material.visible ||
            material.transparent || material.displacementMap ||
            material.onBeforeCompile !== Material.prototype.onBeforeCompile && !isOwnedRigidSurfaceMaterial(material) ||
            batch.customDepthMaterial || batch.customDistanceMaterial ||
            batch.onBeforeRender !== Object3D.prototype.onBeforeRender || batch.onAfterRender !== Object3D.prototype.onAfterRender ||
            batch.onBeforeShadow !== Object3D.prototype.onBeforeShadow || batch.onAfterShadow !== Object3D.prototype.onAfterShadow ||
            !batch.geometry?.isBufferGeometry || Object.keys(batch.geometry.morphAttributes).length) return false;
        const matrix = batch.matrixWorld.elements;
        if (matrix[3] !== 0 || matrix[7] !== 0 || matrix[11] !== 0 || matrix[15] !== 1) return false;
        this.stats.checked++;
        // beginFrame has already computed this sphere from the current source
        // geometry and all current instance rows. Its enclosing box is looser
        // than an instance union, avoiding another walk or preparation cache.
        sphere.getBoundingBox(this.box).applyMatrix4(batch.matrixWorld);
        if (![this.box.min.x, this.box.min.y, this.box.min.z, this.box.max.x, this.box.max.y, this.box.max.z].every(Number.isFinite) ||
            this.frustum.intersectsBox(this.box)) return false;
        return !this.shadows.some(shadow => shadowInfluenceIntersectsFrustum(this.box, shadow.sun, shadow.frustum));
    }

    render(args) {
        // A nested render uses original flags. Leave the remaining outer pass
        // conservative after nesting: its frame-owned batches may have changed.
        if (this.depth) {
            this.restore();
            return this.original.apply(this.shadowMap, args);
        }
        if (args[1] !== this.scene) return this.original.apply(this.shadowMap, args);
        this.stats = { lights: 0, checked: 0, omitted: 0 };
        if (!this.prepare(...args)) return this.original.apply(this.shadowMap, args);
        this.depth++;
        try {
            for (const batch of this.instances.batches.values()) if (this.rejects(batch)) {
                batch.castShadow = false; this.active.push(batch); this.stats.omitted++;
            }
            return this.original.apply(this.shadowMap, args);
        } finally { this.restore(); this.depth--; }
    }

    dispose() {
        this.disposed = true; this.restore(); this.shadows.length = 0;
        if (this.shadowMap.render === this.wrapper) this.shadowMap.render = this.original;
        if (owners.get(this.renderer) === this) owners.delete(this.renderer);
    }
}
