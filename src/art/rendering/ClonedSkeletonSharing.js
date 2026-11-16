// SkeletonUtils clones each skinned submesh's skeleton, even for one GLTF skin.
// Reuse only exact rigs inside this freshly cloned actor. Each mesh keeps its
// own bind matrices/mode; source rigs, equipment and other actors stay separate.
export function shareClonedSkeletons(scene) {
    const rigs = new Map();
    scene.traverse(part => {
        if (!part.isSkinnedMesh) return;
        const skeleton = part.skeleton;
        if (!skeleton.boneInverses.every(matrix => matrix.elements.every(Number.isFinite))) return;
        const key = skeleton.bones.map(bone => bone.uuid).join('|');
        const candidates = rigs.get(key) || [];
        const match = candidates.find(candidate =>
            candidate.bones.every((bone, index) => bone === skeleton.bones[index]) &&
            candidate.boneInverses.length === skeleton.boneInverses.length &&
            candidate.boneInverses.every((matrix, index) => matrix.equals(skeleton.boneInverses[index])));
        if (match) part.skeleton = match;
        else { candidates.push(skeleton); rigs.set(key, candidates); }
    });
}

