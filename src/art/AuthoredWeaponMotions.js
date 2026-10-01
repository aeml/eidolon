import * as THREE from 'three';
import { resolveEquipmentVisualDescriptor } from './ProceduralEquipment.js';
import { isDualWieldingRogue } from '../core/EquipmentSlots.js';

const profiles = { longsword: 'Sword', dagger: 'Dagger', staff: 'Staff', mace: 'Mace' };
const states = new Set(['Idle', 'CombatIdle', 'Walk', 'Run', 'Attack', 'Block']);
const leftArm = name => /^(?:clavicle|upperarm|lowerarm|hand|thumb_\d+|index_\d+|middle_\d+|ring_\d+|pinky_\d+)_l\./.test(name);
const swapSide = name => name.replace(/_([lr])(?=\.|$)/, (_, side) => side === 'l' ? '_r' : '_l');

// Reflect rotations through bind-space X, converting through the actual bone
// axes. Simply negating local Euler angles twists this Blender-authored rig.
export function mirrorAttackClip(clip, scene, name) {
    const reflection = new THREE.Matrix4().makeScale(-1, 1, 1);
    const tracks = clip.tracks.map(track => {
        const result = track.clone(); result.name = swapSide(track.name);
        if (!track.name.endsWith('.quaternion')) return result;
        const source = scene.getObjectByName(track.name.split('.')[0]);
        const target = scene.getObjectByName(result.name.split('.')[0]);
        if (!source?.isBone || !target?.isBone) return result;
        const parent = source.parent.getWorldQuaternion(new THREE.Quaternion());
        const targetParent = target.parent.getWorldQuaternion(new THREE.Quaternion());
        const q = new THREE.Quaternion(), matrix = new THREE.Matrix4();
        for (let i = 0; i < track.values.length; i += 4) {
            q.fromArray(track.values, i).multiply(source.quaternion.clone().invert());
            q.premultiply(parent).multiply(parent.clone().invert());
            matrix.makeRotationFromQuaternion(q).premultiply(reflection).multiply(reflection);
            q.setFromRotationMatrix(matrix).premultiply(targetParent.clone().invert()).multiply(targetParent).multiply(target.quaternion).normalize();
            q.toArray(result.values, i);
        }
        return result;
    });
    return new THREE.AnimationClip(name, clip.duration, tracks);
}

export function prepareWeaponMotions(root, scene) {
    const clips = root.userData.animations, byName = new Map(clips.map(clip => [clip.name, clip]));
    scene.updateMatrixWorld(true);
    for (const profile of Object.values(profiles)) {
        for (const state of states) {
            const clip = byName.get(`${profile}_${state}`);
            if (!clip) continue;
            const mirrored = mirrorAttackClip(clip, scene, `${profile}_${state}_Left`);
            clips.push(mirrored); byName.set(mirrored.name, mirrored);
            // Supported grip on both weapons while locomoting/resting.
            const dual = new THREE.AnimationClip(`${profile}_${state}_Dual`, clip.duration,
                [...clip.tracks.filter(track => !leftArm(track.name)), ...mirrored.tracks.filter(track => leftArm(track.name))]);
            clips.push(dual); byName.set(dual.name, dual);
        }
    }
    let nextLeft = false, selectedAttack;
    root.userData.updateWeaponProfile = equipment => {
        root.userData.weaponProfile = profiles[resolveEquipmentVisualDescriptor(equipment.mainHand)?.variant] || 'Unarmed';
        root.userData.offhandWeaponProfile = profiles[resolveEquipmentVisualDescriptor(equipment.offHand)?.variant] || 'Unarmed';
        root.userData.dualWield = isDualWieldingRogue(root.userData.authoredClass, equipment);
        nextLeft = false; selectedAttack = null;
    };
    root.userData.resolveAnimationName = (state, { restart, currentName } = {}) => {
        if (!states.has(state)) return state;
        const profile = root.userData.weaponProfile || 'Unarmed';
        if (state === 'Attack' && root.userData.dualWield) {
            if (restart || currentName !== 'Attack' || !selectedAttack) {
                selectedAttack = nextLeft ? `${root.userData.offhandWeaponProfile}_Attack_Left` : `${profile}_Attack`;
                nextLeft = !nextLeft;
            }
            return byName.has(selectedAttack) ? selectedAttack : state;
        }
        const resolved = `${profile}_${state}${root.userData.dualWield && state !== 'Attack' ? '_Dual' : ''}`;
        return byName.has(resolved) ? resolved : state;
    };
}
