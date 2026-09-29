import * as THREE from 'three';
import { groundEnemyDeathClip } from '../src/art/EnemyDeathGrounding.js';

const families = [
    ['LegacyEnemies', 'LegacyEnemy'], ['MoonfrostEnemies', 'MoonfrostEnemy'],
    ['OverworldEnemies', 'OverworldEnemy'], ['ThorncryptBosses', 'ThorncryptBoss'],
    ['MoltenBosses', 'MoltenBoss'], ['TempestBosses', 'TempestBoss'], ['AbyssalBosses', 'AbyssalBoss']
];

test.each(families)('%s bodies remain above the floor throughout actual death animation', async (file, factory) => {
    const module = await import(`../src/art/Procedural${file}.js`);
    const definitions = Object.entries(module).find(([key]) => key.endsWith('_DEFINITIONS'))[1];
    for (const type of Object.keys(definitions)) {
        const root = module[`createProcedural${factory}`](type), clip = root.userData.animations.find(clip => clip.name === 'Death');
        const mixer = new THREE.AnimationMixer(root), action = mixer.clipAction(clip), point = new THREE.Vector3();
        action.setLoop(THREE.LoopOnce); action.clampWhenFinished = true; action.play();
        let lowest = Infinity;
        // Deliberately sample between the authored keys, not only at them.
        for (let frame = 0; frame <= 90; frame++) {
            mixer.setTime(clip.duration * frame / 90); root.updateMatrixWorld(true);
            root.traverse(node => {
                if (!node.isMesh || !node.visible || node.material.opacity === 0) return;
                const positions = node.geometry.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
                    lowest = Math.min(lowest, point.y);
                }
            });
        }
        expect({ type, clipped: lowest < -.03 }).toEqual({ type, clipped: false });
        mixer.stopAllAction(); mixer.uncacheRoot(root); root.userData.resetPose();
        expect(root.userData.combatRadius).toBe(definitions[type].combatRadius);
    }
});

test('height correction changes only the named death track, not attack timing or imported actors', () => {
    const body = new THREE.NumberKeyframeTrack('Rig_ImpBody.position[y]', [0, 1], [0, -1]);
    const rotation = new THREE.NumberKeyframeTrack('Rig_ImpBody.rotation[x]', [0, 1], [0, 1]);
    const attack = new THREE.AnimationClip('Attack', .5, [body.clone()]);
    const death = new THREE.AnimationClip('Death', 1.2, [body, rotation]);
    const previousAttack = attack.toJSON(), previousRotation = rotation.values.slice();
    groundEnemyDeathClip('Imp', [attack, death]);
    expect(death.duration).toBe(1.2);
    expect(death.tracks[0].times).toHaveLength(33);
    expect(attack.toJSON()).toEqual(previousAttack);
    expect(rotation.values).toEqual(previousRotation);
    expect(() => groundEnemyDeathClip('ImportedActor', [])).not.toThrow();
    expect(() => groundEnemyDeathClip('Imp', [])).toThrow('Missing reviewed death body track');
});
