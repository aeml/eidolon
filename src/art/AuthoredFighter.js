import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { createAuthoredFighterAbilityClips } from './AuthoredFighterAbilityClips.js';

// Only derived exports are runtime candidates. The full-detail source is never
// a boot dependency. Default class-factory activation follows equipment and
// skill-motion acceptance; creating a pilot here does not opt the game into it.
export const FIGHTER_RUNTIME_PATHS = Object.freeze({
    high: './assets/archetypes/Fighter/fighter-runtime-high.glb',
    low: './assets/archetypes/Fighter/fighter-runtime-low.glb'
});
export const FIGHTER_AUTHORED_CLIPS = Object.freeze([
    'Attack', 'Block', 'CombatIdle', 'Death', 'Hit', 'Idle', 'Jump',
    'JumpLand', 'JumpLoop', 'JumpStart', 'Run', 'Walk'
]);
export const FIGHTER_AUTHORED_SOCKETS = Object.freeze([
    'socket_back', 'socket_belt', 'socket_chest', 'socket_footL', 'socket_footR',
    'socket_head', 'socket_mainHand', 'socket_offHand', 'socket_shoulderL', 'socket_shoulderR'
]);
const LOWER_BODY_TRACKS = Object.freeze([
    'pelvis.position', 'thigh_l.quaternion', 'calf_l.quaternion', 'foot_l.quaternion', 'ball_l.quaternion',
    'thigh_r.quaternion', 'calf_r.quaternion', 'foot_r.quaternion', 'ball_r.quaternion'
]);

export function fighterRuntimePath(quality = 'high') {
    return FIGHTER_RUNTIME_PATHS[quality === 'low' ? 'low' : 'high'];
}

export function createAuthoredFighterInstance(gltf, { quality = 'high' } = {}) {
    if (!gltf?.scene || !Array.isArray(gltf.animations)) throw new Error('Fighter scene and animation clips are required');
    const clips = new Set(gltf.animations.map(clip => clip.name));
    for (const name of FIGHTER_AUTHORED_CLIPS) {
        if (!clips.has(name)) throw new Error(`Missing authored Fighter clip: ${name}`);
    }
    const scene = cloneSkeleton(gltf.scene);
    for (const name of FIGHTER_AUTHORED_SOCKETS) {
        if (!scene.getObjectByName(name)) throw new Error(`Missing authored Fighter attachment: ${name}`);
    }
    let skinCount = 0;
    scene.traverse(part => {
        if (part.isSkinnedMesh) {
            if (part.skeleton?.bones.length !== 53 || !part.geometry.getAttribute('skinWeight') || !part.geometry.getAttribute('skinIndex')) throw new Error(`Invalid Fighter skin: ${part.name}`);
            skinCount++;
        }
        if (part.isMesh) {
            part.castShadow = true;
            part.receiveShadow = true;
        }
    });
    if (!skinCount) throw new Error('Fighter has no skinned meshes');
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene, true);
    const size = bounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.y) || size.y <= 0 || !Number.isFinite(bounds.min.y)) throw new Error('Fighter has invalid model bounds');

    const root = new THREE.Group();
    root.name = 'AuthoredFighter';
    const visual = new THREE.Group();
    visual.name = 'FighterVisualRig';
    const scale = 4.5 / size.y;
    visual.scale.setScalar(scale);
    visual.position.y = -bounds.min.y * scale;
    // Preserve the supplied root, skin bind matrices and +Z forward. Scaling
    // lives above all mesh/skeleton siblings, not on one skinned mesh alone.
    visual.add(scene);
    root.add(visual);
    root.userData.authoredClass = 'Fighter';
    root.userData.authoredQuality = quality === 'low' ? 'low' : 'high';
    root.userData.sharedGeometry = true;
    root.userData.bounds = Object.freeze({ radius: 1.25, height: 4.5, origin: 'feet' });
    root.userData.animations = [...gltf.animations.map(clip => clip.clone()), ...createAuthoredFighterAbilityClips(scene, gltf.animations)];
    root.userData.lowerBodyAnimationTracks = LOWER_BODY_TRACKS;
    root.userData.authoredScale = scale;
    root.userData.hitReactionRig = visual.name;
    const pose = [];
    scene.traverse(part => pose.push({ part, position: part.position.clone(), quaternion: part.quaternion.clone(), scale: part.scale.clone(), morphs: part.morphTargetInfluences?.slice() }));
    root.userData.resetRestPose = () => {
        for (const saved of pose) {
            saved.part.position.copy(saved.position);
            saved.part.quaternion.copy(saved.quaternion);
            saved.part.scale.copy(saved.scale);
            if (saved.morphs) saved.part.morphTargetInfluences = saved.morphs.slice();
        }
        root.updateMatrixWorld(true);
    };
    root.updateMatrixWorld(true);
    return root;
}
