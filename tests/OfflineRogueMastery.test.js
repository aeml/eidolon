import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';

const profiles = JSON.parse(readFileSync('server/internal/game/testdata/rogue_damage.json', 'utf8'));
afterEach(() => jest.restoreAllMocks());

test.each(profiles.flatMap(profile => [0, 1, 5].flatMap(rank => [0, 5].map(generic =>
    ({ ...profile, rank, generic })))))('$skill rank$rank generic$generic reaches an actual paid hit', profile => {
    jest.spyOn(Math, 'random').mockReturnValue(.99);
    const actor = new Rogue('rogue-mastery'), target = new Imp('rogue-target');
    const projectiles = [], tasks = [];
    try {
        actor.mesh = new THREE.Group();
        actor.position.set(0, 0, 0);
        actor.level = 100;
        actor.stats.damage = 101;
        actor.stats.dexterity = 11;
        actor.stats.mana = 10000;
        actor.stats.critChanceBonus = 0;
        actor.unlockedSkills.push(profile.skill);
        actor.talentRanks = { [profile.id]: profile.rank, ROG_38: profile.generic };
        actor.scheduleTask = task => { tasks.push(task); return tasks.length; };
        target.mesh = new THREE.Group();
        target.mesh.rotation.y = Math.PI;
        target.position.set(0, 0, profile.kind === 'instant' ? 2 : 6);
        target.stats.hp = target.stats.maxHp = 10000;
        target.stats.defense = 0;
        const engine = { chunkManager: { getActiveEntities: () => [target] },
            floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true),
            addEntity: projectile => projectiles.push(projectile), isHostileActorTarget: entity => entity === target };
        actor.useAbility(target.position.clone(), engine, profile.skill);
        expect(actor.stats.mana).toBeLessThan(10000);
        expect(actor.cooldowns[profile.skill]).toBeGreaterThan(0);
        // Match Go's integral Dexterity term before multiplying training.
        const base = profile.base + Math.trunc(11 * profile.dexterity) + 101 * profile.weapon;
        const expected = Math.trunc(base * (1 + .04 * profile.rank + .02 * profile.generic));
        // Delayed Volley and existing projectiles must keep the paid cast's
        // snapshot even if equipment/ranks change before emission or impact.
        actor.talentRanks = {};
        actor.stats.dexterity = 99;
        actor.stats.damage = 999;
        for (const task of tasks) task();
        expect(projectiles).toHaveLength(profile.count);
        for (const projectile of projectiles) {
            expect(projectile.skillName).toBe(profile.skill);
            expect(projectile.damage).toBe(expected);
        }
        if (profile.kind === 'projectile') {
            for (let step = 0; step < 120 && target.stats.hp === 10000; step++) {
                for (const projectile of projectiles) {
                    if (!projectile.isActive) continue;
                    projectile.update(.02, null, null, engine.chunkManager, engine.floatingTextManager, engine);
                    if (target.stats.hp < 10000) break;
                }
            }
        }
        expect(10000 - target.stats.hp).toBe(expected);
    } finally {
        for (const projectile of projectiles) projectile.dispose();
        actor.dispose(); target.dispose();
    }
});
