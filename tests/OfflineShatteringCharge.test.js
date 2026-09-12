import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Actor } from '../src/entities/Actor.js';
import { Imp } from '../src/entities/Imp.js';
import { getAbilityAoeRadius } from '../src/skills/abilityRadii.js';

beforeEach(() => jest.spyOn(Math, 'random').mockReturnValue(.99));
afterEach(() => jest.restoreAllMocks());

function fixture(ranks = {}) {
    const source = new Fighter('shattering-source'), targets = [];
    source.mesh = new THREE.Group(); source.position.set(50000, 7, 50000);
    source.level = 100; source.unlockedSkills.push('Shattering Charge');
    source.stats.mana = source.stats.maxMana = 1000;
    source.stats.damage = 100; source.stats.critChanceBonus = 0;
    source.stats.hpRegen = source.stats.manaRegen = 0;
    source.talentRanks = ranks;
    const engine = { isMultiplayer: false, currentInstanceId: 'test-dungeon', currentInstanceType: 'dungeon',
        chunkManager: { getActiveEntities: () => targets }, isHostileActorTarget: target => target.hostile,
        floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true) };
    const add = (x, z = 0) => {
        const target = new Imp(`shattering-target-${targets.length}`);
        target.position.set(50000 + x, 200, 50000 + z); target.radius = .5;
        target.hostile = true; target.stats.hp = target.stats.maxHp = 10000;
        target.stats.defense = 20; target.stats.hpRegen = 0;
        targets.push(target); return target;
    };
    return { source, engine, targets, add,
        cast: (distance = 20) => source.useAbility(new THREE.Vector3(50000 + distance, 200, 50000), engine, 'Shattering Charge'),
        step: dt => source.update(dt, null, null, engine.chunkManager, engine.floatingTextManager),
        dispose: () => { source.dispose(); for (const target of targets) target.dispose(); } };
}

test.each([0, 1, 5, 99])('paid travel applies one trained armor break at impact, duration rank %s', rank => {
    const f = fixture({ FTR_30: rank, FTR_37: rank });
    try {
        const target = f.add(20);
        f.cast();
        expect(f.source.stats.mana).toBe(970);
        expect(f.source.isCharging).toBe(true);
        expect(target.armorReduction).toBe(0);
        f.source.talentRanks = {};
        f.step(.1);
        expect(f.source.position.x).toBe(50005);
        expect(f.source.position.y).toBe(7);
        expect(target.stats.hp).toBe(10000);
        f.step(.3);
        expect(f.source.position.x).toBe(50020);
        expect(f.source.isCharging).toBe(false);
        expect(f.source.isShatteringCharge).toBe(false);
        expect(f.source.shatteringArmorDuration).toBe(0);
        expect(target.stats.hp).toBe(9805);
        expect(target.stats.defense).toBe(20);
        expect(target.armorReduction).toBe(5);
        const duration = 5 * (1 + .07 * Math.min(rank, 5));
        expect(target.armorReductionTimer).toBeCloseTo(duration, 8);
        target.stunTimer = 20;
        Actor.prototype.update.call(target, duration, null, null, f.engine.chunkManager);
        expect(target.armorReduction).toBe(0);
        expect(target.stats.defense).toBe(20);
        f.step(.1);
        expect(target.stats.hp).toBe(9805); // No repeat impact after completion.
    } finally { f.dispose(); }
});

test.each([0, 1, 5])('real impact consumes damage/area training and preserves paid cooldown rank %s', rank => {
    const f = fixture({ FTR_21: rank, FTR_22: rank, FTR_33: rank, FTR_38: rank });
    try {
        const radius = 16 * (1 + .07 * rank);
        expect(getAbilityAoeRadius('Fighter', 'Shattering Charge', f.source)).toBeCloseTo(radius, 8);
        const edge = f.add(20 + radius + .5 - .001), outside = f.add(20 + radius + .5 + .001);
        f.cast();
        expect(f.source.cooldowns['Shattering Charge']).toBeCloseTo(12 * (1 - f.source.stats.cooldownReduction) * (1 - .03 * rank), 8);
        f.step(.4);
        expect(10000 - edge.stats.hp).toBe(Math.trunc(100 * 1.5 * 1.3 * (1 + .06 * rank)));
        expect(edge.armorReduction).toBe(5);
        expect(outside.stats.hp).toBe(10000);
        expect(outside.armorReduction).toBe(0);
    } finally { f.dispose(); }
});

test('clamps long requests to 28 planar units and preserves height', () => {
    const f = fixture();
    try {
        f.cast(100); f.step(1);
        expect(f.source.position.toArray()).toEqual([50028, 7, 50000]);
        expect(f.source.isCharging).toBe(false);
    } finally { f.dispose(); }
});

test.each([false, true])('dungeon wall clips travel and blocks impact; doorway=%s', doorway => {
    const f = fixture();
    try {
        f.engine.currentDungeonLayout = { walkRects: [
            { x: 50000, z: 50000, width: 20, height: 20 },
            { x: 50021, z: 50000, width: 20, height: 20 },
            ...(doorway ? [{ x: 50010.5, z: 50000, width: 3, height: 4 }] : [])
        ] };
        const target = f.add(20);
        f.cast(); f.step(1);
        expect(f.source.position.x).toBe(doorway ? 50020 : 50010);
        expect(target.stats.hp < 10000).toBe(doorway);
        expect(target.armorReduction).toBe(doorway ? 5 : 0);
    } finally { f.dispose(); }
});

