import fs from 'node:fs';
import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Cleric } from '../src/entities/Cleric.js';
import { Actor } from '../src/entities/Actor.js';
import { AbilityController } from '../src/core/AbilityController.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { getAbilityAoeRadius } from '../src/skills/abilityRadii.js';

const skill = 'Guardian Roar';
const cases = JSON.parse(fs.readFileSync('server/internal/game/testdata/guardian_roar_area.json', 'utf8'));

describe.each(cases)('$name', entry => {
    test.each([false, true])('offline trained body-padded ally area outside=%s', outside => {
        const p = new Fighter('roar-caster');
        p.unlockedSkills.push(skill); p.talentRanks = entry.ranks;
        p.stats.mana = 200; p.stats.maxMana = 200;
        p.position.set(60000, 40, 60000);
        const ally = new Cleric('roar-ally'); ally.radius = 5;
        ally.position.set(p.position.x + entry.radius + 5 + (outside ? .01 : -.01), 0, p.position.z);
        const engine = { chunkManager: { getActiveEntities: () => [ally] },
            spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() }, isHostileActorTarget: () => false };
        const mana = p.stats.mana;
        p.useAbility(p.position.clone().addScalar(100), engine, skill);
        expect(p.stats.mana).toBe(mana - 35);
        expect(p.guardianRoarTimer).toBe(10);
        expect(ally.guardianRoarTimer).toBe(outside ? 0 : 10);
        expect(getAbilityAoeRadius('Fighter', skill, p)).toBeCloseTo(entry.radius, 8);
        const rings = engine.spawnTransientEffect.mock.calls.filter(call => call[0] === 'ring');
        expect(rings).toHaveLength(1);
        expect(rings[0][3].radius).toBeCloseTo(entry.radius, 8);
    });
    test.each(['high', 'low'])('%s predicted and rank-private remote boundaries', quality => {
        for (const remote of [false, true]) {
            const p = { id: 'roar-caster', meshType: 'Fighter', position: new THREE.Vector3(60000, 40, 60000),
                mesh: new THREE.Group(), ...(remote ? {} : { talentRanks: entry.ranks }) };
            const engine = { effects: [], uiManager: { getGraphicsQuality: () => quality },
                renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 }, spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
            try {
                if (remote) new AbilityController(engine).triggerRemoteAbilityVisuals(p, skill, p.position.x + 3, p.position.z, { radius: entry.radius, arc: 2 * Math.PI });
                else Actor.prototype.spawnAbilityPresentation.call(p, engine, skill, new THREE.Vector3(60100, 0, 60100));
                const shapes = engine.effects.filter(effect => effect.abilityShape);
                expect(shapes).toHaveLength(1);
                const root = shapes[0].meshes[0];
                const boundary = root.children.find(part => part.userData.normalizedGameplayRadius === 1);
                expect(root.position.x).toBe(p.position.x + (remote ? 3 : 0));
                expect(boundary.scale.x).toBeCloseTo(entry.radius, 8);
                expect(shapes[0].abilityShape.arc).toBeCloseTo(2 * Math.PI, 8);
            } finally { engine.effects.forEach(effect => effect.dispose()); }
        }
    });
});

test.each([false, true])('offline Roar keeps friendly support across walls but blocks hostile feedback, doorway=%s', doorway => {
    const p = new Fighter('roar-caster'); p.unlockedSkills.push(skill); p.talentRanks = { FTR_33: 5 };
    p.stats.mana = 200; p.position.set(50009, 40, 50000);
    const targets = ['ally', 'enemy', 'opponent', 'dead', 'inactive'].map(id => {
        const target = id === 'enemy' ? new Actor(id, {}) : new Cleric(id);
        target.position.set(50011, 0, 50000);
        if (id === 'dead') target.state = 'DEAD';
        if (id === 'inactive') target.isActive = false;
        return target;
    });
    const engine = { currentInstanceId: 'dungeon_roar', currentDungeonLayout: { walkRects: [
        { x: 50000, z: 50000, width: 20, height: 20 }, { x: 50020.5, z: 50000, width: 20, height: 20 },
        ...(doorway ? [{ x: 50010, z: 50000, width: 5, height: 6 }] : [])] },
    chunkManager: { getActiveEntities: () => targets }, spawnTransientEffect: jest.fn(() => true),
    floatingTextManager: { spawn: jest.fn() }, isHostileActorTarget: actor => ['enemy', 'opponent'].includes(actor.id) };
    p.useAbility(p.position.clone(), engine, skill);
    expect(targets.map(target => target.guardianRoarTimer)).toEqual([10, 0, 0, 0, 0]);
    expect(engine.floatingTextManager.spawn.mock.calls.filter(([text]) => text === 'Taunted!')).toHaveLength(doorway ? 2 : 0);
});

test('accepted Roar corrects stale prediction at its original cast point without replaying animation', () => {
    const p = new Fighter('roar-caster'); p.mesh = new THREE.Group(); p.playAbilityAnimation = jest.fn();
    const engine = { player: p, effects: [], renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
        spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
    engine.abilityController = new AbilityController(engine);
    Actor.prototype.spawnAbilityPresentation.call(p, engine, skill, p.position.clone());
    const payload = { sourceId: p.id, skillName: skill, targetX: p.position.x, targetZ: p.position.z, radius: 17.25, arc: 2 * Math.PI };
    p.position.x += 3;
    try {
        GameEngine.prototype.handleServerMessage.call(engine, { type: 'ability', payload });
        const shapes = engine.effects.filter(effect => effect.isActive && effect.abilityShape);
        expect(shapes).toHaveLength(1);
        expect(shapes[0].abilityShape).toMatchObject({ radius: 17.25, x: payload.targetX, authoritative: true });
        expect(p.playAbilityAnimation).not.toHaveBeenCalled();
        const accepted = [...engine.effects];
        GameEngine.prototype.handleServerMessage.call(engine, { type: 'ability', payload });
        expect(engine.effects).toEqual(accepted);
    } finally { engine.effects.forEach(effect => effect.dispose()); }
});
