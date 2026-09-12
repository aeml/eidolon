import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';
import { CONSTANTS } from '../src/core/Constants.js';
import { getAbilityManaCost, getAbilityCooldown } from '../src/core/AbilityEconomy.js';

const cases = [
    ['Weak Point Mark', 'ROG_06', 'target', 'weakPointMarkTimer', 10, 25, 12],
    ['Smoke Bomb', 'ROG_20', 'target', 'slowTimer', 5, 35, 20],
    ['Cloak & Vanish', 'ROG_26', 'source', 'stealthTimer', 5, 30, 30]
];
afterEach(() => jest.restoreAllMocks());

test.each(cases)('%s Technique discounts actual paid casts without changing utility duration',
    (skill, id, recipient, field, duration, baseCost, cooldown) => {
        jest.spyOn(Math, 'random').mockReturnValue(.99);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        for (const rank of [0, 1, 5]) for (const sufficient of [false, true]) {
            const source = new Rogue('technique-owner'), target = new Imp('technique-target');
            try {
                source.mesh = new THREE.Group(); target.mesh = new THREE.Group();
                source.unlockedSkills.push(skill);
                source.talentRanks = { [id]: rank };
                source.stats.cooldownReduction = 0;
                source.stats.manaCostReduction = 0;
                const cost = Math.floor(baseCost * (1 - .02 * rank) + 1e-9);
                const available = cost - (sufficient ? 0 : 1);
                source.stats.mana = available;
                target.position.set(0, 0, 2); target.stats.hp = target.stats.maxHp = 10000;
                const engine = { isMultiplayer: false, scene: new THREE.Scene(),
                    chunkManager: { getActiveEntities: () => [target] },
                    floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true),
                    isHostileActorTarget: entity => entity === target };
                source.useAbility(target.position.clone(), engine, skill);
                const actor = recipient === 'source' ? source : target;
                expect(source.stats.mana).toBe(sufficient ? 0 : available);
                expect(actor[field] || 0).toBeCloseTo(sufficient ? duration : 0);
                expect(source.cooldowns[skill] || 0).toBeCloseTo(sufficient ? cooldown * (1 - .03 * rank) : 0);
                expect(target.stats.hp).toBe(10000);
                if (sufficient) {
                    source.stats.mana = 1000;
                    source.useAbility(target.position.clone(), engine, skill);
                    expect(source.stats.mana).toBe(1000); // normal cooldown still rejects
                }
            } finally { source.dispose(); target.dispose(); }
        }
    });

test.each(cases)('%s keeps saved identity and rank cap with honest Technique copy', (skill, id) => {
    const talent = CONSTANTS.PASSIVE_TALENTS.Rogue.find(t => t.id === id);
    expect(talent.maxRank).toBe(5);
    expect(talent.desc).toContain('+3%');
    expect(talent.desc).toContain('-2%');
    expect(talent.desc).toMatch(/mana cost.*15%.*10%/);
    expect(talent.desc).not.toMatch(/crit/i);
    expect(talent.criticalChance).toBeUndefined();
    expect(talent.abilityEconomy).toEqual({ skill, cdr: .03, manaReduction: .02 });
});

test('utility Technique discounts compose with equipment and stay within skill and class', () => {
    const player = { subType: 'Rogue', talentRanks: { ROG_06: 5, WIZ_27: 5 },
        stats: { manaCostReduction: .1, cooldownReduction: .2 } };
    expect(getAbilityManaCost(player, 'Weak Point Mark', 25)).toBe(19); // floor(25*.9)=22, floor(22*.9)=19
    expect(getAbilityCooldown(player, 'Weak Point Mark', 12)).toBeCloseTo(8.16);
    expect(getAbilityManaCost(player, 'Smoke Bomb', 35)).toBe(31);
    expect(getAbilityCooldown(player, 'Smoke Bomb', 20)).toBe(16);
    expect(getAbilityManaCost({ ...player, subType: 'Fighter' }, 'Weak Point Mark', 25)).toBe(22);
});
