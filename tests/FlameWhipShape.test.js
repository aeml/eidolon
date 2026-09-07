import fs from 'node:fs';
import { jest } from '@jest/globals';
import * as THREE from 'three';
import { AbilityController } from '../src/core/AbilityController.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { Actor } from '../src/entities/Actor.js';
import { Wizard } from '../src/entities/Wizard.js';
import { getAbilityAoeRadius } from '../src/skills/abilityRadii.js';

const contract = JSON.parse(fs.readFileSync('server/internal/game/testdata/flame_whip_shape.json', 'utf8'));
describe.each(contract)('$name Flame Whip', entry => {
    test('intent and predicted radius agree with the server', () => {
        const player = { meshType: 'Wizard', talentRanks: entry.ranks };
        expect(new AbilityController({ player }).getAbilityCastRange('Flame Whip')).toBeCloseTo(entry.radius, 8);
        expect(getAbilityAoeRadius('Wizard', 'Flame Whip', player)).toBeCloseTo(entry.radius, 8);
    });
    test.each([false, true])('offline planar body-padded hit; outside=%s', outside => {
        const player = new Wizard('whip');
        player.position.set(60000, 40, 60000);
        player.talentRanks = entry.ranks;
        player.unlockedSkills.push('Flame Whip');
        const target = new Actor('whip-target', {});
        target.radius = 4;
        target.position.set(player.position.x + entry.radius + 4 + (outside ? .01 : -.01), 0, player.position.z);
        target.isActive = true;
        target.takeDamage = jest.fn();
        player.useAbility(new THREE.Vector3(player.position.x + 1, 0, player.position.z), {
            chunkManager: { getActiveEntities: () => [target] },
            floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true)
        }, 'Flame Whip');
        expect(target.takeDamage).toHaveBeenCalledTimes(outside ? 0 : 1);
    });
});

