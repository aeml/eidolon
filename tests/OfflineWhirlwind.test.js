import { jest } from '@jest/globals';
import { Fighter } from '../src/entities/Fighter.js';
import { Actor } from '../src/entities/Actor.js';

const actors = [];
function fixture(rune = '', ranks = {}) {
    const source = new Fighter(`whirlwind-${actors.length}`);
    actors.push(source);
    source.baseStats.strength = 100; source.baseStats.intelligence = 30;
    source.recalculateStats(); source.stats.hp = source.stats.maxHp / 2;
    source.stats.mana = source.stats.maxMana; source.stats.hpRegen = source.stats.manaRegen = 0;
    source.unlockedSkills.push('Charge', 'Shattering Charge', 'Whirlwind', 'Berserker Edge', 'Last Stand Rampage');
    source.talentRanks = ranks; source.skillRunes = { Whirlwind: rune };
    const target = enemy(1);
    const engine = { currentInstanceId: 'room', currentInstanceType: 'dungeon',
        chunkManager: { getActiveEntities: () => actors },
        spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() } };
    return { source, target, engine };
}
function enemy(x) {
    const target = new Actor(`spin-enemy-${actors.length}`, {}); actors.push(target);
    target.position.x = x; target.stats.hp = target.stats.maxHp = 10000; target.stats.defense = 0;
    jest.spyOn(target, 'takeDamage'); return target;
}
function cast(f) { f.source.useAbility(f.source.position.clone(), f.engine, 'Whirlwind'); }
function tick(f, dt) { f.source.update(dt, null, null, f.engine.chunkManager); }
afterEach(() => { for (const actor of actors.splice(0)) actor.dispose(); jest.restoreAllMocks(); });

test.each([{ FTR_4: 5 }, { FTR_04: 1, FTR_4: 5 }, { FTR_04: 5, FTR_4: 1 }])(
    'legacy Technique ranks %j retain one trained footprint for both paid pulses', ranks => {
        const f = fixture('', Object.freeze(ranks));
        f.target.radius = .5; f.target.position.x = 7.09;
        const outside = enemy(7.11); outside.radius = .5;
        cast(f);
        expect(f.source.stats.mana).toBe(270);
        expect(f.source.offlineWhirlwind.radius).toBeCloseTo(6.6, 8);
        expect(f.target.takeDamage).toHaveBeenCalledTimes(1);
        const spin = f.engine.spawnTransientEffect.mock.calls.find(([type]) => type === 'spin');
        expect(spin[3].radius).toBeCloseTo(6.6, 8);
        f.source.talentRanks = {};
        tick(f, .5);
        expect(f.target.takeDamage).toHaveBeenCalledTimes(2);
        expect(outside.takeDamage).not.toHaveBeenCalled();
    });

test.each([0, 1, 5].flatMap(rank => [0, 5].flatMap(generic => ['', 'whirlwind_extended'].map(rune => ({ rank, generic, rune }))))) (
    'paid area rank$rank generic$generic $rune reaches its visible edge and keeps the cast snapshot', ({ rank, generic, rune }) => {
        const f = fixture(rune, { FTR_04: rank, FTR_33: generic, FTR_38: generic });
        const radius = 6 * (1 + .02 * rank + .05 * generic);
        f.target.radius = .5; f.target.position.x = radius + .5 - .001;
        const outside = enemy(-radius - .5 - .001); outside.radius = .5;
        cast(f);
        expect(f.source.stats.mana).toBe(270);
        expect(f.target.takeDamage).toHaveBeenCalledTimes(1);
        expect(outside.takeDamage).not.toHaveBeenCalled();
        expect(f.source.offlineWhirlwind.radius).toBeCloseTo(radius, 8);
        const spin = f.engine.spawnTransientEffect.mock.calls.find(([type]) => type === 'spin');
        expect(spin[3].radius).toBeCloseTo(radius, 8);
        f.source.talentRanks = { FTR_04: 5 - rank, FTR_33: 5 - generic, FTR_38: 5 - generic };
        tick(f, .5);
        expect(f.target.takeDamage).toHaveBeenCalledTimes(2);
        expect(outside.takeDamage).not.toHaveBeenCalled();
    });

