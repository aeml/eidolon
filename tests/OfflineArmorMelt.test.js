import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Rogue } from '../src/entities/Rogue.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Imp } from '../src/entities/Imp.js';
import { getOfflineBasicAttackArmor, getOfflineEffectiveArmor } from '../src/core/OfflineArmor.js';

beforeEach(() => jest.spyOn(Math, 'random').mockReturnValue(.5));
afterEach(() => jest.restoreAllMocks());

function fixture() {
    const wizard = new Wizard('armor-wizard'), target = new Imp('armor-target');
    wizard.mesh = new THREE.Group();
    wizard.stats.mana = 1000;
    wizard.unlockedSkills.push('Scorch Beam');
    target.mesh = new THREE.Group(); target.mesh.rotation.y = Math.PI;
    target.position.set(0, 0, 4);
    target.stats.hp = target.stats.maxHp = 10000;
    target.stats.defense = 20; target.stats.hpRegen = 0;
    const engine = { isMultiplayer: false, chunkManager: { getActiveEntities: () => [target] },
        isHostileActorTarget: entity => entity === target,
        floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true) };
    return { wizard, target, engine,
        cast: () => wizard.useAbility(target.position.clone(), engine, 'Scorch Beam'),
        dispose: () => { wizard.dispose(); target.dispose(); } };
}

test.each([[0, 5], [1, 5.2], [5, 6]])('paid Scorch Beam keeps base armor and expires with duration rank %s', (rank, duration) => {
    const f = fixture();
    try {
        f.wizard.talentRanks = { WIZ_34: rank };
        f.cast();
        expect(f.wizard.stats.mana).toBeLessThan(1000);
        expect(f.target.stats.hp).toBeLessThan(10000);
        expect(f.target.stats.defense).toBe(20);
        expect(f.target.armorReduction).toBe(5);
        expect(f.target.armorReductionTimer).toBeCloseTo(duration, 8);
        f.target.stunTimer = duration + 5;
        Actor.prototype.update.call(f.target, duration / 2, null, null, f.engine.chunkManager);
        expect(f.target.armorReductionTimer).toBeCloseTo(duration / 2, 8);
        expect(f.target.armorReduction).toBe(5);
        Actor.prototype.update.call(f.target, duration / 2, null, null, f.engine.chunkManager);
        expect(f.target.armorReductionTimer).toBe(0);
        expect(f.target.armorReduction).toBe(0);
        expect(f.target.stats.defense).toBe(20);
        expect(f.target.stunTimer).toBe(5);
    } finally { f.dispose(); }
});

test('another paid beam refreshes instead of stacking or overwriting recalculated equipment armor', () => {
    const f = fixture(), second = new Wizard('second-armor-wizard');
    try {
        f.cast();
        f.target.stunTimer = 20;
        Actor.prototype.update.call(f.target, 2, null, null, f.engine.chunkManager);
        second.mesh = new THREE.Group(); second.stats.mana = 1000;
        second.unlockedSkills.push('Scorch Beam');
        second.useAbility(f.target.position.clone(), f.engine, 'Scorch Beam');
        expect(second.stats.mana).toBeLessThan(1000);
        expect(f.target.armorReduction).toBe(5);
        expect(f.target.armorReductionTimer).toBe(5);
        f.target.equipment = { mainHand: { level: 1, stats: { defense: 40 } } };
        f.target.recalculateStats();
        expect(f.target.stats.defense).toBe(40);
        Actor.prototype.update.call(f.target, 5, null, null, f.engine.chunkManager);
        expect(f.target.armorReduction).toBe(0);
        expect(f.target.stats.defense).toBe(40);
    } finally { f.dispose(); second.dispose(); }
});

test.each(['isRemote', 'isMultiplayer', 'engine', 'dead', 'inactive'])('beam cannot alter %s recipient armor', kind => {
    const f = fixture();
    try {
        if (kind === 'engine') f.target.gameEngine = { isMultiplayer: true };
        else if (kind === 'dead') f.target.state = 'DEAD';
        else if (kind === 'inactive') f.target.isActive = false;
        else f.target[kind] = true;
        f.cast();
        expect(f.target.stats.defense).toBe(20);
        expect(f.target.armorReduction || 0).toBe(0);
        expect(f.target.armorReductionTimer || 0).toBe(0);
    } finally { f.dispose(); }
});

