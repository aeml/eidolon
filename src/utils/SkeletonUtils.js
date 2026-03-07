export function clone(source) {
    const sourceLookup = new Map();
    const cloneLookup = new Map();

    const clonedRoot = source.clone();

    parallelTraverse(source, clonedRoot, (sourceNode, clonedNode) => {
        sourceLookup.set(clonedNode, sourceNode);
        cloneLookup.set(sourceNode, clonedNode);
    });

    clonedRoot.traverse((node) => {
        if (!node.isSkinnedMesh) return;

        const clonedMesh = node;
        const sourceMesh = sourceLookup.get(node);
        const sourceBones = sourceMesh.skeleton.bones;

        clonedMesh.skeleton = sourceMesh.skeleton.clone();
        clonedMesh.bindMatrix.copy(sourceMesh.bindMatrix);
        clonedMesh.skeleton.bones = sourceBones.map((bone) => cloneLookup.get(bone));
        clonedMesh.bind(clonedMesh.skeleton, clonedMesh.bindMatrix);
    });

    return clonedRoot;
}

function parallelTraverse(sourceNode, clonedNode, callback) {
    callback(sourceNode, clonedNode);

    for (let i = 0; i < sourceNode.children.length; i++) {
        parallelTraverse(sourceNode.children[i], clonedNode.children[i], callback);
    }
}
