import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { CONSTANTS } from '../src/core/Constants.js';
import { getFighterEffectDuration } from '../src/skills/fighterEffectDuration.js';

const cases = ['', 'ironfortress_extended', 'ironfortress_thorns', 'ironfortress_immovable']
    .flatMap(rune => [0, 1, 5].flatMap(rank => [0, 5].map(generic => ({ rune, rank, generic }))));
test.each(cases)('paid Iron Fortress $rune rank$rank/general$generic extends only duration', ({ rune, rank, generic }) => {
    const actor = new Fighter('fortress-mastery');
    try {
        actor.mesh = new THREE.Group(); actor.unlockedSkills.push('Iron Fortress');
        actor.baseStats.intelligence = 30;
        actor.recalculateStats(); // a lawful mana budget survives buff recalculation
        actor.stats.mana = 200; actor.stats.manaRegen = actor.stats.hpRegen = 0;
        actor.talentRanks = { FTR_07: rank, FTR_30: generic, FTR_37: generic };
        actor.skillRunes = { 'Iron Fortress': rune };
        const engine = { spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() } };
        actor.useAbility(actor.position.clone(), engine, 'Iron Fortress');
        const expected = (rune === 'ironfortress_extended' ? 45 : 30) * (1 + .04 * rank + .07 * generic);
        expect(actor.ironFortressTimer).toBeCloseTo(expected, 8);
        expect(actor.ironFortressReduction).toBe(.2);
        expect(actor.stats.mana).toBe(160);
        expect(actor.cooldowns['Iron Fortress']).toBeCloseTo(60 * (1 - actor.stats.cooldownReduction), 8);
        actor.talentRanks = {};
        expect(actor.ironFortressTimer).toBeCloseTo(expected, 8);
        actor.stunTimer = expected + 1;
        actor.update(expected - .01, null, null, null, null);
        expect(actor.ironFortressTimer).toBeGreaterThan(0);
        actor.update(.02, null, null, null, null);
        expect(actor.ironFortressTimer).toBe(0);
    } finally { actor.dispose(); }
});

test('saved Mastery ID and rank cap describe duration, not damage', () => {
    const talent = CONSTANTS.PASSIVE_TALENTS.Fighter.find(value => value.id === 'FTR_07');
    expect(talent.maxRank).toBe(5);
    expect(talent.desc).toContain('+4% Iron Fortress duration per rank (20% max)');
    expect(talent.abilityDuration).toEqual({ skill: 'Iron Fortress', duration: .04 });
    expect(talent.abilityDamage).toBeUndefined();
});

test('named Mastery cannot extend unrelated Fighter effects', () => {
    const actor = new Fighter('fortress-scope');
    try {
        actor.talentRanks = { FTR_07: 5 };
        for (const skill of ['', 'Guardian Roar', 'Berserker Edge', 'Last Stand Rampage', 'Charge']) {
            expect(getFighterEffectDuration(actor, 10, skill)).toBe(10);
        }
    } finally { actor.dispose(); }
});

test.each([[99, 36], [-1, 30], [Infinity, 30], [NaN, 30], [1.9, 31.2]])(
    'Mastery rank %s is bounded without mutating the stored value', (rank, expected) => {
        const source = { talentRanks: { FTR_07: rank } };
        expect(getFighterEffectDuration(source, 30, 'Iron Fortress')).toBeCloseTo(expected, 8);
        expect(source.talentRanks.FTR_07).toBe(rank);
    });

test.each(['actor', 'engine'])('%s multiplayer authority never runs the offline Mastery effect', mode => {
    const actor = new Fighter('fortress-online');
    try {
        actor.mesh = new THREE.Group(); actor.unlockedSkills.push('Iron Fortress');
        actor.stats.mana = 200; actor.talentRanks = { FTR_07: 5 };
        const engine = { spawnTransientEffect: jest.fn(() => true) };
        if (mode === 'actor') actor.isMultiplayer = true;
        else engine.isMultiplayer = true;
        actor.useAbility(actor.position.clone(), engine, 'Iron Fortress');
        expect(actor.ironFortressTimer).toBe(0);
        expect(actor.stats.mana).toBe(160);
    } finally { actor.dispose(); }
});
