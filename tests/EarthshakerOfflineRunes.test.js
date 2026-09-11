import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Actor } from '../src/entities/Actor.js';

function fixture(rune = '', rank = 5) {
    const p = new Fighter('quake-caster'); p.mesh = new THREE.Group();
    p.position.set(50009, 40, 50000); p.stats.damage = 50; p.stats.strength = 10;
    p.stats.mana = 200; p.unlockedSkills.push('Earthshaker');
    p.talentRanks = { FTR_30: rank, FTR_37: rank };
    p.skillRunes = { Earthshaker: rune };
    const entities = [];
    const engine = { currentInstanceId: 'quake-dungeon', currentInstanceType: 'dungeon',
        chunkManager: { getActiveEntities: () => entities },
        spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() },
        isHostileActorTarget: target => target.hostile };
    const add = (id, x, z = 0, radius = .5) => {
        const target = new Actor(id, {}); target.position.set(p.position.x + x, 0, p.position.z + z);
        target.radius = radius; target.hostile = true; target.stats.hp = target.stats.maxHp = 1000;
        target.takeDamage = jest.fn(amount => { target.stats.hp -= amount; });
        entities.push(target); return target;
    };
    const cast = () => p.useAbility(new THREE.Vector3(p.position.x + 5, 0, p.position.z), engine, 'Earthshaker');
    return { p, engine, entities, add, cast };
}

test.each([0, 1, 5])('circle and Seismic use planar body edges and trained duration, rank %s', rank => {
    for (const rune of ['', 'earthshaker_seismic']) {
        const f = fixture(rune, rank);
        const edge = f.add('edge', 6.49), outside = f.add('outside', 6.51), behind = f.add('behind', -2);
        const ally = f.add('ally', 1), remote = f.add('remote', 1), dead = f.add('dead', 1);
        ally.hostile = false; remote.isRemote = true; dead.state = 'DEAD';
        f.cast();
        for (const target of [edge, behind]) {
            expect(target.takeDamage).toHaveBeenCalledWith(70, f.p);
            expect(target.stunTimer).toBeCloseTo((rune ? 4 : 2) * (1 + .07 * rank), 8);
        }
        for (const target of [outside, ally, remote, dead]) {
            expect(target.takeDamage).not.toHaveBeenCalled(); expect(target.stunTimer).toBe(0);
        }
        expect(f.p.stats.mana).toBe(160);
        expect(f.p.cooldowns.Earthshaker).toBeCloseTo(12 * (1 - f.p.stats.cooldownReduction), 8);
    }
});

test('Fissure hits the forward strip, not a circular quake', () => {
    const f = fixture('earthshaker_fissure');
    const inside = f.add('inside', 6.49, 1.99), wide = f.add('wide', 2, 2.01), behind = f.add('behind', -.01);
    f.cast();
    expect(inside.takeDamage).toHaveBeenCalledWith(70, f.p);
    for (const target of [wide, behind]) expect(target.takeDamage).not.toHaveBeenCalled();
});

test.each([false, true])('quake cannot cross a dungeon wall; doorway %s', doorway => {
    const f = fixture(); const target = f.add('across-wall', 2);
    f.engine.currentDungeonLayout = { walkRects: [
        { x: 50000, z: 50000, width: 20, height: 20 },
        { x: 50020.5, z: 50000, width: 20, height: 20 },
        ...(doorway ? [{ x: 50010, z: 50000, width: 5, height: 6 }] : [])
    ] };
    f.cast();
    expect(target.takeDamage).toHaveBeenCalledTimes(doorway ? 1 : 0);
    expect(target.stunTimer > 0).toBe(doorway);
});

test('remote presentation cannot apply offline damage, stun or scheduled gameplay', () => {
    const f = fixture('earthshaker_aftershock'); const target = f.add('target', 1);
    f.p.isRemote = true;
    f.cast();
    expect(target.takeDamage).not.toHaveBeenCalled();
    expect(target.stunTimer).toBe(0);
    expect(f.p.managedTimers.size).toBe(0);
});

describe('Aftershock scheduled wave', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

    test('delays one second and retains cast origin, damage and training for late targets', () => {
        const f = fixture('earthshaker_aftershock');
        const initial = f.add('initial', 1), late = f.add('late', 10), outside = f.add('outside', 4.01);
        f.cast();
        expect(initial.takeDamage).toHaveBeenCalledTimes(1);
        expect(late.takeDamage).not.toHaveBeenCalled();
        outside.takeDamage.mockClear();
        f.p.talentRanks = {}; f.p.stats.damage = 500; f.p.stats.strength = 100;
        f.p.position.x += 100;
        late.position.x = 50011;
        jest.advanceTimersByTime(999);
        expect(initial.takeDamage).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(1);
        expect(initial.takeDamage).toHaveBeenLastCalledWith(35, f.p);
        expect(initial.takeDamage).toHaveBeenCalledTimes(2);
        expect(initial.stunTimer).toBeCloseTo(2.7, 8); // Stronger existing timer retained.
        expect(late.takeDamage).toHaveBeenCalledWith(35, f.p);
        expect(late.stunTimer).toBeCloseTo(1.35, 8);
        expect(outside.takeDamage).not.toHaveBeenCalled();
        expect(f.p.managedTimers.size).toBe(0);
    });

    test.each(['dead', 'disposed', 'scene-change', 'multiplayer'])('late wave is cancelled after %s', change => {
        const f = fixture('earthshaker_aftershock'); const target = f.add('target', 1);
        f.cast();
        expect(target.takeDamage).toHaveBeenCalledTimes(1);
        expect(f.p.managedTimers.size).toBe(1);
        target.takeDamage.mockClear();
        if (change === 'dead') f.p.state = 'DEAD';
        if (change === 'disposed') f.p.dispose();
        if (change === 'scene-change') f.engine.currentInstanceId = 'town';
        if (change === 'multiplayer') f.engine.isMultiplayer = true;
        jest.advanceTimersByTime(1000);
        expect(target.takeDamage).not.toHaveBeenCalled();
    });
});
