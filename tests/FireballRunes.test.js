import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Wizard } from '../src/entities/Wizard.js';
import { Imp } from '../src/entities/Imp.js';
import { Cleric } from '../src/entities/Cleric.js';
import { Fighter } from '../src/entities/Fighter.js';

const contract = JSON.parse(readFileSync('server/internal/game/testdata/fireball_runes.json', 'utf8'));

function fixture(rune = '') {
    const source = new Wizard('fireball-rune-source'), target = new Imp('fireball-rune-target'), spawned = [];
    source.mesh = new THREE.Group();source.level = 100;source.stats.cooldownReduction = 0;
    source.stats.intelligence = 40;source.stats.mana = source.stats.maxMana = 10000;
    source.unlockedSkills = ['Fireball', 'Scorch Beam', 'Arcane Missiles', 'Spell Focus', 'Dragonfire Lance'];
    source.skillRunes = { Fireball: rune };target.position.set(10, 0, 0);
    target.stats.hp = target.stats.maxHp = 100000;
    const actors = [target], engine = { currentInstanceId: '', isMultiplayer: false,
        chunkManager: { getActiveEntities: () => actors }, isHostileActorTarget: actor => actors.includes(actor),
        floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true), addEntity: e => spawned.push(e) };
    const hit = jest.spyOn(target, 'takeDamage');
    return { source, target, actors, engine, hit, spawned,
        cast: (skill = 'Fireball') => source.useAbility(target.position.clone(), engine, skill),
        hitTarget() {
            const projectile = spawned.find(e => e.type === 'Fireball');
            for (let i = 0; i < 300 && projectile.isActive && !hit.mock.calls.length; i++) {
                projectile.update(.02, null, null, engine.chunkManager, engine.floatingTextManager, engine);
            }
            expect(hit).toHaveBeenCalled();return projectile;
        },
        dispose() { for (const e of spawned) e.dispose();for (const e of actors) e.dispose();source.dispose(); } };
}

beforeEach(() => jest.spyOn(Math, 'random').mockReturnValue(.5));
afterEach(() => jest.restoreAllMocks());

test.each(contract)('$rune uses authoritative paid damage, speed, cooldown and bounce count', row => {
    const f = fixture(row.rune);
    try {
        f.cast();const projectile = f.spawned[0];
        expect(f.source.stats.mana).toBe(9970);expect(f.source.cooldowns.Fireball).toBe(row.cooldown);
        expect(projectile.damage).toBe(row.damage);expect(projectile.velocity.length()).toBeCloseTo(row.speed);
        expect(projectile.bounces).toBe(row.bounces);expect(projectile.fireballRuneId).toBe(row.rune);
        f.source.stats.intelligence = 10000;f.source.skillRunes.Fireball = '';
        f.hitTarget();expect(f.hit.mock.calls[0][0]).toBe(row.damage);
    } finally { f.dispose(); }
});

test('Empowered doubles the rounded trained/focused cast and consumes one charge', () => {
    const f = fixture('fireball_empowered');
    try {
        f.source.stats.intelligence = 1;f.source.talentRanks = { WIZ_01: 1 };
        f.source.skillRunes['Spell Focus'] = 'spellfocus_overchannel';f.cast('Spell Focus');f.cast();
        expect(f.spawned[0].damage).toBe(130);expect(f.source.spellFocusCharges).toBe(0);
        f.hitTarget();expect(f.hit.mock.calls[0][0]).toBe(130);
    } finally { f.dispose(); }
});

