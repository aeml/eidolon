import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { Wizard } from '../src/entities/Wizard.js';
import { applyOfflineStatus } from '../src/core/OfflineDamageOverTime.js';

function fixture(rune = 'teleport_phase') {
    const source = new Wizard('phase-caster'); source.mesh = new THREE.Group();
    source.level = 100; source.position.set(0, 0, 0);
    source.unlockedSkills.push('Teleport'); source.skillRunes = { Teleport: rune };
    Object.assign(source.stats, { hp: 500, maxHp: 500, mana: 200, hpRegen: 0, manaRegen: 0 });
    const engine = { currentInstanceId: '', spawnTransientEffect: jest.fn(() => true),
        chunkManager: { getActiveEntities: () => [] }, floatingTextManager: { spawn: jest.fn() } };
    const cast = () => source.useAbility(new THREE.Vector3(5, 0, 0), engine, 'Teleport');
    return { source, engine, cast };
}

test.each([[0, 1], [5, 1.2], [99, 1.2], [-1, 1], [Infinity, 1]])(
    'paid Phase rank%s protects real HP and shield until the %ss deadline', (rank, duration) => {
        const f = fixture();
        try {
            f.source.talentRanks = { WIZ_34: rank }; f.source.shieldHP = 40;
            f.cast();
            expect(f.source.stats.mana).toBe(160);
            expect(f.source.teleportPhaseTimer).toBeCloseTo(duration);
            f.source.takeDamage(100);
            expect(f.source.stats.hp).toBe(500); expect(f.source.shieldHP).toBe(40);
            Actor.prototype.update.call(f.source, duration + .01, null, null, []);
            expect(f.source.teleportPhaseTimer).toBe(0);
            f.source.takeDamage(100);
            expect(f.source.stats.hp).toBe(440); expect(f.source.shieldHP).toBe(0);
        } finally { f.source.dispose(); }
    }
);

test('stun cannot prolong Phase and blocked damage cannot trigger reflection', () => {
    const f = fixture(); const attacker = new Actor('attacker', {});
    try {
        jest.spyOn(attacker, 'takeDamage'); f.source.hasThornsEffect = true;
        f.cast(); f.source.takeDamage(100, attacker);
        expect(attacker.takeDamage).not.toHaveBeenCalled();
        f.source.stunTimer = 10;
        Actor.prototype.update.call(f.source, 1.1, null, null, []);
        expect(f.source.teleportPhaseTimer).toBe(0); expect(f.source.stunTimer).toBeGreaterThan(0);
        f.source.takeDamage(100, attacker);
        expect(f.source.stats.hp).toBe(400); expect(attacker.takeDamage).toHaveBeenCalledWith(10, null);
    } finally { f.source.dispose(); attacker.dispose(); }
});

test.each(['', 'teleport_blink', 'teleport_warp'])('%s does not grant Phase immunity', rune => {
    const f = fixture(rune);
    try { f.cast(); f.source.takeDamage(100); expect(f.source.stats.hp).toBe(400); }
    finally { f.source.dispose(); }
});

test.each(['locked', 'mana', 'cooldown', 'remote', 'multiplayer', 'engine', 'owner-engine'])('%s cannot grant offline Phase', mode => {
    const f = fixture();
    try {
        if (mode === 'locked') f.source.unlockedSkills = [];
        if (mode === 'mana') f.source.stats.mana = 39;
        if (mode === 'cooldown') f.source.cooldowns.Teleport = 1;
        if (mode === 'remote') f.source.isRemote = true;
        if (mode === 'multiplayer') f.source.isMultiplayer = true;
        if (mode === 'engine') f.engine.isMultiplayer = true;
        if (mode === 'owner-engine') f.source.gameEngine = { isMultiplayer: true };
        f.cast(); expect(f.source.teleportPhaseTimer || 0).toBe(0);
    } finally { f.source.dispose(); }
});

test('death and explicit respawn cannot carry an old Phase window into a new life', () => {
    const f = fixture();
    try {
        f.cast(); f.source.die(); expect(f.source.teleportPhaseTimer || 0).toBe(0);
        f.source.teleportPhaseTimer = 1; f.source.respawn(0, 0);
        expect(f.source.teleportPhaseTimer).toBe(0);
        f.source.takeDamage(100); expect(f.source.stats.hp).toBe(400);
    } finally { f.source.dispose(); }
});

test.each([[2], [1, 1], [.5, .5, 1]])('periodic ticks use their actual position within the Phase window: %j', (...steps) => {
    const f = fixture(); const attacker = new Actor('poison-source', {});
    try {
        f.source.talentRanks = { WIZ_34: 5 }; f.cast();
        applyOfflineStatus(attacker, f.source, 'poison', 25, 5, 'Poison Coating');
        for (const dt of steps) Actor.prototype.update.call(f.source, dt, null, null, []);
        // First tick at1s is protected; second tick at2s is after the1.2s window.
        expect(f.source.stats.hp).toBe(475); expect(f.source.teleportPhaseTimer).toBe(0);
        expect(f.source.poisonTimer).toBe(3);
    } finally { f.source.dispose(); attacker.dispose(); }
});

test('a tick exactly at the untrained Phase deadline is no longer protected', () => {
    const f = fixture(); const attacker = new Actor('poison-source', {});
    try {
        f.cast(); applyOfflineStatus(attacker, f.source, 'poison', 25, 5, 'Poison Coating');
        Actor.prototype.update.call(f.source, 1, null, null, []);
        expect(f.source.stats.hp).toBe(475);
    } finally { f.source.dispose(); attacker.dispose(); }
});
