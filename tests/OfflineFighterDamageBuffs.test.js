import { jest } from '@jest/globals';
import { Fighter } from '../src/entities/Fighter.js';
import { Cleric } from '../src/entities/Cleric.js';
import { Actor } from '../src/entities/Actor.js';
import { CONSTANTS } from '../src/core/Constants.js';
import { getFighterDamageBuffMultiplier } from '../src/skills/offlineFighterDamageBuffs.js';

const actors = [];
function hero(Type = Fighter) {
    const actor = new Type(`damage-buff-${actors.length}`);
    actors.push(actor);
    actor.baseStats.strength = 100;
    actor.baseStats.intelligence = 30;
    actor.equipment.chest = { type: 'ARMOR', slot: 'chest', stats: { defense: 50 } };
    actor.recalculateStats();
    actor.stats.hp = actor.stats.maxHp / 5;
    actor.stats.mana = actor.stats.maxMana;
    return actor;
}
const engine = () => ({ spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() },
    chunkManager: { getActiveEntities: () => actors } });
afterEach(() => { for (const actor of actors.splice(0)) actor.dispose(); jest.restoreAllMocks(); });

test.each(['Berserker Edge', 'Last Stand Rampage'].flatMap(skill =>
    [0, 1, 5, 99, -1].map(rank => ({ skill, rank }))))(
    'paid $skill rank$rank changes actual Damage and basic impact once', ({ skill, rank }) => {
        const actor = hero();
        actor.unlockedSkills.push(skill);
        actor.talentRanks = { [skill === 'Berserker Edge' ? 'FTR_19' : 'FTR_25']: rank, FTR_38: 5 };
        const baseDamage = actor.stats.damage, baseDefense = actor.stats.defense;
        expect(baseDamage).toBe(25); expect(baseDefense).toBe(50);
        const mana = actor.stats.mana;
        actor.useAbility(actor.position.clone(), engine(), skill);
        const multiplier = (skill === 'Berserker Edge' ? 1.5 : 3) * (25 + Math.max(0, Math.min(5, rank))) / 25;
        expect(actor.stats.damage).toBe(Math.trunc(baseDamage * multiplier));
        expect(actor.stats.defense).toBe(skill === 'Berserker Edge' ? 40 : 50);
        expect(actor.stats.mana).toBe(mana);
        actor.talentRanks = {};
        actor.recalculateStats();
        expect(actor.stats.damage).toBe(Math.trunc(baseDamage * multiplier));
        const target = new Actor('buff-impact-target', {}); actors.push(target);
        target.stats.hp = 1000; target.stats.defense = 0;
        const callbacks = [];
        actor.scheduleTask = callback => { callbacks.push(callback); return callbacks.length; };
        jest.spyOn(Math, 'random').mockReturnValue(.5);
        expect(actor.attack(target)).toBe(true);
        expect(target.stats.hp).toBe(1000);
        callbacks[0]();
        expect(target.stats.hp).toBe(1000 - Math.trunc(baseDamage * multiplier));
    });

test('Berserker shares the caster snapshot only with living nearby same-instance party heroes', () => {
    const caster = hero(), ally = hero(Cleric), far = hero(Cleric), outsider = hero(Cleric), other = hero(Cleric), dead = hero(Cleric);
    caster.unlockedSkills.push('Berserker Edge');
    caster.talentRanks = { FTR_19: 5, FTR_30: 5, FTR_37: 5 };
    for (const actor of actors) { actor.partyId = 'party'; actor.instanceId = 'room'; }
    far.position.x = 100; outsider.partyId = 'other'; other.instanceId = 'other'; dead.state = 'DEAD';
    ally.talentRanks = { FTR_19: 0 };
    const damage = ally.stats.damage;
    caster.useAbility(caster.position.clone(), engine(), 'Berserker Edge');
    expect(ally.berserkerEdgeMultiplier).toBe(1.8);
    expect(ally.stats.damage).toBe(Math.trunc(damage * 1.8));
    expect(ally.berserkerEdgeTimer).toBeCloseTo(20.25, 8);
    for (const actor of [far, outsider, other, dead]) expect(actor.berserkerEdgeActive).toBe(false);
    ally.stunTimer = 30;
    ally.update(20.24);
    expect(ally.berserkerEdgeActive).toBe(true);
    ally.update(.02);
    expect(ally.berserkerEdgeTimer).toBe(0);
    expect(ally.berserkerEdgeActive).toBe(false);
    expect(ally.berserkerEdgeMultiplier).toBe(1);
    expect(ally.stats.damage).toBe(damage);
    expect(ally.stats.defense).toBe(50);
});

