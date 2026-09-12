import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Imp } from '../src/entities/Imp.js';
import { getOfflineEffectiveArmor } from '../src/core/OfflineArmor.js';

beforeEach(() => jest.spyOn(Math, 'random').mockReturnValue(.99));
afterEach(() => jest.restoreAllMocks());

function fixture(rune = '', ranks = {}) {
    const source = new Fighter('charge-source'), targets = [];
    source.mesh = new THREE.Group(); source.position.set(50000, 7, 50000);
    source.level = 100; source.unlockedSkills = ['Charge', 'Whirlwind'];
    source.stats.mana = source.stats.maxMana = 1000;
    source.stats.damage = 100; source.stats.defense = 100;
    source.stats.hpRegen = source.stats.manaRegen = source.stats.critChanceBonus = 0;
    source.talentRanks = ranks; source.skillRunes = { Charge: rune };
    const engine = { currentInstanceId: 'charge-test', currentInstanceType: 'dungeon',
        chunkManager: { getActiveEntities: () => targets }, isHostileActorTarget: target => target.hostile,
        floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true) };
    const add = (x, z = 0) => {
        const target = new Imp(`charge-target-${targets.length}`);
        target.position.set(50000 + x, 200, 50000 + z); target.radius = .5;
        target.hostile = true; target.stats.hp = target.stats.maxHp = 10000;
        targets.push(target); return target;
    };
    return { source, engine, add, targets,
        cast: (x = 20) => source.useAbility(new THREE.Vector3(50000 + x, 200, 50000), engine, 'Charge'),
        step: dt => source.update(dt, null, null, engine.chunkManager, engine.floatingTextManager),
        dispose: () => { source.dispose(); targets.forEach(target => target.dispose()); } };
}

test.each([0, 1, 5])('paid Charge uses planar speed, fixed body-edge radius and impact-time damage rank %s', rank => {
    const f = fixture('', { FTR_21: rank, FTR_22: rank, FTR_38: rank });
    try {
        const edge = f.add(36.499), outside = f.add(36.501);
        f.cast();
        expect(f.source.stats.mana).toBe(980);
        const cooldown = f.source.cooldowns.Charge;
        f.step(.1);
        expect(f.source.position.toArray()).toEqual([50005, 7, 50000]);
        expect(edge.stats.hp).toBe(10000);
        expect(f.source.cooldowns.Charge).toBeCloseTo(cooldown - .1, 8);
        f.step(.3);
        expect(f.source.position.toArray()).toEqual([50020, 7, 50000]);
        // FTR_21 is Shattering-specific; only generic FTR_38 affects Charge.
        expect(10000 - edge.stats.hp).toBe(Math.trunc(195 * (1 + .02 * rank)));
        expect(outside.stats.hp).toBe(10000);
        f.step(.1); expect(10000 - edge.stats.hp).toBe(Math.trunc(195 * (1 + .02 * rank)));
    } finally { f.dispose(); }
});

test.each([['', 100, 28, 195], ['charge_momentum', 10, 15, 292], ['charge_momentum', 100, 42, 390]])(
    'range and traveled-distance damage for rune %s aim %s', (rune, aim, landing, damage) => {
        const f = fixture(rune);
        try { const target = f.add(landing); f.cast(aim); f.step(1);
            expect(f.source.position.toArray()).toEqual([50000 + landing, 7, 50000]);
            expect(10000 - target.stats.hp).toBe(damage);
            const waves = f.engine.spawnTransientEffect.mock.calls.filter(([type]) => type === 'wave');
            expect(waves).toHaveLength(1);
            expect(waves[0][1].toArray()).toEqual([50000 + landing, 7, 50000]);
            expect(waves[0][3].radius).toBe(16);
        } finally { f.dispose(); }
    });

test.each([false, true])('Charge and Shockwave respect disconnected floors; doorway=%s', doorway => {
    const f = fixture('charge_shockwave');
    try {
        f.engine.currentDungeonLayout = { walkRects: [
            { x: 50000, z: 50000, width: 20, height: 20 },
            { x: 50021, z: 50000, width: 20, height: 20 },
            ...(doorway ? [{ x: 50010.5, z: 50000, width: 3, height: 4 }] : [])
        ] };
        f.source.position.x += 8;
        const target = f.add(9), behind = f.add(12);
        f.cast(8); f.step(.1);
        expect(target.position.x).toBe(doorway ? 50013 : 50010);
        expect(behind.stats.hp < 10000).toBe(doorway);
    } finally { f.dispose(); }
});

test.each([0, 1, 5])('Unstoppable grants finite real armor at impact, preserves gear, and expires during stun rank %s', rank => {
    const f = fixture('charge_unstoppable', { FTR_30: rank, FTR_37: rank });
    try {
        f.cast(); expect(f.source.ccImmune).toBe(true);
        expect(getOfflineEffectiveArmor(f.source)).toBe(100);
        f.source.talentRanks = {}; f.source.skillRunes.Charge = '';
        f.step(.4); expect(f.source.ccImmune).toBeFalsy();
        expect(f.source.runeArmorBuffTimer).toBeCloseTo(5 * (1 + .07 * rank), 8);
        expect(f.source.stats.defense).toBe(100); expect(getOfflineEffectiveArmor(f.source)).toBe(120);
        f.source.stats.defense = 200; expect(getOfflineEffectiveArmor(f.source)).toBe(240);
        f.source.stunTimer = 20; f.step(5 * (1 + .07 * rank));
        expect(getOfflineEffectiveArmor(f.source)).toBe(200);
        expect(f.source.runeArmorBuff || 0).toBe(0);
    } finally { f.dispose(); }
});