test.each(['friendly', 'remote', 'multiplayer', 'engine', 'dead', 'inactive', 'other-instance'])(
    '%s recipient receives neither damage nor armor break', kind => {
        const f = fixture();
        try {
            const target = f.add(20);
            if (kind === 'friendly') target.hostile = false;
            if (kind === 'remote') target.isRemote = true;
            if (kind === 'multiplayer') target.isMultiplayer = true;
            if (kind === 'engine') target.gameEngine = { isMultiplayer: true };
            if (kind === 'dead') target.state = 'DEAD';
            if (kind === 'inactive') target.isActive = false;
            if (kind === 'other-instance') target.gameEngine = { currentInstanceId: 'other-dungeon' };
            f.cast(); f.step(1);
            expect(target.stats.hp).toBe(10000);
            expect(target.armorReduction).toBe(0);
        } finally { f.dispose(); }
    });

test.each(['locked', 'mana', 'cooldown', 'stun', 'dead', 'remote', 'multiplayer'])(
    'rejected or authoritative %s cast cannot start offline travel/impact', kind => {
        const f = fixture();
        try {
            const target = f.add(20);
            if (kind === 'locked') f.source.unlockedSkills = [];
            if (kind === 'mana') f.source.stats.mana = 0;
            if (kind === 'cooldown') f.source.cooldowns['Shattering Charge'] = 10;
            if (kind === 'stun') f.source.stunTimer = 10;
            if (kind === 'dead') f.source.state = 'DEAD';
            if (kind === 'remote') f.source.isRemote = true;
            if (kind === 'multiplayer') f.engine.isMultiplayer = true;
            const mana = f.source.stats.mana;
            f.cast();
            expect(f.source.isCharging).toBe(false);
            expect(target.armorReduction).toBe(0);
            expect(target.stats.hp).toBe(10000);
            if (kind !== 'multiplayer') expect(f.source.stats.mana).toBe(mana);
        } finally { f.dispose(); }
    });

test('death cancels a paid charge without a delayed armor-break impact', () => {
    const f = fixture();
    try {
        const target = f.add(20);
        f.cast(); f.step(.1); f.source.die(); f.step(1);
        expect(f.source.isCharging).toBe(false);
        expect(f.source.shatteringArmorDuration).toBe(0);
        expect(target.stats.hp).toBe(10000);
        expect(target.armorReduction).toBe(0);
    } finally { f.dispose(); }
});

test('travel ticks recipient debuffs once and pauses while stunned', () => {
    const f = fixture();
    try {
        const target = f.add(20);
        f.source.armorReduction = 5; f.source.armorReductionTimer = .05;
        f.cast(); f.step(.1);
        expect(f.source.armorReduction).toBe(0);
        expect(f.source.position.x).toBe(50005);
        f.source.stunTimer = 1;
        const cooldown = f.source.cooldowns['Shattering Charge'];
        f.step(.5);
        expect(f.source.stunTimer).toBe(.5);
        expect(f.source.position.x).toBe(50005);
        expect(f.source.cooldowns['Shattering Charge']).toBeCloseTo(cooldown - .5, 8);
        expect(target.armorReduction).toBe(0);
        f.step(.5);
        expect(f.source.isCharging).toBe(false);
        expect(target.armorReduction).toBe(5);
    } finally { f.dispose(); }
});

test('real impact damage uses current training, then one critical and recipient shield', () => {
    const f = fixture({ FTR_30: 5, FTR_37: 5 });
    try {
        const target = f.add(20);
        target.shieldHP = 50;
        f.cast(); f.step(.1);
        f.source.talentRanks = { FTR_21: 5, FTR_38: 5 };
        f.source.stats.damage = 200; f.source.stats.critChanceBonus = 1;
        f.step(.3);
        expect(10000 - target.stats.hp).toBe(Math.trunc(200 * 1.5 * 1.3 * 1.3) * 2 - 50);
        expect(target.shieldHP).toBe(0);
        expect(target.armorReductionTimer).toBeCloseTo(6.75, 8);
    } finally { f.dispose(); }
});

test('scene changes during travel cancel the pending impact', () => {
    const f = fixture();
    try {
        const target = f.add(20);
        f.cast(); f.step(.1);
        f.engine.currentInstanceId = 'town';
        f.step(1);
        expect(f.source.isCharging).toBe(false);
        expect(target.stats.hp).toBe(10000);
        expect(target.armorReduction).toBe(0);
    } finally { f.dispose(); }
});

test('a second ability cannot spend mana or replace a paid charge during travel', () => {
    const f = fixture();
    try {
        const target = f.add(20);
        f.source.unlockedSkills.push('Shield Slam');
        f.cast(); f.step(.1);
        const mana = f.source.stats.mana;
        expect(f.source.useAbility(target.position.clone(), f.engine, 'Shield Slam')).toBe(false);
        expect(f.source.stats.mana).toBe(mana);
        expect(f.source.cooldowns['Shield Slam'] || 0).toBe(0);
        f.step(.3);
        expect(target.armorReduction).toBe(5);
    } finally { f.dispose(); }
});

test('town movement recovery cannot leak a cancelled shattering effect into ordinary Charge', () => {
    const f = fixture();
    try {
        f.cast(); f.step(.1);
        f.source.isCharging = false; // Existing town/recovery shared movement reset.
        f.source.state = 'IDLE';
        f.source.useAbility(f.source.position.clone(), f.engine, 'Charge');
        expect(f.source.isShatteringCharge).toBe(false);
        expect(f.source.shatteringArmorDuration).toBe(0);
        expect(f.source.shatteringInstanceId).toBe(null);
    } finally { f.dispose(); }
});
