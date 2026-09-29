import * as THREE from 'three';
import { conformGroundEffectMesh } from './GroundRibbonGeometry.js';

// Persistent areas own their conformed geometry, never the cached art. Ground
// markings are anchored; raised particles/hardware retain the animated parent.
export class GroundedProjectileVisual {
    constructor(root, { groundDetails = true, surfaceOffset = null, animatedDetails = false, detailFilter = null } = {}) {
        this.root = root;
        this.groundDetails = groundDetails;
        this.surfaceOffset = surfaceOffset;
        this.animatedDetails = animatedDetails;
        this.surfaces = [];
        this.details = [];
        const parts = [];
        root.traverse(part => { if (part.isMesh) parts.push(part); });
        root.updateWorldMatrix(true, true);
        for (const part of parts) {
            if (part.userData.groundSurface) {
                this.surfaces.push({ part, parent: part.parent, geometry: part.geometry,
                    position: part.position.clone(), quaternion: part.quaternion.clone(), scale: part.scale.clone() });
                root.attach(part);
            } else if (!detailFilter || detailFilter(part)) {
                this.details.push({ part, position: part.position.clone() });
            }
        }
        this.lastMatrix = new THREE.Matrix4();
        this.point = new THREE.Vector3();
        this.origin = new THREE.Vector3();
        this.field = null;
    }

    prepareAnimation() {
        if (!this.animatedDetails) return;
        for (const entry of this.details) {
            if (entry.animatedPosition) entry.part.position.copy(entry.animatedPosition);
            entry.captureAnimation = true;
        }
    }

    update(field) {
        const root = this.root;
        root.updateWorldMatrix(true, true);
        root.getWorldPosition(this.origin);
        const baseHeight = field.sample(this.origin.x, this.origin.z);
        if (this.field !== field || !this.lastMatrix.equals(root.matrixWorld)) {
            for (const entry of this.surfaces) {
                if (entry.part.geometry !== entry.geometry) entry.part.geometry.dispose();
                entry.part.geometry = entry.geometry.clone();
                conformGroundEffectMesh(entry.part, field,
                    this.surfaceOffset === null ? baseHeight : this.origin.y - this.surfaceOffset);
            }
            this.lastMatrix.copy(root.matrixWorld);
            this.field = field;
        }
        if (!this.groundDetails) return;
        for (const entry of this.details) {
            const { part, position } = entry;
            if (this.animatedDetails) {
                if (!entry.animatedPosition) entry.animatedPosition = part.position.clone();
                else if (entry.captureAnimation) entry.animatedPosition.copy(part.position);
                entry.captureAnimation = false;
            }
            part.position.copy(entry.animatedPosition || position);
            part.updateWorldMatrix(true, false);
            part.getWorldPosition(this.point);
            this.point.y += field.sample(this.point.x, this.point.z) - baseHeight;
            part.position.copy(part.parent.worldToLocal(this.point));
        }
    }

    dispose() {
        for (const entry of this.surfaces) {
            if (entry.part.geometry !== entry.geometry) entry.part.geometry.dispose();
            entry.part.geometry = entry.geometry;
            entry.parent.add(entry.part);
            entry.part.position.copy(entry.position);
            entry.part.quaternion.copy(entry.quaternion);
            entry.part.scale.copy(entry.scale);
        }
        for (const { part, position, animatedPosition } of this.details) part.position.copy(animatedPosition || position);
        this.surfaces.length = 0;
        this.details.length = 0;
    }
}
