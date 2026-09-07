import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';

afterEach(() => jest.restoreAllMocks());

test.each([
    ['Shadow Lunge', 'ROG_07', 'bleed', null],
    ['Serrated Edges', 'ROG_13', 'bleed', 'Piercing Throw'],
    ['Serrated Edges', 'ROG_13', 'bleed', 'Fan of Knives'],
    ['Poison Coating', 'ROG_21', 'poison', 'Piercing Throw'],
    ['Poison Coating', 'ROG_21', 'poison', 'Basic Attack']
])('paid %s → %s preserves trained, attributed periodic damage', (skill, talent, kind, delivery) => {
    jest.spyOn(Math, 'random').mockReturnValue(.5);
    for (const build of [{ rank: 0 }, { rank: 1 }, { rank: 5 }, { rank: 5, unrelated: true }]) {
        const actor = new Rogue('status-caster'), target = new Imp('status-target');
        const projectiles = [], scheduled = [];
        try {
            actor.mesh = new THREE.Group(); actor.stats.dexterity = 180;
            actor.stats.damage = 100; actor.stats.mana = 1000; actor.stats.critChanceBonus = 0;
            actor.unlockedSkills.push(skill, delivery);
            actor.talentRanks = { [build.unrelated ? 'ROG_03' : talent]: build.rank };
            actor.scheduleTask = callback => { scheduled.push(callback); return scheduled.length; };
            target.mesh = new THREE.Group(); target.position.set(0, 0, 6);
            target.stats.hp = target.stats.maxHp = 10000; target.stats.hpRegen = 0;
            const engine = { isMultiplayer: false, chunkManager: { getActiveEntities: () => [target] },
                floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true),
                addEntity: entity => projectiles.push(entity), isHostileActorTarget: entity => entity === target };
            actor.useAbility(target.position.clone(), engine, skill);
            expect(actor.stats.mana).toBeLessThan(1000);
            if (delivery === 'Basic Attack') {
                expect(actor.attack(target)).toBe(true); scheduled[0]();
            } else if (delivery) {
                const mana = actor.stats.mana;
                actor.useAbility(target.position.clone(), engine, delivery);
                expect(actor.stats.mana).toBeLessThan(mana);
                for (let step = 0; step < 120 && target.stats.hp === 10000; step++) {
                    for (const projectile of projectiles) if (projectile.isActive) {
                        projectile.update(.02, null, null, engine.chunkManager, engine.floatingTextManager, engine);
                        if (target.stats.hp < 10000) break;
                    }
                }
                expect(target.stats.hp).toBeLessThan(10000);
            }
            const base = skill === 'Shadow Lunge' ? 100 : kind === 'poison' ? 98 : Math.floor((10000-target.stats.hp)/5);
            const expected = Math.floor(base*(1+(build.unrelated ? 0 : .04*build.rank))+1e-9);
            expect(target[`${kind}TickDamage`]).toBe(expected);
            const receive = jest.spyOn(target, 'takeDamage');
            const hp = target.stats.hp;
            target.stunTimer = 5;
            Actor.prototype.update.call(target, 1, null, null, engine.chunkManager);
            expect(target.stats.hp).toBe(hp-expected);
            expect(receive).toHaveBeenLastCalledWith(expected, actor);
            // Application-time training/critical state cannot multiply a wound
            // again after it has already been applied.
            actor.talentRanks = { [talent]: 5 }; actor.stats.critChanceBonus = 1;
            Actor.prototype.update.call(target, 1, null, null, engine.chunkManager);
            expect(target.stats.hp).toBe(hp-2*expected);
            target.cleanse(); receive.mockClear();
            Actor.prototype.update.call(target, 1, null, null, engine.chunkManager);
            expect(receive).not.toHaveBeenCalled();
            expect(target[`${kind}Source`]).toBeNull();
        } finally {
            for (const projectile of projectiles) projectile.dispose();
            actor.dispose(); target.dispose();
        }
    }
});
