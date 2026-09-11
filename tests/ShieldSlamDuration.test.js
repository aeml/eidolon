import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Actor } from '../src/entities/Actor.js';
import { getShieldSlamStunDuration } from '../src/skills/shieldSlamDuration.js';

describe.each(['', 'shieldslam_concussion', 'shieldslam_reverberation', 'shieldslam_fortify'])('rune %s', rune => {
    test.each([0, 1, 2, 3, 4, 5])('paid offline casts compose duration ranks %s after rune', rank => {
        for (const [ranks, bonus] of [[{ FTR_30: rank }, .04 * rank], [{ FTR_37: rank }, .03 * rank],
            [{ FTR_30: rank, FTR_37: rank }, .07 * rank], [{ FTR_5: rank, WIZ_34: 5 }, 0]]) {
            const p = new Fighter('stun-caster');
            p.mesh = new THREE.Group(); p.unlockedSkills.push('Shield Slam');
            p.stats.mana = 200; p.stats.maxMana = 200; p.talentRanks = ranks;
            p.skillRunes = { 'Shield Slam': rune };
            const target = new Actor('stun-enemy', {});
            target.position.set(0, 0, 2); target.takeDamage = jest.fn();
            const engine = { chunkManager: { getActiveEntities: () => [target] },
                spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() } };
            p.useAbility(target.position.clone(), engine, 'Shield Slam');
            expect(p.stats.mana).toBe(175);
            expect(p.cooldowns['Shield Slam']).toBeCloseTo(6 * (1 - p.stats.cooldownReduction), 8);
            expect(target.takeDamage).toHaveBeenCalledTimes(1);
            expect(target.stunTimer).toBeCloseTo((rune === 'shieldslam_concussion' ? 2.5 : 1.5) * (1 + bonus), 8);
            const timer = target.stunTimer;
            p.talentRanks = {};
            expect(target.stunTimer).toBe(timer);
        }
    });
});

test('duration helper ignores malformed or negative ranks and clamps to existing max rank', () => {
    expect(getShieldSlamStunDuration({ talentRanks: { FTR_30: Infinity, FTR_37: -1 } })).toBe(1.5);
    expect(getShieldSlamStunDuration({ talentRanks: { FTR_30: 99, FTR_37: 5.9 } })).toBeCloseTo(2.025, 8);
});
