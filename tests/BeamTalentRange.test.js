import fs from 'node:fs';
import { jest } from '@jest/globals';
import * as THREE from 'three';
import { AbilityController } from '../src/core/AbilityController.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { Actor } from '../src/entities/Actor.js';
import { Wizard } from '../src/entities/Wizard.js';

const contract = JSON.parse(fs.readFileSync('server/internal/game/testdata/beam_talent_range.json', 'utf8'));

describe.each(contract)('$name beam range', entry => {
    test('targeting and pending cast intent match the server range', () => {
        const controller = Object.create(AbilityController.prototype);
        controller.engine = { player: { constructor: { name: 'Wizard' }, meshType: 'Wizard',
            abilityName: 'Scorch Beam', talentRanks: entry.ranks } };
        expect(controller.getAbilityCastRange('Scorch Beam')).toBeCloseTo(entry.range, 8);
        expect(controller.getAbilityIntentRange()).toBeCloseTo(entry.range, 8);
    });

    test.each(['high', 'low'])('%s predicted and remote meshes use the same endpoint without remote ranks', quality => {
        for (const remote of [false, true]) {
            const source = { meshType: 'Wizard', position: new THREE.Vector3(50009, 0, 50000),
                mesh: { quaternion: new THREE.Quaternion() }, ...(remote ? {} : { talentRanks: entry.ranks }) };
            const engine = { effects: [], currentInstanceType: 'overworld',
                uiManager: { getGraphicsQuality: () => quality },
                renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
                spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
            const aim = new THREE.Vector3(50010, 0, 50000);
            if (remote) {
                // The accepted event contains an endpoint, not the caster's cursor.
                AbilityController.prototype.triggerRemoteAbilityVisuals.call({ engine }, source,
                    'Scorch Beam', source.position.x + entry.range, source.position.z);
            } else {
                Actor.prototype.spawnAbilityPresentation.call(source, engine, 'Scorch Beam', aim);
            }
            try {
                const tip = engine.effects[0].meshes[0].getObjectByName('Wizard:Scorch Beam:0:beam:TargetBrand');
                expect(tip.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(50009 + entry.range, 6);
                expect(aim.toArray()).toEqual([50010, 0, 50000]);
                expect(source.position.toArray()).toEqual([50009, 0, 50000]);
            } finally { for (const effect of engine.effects) effect.dispose(); }
        }
    });
});

test.each([false, true])('ranked offline beam respects dungeon cover, doorway=%s', doorway => {
    const wizard = new Wizard('offline-beam');
    wizard.mesh = new THREE.Group();
    wizard.position.set(50009, 40, 50000);
    wizard.unlockedSkills.push('Scorch Beam');
    wizard.talentRanks = { WIZ_35: 5 };
    const target = new Actor('offline-target', {});
    target.position.set(50030, 40, 50000);
    target.isActive = true;
    target.takeDamage = jest.fn();
    const rects = [{ x: 50000, z: 50000, width: 20, height: 20 },
        { x: 50025, z: 50000, width: 30, height: 20 }];
    // Deliberate gap unless the doorway joins the rooms.
    rects[1].x = 50025.5;
    if (doorway) rects.push({ x: 50010, z: 50000, width: 5, height: 6 });
    wizard.useAbility(new THREE.Vector3(50010, 0, 50000), {
        currentInstanceId: 'dungeon_offline_beam', currentDungeonLayout: { walkRects: rects },
        chunkManager: { getActiveEntities: () => [target] },
        floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true)
    }, 'Scorch Beam');
    expect(target.takeDamage).toHaveBeenCalledTimes(doorway ? 1 : 0);
});

test('remote authoritative endpoint survives stale local ranks and dungeon layout', () => {
    const source = { meshType: 'Wizard', position: new THREE.Vector3(50009, 0, 50000),
        mesh: { quaternion: new THREE.Quaternion() }, talentRanks: { WIZ_35: 5 } };
    const engine = { effects: [], currentInstanceId: 'dungeon_stale_beam',
        currentDungeonLayout: { walkRects: [{ x: 50000, z: 50000, width: 20, height: 20 }] },
        renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
        spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
    AbilityController.prototype.triggerRemoteAbilityVisuals.call({ engine }, source, 'Scorch Beam', 50035.1, 50000);
    try {
        const tip = engine.effects[0].meshes[0].getObjectByName('Wizard:Scorch Beam:0:beam:TargetBrand');
        expect(tip.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(50035.1, 6);
    } finally { for (const effect of engine.effects) effect.dispose(); }
});
