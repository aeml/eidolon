import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Actor } from '../src/entities/Actor.js';
import fs from 'node:fs';

function fixture(rune = '', rank = 5) {
    const p = new Fighter('slam-caster'); p.mesh = new THREE.Group();
    p.position.set(50009, 40, 50000);
    Object.assign(p.stats, { damage: 50, strength: 10, mana: 200, hp: 1000, maxHp: 1000, hpRegen: 0, manaRegen: 0 });
    p.unlockedSkills.push('Shield Slam'); p.skillRunes = { 'Shield Slam': rune };
    p.talentRanks = { FTR_30: rank, FTR_37: rank };
    const entities = [];
    const engine = { currentInstanceId: 'slam-dungeon', currentInstanceType: 'dungeon',
        chunkManager: { getActiveEntities: () => entities },
        spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() },
        isHostileActorTarget: target => target.hostile };
    const add = (id, x, z = 0) => {
        const target = new Actor(id, {}); target.position.set(p.position.x + x, 0, p.position.z + z);
        target.radius = .5; target.hostile = true; target.stats.hp = target.stats.maxHp = 1000;
        jest.spyOn(target, 'takeDamage'); entities.push(target); return target;
    };
    const cast = () => p.useAbility(new THREE.Vector3(p.position.x + 5, 0, p.position.z), engine, 'Shield Slam');
    return { p, engine, entities, add, cast };
}

test.each(['', 'shieldslam_concussion', 'shieldslam_reverberation', 'shieldslam_fortify'])('%s applies paid planar rune damage and trained control', rune => {
    const f = fixture(rune); const target = f.add('edge', 4.49);
    f.cast();
    const damage = rune === 'shieldslam_reverberation' ? 130 : 65;
    expect(target.stats.hp).toBe(1000 - damage);
    expect(target.stunTimer).toBeCloseTo((rune === 'shieldslam_concussion' ? 2.5 : 1.5) * 1.35, 8);
    expect(f.p.stats.mana).toBe(175);
    expect(f.p.cooldowns['Shield Slam']).toBeCloseTo(6 * (1 - f.p.stats.cooldownReduction), 8);
    expect(f.p.shieldHP).toBe(rune === 'shieldslam_fortify' ? 65 : 0);
});

test('cone follows aim and excludes allies, distant, behind, dead and remote actors', () => {
    const f = fixture('shieldslam_fortify'); const inside = f.add('inside', 2, 1);
    const outside = f.add('outside', 4.51), behind = f.add('behind', -1), wide = f.add('wide', 1, 2);
    const ally = f.add('ally', 1), dead = f.add('dead', 1), remote = f.add('remote', 1);
    ally.hostile = false; dead.state = 'DEAD'; remote.isRemote = true;
    f.cast();
    expect(inside.takeDamage).toHaveBeenCalledTimes(1);
    for (const target of [outside, behind, wide, ally, dead, remote]) {
        expect(target.takeDamage).not.toHaveBeenCalled(); expect(target.stunTimer).toBe(0);
    }
    expect(f.p.shieldHP).toBe(65);
});

test.each([false, true])('wall/doorway %s constrains damage and Fortify capacity', doorway => {
    const f = fixture('shieldslam_fortify'); const target = f.add('across-wall', 2);
    f.engine.currentDungeonLayout = { walkRects: [
        { x: 50000, z: 50000, width: 20, height: 20 }, { x: 50020.5, z: 50000, width: 20, height: 20 },
        ...(doorway ? [{ x: 50010, z: 50000, width: 5, height: 6 }] : [])
    ] };
    f.cast();
    expect(target.takeDamage).toHaveBeenCalledTimes(doorway ? 1 : 0);
    expect(f.p.shieldHP).toBe(doorway ? 65 : 0);
    expect(f.p.arcaneShieldTimer).toBeCloseTo(doorway ? 13.5 : 0, 8);
});

