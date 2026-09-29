import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Actor } from '../src/entities/Actor.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { EnemyCorpsePresentation } from '../src/entities/EnemyCorpsePresentation.js';
import { createProceduralSkeleton } from '../src/art/ProceduralLegacyEnemies.js';

function fixture() {
    const actor = new Actor('corpse-review', {}); actor.isRemote = true;
    actor.setMesh(createProceduralSkeleton()); actor.die();
    actor.serverEntityType = 'Enemy';
    const engine = Object.assign(Object.create(GameEngine.prototype), {
        remotePlayers: new Map([[actor.id, actor]]), chunkManager: { updateEntityChunk() {} },
        clearAuthoritativeJumpState() {}, showRemoteStateReadability() {},
        syncRemoteSupportEffects() {}, syncPlayerStatusClears() {}, syncPlayerStatusDetails() {}
    });
    return { actor, engine };
}

test('Skeleton death retains its visible body above the floor throughout the fall', () => {
    const mesh = createProceduralSkeleton(), clip = mesh.userData.animations.find(clip => clip.name === 'Death');
    const mixer = new THREE.AnimationMixer(mesh), action = mixer.clipAction(clip), point = new THREE.Vector3();
    action.setLoop(THREE.LoopOnce); action.clampWhenFinished = true; action.play();
    for (let frame = 0; frame <= 60; frame++) {
        mixer.setTime(clip.duration * frame / 60); mesh.updateMatrixWorld(true);
        let min = Infinity;
        mesh.traverse(node => {
            if (!node.isMesh || node.material.opacity === 0) return;
            const positions = node.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
                min = Math.min(min, point.y);
            }
        });
        expect(min).toBeGreaterThan(-.03);
    }
    mixer.stopAllAction(); mixer.uncacheRoot(mesh);
});

test('death clip finishes before bounded corpse fade; shared materials and logical transforms stay unchanged', () => {
    const { actor, engine } = fixture(), position = actor.position.clone();
    engine.updateRemoteCorpsePresentation(.01);
    const effect = actor.corpsePresentation, duration = actor.animations.Death.getClip().duration;
    expect(effect.hold).toBeGreaterThan(duration);
    effect.update(duration);
    expect(effect.originals.size).toBe(0);
    effect.update(.5);
    expect(effect.materials.size).toBeGreaterThan(0);
    for (const [source, copy] of effect.materials) {
        expect(copy).not.toBe(source);
        expect(copy.opacity).toBeGreaterThan(0);
        expect(copy.opacity).toBeLessThan(source.opacity);
        expect(copy.alphaHash).toBe(true);
        expect(copy.onBeforeCompile).toBe(source.onBeforeCompile);
        expect(copy.customProgramCacheKey).toBe(source.customProgramCacheKey);
    }
    const originals = [...effect.originals], copies = [...effect.materials.values()];
    const disposal = copies.map(material => jest.spyOn(material, 'dispose'));
    effect.update(.5);
    expect(actor.mesh.visible).toBe(false);
    expect(actor.position).toEqual(position);
    expect(actor.isActive).toBe(true);
    for (const [node, source] of originals) expect(node.material).toBe(source);
    for (const dispose of disposal) expect(dispose).toHaveBeenCalledTimes(1);
    effect.update(10); expect(effect.materials.size).toBe(0);
    actor.dispose();
});

test.each(['mid-fade', 'hidden'])('authoritative respawn restores the same actor and starts a fresh death cycle (%s)', phase => {
    const { actor, engine } = fixture();
    engine.updateRemoteCorpsePresentation(.01);
    const effect = actor.corpsePresentation;
    effect.update(effect.hold + (phase === 'hidden' ? 1 : .2));
    engine.syncRemoteEntity(actor, { type: 'Enemy', state: 'IDLE', health: 80, x: 5, z: 8 });
    expect(actor.corpsePresentation).toBeNull();
    expect(effect.materials.size).toBe(0);
    expect(actor.mesh.visible).toBe(true);
    expect(actor.stats.hp).toBe(80);
    expect(actor.state).toBe('IDLE');
    actor.die(); engine.updateRemoteCorpsePresentation(.01);
    expect(actor.corpsePresentation).not.toBe(effect);
    actor.dispose();
});

test.each(['replace', 'dispose'])('mesh lifecycle releases temporary materials (%s)', operation => {
    const { actor, engine } = fixture(); engine.updateRemoteCorpsePresentation(.01);
    const effect = actor.corpsePresentation;
    effect.update(effect.hold + .2);
    const originals = [...effect.originals];
    if (operation === 'replace') actor.setMesh(createProceduralSkeleton());
    else actor.dispose();
    expect(effect.materials.size).toBe(0);
    expect(actor.corpsePresentation).toBeNull();
    for (const [node, source] of originals) expect(node.material).toBe(source);
    if (operation === 'replace') actor.dispose();
});

test('remote player/NPC corpses keep existing timing; material arrays preserve shared identity', () => {
    const { actor, engine } = fixture(); actor.serverEntityType = 'Player';
    engine.updateRemoteCorpsePresentation(2.01);
    expect(actor.mesh.visible).toBe(false);
    expect(actor.corpsePresentation).toBeNull(); actor.dispose();
    const shared = new THREE.MeshStandardMaterial(), mesh = new THREE.Group();
    const node = new THREE.Mesh(new THREE.BoxGeometry(), [shared, shared]); mesh.add(node);
    const source = node.material, effect = new EnemyCorpsePresentation({ mesh });
    effect.update(effect.hold + .2);
    expect(node.material[0]).toBe(node.material[1]);
    expect(shared.opacity).toBe(1); expect(shared.alphaHash).toBe(false);
    effect.dispose(); expect(node.material).toBe(source);
    node.geometry.dispose(); shared.dispose();
});