test.each(['friendly', 'remote', 'multiplayer', 'engine', 'dead', 'inactive', 'other-instance'])('%s target receives no Charge damage or knockback', kind => {
    const f = fixture('charge_shockwave');
    try {
        const target = f.add(21);
        if (kind === 'friendly') target.hostile = false;
        if (kind === 'remote') target.isRemote = true;
        if (kind === 'multiplayer') target.isMultiplayer = true;
        if (kind === 'engine') target.gameEngine = { isMultiplayer: true };
        if (kind === 'dead') target.state = 'DEAD';
        if (kind === 'inactive') target.isActive = false;
        if (kind === 'other-instance') target.gameEngine = { currentInstanceId: 'other' };
        f.cast(); f.step(1);
        expect(target.stats.hp).toBe(10000); expect(target.position.x).toBe(50021);
    } finally { f.dispose(); }
});

test.each(['ccImmune', 'ironFortressImmovable'])('%s target takes damage but not Shockwave displacement', property => {
    const f = fixture('charge_shockwave');
    try { const target = f.add(21); target[property] = true; f.cast(); f.step(1);
        expect(target.stats.hp).toBe(9805); expect(target.position.x).toBe(50021);
    } finally { f.dispose(); }
});

test.each(['death', 'scene', 'cancel', 'flag', 'multiplayer'])('%s recovery cancels owned travel and immunity without an impact', kind => {
    const f = fixture('charge_unstoppable');
    try {
        const target = f.add(20); f.cast(); f.step(.1);
        if (kind === 'death') f.source.die();
        if (kind === 'scene') f.engine.currentInstanceId = 'other';
        if (kind === 'cancel') f.source.cancelAbilities();
        if (kind === 'flag') f.source.isCharging = false;
        if (kind === 'multiplayer') f.engine.isMultiplayer = true;
        f.step(1);
        expect(f.source.isCharging).toBe(false); expect(f.source.ccImmune).toBeFalsy();
        expect(target.stats.hp).toBe(10000); expect(f.source.runeArmorBuff || 0).toBe(0);
    } finally { f.dispose(); }
});

test('ordinary Charge cannot be replaced by another paid cast and respects stun while clocks run', () => {
    const f = fixture();
    try {
        f.cast(); const mana = f.source.stats.mana;
        f.source.useAbility(f.source.position.clone(), f.engine, 'Whirlwind');
        expect(f.source.stats.mana).toBe(mana); expect(f.source.isWhirlwinding).toBeFalsy();
        f.source.stunTimer = 1; f.step(.5);
        expect(f.source.position.x).toBe(50000); expect(f.source.stunTimer).toBe(.5);
        f.step(.5); expect(f.source.position.x).toBe(50020);
    } finally { f.dispose(); }
});

test.each(['locked', 'mana', 'cooldown', 'stun', 'dead', 'remote', 'multiplayer', 'invalid'])('%s cast cannot begin local Charge', kind => {
    const f = fixture('charge_unstoppable');
    try {
        if (kind === 'locked') f.source.unlockedSkills = [];
        if (kind === 'mana') f.source.stats.mana = 0;
        if (kind === 'cooldown') f.source.cooldowns.Charge = 10;
        if (kind === 'stun') f.source.stunTimer = 10;
        if (kind === 'dead') f.source.state = 'DEAD';
        if (kind === 'remote') f.source.isRemote = true;
        if (kind === 'multiplayer') f.engine.isMultiplayer = true;
        const mana = f.source.stats.mana;
        f.cast(kind === 'invalid' ? NaN : 20);
        expect(f.source.offlineCharge).toBeFalsy(); expect(f.source.isCharging).toBe(false);
        expect(f.source.ccImmune).toBeFalsy();
        if (kind !== 'multiplayer') expect(f.source.stats.mana).toBe(mana);
    } finally { f.dispose(); }
});

test.each([false, true])('actual attack consumes paid Unstoppable armor at impact; expired=%s', expired => {
    const f = fixture('charge_unstoppable');
    try {
        Math.random.mockReturnValue(.5); // Neutral basic-attack variance, no crit.
        const enemy = f.add(20); enemy.position.y = 7; enemy.stats.damage = 200;
        enemy.stats.critChanceBonus = 0; enemy.lastAttackTime = 0;
        f.source.stats.hp = f.source.stats.maxHp = 1000;
        f.cast(); f.step(.4);
        const callbacks = []; enemy.scheduleTask = callback => { callbacks.push(callback); return callbacks.length; };
        expect(enemy.attack(f.source)).toBe(true);
        if (expired) { f.source.stunTimer = 20; f.step(5); }
        const before = f.source.stats.hp; callbacks[0]();
        expect(before - f.source.stats.hp).toBe(expired ? 100 : 80);
        expect(f.source.stats.defense).toBe(100);
    } finally { f.dispose(); }
});

test('charge preserves an existing immunity source and a second cast refreshes rather than stacking armor', () => {
    const f = fixture('charge_unstoppable');
    try {
        f.source.ccImmune = true; f.cast(); f.step(.4);
        expect(f.source.ccImmune).toBe(true);
        f.step(2); f.source.cooldowns.Charge = 0;
        f.cast(20); f.step(.1);
        expect(f.source.runeArmorBuffTimer).toBe(5);
        expect(getOfflineEffectiveArmor(f.source)).toBe(120);
    } finally { f.dispose(); }
});
