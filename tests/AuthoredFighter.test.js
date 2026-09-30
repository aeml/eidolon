import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createAuthoredFighterInstance, fighterRuntimePath, FIGHTER_AUTHORED_CLIPS, FIGHTER_AUTHORED_SOCKETS } from '../src/art/AuthoredFighter.js';

function fixture() {
    const scene = new THREE.Group();
    const bones = Array.from({ length: 53 }, (_, i) => Object.assign(new THREE.Bone(), { name: i === 0 ? 'Root' : `Bone${i}` }));
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
            expect(file.length).toBeLessThan(quality === 'high' ? 5_100_000 : 2_800_000);
            expect(json.skins.map(skin => skin.joints.length)).toEqual([53]);
            expect(json.animations.map(clip => clip.name).sort()).toEqual([...FIGHTER_AUTHORED_CLIPS].sort());
            expect(json.nodes.filter(node => node.name?.startsWith('socket_')).map(node => node.name).sort()).toEqual([...FIGHTER_AUTHORED_SOCKETS].sort());
            expect(result.morphTargets).toEqual(['Blink_L', 'Blink_R']);
            expect(result.triangles).toBeLessThan(quality === 'high' ? 57_000 : 25_000);
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

    test('normalizes feet and height without scaling skeleton or authority root separately', () => {
        const source = fixture(), actor = createAuthoredFighterInstance(source, { quality: 'low' });
        const bounds = new THREE.Box3().setFromObject(actor, true);
        expect(bounds.min.y).toBeCloseTo(0);
        expect(bounds.max.y).toBeCloseTo(4.5);
        expect(actor.scale.y).toBe(1);
        expect(actor.userData.authoredQuality).toBe('low');
        actor.getObjectByName('Root').position.x = 4;
        actor.userData.resetRestPose();
        expect(actor.getObjectByName('Root').position.x).toBe(0);
        expect(actor.userData.proceduralHumanoid).toBeUndefined();
    });

    test('rejects incomplete deliveries rather than returning a broken class mesh', () => {
        const noClip = fixture(); noClip.animations.pop();
        expect(() => createAuthoredFighterInstance(noClip)).toThrow('Missing authored Fighter clip');
        const noSocket = fixture(); noSocket.scene.getObjectByName('socket_head').removeFromParent();
        expect(() => createAuthoredFighterInstance(noSocket)).toThrow('Missing authored Fighter attachment');
        const badSkin = fixture(); badSkin.scene.getObjectByName('Fighter_Body').skeleton.bones.pop();
        expect(() => createAuthoredFighterInstance(badSkin)).toThrow('Invalid Fighter skin');
    });
});
