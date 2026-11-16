import * as THREE from 'three';

export const HUMANOID_ABILITY_CLIPS = Object.freeze(['Cast', 'Channel', 'Guard', 'Shout', 'Bless']);
const TIMES = [0, .16, .34, .5, .76, 1];
const motion = (node, axis, values) => ({ node, axis, values });
const RECIPES = {
    Cast: [
        motion('Rig_UpperArmLeft', 'x', [0, -.35, -.8, -1.12, -.7, 0]),
        motion('Rig_ForearmLeft', 'x', [0, -.45, -.7, -.18, -.15, 0]),
        motion('Rig_UpperArmLeft', 'z', [0, -.08, -.18, -.12, -.06, 0]),
        motion('Rig_UpperArmRight', 'x', [0, -.18, -.32, -.22, -.1, 0]),
        motion('Rig_Chest', 'y', [0, -.12, -.18, .12, .05, 0]),
        motion('Rig_Chest', 'x', [0, -.03, -.07, .1, .04, 0])
    ],
    Channel: [
        motion('Rig_UpperArmLeft', 'x', [0, -.42, -1.08, -1.15, -1.1, 0]),
        motion('Rig_UpperArmRight', 'x', [0, -.2, -.62, -.68, -.62, 0]),
        motion('Rig_ForearmLeft', 'x', [0, -.3, -.4, -.35, -.4, 0]),
        motion('Rig_ForearmRight', 'x', [0, -.12, -.25, -.3, -.25, 0]),
        motion('Rig_UpperArmLeft', 'z', [0, -.12, -.28, -.3, -.28, 0]),
        motion('Rig_UpperArmRight', 'z', [0, .08, .18, .2, .18, 0]),
        motion('Rig_Head', 'x', [0, -.04, -.1, -.12, -.1, 0])
    ],
    Guard: [
        motion('Rig_UpperArmLeft', 'x', [0, -.38, -.65, -.68, -.62, 0]),
        motion('Rig_ForearmLeft', 'x', [0, -.4, -.75, -.72, -.68, 0]),
        motion('Rig_UpperArmLeft', 'z', [0, .05, .12, .14, .12, 0]),
        motion('Rig_UpperArmRight', 'x', [0, -.12, -.28, -.25, -.22, 0]),
        motion('Rig_Chest', 'x', [0, .04, .08, .1, .08, 0]),
        motion('Rig_Head', 'x', [0, .03, .07, .07, .05, 0])
    ],
    Shout: [
        motion('Rig_UpperArmLeft', 'z', [0, -.15, -.3, -.38, -.22, 0]),
        motion('Rig_UpperArmRight', 'z', [0, .12, .25, .32, .2, 0]),
        motion('Rig_UpperArmRight', 'x', [0, -.12, -.38, -.5, -.25, 0]),
        motion('Rig_Chest', 'x', [0, .05, -.12, -.17, -.05, 0]),
        motion('Rig_Head', 'x', [0, .06, -.08, -.14, -.03, 0])
    ],
    Bless: [
        motion('Rig_UpperArmLeft', 'x', [0, -.3, -.82, -1.3, -.94, 0]),
        motion('Rig_UpperArmLeft', 'z', [0, -.06, -.17, -.25, -.15, 0]),
        motion('Rig_ForearmLeft', 'x', [0, -.3, -.55, -.18, -.2, 0]),
        motion('Rig_UpperArmRight', 'x', [0, .03, .12, .17, .08, 0]),
        motion('Rig_Head', 'x', [0, .04, .08, -.07, -.03, 0]),
        motion('Rig_Chest', 'x', [0, .03, .05, -.06, -.02, 0])
    ]
};

export function createHumanoidAbilityClips(root) {
    // Relative to the class's own rest pose: preserve shield/staff/book grips
    // and body proportions. No root translation or lower-body tracks; moving
    // casts retain their gait and stationary casts keep a planted stance.
    return HUMANOID_ABILITY_CLIPS.map(name => new THREE.AnimationClip(name, 1,
        RECIPES[name].map(({ node, axis, values }) => {
            const pivot = root.getObjectByName(node);
            if (!pivot) throw new Error(`Missing ability animation pivot: ${node}`);
            return new THREE.NumberKeyframeTrack(`${node}.rotation[${axis}]`, TIMES,
                values.map(delta => pivot.rotation[axis] + delta), THREE.InterpolateSmooth);
        })));
}