test.each(['high', 'low'])('%s accepted remote cone uses transmitted shape, without private ranks', quality => {
    const source = { id: 'remote-whip', meshType: 'Wizard', position: new THREE.Vector3(), mesh: new THREE.Group() };
    const engine = { effects: [], uiManager: { getGraphicsQuality: () => quality },
        renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
        spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
    new AbilityController(engine).triggerRemoteAbilityVisuals(source, 'Flame Whip', 1, 0, { radius: 21.75, arc: 2 * Math.PI });
    try {
        const metadata = engine.effects[0].meshes[0].userData;
        expect(metadata.gameplayRadius).toBeCloseTo(21.75, 8);
        expect(metadata.gameplayArc).toBeCloseTo(2 * Math.PI, 8);
        const root = engine.effects[0].meshes[0];
        const boundary = root.children.find(part => part.userData.normalizedGameplayRadius === 1);
        expect(boundary.scale.x).toBeCloseTo(21.75, 8);
        expect(boundary.geometry.parameters.thetaLength).toBeCloseTo(2 * Math.PI, 8);
        expect(root.children.some(part => part.name.includes('ExactArcEdge'))).toBe(false);
    } finally { engine.effects.forEach(effect => effect.dispose()); }
});

function visualEngine(player, quality = 'high') {
    const engine = { player, effects: [], remotePlayers: new Map(),
        uiManager: { getGraphicsQuality: () => quality },
        renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
        spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
    engine.abilityController = new AbilityController(engine);
    return engine;
}

test.each(['high', 'low'])('%s local accepted shape replaces the prediction only when changed', quality => {
    const player = new Wizard('local-whip');
    player.mesh = new THREE.Group();
    player.playAbilityAnimation = jest.fn();
    const engine = visualEngine(player, quality);
    const aim = new THREE.Vector3(1, 0, 0);
    Actor.prototype.spawnAbilityPresentation.call(player, engine, 'Flame Whip', aim);
    const original = engine.effects[0];
    const data = { sourceId: player.id, skillName: 'Flame Whip', targetX: 1, targetZ: 0, radius: 12, arc: Math.PI / 2 };
    try {
        GameEngine.prototype.handleServerMessage.call(engine, { type: 'ability', payload: data });
        expect(engine.effects).toEqual([original]);
        expect(original.abilityShape.authoritative).toBe(true);
        GameEngine.prototype.handleServerMessage.call(engine, { type: 'ability', payload: { ...data, radius: 21.75, arc: 2 * Math.PI } });
        expect(original.isActive).toBe(false);
        expect(engine.effects).toHaveLength(1);
        const replacement = engine.effects[0];
        expect(replacement.meshes[0].userData).toMatchObject({ gameplayRadius: 21.75, gameplayArc: 2 * Math.PI });
        expect(player.playAbilityAnimation).not.toHaveBeenCalled();
        GameEngine.prototype.handleServerMessage.call(engine, { type: 'ability', payload: { ...data, radius: 21.75, arc: 2 * Math.PI } });
        expect(engine.effects).toEqual([replacement]);
    } finally { engine.effects.forEach(effect => effect.dispose()); }
});

test('network routing retains remote shape and legacy local events do not replay', () => {
    const engine = visualEngine(new Wizard('local'));
    const remote = { id: 'remote', meshType: 'Wizard', position: new THREE.Vector3() };
    engine.remotePlayers.set(remote.id, remote);
    engine.getReplicatedEntityById = () => null;
    engine.isPlayerClassEntity = () => true;
    engine.beginRemoteActionPresentation = jest.fn();
    engine.showRemoteActionReadability = jest.fn();
    engine.abilityController.triggerRemoteAbilityVisuals = jest.fn();
    const payload = { sourceId: remote.id, skillName: 'Flame Whip', targetX: 1, targetZ: 0, radius: 14.4, arc: Math.PI / 2 };
    GameEngine.prototype.handleServerMessage.call(engine, { type: 'ability', payload });
    expect(engine.abilityController.triggerRemoteAbilityVisuals).toHaveBeenCalledWith(remote, 'Flame Whip', 1, 0, payload);
    engine.abilityController.triggerRemoteAbilityVisuals.mockClear();
    GameEngine.prototype.handleServerMessage.call(engine, { type: 'ability', payload: { sourceId: 'local', skillName: 'Flame Whip' } });
    expect(engine.abilityController.triggerRemoteAbilityVisuals).not.toHaveBeenCalled();
});

test.each([false, true])('offline cone respects dungeon cover, doorway=%s', doorway => {
    const player = new Wizard('offline-wall-whip');
    player.unlockedSkills.push('Flame Whip');
    player.talentRanks = { WIZ_35: 5, WIZ_36: 5 };
    player.position.set(50009, 40, 50000);
    const target = new Actor('across-wall', {});
    target.position.set(50011, 0, 50000);
    target.isActive = true;
    target.takeDamage = jest.fn();
    const rects = [{ x: 50000, z: 50000, width: 20, height: 20 }, { x: 50020.5, z: 50000, width: 20, height: 20 }];
    if (doorway) rects.push({ x: 50010, z: 50000, width: 5, height: 6 });
    player.useAbility(new THREE.Vector3(50010, 0, 50000), {
        currentInstanceId: 'dungeon_whip', currentDungeonLayout: { walkRects: rects },
        chunkManager: { getActiveEntities: () => [target] },
        floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true)
    }, 'Flame Whip');
    expect(target.takeDamage).toHaveBeenCalledTimes(doorway ? 1 : 0);
});

test.each(['combo', 'expired', 'intervening'])('offline Teleport then Flame Whip: %s', mode => {
    jest.spyOn(Date, 'now').mockReturnValue(10000);
    const player = new Wizard('offline-combo');
    player.unlockedSkills.push('Teleport', 'Flame Whip', 'Arcane Shield');
    player.stats.mana = 1000;
    const target = new Actor('behind', {});
    target.position.set(-5, 0, 0);
    target.isActive = true;
    target.takeDamage = jest.fn();
    const engine = { chunkManager: { getActiveEntities: () => [target] },
        floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true) };
    try {
        player.useAbility(new THREE.Vector3(), engine, 'Teleport');
        if (mode === 'expired') Date.now.mockReturnValue(14000);
        if (mode === 'intervening') player.useAbility(new THREE.Vector3(), engine, 'Arcane Shield');
        engine.spawnTransientEffect.mockClear();
        player.useAbility(new THREE.Vector3(1, 0, 0), engine, 'Flame Whip');
        expect(target.takeDamage).toHaveBeenCalledTimes(mode === 'combo' ? 1 : 0);
        expect(engine.spawnTransientEffect.mock.calls[0][3].arc).toBe(mode === 'combo' ? 2 * Math.PI : Math.PI / 2);
    } finally { jest.restoreAllMocks(); }
});
