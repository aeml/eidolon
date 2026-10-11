import * as THREE from 'three';
import { PLAYER_ABILITY_VISUALS } from '../skills/abilityVisualManifest.js';

const TIMES = [0, .16, .36, .5, .64, .82, 1];
const PROFILES = ['Sword', 'Dagger', 'Staff', 'Mace', 'Unarmed'];
const FAMILIES = { heavy: 'Heavy', sweep: 'Sweep', spin: 'Spin', throw: 'Throw', volley: 'Throw' };
const curve = (x = [], y = [], z = []) => TIMES.map((_, i) => [x[i] || 0, y[i] || 0, z[i] || 0]);
const POSES = {
    ShieldBash: {
        upperarm_l: curve([0, -.25, -.55, -.8, -.55, -.2, 0]),
        lowerarm_l: curve([0, -.12, -.3, -.2, -.12, -.04, 0]),
        spine_03: curve([0, -.03, -.05, .16, .08, .02, 0], [0, .08, .15, -.15, -.08, -.02, 0])
    },
    Heavy: {
        upperarm_r: curve([0, -.45, -1.2, -.2, .2, .1, 0]),
        lowerarm_r: curve([0, -.15, -.4, .1, .1, .05, 0]),
        spine_03: curve([0, -.08, -.14, .16, .08, .03, 0], [0, -.12, -.3, .25, .15, .06, 0])
    },
    Sweep: {
        upperarm_r: curve([0, -.12, -.25, -.2, -.1, -.04, 0], [0, -.25, -.65, .65, .45, .15, 0]),
        lowerarm_r: curve([0, -.1, -.2, .2, .12, .04, 0]),
        spine_03: curve([], [0, -.12, -.38, .38, .25, .08, 0])
    },
    Spin: {
        // Consecutive yaw keys differ by less than PI so quaternion slerp
        // follows a full turn instead of shortening 0 -> 2PI to no movement.
        Root: curve([], [0, -.24, .8, 2.4, 4, 5.8, Math.PI * 2]),
        upperarm_l: curve([], [], [0, -.08, -.22, -.22, -.22, -.08, 0])
    },
    Throw: {
        upperarm_r: curve([0, -.45, -.95, .3, .2, .08, 0], [0, -.12, -.25, .2, .12, .04, 0]),
        lowerarm_r: curve([0, -.2, -.5, .25, .16, .05, 0]),
        spine_03: curve([0, -.04, -.08, .12, .06, .02, 0], [0, -.08, -.18, .2, .1, .04, 0])
    }
};

export function prepareAuthoredSkillMotions(root, scene) {
    if (root.userData.authoredClass === 'Wizard') {
        // Flame Whip and Arcane Missiles are spell releases, not physical
        // weapon throws. Reuse the delivered Cast, retaining each duration.
        root.userData.resolveAbilityAnimationName = family => ['sweep', 'volley'].includes(family) ? 'Cast' : null;
        return false;
    }
    const abilities = PLAYER_ABILITY_VISUALS[root.userData.authoredClass];
    const families = new Set(Object.values(abilities || {}).map(ability => FAMILIES[ability.animation]).filter(Boolean));
    if (abilities?.['Shield Slam']) families.add('ShieldBash');
    if (!families.size) return false;
    const clips = root.userData.animations;
    const idleClips = PROFILES.map(profile => clips.find(clip => clip.name === `${profile}_Idle`));
    // Legacy/imported rigs without the reviewed weapon bank keep their clips.
    if (idleClips.some(clip => !clip)) return false;
    const saved = [];
    scene.traverse(part => saved.push({ part, position: part.position.clone(), quaternion: part.quaternion.clone(), scale: part.scale.clone(), morphs: part.morphTargetInfluences?.slice() }));
    const mixer = new THREE.AnimationMixer(scene), created = [];
    try {
        for (const [index, idle] of idleClips.entries()) {
            mixer.stopAllAction();
            mixer.clipAction(idle).play(); mixer.setTime(0); scene.updateWorldMatrix(true, true);
            // Constant equipped stance tracks are shared within this instance's
            // skill clips. Only changed joints own extra arrays; no source edits.
            const stance = idle.tracks.map(track => {
                const value = [...track.createInterpolant().evaluate(0)];
                return new track.constructor(track.name, [0, 1], [...value, ...value]);
            });
            const strike = new Map();
            if (families.has('Spin')) {
                const attack = clips.find(clip => clip.name === `${PROFILES[index]}_Attack`);
                if (!attack) throw new Error(`Missing equipped spin contact: ${PROFILES[index]}`);
                mixer.stopAllAction(); mixer.clipAction(attack).play();
                mixer.setTime(root.userData.basicAttackContactTime || 14 / 30);
                for (const name of ['clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r']) {
                    const bone = scene.getObjectByName(name);
                    if (!bone?.isBone) throw new Error(`Missing equipped spin joint: ${name}`);
                    strike.set(name, bone.quaternion.clone());
                }
                mixer.stopAllAction(); mixer.clipAction(idle).play(); mixer.setTime(0); scene.updateWorldMatrix(true, true);
            }
            for (const [family, poses] of Object.entries(POSES).filter(([family]) => families.has(family))) {
                const changed = new Map();
                for (const [name, angles] of Object.entries(poses)) {
                    const bone = scene.getObjectByName(name);
                    if (!bone?.isBone) throw new Error(`Missing equipped skill joint: ${name}`);
                    const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
                    const inverse = parent.clone().invert(), base = bone.quaternion;
                    const values = angles.flatMap(([x, y, z]) => new THREE.Quaternion()
                        .setFromEuler(new THREE.Euler(x, y, z)).premultiply(inverse).multiply(parent).multiply(base).normalize().toArray());
                    changed.set(`${name}.quaternion`, new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, TIMES, values));
                }
                if (family === 'Spin') for (const [name, contact] of strike) {
                    const base = scene.getObjectByName(name).quaternion;
                    const values = [0, .4, 1, 1, 1, .4, 0].flatMap(weight => base.clone().slerp(contact, weight).toArray());
                    changed.set(`${name}.quaternion`, new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, TIMES, values));
                }
                const tracks = stance.map(track => changed.get(track.name) || track);
                for (const [name, track] of changed) if (!stance.some(base => base.name === name)) tracks.push(track);
                created.push(new THREE.AnimationClip(`${PROFILES[index]}_Skill${family}`, 1, tracks));
            }
        }
    } finally {
        mixer.stopAllAction(); mixer.uncacheRoot(scene);
        for (const { part, position, quaternion, scale, morphs } of saved) {
            part.position.copy(position); part.quaternion.copy(quaternion); part.scale.copy(scale);
            if (morphs) part.morphTargetInfluences = morphs.slice();
        }
        scene.updateWorldMatrix(true, true);
    }
    clips.push(...created);
    root.userData.resolveAbilityAnimationName = (family, skillName) => {
        const motion = skillName === 'Shield Slam' ? 'ShieldBash' : FAMILIES[family];
        return families.has(motion) ? `${root.userData.weaponProfile || 'Unarmed'}_Skill${motion}` : null;
    };
    const arrays = new Set(created.flatMap(clip => clip.tracks.flatMap(track => [track.times, track.values])));
    root.userData.authoredSkillMotions = Object.freeze({ families: Object.keys(POSES).filter(family => families.has(family)), clips: created.length,
        keyframeBytes: [...arrays].reduce((bytes, array) => bytes + array.byteLength, 0) });
    return true;
}