test('overlap, refresh, natural expiry and cancellation never compound stale stats', () => {
    const actor = hero();
    actor.unlockedSkills.push('Berserker Edge', 'Last Stand Rampage');
    actor.talentRanks = { FTR_19: 5, FTR_25: 5 };
    const game = engine();
    actor.useAbility(actor.position.clone(), game, 'Berserker Edge');
    actor.useAbility(actor.position.clone(), game, 'Last Stand Rampage');
    expect(actor.stats.damage).toBe(162);
    actor.cooldowns['Berserker Edge'] = 0;
    actor.useAbility(actor.position.clone(), game, 'Berserker Edge');
    expect(actor.stats.damage).toBe(162);
    actor.stunTimer = 30;
    actor.update(10.01);
    expect(actor.stats.damage).toBe(45);
    expect(actor.lastStandMultiplier).toBe(1);
    actor.cancelAbilities();
    expect(actor.stats.damage).toBe(25);
    expect(actor.stats.defense).toBe(50);
});

test('death clears both buffs, including buffs received by another class', () => {
    const caster = hero(), ally = hero(Cleric);
    caster.partyId = ally.partyId = 'party';
    caster.unlockedSkills.push('Berserker Edge', 'Last Stand Rampage');
    caster.useAbility(caster.position.clone(), engine(), 'Berserker Edge');
    caster.useAbility(caster.position.clone(), engine(), 'Last Stand Rampage');
    for (const actor of [caster, ally]) {
        actor.die();
        expect(actor.berserkerEdgeActive).toBe(false);
        expect(actor.berserkerEdgeMultiplier).toBe(1);
        expect(actor.lastStandTimer).toBe(0);
        expect(actor.lastStandMultiplier).toBe(1);
        expect(actor.stats.defense).toBe(50);
    }
});

test.each(['actor', 'engine', 'remote'])('%s authority never grants predicted damage buff stats', mode => {
    const actor = hero(), game = engine();
    actor.unlockedSkills.push('Berserker Edge', 'Last Stand Rampage');
    if (mode === 'actor') actor.isMultiplayer = true;
    if (mode === 'engine') game.isMultiplayer = true;
    if (mode === 'remote') actor.isRemote = true;
    actor.useAbility(actor.position.clone(), game, 'Berserker Edge');
    actor.useAbility(actor.position.clone(), game, 'Last Stand Rampage');
    expect(actor.stats.damage).toBe(25);
    expect(actor.stats.defense).toBe(50);
    expect(actor.berserkerEdgeActive).toBe(false);
    expect(actor.lastStandTimer).toBe(0);
});

test('actual Executioner Spin receives buffed Damage plus Strength, with generic damage once', () => {
    const caster = hero();
    caster.unlockedSkills.push('Berserker Edge', 'Executioner Spin');
    caster.talentRanks = { FTR_19: 5, FTR_38: 5 };
    const target = new Actor('spin-buff-target', {}); actors.push(target);
    target.stats.hp = target.stats.maxHp = 10000;
    target.stats.defense = 0; target.position.z = 1;
    const game = engine();
    caster.useAbility(caster.position.clone(), game, 'Berserker Edge');
    caster.useAbility(target.position.clone(), game, 'Executioner Spin');
    expect(target.stats.hp).toBe(10000 - Math.floor((45 + 300) * 1.3 * 1.1));
});

