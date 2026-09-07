import fs from 'node:fs';
import { jest } from '@jest/globals';
import * as THREE from 'three';
import { AbilityController } from '../src/core/AbilityController.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { Actor } from '../src/entities/Actor.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Projectile } from '../src/entities/Projectile.js';
import { eidolon } from '../src/proto/state_pb.js';
import { getAbilityAoeRadius } from '../src/skills/abilityRadii.js';

const contract = JSON.parse(fs.readFileSync('server/internal/game/testdata/ground_talent_shape.json', 'utf8'));
describe.each(contract)('$name', entry => {
    test('intent and area preserve separate range/area bonuses', () => {
        const player = { constructor: { name: 'Wizard' }, meshType: 'Wizard', talentRanks: entry.ranks, skillRunes: { [entry.skill]: entry.rune } };
        expect(new AbilityController({ player }).getAbilityCastRange(entry.skill)).toBeCloseTo(entry.range, 8);
        expect(getAbilityAoeRadius('Wizard', entry.skill, player)).toBeCloseTo(entry.visualRadius, 8);
    });
    test('offline cast clamps placement and preserves its effect radius', () => {
        const player = new Wizard('ground-caster');
        player.position.set(60000, 40, 60000);
        player.talentRanks = entry.ranks;
        player.skillRunes = { [entry.skill]: entry.rune };
        player.unlockedSkills.push(entry.skill);
        const engine = { currentInstanceId: 'dungeon_ground_shape', addEntity: jest.fn(),
            spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() },
            chunkManager: { getActiveEntities: () => [] } };
        const aim = new THREE.Vector3(60100, 0, 60000);
        player.useAbility(aim, engine, entry.skill);
        const ring = engine.spawnTransientEffect.mock.calls.find(call => call[0] === 'ring');
        expect(ring[1].x).toBeCloseTo(player.position.x + entry.range, 8);
        expect(ring[3].radius).toBeCloseTo(entry.visualRadius, 8);
        const effect = engine.addEntity.mock.calls[0]?.[0];
        if (effect) {
            expect(effect.position.x).toBeCloseTo(player.position.x + entry.range, 8);
            expect(effect.explosionRadius ?? effect.radius).toBeCloseTo(entry.visualRadius, 8);
            effect.dispose?.();
        }
        expect(aim.toArray()).toEqual([60100, 0, 60000]);
    });
});

