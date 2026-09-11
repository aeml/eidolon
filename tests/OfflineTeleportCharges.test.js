import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { Wizard } from '../src/entities/Wizard.js';

function fixture(count = 4) {
    const source = new Wizard('charge-caster'); source.mesh = new THREE.Group(); source.level = 100;
    source.unlockedSkills.push('Teleport'); source.abilityName = 'Teleport';
    for (const slot of ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders'].slice(0, count)) {
        source.equipment[slot] = { id: `weave-${slot}`, type: 'ARMOR', slot, level: 30,
            setId: 'temporal_weave', stats: {} };
    }
    source.recalculateStats(); source.stats.mana = source.stats.maxMana;
    source.stats.hpRegen = source.stats.manaRegen = 0;
    const engine = { currentInstanceId: '', spawnTransientEffect: jest.fn(() => true),
        chunkManager: { getActiveEntities: () => [] }, floatingTextManager: { spawn: jest.fn() } };
    const cast = (override = 'Teleport') => source.useAbility(new THREE.Vector3(source.position.x + 2, 0, 0), engine, override);
    return { source, engine, cast };
}

test.each([4, 6])('%s real set pieces permit two paid teleports, then block the third', count => {
    const f = fixture(count);
    try {
        expect(f.source.activeSetBonuses.temporal_weave.count).toBe(count);
        const mana = f.source.stats.mana;
        f.cast(); expect(f.source.cooldowns.Teleport).toBe(0);
        expect(f.source.offlineTeleportCharges).toBe(1);
        const recharge = f.source.offlineTeleportChargeTimer; expect(recharge).toBeGreaterThan(0);
        f.cast(); expect(f.source.stats.mana).toBe(mana - 80);
        expect(f.source.offlineTeleportCharges).toBe(0);
        expect(f.source.cooldowns.Teleport).toBeCloseTo(recharge);
        const x = f.source.position.x; f.cast();
        expect(f.source.stats.mana).toBe(mana - 80); expect(f.source.position.x).toBe(x);
    } finally { f.source.dispose(); }
});

test.each([0, 3])('%s set pieces retain normal single-cast cooldown', count => {
    const f = fixture(count);
    try {
        f.cast(); const mana = f.source.stats.mana, x = f.source.position.x;
        expect(f.source.cooldowns.Teleport).toBeGreaterThan(0);
        f.cast(); expect(f.source.stats.mana).toBe(mana); expect(f.source.position.x).toBe(x);
    } finally { f.source.dispose(); }
});

test.each([false, true])('recharge expiry restores a pair, including while stunned=%s', stunned => {
    const f = fixture();
    try {
        f.cast(); const recharge = f.source.offlineTeleportChargeTimer;
        if (stunned) f.source.stunTimer = recharge + 5;
        Actor.prototype.update.call(f.source, recharge + .01, null, null, []);
        f.source.stunTimer = 0; f.source.stats.mana = f.source.stats.maxMana;
        f.cast(); expect(f.source.offlineTeleportCharges).toBe(1); expect(f.source.cooldowns.Teleport).toBe(0);
        f.cast(); expect(f.source.offlineTeleportCharges).toBe(0); expect(f.source.cooldowns.Teleport).toBeGreaterThan(0);
    } finally { f.source.dispose(); }
});

test('removing the fourth piece cannot grant another instant recharge', () => {
    const f = fixture();
    try {
        f.cast(); delete f.source.equipment.feet; f.source.recalculateStats();
        expect(f.source.activeSetBonuses.temporal_weave.count).toBe(3);
        f.cast(); expect(f.source.cooldowns.Teleport).toBeGreaterThan(0);
        const mana = f.source.stats.mana; f.cast(); expect(f.source.stats.mana).toBe(mana);
    } finally { f.source.dispose(); }
});

test('legacy primary-slot Teleport clears both cooldown gates for the spare charge', () => {
    const f = fixture();
    try {
        const mana = f.source.stats.mana; f.cast(null);
        expect(f.source.cooldowns.Teleport).toBe(0); expect(f.source.abilityCooldown).toBe(0);
        f.cast(null); expect(f.source.stats.mana).toBe(mana - 80); expect(f.source.abilityCooldown).toBeGreaterThan(0);
    } finally { f.source.dispose(); }
});

test('trained mana and recharge apply once, and spending the spare restarts recharge', () => {
    const f = fixture();
    try {
        f.source.talentRanks = { WIZ_20: 5, WIZ_30: 5 };
        const mana = f.source.stats.mana, expected = 12 * .6 * (1 - f.source.stats.cooldownReduction);
        f.cast(); expect(f.source.offlineTeleportChargeTimer).toBeCloseTo(expected);
        Actor.prototype.update.call(f.source, 1, null, null, []);
        expect(f.source.offlineTeleportChargeTimer).toBeCloseTo(expected - 1);
        f.cast(); expect(f.source.stats.mana).toBe(mana - 72);
        expect(f.source.cooldowns.Teleport).toBeCloseTo(expected);
        expect(f.source.offlineTeleportChargeTimer).toBeCloseTo(expected);
    } finally { f.source.dispose(); }
});

test('an unaffordable second cast retains its spare charge and existing recharge', () => {
    const f = fixture();
    try {
        f.cast(); const timer = f.source.offlineTeleportChargeTimer;
        f.source.stats.mana = 0; f.cast();
        expect(f.source.offlineTeleportCharges).toBe(1);
        expect(f.source.offlineTeleportChargeTimer).toBe(timer);
        f.source.stats.mana = 40; f.cast();
        expect(f.source.offlineTeleportCharges).toBe(0); expect(f.source.stats.mana).toBe(0);
    } finally { f.source.dispose(); }
});

test.each(['mana', 'locked', 'stunned', 'dead', 'multiplayer', 'remote', 'engine'])('%s cast cannot consume offline charges', mode => {
    const f = fixture();
    try {
        if (mode === 'mana') f.source.stats.mana = 0;
        if (mode === 'locked') f.source.unlockedSkills = [];
        if (mode === 'stunned') f.source.stunTimer = 1;
        if (mode === 'dead') f.source.state = 'DEAD';
        if (mode === 'multiplayer') f.source.isMultiplayer = true;
        if (mode === 'remote') f.source.isRemote = true;
        if (mode === 'engine') f.engine.isMultiplayer = true;
        f.cast(); expect(f.source.offlineTeleportCharges || 0).toBe(0);
        expect(f.source.offlineTeleportChargeTimer || 0).toBe(0);
    } finally { f.source.dispose(); }
});
