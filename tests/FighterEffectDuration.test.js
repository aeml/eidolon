import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Actor } from '../src/entities/Actor.js';
import { Cleric } from '../src/entities/Cleric.js';
import { CONSTANTS } from '../src/core/Constants.js';

const cases = [
    ['Iron Fortress', '', 'ironFortressTimer', 30, 'caster'],
    ['Iron Fortress', 'ironfortress_extended', 'ironFortressTimer', 45, 'caster'],
    ['Guardian Roar', '', 'guardianRoarTimer', 10, 'caster'],
    ['Berserker Edge', '', 'berserkerEdgeTimer', 15, 'caster'],
    ['Last Stand Rampage', '', 'lastStandTimer', 10, 'caster'],
    ['Earthshaker', '', 'stunTimer', 2, 'target'],
    ['Earthshaker', 'earthshaker_seismic', 'stunTimer', 4, 'target'],
    ['Unbreakable Grip', '', 'rootTimer', 1, 'target'],
    ['Juggernaut Charge', '', 'slowTimer', 5, 'target']
];

function fixture(skill, rune, ranks) {
    const caster = new Fighter('duration-caster');
    caster.mesh = new THREE.Group(); caster.unlockedSkills.push(skill);
    caster.stats.mana = 200; caster.stats.maxMana = 200;
    caster.stats.hp = caster.stats.maxHp * .2;
    caster.talentRanks = ranks; caster.skillRunes = { [skill]: rune };
    const target = new Actor('duration-target', {});
    target.position.set(0, 0, 2); target.takeDamage = jest.fn();
    const ally = new Cleric('duration-ally');
    ally.position.set(0, 0, 3); ally.talentRanks = { FTR_30: 5, FTR_37: 5 };
    const engine = { chunkManager: { getActiveEntities: () => [target, ally] },
        spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() } };
    return { caster, target, ally, engine };
}

describe.each(cases)('%s %s', (skill, rune, timer, base, recipient) => {
    test.each([0, 1, 5])('ordinary offline cast resolves duration ranks %s once', rank => {
        const f = fixture(skill, rune, { FTR_30: rank, FTR_37: rank });
        const config = CONSTANTS.ABILITY_CONFIG.Fighter.skills[skill];
        f.caster.useAbility(f.target.position.clone(), f.engine, skill);
        expect(f.caster.stats.mana).toBe(200 - config.mana);
        expect(f.caster.cooldowns[skill]).toBeCloseTo(config.cooldown * (1 - f.caster.stats.cooldownReduction), 8);
        expect(f[recipient][timer]).toBeCloseTo(base * (1 + .07 * rank), 8);
        if (skill === 'Guardian Roar') expect(f.ally[timer]).toBe(f.caster[timer]);
        if (skill === 'Unbreakable Grip') expect(f.target.stunTimer).toBe(0);
        const resolved = f[recipient][timer];
        f.caster.talentRanks = {};
        expect(f[recipient][timer]).toBe(resolved);
    });

    test('multiplayer prediction does not apply an offline effect timer', () => {
        const f = fixture(skill, rune, { FTR_30: 5, FTR_37: 5 });
        f.engine.isMultiplayer = true;
        const before = f[recipient][timer];
        expect(f.caster.useAbility(f.target.position.clone(), f.engine, skill)).toBe(true);
        expect(f[recipient][timer]).toBe(before);
        expect(f.target.takeDamage).not.toHaveBeenCalled();
    });
});

test.each(['Earthshaker', 'Juggernaut Charge', 'Unbreakable Grip'])('%s respects crowd-control immunity', skill => {
    const f = fixture(skill, '', { FTR_30: 5, FTR_37: 5 });
    f.target.ccImmune = true;
    f.target.position.set(0, 0, 5);
    f.caster.useAbility(f.target.position.clone(), f.engine, skill);
    expect(f.target.stunTimer).toBe(0);
    expect(f.target.rootTimer).toBe(0);
    expect(f.target.slowTimer).toBe(0);
    expect(f.target.position.z).toBe(5);
    if (skill !== 'Unbreakable Grip') expect(f.target.takeDamage).toHaveBeenCalledTimes(1);
});

test('a trained Earthshaker does not shorten an existing stronger stun', () => {
    const f = fixture('Earthshaker', 'earthshaker_seismic', { FTR_30: 5, FTR_37: 5 });
    f.target.stunTimer = 10;
    f.caster.useAbility(f.target.position.clone(), f.engine, 'Earthshaker');
    expect(f.target.stunTimer).toBe(10);
    expect(f.target.takeDamage).toHaveBeenCalledTimes(1);
});

test.each([1, 5])('Grip pulls along the target line without pushing a close enemy away (distance %s)', distance => {
    const f = fixture('Unbreakable Grip', '', { FTR_30: 5, FTR_37: 5 });
    f.target.position.set(distance, 0, 0);
    f.caster.useAbility(f.target.position.clone(), f.engine, 'Unbreakable Grip');
    expect(f.target.position.x).toBe(Math.min(2, distance));
    expect(f.target.position.z).toBe(0);
    expect(f.target.rootTimer).toBeCloseTo(1.35, 8);
    expect(f.target.stunTimer).toBe(0);
});

test('duration talent descriptions match the existing percentage bonuses, not flat seconds or penetration', () => {
    const talents = CONSTANTS.PASSIVE_TALENTS.Fighter;
    for (const [id, percent, max] of [['FTR_30', 4, 20], ['FTR_37', 3, 15]]) {
        const talent = talents.find(entry => entry.id === id);
        expect(talent.maxRank).toBe(5);
        expect(talent.desc).toContain(`+${percent}% ability buff, stun, root and slow duration per rank (${max}% max)`);
        expect(talent.desc).not.toMatch(/penetration|0\.2s/);
    }
});
