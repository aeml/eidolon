import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';
import { CONSTANTS } from '../src/core/Constants.js';
import { getRogueEffectDuration } from '../src/skills/rogueEffectDuration.js';

afterEach(() => jest.restoreAllMocks());

test.each([
    ['Weak Point Mark', '', 'target', 'weakPointMarkTimer', 10],
    ['Shadow Lunge', '', 'target', 'bleedTimer', 10],
    ['Shadow Lunge', 'shadowlunge_cripple', 'target', 'slowTimer', 3],
    ['Serrated Edges', '', 'source', 'serratedEdgesTimer', 10],
    ['Poison Coating', '', 'source', 'poisonCoatingTimer', 15],
    ['Cloak & Vanish', '', 'source', 'stealthTimer', 5],
    ['Cloak & Vanish', 'cloak_longer', 'source', 'stealthTimer', 10],
    ['Cloak & Vanish', 'cloak_swift', 'source', 'speedBoostTimer', 3],
    ['Smoke Bomb', '', 'target', 'slowTimer', 5],
    ['Smoke Bomb', '', 'target', 'accuracyReductionTimer', 5],
    ['Tripwire', '', 'target', 'rootTimer', 3]
])('paid offline %s/%s applies Dirty Tricks to %s.%s', (skill, rune, recipient, field, base) => {
    jest.spyOn(Math, 'random').mockReturnValue(.99);
    for (const build of [{ rank: 0 }, { rank: 1 }, { rank: 5 }, { rank: 5, unrelated: true }]) {
        const source = new Rogue('duration-source'), target = new Imp('duration-target');
        try {
            source.mesh = new THREE.Group(); target.mesh = new THREE.Group();
            source.stats.mana = 1000; source.stats.critChanceBonus = 0;
            source.unlockedSkills.push(skill);
            source.skillRunes = { [skill]: rune };
            source.talentRanks = { [build.unrelated ? 'ROG_30' : 'ROG_28']: build.rank };
            target.position.set(0, 0, skill === 'Tripwire' ? .5 : 2);
            target.stats.hp = target.stats.maxHp = 10000;
            const engine = { isMultiplayer: false, scene: new THREE.Scene(),
                chunkManager: { getActiveEntities: () => [target] },
                floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true),
                isHostileActorTarget: entity => entity === target };
            source.useAbility(target.position.clone(), engine, skill);
            expect(source.stats.mana).toBeLessThan(1000);
            if (skill === 'Tripwire') source.update(.01, null, null, engine.chunkManager, engine.floatingTextManager, engine);
            const actor = recipient === 'source' ? source : target;
            const expected = base*(1+(build.unrelated ? 0 : .04*build.rank));
            expect(actor[field]).toBeCloseTo(expected, 8);
            source.talentRanks = {};
            expect(actor[field]).toBeCloseTo(expected, 8);
        } finally { source.dispose(); target.dispose(); }
    }
});

test('Dirty Tricks copy describes its existing duration investment, not damage', () => {
    const talent = CONSTANTS.PASSIVE_TALENTS.Rogue.find(entry => entry.id === 'ROG_28');
    expect(talent.maxRank).toBe(5);
    expect(talent.desc).toMatch(/4%.*duration.*20%/i);
    expect(talent.desc).not.toMatch(/damage/i);
});

test.each([
    [{ meshType: 'Wizard', talentRanks: { ROG_28: 5 } }, 10],
    [{ meshType: 'Rogue', talentRanks: { ROG_28: -1 } }, 10],
    [{ meshType: 'Rogue', talentRanks: { ROG_28: Infinity } }, 10],
    [{ meshType: 'Rogue', talentRanks: { ROG_28: 99 } }, 12],
    [{ meshType: 'Rogue', talentRanks: { ROG_28: 1.9 } }, 10.4],
    ...[{ isMultiplayer: true }, { isRemote: true }, { gameEngine: { isMultiplayer: true } }]
        .map(flags => [{ meshType: 'Rogue', talentRanks: { ROG_28: 5 }, ...flags }, 10])
])('duration normalization and authority preserve %j as %s seconds', (source, expected) => {
    expect(getRogueEffectDuration(source, 10)).toBeCloseTo(expected, 8);
});
