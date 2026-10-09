import { BasicShadowMap, Frustum, Matrix4, PCFShadowMap, PCFSoftShadowMap, Vector3 } from 'three';
import { SHADOW_RECEIVER_MIN_HEIGHT } from './ShadowViewCoverage.js';
import { cacheUnchangedLocalMatrix } from './UnchangedLocalMatrix.js';

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

function validCasterBounds(box) {
    return !box.isEmpty() && Number.isFinite(box.min.x) && Number.isFinite(box.min.y) &&
        Number.isFinite(box.min.z) && Number.isFinite(box.max.x) && Number.isFinite(box.max.y) &&
        Number.isFinite(box.max.z);
}

export class FoliageShadowInfluence {
    constructor(scene = null, watchedGroups = [scene]) {
        this.enabled = true;
        // These are frame-local restoration lists, not membership indexes.
        // Normal scene traversal visits each cell once. Reusing arrays avoids
        // rebuilding large hash tables for thousands of offscreen cells every
        // frame; all eligibility/bounds checks and end-of-frame restoration stay.
        this.omitted = [];
        this.hidden = [];
        this.viewFrustum = new Frustum();
        this.frustum = new Frustum(); this.projection = new Matrix4();
        this.sun = new Vector3(); this.target = new Vector3();
        this.viewProjection = new Matrix4(); this.viewRevision = -1;
        this.shadowSun = new Vector3(); this.shadowRevision = 0;
        this.shadowViewRevision = -1; this.shadowPadding = null;
        // Production declares foliage roots at attachment. Revisit their live
        // leaves/flags each frame, not every rig and building in the scene.
        // Callers without an owned scene retain the original traversal path.
        this.scene = scene; this.roots = new Set();
        this.boundsCache = new WeakMap();
        this.matrixRestorers = new Map();
        const register = root => {
            if (root.userData.earthUnderstory || root.userData.proceduralFoliage) {
                this.roots.add(root);
                if (!this.matrixRestorers.has(root)) {
                    const restore = cacheUnchangedLocalMatrix(root);
                    if (restore) this.matrixRestorers.set(root, restore);
                }
            }
        };
        this.onAdded = event => event.child.traverse(register);
        this.onRemoved = event => {
            event.child.traverse(part => {
                this.matrixRestorers.get(part)?.(); this.matrixRestorers.delete(part);
            });
            for (const root of this.roots) for (let node = root; node; node = node.parent) {
                if (node === event.child) { this.roots.delete(root); break; }
            }
        };
        this.watchedGroups = [...new Set(watchedGroups.filter(Boolean))];
        scene?.traverse(register);
        for (const group of this.watchedGroups) {
            group.addEventListener('childadded', this.onAdded);
            group.addEventListener('childremoved', this.onRemoved);
        }
        this.visit = object => {
            if (!object.isInstancedMesh || !object.boundingBox || object.frustumCulled === false) return;
            const groundCover = object.parent?.userData.earthUnderstory && !object.castShadow && object.userData.windBoundsIncluded;
            const shadowCaster = this.shadowActive && object.castShadow && object.parent?.userData.proceduralFoliage &&
                object.parent.userData.region === 'earth';
            if (!groundCover && !shadowCaster) return;
            // Static trees exclude shader deformation. Ground cover has its
            // own explicitly qualified wind-padded bounds; actors stay out.
            if (groundCover && object.children.length) return;
            const material = object.material;
            if (Array.isArray(material)) {
                for (const part of material) {
                    if (shadowCaster && part.userData.woodlandWind || groundCover && !part.userData.woodlandWind) return;
                }
            } else if (shadowCaster && material.userData.woodlandWind || groundCover && !material.userData.woodlandWind) return;
            let cached = this.boundsCache.get(object);
            if (!cached) {
                cached = { local: object.boundingBox.clone(), matrix: object.matrixWorld.clone(),
                    world: object.boundingBox.clone().applyMatrix4(object.matrixWorld),
                    viewRevision: -1, shadowRevision: -1 };
                cached.valid = validCasterBounds(cached.world);
                this.boundsCache.set(object, cached);
            } else if (!cached.local.equals(object.boundingBox) || !cached.matrix.equals(object.matrixWorld)) {
                cached.local.copy(object.boundingBox); cached.matrix.copy(object.matrixWorld);
                cached.world.copy(object.boundingBox).applyMatrix4(object.matrixWorld);
                cached.valid = validCasterBounds(cached.world);
                cached.viewRevision = cached.shadowRevision = -1;
            }
            // Cache the world box and its validity, not current eligibility.
            // There is no per-cell temporary array/callback or box copy on a
            // cache hit. Both frustum tests only read the cached world box.
            // Current camera, light/filter, visibility/material flags and live local
            // bounds are still evaluated on every frame; moving/reparented
            // foliage or quality/buffer-bound updates invalidate immediately.
            if (!cached.valid) return;
            if (groundCover) {
                // Production grass/fern boxes include their complete shader
                // wind envelope. These never cast shadows; hiding a proven
                // out-of-view box cannot remove an incoming off-screen shadow.
                if (cached.viewRevision !== this.viewRevision) {
                    cached.intersectsView = this.viewFrustum.intersectsBox(cached.world);
                    cached.viewRevision = this.viewRevision;
                }
                if (!cached.intersectsView) {
                    this.hidden.push(object); object.visible = false;
                }
            } else {
                if (cached.shadowRevision !== this.shadowRevision) {
                    cached.intersectsShadow = shadowInfluenceIntersectsFrustum(cached.world, this.sun, this.frustum);
                    cached.shadowRevision = this.shadowRevision;
                }
                if (!cached.intersectsShadow) {
                    this.omitted.push(object); object.castShadow = false;
                }
            }
        };
    }

