import * as THREE from 'three';

export const FIGHTER_SKILL_CLIPS = Object.freeze(['Cast', 'Channel', 'Guard', 'Shout', 'Bless']);

// World-axis gestures are converted through the delivered bone orientation.
// This rig's local axes differ from our procedural actors: copying their Euler
// tracks would twist the elbows instead of lifting the arms.
const GESTURES = {
    Cast: { upperarm_r: [-1.2, 0, -.15], lowerarm_r: [-.55, 0, 0], spine_03: [0, -.12, 0] },
    Channel: { upperarm_l: [-1.1, 0, -.12], upperarm_r: [-1.1, 0, .12], lowerarm_l: [-.6, 0, 0], lowerarm_r: [-.6, 0, 0] },
    Shout: { upperarm_l: [-1.9, 0, -.45], upperarm_r: [-1.9, 0, .45], lowerarm_l: [-.6, 0, 0], lowerarm_r: [-.6, 0, 0], spine_03: [-.06, 0, 0] },
    Bless: { upperarm_r: [-2.1, 0, .15], lowerarm_r: [-.35, 0, 0], head: [-.1, 0, 0] }
};

export function createAuthoredFighterAbilityClips(scene, animations) {
    const idle = animations.find(clip => clip.name === 'Idle');
    const block = animations.find(clip => clip.name === 'Block');
    if (!idle || !block) throw new Error('Fighter skill motions require Idle and Block');
    const saved = [];
    scene.traverse(part => saved.push({ part, position: part.position.clone(), quaternion: part.quaternion.clone(), scale: part.scale.clone(), morphs: part.morphTargetInfluences?.slice() }));
    const mixer = new THREE.AnimationMixer(scene);
    try {
        mixer.clipAction(idle).play(); mixer.setTime(0); scene.updateMatrixWorld(true);
        const result = [];
        for (const [name, bones] of Object.entries(GESTURES)) {
            const duration = name === 'Channel' ? 1.4 : 1.1;
            const tracks = idle.tracks.filter(track => !Object.keys(bones).some(bone => track.name === `${bone}.quaternion`))
                .map(track => track.clone().scale(duration / idle.duration));
            for (const [boneName, angles] of Object.entries(bones)) {
                const bone = scene.getObjectByName(boneName);
                if (!bone?.isBone) throw new Error(`Missing Fighter skill bone: ${boneName}`);
                const world = bone.getWorldQuaternion(new THREE.Quaternion());
                const inverse = world.clone().invert(), base = bone.quaternion.clone();
                const values = [];
                for (const weight of [0, .4, 1, 1, .35, 0]) {
                    const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles.map(angle => angle * weight)));
                    values.push(...base.clone().multiply(inverse).multiply(delta).multiply(world).normalize().toArray());
                }
                tracks.push(new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, [0, .15, .35, .65, .85, 1].map(time => time * duration), values));
            }
            result.push(new THREE.AnimationClip(name, duration, tracks));
        }
        const guard = block.clone(); guard.name = 'Guard'; result.push(guard);
        return result;
    } finally {
        mixer.stopAllAction(); mixer.uncacheRoot(scene);
        for (const entry of saved) {
            entry.part.position.copy(entry.position); entry.part.quaternion.copy(entry.quaternion); entry.part.scale.copy(entry.scale);
            if (entry.morphs) entry.part.morphTargetInfluences = entry.morphs.slice();
        }
        scene.updateMatrixWorld(true);
    }
}
