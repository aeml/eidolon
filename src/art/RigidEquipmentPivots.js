import { Matrix4, Mesh, PropertyBinding } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Per-loadout geometry, with no dynamic GPU matrix textures. Never combine
// across any authored animation target, or import/skinned/body-mask boundary.
const states = new WeakMap();

export function clearRigidEquipmentPivots(root) {
    const state = states.get(root);
    if (!state) return;
    for (const { mesh, sources } of state.batches) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
        for (const source of sources) source.visible = true;
    }
    states.delete(root);
}

export function suspendRigidEquipmentPivots(root, suspended) {
    const state = states.get(root);
    if (!state || state.suspended === suspended) return;
    state.suspended = suspended;
    for (const { mesh, sources } of state.batches) {
        mesh.visible = !suspended;
        for (const source of sources) source.visible = suspended;
    }
}

export function batchRigidEquipmentPivots(root) {
    clearRigidEquipmentPivots(root);
    if (!root?.userData.proceduralHumanoid) return;
    const animated = new Set((root.userData.animations || []).flatMap(clip =>
        clip.tracks.map(track => PropertyBinding.parseTrackName(track.name).nodeName)));
    const buckets = new Map();
    root.traverse(part => {
        if (!part.isMesh || part.isSkinnedMesh || part.children.length || !part.visible ||
            !part.parent?.userData.equipmentVisual || Array.isArray(part.material) ||
            part.material.transparent || animated.has(part.name) ||
            Object.keys(part.geometry.morphAttributes).length) return;
        const transform = new Matrix4();
        let node = part;
        // Stop below the nearest animated parent, preserving that pivot's own
        // animation and every rigid item/anchor fit transform beneath it.
        while (node !== root && !animated.has(node.name)) {
            if (!node.visible || node.userData.equipmentBodyBase) return;
            node.updateMatrix();
            transform.premultiply(node.matrix);
            node = node.parent;
        }
        if (!node || transform.determinant() <= 0) return;
        const attributes = Object.entries(part.geometry.attributes)
            .map(([name, attr]) => `${name}:${attr.itemSize}:${attr.normalized}`).sort().join(',');
        const key = [node.uuid, part.material.uuid, part.castShadow, part.receiveShadow,
            part.renderOrder, part.layers.mask, attributes].join(':');
        if (!buckets.has(key)) buckets.set(key, { pivot: node, pieces: [] });
        buckets.get(key).pieces.push({ part, transform });
    });
    const batches = [];
    try {
        for (const { pivot, pieces } of buckets.values()) {
            if (pieces.length < 2) continue;
            const baked = pieces.map(({ part, transform }) => (part.geometry.index
                ? part.geometry.toNonIndexed() : part.geometry.clone()).applyMatrix4(transform));
            let geometry;
            try { geometry = mergeGeometries(baked, false); }
            finally { baked.forEach(piece => piece.dispose()); }
            if (!geometry) continue; // Unsupported layouts retain the exact sources.
            geometry.computeBoundingBox(); geometry.computeBoundingSphere();
            const first = pieces[0].part, mesh = new Mesh(geometry, first.material);
            mesh.name = `RigidEquipmentPivot_${pivot.name}_${batches.length}`;
            mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
            mesh.renderOrder = first.renderOrder; mesh.layers.mask = first.layers.mask;
            mesh.matrixAutoUpdate = false;
            mesh.userData.rigidEquipmentPivot = true;
            const sources = pieces.map(({ part }) => part);
            pivot.add(mesh);
            for (const source of sources) source.visible = false;
            batches.push({ mesh, sources });
        }
        states.set(root, { batches, suspended: false });
    } catch (error) {
        states.set(root, { batches, suspended: false });
        clearRigidEquipmentPivots(root);
        throw error;
    }
}