describe.each(contract)('$name actual meshes', entry => {
    test.each(['high', 'low'])('%s predicted and accepted remote shapes match', quality => {
        for (const remote of [false, true]) {
            const player = { id: 'caster', meshType: 'Wizard', position: new THREE.Vector3(60000, 0, 60000),
                mesh: new THREE.Group(), ...(remote ? {} : { talentRanks: entry.ranks, skillRunes: { [entry.skill]: entry.rune } }) };
            const engine = { effects: [], uiManager: { getGraphicsQuality: () => quality },
                renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
                spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
            if (remote) new AbilityController(engine).triggerRemoteAbilityVisuals(player, entry.skill, 60000 + entry.range, 60000,
                { radius: entry.visualRadius, arc: 2 * Math.PI });
            else Actor.prototype.spawnAbilityPresentation.call(player, engine, entry.skill, new THREE.Vector3(60100, 0, 60000));
            try {
                const shapes = engine.effects.filter(effect => effect.abilityShape);
                expect(shapes.length).toBeGreaterThan(0);
                for (const effect of shapes) {
                    const root = effect.meshes[0];
                    const boundary = root.children.find(part => part.userData.normalizedGameplayRadius === 1);
                    expect(root.position.x).toBeCloseTo(60000 + entry.range, 8);
                    expect(boundary.scale.x).toBeCloseTo(entry.visualRadius, 8);
                }
            } finally { engine.effects.forEach(effect => effect.dispose()); }
        }
    });
});

test.each(['Gravity Well', 'Meteor Drop', 'Inferno Cataclysm'])('%s accepted correction retains cosmetics and does not replay matching shapes', skill => {
    const player = new Wizard('local-ground');
    player.mesh = new THREE.Group();
    player.playAbilityAnimation = jest.fn();
    const engine = { player, effects: [], renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
        spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
    engine.abilityController = new AbilityController(engine);
    Actor.prototype.spawnAbilityPresentation.call(player, engine, skill, new THREE.Vector3(10, 0, 0));
    const originals = [...engine.effects];
    const payload = { sourceId: player.id, skillName: skill, targetX: 10, targetZ: 0,
        radius: getAbilityAoeRadius('Wizard', skill, player), arc: 2 * Math.PI };
    try {
        GameEngine.prototype.handleServerMessage.call(engine, { type: 'ability', payload });
        expect(engine.effects).toEqual(originals);
        GameEngine.prototype.handleServerMessage.call(engine, { type: 'ability', payload: { ...payload, targetX: 11, radius: payload.radius * 1.1 } });
        for (const original of originals) {
            if (original.abilityShape) expect(original.isActive).toBe(false);
            else expect(engine.effects).toContain(original);
        }
        expect(engine.effects).toHaveLength(originals.length);
        for (const effect of engine.effects.filter(effect => effect.abilityShape)) {
            expect(effect.abilityShape).toMatchObject({ x: 11, radius: payload.radius * 1.1, authoritative: true });
        }
        expect(player.playAbilityAnimation).not.toHaveBeenCalled();
    } finally { engine.effects.forEach(effect => effect.dispose()); }
});

describe.each(contract.filter(entry => entry.skill === 'Meteor Drop'))('$name offline ground impact', entry => {
    test.each([false, true])('impacts empty ground once and respects the padded radius, outside=%s', outside => {
        const player = new Wizard('meteor-ground');
        player.unlockedSkills.push(entry.skill);
        player.talentRanks = entry.ranks;
        player.skillRunes = { [entry.skill]: entry.rune };
        const target = new Actor('meteor-edge', {});
        target.radius = 4;
        target.isActive = true;
        target.position.set(5, 40, entry.visualRadius + target.radius + (outside ? .01 : -.01));
        target.takeDamage = jest.fn();
        const projectiles = [];
        const engine = { chunkManager: { getActiveEntities: () => [target] }, addEntity: e => projectiles.push(e),
            floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true) };
        player.useAbility(new THREE.Vector3(5, 0, 0), engine, entry.skill);
        player.talentRanks = {}; // The projectile must retain its cast-time radius.
        const meteor = projectiles[0];
        try {
            meteor.update(1, null, player, engine.chunkManager, engine.floatingTextManager, engine);
            expect(target.takeDamage).not.toHaveBeenCalled();
            meteor.update(.6, null, player, engine.chunkManager, engine.floatingTextManager, engine);
            expect(meteor.isActive).toBe(false);
            expect(meteor.position.toArray()).toEqual([5, 0, 0]);
            expect(target.takeDamage).toHaveBeenCalledTimes(outside ? 0 : 1);
            meteor.update(1, null, player, engine.chunkManager, engine.floatingTextManager, engine);
            expect(target.takeDamage).toHaveBeenCalledTimes(outside ? 0 : 1);
            const impact = engine.spawnTransientEffect.mock.calls.find(call => call[0] === 'projectile_impact');
            expect(impact[3].radius).toBeCloseTo(entry.visualRadius, 8);
        } finally { projectiles.forEach(projectile => projectile.dispose()); }
    });
});

test.each([false, true])('offline Gravity Well is one covered, body-aware pull; doorway=%s', doorway => {
    const player = new Wizard('well');
    player.unlockedSkills.push('Gravity Well');
    player.position.set(50009, 40, 50000);
    player.talentRanks = { WIZ_38: 5 };
    const target = new Actor('well-target', {});
    target.isActive = true;
    target.position.set(50011, 0, 50000);
    target.takeDamage = jest.fn();
    const rects = [{ x: 50000, z: 50000, width: 20, height: 20 }, { x: 50020.5, z: 50000, width: 20, height: 20 }];
    if (doorway) rects.push({ x: 50010, z: 50000, width: 5, height: 6 });
    const engine = { currentInstanceId: 'dungeon_well', currentDungeonLayout: { walkRects: rects },
        chunkManager: { getActiveEntities: () => [target] }, addEntity: jest.fn(),
        floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true) };
    player.useAbility(player.position.clone(), engine, 'Gravity Well');
    expect(target.takeDamage).toHaveBeenCalledTimes(doorway ? 1 : 0);
    expect(target.position.x).toBe(doorway ? 50010 : 50011);
    expect(target.slowTimer).toBe(doorway ? 3 : 0);
    expect(engine.addEntity).not.toHaveBeenCalled();
});

