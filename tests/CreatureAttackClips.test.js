import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { configureCreatureAttack } from '../src/art/CreatureAttackClips.js';

const cases = [
    ['InfernalBehemoth', 'OverworldEnemies', 'OverworldEnemy', 'BullSkull', 'gore'],
    ['PhoenixSentinel', 'OverworldEnemies', 'OverworldEnemy', 'Beak', 'peck'],
    ['ThunderRoc', 'OverworldEnemies', 'OverworldEnemy', 'Beak', 'peck'],
    ['StormHarpy', 'OverworldEnemies', 'OverworldEnemy', 'LightningJavelin', 'jab'],
    ['Cindermaw', 'MoltenBosses', 'MoltenBoss', 'LowerMaw', 'bite'],
    ['RocMatriarch', 'TempestBosses', 'TempestBoss', 'SilverBeak', 'peck'],
    ['TiderendLeviathan', 'AbyssalBosses', 'AbyssalBoss', 'TideJaw', 'bite']
];

test.each(cases)('%s uses its actual contact anatomy and remains grounded', async (type, file, factory, part, kind) => {
    const module = await import(`../src/art/Procedural${file}.js`);
    const root = module[`createProcedural${factory}`](type), marker = root.getObjectByName(`${type}_${part}`);
    expect(marker?.isMesh).toBe(true); expect(root.userData.creatureAttackKind).toBe(kind);
    const clip = root.userData.animations.find(clip => clip.name === 'Attack');
    const mixer = new THREE.AnimationMixer(root), action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce); action.clampWhenFinished = true; action.play();
    const positions = [], point = new THREE.Vector3(); let lowest = Infinity, finite = true;
    for (let frame = 0; frame <= 100; frame++) {
        mixer.setTime(frame / 100); root.updateMatrixWorld(true);
        if ([0, 25, 35, 100].includes(frame)) positions.push(new THREE.Box3().setFromObject(marker).getCenter(new THREE.Vector3()));
        root.traverse(node => {
            if (!node.isMesh || !node.visible || node.material.opacity === 0) return;
            const attribute = node.geometry.attributes.position;
            for (let i = 0; i < attribute.count; i++) {
                point.fromBufferAttribute(attribute, i).applyMatrix4(node.matrixWorld);
                lowest = Math.min(lowest, point.y);
                finite &&= Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
            }
        });
    }
    expect(finite).toBe(true); expect(lowest).toBeGreaterThan(-.02);
    expect(positions[2].z - positions[1].z).toBeGreaterThan(.3);
    expect(positions[3].distanceTo(positions[0])).toBeLessThan(.0001);
    expect(root.position.toArray()).toEqual([0, 0, 0]);
    mixer.stopAllAction(); mixer.uncacheRoot(root); root.userData.resetPose();
    const actor = new Actor(`creature-${type}`, {}); actor.setMesh(root); actor.type = type; actor.isRemote = true;
    try {
        for (const interval of [1, 3]) {
            actor.stats.attackSpeed = interval; actor.setAttackingState(); actor.update(interval * .35);
            expect(actor.currentAction.time).toBeCloseTo(.35, 5);
            expect(actor.position.toArray()).toEqual([0, 0, 0]);
            actor.updateState('MOVING'); actor.update(.1); expect(actor.currentAnimationName).toBe('Run');
        }
    } finally { actor.dispose(); }
});

test('unreviewed models are unchanged and required creature joints fail clearly', () => {
    const root = new THREE.Group(), clips = [new THREE.AnimationClip('Attack', 1, [])];
    configureCreatureAttack(root, 'ImportedActor', clips);
    expect(root.userData.basicAttackContactTime).toBeUndefined();
    expect(clips[0].tracks).toEqual([]);
    expect(() => configureCreatureAttack(root, 'ThunderRoc', clips)).toThrow('Missing creature attack joint');
});
