import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Actor } from '../src/entities/Actor.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { AbilityController } from '../src/core/AbilityController.js';
import { SELF_CENTERED_SHAPE_ABILITIES } from '../src/skills/abilityRadii.js';

const owned = [];
function fixture(rank = 0, generic = 0) {
    const player = new Fighter('shockwave'); owned.push(player); player.mesh = new THREE.Group();
    player.position.set(50000, 40, 50000); player.unlockedSkills.push('Juggernaut Charge');
    Object.assign(player.stats, { damage: 50, strength: 10, mana: 200 });
    player.talentRanks = { FTR_17: rank, FTR_18: rank, FTR_33: generic, FTR_38: generic };
    const entities = [];
    const engine = { currentInstanceId: 'shockwave-room', currentInstanceType: 'dungeon',
        chunkManager: { getActiveEntities: () => entities }, isHostileActorTarget: target => target.hostile,
        spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() } };
    const add = (id, x, z = 0) => {
        const target = new Actor(id, {}); owned.push(target); entities.push(target);
        target.position.set(50000+x, 0, 50000+z); target.radius = .5; target.hostile = true;
        target.stats.hp = target.stats.maxHp = 1000; jest.spyOn(target, 'takeDamage');
        return target;
    };
    return { player, engine, add, cast: () => player.useAbility(new THREE.Vector3(50001, 0, 50000), engine, 'Juggernaut Charge') };
}
afterEach(() => { for (const actor of owned.splice(0)) actor.dispose(); jest.restoreAllMocks(); });

test.each([0,1,5].flatMap(rank => [0,5].map(generic => ({ rank, generic }))))(
    'paid shockwave rank$rank generic$generic matches trained damage, planar area and visible radius', ({ rank, generic }) => {
        const f = fixture(rank, generic), radius = 10*(1+.02*rank+.05*generic);
        const center = f.add('center', 1), edge = f.add('edge', radius+.499), outside = f.add('outside', radius+.501);
        center.position.y = 40; // Positive control at the old handler's elevation.
        f.cast(); expect(f.player.stats.mana).toBe(170);
        const damage = Math.floor(60*(1+.04*rank+.02*generic)+1e-9);
        for (const target of [center, edge]) {
            expect(target.takeDamage).toHaveBeenCalledTimes(1); expect(target.stats.hp).toBe(1000-damage);
            expect(target.slowTimer).toBe(5); expect(target.slowFactor).toBe(.6);
        }
        expect(outside.takeDamage).not.toHaveBeenCalled(); expect(outside.slowTimer).toBe(0);
        const waves = f.engine.spawnTransientEffect.mock.calls.filter(call => call[0] === 'wave');
        expect(waves).toHaveLength(1); expect(waves[0][3].radius).toBeCloseTo(radius, 8);
        expect(waves[0][3].arc).toBeCloseTo(2*Math.PI, 8);
    });

test('trained shockwave excludes friendly, dead, remote, inactive and other-instance targets and deduplicates hits', () => {
    const f = fixture(5,5), target = f.add('valid', 1);
    const excluded = ['friendly', 'dead', 'remote', 'inactive', 'other'].map(id => f.add(id, 1));
    excluded[0].hostile = false; excluded[1].state = 'DEAD'; excluded[2].isRemote = true;
    excluded[3].isActive = false; excluded[4].instanceId = 'different';
    f.engine.chunkManager.getActiveEntities().push(target);
    f.cast(); expect(target.takeDamage).toHaveBeenCalledTimes(1);
    for (const actor of excluded) { expect(actor.takeDamage).not.toHaveBeenCalled(); expect(actor.slowTimer).toBe(0); }
});

test.each([false,true])('trained shockwave retains wall/doorway admission: %s', doorway => {
    const f = fixture(5,5), target = f.add('across-wall', 2);
    f.engine.currentDungeonLayout = { walkRects: [
        { x: 49991, z: 50000, width: 20, height: 20 },
        { x: 50011.5, z: 50000, width: 20, height: 20 },
        ...(doorway ? [{ x: 50001, z: 50000, width: 5, height: 4 }] : [])
    ] };
    f.cast(); expect(target.takeDamage).toHaveBeenCalledTimes(doorway ? 1 : 0);
    expect(target.slowTimer > 0).toBe(doorway);
});

test('trained critical is applied once and CC immunity blocks only the slow', () => {
    const f = fixture(5,5), target = f.add('immune', 1); target.ccImmune = true;
    f.player.stats.critChanceBonus = 1;
    f.cast(); expect(target.stats.hp).toBe(844); expect(target.takeDamage).toHaveBeenCalledTimes(1);
    expect(target.slowTimer).toBe(0);
});