test.each([false, true])('Magma is stationary ground with a captured real-hit budget; critical=%s', critical => {
    const f = fixture('fireball_magma');
    try {
        if (critical) f.source.stats.critChanceBonus = 1;
        f.cast();f.hitTarget();const field = f.spawned.find(e => e.effectType === 'BurningGround');
        expect(field).toBeDefined();expect(field.radius).toBe(5);expect(field.duration).toBe(3);expect(field.position.y).toBe(0);
        const newcomer = new Imp('magma-entrant');newcomer.stats.hp = newcomer.stats.maxHp = 1000;
        newcomer.position.copy(field.position);newcomer.ccImmune = true;f.actors.push(newcomer);
        f.target.position.x = field.position.x + 20;const departedHp = f.target.stats.hp;
        f.source.stats.intelligence = 10000;f.source.stats.critChanceBonus = 1;
        f.source.hasLuckyEffect = true;f.source.skillRunes.Fireball = 'fireball_empowered';
        const budget = critical ? 33 : 16;
        field.update(.05, null, null, f.engine.chunkManager, f.engine.floatingTextManager);
        field.update(1, null, null, f.engine.chunkManager, f.engine.floatingTextManager);
        field.update(1, null, null, f.engine.chunkManager, f.engine.floatingTextManager);
        expect(newcomer.stats.hp).toBe(1000 - budget * 3);expect(f.target.stats.hp).toBe(departedHp);
        field.update(1, null, null, f.engine.chunkManager, f.engine.floatingTextManager);
        expect(field.isActive).toBe(false);expect(newcomer.stats.hp).toBe(1000 - budget * 3);
        expect(f.target.bleedTimer).toBe(0);expect(newcomer.bleedTimer).toBe(0);
    } finally { f.dispose(); }
});

test('Magma inherits post-shield health damage and never rerolls receiving vulnerability', () => {
    const f = fixture('fireball_magma');
    try {
        f.target.shieldHP = 40;f.target.arcaneShieldActive = true;f.target.arcaneShieldTimer = 10;
        f.target.markWeaknessTimer = 10;f.target.markWeaknessFactor = .5;
        f.cast();f.hitTarget();const field = f.spawned.find(e => e.effectType === 'BurningGround');
        // Real health hit is150 minus40 absorbed. Inherit floor110/6=18.
        const before = f.target.stats.hp;field.performTick(f.engine.chunkManager);
        expect(before - f.target.stats.hp).toBe(18);
    } finally { f.dispose(); }
});

test('a death-save heal does not erase the resolved first hit inherited by Magma', () => {
    const f = fixture('fireball_magma');
    try {
        f.target.stats.hp = 10;f.target.stats.maxHp = 1000;f.target.divineInterventionActive = true;
        f.cast();f.hitTarget();const field = f.spawned.find(e => e.effectType === 'BurningGround');
        expect(f.target.stats.hp).toBe(300);expect(field).toBeDefined();
        field.performTick(f.engine.chunkManager);expect(f.target.stats.hp).toBe(284);
    } finally { f.dispose(); }
});

test('Magma pulses still pay the current shield and report actual health damage', () => {
    const f = fixture('fireball_magma');
    try {
        f.cast();f.hitTarget();const field = f.spawned.find(e => e.effectType === 'BurningGround');
        f.target.shieldHP = 10;f.target.arcaneShieldActive = true;f.target.arcaneShieldTimer = 10;
        const before = f.target.stats.hp;field.performTick(f.engine.chunkManager);
        expect(f.target.shieldHP).toBe(0);expect(before - f.target.stats.hp).toBe(6);
        expect(f.engine.floatingTextManager.spawn).toHaveBeenLastCalledWith(6, f.target.position, '#ff8800');
    } finally { f.dispose(); }
});

test('Magma pulses leave the second stored Focus charge available', () => {
    const f = fixture('fireball_magma');
    try {
        f.source.skillRunes['Spell Focus'] = 'spellfocus_reservoir';f.cast('Spell Focus');f.cast();f.hitTarget();
        const field = f.spawned.find(e => e.effectType === 'BurningGround');
        const before = f.target.stats.hp;
        for (let i = 0; i < 3; i++) field.performTick(f.engine.chunkManager);
        expect(before - f.target.stats.hp).toBe(87);
        expect(f.source.spellFocusActive).toBe(true);expect(f.source.spellFocusCharges).toBe(1);
        expect(f.source.spellFocusMultiplier).toBe(1.75);
    } finally { f.dispose(); }
});

test('a newly inserted Magma field starts on the next chunk frame without aging at impact', () => {
    const f = fixture('fireball_magma');
    try {
        f.engine.chunkManager.frameCount = 42;f.cast();f.hitTarget();
        const field = f.spawned.find(e => e.effectType === 'BurningGround'), before = f.target.stats.hp;
        field.update(1 / 15, null, null, f.engine.chunkManager, f.engine.floatingTextManager);
        expect(field.elapsedTime).toBe(0);expect(f.target.stats.hp).toBe(before);
        f.engine.chunkManager.frameCount++;
        field.update(1 / 15, null, null, f.engine.chunkManager, f.engine.floatingTextManager);
        expect(field.elapsedTime).toBeCloseTo(1 / 15);expect(before - f.target.stats.hp).toBe(16);
    } finally { f.dispose(); }
});

