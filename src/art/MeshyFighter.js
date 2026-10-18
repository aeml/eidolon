import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { createAuthoredFighterAbilityClips } from './AuthoredFighterAbilityClips.js';
import { prepareAuthoredFighterEquipment, clearAuthoredFighterEquipment } from './AuthoredFighterEquipment.js';
import { installAuthoredFighterSeatedPose } from './AuthoredFighterSeatedPose.js';

export const MESHY_FIGHTER_PATHS = Object.freeze({
    high: './assets/archetypes/Fighter/meshy-pilot-high.glb',
    low: './assets/archetypes/Fighter/meshy-pilot-low.glb'
});
export const isMeshyFighterSelected = (search = globalThis.location?.search || '') => new URLSearchParams(search).get('fighterModel') === 'meshy';

export function createMeshyFighter(gltf, { quality = 'high' } = {}) {
    const sourceClips = new Map(gltf.animations.map(clip => [clip.name, clip]));
    for (const name of ['Idle', 'Walk', 'Run', 'Attack', 'HitReaction', 'Death']) if (!sourceClips.has(name)) throw new Error(`Missing Meshy motion: ${name}`);
    const scene = cloneSkeleton(gltf.scene), body = scene.getObjectByName('Fighter_Body');
    if (!body?.isSkinnedMesh || body.skeleton.bones.length !== 24) throw new Error('Invalid Meshy Fighter skin');
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene, true), height = bounds.max.y - bounds.min.y;
    if (!Number.isFinite(height) || height <= 0) throw new Error('Invalid Meshy Fighter bounds');
    const root = new THREE.Group(), visual = new THREE.Group();
    root.name = 'MeshyFighter'; visual.name = 'FighterVisualRig';
    const scale = 4.5 / height;
    visual.scale.setScalar(scale); visual.position.y = -bounds.min.y * scale;
    visual.add(scene); root.add(visual);
    scene.traverse(part => { if (part.isMesh) { part.castShadow = true; part.receiveShadow = true; } });
    const socket = (name, boneName, handSide = 0) => {
        const bone = scene.getObjectByName(boneName);
        if (!bone?.isBone) throw new Error(`Missing Meshy attachment: ${boneName}`);
        const node = new THREE.Group(); node.name = name; bone.add(node);
        if (handSide) {
            const point = bone.getWorldPosition(new THREE.Vector3());
            point.x += handSide * .075 * scale;
            node.position.copy(bone.worldToLocal(point));
        }
    };
    root.updateMatrixWorld(true);
    for (const [name, bone, side] of [['head', 'head'], ['chest', 'spine_03'], ['belt', 'pelvis'], ['back', 'spine_03'],
        ['mainHand', 'hand_r', -1], ['offHand', 'hand_l', 1], ['shoulderL', 'clavicle_l'], ['shoulderR', 'clavicle_r'], ['footL', 'foot_l'], ['footR', 'foot_r']]) socket(`socket_${name}`, bone, side);
    const animations = gltf.animations.map(clip => clip.clone());
    for (const name of ['CombatIdle', 'Block']) { const clip = sourceClips.get('Idle').clone(); clip.name = name; animations.push(clip); }
    animations.push(...createAuthoredFighterAbilityClips(scene, animations));
    Object.assign(root.userData, {
        meshyPilot: true, authoredClass: 'Fighter', authoredQuality: quality, authoredScale: scale, sharedGeometry: true,
        animations, hitReactionRig: visual.name, hitReactionAnimation: 'HitReaction',
        bounds: Object.freeze({ radius: 1.25, height: 4.5, origin: 'feet' }),
        basicAttackContactTime: sourceClips.get('Attack').duration * .45,
        lowerBodyAnimationTracks: ['pelvis.position', ...['thigh', 'calf', 'foot', 'ball'].flatMap(bone => ['l', 'r'].map(side => `${bone}_${side}.quaternion`))]
    });
    root.userData.resolveAnimationName = name => root.userData.hitReactionClipActive && ['Idle', 'CombatIdle'].includes(name) ? 'HitReaction' : name;
    const pose = [];
    scene.traverse(part => pose.push({ part, position: part.position.clone(), quaternion: part.quaternion.clone(), scale: part.scale.clone() }));
    root.userData.resetRestPose = root.userData.resetPose = () => {
        root.userData.hitReactionClipActive = false;
        for (const saved of pose) { saved.part.position.copy(saved.position); saved.part.quaternion.copy(saved.quaternion); saved.part.scale.copy(saved.scale); }
        root.updateMatrixWorld(true);
    };
    prepareAuthoredFighterEquipment(root);
    installAuthoredFighterSeatedPose(root, animations);
    let disposed = false;
    root.userData.disposeInstance = () => {
        if (disposed) return;
        disposed = true; clearAuthoredFighterEquipment(root);
        body.skeleton.dispose();
        const hitbox = root.getObjectByName('ActorInteractionHitbox');
        hitbox?.geometry.dispose(); hitbox?.material.dispose();
    };
    return root;
}
