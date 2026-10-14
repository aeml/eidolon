import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Wizard } from '../src/entities/Wizard.js';
import { Imp } from '../src/entities/Imp.js';
import { Actor } from '../src/entities/Actor.js';
import { compileRockSolids } from '../src/core/RockCollision.js';
import { clipDungeonEffectSegment } from '../src/skills/dungeonEffectGeometry.js';

const contract = JSON.parse(readFileSync('server/internal/game/testdata/meteor_runes.json', 'utf8'));
function fixture(rune = '', ranks = {}, intelligence = 1) {
    const owner = new Wizard('meteor-caster'), target = new Imp('meteor-victim');
    owner.mesh = new THREE.Group();owner.level = 100;owner.stats.mana = owner.stats.maxMana = 1000;owner.stats.intelligence = intelligence;
    owner.stats.cooldownReduction = 0;owner.skillRunes = { 'Meteor Drop': rune };owner.talentRanks = { ...ranks };
    owner.unlockedSkills = ['Fireball', 'Meteor Drop', 'Spell Focus'];
    target.stats.hp = target.stats.maxHp = 10000;target.position.set(10, 0, 0);
    const projectiles = [], actors = [owner, target], engine = { player: owner, currentInstanceId: '', isMultiplayer: false,
        chunkManager: { getActiveEntities: () => actors }, addEntity: p => projectiles.push(p),
        isHostileActorTarget: actor => actor !== owner, spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() } };
    owner.gameEngine = target.gameEngine = engine;
    return { owner, target, engine, projectiles, actors,
        cast: (skill = 'Meteor Drop') => owner.useAbility(target.position.clone(), engine, skill),
        impact(p) { p.update(3, null, owner, engine.chunkManager, engine.floatingTextManager, engine); },
        dispose() { owner.dispose();for (const p of projectiles) p.dispose();for (const actor of actors) if (actor !== owner) actor.dispose?.(); } };
}
beforeEach(() => { jest.useFakeTimers();jest.spyOn(Math, 'random').mockReturnValue(.5);jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks();jest.useRealTimers(); });

test.each(contract)('paid Meteor matches authoritative contract: $name', row => {
    const f = fixture(row.rune, row.ranks, row.intelligence);
    try {
        f.cast();expect(f.owner.stats.mana).toBe(940);expect(f.owner.cooldowns['Meteor Drop']).toBe(15);
        f.owner.talentRanks = {};f.owner.skillRunes = {};f.owner.stats.intelligence = 1000;
        if (row.count === 6) {
            expect(f.projectiles).toHaveLength(1);
            for (let i = 1; i <= 5; i++) { jest.advanceTimersByTime(1000);expect(f.projectiles).toHaveLength(i + 1); }
        }
        expect(f.projectiles).toHaveLength(row.count);
        const warnings = f.engine.spawnTransientEffect.mock.calls.filter(c => c[0] === 'telegraph');
        expect(warnings).toHaveLength(row.count);
        f.projectiles.forEach((p, i) => {
            const extra = row.count === 6 && i > 0, radius = row.radius * (extra ? .7 : 1);
            const damage = extra ? Math.trunc(row.damage / 2) : row.damage;
            const delay = row.count === 3 ? 1.5 + i * .2 : 1.5;
            expect(p.damage).toBe(damage);expect(p.explosionRadius).toBeCloseTo(radius, 8);
            expect(p.scale).toBe(extra ? .7 : row.scale);expect(p.position.y).toBeCloseTo(20 * delay);
            expect(warnings[i][3].radius).toBeCloseTo(radius, 8);expect(warnings[i][3].telegraphDuration).toBeCloseTo(delay);
            const before = f.target.stats.hp;f.impact(p);expect(before - f.target.stats.hp).toBe(damage);
            expect(p.isActive).toBe(false);f.impact(p);expect(before - f.target.stats.hp).toBe(damage);
        });
        expect(f.owner.offlineMeteorCasts?.size || 0).toBe(0);
        expect(f.owner.stats.mana).toBe(940);
    } finally { f.dispose(); }
});

