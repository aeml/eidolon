import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { Cleric } from '../src/entities/Cleric.js';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';

afterEach(() => jest.restoreAllMocks());

test.each([
    [Cleric, 'Mark of Weakness', 'markWeaknessTimer', 'markWeaknessFactor'],
    [Cleric, "Heaven's Trumpet", 'markWeaknessTimer', 'markWeaknessFactor'],
    [Rogue, 'Weak Point Mark', 'weakPointMarkTimer', null],
    [Rogue, 'Smoke Bomb', 'accuracyReductionTimer', 'accuracyReductionFactor'],
    [Rogue, 'Smoke Bomb', 'slowTimer', 'slowFactor']
])('paid offline %s %s expires %s during a longer stun', (Class, skill, timer, factor) => {
    jest.spyOn(Math, 'random').mockReturnValue(.99);
    const source = new Class('expiry-source'), target = new Imp('expiry-target');
    try {
        source.mesh = new THREE.Group(); target.mesh = new THREE.Group();
        source.stats.mana = 1000; source.stats.wisdom = 50; source.stats.critChanceBonus = 0;
        source.unlockedSkills.push(skill);
        target.position.set(0, 0, 2);
        target.stats.hp = target.stats.maxHp = 10000; target.stats.hpRegen = 0;
        const engine = { isMultiplayer: false, chunkManager: { getActiveEntities: () => [target] },
            floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true),
            isHostileActorTarget: entity => entity === target };
        source.useAbility(target.position.clone(), engine, skill);
        expect(source.stats.mana).toBeLessThan(1000);
        const duration = target[timer];
        expect(duration).toBeGreaterThan(0);
        target.stunTimer = duration+5;
        Actor.prototype.update.call(target, duration/2, null, null, engine.chunkManager);
        expect(target[timer]).toBeCloseTo(duration/2, 8);
        Actor.prototype.update.call(target, duration/2, null, null, engine.chunkManager);
        expect(target.stunTimer).toBe(5);
        expect(target[timer]).toBe(0);
        if (factor) expect(target[factor]).toBe(0);
        if (timer === 'markWeaknessTimer') {
            const before = target.stats.hp;
            target.takeDamage(100, source);
            expect(target.stats.hp).toBe(before-100);
        }
    } finally { source.dispose(); target.dispose(); }
});

test.each([false, true])('root and healing penalty tick once per update, stunned=%s', stunned => {
    const target = new Actor('timed-recipient', {});
    try {
        target.rootTimer = target.healingReductionTimer = 2;
        target.healingReductionFactor = .5;
        target.stunTimer = stunned ? 10 : 0;
        target.update(1, null, null, null);
        expect(target.rootTimer).toBe(1);
        expect(target.healingReductionTimer).toBe(1);
        expect(target.healingReductionFactor).toBe(.5);
        target.update(1, null, null, null);
        expect(target.rootTimer).toBe(0);
        expect(target.healingReductionTimer).toBe(0);
        expect(target.healingReductionFactor).toBe(0);
        target.update(1, null, null, null);
        expect(target.rootTimer).toBe(0);
        expect(target.healingReductionTimer).toBe(0);
    } finally { target.dispose(); }
});

test.each([false, true])('ordinary cooldowns continue exactly once while stunned, multiplayer prediction=%s', multiplayer => {
    const target = new Actor('cooldown-recipient', {});
    try {
        target.isMultiplayer = multiplayer;
        target.stunTimer = 10; target.abilityCooldown = 1;
        target.cooldowns = { Fireball: 1, Teleport: 3 };
        target.update(.5, null, null, null);
        expect(target.abilityCooldown).toBe(.5);
        expect(target.cooldowns).toEqual({ Fireball: .5, Teleport: 2.5 });
        target.update(1, null, null, null);
        expect(target.abilityCooldown).toBe(0);
        expect(target.cooldowns).toEqual({ Fireball: 0, Teleport: 1.5 });
    } finally { target.dispose(); }
});

test('remote actors do not locally count down authoritative cooldowns', () => {
    const target = new Actor('remote-cooldown-recipient', {});
    try {
        target.isRemote = true; target.stunTimer = 10;
        target.abilityCooldown = 1; target.cooldowns = { Fireball: 1 };
        target.update(.5, null, null, null);
        expect(target.abilityCooldown).toBe(1);
        expect(target.cooldowns.Fireball).toBe(1);
    } finally { target.dispose(); }
});
