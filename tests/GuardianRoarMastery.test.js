import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { CONSTANTS } from '../src/core/Constants.js';
import { getFighterEffectDuration } from '../src/skills/fighterEffectDuration.js';

test.each([0, 1, 5].flatMap(rank => [0, 5].map(generic => ({ rank, generic }))))(
    'paid Roar rank$rank/general$generic shares only caster duration', ({ rank, generic }) => {
        const caster = new Fighter('roar-mastery-caster');
        const ally = new Fighter('roar-mastery-ally');
        const far = new Fighter('roar-mastery-far');
        try {
            caster.mesh = new THREE.Group(); caster.unlockedSkills.push('Guardian Roar');
            caster.stats.mana = 200; caster.stats.manaRegen = caster.stats.hpRegen = 0;
            caster.talentRanks = { FTR_09: rank, FTR_30: generic, FTR_37: generic };
            ally.talentRanks = { FTR_09: 5, FTR_30: 5, FTR_37: 5 };
            ally.position.set(0, 0, 3); far.position.set(100, 0, 0);
            const engine = { chunkManager: { getActiveEntities: () => [ally, far] },
                spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() } };
            caster.useAbility(caster.position.clone(), engine, 'Guardian Roar');
            const duration = 10 * (1 + .04 * rank + .07 * generic);
            expect(caster.guardianRoarTimer).toBeCloseTo(duration, 8);
            expect(ally.guardianRoarTimer).toBe(caster.guardianRoarTimer);
            expect(far.guardianRoarTimer).toBe(0);
            expect(caster.guardianRoarReduction).toBe(.3);
            expect(ally.guardianRoarReduction).toBe(.3);
            expect(caster.stats.mana).toBe(165);
            expect(caster.cooldowns['Guardian Roar']).toBeCloseTo(30 * (1 - caster.stats.cooldownReduction), 8);
            caster.talentRanks = {};
            for (const actor of [caster, ally]) {
                actor.stunTimer = duration + 1;
                actor.update(duration - .01, null, null, null, null);
                expect(actor.guardianRoarTimer).toBeGreaterThan(0);
                actor.update(.02, null, null, null, null);
                expect(actor.guardianRoarTimer).toBe(0);
            }
        } finally { caster.dispose(); ally.dispose(); far.dispose(); }
    });

test('Roar Mastery preserves saved identity and describes its actual utility', () => {
    const talent = CONSTANTS.PASSIVE_TALENTS.Fighter.find(t => t.id === 'FTR_09');
    expect(talent.maxRank).toBe(5);
    expect(talent.desc).toContain('+4% Guardian Roar buff duration per rank (20% max)');
    expect(talent.abilityDuration).toEqual({ skill: 'Guardian Roar', duration: .04 });
    expect(talent.abilityDamage).toBeUndefined();
    for (const skill of ['', 'Iron Fortress', 'Berserker Edge', 'Last Stand Rampage', 'Charge']) {
        expect(getFighterEffectDuration({ talentRanks: { FTR_09: 5 } }, 10, skill)).toBe(10);
    }
});

test.each(['actor', 'engine'])('%s online authority does not apply offline Roar training', mode => {
    const caster = new Fighter('roar-online');
    try {
        caster.unlockedSkills.push('Guardian Roar'); caster.stats.mana = 200;
        caster.talentRanks = { FTR_09: 5 };
        const engine = { spawnTransientEffect: jest.fn(() => true) };
        if (mode === 'actor') caster.isMultiplayer = true;
        else engine.isMultiplayer = true;
        caster.useAbility(caster.position.clone(), engine, 'Guardian Roar');
        expect(caster.guardianRoarTimer).toBe(0);
        expect(caster.stats.mana).toBe(165);
    } finally { caster.dispose(); }
});