test('Apocalypse consumes one Focus charge and keeps the paid base through delayed hits', () => {
    const f = fixture('meteor_apocalypse');
    try {
        f.owner.skillRunes['Spell Focus'] = 'spellfocus_reservoir';f.cast('Spell Focus');f.cast();
        expect(f.owner.spellFocusCharges).toBe(1);expect(f.projectiles[0].damage).toBe(92);
        f.owner.talentRanks = {};f.owner.skillRunes = {};f.owner.stats.intelligence = 1000;f.owner.spellFocusMultiplier = 4;
        jest.advanceTimersByTime(5000);
        expect(f.projectiles.map(p => p.damage)).toEqual([92, 46, 46, 46, 46, 46]);
        for (const p of f.projectiles) f.impact(p);
        expect(f.owner.spellFocusCharges).toBe(1);expect(f.target.stats.hp).toBe(10000 - 322);
    } finally { f.dispose(); }
});

test.each(['cancel', 'dead', 'zero-health', 'dispose', 'inactive', 'transition', 'owner-instance', 'replaced-player', 'replaced-engine', 'destroyed-engine', 'multiplayer', 'remote'])('Apocalypse retires unlaunched meteors after %s', reason => {
    const f = fixture('meteor_apocalypse');
    try {
        f.cast();jest.advanceTimersByTime(1000);expect(f.projectiles).toHaveLength(2);
        if (reason === 'cancel') f.owner.cancelAbilities();
        if (reason === 'dead') f.owner.die();
        if (reason === 'zero-health') f.owner.stats.hp = 0;
        if (reason === 'dispose') f.owner.dispose();
        if (reason === 'inactive') f.owner.isActive = false;
        if (reason === 'transition') f.engine.currentInstanceId = 'new-dungeon';
        if (reason === 'owner-instance') f.owner.instanceId = 'new-dungeon';
        if (reason === 'replaced-player') f.engine.player = {};
        if (reason === 'replaced-engine') f.owner.gameEngine = {};
        if (reason === 'destroyed-engine') f.engine.isDestroyed = true;
        if (reason === 'multiplayer') f.engine.isMultiplayer = true;
        if (reason === 'remote') f.owner.isRemote = true;
        jest.advanceTimersByTime(5000);expect(f.projectiles).toHaveLength(2);expect(f.owner.offlineMeteorCasts.size).toBe(0);
        expect(f.owner.managedTimers.size).toBe(0);
    } finally { f.dispose(); }
});

test.each(['mana', 'locked', 'cooldown', 'dead', 'stunned', 'remote'])('rejected %s Meteor never schedules a free Apocalypse', reason => {
    const f = fixture('meteor_apocalypse');
    try {
        if (reason === 'mana') f.owner.stats.mana = 59;
        if (reason === 'locked') f.owner.unlockedSkills = [];
        if (reason === 'cooldown') f.owner.cooldowns['Meteor Drop'] = 1;
        if (reason === 'dead') f.owner.state = 'DEAD';
        if (reason === 'stunned') f.owner.stunTimer = 1;
        if (reason === 'remote') f.owner.isRemote = true;
        const mana = f.owner.stats.mana;f.cast();jest.advanceTimersByTime(7000);
        expect(f.projectiles).toHaveLength(0);expect(f.owner.stats.mana).toBe(mana);
    } finally { f.dispose(); }
});

test.each(['meteor_cluster', 'meteor_apocalypse'])('scatter stays on reachable dungeon floors: %s', rune => {
    const f = fixture(rune);
    try {
        f.target.position.set(0, 0, 0);f.engine.currentInstanceId = 'scatter-room';f.engine.currentInstanceType = 'dungeon';
        f.engine.currentDungeonLayout = { walkRects: [{ x: -2, z: 0, width: 6, height: 6 }] };
        Math.random.mockReturnValue(.99);f.cast();jest.advanceTimersByTime(5000);
        for (const p of f.projectiles) expect(clipDungeonEffectSegment(f.engine.currentDungeonLayout.walkRects, f.target.position, p.groundImpactPosition).blocked).toBe(false);
        expect(f.projectiles.some(p => Math.abs(p.position.x) > 0)).toBe(true);
    } finally { f.dispose(); }
});

