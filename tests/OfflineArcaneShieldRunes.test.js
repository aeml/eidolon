import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Wizard } from '../src/entities/Wizard.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Imp } from '../src/entities/Imp.js';
import { Actor } from '../src/entities/Actor.js';
import { compileRockSolids } from '../src/core/RockCollision.js';

const cases = JSON.parse(readFileSync('server/internal/game/testdata/arcane_shield_runes.json', 'utf8'));
function fixture(rune = 'arcaneshield_explosive', ranks = {}) {
    const owner = new Wizard('shield-owner'), enemy = new Imp('shield-attacker');
    owner.mesh = new THREE.Group();owner.level = 100;
    Object.assign(owner.stats, { intelligence: 10, mana: 1000, maxMana: 1000, hp: 1000, maxHp: 1000, hpRegen: 0, manaRegen: 0, cooldownReduction: 0 });
    owner.unlockedSkills = ['Arcane Shield', 'Spell Focus'];owner.skillRunes = { 'Arcane Shield': rune };owner.talentRanks = { ...ranks };
    enemy.stats.hp = enemy.stats.maxHp = 1000;enemy.position.set(1, 0, 0);
    const actors = [owner, enemy], hostiles = new Set([enemy]);
    const engine = { currentInstanceId: '', isMultiplayer: false, chunkManager: { getActiveEntities: () => actors },
        isHostileActorTarget: target => hostiles.has(target), spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() } };
    owner.gameEngine = enemy.gameEngine = engine;
    return { owner, enemy, engine, actors, hostiles,
        cast: (skill = 'Arcane Shield') => owner.useAbility(owner.position.clone(), engine, skill),
        dispose() { for (const actor of actors) actor.dispose?.(); } };
}
beforeEach(() => { jest.spyOn(console, 'log').mockImplementation(() => {});jest.spyOn(Math, 'random').mockReturnValue(.5); });
afterEach(() => jest.restoreAllMocks());

test.each(cases)('actual paid shield matches authoritative rune contract: $name', row => {
    const f = fixture(row.rune, row.ranks);
    try {
        f.cast();expect(f.owner.stats.mana).toBe(960);expect(f.owner.cooldowns['Arcane Shield']).toBe(30);
        f.owner.skillRunes = {};f.owner.talentRanks = {};f.owner.stats.critChanceBonus = 1;f.owner.hasLuckyEffect = true;
        for (const hit of row.hits) f.owner.takeDamage(hit, f.enemy);
        expect(f.owner.shieldHP).toBe(row.shield);expect(f.owner.arcaneShieldAbsorbed).toBe(row.absorbed);
        expect(f.owner.arcaneShieldActive).toBe(row.active);expect(f.owner.stats.hp).toBe(row.ownerHP);expect(f.enemy.stats.hp).toBe(row.enemyHP);
        if (!row.active) expect(f.owner.arcaneShieldRuneId).toBe('');
    } finally { f.dispose(); }
});

test('reflection retains only Fortress/Roar defense and cannot recurse through shields, phase, marks or death saves', () => {
    const f = fixture('arcaneshield_reflective'), attacker = new Fighter('reflect-receiver');
    try {
        attacker.gameEngine = f.engine;f.actors.push(attacker);attacker.stats.hp = attacker.stats.maxHp = 1000;
        attacker.ironFortressTimer = attacker.guardianRoarTimer = attacker.teleportPhaseTimer = 10;
        attacker.markWeaknessTimer = 10;attacker.markWeaknessFactor = 2;attacker.shieldHP = 500;
        attacker.divineInterventionGuardianTimer = 10;attacker.divineInterventionActive = true;attacker.hasThornsEffect = true;
        f.cast();f.owner.takeDamage(100, attacker);
        expect(attacker.stats.hp).toBe(984);expect(attacker.shieldHP).toBe(500);expect(f.owner.shieldHP).toBe(50);
        attacker.stats.hp = 1;f.owner.takeDamage(50, attacker);
        expect(attacker.state).toBe('DEAD');expect(attacker.divineInterventionActive).toBe(true);
    } finally { f.dispose(); }
});

test('explosion uses current receiving defenses without rerolling outgoing or vulnerability', () => {
    const f = fixture();
    try {
        f.cast();f.enemy.shieldHP = 40;f.enemy.guardianRoarTimer = 10;f.enemy.divineInterventionGuardianTimer = 10;
        f.enemy.markWeaknessTimer = 10;f.enemy.markWeaknessFactor = 4;
        f.owner.stats.critChanceBonus = 1;f.owner.hasLuckyEffect = true;
        f.owner.takeDamage(200, f.enemy);
        // 150 stored -> Roar105 -> Guardian52 -> remaining shield40 -> HP12.
        expect(f.enemy.stats.hp).toBe(988);expect(f.enemy.shieldHP).toBe(0);
        expect(f.engine.spawnTransientEffect).toHaveBeenCalledWith('ring', expect.any(THREE.Vector3), 0x4da6ff,
            expect.objectContaining({ radius: 6, abilityName: 'Arcane Shield' }));
        f.owner.takeDamage(100, f.enemy);expect(f.enemy.stats.hp).toBe(988);
    } finally { f.dispose(); }
});