test('Meteor protobuf footprint survives snapshot sync and removal-before-impact fallback', () => {
    const player = new Wizard('owner-without-ranks');
    const projectile = new Projectile('snapshot-meteor', player, 'Meteor', new THREE.Vector3(3, 30, 4), new THREE.Vector3(3, 0, 4));
    const wire = eidolon.state.Entity.decode(eidolon.state.Entity.encode({
        id: projectile.id, type: 'Projectile', subType: 'Meteor', x: 3, y: 30, z: 4, impactRadius: 49.5, scale: 1, state: 'MOVING'
    }).finish());
    const engine = { player, currentInstanceId: 'dungeon_radius', remotePlayers: new Map([[projectile.id, projectile]]),
        clearAuthoritativeJumpState: jest.fn(), showRemoteStateReadability: jest.fn(), syncRemoteSupportEffects: jest.fn(),
        syncPlayerStatusClears: jest.fn(), syncPlayerStatusDetails: jest.fn(),
        chunkManager: { updateEntityChunk: jest.fn(), getChunkKey: () => 'test', chunks: new Map() },
        spawnTransientEffect: jest.fn(() => true), renderProjectileImpactFeedback: GameEngine.prototype.renderProjectileImpactFeedback };
    GameEngine.prototype.syncRemoteEntity.call(engine, projectile, wire);
    expect(projectile.explosionRadius).toBe(49.5);
    GameEngine.prototype.removeRemoteEntity.call(engine, projectile.id);
    expect(engine.lastProjectileImpactPresentation.radius).toBe(49.5);
    expect(engine.renderProjectileImpactFeedback({ projectileId: projectile.id, projectileType: 'Meteor',
        sourceId: player.id, instanceId: 'dungeon_radius', x: 3, y: 0, z: 4, radius: 49.5, terminal: true })).toBe(false);
    expect(engine.spawnTransientEffect).toHaveBeenCalledTimes(1);
});

test.each(['Gravity Well', 'Meteor Drop', 'Inferno Cataclysm'])('%s rejects offline dungeon wall before resources or visuals', skill => {
    const player = new Wizard('ground-wall');
    player.unlockedSkills.push(skill);
    player.position.set(50009, 40, 50000);
    const engine = { currentInstanceId: 'dungeon_wall', currentDungeonLayout: { walkRects: [
        { x: 50000, z: 50000, width: 20, height: 20 }, { x: 50020.5, z: 50000, width: 20, height: 20 }
    ] }, chunkManager: { getActiveEntities: () => [] }, addEntity: jest.fn(),
    floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true) };
    const mana = player.stats.mana;
    player.useAbility(new THREE.Vector3(50011, 0, 50000), engine, skill);
    expect(player.stats.mana).toBe(mana);
    expect(player.cooldowns[skill] || 0).toBe(0);
    expect(engine.addEntity).not.toHaveBeenCalled();
    expect(engine.spawnTransientEffect).not.toHaveBeenCalled();
});

test('offline Inferno ticks respect planar padded bodies and dungeon cover', () => {
    const player = new Wizard('inferno');
    player.unlockedSkills.push('Inferno Cataclysm');
    player.position.set(50009, 40, 50000);
    const target = new Actor('victim', {});
    target.isActive = true;
    target.position.set(50011, 0, 50000);
    target.takeDamage = jest.fn();
    let zone;
    const engine = { currentInstanceId: 'dungeon_inferno', currentDungeonLayout: { walkRects: [
        { x: 50000, z: 50000, width: 20, height: 20 }, { x: 50020.5, z: 50000, width: 20, height: 20 }
    ] }, chunkManager: { getActiveEntities: () => [target] }, addEntity: entity => { zone = entity; },
    floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true) };
    player.useAbility(player.position.clone(), engine, 'Inferno Cataclysm');
    try {
        zone.performTick(engine.chunkManager);
        expect(target.takeDamage).not.toHaveBeenCalled();
        engine.currentDungeonLayout.walkRects.push({ x: 50010, z: 50000, width: 5, height: 6 });
        zone.performTick(engine.chunkManager);
        expect(target.takeDamage).toHaveBeenCalledTimes(1);
        engine.isHostileActorTarget = () => false;
        zone.performTick(engine.chunkManager);
        expect(target.takeDamage).toHaveBeenCalledTimes(1);
    } finally { zone.dispose(); }
});