test.each([0, 1, 5])('Fortify rank %s stacks once per hit and absorbs real incoming damage', rank => {
    const f = fixture('shieldslam_fortify', rank); f.add('one', 1); f.add('two', 2);
    f.p.shieldHP = 10;
    f.cast();
    expect(f.p.shieldHP).toBe(140);
    expect(f.p.arcaneShieldTimer).toBeCloseTo(10 * (1 + .07 * rank), 8);
    f.p.talentRanks = {};
    f.p.takeDamage(150);
    expect(f.p.stats.hp).toBe(990); expect(f.p.shieldHP).toBe(0);
    expect(f.p.arcaneShieldActive).toBe(false); expect(f.p.arcaneShieldTimer).toBe(0);
});

test('Fortify unused shield expires through the actor update loop', () => {
    const f = fixture('shieldslam_fortify'); f.add('target', 1); f.cast();
    expect(f.p.shieldHP).toBe(65);
    f.p.update(13.51, null, f.p, []);
    expect(f.p.shieldHP).toBe(0); expect(f.p.arcaneShieldActive).toBe(false);
    f.p.takeDamage(100); expect(f.p.stats.hp).toBe(900);
});

test('immune targets take damage but are not stunned', () => {
    const f = fixture(); const target = f.add('immune', 1); target.ccImmune = true;
    f.cast(); expect(target.stats.hp).toBe(935); expect(target.stunTimer).toBe(0);
});

test('Fortify includes the actual critical hit once even with duplicate entity entries', () => {
    const f = fixture('shieldslam_fortify'); const target = f.add('target', 1);
    f.entities.push(target); f.p.stats.critChanceBonus = 1;
    f.cast();
    expect(target.takeDamage).toHaveBeenCalledTimes(1);
    expect(target.stats.hp).toBe(870); expect(f.p.shieldHP).toBe(130);
});

test('a missed Fortify cast does not create or refresh a shield', () => {
    const f = fixture('shieldslam_fortify'); f.add('outside', 10);
    f.p.shieldHP = 10; f.p.arcaneShieldActive = true; f.p.arcaneShieldTimer = 3;
    f.cast();
    expect(f.p.shieldHP).toBe(10); expect(f.p.arcaneShieldTimer).toBe(3);
});

test.each(['remote', 'multiplayer', 'engine'])('%s cast presentation never applies offline Fortify or control', authority => {
    const f = fixture('shieldslam_fortify'); const target = f.add('target', 1);
    if (authority === 'remote') f.p.isRemote = true;
    if (authority === 'multiplayer') f.p.isMultiplayer = true;
    if (authority === 'engine') f.engine.isMultiplayer = true;
    f.cast();
    expect(target.takeDamage).not.toHaveBeenCalled(); expect(target.stunTimer).toBe(0);
    expect(f.p.shieldHP).toBe(0); expect(f.p.arcaneShieldTimer).toBe(0);
});

test('Shield Slam preserves a stronger existing offline stun', () => {
    const f = fixture(); const target = f.add('target', 1); target.stunTimer = 5.4;
    f.cast(); expect(target.stunTimer).toBe(5.4); expect(target.stats.hp).toBe(935);
});

const trainingCases = JSON.parse(fs.readFileSync('server/internal/game/testdata/shield_slam_damage.json', 'utf8'));
describe.each(trainingCases)('paid damage training: $name', entry => {
    test.each(['', 'shieldslam_concussion', 'shieldslam_reverberation', 'shieldslam_fortify'])('%s preserves rune, payment, threat-independent damage', rune => {
        const f = fixture(rune, 0), target = f.add('trained-target', 2);
        try {
            f.p.talentRanks = entry.ranks;
            f.cast();
            const damage = entry.damage * (rune === 'shieldslam_reverberation' ? 2 : 1);
            expect(target.stats.hp).toBe(1000 - damage);
            expect(f.p.stats.mana).toBe(175);
            expect(f.p.shieldHP).toBe(rune === 'shieldslam_fortify' ? damage : 0);
            expect(f.p.talentRanks).toEqual(entry.ranks);
        } finally { f.p.dispose(); target.dispose(); }
    });
});

test('trained critical Fortify applies training, critical and absorption once each', () => {
    const f = fixture('shieldslam_fortify', 0), target = f.add('trained-critical', 2);
    try {
        f.p.talentRanks = { FTR_05: 5 }; f.p.stats.critChanceBonus = 1;
        f.cast();
        expect(target.stats.hp).toBe(844);
        expect(f.p.shieldHP).toBe(156);
    } finally { f.p.dispose(); target.dispose(); }
});