test.each([false, true])('paid Backstab uses active armor melt before Eviscerate=%s', eviscerate => {
    const f = fixture(), rogue = new Rogue('armor-rogue');
    try {
        f.cast();
        rogue.mesh = new THREE.Group(); rogue.position.z = 2;
        rogue.stats.damage = 100; rogue.stats.mana = 1000;
        rogue.unlockedSkills.push('Backstab');
        if (eviscerate) rogue.skillRunes = { Backstab: 'backstab_eviscerate' };
        const before = f.target.stats.hp;
        rogue.useAbility(f.target.position.clone(), f.engine, 'Backstab');
        expect(rogue.stats.mana).toBeLessThan(1000);
        expect(before - f.target.stats.hp).toBe(150 - (eviscerate ? 8 : 15));
    } finally { f.dispose(); rogue.dispose(); }
});

test.each([[20, false, 80], [20, true, 85], [3, true, 100], [200, false, 1]])(
    'actual basic impact uses armor %s, melt=%s, expected=%s', (armor, melt, expected) => {
        const f = fixture(), fighter = new Fighter('armor-fighter');
        try {
            f.target.stats.defense = armor;
            if (melt) f.cast();
            fighter.stats.damage = 100; fighter.lastAttackTime = 0;
            const callbacks = [];
            fighter.scheduleTask = callback => { callbacks.push(callback); return callbacks.length; };
            const before = f.target.stats.hp;
            expect(fighter.attack(f.target)).toBe(true);
            expect(f.target.stats.hp).toBe(before);
            callbacks[0]();
            expect(before - f.target.stats.hp).toBe(expected);
        } finally { f.dispose(); fighter.dispose(); }
    });

test.each([false, true])('wind-up uses armor at impact, expired=%s, before critical and shield absorption', expired => {
    const f = fixture(), fighter = new Fighter('armor-critical-fighter');
    try {
        f.cast();
        fighter.stats.damage = 100; fighter.stats.critChanceBonus = 1; fighter.lastAttackTime = 0;
        f.target.shieldHP = 50;
        const callbacks = [];
        fighter.scheduleTask = callback => { callbacks.push(callback); return callbacks.length; };
        expect(fighter.attack(f.target)).toBe(true);
        if (expired) {
            f.target.stunTimer = 10;
            Actor.prototype.update.call(f.target, 5, null, null, f.engine.chunkManager);
        }
        const before = f.target.stats.hp;
        callbacks[0]();
        expect(before - f.target.stats.hp).toBe((expired ? 80 : 85) * 2 - 50);
        expect(f.target.shieldHP).toBe(0);
    } finally { f.dispose(); fighter.dispose(); }
});

test.each(['InfernoTitan', 'Siren', 'FrostGuardian', 'MountainTroll', 'AquaGolem',
    'RootboundWarden', 'BriarMatron', 'RustboundColossus', 'HollowSentinel', 'AvengingSeraph'])(
    '%s halves remaining armor after flat melt with server integer rounding', meshType => {
        const target = { stats: { defense: 20 }, armorReduction: 5, armorReductionTimer: 5 };
        expect(getOfflineBasicAttackArmor({ meshType }, target)).toBe(7);
        target.armorReductionTimer = 0;
        expect(getOfflineBasicAttackArmor({ meshType }, target)).toBe(10);
    });

test.each([NaN, Infinity, -20])('invalid armor %s cannot poison damage', defense => {
    expect(getOfflineEffectiveArmor({ stats: { defense } })).toBe(0);
});

test('low variance cannot round an armor-reduced basic hit below the server minimum', () => {
    const f = fixture(), fighter = new Fighter('minimum-armor-fighter');
    try {
        Math.random.mockReturnValue(0);
        fighter.stats.damage = 1; fighter.stats.critChanceBonus = 0; fighter.lastAttackTime = 0;
        const callbacks = [];
        fighter.scheduleTask = callback => { callbacks.push(callback); return callbacks.length; };
        const before = f.target.stats.hp;
        expect(fighter.attack(f.target)).toBe(true);
        callbacks[0]();
        expect(before - f.target.stats.hp).toBe(1);
    } finally { f.dispose(); fighter.dispose(); }
});