test.each(['mana', 'cooldown', 'online'])('%s never applies predicted shockwave damage or slow', reason => {
    const f = fixture(5,5), target = f.add('excluded', 1);
    if (reason === 'mana') f.player.stats.mana = 0;
    if (reason === 'cooldown') f.player.cooldowns['Juggernaut Charge'] = 100;
    if (reason === 'online') { f.player.isMultiplayer = true; f.engine.isMultiplayer = true; }
    f.cast(); expect(target.takeDamage).not.toHaveBeenCalled(); expect(target.slowTimer).toBe(0);
});

test.each(['high','low'])('%s actual owner and rank-private observer meshes use the full trained self-centered circle', quality => {
    const f = fixture(5,5);
    const engine = { player: f.player, effects: [], uiManager: { getGraphicsQuality: () => quality },
        renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 }, spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
    const remote = { id: 'observer-wave', meshType: 'Fighter', position: new THREE.Vector3(51000, 40, 51000), mesh: new THREE.Group() };
    try {
        Actor.prototype.spawnAbilityPresentation.call(f.player, engine, 'Juggernaut Charge', new THREE.Vector3(50100, 0, 50100));
        new AbilityController(engine).triggerRemoteAbilityVisuals(remote, 'Juggernaut Charge', 50000, 50000, { radius: 13.5, arc: 2*Math.PI });
        const shapes = engine.effects.filter(effect => effect.abilityShape);
        expect(shapes).toHaveLength(2);
        for (const effect of shapes) {
            expect(effect.abilityShape.radius).toBeCloseTo(13.5, 8);
            expect(effect.root.position.x).toBe(50000); expect(effect.root.position.z).toBe(50000);
            expect(effect.root.position.y).toBe(40);
            const boundary = effect.root.children.find(child => child.userData.gameplayBoundary);
            effect.root.updateMatrixWorld(true); const m = boundary.matrixWorld.elements;
            expect(Math.hypot(m[0],m[1],m[2])).toBeCloseTo(13.5, 8);
        }
    } finally { engine.effects.forEach(effect => effect.dispose()); }
});

test.each([...SELF_CENTERED_SHAPE_ABILITIES])('remote %s retains the elevated caster floor at the accepted cast origin', skill => {
    const className = ['Guardian Roar', 'Executioner Spin', 'Whirlwind', 'Juggernaut Charge'].includes(skill)
        ? 'Fighter' : skill === 'Time Warp' ? 'Wizard' : 'Cleric';
    const engine = { spawnTransientEffect: jest.fn() };
    const remote = { id: 'elevated-observer', meshType: className, position: new THREE.Vector3(51000, 40, 51000), mesh: new THREE.Group() };
    new AbilityController(engine).triggerRemoteAbilityVisuals(remote, skill, 50000, 50000, { radius: 13.5, arc: 2*Math.PI });
    const boundaries = engine.spawnTransientEffect.mock.calls.filter(call => Number.isFinite(call[3]?.radius));
    expect(boundaries.length).toBeGreaterThan(0);
    for (const call of boundaries) expect(call[1]).toEqual(new THREE.Vector3(50000, 40, 50000));
});

test('accepted shockwave replaces stale prediction once without replaying animation or moving below the floor', () => {
    const f = fixture();
    const engine = { player: f.player, effects: [], uiManager: { getGraphicsQuality: () => 'high' },
        renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 }, spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
    const animation = jest.spyOn(f.player, 'playAbilityAnimation');
    try {
        f.player.spawnAbilityPresentation(engine, 'Juggernaut Charge', new THREE.Vector3(50100, 0, 50100));
        const old = engine.effects.find(effect => effect.abilityShape);
        const controller = new AbilityController(engine);
        const accepted = { skillName: 'Juggernaut Charge', targetX: 49999, targetZ: 50000, radius: 13.5, arc: 2*Math.PI, shapeResolved: true };
        controller.reconcileLocalAbilityShape(accepted);
        const replacement = engine.effects.filter(effect => effect.abilityShape);
        expect(replacement).toHaveLength(1); expect(replacement[0]).not.toBe(old);
        expect(old.isActive).toBe(false);
        expect(replacement[0].root.position).toEqual(new THREE.Vector3(49999, 40, 50000));
        expect(replacement[0].abilityShape.radius).toBe(13.5);
        controller.reconcileLocalAbilityShape(accepted);
        expect(engine.effects.filter(effect => effect.abilityShape)).toEqual(replacement);
        expect(animation).not.toHaveBeenCalled();
    } finally { engine.effects.forEach(effect => effect.dispose()); }
});