test('Fighter forwards stored-damage context while retaining Fortress, Roar and shield reductions', () => {
    const receiver = new Fighter('stored-budget-defender');
    try {
        receiver.stats.hp = receiver.stats.maxHp = 1000;receiver.ironFortressTimer = 10;receiver.guardianRoarTimer = 10;
        receiver.markWeaknessTimer = 10;receiver.markWeaknessFactor = 1;receiver.shieldHP = 20;
        receiver.takeDamage(100, null, 0, { inherited: true });
        expect(receiver.stats.hp).toBe(964);expect(receiver.shieldHP).toBe(0);
    } finally { receiver.dispose(); }
});

test.each(['absorbed', 'new instance', 'authoritative'])('Magma cannot create or keep unauthorized damage: %s', kind => {
    const f = fixture('fireball_magma');
    try {
        if (kind === 'absorbed') { f.target.shieldHP = 1000;f.target.arcaneShieldActive = true;f.target.arcaneShieldTimer = 10; }
        f.cast();f.hitTarget();const field = f.spawned.find(e => e.effectType === 'BurningGround');
        if (kind === 'absorbed') expect(field).toBeUndefined();
        else {
            const before = f.target.stats.hp;
            if (kind === 'new instance') f.engine.currentInstanceId = 'another-dungeon';else f.engine.isMultiplayer = true;
            field.performTick(f.engine.chunkManager);expect(f.target.stats.hp).toBe(before);
        }
    } finally { f.dispose(); }
});

test('Chain keeps all three additional hits at half damage and ignores a friendly actor', () => {
    const f = fixture('fireball_chain'), ally = new Cleric('friendly-cleric');
    try {
        f.target.position.set(5, 0, 0);ally.position.set(1, 0, 0);ally.stats.hp = ally.stats.maxHp = 1000;
        const foes = [f.target, ...[17, 29, 41].map((x, i) => {
            const actor = new Imp(`chain-extra-${i}`);actor.position.set(x, 0, 0);actor.stats.hp = actor.stats.maxHp = 10000;f.actors.push(actor);return actor;
        })];
        const hits = foes.map(actor => actor === f.target ? f.hit : jest.spyOn(actor, 'takeDamage'));
        f.engine.chunkManager.getActiveEntities = () => [ally, ...f.actors];f.cast();
        f.source.stats.intelligence = 9999;f.source.skillRunes.Fireball = 'fireball_empowered';
        const projectile = f.spawned[0];
        for (let i = 0; i < 400 && projectile.isActive; i++) projectile.update(.02, null, null, f.engine.chunkManager, f.engine.floatingTextManager, f.engine);
        expect(hits.map(hit => hit.mock.calls[0]?.[0])).toEqual([100, 50, 50, 50]);
        expect(projectile.bounces).toBe(0);expect(projectile.hitEntities.size).toBe(4);expect(projectile.isActive).toBe(false);
        expect(ally.stats.hp).toBe(1000);
    } finally { f.dispose();ally.dispose(); }
});

test.each([false, true])('Chain selects the closest legal bounce; doorway=%s', doorway => {
    const f = fixture('fireball_chain');
    try {
        f.target.position.set(0, 0, 6);
        const across = new Imp('chain-across-cover'), fallback = new Imp('chain-visible-fallback');
        across.position.set(4.5, 0, 6);fallback.position.set(-5.5, 0, 6);
        for (const actor of [across, fallback]) { actor.stats.hp = actor.stats.maxHp = 10000;f.actors.push(actor); }
        f.engine.currentInstanceId = 'chain-cover';f.engine.currentInstanceType = 'dungeon';
        f.engine.currentDungeonLayout = { walkRects: [{ x: -2, z: 4, width: 8, height: 20 }, { x: 6, z: 4, width: 4, height: 20 },
            ...(doorway ? [{ x: 3, z: 6, width: 4, height: 6 }] : [])] };
        f.cast();const projectile = f.hitTarget();
        expect(projectile.bounces).toBe(2);expect(projectile.velocity.x > 0).toBe(doorway);
    } finally { f.dispose(); }
});
