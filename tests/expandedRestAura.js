// Controlled GPU reference, not a second runtime implementation. Authored-motion
// unit tests independently verify the source instance transforms. Reuse materials
// by source/tint so the reference does not manufacture per-mote material churn.
// Caller owns only cache values; source geometry/materials remain shared.
export function expandedRestAura(THREE, batch, materialCache) {
    const expanded = new THREE.Group();
    expanded.position.copy(batch.position);
    expanded.quaternion.copy(batch.quaternion);
    expanded.scale.copy(batch.scale);
    for (const part of batch.children) {
        if (!part.isInstancedMesh) { expanded.add(part.clone()); continue; }
        for (let slot = 0; slot < part.count; slot++) {
            let material = part.material;
            if (part.instanceColor) {
                const tint = new THREE.Color(); part.getColorAt(slot, tint);
                const key = `${material.uuid}:${tint.toArray().join(',')}`;
                if (!materialCache.has(key)) {
                    const colored = material.clone(); colored.color.multiply(tint);
                    materialCache.set(key, colored);
                }
                material = materialCache.get(key);
            }
            const mote = new THREE.Mesh(part.geometry, material);
            mote.name = `${part.name}:${slot}`;
            mote.matrixAutoUpdate = false; part.getMatrixAt(slot, mote.matrix);
            expanded.add(mote);
        }
    }
    return expanded;
}