test.each(['phase', 'dead', 'remote', 'multiplayer', 'foreign-instance', 'friendly', 'outside', 'not-actor'])('explosion excludes %s recipients', kind => {
    const f = fixture();
    try {
        const target = kind === 'not-actor' ? { isActive: true, stats: { hp: 1000 }, position: new THREE.Vector3(2, 0, 0), takeDamage: jest.fn() } : new Imp('excluded-recipient');
        if (target instanceof Actor) { target.stats.hp = target.stats.maxHp = 1000;target.position.set(2, 0, 0);target.gameEngine = f.engine; }
        f.actors.push(target);f.hostiles.add(target);
        if (kind === 'phase') target.teleportPhaseTimer = 10;
        if (kind === 'dead') target.state = 'DEAD';
        if (kind === 'remote') target.isRemote = true;
        if (kind === 'multiplayer') target.isMultiplayer = true;
        if (kind === 'foreign-instance') target.instanceId = 'another-dungeon';
        if (kind === 'friendly') f.hostiles.delete(target);
        if (kind === 'outside') target.position.set(7.01, 0, 0);
        f.cast();f.owner.takeDamage(200, f.enemy);expect(target.stats.hp).toBe(1000);
        if (kind === 'not-actor') expect(target.takeDamage).not.toHaveBeenCalled();
    } finally { f.dispose(); }
});

test.each([false, true])('explosion body edge and dungeon cover; doorway=%s', doorway => {
    const f = fixture();
    try {
        f.engine.currentInstanceId = 'shield-cover';f.engine.currentInstanceType = 'dungeon';
        f.engine.currentDungeonLayout = { walkRects: [{ x: 0, z: 0, width: 4, height: 20 }, { x: 6, z: 0, width: 4, height: 20 },
            ...(doorway ? [{ x: 3, z: 0, width: 4, height: 6 }] : [])] };
        f.enemy.position.x = 7;f.cast();f.owner.takeDamage(200, f.enemy);
        expect(f.enemy.stats.hp).toBe(doorway ? 850 : 1000);
    } finally { f.dispose(); }
});

test.each(['blocked', 'clear', 'dungeon'])('explosion honors negotiated overworld rock cover: %s', mode => {
    const f = fixture();
    try {
        f.enemy.position.x = 5;
        f.engine.collisionManager = { rockSolids: compileRockSolids([{ id: 'shield-cover', outline: [[2, -2], [3, -2], [3, 2], [2, 2]] }]) };
        if (mode === 'clear') f.enemy.position.set(0, 0, 5);
        if (mode === 'dungeon') f.engine.currentInstanceId = 'another-scene';
        f.cast();f.owner.takeDamage(200, f.enemy);
        expect(f.enemy.stats.hp).toBe(mode === 'blocked' ? 1000 : 850);
    } finally { f.dispose(); }
});

test.each(['expiry-update', 'expiry-impact', 'exact-boundary', 'phase-expiry', 'malformed', 'death', 'dispose', 'cancel'])('%s clears absorbed history without detonating', mode => {
    const f = fixture();
    try {
        f.cast();f.owner.takeDamage(50, f.enemy);expect(f.owner.arcaneShieldAbsorbed).toBe(50);
        if (mode === 'expiry-update') f.owner.update(20, null, null, null, null);
        if (mode === 'expiry-impact') { f.owner.arcaneShieldTimer = -.01;f.owner.takeDamage(200, f.enemy); }
        if (mode === 'exact-boundary') { f.owner.arcaneShieldTimer = .5;f.owner.takeDamage(200, f.enemy, .5); }
        if (mode === 'phase-expiry') { f.owner.arcaneShieldTimer = 0;f.owner.teleportPhaseTimer = 10;f.owner.takeDamage(200, f.enemy); }
        if (mode === 'malformed') { f.owner.arcaneShieldTimer = NaN;f.owner.takeDamage(200, f.enemy); }
        if (mode === 'death') f.owner.die();
        if (mode === 'dispose') f.owner.dispose();
        if (mode === 'cancel') f.owner.cancelAbilities();
        expect(f.owner.arcaneShieldAbsorbed).toBe(0);expect(f.owner.arcaneShieldRuneId).toBe('');expect(f.owner.arcaneShieldEngine).toBeNull();
        expect(f.owner.shieldHP).toBe(0);expect(f.enemy.stats.hp).toBe(1000);
    } finally { f.dispose(); }
});

