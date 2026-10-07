import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createAuthoredFighterInstance, fighterRuntimePath, FIGHTER_AUTHORED_CLIPS, FIGHTER_AUTHORED_SOCKETS } from '../src/art/AuthoredFighter.js';
import { FIGHTER_SKILL_CLIPS } from '../src/art/AuthoredFighterAbilityClips.js';
import { applyEquipmentVisuals, clearEquipmentVisuals } from '../src/art/EquipmentVisuals.js';
import { jest } from '@jest/globals';
import { MeshFactory } from '../src/utils/MeshFactory.js';

function fixture() {
    const scene = new THREE.Group();
    const names = ['Root', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'spine_03', 'head', 'pelvis', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'neck_01'];
    const bones = Array.from({ length: 53 }, (_, i) => Object.assign(new THREE.Bone(), { name: names[i] || `Bone${i}` }));
    for (let i = 1; i < bones.length; i++) bones[0].add(bones[i]);
    scene.add(bones[0]);
    for (const name of FIGHTER_AUTHORED_SOCKETS) {
        const socket = new THREE.Group(); socket.name = name; bones[0].add(socket);
    }
    const geometry = new THREE.BoxGeometry(.6, 1.9, .3);
    geometry.translate(0, .95, 0);
    const count = geometry.getAttribute('position').count;
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
    const weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) weights[i * 4] = 1;
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    const body = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
    body.name = 'Fighter_Body'; scene.add(body);
    scene.updateMatrixWorld(true);
    body.bind(new THREE.Skeleton(bones));
    return { scene, animations: FIGHTER_AUTHORED_CLIPS.map(name => new THREE.AnimationClip(name, 1, [new THREE.QuaternionKeyframeTrack('Root.quaternion', [0, 1], [0, 0, 0, 1, 0, .2, 0, Math.sqrt(.96)])])) };
}

