import fs from 'node:fs';
import { jest } from '@jest/globals';
import * as THREE from 'three';
import { AbilityController } from '../src/core/AbilityController.js';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';
import { resolveDungeonMovementEndpoint } from '../src/skills/dungeonEffectGeometry.js';

const contract = JSON.parse(fs.readFileSync('server/internal/game/testdata/rogue_movement_range.json', 'utf8'));

test.each(contract)('$name intent uses the authoritative rune/talent boundary', entry => {
    const player = new Rogue('rogue-range');
    player.talentRanks = { ROG_36: entry.rank };
    player.skillRunes = { [entry.skill]: entry.rune };
    const controller = Object.create(AbilityController.prototype);
    controller.engine = { player };
    expect(controller.getAbilityCastRange(entry.skill)).toBeCloseTo(entry.range, 8);
});

test.each([false, true])('ranked offline Shadowstep cannot cross a wall, doorway=%s', doorway => {
    const player = new Rogue('wall-rogue');
    player.position.set(50009, 40, 50000);
    player.mesh = new THREE.Group();
    player.talentRanks = { ROG_36: 5 };
    player.skillRunes = { Backstab: 'backstab_shadowstep' };
    player.unlockedSkills.push('Backstab');
    const target = new Imp('wall-target');
    target.radius = 1.25; // Replicated normal server body radius.
    target.position.set(50013, 40, 50000);
    target.mesh = new THREE.Group();
    target.mesh.rotation.y = Math.PI / 2;
    target.takeDamage = jest.fn();
    const rects = [{ x: 50000, z: 50000, width: 20, height: 20 }, { x: 50020.5, z: 50000, width: 20, height: 20 }];
    if (doorway) rects.push({ x: 50010, z: 50000, width: 5, height: 6 });
    const engine = { currentInstanceId: 'dungeon_rogue_range', currentDungeonLayout: { walkRects: rects },
        chunkManager: { getActiveEntities: () => [target] }, floatingTextManager: { spawn: jest.fn() },
        spawnTransientEffect: jest.fn(() => true) };
    const mana = player.stats.mana;
    player.useAbility(target.position, engine, 'Backstab');
    expect(player.position.x).toBeCloseTo(doorway ? 50011.5 : 50009, 8);
    expect(target.takeDamage).toHaveBeenCalledTimes(doorway ? 1 : 0);
    if (!doorway) {
        expect(player.stats.mana).toBe(mana);
        expect(engine.spawnTransientEffect).not.toHaveBeenCalled();
    }
});

test.each([
    ['wall', 9, 21, false, 10],
    ['doorway', 9, 21, true, 21],
    ['outside landing', 0, -30, false, -10],
    ['outside start recovery', 15, 21, false, 10]
])('%s point landing matches canonical dungeon constraints', (_, fromX, toX, doorway, expected) => {
    const origin = 60000;
    const rects = [{ x: origin, z: origin, width: 20, height: 20 }, { x: origin + 30, z: origin, width: 20, height: 20 }];
    if (doorway) rects.push({ x: origin + 15, z: origin, width: 12, height: 6 });
    const from = { x: origin + fromX, z: origin };
    const to = { x: origin + toX, z: origin };
    expect(resolveDungeonMovementEndpoint(rects, from, to).x).toBeCloseTo(origin + expected, 8);
    expect(from.x).toBe(origin + fromX);
    expect(to.x).toBe(origin + toX);
});

describe.each(contract.filter(entry => entry.skill !== 'Shadow Strike'))('$name offline', entry => {
    test.each([false, true])('casts inside, rejects outside without spending; outside=%s', outside => {
        const player = new Rogue('rogue-range');
        player.position.set(60000, 40, 60000);
        player.mesh = new THREE.Group();
        player.talentRanks = { ROG_36: entry.rank };
        player.skillRunes = { [entry.skill]: entry.rune };
        player.unlockedSkills.push(entry.skill);
        const target = new Imp('range-target');
        target.mesh = new THREE.Group();
        target.mesh.rotation.y = Math.PI / 2;
        target.position.set(player.position.x + entry.range + target.radius + (outside ? .01 : -.01), 40, player.position.z);
        target.takeDamage = jest.fn();
        const engine = { chunkManager: { getActiveEntities: () => [target] },
            floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true) };
        const mana = player.stats.mana;
        player.useAbility(new THREE.Vector3(target.position.x, 0, target.position.z), engine, entry.skill);
        if (outside) {
            expect(player.position.toArray()).toEqual([60000, 40, 60000]);
            expect(player.stats.mana).toBe(mana);
            expect(player.cooldowns[entry.skill] || 0).toBe(0);
            expect(target.takeDamage).not.toHaveBeenCalled();
            expect(engine.spawnTransientEffect).not.toHaveBeenCalled();
        } else {
            expect(player.stats.mana).toBeLessThan(mana);
            if (entry.skill === 'Shadow Lunge' || entry.rune === 'backstab_shadowstep') {
                expect(player.position.x).toBeCloseTo(target.position.x - 1.5, 8);
                expect(player.position.y).toBe(40);
                expect(player.position.z).toBeCloseTo(target.position.z, 8);
                expect(player.mesh.position).toEqual(player.position);
            } else {
                expect(player.position.toArray()).toEqual([60000, 40, 60000]);
            }
            if (entry.skill === 'Backstab') expect(target.takeDamage).toHaveBeenCalledTimes(1);
        }
    });
});
