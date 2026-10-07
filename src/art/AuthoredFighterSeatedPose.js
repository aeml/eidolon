import * as THREE from 'three';

const SEATED_ROTATIONS = {
    thigh_l: [-Math.PI / 2, 0, 0], thigh_r: [-Math.PI / 2, 0, 0],
    calf_l: [Math.PI / 2, 0, 0], calf_r: [Math.PI / 2, 0, 0],
    upperarm_l: [-.3, 0, 0], upperarm_r: [-.3, 0, 0],
    lowerarm_l: [-.9, 0, 0], lowerarm_r: [-.9, 0, 0]
};

export function installAuthoredFighterSeatedPose(root, animations) {
    const scene = root.getObjectByName(`${root.userData.authoredClass}_Body`).parent;
    const saved = [];
    scene.traverse(part => saved.push({ part, position: part.position.clone(), quaternion: part.quaternion.clone(), morphs: part.morphTargetInfluences?.slice() }));
    const mixer = new THREE.AnimationMixer(scene), targets = [];
    try {
        mixer.clipAction(animations.find(clip => clip.name === 'Idle')).play();
        mixer.setTime(0); root.updateMatrixWorld(true);
        for (const [name, angles] of Object.entries(SEATED_ROTATIONS)) {
            const bone = scene.getObjectByName(name);
            if (!bone?.isBone) throw new Error(`Missing Fighter seating bone: ${name}`);
            const world = bone.getWorldQuaternion(new THREE.Quaternion()).normalize();
            const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles));
            targets.push({ bone, quaternion: bone.quaternion.clone().multiply(world.clone().invert()).multiply(delta).multiply(world).normalize() });
        }
        const pelvis = scene.getObjectByName('pelvis');
        if (!pelvis?.isBone) throw new Error('Missing Fighter seating bone: pelvis');
        // The exported pelvis's local height lies on Z, not Y. Convert through
        // its actual parent rather than treating Blender coordinates as Y-up.
        const point = pelvis.getWorldPosition(new THREE.Vector3()).applyMatrix4(scene.matrixWorld.clone().invert());
        point.y = (1.12 - root.getObjectByName(root.userData.hitReactionRig).position.y) / root.userData.authoredScale;
        targets.push({ bone: pelvis, rawPosition: point });
    } finally {
        mixer.stopAllAction(); mixer.uncacheRoot(scene);
        for (const entry of saved) {
            entry.part.position.copy(entry.position); entry.part.quaternion.copy(entry.quaternion);
            if (entry.morphs) entry.part.morphTargetInfluences = entry.morphs.slice();
        }
        root.updateMatrixWorld(true);
    }
    root.userData.createSeatedPose = () => {
        const previous = targets.map(({ bone }) => ({ bone, position: bone.position.clone(), quaternion: bone.quaternion.clone() }));
        const point = new THREE.Vector3(), inverse = new THREE.Matrix4();
        return {
            apply() {
                // Only the scene and pelvis-parent transforms are read before
                // applying this pose. Update their ancestor chains, not every
                // skin/socket/item twice. The final traversal below publishes
                // all changed bones and bind matrices before equipment/render.
                scene.updateWorldMatrix(true, false);
                for (const target of targets) {
                    if (target.rawPosition) target.bone.parent.updateWorldMatrix(true, false);
                }
                for (const target of targets) {
                    if (target.rawPosition) {
                        // Recompute through the animated parent: Idle's root
                        // bob must not lift a seated patron off the chair.
                        point.copy(target.rawPosition).applyMatrix4(scene.matrixWorld);
                        inverse.copy(target.bone.parent.matrixWorld).invert();
                        target.bone.position.copy(point.applyMatrix4(inverse));
                    }
                    if (target.quaternion) target.bone.quaternion.copy(target.quaternion);
                }
                root.updateMatrixWorld(true); root.userData.updateEquipmentPose?.();
            },
            restore() {
                for (const entry of previous) { entry.bone.position.copy(entry.position); entry.bone.quaternion.copy(entry.quaternion); }
                root.updateMatrixWorld(true); root.userData.updateEquipmentPose?.();
            }
        };
    };
}
