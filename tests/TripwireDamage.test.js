import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';

test.each([0, 1, 5].flatMap(mastery => [0, 1, 5].flatMap(technique => [false, true].map(immune => [mastery, technique, immune]))))(
    'paid Tripwire mastery%s/technique%s damages once and respects CC immunity%s', (mastery, technique, immune) => {
        const p = new Rogue('trip-owner'), enemy = new Imp('trip-enemy');
        jest.spyOn(Math, 'random').mockReturnValue(.61);
        try {
            p.mesh = new THREE.Group(); p.unlockedSkills.push('Tripwire');
            Object.assign(p.stats, { mana: 1000, dexterity: 100, damage: 100, critChanceBonus: .6 });
            p.talentRanks = { ROG_23: mastery, ROG_24: technique };
            Object.assign(enemy.stats, { hp: 10000, maxHp: 10000, defense: 0 });
            enemy.ccImmune = immune;
            enemy.position.set(.5, 20, 0);
            const engine = { effectScene: new THREE.Group(), spawnTransientEffect: jest.fn(() => true),
                floatingTextManager: { spawn: jest.fn() }, chunkManager: { getActiveEntities: () => [enemy] },
                isHostileActorTarget: entity => entity === enemy };
            p.useAbility(new THREE.Vector3(5, 0, 0), engine, 'Tripwire');
            expect(p.stats.mana).toBe(975); expect(p.traps).toHaveLength(1);
            p.update(.016, null, null, engine.chunkManager, engine.floatingTextManager, engine);
            const damage = Math.trunc(120 * (1 + .04 * mastery)) * (technique ? 2 : 1);
            expect(10000 - enemy.stats.hp).toBe(damage);
            expect(enemy.rootTimer || 0).toBeCloseTo(immune ? 0 : 3); expect(p.traps).toHaveLength(0);
            expect(engine.floatingTextManager.spawn.mock.calls.some(call => call[0] === 'ROOTED!')).toBe(!immune);
            p.update(.016, null, null, engine.chunkManager, engine.floatingTextManager, engine);
            expect(10000 - enemy.stats.hp).toBe(damage);
        } finally { p.dispose(); enemy.dispose(); jest.restoreAllMocks(); }
    });

test.each(['friendly', 'dead', 'inactive', 'other-instance', 'remote', 'online', 'wall', 'expired'])(
    '%s never receives local Tripwire damage or root', excluded => {
        const p = new Rogue('guard-owner'), enemy = new Imp('guard-enemy');
        try {
            p.mesh = new THREE.Group(); p.stats.mana = 1000;
            p.instanceId = enemy.instanceId = 'trip-room';
            p.unlockedSkills.push('Tripwire');
            enemy.position.set(.5, 20, 0);
            Object.assign(enemy.stats, { hp: 10000, maxHp: 10000 });
            const engine = { currentInstanceId: 'trip-room', currentInstanceType: 'dungeon',
                effectScene: new THREE.Group(), spawnTransientEffect: jest.fn(() => true),
                floatingTextManager: { spawn: jest.fn() }, chunkManager: { getActiveEntities: () => [enemy] },
                isHostileActorTarget: () => excluded !== 'friendly' };
            p.useAbility(new THREE.Vector3(5, 0, 0), engine, 'Tripwire');
            if (excluded === 'dead') enemy.state = 'DEAD';
            if (excluded === 'inactive') enemy.isActive = false;
            if (excluded === 'other-instance') enemy.instanceId = 'elsewhere';
            if (excluded === 'remote') enemy.isRemote = true;
            if (excluded === 'online') engine.isMultiplayer = true;
            if (excluded === 'wall') engine.currentDungeonLayout = { walkRects: [
                { x: 0, z: 0, width: .4, height: 5 }, { x: .5, z: 0, width: .2, height: 5 }] };
            p.update(excluded === 'expired' ? 60 : .016, null, null, engine.chunkManager, engine.floatingTextManager, engine);
            expect(enemy.stats.hp).toBe(10000); expect(enemy.rootTimer || 0).toBe(0);
            expect(p.traps).toHaveLength(excluded === 'expired' ? 0 : 1);
        } finally { p.dispose(); enemy.dispose(); }
    });
