import { jest } from '@jest/globals';
import { Cleric } from '../src/entities/Cleric.js';
import { Fighter } from '../src/entities/Fighter.js';
import { advanceClericUtilityBuffs, getClericUtilityPower } from '../src/skills/clericUtilityPower.js';

test.each([0, 1, 5].flatMap(rank => ['Blessing of Resolve', 'Blessing of Zeal', 'Mark of Weakness'].map(skill => ({ rank, skill }))))(
    'paid offline $skill rank $rank has canonical potency and reversible recipient stats', ({ rank, skill }) => {
        const source = new Cleric('utility-caster'), ally = new Fighter('utility-ally'), remote = new Fighter('utility-remote');
        const actors = [ally, remote];
        const engine = { chunkManager: { getActiveEntities: () => actors }, spawnTransientEffect: jest.fn(() => true),
            floatingTextManager: { spawn: jest.fn() }, isHostileActorTarget: () => false };
        try {
            source.baseStats.intelligence = 100;
            source.recalculateStats();
            source.stats.mana = source.stats.maxMana;
            source.unlockedSkills.push(skill);
            source.talentRanks = { [{ 'Blessing of Resolve': 'CLR_19', 'Blessing of Zeal': 'CLR_21', 'Mark of Weakness': 'CLR_23' }[skill]]: rank };
            ally.equipment.chest = { type: 'ARMOR', slot: 'chest', stats: { defense: 1000 } };
            ally.recalculateStats();
            ally.position.set(1, 0, 0);
            remote.position.set(2, 0, 0); remote.isRemote = true;
            const baseline = { ...ally.stats }, mana = source.stats.mana;
            const power = (25 + rank) / 25;
            source.useAbility(ally.position, engine, skill);
            expect(source.stats.mana).toBe(mana - (skill === 'Mark of Weakness' ? 30 : 35));
            expect(source.cooldowns[skill]).toBeGreaterThan(0);
            if (skill === 'Mark of Weakness') {
                expect(ally.markWeaknessFactor).toBeCloseTo(.2 * power);
                expect(ally.markWeaknessTimer).toBe(10);
                return;
            }
            const verify = () => {
                expect(ally.stats.defense).toBe(skill === 'Blessing of Resolve' ? Math.trunc(baseline.defense * (1 + .2 * power)) : baseline.defense);
                expect(ally.stats.speed).toBeCloseTo(baseline.speed * (skill === 'Blessing of Zeal' ? 1 + .2 * power : 1));
                expect(ally.stats.attackSpeed).toBeCloseTo(baseline.attackSpeed / (skill === 'Blessing of Zeal' ? 1 + .3 * power : 1));
            };
            verify();
            source.talentRanks = {};
            ally.recalculateStats(); verify();
            expect(remote.blessingResolveTimer).toBe(0);
            expect(remote.blessingZealTimer).toBe(0);
            advanceClericUtilityBuffs(ally, 30);
            expect(ally.stats.defense).toBe(baseline.defense);
            expect(ally.stats.speed).toBe(baseline.speed);
            expect(ally.stats.attackSpeed).toBe(baseline.attackSpeed);
            expect(ally.blessingResolvePower).toBe(0);
            expect(ally.zealPower).toBe(0);
        } finally { source.dispose(); ally.dispose(); remote.dispose(); }
    }
);

test('named power normalizes legacy IDs without changing ranks or accepting a foreign class', () => {
    const ranks = { CLR_019: 99, CLR_19: 1, CLR_31: 5 };
    const source = { meshType: 'Cleric', talentRanks: ranks };
    expect(getClericUtilityPower(source, 'Blessing of Resolve')).toBe(1.2);
    expect(ranks).toEqual({ CLR_019: 99, CLR_19: 1, CLR_31: 5 });
    source.meshType = 'Fighter';
    expect(getClericUtilityPower(source, 'Blessing of Resolve')).toBe(1);
});