describe('delivered Fighter runtime candidates', () => {
    test('retains exact rig, clips, sockets and blinks with smaller qualified payloads', () => {
        const manifest = JSON.parse(fs.readFileSync('assets/archetypes/Fighter/fighter-runtime.manifest.json', 'utf8'));
        const source = fs.readFileSync('assets/archetypes/Fighter/fighter.glb');
        expect(createHash('sha256').update(source).digest('hex')).toBe(manifest.source.sha256);
        for (const quality of ['high', 'low']) {
            const file = fs.readFileSync(fighterRuntimePath(quality));
            const json = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)));
            const result = manifest.variants[quality];
            expect(file.readUInt32LE(8)).toBe(file.length);
            expect(createHash('sha256').update(file).digest('hex')).toBe(result.sha256);
            // Preserve the fitted secondary meshes and lossless data maps:
            // 7.33/3.64 MB versus the immutable 40.34 MB source.
            expect(file.length).toBeLessThan(quality === 'high' ? 7_400_000 : 3_700_000);
            expect(json.skins.map(skin => skin.joints.length)).toEqual([53]);
            expect(json.animations.map(clip => clip.name).sort()).toEqual([...FIGHTER_AUTHORED_CLIPS].sort());
            expect(json.nodes.filter(node => node.name?.startsWith('socket_')).map(node => node.name).sort()).toEqual([...FIGHTER_AUTHORED_SOCKETS].sort());
            expect(result.morphTargets).toEqual(['Blink_L', 'Blink_R']);
            expect(result.triangles).toBeLessThan(quality === 'high' ? 65_000 : 37_000);
            for (const [name, triangles] of Object.entries(manifest.source.meshTriangles)) {
                if (name !== 'Fighter_Body') expect(result.meshTriangles[name]).toBe(triangles);
            }
            expect(result.externalDependencies).toEqual([]);
        }
        expect(fighterRuntimePath('unknown')).toBe(fighterRuntimePath('high'));
    });

    test('clones complete independent skeletons but shares immutable geometry/textures', () => {
        const source = fixture();
        const a = createAuthoredFighterInstance(source), b = createAuthoredFighterInstance(source);
        const first = a.getObjectByName('Fighter_Body'), second = b.getObjectByName('Fighter_Body');
        expect(first.skeleton).not.toBe(second.skeleton);
        expect(first.skeleton.bones[0]).toBe(a.getObjectByName('Root'));
        expect(second.skeleton.bones[0]).toBe(b.getObjectByName('Root'));
        expect(first.geometry).toBe(second.geometry);
        expect(a.userData.animations[0]).not.toBe(b.userData.animations[0]);
        a.getObjectByName('Root').rotation.x = .5;
        expect(b.getObjectByName('Root').rotation.x).toBeCloseTo(0, 12);
        expect(source.scene.getObjectByName('Root').rotation.x).toBeCloseTo(0, 12);
    });

    test('shares exact body rigs within one actor without changing skinning or ownership', () => {
        const source = fixture(), original = source.scene.getObjectByName('Fighter_Body');
        const shell = original.clone(false); shell.name = 'BodyShell';
        shell.skeleton = original.skeleton.clone();
        shell.bindMatrix.makeTranslation(.2, 0, 0);
        shell.bindMatrixInverse.copy(shell.bindMatrix).invert();
        shell.bindMode = 'detached';
        source.scene.add(shell);
        const actor = createAuthoredFighterInstance(source), sibling = createAuthoredFighterInstance(source);
        const body = actor.getObjectByName('Fighter_Body'), fitted = actor.getObjectByName('BodyShell');
        expect(body.skeleton).toBe(fitted.skeleton);
        expect(body.skeleton).not.toBe(original.skeleton);
        expect(body.skeleton).not.toBe(shell.skeleton);
        expect(body.skeleton).not.toBe(sibling.getObjectByName('Fighter_Body').skeleton);
        expect(fitted.bindMatrix.equals(shell.bindMatrix)).toBe(true);
        expect(fitted.bindMode).toBe('detached');
        const independent = new Map([body, fitted].map(mesh => [mesh, mesh.skeleton.clone()]));
        for (const angle of [0, .4, -.7]) {
            actor.getObjectByName('Root').rotation.z = angle;
            actor.position.set(angle * 3, 1, -2); actor.updateMatrixWorld(true);
            body.skeleton.update();
            for (const mesh of [body, fitted]) {
                const shared = mesh.skeleton, reference = independent.get(mesh); reference.update();
                for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
                    const point = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i);
                    const actual = mesh.applyBoneTransform(i, point.clone());
                    mesh.skeleton = reference;
                    const expected = mesh.applyBoneTransform(i, point.clone());
                    mesh.skeleton = shared;
                    expect(actual.distanceTo(expected)).toBeLessThan(1e-12);
                }
            }
        }
        const own = jest.spyOn(body.skeleton, 'dispose'), other = jest.spyOn(sibling.getObjectByName('Fighter_Body').skeleton, 'dispose');
        const cached = jest.spyOn(original.skeleton, 'dispose');
        actor.userData.disposeInstance(); actor.userData.disposeInstance();
        expect(own).toHaveBeenCalledTimes(1);
        expect(other).not.toHaveBeenCalled(); expect(cached).not.toHaveBeenCalled();
        expect(original.skeleton).not.toBe(shell.skeleton);
    });

    test('keeps different inverse matrices and joint ordering as separate body rigs', () => {
        const source = fixture(), body = source.scene.getObjectByName('Fighter_Body');
        const offset = body.clone(false); offset.name = 'OffsetSkin'; offset.skeleton = body.skeleton.clone();
        offset.skeleton.boneInverses = offset.skeleton.boneInverses.map(matrix => matrix.clone());
        offset.skeleton.boneInverses[1].elements[12] = .1;
        const reordered = body.clone(false); reordered.name = 'ReorderedSkin'; reordered.skeleton = body.skeleton.clone();
        [reordered.skeleton.bones[1], reordered.skeleton.bones[2]] = [reordered.skeleton.bones[2], reordered.skeleton.bones[1]];
        source.scene.add(offset, reordered);
        const actor = createAuthoredFighterInstance(source);
        expect(new Set(['Fighter_Body', 'OffsetSkin', 'ReorderedSkin'].map(name => actor.getObjectByName(name).skeleton)).size).toBe(3);
    });

    test('normalizes feet and height without scaling skeleton or authority root separately', () => {
        const source = fixture(), actor = createAuthoredFighterInstance(source, { quality: 'low' });
        const bounds = new THREE.Box3().setFromObject(actor, true);
        expect(bounds.min.y).toBeCloseTo(0);
        expect(bounds.max.y).toBeCloseTo(4.5);
        expect(actor.scale.y).toBe(1);
        expect(actor.userData.authoredQuality).toBe('low');
        expect(actor.userData.basicAttackContactTime).toBeCloseTo(14 / 30, 8);
        actor.getObjectByName('Root').position.x = 4;
        actor.userData.resetRestPose();
        expect(actor.getObjectByName('Root').position.x).toBe(0);
        expect(actor.userData.proceduralHumanoid).toBeUndefined();
    });

    test('provides distinct class skill gestures without altering the source or rest pose', () => {
        const source = fixture(), actor = createAuthoredFighterInstance(source);
        const clips = actor.userData.animations;
        for (const name of FIGHTER_SKILL_CLIPS) expect(clips.some(clip => clip.name === name)).toBe(true);
        const mixer = new THREE.AnimationMixer(actor);
        const arm = actor.getObjectByName('upperarm_r'), rest = arm.quaternion.clone();
        mixer.clipAction(clips.find(clip => clip.name === 'Shout')).play(); mixer.setTime(.4);
        expect(arm.quaternion.angleTo(rest)).toBeGreaterThan(1);
        expect(source.scene.getObjectByName('upperarm_r').quaternion.toArray()).toEqual([0, 0, 0, 1]);
        mixer.stopAllAction(); mixer.uncacheRoot(actor); actor.userData.resetRestPose();
        expect(arm.quaternion.toArray()).toEqual(rest.toArray());
        expect(clips.find(clip => clip.name === 'Guard').tracks).not.toBe(source.animations.find(clip => clip.name === 'Block').tracks);
    });

    test('fits interleaved skins without corrupting weights or changing shared source geometry', () => {
        const source = fixture(), original = source.scene.getObjectByName('Fighter_Body').geometry;
        const count = original.attributes.position.count, data = new Float32Array(count * 12), joints = new Uint16Array(count * 6);
        for (let i = 0; i < count; i++) {
            for (const [name, offset] of [['position', 0], ['normal', 3], ['uv', 6], ['skinWeight', 8]]) {
                const attribute = original.attributes[name];
                for (let channel = 0; channel < attribute.itemSize; channel++) data[i * 12 + offset + channel] = attribute.getComponent(i, channel);
            }
            joints[i * 6] = joints[i * 6 + 1] = 65535; joints[i * 6 + 2] = 5; // spine_03, not interleaved padding
        }
        const buffer = new THREE.InterleavedBuffer(data, 12);
        for (const [name, size, offset] of [['position', 3, 0], ['normal', 3, 3], ['uv', 2, 6], ['skinWeight', 4, 8]]) original.setAttribute(name, new THREE.InterleavedBufferAttribute(buffer, size, offset));
        original.setAttribute('skinIndex', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(joints, 6), 4, 2));
        const before = original.index.array.slice(), actor = createAuthoredFighterInstance(source);
        const loadout = { chest: { id: 'mail', name: 'Plate Mail', rarity: 'Rare', potency: 4, sockets: 2, gems: [{ type: 'Ruby' }, { type: 'Sapphire' }] } };
        expect(applyEquipmentVisuals(actor, loadout).items).toBe(1);
        const shell = actor.getObjectByName('AuthoredGear_chest');
        expect(shell.geometry.index.count).toBeGreaterThan(0);
        for (let i = 0; i < shell.geometry.attributes.position.count; i++) {
            expect(shell.geometry.attributes.skinIndex.getX(i)).toBe(5);
            expect(shell.geometry.attributes.skinWeight.getX(i)).toBe(1);
        }
        expect(original.index.array).toEqual(before);
        expect(actor.getObjectByName('Fighter_Body').geometry).not.toBe(original);
        expect(applyEquipmentVisuals(actor, loadout).changed).toBe(false);
        const sharedDispose = jest.spyOn(shell.geometry, 'dispose'), owned = [];
        actor.traverse(part => { if (part.userData.authoredOwnedGeometry) owned.push(jest.spyOn(part.geometry, 'dispose')); });
        expect(owned.length).toBeGreaterThan(0);
        expect(clearEquipmentVisuals(actor)).toBe(true);
        owned.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
        expect(sharedDispose).not.toHaveBeenCalled();
        expect(actor.getObjectByName('Fighter_Body').geometry).toBe(original);
        expect(actor.getObjectByName('AuthoredFighterGarments').children).toHaveLength(6);
        expect(actor.getObjectByName('AuthoredFighterGarments').children.every(mount => mount.children.length === 0)).toBe(true);
        jest.restoreAllMocks();
    });

    test('rejects incomplete deliveries rather than returning a broken class mesh', () => {
        const noClip = fixture(); noClip.animations.pop();
        expect(() => createAuthoredFighterInstance(noClip)).toThrow('Missing authored Fighter clip');
        const noSocket = fixture(); noSocket.scene.getObjectByName('socket_head').removeFromParent();
        expect(() => createAuthoredFighterInstance(noSocket)).toThrow('Missing authored Fighter attachment');
        const badSkin = fixture(); badSkin.scene.getObjectByName('Fighter_Body').skeleton.bones.pop();
        expect(() => createAuthoredFighterInstance(badSkin)).toThrow('Invalid Fighter skin');
    });

    test('normal factory selects quality, preserves independent rigs and resets quality-specific pooled poses', async () => {
        const originalPool = MeshFactory.pool, source = fixture(); MeshFactory.pool = {};
        const load = jest.spyOn(MeshFactory, 'loadModelWithTimeout').mockResolvedValue(source);
        try {
            const first = await MeshFactory.createMeshForType('Fighter', { quality: 'high' });
            const second = await MeshFactory.createMeshForType('Fighter', { quality: 'high' });
            expect(first.userData.authoredClass).toBe('Fighter');
            expect(first.getObjectByName('Root')).not.toBe(second.getObjectByName('Root'));
            first.getObjectByName('Root').position.x = 20;
            applyEquipmentVisuals(first, { head: { id: 'helm', name: 'Iron Helm' } });
            MeshFactory.releaseMesh('Fighter', first);
            const low = await MeshFactory.createMeshForType('Fighter', { quality: 'low' });
            expect(low).not.toBe(first); expect(low.userData.authoredQuality).toBe('low');
            expect(load).toHaveBeenNthCalledWith(6, fighterRuntimePath('low'), 8000);
            const reused = await MeshFactory.createMeshForType('Fighter', { quality: 'high' });
            expect(reused).toBe(first); expect(first.getObjectByName('Root').position.x).toBe(0);
            expect(first.userData.equipmentVisualItemCount).toBe(0);
            expect(first.visible).toBe(true); expect(source.scene.getObjectByName('Root').position.x).toBe(0);
            expect(load).toHaveBeenCalledTimes(7);
        } finally { MeshFactory.pool = originalPool; load.mockRestore(); }
    });

    test('shield face follows torso rather than unarmed wrist twist and clears before a tome', () => {
        const root = createAuthoredFighterInstance(fixture());
        const mount = root.getObjectByName('AuthoredMount_offHand'), neutral = mount.quaternion.clone();
        applyEquipmentVisuals(root, { offHand: { id: 'shield', name: 'Wooden Shield' } });
        const facing = mount.getWorldQuaternion(new THREE.Quaternion());
        root.getObjectByName('socket_offHand').rotation.x = Math.PI / 2;
        root.userData.updateEquipmentPose();
        expect(mount.getWorldQuaternion(new THREE.Quaternion()).angleTo(facing)).toBeLessThan(1e-6);
        applyEquipmentVisuals(root, { offHand: { id: 'tome', name: 'Spell Tome' } });
        expect(mount.quaternion.angleTo(neutral)).toBeLessThan(1e-6);
        clearEquipmentVisuals(root);
    });

    test('discard disposes owned skeletons once, never shared body geometry or a sibling rig', () => {
        const source = fixture(), first = createAuthoredFighterInstance(source), sibling = createAuthoredFighterInstance(source);
        const body = first.getObjectByName('Fighter_Body'), twin = sibling.getObjectByName('Fighter_Body');
        const own = jest.spyOn(body.skeleton, 'dispose'), other = jest.spyOn(twin.skeleton, 'dispose');
        const shared = jest.spyOn(body.geometry, 'dispose');
        first.userData.disposeInstance(); first.userData.disposeInstance();
        expect(own).toHaveBeenCalledTimes(1); expect(other).not.toHaveBeenCalled(); expect(shared).not.toHaveBeenCalled();
        jest.restoreAllMocks();
    });

    test('seating compensates animated ancestors with only one whole-rig matrix traversal', () => {
        const actor = createAuthoredFighterInstance(fixture());
        const pelvis = actor.getObjectByName('pelvis'), rig = actor.getObjectByName('Root');
        const body = actor.getObjectByName('Fighter_Body'), pose = actor.userData.createSeatedPose();
        pose.apply();
        const localSeat = pelvis.getWorldPosition(new THREE.Vector3()).applyMatrix4(actor.matrixWorld.clone().invert());
        const parent = new THREE.Group(); parent.add(actor);
        const traversal = jest.spyOn(body, 'updateMatrixWorld');
        actor.userData.updateEquipmentPose = jest.fn();
        for (const angle of [0, .4, -.6]) {
            parent.position.set(5, 2, -3); parent.rotation.y = angle; parent.scale.setScalar(1.2);
            actor.position.set(-2, 1, 4); actor.rotation.y = -.3;
            rig.position.set(.2, .6, -.1); rig.rotation.set(.1, angle, .2);
            traversal.mockClear(); actor.userData.updateEquipmentPose.mockClear();
            pose.apply();
            expect(traversal).toHaveBeenCalledTimes(1);
            expect(actor.userData.updateEquipmentPose).toHaveBeenCalledTimes(1);
            const actual = pelvis.getWorldPosition(new THREE.Vector3());
            expect(actual.distanceTo(localSeat.clone().applyMatrix4(actor.matrixWorld))).toBeLessThan(1e-10);
            const identity = body.bindMatrixInverse.clone().multiply(body.matrixWorld).elements;
            identity.forEach((value, index) => expect(value).toBeCloseTo(index % 5 === 0 ? 1 : 0, 10));
        }
        traversal.mockRestore();
    });

    test('seating changes the rig, not authority, and restores the exact prior pose', () => {
        const source = fixture(), root = createAuthoredFighterInstance(source);
        const pelvis = root.getObjectByName('pelvis'), thigh = root.getObjectByName('thigh_l');
        const oldPosition = pelvis.position.clone(), oldRotation = thigh.quaternion.clone();
        const pose = root.userData.createSeatedPose(); pose.apply();
        expect(pelvis.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(1.12, 5);
        expect(thigh.quaternion.angleTo(oldRotation)).toBeGreaterThan(1);
        expect(root.position.toArray()).toEqual([0, 0, 0]);
        expect(source.scene.getObjectByName('thigh_l').quaternion.toArray()).toEqual([0, 0, 0, 1]);
        pose.restore();
        expect(pelvis.position.toArray()).toEqual(oldPosition.toArray());
        expect(thigh.quaternion.toArray()).toEqual(oldRotation.toArray());
    });
});