test('rock-clipped scatter and every impact sample the actual elevated floor', () => {
    const f = fixture('meteor_apocalypse');
    try {
        f.target.position.set(0, 999, 0);f.engine.terrainElevation = { sample: (x, z) => 4 + x * .25 + z * .1 };
        f.engine.collisionManager = { rockSolids: compileRockSolids([{ id: 'meteor-cover', outline: [[2, -2], [3, -2], [3, 2], [2, 2]] }]) };
        f.cast();Math.random.mockReturnValueOnce(.99).mockReturnValueOnce(.5);jest.advanceTimersByTime(1000);
        const p = f.projectiles[1];expect(p.position.x).toBe(2);expect(p.position.z).toBe(0);expect(p.groundImpactPosition.y).toBe(4.5);expect(p.position.y).toBe(34.5);
        f.impact(p);expect(p.position.y).toBe(4.5);
    } finally { f.dispose(); }
});

test.each(['wall', 'rock', 'foreign-instance', 'authority', 'friendly', 'non-actor', 'empty-ground'])('ground impacts preserve target boundaries: %s', mode => {
    const f = fixture();
    try {
        f.cast();const p = f.projectiles[0];f.target.position.set(14, 0, 0);
        if (mode === 'wall') {
            f.engine.currentInstanceId = p.meteorInstanceId = 'cover';f.engine.currentInstanceType = 'dungeon';
            f.engine.currentDungeonLayout = { walkRects: [{ x: 8, z: 0, width: 6, height: 20 }, { x: 16, z: 0, width: 6, height: 20 }] };
        }
        if (mode === 'rock') f.engine.collisionManager = { rockSolids: compileRockSolids([{ id: 'impact-cover', outline: [[11, -2], [12, -2], [12, 2], [11, 2]] }]) };
        if (mode === 'foreign-instance') f.target.instanceId = 'foreign';
        if (mode === 'authority') f.target.isRemote = true;
        if (mode === 'friendly') f.engine.isHostileActorTarget = () => false;
        if (mode === 'non-actor') f.actors.splice(1, 1, { position: f.target.position, takeDamage: jest.fn(), isActive: true, stats: { hp: 1000 } });
        if (mode === 'empty-ground') f.actors.length = 0;
        f.impact(p);expect(f.target.stats.hp).toBe(10000);expect(p.isActive).toBe(false);
        expect(f.engine.spawnTransientEffect.mock.calls.filter(c => c[0] === 'projectile_impact')).toHaveLength(1);
    } finally { f.target.dispose();f.dispose(); }
});

test('ground impact routes current critical and receiving shields once per recipient', () => {
    const f = fixture('meteor_cluster'), extra = new Actor('meteor-receiver', {});
    try {
        extra.stats.hp = extra.stats.maxHp = 1000;extra.position.copy(f.target.position);extra.gameEngine = f.engine;f.actors.push(extra);
        extra.shieldHP = 10;extra.arcaneShieldActive = true;extra.arcaneShieldTimer = 10;extra.divineInterventionGuardianTimer = 10;
        f.owner.stats.critChanceBonus = 1;f.cast();f.impact(f.projectiles[0]);
        expect(f.target.stats.hp).toBe(9930);expect(extra.stats.hp).toBe(975);expect(extra.shieldHP).toBe(0);
    } finally { f.dispose(); }
});


test('online Meteor retains resource prediction without launching local damage or delayed meteors', () => {
    const f = fixture('meteor_apocalypse');
    try {
        f.engine.isMultiplayer = f.owner.isMultiplayer = true;f.cast();jest.advanceTimersByTime(7000);
        expect(f.projectiles).toHaveLength(0);expect(f.owner.offlineMeteorCasts?.size || 0).toBe(0);
        expect(f.owner.stats.mana).toBe(940);expect(f.owner.cooldowns['Meteor Drop']).toBe(15);
    } finally { f.dispose(); }
});
