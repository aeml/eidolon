import { Box3, Frustum, Matrix4, Vector3 } from 'three';
import { SHADOW_RECEIVER_MIN_HEIGHT, SHADOW_VIEW_PADDING } from './ShadowViewCoverage.js';

// Bound the complete swept caster volume down to the existing lowest receiver,
// including shadows on raised ground, roofs and actors along the ray. Merely
// testing the caster against the camera or its ground footprint loses shadows.
export function getDirectionalShadowInfluenceBounds(caster, sun, target) {
    target.copy(caster);
    const height = Math.max(0, caster.max.y - SHADOW_RECEIVER_MIN_HEIGHT);
    const dx = -sun.x / sun.y * height, dz = -sun.z / sun.y * height;
    target.min.x += Math.min(0, dx); target.max.x += Math.max(0, dx);
    target.min.z += Math.min(0, dz); target.max.z += Math.max(0, dz);
    target.min.y = Math.min(target.min.y, SHADOW_RECEIVER_MIN_HEIGHT);
    return target;
}

// Test the convex swept volume itself rather than its axis-aligned enclosing
// box. For each view plane, the maximum occurs at a caster corner or a corner
// projected along the light ray to the lowest receiver. A separating plane
// proves the entire shadow is outside; no distance cap or reduced silhouette.
export function shadowInfluenceIntersectsFrustum(caster, sun, frustum) {
    for (const plane of frustum.planes) {
        const { x, y, z } = plane.normal;
        const horizontal = x * (x >= 0 ? caster.max.x : caster.min.x) +
            z * (z >= 0 ? caster.max.z : caster.min.z);
        const original = horizontal + y * (y >= 0 ? caster.max.y : caster.min.y);
        const slope = -(x * sun.x + z * sun.z) / sun.y;
        const receiver = horizontal + slope * (slope >= 0 ? caster.max.y : caster.min.y) +
            (y - slope) * SHADOW_RECEIVER_MIN_HEIGHT;
        if (Math.max(original, receiver) + plane.constant < -1e-7) return false;
    }
    return true;
}

export class FoliageShadowInfluence {
    constructor() {
        this.enabled = true;
        this.omitted = new Set();
        this.frustum = new Frustum(); this.projection = new Matrix4();
        this.caster = new Box3();
        this.sun = new Vector3(); this.target = new Vector3();
        this.visit = object => {
            if (!object.isInstancedMesh || !object.castShadow || !object.boundingBox ||
                !object.parent?.userData.proceduralFoliage || object.parent.userData.region !== 'earth') return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            // These are known static production trees. Shader-bent understory,
            // skinning, actors, lights, other realms and unknown bounds stay out.
            if (materials.some(material => material.userData.woodlandWind)) return;
            this.caster.copy(object.boundingBox).applyMatrix4(object.matrixWorld);
            if (this.caster.isEmpty() || ![this.caster.min.x, this.caster.min.y, this.caster.min.z,
                this.caster.max.x, this.caster.max.y, this.caster.max.z].every(Number.isFinite)) return;
            if (!shadowInfluenceIntersectsFrustum(this.caster, this.sun, this.frustum)) {
                this.omitted.add(object); object.castShadow = false;
            }
        };
    }

    beginFrame(scene, camera, light) {
        this.endFrame();
        if (!this.enabled || !camera || !light?.target) return;
        light.getWorldPosition(this.sun); light.target.getWorldPosition(this.target);
        this.sun.sub(this.target).normalize();
        if (!Number.isFinite(this.sun.y) || this.sun.y < .1) return;
        this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.projection);
        // Same conservative allowance as the existing fitted map: retain rays
        // just beyond the view for PCF filtering, snapping and camera punch.
        for (const plane of this.frustum.planes) plane.constant += SHADOW_VIEW_PADDING;
        scene.traverseVisible(this.visit);
    }

    endFrame() {
        for (const object of this.omitted) object.castShadow = true;
        this.omitted.clear();
    }
}
