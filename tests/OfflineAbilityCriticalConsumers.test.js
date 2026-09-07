import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Rogue } from '../src/entities/Rogue.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Cleric } from '../src/entities/Cleric.js';
import { Imp } from '../src/entities/Imp.js';

afterEach(() => jest.restoreAllMocks());

test.each([
    [Rogue, 'Backstab', 'ROG_04', false],
    [Rogue, 'Backstab', 'ROG_32', false],
    [Wizard, 'Flame Whip', 'WIZ_39', false],
    [Fighter, 'Shield Slam', 'FTR_39', false],
    [Rogue, 'Piercing Throw', 'ROG_02', true],
    [Rogue, 'Fan of Knives', 'ROG_12', true],
    [Rogue, 'Blade Storm', 'ROG_16', true],
    [Rogue, 'Phantom Volley', 'ROG_18', true],
    [Wizard, 'Fireball', 'WIZ_39', true]
])('%p paid %s consumes %s at the actual hit', (Class, skill, talent, usesProjectile) => {
    jest.spyOn(Math, 'random').mockReturnValue(.5);
    let baseline;
    for (const build of [{ rank: 0 }, { rank: 1 }, { rank: 5 }, { rank: 5, unrelated: true }]) {
        const { rank, unrelated } = build;
        const actor = new Class('critical-caster');
        const target = new Imp('critical-target');
        const projectiles = [], tasks = [];
        try {
            actor.mesh = new THREE.Group();
            actor.position.set(0, 0, 0);
            actor.level = 100;
            actor.unlockedSkills.push(skill);
            actor.stats.mana = 10000;
            actor.stats.critChanceBonus = .49;
            actor.talentRanks = { [unrelated ? skill === 'Backstab' ? 'ROG_02' : 'ROG_04' : talent]: rank };
            actor.scheduleTask = callback => { tasks.push(callback); return tasks.length; };
            target.mesh = new THREE.Group();
            target.mesh.rotation.y = Math.PI; // Avoid the independent Backstab positional bonus.
            target.position.set(0, 0, usesProjectile ? 6 : 2);
            target.stats.hp = target.stats.maxHp = 10000;
            const engine = {
                isMultiplayer: false,
                chunkManager: { getActiveEntities: () => [target] },
                floatingTextManager: { spawn: jest.fn() },
                spawnTransientEffect: jest.fn(() => true),
                addEntity: projectile => projectiles.push(projectile),
                isHostileActorTarget: entity => entity === target
            };
            actor.useAbility(target.position.clone(), engine, skill);
            expect(actor.stats.mana).toBeLessThan(10000);
            if (usesProjectile) {
                // Resolve ordinary scheduled Volley shots, then advance the
                // actual projectiles until the first real collision.
                for (const task of tasks) task();
                expect(projectiles.length).toBeGreaterThan(0);
                for (const projectile of projectiles) expect(projectile.skillName).toBe(skill);
                for (let step = 0; step < 120 && target.stats.hp === 10000; step++) {
                    for (const projectile of projectiles) {
                        if (!projectile.isActive) continue;
                        projectile.update(.02, null, null, engine.chunkManager, engine.floatingTextManager, engine);
                        if (target.stats.hp < 10000) break;
                    }
                }
            }
            const actual = 10000 - target.stats.hp;
            expect(actual).toBeGreaterThan(0);
            if (rank === 0) baseline = actual;
            expect(actual).toBeCloseTo(baseline * (rank > 0 && !unrelated ? 2 : 1), 8);
            expect(engine.floatingTextManager.spawn.mock.calls.some(([text]) => text === 'CRITICAL!')).toBe(rank > 0 && !unrelated);
        } finally {
            for (const projectile of projectiles) projectile.dispose();
            actor.dispose();
            target.dispose();
        }
    }
});

test.each([
    [Fighter, 'Whirlwind', 'FTR_39', .21],
    [Wizard, 'Inferno Cataclysm', 'WIZ_39', 1.01],
    [Cleric, 'Spirit Guardians', null, .01],
    [Cleric, 'Spirit Guardians Boost', null, .01],
    [Cleric, 'Consecrated Ground', null, 1.01],
    [Cleric, 'Radiant Strike', null, 0]
])('%p paid %s retains critical chance in periodic/area damage', (Class, skill, talent, dt) => {
    jest.spyOn(Math, 'random').mockReturnValue(.5);
    let baseline;
    for (const trained of [false, true]) {
        const actor = new Class('periodic-caster');
        const target = new Imp('periodic-target');
        const spawned = [];
        try {
            actor.mesh = new THREE.Group();
            actor.position.set(0, 0, 0);
            actor.stats.mana = 1000;
            actor.unlockedSkills.push(skill);
            actor.stats.critChanceBonus = talent ? .49 : trained ? 1 : 0;
            actor.talentRanks = talent ? { [talent]: trained ? 5 : 0 } : {};
            target.position.set(0, 0, 2);
            target.stats.hp = target.stats.maxHp = 10000;
            const engine = { chunkManager: { getActiveEntities: () => [target] },
                floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true),
                addEntity: entity => spawned.push(entity),
                isHostileActorTarget: entity => entity === target };
            actor.useAbility(target.position.clone(), engine, skill);
            expect(actor.stats.mana).toBeLessThan(1000);
            if (dt > 0) {
                if (spawned.length) {
                    for (const entity of spawned) entity.update(dt, null, null, engine.chunkManager, engine.floatingTextManager);
                } else actor.update(dt, null, null, engine.chunkManager, engine.floatingTextManager);
            }
            const actual = 10000 - target.stats.hp;
            expect(actual).toBeGreaterThan(0);
            if (!trained) baseline = actual;
            expect(actual).toBeCloseTo(baseline * (trained ? 2 : 1), 8);
        } finally {
            for (const entity of spawned) entity.dispose();
            actor.dispose(); target.dispose();
        }
    }
});
