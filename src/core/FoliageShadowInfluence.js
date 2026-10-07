import { BasicShadowMap, Box3, Frustum, Matrix4, PCFShadowMap, PCFSoftShadowMap, Vector3 } from 'three';
import { SHADOW_RECEIVER_MIN_HEIGHT } from './ShadowViewCoverage.js';

// Bound the actual shader lookup footprint in world units. PCF offsets reach
// radius texels; PCFSoft reaches two texels and ignores radius. An extra texel
// includes nearest-sample rounding. Bias offsets add their full world reach.
// Unknown filters/projections stay unoptimized rather than guessing a margin.
export function getShadowFilterWorldPadding(shadow, type = PCFSoftShadowMap, maxTextureSize = Infinity) {
    if (![BasicShadowMap, PCFShadowMap, PCFSoftShadowMap].includes(type) || !shadow?.camera?.isOrthographicCamera) return null;
    const camera = shadow.camera;
    const width = Math.min(shadow.mapSize.width, maxTextureSize, shadow.map?.width ?? Infinity);
    const height = Math.min(shadow.mapSize.height, maxTextureSize, shadow.map?.height ?? Infinity);
    const spanX = (camera.right - camera.left) / camera.zoom, spanY = (camera.top - camera.bottom) / camera.zoom;
    const depth = camera.far - camera.near;
    if (![width, height, spanX, spanY, depth, shadow.radius, shadow.bias, shadow.normalBias].every(Number.isFinite) ||
        width <= 0 || height <= 0 || spanX <= 0 || spanY <= 0 || depth <= 0) return null;
    const kernel = Math.max(2, Math.abs(shadow.radius)) + 1;
    return Math.hypot(spanX / width, spanY / height) * kernel +
        Math.abs(shadow.bias) * depth + Math.abs(shadow.normalBias) + .0001;
}

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
        this.hidden = new Set();
        this.viewFrustum = new Frustum();
        this.frustum = new Frustum(); this.projection = new Matrix4();
        this.caster = new Box3();
        this.sun = new Vector3(); this.target = new Vector3();
        this.visit = object => {
            if (!object.isInstancedMesh || !object.boundingBox || object.frustumCulled === false) return;
            const groundCover = object.parent?.userData.earthUnderstory && !object.castShadow && object.userData.windBoundsIncluded;
            const shadowCaster = this.shadowActive && object.castShadow && object.parent?.userData.proceduralFoliage &&
                object.parent.userData.region === 'earth';
            if (!groundCover && !shadowCaster) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            // Static trees exclude shader deformation. Ground cover has its
            // own explicitly qualified wind-padded bounds; actors stay out.
            if (shadowCaster && materials.some(material => material.userData.woodlandWind)) return;
            if (groundCover && (object.children.length || materials.some(material => !material.userData.woodlandWind))) return;
            this.caster.copy(object.boundingBox).applyMatrix4(object.matrixWorld);
            if (this.caster.isEmpty() || ![this.caster.min.x, this.caster.min.y, this.caster.min.z,
                this.caster.max.x, this.caster.max.y, this.caster.max.z].every(Number.isFinite)) return;
            if (groundCover) {
                // Production grass/fern boxes include their complete shader
                // wind envelope. These never cast shadows; hiding a proven
                // out-of-view box cannot remove an incoming off-screen shadow.
                if (!this.viewFrustum.intersectsBox(this.caster)) {
                    this.hidden.add(object); object.visible = false;
                }
            } else if (!shadowInfluenceIntersectsFrustum(this.caster, this.sun, this.frustum)) {
                this.omitted.add(object); object.castShadow = false;
            }
        };
    }

    beginFrame(scene, camera, light, shadowType = PCFSoftShadowMap, maxTextureSize = Infinity) {
        this.endFrame();
        if (!this.enabled || !camera) return;
        this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.viewFrustum.setFromProjectionMatrix(this.projection);
        for (const plane of this.viewFrustum.planes) plane.constant += .00001;
        this.shadowActive = false;
        let padding = null;
        if (light?.target) {
            light.getWorldPosition(this.sun); light.target.getWorldPosition(this.target);
            this.sun.sub(this.target).normalize();
            if (Number.isFinite(this.sun.y) && this.sun.y >= .1) {
                padding = getShadowFilterWorldPadding(light.shadow, shadowType, maxTextureSize);
            }
        }
        // This is the actual updated camera, including motion/punch. The fitted
        // map retains its original12-unit snapping margin; this separate test
        // needs the complete real filter/bias footprint, not unseen map padding.
        if (padding !== null) {
            this.frustum.copy(this.viewFrustum);
            for (const plane of this.frustum.planes) plane.constant += padding;
            this.shadowActive = true;
        }
        scene.traverseVisible(this.visit);
    }

    endFrame() {
        for (const object of this.omitted) object.castShadow = true;
        this.omitted.clear();
        for (const object of this.hidden) object.visible = true;
        this.hidden.clear();
    }
}
