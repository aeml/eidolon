import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';
import { getAbilityAoeRadius, AUTHORITATIVE_SHAPE_ABILITIES } from '../src/skills/abilityRadii.js';

test.each([0, 1, 5].flatMap(rank => [1, .05].map(dt => [rank, dt])))('paid Blade Storm rank%s snapshots bounded area at dt%s', (rank, dt) => {
    const p = new Rogue('blade-source'), middle = new Imp('blade-middle'), outside = new Imp('blade-outside');
    const shots = [];
    try {
        p.mesh = new THREE.Group(); p.stats.mana = 1000;
        p.talentRanks = { ROG_34: rank, ROG_38: 5 };
        p.unlockedSkills.push('Blade Storm');
        const radius = 10 * (1 + .03 * rank); // ROG_38 affects damage, not area.
        middle.position.set(0, 0, 5); outside.position.set(0, 0, radius + 3);
        for (const target of [middle, outside]) target.stats.hp = target.stats.maxHp = 10000;
        const engine = { addEntity: e => shots.push(e), floatingTextManager: { spawn: jest.fn() },
            chunkManager: { getActiveEntities: () => [middle, outside] }, spawnTransientEffect: jest.fn(() => true) };
        p.useAbility(new THREE.Vector3(0, 0, 100), engine, 'Blade Storm');
        expect(p.stats.mana).toBe(970); expect(shots).toHaveLength(5);
        expect(getAbilityAoeRadius('Rogue', 'Blade Storm', p)).toBeCloseTo(radius);
        expect(AUTHORITATIVE_SHAPE_ABILITIES.has('Blade Storm')).toBe(true);
        p.talentRanks = {};
        for (const shot of shots) {
            for (let elapsed = 0; elapsed < 1 && shot.isActive; elapsed += dt) {
                shot.update(dt, null, null, engine.chunkManager, engine.floatingTextManager, engine);
            }
            expect(Math.hypot(shot.position.x, shot.position.z)).toBeCloseTo(radius);
            expect(shot.isActive).toBe(false);
        }
        expect(middle.stats.hp).toBeLessThan(10000);
        expect(outside.stats.hp).toBe(10000);
    } finally {
        shots.forEach(s => s.dispose()); p.dispose(); middle.dispose(); outside.dispose();
    }
});

test.each([false, true])('clipped flight hits before walls, never behind them; authoritative replicas remain server-owned (%s)', authoritative => {
    const p = new Rogue('blade-wall-source'), before = new Imp('before-wall'), behind = new Imp('behind-wall');
    const shots = [];
    try {
        p.mesh = new THREE.Group(); p.stats.mana = 1000; p.unlockedSkills.push('Blade Storm');
        before.position.set(0, 0, 2); behind.position.set(0, 0, 7);
        for (const target of [before, behind]) target.stats.hp = target.stats.maxHp = 10000;
        const engine = { currentInstanceId: 'blade-wall', currentInstanceType: 'dungeon',
            currentDungeonLayout: { walkRects: [{ x: 0, z: 0, width: 20, height: 8 },
                { x: 0, z: 8, width: 20, height: 4 }] },
            addEntity: e => shots.push(e), floatingTextManager: { spawn: jest.fn() },
            chunkManager: { getActiveEntities: () => [before, behind] }, spawnTransientEffect: jest.fn(() => true) };
        p.useAbility(new THREE.Vector3(0, 0, 100), engine, 'Blade Storm');
        engine.isMultiplayer = authoritative;
        for (const shot of shots) {
            shot.update(1, null, null, engine.chunkManager, engine.floatingTextManager, engine);
            expect(shot.isActive).toBe(authoritative);
            if (!authoritative) expect(shot.position.z).toBeCloseTo(4);
        }
        if (authoritative) expect(before.stats.hp).toBe(10000);
        else expect(before.stats.hp).toBeLessThan(10000);
        expect(behind.stats.hp).toBe(10000);
    } finally {
        shots.forEach(s => s.dispose()); p.dispose(); before.dispose(); behind.dispose();
    }
});
