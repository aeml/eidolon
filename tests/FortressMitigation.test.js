import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { applyOfflineFighterDamageBuffStats } from '../src/skills/offlineFighterDamageBuffs.js';

afterEach(() => jest.restoreAllMocks());
test.each([5, 100])('paid Fortress uses the same20%% reduction at Strength%s', strength => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const p = new Fighter('fortress-paid');
    try {
        p.mesh = new THREE.Group();
        p.baseStats.intelligence = 30;
        p.recalculateStats();
        p.stats.strength = strength;
        p.stats.mana = 200;
        p.unlockedSkills.push('Iron Fortress');
        const engine = { spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() } };
        p.useAbility(p.position.clone(), engine, 'Iron Fortress');
        expect(p.stats.mana).toBe(160);
        expect(p.ironFortressReduction).toBe(.2);
        p.stats.hp = p.stats.maxHp = 1000;
        p.takeDamage(100);
        expect(p.stats.hp).toBe(920);
    } finally { p.dispose(); }
});
test('Fortress rebuilds armor and speed once across equipment changes and expiry', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const p = new Fighter('fortress-stats');
    try {
        p.mesh = new THREE.Group(); p.baseStats.intelligence = 30;
        p.equipment.chest = { stats: { defense: 10 } };
        p.recalculateStats();
        const speed = p.stats.speed;
        p.stats.mana = 200; p.unlockedSkills.push('Iron Fortress');
        p.useAbility(p.position.clone(), { spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() } }, 'Iron Fortress');
        expect(p.stats.defense).toBe(15); expect(p.stats.speed).toBeCloseTo(speed * .8);
        p.equipment.chest.stats.defense = 20;
        p.recalculateStats(); p.recalculateStats();
        expect(p.stats.defense).toBe(30); expect(p.stats.speed).toBeCloseTo(speed * .8);
        p.stunTimer = 31;
        p.update(30, null, null, null, null);
        expect(p.ironFortressTimer).toBe(0);
        expect(p.stats.defense).toBe(20); expect(p.stats.speed).toBeCloseTo(speed);
    } finally { p.dispose(); }
});
test.each([
    [1, 0, 0, 920, 0], [1, 1, 0, 900, 0], [0, 0, 0, 900, 0],
    [1, 0, 50, 970, 0], [1, 0, 100, 1000, 20]
])('Fortress expiry and receiving shield order: timer%s elapsed%s shield%s', (timer, elapsed, shield, hp, remaining) => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const p = new Fighter('fortress-order');
    try {
        p.ironFortressTimer = timer; p.ironFortressReduction = .2;
        p.stats.hp = p.stats.maxHp = 1000; p.shieldHP = shield;
        p.takeDamage(100, null, elapsed);
        expect(p.stats.hp).toBe(hp); expect(p.shieldHP).toBe(remaining);
    } finally { p.dispose(); }
});
test('slow-frame periodic impacts respect Fortress expiry instead of losing earlier protection', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const p = new Fighter('fortress-ticks');
    try {
        p.baseStats.vitality = 100; p.recalculateStats();
        p.stats.hp = p.stats.maxHp;
        p.ironFortressTimer = 1.5; p.ironFortressReduction = .2;
        p.bleedTimer = 2; p.bleedTickTimer = 0; p.bleedTickDamage = 100;
        p.stunTimer = 3;
        const original = p.takeDamage.bind(p), impacts = [];
        jest.spyOn(p, 'takeDamage').mockImplementation((...args) => {
            const hp = p.stats.hp; original(...args); impacts.push(hp - p.stats.hp);
        });
        p.update(2, null, null, null, null);
        expect(impacts).toEqual([80, 100]);
        expect(p.ironFortressTimer).toBe(0);
    } finally { p.dispose(); }
});
test.each([{ isMultiplayer: true }, { isRemote: true }, { gameEngine: { isMultiplayer: true } }])(
    'replicated Fortress never modifies authoritative health or derived stats: %j', flags => {
        const p = new Fighter('replicated-fortress');
        try {
            Object.assign(p, flags); p.ironFortressTimer = 10;
            p.stats.hp = 100; p.stats.defense = 20; p.stats.speed = 10;
            applyOfflineFighterDamageBuffStats(p); p.takeDamage(100);
            expect(p.stats).toMatchObject({ hp: 100, defense: 20, speed: 10 });
        } finally { p.dispose(); }
    });
