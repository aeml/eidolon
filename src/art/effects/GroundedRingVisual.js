import * as THREE from 'three';

// Moving ground rings use a reusable, densely sampled buffer instead of
// clipping/reallocating triangles on every actor step. At the field's maximum
// grade (.35), the short edges keep interpolation error below the authored
// ground clearance. Body-attached halos must never use this adapter.
export class GroundedRingVisual {
    constructor(mesh, { maxEdge = .3 } = {}) {
        this.mesh = mesh;
        this.source = mesh.geometry;
        this.maxEdge = maxEdge;
        this.geometry = null;
        this.capacityScale = 0;
        this.matrix = new THREE.Matrix4();
        this.inverse = new THREE.Matrix4();
        this.point = new THREE.Vector3();
        this.field = null;
        this.originHeight = null;
    }

    update(field, originHeight) {
        if (!field) { this.restore(); return; }
        const mesh = this.mesh, p = this.source.parameters;
        mesh.updateWorldMatrix(true, false);
        // Closing cast animations intentionally collapse to zero scale. They
        // have no visible surface to ground, and inverting a singular matrix
        // would write NaNs into the reusable geometry. Leave the last valid
        // buffer intact; a later nonzero pose will be sampled normally.
        if (mesh.matrixWorld.determinant() === 0) return;
        const m = mesh.matrixWorld.elements;
        const scale = Math.max(Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]));
        if (!this.geometry || scale > this.capacityScale) {
            this.geometry?.dispose();
            this.capacityScale = scale * 1.15;
            this.geometry = new THREE.RingGeometry(p.innerRadius, p.outerRadius,
                Math.max(p.thetaSegments, Math.ceil(p.thetaLength * p.outerRadius * this.capacityScale / this.maxEdge)),
                Math.max(p.phiSegments, Math.ceil((p.outerRadius - p.innerRadius) * this.capacityScale / this.maxEdge)),
                p.thetaStart, p.thetaLength);
            this.originalPositions = this.geometry.attributes.position.array.slice();
            this.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
            mesh.geometry = this.geometry;
            this.field = null;
        }
        if (this.field === field && this.originHeight === originHeight && this.matrix.equals(mesh.matrixWorld)) return;
        this.matrix.copy(mesh.matrixWorld);
        this.inverse.copy(this.matrix).invert();
        const positions = this.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            this.point.fromArray(this.originalPositions, i * 3).applyMatrix4(this.matrix);
            this.point.y += field.sample(this.point.x, this.point.z) - originHeight;
            this.point.applyMatrix4(this.inverse);
            positions.setXYZ(i, this.point.x, this.point.y, this.point.z);
        }
        positions.needsUpdate = true;
        this.geometry.computeBoundingSphere();
        this.geometry.computeBoundingBox();
        this.field = field;
        this.originHeight = originHeight;
    }

    restore() {
        if (!this.geometry) return;
        this.mesh.geometry = this.source;
        this.geometry.dispose();
        this.geometry = null;
        this.originalPositions = null;
        this.field = null;
    }

    dispose() { this.restore(); }
}