test.each(['', 'whirlwind_extended'].flatMap(rune => [0, 1, 5].map(rank => ({ rune, rank }))))(
    '$rune rank$rank uses one paid cast budget and exact half-second pulses', ({ rune, rank }) => {
        const f = fixture(rune, { FTR_03: rank, FTR_38: 5 });
        const total = rune ? 4 : 2;
        const budget = Math.trunc((25 * .8 + 100 * 2) * 1.3 * (1 + .04 * rank + .1));
        cast(f);
        expect(f.source.stats.mana).toBe(270);
        expect(f.source.cooldowns.Whirlwind).toBeCloseTo(5.6, 8);
        expect(f.target.takeDamage).toHaveBeenCalledTimes(1);
        expect(f.target.takeDamage.mock.calls[0][0]).toBe(Math.trunc(budget / total));
        tick(f, .49); expect(f.target.takeDamage).toHaveBeenCalledTimes(1);
        tick(f, .01); expect(f.target.takeDamage).toHaveBeenCalledTimes(2);
        for (let i = 2; i < total; i++) tick(f, .5);
        expect(f.target.takeDamage.mock.calls.map(call => call[0])).toEqual(Array.from({ length: total }, (_, i) =>
            Math.trunc(budget * (i + 1) / total) - Math.trunc(budget * i / total)));
        expect(f.target.stats.hp).toBe(10000 - budget);
        tick(f, .5); expect(f.source.isWhirlwinding).toBe(false);
        expect(f.source.offlineWhirlwind).toBeNull();
    });

test('Berserker affects the Damage term once and mid-spin talent/stat changes cannot rewrite its budget', () => {
    const f = fixture('', { FTR_19: 5, FTR_03: 5, FTR_38: 5 });
    f.source.useAbility(f.source.position.clone(), f.engine, 'Berserker Edge');
    cast(f);
    const budget = Math.trunc((45 * .8 + 200) * 1.3 * 1.3);
    f.source.talentRanks = {}; f.source.stats.damage = 9999;
    tick(f, .5);
    expect(f.target.stats.hp).toBe(10000 - budget);
});

test('radius includes target bodies, excludes friendly/other-instance/dead actors and respects dungeon walls', () => {
    const f = fixture(); f.target.position.x = 6.4; f.target.radius = .5;
    const outside = enemy(7.26), wall = enemy(-3), other = enemy(1), dead = enemy(1);
    other.instanceId = 'other'; dead.state = 'DEAD';
    const ally = new Fighter('spin-ally'); actors.push(ally); jest.spyOn(ally, 'takeDamage');
    f.engine.currentDungeonLayout = { walkRects: [{ x: 3.5, z: 0, width: 8, height: 10 }, { x: -3, z: 0, width: 1, height: 1 }] };
    cast(f);
    expect(f.target.takeDamage).toHaveBeenCalledTimes(1);
    for (const target of [outside, wall, other, dead, ally]) expect(target.takeDamage).not.toHaveBeenCalled();
});

test('Bloodwhirl heals only once per unique enemy, applies poison, and can discover a later arrival', () => {
    const f = fixture('whirlwind_bloodwhirl'); enemy(2);
    f.source.poisonTimer = 10; f.source.stats.maxHp = 1000; f.source.stats.hp = 100;
    cast(f); expect(f.source.stats.hp).toBe(120);
    enemy(2); tick(f, .5);
    expect(f.source.stats.hp).toBe(130);
});

test('Bladestorm pulls once, does not push a close actor, and respects immunity', () => {
    const f = fixture('whirlwind_bladestorm'); f.target.position.x = 5;
    const close = enemy(.5), immune = enemy(4); immune.ccImmune = true;
    cast(f); expect(f.target.position.x).toBe(3);
    expect(close.position.x).toBe(.5); expect(immune.position.x).toBe(4);
    tick(f, .5); expect(f.target.position.x).toBe(3);
});

