import * as THREE from 'three';

// Overworld landmarks stay solid for navigation and targeting. Only their
// presentation gains a soft cutaway while they hide the local hero.
export class SceneryVisibility {
    constructor() {
        this.entries = new Map();
        this.raycaster = new THREE.Raycaster();
        this.point = new THREE.Vector3();
        this.projected = new THREE.Vector3();
        this.boxHit = new THREE.Vector3();
        this.nextSample = -Infinity;
        this.previousTime = null;
    }

    createEntry(root) {
        const parts = [];
        root.traverse(part => {
            if (!part.isMesh || !part.userData.proceduralDungeonEntrancePart) return;
            parts.push({ mesh: part, material: part.material, castShadow: part.castShadow });
        });
        return { root, parts, meshes: parts.map(part => part.mesh), clones: new Map(),
            bounds: new THREE.Box3(), matrix: new THREE.Matrix4().makeScale(0, 0, 0),
            uniforms: { focus: { value: new THREE.Vector3() }, reveal: { value: 0 } },
            opacity: 1, lastBlocked: -Infinity };
    }

    blocksFocus(entry, camera, focus) {
        entry.root.updateWorldMatrix(true, true);
        if (!entry.matrix.equals(entry.root.matrixWorld)) {
            entry.bounds.setFromObject(entry.root);
            entry.matrix.copy(entry.root.matrixWorld);
        }
        // Sample feet, torso and head, using the real orthographic camera rays.
        // A ray from camera.position to the hero would be wrong off screen-center.
        for (const height of [0.4, 1.5, 2.7]) {
            this.point.copy(focus); this.point.y += height;
            this.projected.copy(this.point).project(camera);
            if (Math.abs(this.projected.x) > 1.05 || Math.abs(this.projected.y) > 1.05 ||
                this.projected.z < -1 || this.projected.z > 1) continue;
            this.raycaster.setFromCamera(this.projected, camera);
            const distance = this.point.clone().sub(this.raycaster.ray.origin).dot(this.raycaster.ray.direction);
            if (distance <= 0) continue;
            this.raycaster.near = 0; this.raycaster.far = distance - 0.1;
            const hit = this.raycaster.ray.intersectBox(entry.bounds, this.boxHit);
            if (!hit || hit.distanceTo(this.raycaster.ray.origin) > this.raycaster.far) continue;
            if (this.raycaster.intersectObjects(entry.meshes, false).length) return true;
        }
        return false;
    }

    applyOpacity(entry) {
        entry.uniforms.reveal.value = 1 - entry.opacity;
        if (entry.opacity === 1) {
            for (const part of entry.parts) {
                part.mesh.material = part.material;
                part.mesh.castShadow = part.castShadow;
            }
            return;
        }
        const faded = original => {
            let clone = entry.clones.get(original);
            if (!clone) {
                clone = original.clone();
                clone.onBeforeCompile = (shader, renderer) => {
                    original.onBeforeCompile.call(clone, shader, renderer);
                    shader.uniforms.uSceneryFocusView = entry.uniforms.focus;
                    shader.uniforms.uSceneryReveal = entry.uniforms.reveal;
                    shader.fragmentShader = 'uniform vec3 uSceneryFocusView;\nuniform float uSceneryReveal;\n' +
                        shader.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
                        float sceneryDistance = length(vViewPosition.xy - uSceneryFocusView.xy);
                        float sceneryWindow = 1.0 - smoothstep(3.2, 4.5, sceneryDistance);
                        float sceneryForeground = 1.0 - step(uSceneryFocusView.z + 1.5, vViewPosition.z);
                        float sceneryCoverage = 1.0 - uSceneryReveal * sceneryWindow * sceneryForeground;
                        float sceneryDither = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
                        if (sceneryCoverage < sceneryDither) discard;`);
                };
                clone.customProgramCacheKey = () => `${original.customProgramCacheKey()}:hero-cutaway-v2`;
                entry.clones.set(original, clone);
            }
            return clone;
        };
        for (const part of entry.parts) {
            part.mesh.material = Array.isArray(part.material)
                ? part.material.map(faded) : faded(part.material);
            // Dither-discard preserves opaque depth ordering outside the small
            // window. The physical landmark continues casting normal shadows.
            part.mesh.castShadow = part.castShadow;
        }
    }

    release(entry) {
        entry.opacity = 1; this.applyOpacity(entry);
        for (const material of entry.clones.values()) material.dispose();
        entry.clones.clear();
    }

    update(group, camera, focus, now) {
        if (!Number.isFinite(now) || !camera) return;
        const dt = this.previousTime === null ? 1 / 60 : Math.max(0, Math.min(.1, now - this.previousTime));
        this.previousTime = now;
        const roots = new Set((group?.children || []).filter(root => root.visible && root.userData.proceduralDungeonEntrance));
        for (const [root, entry] of this.entries) {
            if (!roots.has(root)) { this.release(entry); this.entries.delete(root); }
        }
        let added = false;
        for (const root of roots) {
            if (!this.entries.has(root)) { this.entries.set(root, this.createEntry(root)); added = true; }
        }
        const validFocus = focus && [focus.x, focus.y, focus.z].every(Number.isFinite);
        const sample = added || now >= this.nextSample;
        camera.updateMatrixWorld(true);
        if (sample) this.nextSample = now + .1;
        for (const entry of this.entries.values()) {
            if (validFocus) {
                entry.uniforms.focus.value.copy(focus);
                entry.uniforms.focus.value.y += 1.5;
                entry.uniforms.focus.value.applyMatrix4(camera.matrixWorldInverse).multiplyScalar(-1);
            }
            if (sample && validFocus && this.blocksFocus(entry, camera, focus)) entry.lastBlocked = now;
            const blocked = validFocus && now - entry.lastBlocked < .2;
            const target = blocked ? 0 : 1;
            entry.opacity = target + (entry.opacity - target) * Math.exp(-dt * (blocked ? 14 : 8));
            if (!blocked && entry.opacity > .995) entry.opacity = 1;
            if (entry.opacity < 1 || entry.clones.size) this.applyOpacity(entry);
        }
    }

    clear() {
        for (const entry of this.entries.values()) this.release(entry);
        this.entries.clear(); this.previousTime = null; this.nextSample = -Infinity;
    }
}
