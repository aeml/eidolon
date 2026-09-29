import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { configureEnemyStrikeContact } from '../src/art/EnemyStrikeContact.js';

const families = [
    ['MoonfrostEnemies', 'MoonfrostEnemy', .7, ['MountainTroll', 'AquaGolem', 'Siren', 'FrostGuardian']],
    ['OverworldEnemies', 'OverworldEnemy', .72, ['SandstormDjinn', 'MagmaGolem', 'ScorchedWraith', 'CloudElemental', 'TempestGiant', 'CycloneAvatar']],
    ['ThorncryptBosses', 'ThorncryptBoss', .78, ['RootboundWarden', 'BriarMatron', 'RustboundColossus', 'HollowSentinel']],
    ['MoltenBosses', 'MoltenBoss', .78, ['ScorchedTwins', 'ForgemasterPyrax', 'ObsidianGuardian', 'LordInfernax']],
    ['TempestBosses', 'TempestBoss', .76, ['Windshear', 'Stormcallers', 'ThunderlordKaelix', 'Zephyrion']],
    ['AbyssalBosses', 'AbyssalBoss', .76, ['DrownedChoir', 'AbyssalGoliath', 'MaelstromWarden', 'Thalorath']]
];
for (const [file, factory, contact, types] of families) {
    test.each(types)('%s has a forward timed strike, independent of facing/cadence', async type => {
        const module = await import(`../src/art/Procedural${file}.js`);
        const actor = new Actor(`strike-${type}`, {}); actor.type = type; actor.isRemote = true;
        actor.setMesh(module[`createProcedural${factory}`](type));
        const weapon = actor.mesh.getObjectByName(`Rig_${type}Weapon`);
        try {
            for (const interval of [1, 3]) {
                actor.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), interval === 1 ? 0 : Math.PI / 2);
                const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(actor.rotation);
                const reach = () => {
                    actor.mesh.updateMatrixWorld(true);
                    return new THREE.Box3().setFromObject(weapon).getCenter(new THREE.Vector3()).sub(actor.position).dot(forward);
                };
                actor.stats.attackSpeed = interval; actor.setAttackingState();
                const action = actor.currentAction;
                expect(contact / action.getEffectiveTimeScale()).toBeCloseTo(interval * .35, 5);
                actor.update(interval * .18); expect(reach()).toBeLessThan(-.3);
                actor.update(interval * .17);
                expect(action.time).toBeCloseTo(contact, 5); expect(reach()).toBeGreaterThan(.3);
                expect(actor.position.toArray()).toEqual([0, 0, 0]);
                actor.update(interval * .6);
                expect(actor.currentAction).toBe(action); expect(action.time).toBeCloseTo(action.getClip().duration);
                actor.updateState('MOVING'); actor.update(1 / 60); expect(actor.currentAnimationName).toBe('Run');
            }
        } finally { actor.dispose(); }
    });
}

test.each(['InfernalBehemoth', 'PhoenixSentinel', 'ThunderRoc', 'StormHarpy', 'Cindermaw', 'RocMatriarch', 'TiderendLeviathan', 'ImportedActor'])(
    '%s is not given an invented weapon contact', type => {
        const root = new THREE.Group(); configureEnemyStrikeContact(root, type, []);
        expect(root.userData.basicAttackContactTime).toBeUndefined();
    });
test('only the reviewed attack arm changes; malformed reviewed clips fail clearly', () => {
    const arm = new THREE.NumberKeyframeTrack('Rig_RootboundWardenArmRight.rotation[x]', [0, .78, 1.15], [0, 1, 0]);
    const body = new THREE.NumberKeyframeTrack('Rig_RootboundWardenBody.position[y]', [0, 1.15], [2, 2]);
    const attack = new THREE.AnimationClip('Attack', 1.15, [arm, body]);
    const death = new THREE.AnimationClip('Death', 2, [arm.clone()]);
    const originalBody = THREE.KeyframeTrack.toJSON(body), originalDeath = death.toJSON();
    const root = new THREE.Group(); configureEnemyStrikeContact(root, 'RootboundWarden', [attack, death]);
    expect([...arm.values]).toEqual([-0, -1, -0]);
    expect(THREE.KeyframeTrack.toJSON(body)).toEqual(originalBody); expect(death.toJSON()).toEqual(originalDeath);
    expect(attack.duration).toBe(1.15);
    expect(() => configureEnemyStrikeContact(root, 'RootboundWarden', [])).toThrow('Missing reviewed strike contact');
});
