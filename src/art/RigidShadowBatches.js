import { Material, Matrix4, Mesh, MeshBasicMaterial, PropertyBinding } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Ordinary owned geometry, not dynamic GPU matrix/indirection textures.
// Colour meshes keep their exact geometry/materials. Only compatible opaque
// depth casters below the same authored animation pivot are combined.
const states = new WeakMap();

export function clearRigidShadowBatches(root) {
    const state = states.get(root);
    if (!state) return;
    for (const { mesh, sources } of state.batches) {
        mesh.removeFromParent(); mesh.geometry.dispose();
        sources.forEach(source => { source.castShadow = true; });
    }
    state.materials.forEach(material => material.dispose());
    states.delete(root);
}

export function suspendRigidShadowBatches(root, suspended) {
    const state = states.get(root);
    if (!state || state.suspended === suspended) return;
    state.suspended = suspended;
    for (const { mesh, sources } of state.batches) {
        mesh.visible = !suspended;
        sources.forEach(source => { source.castShadow = suspended; });
    }
}

export function batchRigidShadowCasters(root) {
    clearRigidShadowBatches(root);
    if (!root?.userData.proceduralHumanoid) return;
    const animated = new Set((root.userData.animations || []).flatMap(clip =>
        clip.tracks.map(track => PropertyBinding.parseTrackName(track.name).nodeName)));
    const buckets = new Map();
    root.traverse(part => {
        const material = part.material, geometry = part.geometry;
        if (!part.isMesh || part.isSkinnedMesh || part.children.length || !part.visible || !part.castShadow ||
            animated.has(part.name) || Array.isArray(material) || !material?.isMeshStandardMaterial ||
            !material.visible || material.transparent || material.alphaTest || material.alphaHash ||
            material.alphaMap || material.displacementMap || material.clippingPlanes?.length ||
            material.stencilWrite || material.wireframe || material.onBeforeCompile !== Material.prototype.onBeforeCompile ||
            part.customDepthMaterial || part.customDistanceMaterial ||
            !geometry?.attributes.position || Object.keys(geometry.morphAttributes).length) return;
        const count = geometry.index?.count || geometry.attributes.position.count;
        if (geometry.drawRange.start || (Number.isFinite(geometry.drawRange.count) && geometry.drawRange.count !== count)) return;
        const transform = new Matrix4();
        let node = part;
        while (node !== root && !animated.has(node.name)) {
            if (!node?.visible) return;
            node.updateMatrix(); transform.premultiply(node.matrix); node = node.parent;
        }
        if (!node?.visible || transform.determinant() <= 0) return;
        const key = [node.uuid, material.side, material.shadowSide, part.layers.mask].join(':');
        if (!buckets.has(key)) buckets.set(key, { pivot: node, pieces: [] });
        buckets.get(key).pieces.push({ part, transform });
    });
    const state = { batches: [], materials: new Set(), suspended: false }, materials = new Map();
    try {
        for (const { pivot, pieces } of buckets.values()) {
            if (pieces.length < 2) continue;
            const baked = pieces.map(({ part, transform }) => {
                const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
                // Opaque depth uses positions only. Surface normals, colours
                // and roughness/normal UVs cannot change its silhouette.
                for (const name of Object.keys(geometry.attributes)) if (name !== 'position') geometry.deleteAttribute(name);
                return geometry.applyMatrix4(transform);
            });
            let geometry;
            try { geometry = mergeGeometries(baked, false); }
            finally { baked.forEach(piece => piece.dispose()); }
            if (!geometry) continue;
            geometry.computeBoundingBox(); geometry.computeBoundingSphere();
            const first = pieces[0].part, key = `${first.material.side}:${first.material.shadowSide}`;
            if (!materials.has(key)) {
                const material = new MeshBasicMaterial({ side: first.material.side, shadowSide: first.material.shadowSide,
                    colorWrite: false, depthWrite: false });
                materials.set(key, material); state.materials.add(material);
            }
            const mesh = new Mesh(geometry, materials.get(key));
            mesh.name = `RigidShadowBatch_${pivot.name}_${state.batches.length}`;
            mesh.castShadow = true; mesh.layers.mask = first.layers.mask;
            mesh.matrixAutoUpdate = false; mesh.userData.rigidShadowBatch = true;
            const vertexCount = geometry.attributes.position.count;
            // Three's shadow traversal uses the main camera's layers too, so
            // a shadow-only layer cannot isolate this mesh. Public draw-range
            // and shadow hooks submit its vertices only in the shadow pass.
            // Colour traversal has zero vertices and no colour/depth writes.
            geometry.setDrawRange(0, 0);
            mesh.onBeforeShadow = () => geometry.setDrawRange(0, vertexCount);
            mesh.onAfterShadow = () => geometry.setDrawRange(0, 0);
            pivot.add(mesh);
            const sources = pieces.map(({ part }) => part);
            sources.forEach(source => { source.castShadow = false; });
            state.batches.push({ mesh, sources });
        }
        states.set(root, state);
    } catch (error) {
        states.set(root, state); clearRigidShadowBatches(root); throw error;
    }
}