test.each(['death', 'scene', 'removed', 'cancel', 'authority'])('%s cancels later pulses and transient state', reason => {
    const f = fixture('whirlwind_extended'); cast(f);
    if (reason === 'death') f.source.die();
    if (reason === 'scene') f.engine.currentInstanceId = 'next';
    if (reason === 'removed') f.source.isActive = false;
    if (reason === 'cancel') f.source.cancelAbilities();
    if (reason === 'authority') f.engine.isMultiplayer = true;
    tick(f, .5);
    expect(f.target.takeDamage).toHaveBeenCalledTimes(1);
    expect(f.source.isWhirlwinding).toBe(false);
    expect(f.source.offlineWhirlwind).toBeNull();
    if (reason === 'death') expect(f.source.state).toBe('DEAD');
});

test('a late update at expiry does not replay missed pulses', () => {
    const f = fixture('whirlwind_extended'); cast(f); tick(f, 2);
    expect(f.target.takeDamage).toHaveBeenCalledTimes(1);
    expect(f.source.isWhirlwinding).toBe(false);
});

test('Extended catches up due pulses only while its window is still active', () => {
    const f = fixture('whirlwind_extended'); cast(f); tick(f, 1.6);
    expect(f.target.takeDamage).toHaveBeenCalledTimes(4);
    expect(f.target.stats.hp).toBe(10000 - 286);
    tick(f, .1); expect(f.target.takeDamage).toHaveBeenCalledTimes(4);
});

test.each([2999, 3001])('ordinary Charge to Whirlwind combo honors the three-second cast window (%sms)', elapsed => {
    const f = fixture();
    const now = jest.spyOn(Date, 'now').mockReturnValue(10000);
    f.target.position.x = 100;
    f.source.useAbility(f.source.position.clone(), f.engine, 'Charge');
    expect(f.source.stats.mana).toBe(280);
    expect(f.source.lastOfflineFighterCast?.skill).toBe('Charge');
    tick(f, 0); // Complete the actual zero-distance charge through its updater.
    f.target.position.x = 1;
    now.mockReturnValue(10000 + elapsed);
    cast(f); tick(f, .5);
    expect(f.target.stats.hp).toBe(10000 - (elapsed <= 3000 ? 429 : 286));
});

test.each(['locked', 'mana', 'cooldown', 'stun', 'remote', 'online'])('%s blocks a cast without creating a channel or spending again', gate => {
    const f = fixture();
    if (gate === 'locked') f.source.unlockedSkills = [];
    if (gate === 'mana') f.source.stats.mana = 0;
    if (gate === 'cooldown') f.source.cooldowns.Whirlwind = 5;
    if (gate === 'stun') f.source.stunTimer = 5;
    if (gate === 'remote') f.source.isRemote = true;
    if (gate === 'online') f.engine.isMultiplayer = true;
    const mana = f.source.stats.mana;
    cast(f);
    expect(f.target.takeDamage).not.toHaveBeenCalled();
    expect(f.source.isWhirlwinding || false).toBe(false);
    // Online prediction pays ordinary mana; its server, not this path, hits.
    expect(f.source.stats.mana).toBe(gate === 'online' ? mana - 30 : mana);
});

test('lethal real Thorns reflection ends the channel without reviving the caster or emitting later pulses', () => {
    const f = fixture('whirlwind_extended');
    f.source.stats.hp = 1; f.target.hasThornsEffect = true;
    cast(f);
    expect(f.source.state).toBe('DEAD');
    expect(f.source.offlineWhirlwind).toBeNull();
    expect(f.source.isWhirlwinding).toBe(false);
    tick(f, .5);
    expect(f.target.takeDamage).toHaveBeenCalledTimes(1);
    expect(f.source.state).toBe('DEAD');
});

test.each(['Charge', 'Shattering Charge'])('%s movement does not pause an already active Whirlwind', skill => {
    const f = fixture('whirlwind_extended'); cast(f);
    f.source.useAbility(f.source.position.clone().setX(10), f.engine, skill);
    tick(f, .5);
    expect(f.source.position.x).toBeGreaterThan(0);
    expect(f.source.offlineWhirlwind.elapsed).toBe(.5);
    expect(f.source.offlineWhirlwind.tick).toBe(2);
});
