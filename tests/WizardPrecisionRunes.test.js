import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Wizard } from '../src/entities/Wizard.js';
import { Imp } from '../src/entities/Imp.js';
import { getAbilityRange } from '../src/core/AbilityRange.js';

// Also exercised against actual authoritative casts and projectile flight.
const contract = JSON.parse(readFileSync('server/internal/game/testdata/wizard_precision_runes.json', 'utf8'));

function fixture(row) {
    const source = new Wizard('precision-rune'), target = new Imp('first-target'), spawned = [];
    source.mesh = new THREE.Group();source.level = 100;
    source.stats.intelligence = 40;source.stats.cooldownReduction = 0;
    source.stats.mana = source.stats.maxMana = 10000;
    source.unlockedSkills = ['Fireball', 'Scorch Beam', 'Arcane Missiles', 'Spell Focus', 'Dragonfire Lance'];
    source.skillRunes = { [row.skill]: row.rune };
    target.position.set(10, 0, 0);target.stats.hp = target.stats.maxHp = 100000;
    const hit = jest.spyOn(target, 'takeDamage');
    const engine = { isMultiplayer: false, currentInstanceId: '',
        chunkManager: { getActiveEntities: () => [target] }, isHostileActorTarget: e => e === target,
        floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true),
        addEntity: e => spawned.push(e) };
    return { source, target, spawned, hit, engine,
        cast: skill => source.useAbility(target.position.clone(), engine, skill),
        dispose() { for (const e of spawned) e.dispose();source.dispose();target.dispose(); } };
}

beforeEach(() => { jest.useFakeTimers();jest.spyOn(Math, 'random').mockReturnValue(.5); });
afterEach(() => { jest.useRealTimers();jest.restoreAllMocks(); });

describe.each(contract)('$skill/$rune', row => {
    test.each([false, true])('paid casts preserve the shared contract, barrage=%s', barrage => {
        const f = fixture(row);
        try {
            if (barrage && row.skill === 'Arcane Missiles') f.cast('Scorch Beam');
            const mana = f.source.stats.mana;
            f.cast(row.skill);
            expect(mana - f.source.stats.mana).toBe(row.mana);
            expect(f.source.cooldowns[row.skill]).toBeCloseTo(row.cooldown);
            // Queued casts retain damage, speed and targeting after loadout changes.
            f.source.skillRunes = {};f.source.stats.intelligence = 999;
            jest.advanceTimersByTime(850);
            if (row.skill === 'Scorch Beam') {
                expect(f.hit.mock.calls[0][0]).toBe(row.damage);
                expect(f.target.slowTimer || 0).toBe(row.slowSeconds);
                if (row.slow > 0) expect(f.target.slowFactor).toBe(row.slow);
                f.source.skillRunes[row.skill] = row.rune;
                expect(getAbilityRange(f.source, row.skill, 18)).toBe(row.range);
            } else {
                expect(f.spawned).toHaveLength(barrage && row.skill === 'Arcane Missiles' ? row.barrageCount : row.count);
                for (const projectile of f.spawned) {
                    expect(projectile.damage).toBe(row.damage);
                    expect(projectile.velocity.length()).toBeCloseTo(row.speed);
                    if (row.skill === 'Arcane Missiles') expect(Boolean(projectile.homingTarget)).toBe(row.homing);
                    else {
                        expect(projectile.radius).toBe(row.radius);
                        expect(projectile.projectilePierce).toBe(row.pierce);
                        expect(projectile.scale).toBe(row.radius);
                    }
                }
            }
        } finally { f.dispose(); }
    });
});

test.each(contract.filter(row => row.skill === 'Dragonfire Lance'))('$rune flight stops or pierces once per target', row => {
    const f = fixture(row), second = new Imp('second-target');
    try {
        f.target.position.set(5, 0, 0);second.position.set(12, 0, 0);second.stats.hp = second.stats.maxHp = 100000;
        f.engine.chunkManager.getActiveEntities = () => [f.target, second];
        f.cast(row.skill);
        const projectile = f.spawned[0];
        f.source.skillRunes[row.skill] = 'dragonfire_quickfire';f.source.stats.intelligence = 999;
        for (let i = 0; i < 100 && projectile.isActive; i++) {
            projectile.update(.02, null, null, f.engine.chunkManager, f.engine.floatingTextManager, f.engine);
        }
        expect(f.hit).toHaveBeenCalledTimes(1);
        expect(f.hit.mock.calls[0][0]).toBe(row.damage);
        expect(second.stats.hp < second.stats.maxHp).toBe(row.pierce);
    } finally { f.dispose();second.dispose(); }
});

test.each(contract.filter(row => row.skill === 'Dragonfire Lance'))('$rune slow-frame shot hits the front enemy even in reversed chunk order', row => {
    const f = fixture(row), back = new Imp('back-target');
    try {
        f.target.position.set(5, 0, 0);back.position.set(12, 0, 0);back.stats.hp = back.stats.maxHp = 100000;
        f.engine.chunkManager.getActiveEntities = () => [back, f.target];
        f.cast(row.skill);
        const projectile = f.spawned[0];
        projectile.update(.5, null, null, f.engine.chunkManager, f.engine.floatingTextManager, f.engine);
        expect(f.hit).toHaveBeenCalledTimes(1);
        expect(back.stats.hp < back.stats.maxHp).toBe(row.pierce);
        expect(projectile.travelDistance).toBeLessThanOrEqual(18);
        expect(projectile.isActive).toBe(false);
        if (!row.pierce) expect(projectile.position.x).toBeLessThan(f.target.position.x);
    } finally { f.dispose();back.dispose(); }
});

test.each(['scorchbeam_longshot', 'scorchbeam_incision', 'scorchbeam_snare'])('%s preserves immune-target damage and existing slows', rune => {
    const row = contract.find(r => r.rune === rune), f = fixture(row);
    try {
        f.target.ccImmune = true;f.target.slowTimer = 12;f.target.slowFactor = .6;
        f.cast(row.skill);
        expect(f.hit.mock.calls[0][0]).toBe(row.damage);
        expect(f.target.slowTimer).toBe(12);expect(f.target.slowFactor).toBe(.6);
    } finally { f.dispose(); }
});
