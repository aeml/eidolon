import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Wizard } from '../src/entities/Wizard.js';
import { Imp } from '../src/entities/Imp.js';

afterEach(() => jest.restoreAllMocks());

test.each([
    { name: 'ordinary splash' },
    { name: 'critical splash', critical: true },
    { name: 'splash wall', wall: true },
    { name: 'splash doorway', wall: true, doorway: true },
    { name: 'flight wall', flightWall: true },
    { name: 'flight doorway', flightWall: true, doorway: true },
    { name: 'combo primary slowed', combo: true, primarySlow: true },
    { name: 'combo secondary slowed', combo: true, secondarySlow: true },
    { name: 'combo both critical', combo: true, primarySlow: true, secondarySlow: true, critical: true },
    { name: 'authoritative engine only', authoritative: true }
])('$name uses raw per-recipient damage and legal dungeon paths', config => {
    jest.spyOn(Math, 'random').mockReturnValue(.5);
    const actor = new Wizard('splash-caster');
    const primary = new Imp('splash-primary');
    const secondary = new Imp('splash-secondary');
    const projectiles = [];
    try {
        actor.mesh = new THREE.Group();
        actor.position.set(0, 0, 0);
        actor.stats.mana = 1000;
        actor.stats.intelligence = 40;
        actor.stats.critChanceBonus = config.critical ? 1 : 0;
        primary.position.set(0, 0, 6);
        secondary.position.set(6, 0, 6);
        for (const target of [primary, secondary]) target.stats.hp = target.stats.maxHp = 10000;
        let rects = null;
        if (config.wall) {
            rects = [{ x: 0, z: 4, width: 4, height: 20 }, { x: 6, z: 4, width: 4, height: 20 }];
            if (config.doorway) rects.push({ x: 3, z: 6, width: 4, height: 6 });
        }
        if (config.flightWall) {
            rects = [{ x: 0, z: 0, width: 20, height: 4 }, { x: 0, z: 6, width: 20, height: 4 }];
            if (config.doorway) rects.push({ x: 0, z: 3, width: 4, height: 4 });
        }
        const engine = {
            currentInstanceId: rects ? 'dungeon_projectile_composition' : null,
            currentInstanceType: rects ? 'dungeon' : 'overworld',
            currentDungeonLayout: { walkRects: rects },
            chunkManager: { getActiveEntities: () => [primary, secondary] },
            floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true),
            addEntity: projectile => projectiles.push(projectile),
            isHostileActorTarget: target => target === primary || target === secondary
        };
        if (config.combo) {
            actor.unlockedSkills.push('Gravity Well');
            const mana = actor.stats.mana;
            actor.useAbility(primary.position.clone(), engine, 'Gravity Well');
            expect(actor.stats.mana).toBeLessThan(mana);
            // Keep the real paid combo history, but isolate Fireball's
            // per-recipient slow handling from the opener's pull/damage.
            primary.position.set(0, 0, 6);
            secondary.position.set(6, 0, 6);
            for (const target of [primary, secondary]) target.stats.hp = 10000;
            primary.slowTimer = config.primarySlow ? 3 : 0;
            secondary.slowTimer = config.secondarySlow ? 3 : 0;
        }
        actor.useAbility(primary.position, engine, 'Fireball');
        expect(actor.stats.mana).toBeLessThan(1000);
        expect(projectiles).toHaveLength(1);
        const projectile = projectiles[0];
        expect(projectile.damage).toBe(100);
        if (config.authoritative) engine.isMultiplayer = true;
        for (let i = 0; i < 120 && projectile.isActive && primary.stats.hp === 10000; i++) {
            projectile.update(.02, null, null, engine.chunkManager, engine.floatingTextManager, engine);
        }
        const blocked = config.authoritative || config.flightWall && !config.doorway;
        expect(10000 - primary.stats.hp).toBe(blocked ? 0 : 100 * (config.critical ? 2 : 1) * (config.primarySlow ? 2 : 1));
        expect(10000 - secondary.stats.hp).toBe(blocked || config.wall && !config.doorway ? 0 : 40 * (config.critical ? 2 : 1) * (config.secondarySlow ? 2 : 1));
        if (config.combo) expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('COMBO: Implosion!', actor.position, '#ffd700');
        if (config.flightWall && !config.doorway) {
            expect(projectile.isActive).toBe(false);
            expect(projectile.position.z).toBeCloseTo(2, 8);
        }
    } finally {
        for (const projectile of projectiles) projectile.dispose();
        actor.dispose(); primary.dispose(); secondary.dispose();
    }
});