    beginFrame(scene, camera, light, shadowType = PCFSoftShadowMap, maxTextureSize = Infinity) {
        this.endFrame();
        if (this.disposed || !this.enabled || !camera) return;
        this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        // Exact inputs only: no movement threshold, timer or approximate match.
        // Live cell eligibility and local/world bounds still get checked below.
        if (this.viewRevision < 0 || !this.viewProjection.equals(this.projection)) {
            this.viewProjection.copy(this.projection); this.viewRevision++;
            this.viewFrustum.setFromProjectionMatrix(this.projection);
            for (const plane of this.viewFrustum.planes) plane.constant += .00001;
        }
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
            if (this.shadowViewRevision !== this.viewRevision || this.shadowPadding !== padding || !this.shadowSun.equals(this.sun)) {
                this.shadowViewRevision = this.viewRevision; this.shadowPadding = padding;
                this.shadowSun.copy(this.sun); this.shadowRevision++;
                this.frustum.copy(this.viewFrustum);
                for (const plane of this.frustum.planes) plane.constant += padding;
            }
            this.shadowActive = true;
        }
        if (scene !== this.scene) scene.traverseVisible(this.visit);
        else for (const root of this.roots) {
            let connected = false, visible = true, nested = false;
            for (let node = root; node; node = node.parent) {
                visible &&= node.visible;
                if (node !== root && this.roots.has(node)) nested = true;
                if (node === scene) { connected = true; break; }
            }
            if (!connected) {
                this.roots.delete(root);
                this.matrixRestorers.get(root)?.(); this.matrixRestorers.delete(root);
            }
            else if (visible && !nested) {
                // Production foliage cells are direct leaf children. Only
                // Earth shadow casters and wind-bounded understory can qualify;
                // other realms need no per-cell cache/material/matrix checks.
                // Evaluate live root flags every frame, and retain recursive
                // traversal for arbitrary nested content rather than assuming
                // that descendants inherit the root's region or eligibility.
                const directEligible = root.userData.earthUnderstory ||
                    this.shadowActive && root.userData.proceduralFoliage && root.userData.region === 'earth';
                for (const child of root.children) {
                    if (!child.visible) continue;
                    if (child.isInstancedMesh && !child.children.length) {
                        if (directEligible) this.visit(child);
                    } else child.traverseVisible(this.visit);
                }
            }
        }
    }

    endFrame() {
        for (const object of this.omitted) object.castShadow = true;
        this.omitted.length = 0;
        for (const object of this.hidden) object.visible = true;
        this.hidden.length = 0;
    }

    dispose() {
        this.endFrame();
        if (this.disposed) return;
        this.disposed = true;
        for (const group of this.watchedGroups) {
            group.removeEventListener('childadded', this.onAdded);
            group.removeEventListener('childremoved', this.onRemoved);
        }
        this.watchedGroups.length = 0; this.roots.clear(); this.scene = null;
        this.boundsCache = new WeakMap();
        for (const restore of this.matrixRestorers.values()) restore();
        this.matrixRestorers.clear();
    }
}
