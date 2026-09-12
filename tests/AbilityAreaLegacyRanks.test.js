import { jest } from '@jest/globals';
import * as THREE from 'three';
import { CONSTANTS } from '../src/core/Constants.js';
import { getAbilityAreaRadius, getAbilityRange } from '../src/core/AbilityRange.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Cleric } from '../src/entities/Cleric.js';
import { Actor } from '../src/entities/Actor.js';
import { Wizard } from '../src/entities/Wizard.js';

const areaTalents = Object.entries(CONSTANTS.PASSIVE_TALENTS).flatMap(([className, talents]) =>
    talents.filter(t => t.abilityArea).map(talent => ({ className, talent })));

describe.each(areaTalents)('$className $talent.id saved area rank', ({ className, talent }) => {
    const [prefix, number] = talent.id.split('_');
    const legacy = `${prefix}_${Number(number)}`;
    test.each([0, 1, 5])('legacy rank %s matches canonical without modifying the save', rank => {
        const ranks = Object.freeze({ [legacy]: rank });
        const source = { talentRanks: ranks };
        expect(getAbilityAreaRadius(source, className, 10, talent.abilityArea.skill)).toBeCloseTo(
            10 * (1 + talent.abilityArea.radius * rank), 8);
        expect(source.talentRanks).toBe(ranks);
    });
    test('duplicate aliases retain the highest bounded rank rather than adding ranks', () => {
        const ranks = Object.freeze({ [talent.id]: 1, [legacy]: 99 });
        expect(getAbilityAreaRadius({ talentRanks: ranks }, className, 10, talent.abilityArea.skill)).toBeCloseTo(
            10 * (1 + talent.abilityArea.radius * talent.maxRank), 8);
    });
    test.each([-5, Infinity, NaN, 'invalid'])('invalid legacy rank %s adds no radius', rank => {
        expect(getAbilityAreaRadius({ talentRanks: { [legacy]: rank } }, className, 10, talent.abilityArea.skill)).toBe(10);
    });
});

test('canonical rank survives an invalid alias and fractional aliases are floored', () => {
    expect(getAbilityAreaRadius({ talentRanks: { FTR_04: 3, FTR_4: Infinity } }, 'Fighter', 6, 'Whirlwind')).toBeCloseTo(6.36, 8);
    expect(getAbilityAreaRadius({ talentRanks: { FTR_4: 1.9 } }, 'Fighter', 6, 'Whirlwind')).toBeCloseTo(6.12, 8);
});

test('legacy named ranks do not leak across skills, classes, or ground placement range', () => {
    const source = { meshType: 'Wizard', talentRanks: { FTR_4: 5, FTR_6: 5, CLR_7: 5, WIZ_36: 5 } };
    expect(getAbilityAreaRadius(source, 'Fighter', 5, 'Sweeping Strike')).toBe(5);
    expect(getAbilityAreaRadius(source, 'Cleric', 10, 'Guardian Embrace')).toBe(10);
    expect(getAbilityAreaRadius(source, 'Wizard', 8)).toBeCloseTo(9.2, 8);
    expect(getAbilityRange(source, 'Gravity Well', 18)).toBe(18);
});

test('actual paid Shield Slam hits the legacy-trained edge and displays that same radius', () => {
    const player = new Fighter('legacy-slam');
    const target = new Actor('legacy-edge', {});
    player.mesh = new THREE.Group(); player.position.set(50000, 40, 50000);
    player.talentRanks = Object.freeze({ FTR_6: 5 });
    player.unlockedSkills.push('Shield Slam'); player.stats.mana = 200;
    target.position.set(50000, 0, 50004.89); target.radius = .5;
    target.stats.hp = target.stats.maxHp = 1000;
    jest.spyOn(target, 'takeDamage');
    const engine = { chunkManager: { getActiveEntities: () => [target] },
        spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() },
        isHostileActorTarget: () => true };
    try {
        player.useAbility(new THREE.Vector3(50000, 0, 50010), engine, 'Shield Slam');
        expect(player.stats.mana).toBe(175);
        expect(target.takeDamage).toHaveBeenCalledTimes(1);
        const cone = engine.spawnTransientEffect.mock.calls.find(call => call[3]?.abilityName === 'Shield Slam');
        expect(cone[3].radius).toBeCloseTo(4.4, 8);
    } finally { player.dispose(); target.dispose(); jest.restoreAllMocks(); }
});

test('actual paid Purifying Wave cleanses a legacy-trained edge but not outside it', () => {
    const player = new Cleric('legacy-wave');
    const edge = new Wizard('wave-edge'), outside = new Wizard('wave-outside');
    player.position.set(50000, 40, 50000); player.unlockedSkills.push('Purifying Wave');
    player.talentRanks = Object.freeze({ CLR_7: 5 }); player.stats.mana = 200;
    for (const [target, offset] of [[edge, -.01], [outside, .01]]) {
        target.radius = .5; target.position.set(50000 + 9.6 + .5 + offset, 0, 50000); target.bleedTimer = 10;
    }
    const engine = { chunkManager: { getActiveEntities: () => [edge, outside] },
        spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() }, isHostileActorTarget: () => false };
    try {
        player.useAbility(player.position.clone(), engine, 'Purifying Wave');
        expect(player.stats.mana).toBe(170);
        expect(edge.bleedTimer).toBe(0); expect(outside.bleedTimer).toBe(10);
        const ring = engine.spawnTransientEffect.mock.calls.find(call => call[0] === 'ring');
        expect(ring[3].radius).toBeCloseTo(9.6, 8);
    } finally { player.dispose(); edge.dispose(); outside.dispose(); }
});
