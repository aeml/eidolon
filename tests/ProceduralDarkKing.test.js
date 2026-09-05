import * as THREE from 'three';
import { createProceduralDarkKing } from '../src/art/ProceduralDarkKing.js';
import { createProceduralHollowSentinel } from '../src/art/ProceduralThorncryptBosses.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';
import { GameEngine } from '../src/core/GameEngine.js';

describe('Malachar visual identity', () => {
    test('has unique regalia, grounded feet and bounded silhouette without changing combat radius', () => {
        const king = createProceduralDarkKing();
        expect(king.userData.proceduralActorType).toBe('UmbraPrime');
        expect(king.userData.combatRadius).toBe(2.5);
        for (const name of ['RoyalMantle', 'CrownBand', 'SovereignBlade', 'BoundElement3']) {
            expect(king.getObjectByName(`DarkKing_${name}`)).toBeDefined();
        }
        expect(king.getObjectByName('HollowSentinel_CryptSigil')).toBeUndefined();
        const bounds = new THREE.Box3().setFromObject(king);
        expect(bounds.min.y).toBeCloseTo(0, 5);
        expect(bounds.max.y).toBeLessThanOrEqual(king.userData.bounds.height);
        for (const x of [bounds.min.x, bounds.max.x]) for (const z of [bounds.min.z, bounds.max.z]) {
            expect(Math.hypot(x, z)).toBeLessThanOrEqual(king.userData.bounds.radius);
        }
        expect(new THREE.Box3().setFromObject(king.getObjectByName('HollowSentinel_RootFootLeft')).min.y).toBeCloseTo(0, 5);
    });

    test('reuses immutable resources without recoloring or retiming other Sentinels', () => {
        const sentinel = createProceduralHollowSentinel();
        const chest = sentinel.getObjectByName('HollowSentinel_BreastReliquary');
        const color = chest.material.color.getHex();
        const tracks = sentinel.userData.animations.map((clip) => clip.toJSON());
        const first = createProceduralDarkKing();
        const second = createProceduralDarkKing();
        expect(chest.material.color.getHex()).toBe(color);
        expect(sentinel.userData.animations.map((clip) => clip.toJSON())).toEqual(tracks);
        const a = first.getObjectByName('DarkKing_RoyalMantle');
        const b = second.getObjectByName('DarkKing_RoyalMantle');
        expect(a).not.toBe(b);
        expect(a.geometry).toBe(b.geometry);
        expect(a.material).toBe(b.material);
        expect(first.getObjectByName('HollowSentinel_BreastReliquary').material).not.toBe(chest.material);
    });

    test.each(['Idle', 'Walk', 'Run', 'Attack', 'Death'])('%s retains valid rig bindings and pool reset', (name) => {
        const king = createProceduralDarkKing();
        const body = king.getObjectByName('Rig_HollowSentinelBody');
        const rest = body.position.clone();
        const mixer = new THREE.AnimationMixer(king);
        const clip = king.userData.animations.find((clip) => clip.name === name);
        for (const track of clip.tracks) expect(king.getObjectByName(track.name.split('.')[0])).toBeDefined();
        mixer.clipAction(clip).play();
        mixer.update(0.31);
        king.updateMatrixWorld(true);
        king.traverse((object) => expect(object.matrixWorld.elements.every(Number.isFinite)).toBe(true));
        mixer.stopAllAction();
        king.userData.resetPose();
        expect(body.position.equals(rest)).toBe(true);
        expect(king.getObjectByName('DarkKing_RoyalMantle').parent).toBe(body);
    });

    test('live remote construction and factory pooling select the king, not the source enemy', async () => {
        const engine = Object.create(GameEngine.prototype);
        const actor = engine.createRemotePlayer('Enemy', 'raid-boss', 'UmbraPrime');
        expect(actor.meshType).toBe('UmbraPrime');
        expect(actor.name).toBe('Malachar, the Dark King');
        expect(actor.radius).toBe(2.5);
        const mesh = await MeshFactory.createMeshForType(actor.meshType);
        expect(mesh.userData.proceduralActorType).toBe('UmbraPrime');
        MeshFactory.releaseMesh(actor.meshType, mesh);
        const reused = await MeshFactory.createMeshForType('UmbraPrime');
        expect(reused).toBe(mesh);
        expect(reused.getObjectByName('DarkKing_RoyalMantle').visible).toBe(true);
    });
});