test('a real Radiant Strike purge removes Berserker strength and defense cost, not Last Stand', () => {
    const target = hero(), cleric = hero(Cleric), game = engine();
    target.unlockedSkills.push('Berserker Edge', 'Last Stand Rampage');
    target.talentRanks = { FTR_19: 5, FTR_25: 5 };
    target.useAbility(target.position.clone(), game, 'Berserker Edge');
    target.useAbility(target.position.clone(), game, 'Last Stand Rampage');
    target.stats.hp = target.stats.maxHp = 10000; target.position.z = 1;
    cleric.unlockedSkills.push('Radiant Strike');
    cleric.skillRunes = { 'Radiant Strike': 'radiantstrike_purge' };
    game.isHostileActorTarget = entity => entity === target;
    const impact = jest.spyOn(target, 'takeDamage');
    cleric.useAbility(target.position.clone(), game, 'Radiant Strike');
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact.mock.calls[0][0]).toBeGreaterThan(0);
    expect(target.berserkerEdgeActive).toBe(false);
    expect(target.berserkerEdgeMultiplier).toBe(1);
    expect(target.berserkerEdgeTimer).toBe(0);
    expect(target.lastStandMultiplier).toBe(3.6);
    expect(target.stats.damage).toBe(90);
    expect(target.stats.defense).toBe(50);
    expect(target.stats.hp).toBeLessThan(10000);
});

test('Last Stand rejects healthy actors and ordinary cooldown rejection cannot refresh Berserker', () => {
    const actor = hero(), game = engine();
    actor.unlockedSkills.push('Berserker Edge', 'Last Stand Rampage');
    actor.stats.hp = actor.stats.maxHp * .3;
    actor.useAbility(actor.position.clone(), game, 'Last Stand Rampage');
    expect(actor.lastStandTimer).toBe(0);
    expect(actor.cooldowns['Last Stand Rampage'] || 0).toBe(0);
    actor.useAbility(actor.position.clone(), game, 'Berserker Edge');
    actor.berserkerEdgeTimer = 5;
    actor.talentRanks = { FTR_19: 5 };
    actor.useAbility(actor.position.clone(), game, 'Berserker Edge');
    expect(actor.berserkerEdgeTimer).toBe(5);
    expect(actor.berserkerEdgeMultiplier).toBe(1.5);
});

test('Whirlwind continues ordinary buff timers instead of prolonging them', () => {
    const actor = hero(), game = engine();
    actor.unlockedSkills.push('Berserker Edge', 'Whirlwind');
    actor.useAbility(actor.position.clone(), game, 'Berserker Edge');
    actor.berserkerEdgeTimer = .1;
    actor.useAbility(actor.position.clone(), game, 'Whirlwind');
    actor.update(.2, null, null, game.chunkManager);
    expect(actor.berserkerEdgeActive).toBe(false);
    expect(actor.berserkerEdgeMultiplier).toBe(1);
    expect(actor.stats.damage).toBe(25);
});

test.each([NaN, Infinity, -Infinity, 'invalid'])('malformed rank %s cannot poison buff stats', value => {
    expect(getFighterDamageBuffMultiplier({ talentRanks: { FTR_19: value } }, 'Berserker Edge')).toBe(1.5);
    expect(getFighterDamageBuffMultiplier({ talentRanks: { FTR_25: value } }, 'Last Stand Rampage')).toBe(3);
});

test('descriptions identify a Damage-stat multiplier, not all spell damage or a passive HP proc', () => {
    expect(CONSTANTS.SKILL_TREES.Fighter.BranchC.Tier2.desc).toContain('20% defense');
    expect(CONSTANTS.SKILL_TREES.Fighter.BranchC.Tier2.desc).not.toContain('60%');
    for (const id of ['FTR_19', 'FTR_25']) {
        const talent = CONSTANTS.PASSIVE_TALENTS.Fighter.find(entry => entry.id === id);
        expect(talent.maxRank).toBe(5);
        expect(talent.desc).toContain('Damage stat');
        expect(talent.desc).toContain('20% max');
    }
});
