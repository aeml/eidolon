import * as THREE from 'three';
import { dungeonSpatialSnapshot } from './e2e/dungeon-spatial-snapshot.js';

const actor = (id, x, hostile = true) => ({ id, subType: 'RootboundWarden',
    position: new THREE.Vector3(x, 0, 0), radius: 4, scale: 4, state: 'IDLE',
    isActive: true, health: 9505, hostile });
function fixture() {
    const target = actor('target', 7), near = actor('near', 12), far = actor('far', 60), ally = actor('ally', 5, false);
    return { player: { position: new THREE.Vector3(), state: 'DEAD', radius: 1.25, scale: 1 },
        currentInstanceType: 'verdant_bastion_catacombs',
        currentDungeonLayout: { generationSeed: '-1263584004433865125', generatorVersion: 2,
            rooms: [{ x: 0, z: 0, width: 40, height: 40, type: 'boss' }],
            walkRects: [{ x: 0, z: 0, width: 40, height: 40 }] },
        remotePlayers: new Map([target, near, far, ally].map(a => [a.id, a])),
        activeEntitiesCache: [target], isHostileActorTarget: a => a.hostile,
        getBasicAttackRangeForEntity: () => 20.5 };
}
test('captures actual geometry and nearby hostile/target positions without mutating actors or leaking names', () => {
    const game = fixture(), target = game.remotePlayers.get('target');
    target.name = 'private QA account';
    const before = JSON.stringify(game);
    const snapshot = dungeonSpatialSnapshot({ game, targetId: 'target' });
    expect(snapshot.layout.seed).toBe('-1263584004433865125');
    expect(snapshot.actors).toHaveLength(2);
    expect(snapshot.actors[0]).toMatchObject({ target: true, distance: 7, basicRange: 20.5,
        radius: 4, scale: 4, inActiveCache: true, health: 9505 });
    expect(snapshot.actors[1].inActiveCache).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain('private QA account');
    expect(JSON.stringify(game)).toBe(before);
    snapshot.layout.rooms[0].width = 999;
    snapshot.layout.walkRects[0].width = 999;
    snapshot.actors[0].position.x = 999;
    expect(game.currentDungeonLayout.rooms[0].width).toBe(40);
    expect(game.currentDungeonLayout.walkRects[0].width).toBe(40);
    expect(target.position.x).toBe(7);
});
test('keeps an out-of-range or no-longer-hostile target for disappearance diagnostics', () => {
    const game = fixture();
    game.remotePlayers.get('far').hostile = false;
    const snapshot = dungeonSpatialSnapshot({ game, targetId: 'far' });
    expect(snapshot.actors.find(a => a.target)).toMatchObject({ distance: 60, hostile: false, inActiveCache: false });
});
test('missing layout or vanished target remains explicitly absent instead of synthesizing a scene', () => {
    const game = fixture();
    game.currentDungeonLayout = null;
    const snapshot = dungeonSpatialSnapshot({ game, targetId: 'vanished' });
    expect(snapshot.layout).toBeNull();
    expect(snapshot.actors.some(a => a.target)).toBe(false);
});
