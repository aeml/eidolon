import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { createAuthoredFighterAbilityClips } from './AuthoredFighterAbilityClips.js';
import { prepareAuthoredFighterEquipment, clearAuthoredFighterEquipment } from './AuthoredFighterEquipment.js';
import { installAuthoredFighterSeatedPose } from './AuthoredFighterSeatedPose.js';
import { prepareFittedEquipment, clearFittedEquipment } from './FittedEquipment.js';
import { prepareWeaponMotions } from './AuthoredWeaponMotions.js';

// Only derived exports are runtime candidates. The full-detail source is never
// a boot dependency. MeshFactory loads the selected candidate on demand with
// a procedural fallback; this unpublished integration still needs final review.
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

export function createAuthoredFighterInstance(gltf, { quality = 'high', actorClass = 'Fighter', equipmentLoader, motionAnimations } = {}) {
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
    root.name = `Authored${actorClass}`;
    const visual = new THREE.Group();
    visual.name = `${actorClass}VisualRig`;
    const scale = 4.5 / size.y;
    visual.scale.setScalar(scale);
    visual.position.y = -bounds.min.y * scale;
    // Preserve the supplied root, skin bind matrices and +Z forward. Scaling
    // lives above all mesh/skeleton siblings, not on one skinned mesh alone.
    visual.add(scene);
    root.add(visual);
    root.userData.authoredClass = actorClass;
    root.userData.authoredQuality = quality === 'low' ? 'low' : 'high';
    root.userData.sharedGeometry = true;
    root.userData.bounds = Object.freeze({ radius: 1.25, height: 4.5, origin: 'feet' });
    const animations = motionAnimations || gltf.animations;
    root.userData.animations = [...animations.map(clip => clip.clone()), ...createAuthoredFighterAbilityClips(scene, animations).filter(clip => !animations.some(existing => existing.name === clip.name))];
    // The blade-led diagonal cut reaches its contact pose at 14/30 seconds.
    // Keep that reviewed pose aligned with the existing 35% gameplay impact.
    root.userData.basicAttackContactTime = 14 / 30;
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
    root.userData.resetPose = root.userData.resetRestPose;
    root.updateMatrixWorld(true);
    if (equipmentLoader) {
        prepareFittedEquipment(root, scene, equipmentLoader);
        prepareWeaponMotions(root, scene);
    } else prepareAuthoredFighterEquipment(root);
    installAuthoredFighterSeatedPose(root, gltf.animations);
    let disposed = false;
    root.userData.disposeInstance = () => {
        if (disposed) return;
        disposed = true;
        if (equipmentLoader) clearFittedEquipment(root); else clearAuthoredFighterEquipment(root);
        // SkeletonUtils clones each skeleton; only geometry/material/texture
        // resources are shared with other actors or the cached source.
        const skeletons = new Set();
        scene.traverse(part => { if (part.isSkinnedMesh) skeletons.add(part.skeleton); });
        for (const skeleton of skeletons) skeleton.dispose();
        const hitbox = root.getObjectByName('ActorInteractionHitbox');
        hitbox?.geometry.dispose(); hitbox?.material.dispose();
    };
    return root;
}