test('fresh Focus ward clears old rune/history while an existing active ward remains untouched', () => {
    const f = fixture();
    try {
        f.cast();f.owner.takeDamage(50, f.enemy);f.cast('Spell Focus');
        expect(f.owner.shieldHP).toBe(100);expect(f.owner.arcaneShieldAbsorbed).toBe(50);expect(f.owner.arcaneShieldRuneId).toBe('arcaneshield_explosive');
        f.owner.arcaneShieldTimer = 0;f.owner.cooldowns['Spell Focus'] = 0;f.cast('Spell Focus');
        expect(f.owner.shieldHP).toBe(60);expect(f.owner.arcaneShieldAbsorbed).toBe(0);expect(f.owner.arcaneShieldRuneId).toBe('');
        f.owner.takeDamage(100, f.enemy);expect(f.enemy.stats.hp).toBe(1000);
    } finally { f.dispose(); }
});

test('recast replaces absorption history, while a lethal break still flushes its captured explosion', () => {
    const f = fixture();
    try {
        f.cast();f.owner.takeDamage(50, f.enemy);f.owner.cooldowns['Arcane Shield'] = 0;
        f.cast();expect(f.owner.arcaneShieldAbsorbed).toBe(0);expect(f.owner.shieldHP).toBe(150);
        f.owner.stats.hp = 1;f.owner.takeDamage(200, f.enemy);
        expect(f.owner.state).toBe('DEAD');expect(f.enemy.stats.hp).toBe(850);
    } finally { f.dispose(); }
});

test('a death save commits before the depleted shield explosion and does not erase its budget', () => {
    const f = fixture();
    try {
        f.cast();f.owner.stats.hp = 1;f.owner.divineInterventionActive = true;
        const original = f.engine.spawnTransientEffect;
        f.engine.spawnTransientEffect = (...args) => {
            if (args[0] === 'ring') expect(f.owner.stats.hp).toBe(300);
            return original(...args);
        };
        expect(f.owner.takeDamage(200, f.enemy)).toBe(50);
        expect(f.owner.divineInterventionActive).toBe(false);expect(f.enemy.stats.hp).toBe(850);
    } finally { f.dispose(); }
});

test('exploding into another paid explosive shield clears both wards before a finite reaction chain', () => {
    const f = fixture(), other = new Wizard('other-shield');
    try {
        other.mesh = new THREE.Group();other.gameEngine = f.engine;other.position.set(2, 0, 0);
        other.stats.intelligence = 10;other.stats.mana = 1000;other.stats.hp = other.stats.maxHp = 1000;
        other.unlockedSkills = ['Arcane Shield'];other.skillRunes = { 'Arcane Shield': 'arcaneshield_explosive' };
        f.actors.push(other);f.hostiles.add(other);
        f.cast();other.useAbility(other.position.clone(), f.engine, 'Arcane Shield');
        f.owner.takeDamage(200, f.enemy);
        expect(f.owner.shieldHP).toBe(0);expect(other.shieldHP).toBe(0);
        expect(f.owner.arcaneShieldAbsorbed).toBe(0);expect(other.arcaneShieldAbsorbed).toBe(0);
        expect(f.engine.spawnTransientEffect.mock.calls.filter(call => call[0] === 'ring')).toHaveLength(2);
        expect(f.enemy.stats.hp).toBe(700);
    } finally { f.dispose(); }
});

test('a recast during reaction presentation survives the older blast and retains the captured origin', () => {
    const f = fixture();
    try {
        f.cast();const origin = f.owner.position.clone(), original = f.engine.spawnTransientEffect;
        f.engine.spawnTransientEffect = (...args) => {
            if (args[0] === 'ring') {
                expect(args[1].equals(origin)).toBe(true);
                f.owner.position.x = 100;f.owner.cooldowns['Arcane Shield'] = 0;f.cast();
            }
            return original(...args);
        };
        f.owner.takeDamage(200, f.enemy);
        expect(f.enemy.stats.hp).toBe(850);expect(f.owner.shieldHP).toBe(150);expect(f.owner.arcaneShieldActive).toBe(true);
        expect(f.owner.arcaneShieldAbsorbed).toBe(0);
    } finally { f.dispose(); }
});

test.each(['remote-owner', 'multiplayer-owner', 'engine-authority', 'transition', 'dead-attacker', 'foreign-attacker', 'self'])('reflection cannot duplicate invalid authority or targets: %s', mode => {
    const f = fixture('arcaneshield_reflective');
    try {
        f.cast();
        if (mode === 'remote-owner') f.owner.isRemote = true;
        if (mode === 'multiplayer-owner') f.owner.isMultiplayer = true;
        if (mode === 'engine-authority') f.engine.isMultiplayer = true;
        if (mode === 'transition') f.engine.currentInstanceId = 'new-instance';
        if (mode === 'dead-attacker') f.enemy.state = 'DEAD';
        if (mode === 'foreign-attacker') f.enemy.instanceId = 'foreign';
        f.owner.takeDamage(100, mode === 'self' ? f.owner : f.enemy);expect(f.enemy.stats.hp).toBe(1000);
    } finally { f.dispose(); }
});
