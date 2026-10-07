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

export class FoliageShadowInfluence {
    constructor() {
        this.enabled = true;
        this.omitted = new Set();
        this.frustum = new Frustum(); this.projection = new Matrix4();
        this.caster = new Box3(); this.influence = new Box3();
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
            getDirectionalShadowInfluenceBounds(this.caster, this.sun, this.influence);
            if (!this.frustum.intersectsBox(this.influence)) {
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
