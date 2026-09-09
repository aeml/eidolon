import { GameEngine } from '../src/core/GameEngine.js';
import { AvengingSeraph } from '../src/entities/AvengingSeraph.js';
import { QuestNPC } from '../src/entities/QuestNPC.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';
import { CrystalKeeper } from '../src/entities/CrystalKeeper.js';
import * as THREE from 'three';

test('Maelin is a clothed adult artificer, not a summoned guardian or quest giver', async () => {
    const engine = Object.create(GameEngine.prototype);
    const keeper = engine.createRemotePlayer('NPC', 'crystal-artificer-raid', 'CrystalKeeper');
    expect(keeper).not.toBeInstanceOf(AvengingSeraph);
    expect(keeper).not.toBeInstanceOf(QuestNPC);
    expect(keeper.type).toBe('CrystalKeeper');
    expect(keeper.name).toBe('Maelin, Resonance Artificer');
    expect(keeper.meshType).toBe('CrystalKeeper');
    expect(keeper.isRemote).toBe(true);
    expect(keeper.radius).toBe(1.5);
    expect(engine.isInteractableEntity(keeper)).toBe(false);
    expect(keeper.markerSymbol).toBeUndefined();
    expect(keeper.offlineOwner).toBeUndefined();
    const mesh = await MeshFactory.createMeshForType(keeper.meshType);
    expect(mesh.userData.assetFallback).toBeUndefined();
    expect(mesh.userData.animations.some(clip => clip.name === 'Idle')).toBe(true);
    expect(mesh.userData.animations.some(clip => clip.name === 'Channel')).toBe(true);
    expect(mesh.getObjectByName('Maelin_TuningFork')).toBeDefined();
    expect(mesh.getObjectByName('Maelin_FieldToolkit')).toBeDefined();
    expect(mesh.getObjectByName('Wizard_Stormstaff')).toBeUndefined();
    MeshFactory.releaseMesh(keeper.meshType, mesh);
});

test('a real remote Maelin tick loops the ritual only while the server says CHANNELING', () => {
    const keeper = new CrystalKeeper('maelin-channel');
    keeper.isRemote = true;
    const requested = [];
    keeper.playAnimation = name => { requested.push(name); return true; };
    keeper.updateState('CHANNELING');
    keeper.update(1 / 60, null, null, []);
    expect(requested.at(-1)).toBe('Idle'); // Mesh is not ready yet.
    keeper.animations.Channel = {};
    keeper.update(1 / 60, null, null, []);
    expect(requested.at(-1)).toBe('Channel');
    keeper.updateState('IDLE');
    keeper.update(1 / 60, null, null, []);
    expect(requested.at(-1)).toBe('Idle');
    expect(keeper.state).toBe('IDLE');
});

test('Maelin has actual moving ritual tracks and resets her pose when reused', async () => {
    const mesh = await MeshFactory.createMeshForType('CrystalKeeper');
    const clip = mesh.userData.animations.find(entry => entry.name === 'Channel');
    expect(clip).toBeDefined();
    const arm = mesh.getObjectByName('Rig_UpperArmRight');
    const original = arm.quaternion.clone();
    const mixer = new THREE.AnimationMixer(mesh);
    mixer.clipAction(clip).play();
    mixer.update(0.6);
    expect(arm.quaternion.angleTo(original)).toBeGreaterThan(0.5);
    mixer.stopAllAction();
    MeshFactory.releaseMesh('CrystalKeeper', mesh);
    const reused = await MeshFactory.createMeshForType('CrystalKeeper');
    expect(reused).toBe(mesh);
    expect(arm.quaternion.angleTo(original)).toBeLessThan(0.00001);
    MeshFactory.releaseMesh('CrystalKeeper', reused);
});

test('actual Spirit Guardians retain their summoned angel model', () => {
    const engine = Object.create(GameEngine.prototype);
    const guardian = engine.createRemotePlayer('NPC', 'seraph-owner-1', 'AvengingSeraph');
    expect(guardian).toBeInstanceOf(AvengingSeraph);
    expect(guardian.meshType).toBe('AvengingSeraph');
});
