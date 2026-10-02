import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

// Dedicated, permanently dressed NPC; never route through player equipment.
export const ILYRA_MODEL_PATH = './assets/npcs/ilyra/ilyra-archmage.glb';

export function createAuthoredIlyraInstance(gltf) {
    const idle = gltf?.animations?.find(clip => clip.name === 'Idle');
    if (!gltf?.scene || !idle || !gltf.scene.getObjectByName('Ilyra_FourfoldCostume')
        || !gltf.scene.getObjectByName('Ilyra_HeadAndHands')) throw new Error('Complete dressed Ilyra scene and Idle motion are required');
    let skinCount = 0;
    gltf.scene.traverse(part => {
        if (part.isSkinnedMesh) {
            if (part.skeleton?.bones.length !== 53 || !part.geometry.getAttribute('skinIndex')
                || !part.geometry.getAttribute('skinWeight')) throw new Error('Invalid Ilyra skin');
            skinCount++;
        }
    });
    if (!skinCount) throw new Error('Ilyra has no skinned costume');
    const scene = cloneSkeleton(gltf.scene), skeletons = new Set();
    scene.traverse(part => {
        if (!part.isMesh) return;
        part.castShadow = true; part.receiveShadow = true;
        if (part.isSkinnedMesh) skeletons.add(part.skeleton);
    });
    const root = new THREE.Group(), visual = new THREE.Group();
    root.name = 'ArchmageIlyra'; visual.name = 'IlyraVisualRig';
    // Metres, Y-up, +Z forward. Preserve the skin/skeleton hierarchy together.
    visual.scale.setScalar(4.5 / 1.84);
    visual.position.y = -.05 * visual.scale.y;
    visual.add(scene); root.add(visual);
    root.userData.sharedGeometry = true;
    root.userData.npcAppearance = 'ilyra-fourfold-archmage';
    root.userData.meshPoolKey = 'ArchmageIlyra';
    root.userData.bounds = Object.freeze({ radius: 1.35, height: 5.4, origin: 'feet' });
    root.userData.animations = [idle.clone()];
    const pose = [];
    scene.traverse(part => pose.push({ part, position: part.position.clone(), quaternion: part.quaternion.clone(), scale: part.scale.clone(), morphs: part.morphTargetInfluences?.slice() }));
    root.userData.resetPose = () => {
        for (const saved of pose) {
            saved.part.position.copy(saved.position); saved.part.quaternion.copy(saved.quaternion); saved.part.scale.copy(saved.scale);
            if (saved.morphs) saved.part.morphTargetInfluences = saved.morphs.slice();
        }
        root.updateMatrixWorld(true);
    };
    let disposed = false;
    root.userData.disposeInstance = () => {
        if (disposed) return;
        disposed = true;
        for (const skeleton of skeletons) skeleton.dispose();
        const hitbox = root.getObjectByName('ActorInteractionHitbox');
        hitbox?.geometry.dispose(); hitbox?.material.dispose();
        // Cached meshes/materials/textures remain shared with other instances.
    };
    return root;
}
