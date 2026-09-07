import fs from 'node:fs';
import { jest } from '@jest/globals';
import * as THREE from 'three';
import { AbilityController } from '../src/core/AbilityController.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';
import { DwarfSalesman } from '../src/entities/DwarfSalesman.js';
import { findOfflineAbilityTarget } from '../src/skills/offlineAbilityTargeting.js';

const cases = JSON.parse(fs.readFileSync('server/internal/game/testdata/target_talent_range.json', 'utf8'));

describe.each(cases)('$name', entry => {
    test('cast intent matches authoritative range', () => {
        const controller = Object.create(AbilityController.prototype);
        controller.engine = { player: { constructor: { name: entry.class }, meshType: entry.class,
            abilityName: entry.skill, talentRanks: entry.ranks } };
        expect(controller.getAbilityIntentRange()).toBeCloseTo(entry.range, 8);
    });
    test.each([false, true])('offline target boundary, outside=%s', outside => {
        const caster = entry.class === 'Wizard' ? new Wizard('target-wizard') : new Rogue('target-rogue');
        caster.position.set(60000, 40, 60000);
        caster.mesh = new THREE.Group();
        caster.talentRanks = entry.ranks;
        caster.unlockedSkills.push(entry.skill);
        caster.scheduleTask = callback => callback();
        const target = new Imp('target-imp');
        target.position.set(caster.position.x + entry.range + target.radius + (outside ? .01 : -.01), 40, caster.position.z);
        const engine = { chunkManager: { getActiveEntities: () => [target] }, addEntity: jest.fn(),
            spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() } };
        const mana = caster.stats.mana;
        caster.useAbility(new THREE.Vector3(target.position.x, 0, target.position.z), engine, entry.skill);
        if (entry.class === 'Wizard') {
            expect(engine.addEntity).toHaveBeenCalledTimes(3);
            for (const [missile] of engine.addEntity.mock.calls) expect(missile.homingTarget).toBe(outside ? null : target);
            if (outside) {
                const angles = engine.addEntity.mock.calls.map(([missile]) => {
                    expect(missile.velocity.y).toBeCloseTo(0, 8);
                    return Math.atan2(missile.velocity.z, missile.velocity.x);
                }).sort((a, b) => a - b);
                for (let i = 0; i < 3; i++) expect(angles[i]).toBeCloseTo((i - 1) * .2, 8);
            }
            expect(caster.stats.mana).toBeLessThan(mana);
        } else if (outside) {
            expect(target.weakPointMarkTimer || 0).toBe(0);
            expect(caster.stats.mana).toBe(mana);
            expect(caster.cooldowns[entry.skill] || 0).toBe(0);
            expect(engine.spawnTransientEffect).not.toHaveBeenCalled();
        } else {
            expect(target.weakPointMarkTimer).toBe(10);
            expect(caster.stats.mana).toBeLessThan(mana);
        }
    });
});

test.each(['doorway', 'wall', 'friendly', 'merchant', 'dead', 'cursor-miss'])(
    'ranked offline homing selection retains %s rules', mode => {
        const caster = new Wizard('caster');
        caster.position.set(50009, 40, 50000);
        const target = mode === 'friendly' ? new Rogue('friend') : mode === 'merchant' ? new DwarfSalesman('merchant') : new Imp('enemy');
        target.position.set(50029.5, 40, 50000);
        if (mode === 'dead') target.state = 'DEAD';
        const rects = [{ x: 50000, z: 50000, width: 20, height: 20 }, { x: 50020.5, z: 50000, width: 20, height: 20 }];
        if (mode !== 'wall') rects.push({ x: 50010, z: 50000, width: 5, height: 6 });
        const engine = { currentInstanceId: 'dungeon_target_range', currentDungeonLayout: { walkRects: rects },
            chunkManager: { getActiveEntities: () => [target] } };
        const aim = target.position.clone();
        if (mode === 'cursor-miss') aim.z += 10;
        expect(findOfflineAbilityTarget(caster, engine, aim, { range: 21.6, cursorRadius: 4, padCursor: true }))
            .toBe(mode === 'doorway' ? target : null);
    });
