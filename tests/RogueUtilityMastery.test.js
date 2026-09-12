import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';
import { CONSTANTS } from '../src/core/Constants.js';
import { getRogueEffectDuration } from '../src/skills/rogueEffectDuration.js';

const cases = [
    ['Weak Point Mark', 'ROG_05', '', 'target', 'weakPointMarkTimer', 10, 25],
    ['Smoke Bomb', 'ROG_19', '', 'target', 'slowTimer', 5, 35],
    ['Smoke Bomb', 'ROG_19', '', 'target', 'accuracyReductionTimer', 5, 35],
    ['Cloak & Vanish', 'ROG_25', '', 'source', 'stealthTimer', 5, 30],
    ['Cloak & Vanish', 'ROG_25', 'cloak_longer', 'source', 'stealthTimer', 10, 30],
    ['Cloak & Vanish', 'ROG_25', 'cloak_swift', 'source', 'speedBoostTimer', 3, 30]
];
afterEach(() => jest.restoreAllMocks());

test.each(cases)('paid %s/%s/%s extends its real %s.%s without changing its cost', (skill, id, rune, recipient, field, base, cost) => {
    jest.spyOn(Math, 'random').mockReturnValue(.99);
    for (const rank of [0, 1, 5]) for (const generic of [0, 5]) {
        const source = new Rogue('utility-owner'), target = new Imp('utility-target');
        try {
            source.mesh = new THREE.Group(); target.mesh = new THREE.Group();
            source.stats.mana = 1000; source.unlockedSkills.push(skill);
            source.talentRanks = { [id]: rank, ROG_28: generic };
            source.skillRunes = { [skill]: rune };
            target.position.set(0, 0, 2); target.stats.hp = target.stats.maxHp = 10000;
            const engine = { isMultiplayer: false, scene: new THREE.Scene(),
                chunkManager: { getActiveEntities: () => [target] },
                floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true),
                isHostileActorTarget: entity => entity === target };
            source.useAbility(target.position.clone(), engine, skill);
            expect(source.stats.mana).toBe(1000 - cost);
            expect(target.stats.hp).toBe(10000);
            const actor = recipient === 'source' ? source : target;
            const expected = base * (1 + .04 * rank + .04 * generic);
            expect(actor[field]).toBeCloseTo(expected, 8);
            source.talentRanks = {};
            expect(actor[field]).toBeCloseTo(expected, 8);
        } finally { source.dispose(); target.dispose(); }
    }
});
test.each([['Weak Point Mark', 'ROG_05'], ['Smoke Bomb', 'ROG_19'], ['Cloak & Vanish', 'ROG_25']])(
    '%s copy and metadata describe an existing duration effect, not nonexistent damage', (skill, id) => {
        const talent = CONSTANTS.PASSIVE_TALENTS.Rogue.find(t => t.id === id);
        expect(talent.maxRank).toBe(5);
        expect(talent.desc).toMatch(/4%.*duration.*20%/);
        expect(talent.desc).not.toMatch(/damage/i);
        expect(talent.abilityDuration).toEqual({ skill, duration: .04 });
        expect(talent.abilityDamage).toBeUndefined();
    });
test('named ranks stay scoped, clamped and additive across saved aliases', () => {
    const source = { meshType: 'Rogue', talentRanks: { ROG_05: 2, ROG_5: 99, ROG_19: 5, ROG_25: 5, ROG_28: 5 } };
    expect(getRogueEffectDuration(source, 10, 'Weak Point Mark')).toBeCloseTo(14);
    expect(source.talentRanks.ROG_05).toBe(2);
    expect(getRogueEffectDuration(source, 10, 'Shadow Lunge')).toBe(12);
    expect(getRogueEffectDuration({ ...source, talentRanks: { ROG_05: NaN, ROG_28: -1 } }, 10, 'Weak Point Mark')).toBe(10);
    expect(getRogueEffectDuration({ ...source, talentRanks: { ROG_05: 1.9 } }, 10, 'Weak Point Mark')).toBe(10.4);
});
test.each([{ isRemote: true }, { isMultiplayer: true }, { gameEngine: { isMultiplayer: true } }, { meshType: 'Wizard' }])(
    'replicated or other-class effects never receive local Mastery scaling: %j', flags => {
        expect(getRogueEffectDuration({ meshType: 'Rogue', talentRanks: { ROG_05: 5, ROG_28: 5 }, ...flags },
            10, 'Weak Point Mark')).toBe(10);
    });
