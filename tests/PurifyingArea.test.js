import fs from 'node:fs';
import { jest } from '@jest/globals';
import * as THREE from 'three';
import { AbilityController } from '../src/core/AbilityController.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { Actor } from '../src/entities/Actor.js';
import { Cleric } from '../src/entities/Cleric.js';
import { Wizard } from '../src/entities/Wizard.js';
import { getAbilityAoeRadius } from '../src/skills/abilityRadii.js';

const cases = JSON.parse(fs.readFileSync('server/internal/game/testdata/purifying_area.json', 'utf8'));
const skill = 'Purifying Wave';

describe.each(cases)('$name', entry => {
    test.each([false, true])('actual offline cleanse uses horizontal body-padded area, outside=%s', outside => {
        const p = new Cleric('wave-caster');
        p.unlockedSkills.push(skill);
        p.talentRanks = entry.ranks;
        p.position.set(60000, 40, 60000);
        p.bleedTimer = 10;
        const ally = new Wizard('wave-ally');
        ally.radius = 5;
        ally.position.set(p.position.x + entry.radius + ally.radius + (outside ? .01 : -.01), 0, p.position.z);
        for (const key of ['stunTimer', 'slowTimer', 'rootTimer', 'poisonTimer', 'bleedTimer', 'weakPointMarkTimer', 'markWeaknessTimer']) ally[key] = 10;
        for (const key of ['poisonStacks', 'poisonTickDamage', 'poisonTickTimer', 'bleedStacks', 'bleedTickDamage', 'bleedTickTimer']) ally[key] = 4;
        // The chunk listing need not include the local player; self-cleanse is mandatory.
        const engine = { chunkManager: { getActiveEntities: () => [ally] },
            spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() }, isHostileActorTarget: () => false };
        const before = p.stats.mana;
        p.useAbility(new THREE.Vector3(60100, 0, 60100), engine, skill);
        expect(p.stats.mana).toBe(before - 30);
        expect(p.bleedTimer).toBe(0);
        expect(getAbilityAoeRadius('Cleric', skill, p)).toBeCloseTo(entry.radius, 8);
        for (const key of ['stunTimer', 'slowTimer', 'rootTimer', 'poisonTimer', 'bleedTimer', 'weakPointMarkTimer', 'markWeaknessTimer']) expect(ally[key]).toBe(outside ? 10 : 0);
        for (const key of ['poisonStacks', 'poisonTickDamage', 'poisonTickTimer', 'bleedStacks', 'bleedTickDamage', 'bleedTickTimer']) expect(ally[key]).toBe(outside ? 4 : 0);
        const ring = engine.spawnTransientEffect.mock.calls.find(call => call[0] === 'ring');
        expect(ring[1].toArray()).toEqual(p.position.toArray());
        expect(ring[3].radius).toBeCloseTo(entry.radius, 8);
    });
    test.each(['high', 'low'])('%s predicted and rank-private remote meshes have the real footprint', quality => {
        for (const remote of [false, true]) {
            const p = { id: 'wave-caster', meshType: 'Cleric', position: new THREE.Vector3(60000, 40, 60000),
                mesh: new THREE.Group(), ...(remote ? {} : { talentRanks: entry.ranks }) };
            const engine = { effects: [], uiManager: { getGraphicsQuality: () => quality },
                renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 }, spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
        if (remote) new AbilityController(engine).triggerRemoteAbilityVisuals(p, skill, p.position.x + 3, p.position.z, { radius: entry.radius, arc: 2 * Math.PI });
            else Actor.prototype.spawnAbilityPresentation.call(p, engine, skill, new THREE.Vector3(60100, 0, 60100));
            try {
                const shapes = engine.effects.filter(effect => effect.abilityShape);
                expect(shapes).toHaveLength(1);
                const root = shapes[0].meshes[0];
                const boundary = root.children.find(part => part.userData.normalizedGameplayRadius === 1);
                expect(root.position.x).toBe(p.position.x + (remote ? 3 : 0));
                expect(root.position.z).toBe(p.position.z);
                expect(boundary.scale.x).toBeCloseTo(entry.radius, 8);
                expect(shapes[0].abilityShape.arc).toBeCloseTo(2 * Math.PI, 8);
            } finally { engine.effects.forEach(effect => effect.dispose()); }
        }
    });
});

test('offline wave protects enemies, PvP opponents and inactive/dead actors', () => {
    const p = new Cleric('wave-caster');
    p.unlockedSkills.push(skill);
    const targets = ['enemy', 'opponent', 'dead', 'inactive'].map(id => {
        const actor = id === 'enemy' ? new Actor(id, {}) : new Wizard(id);
        actor.bleedTimer = 10;
        if (id === 'dead') actor.state = 'DEAD';
        if (id === 'inactive') actor.isActive = false;
        return actor;
    });
    const engine = { chunkManager: { getActiveEntities: () => targets },
        spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() },
        isHostileActorTarget: actor => ['enemy', 'opponent'].includes(actor.id) };
    p.useAbility(p.position.clone(), engine, skill);
    expect(targets.map(actor => actor.bleedTimer)).toEqual([10, 10, 10, 10]);
});

test('accepted area corrects stale prediction without replaying cosmetics or animation', () => {
    const p = new Cleric('wave-caster');
    p.mesh = new THREE.Group();
    p.playAbilityAnimation = jest.fn();
    const engine = { player: p, effects: [], renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
        spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
    engine.abilityController = new AbilityController(engine);
    Actor.prototype.spawnAbilityPresentation.call(p, engine, skill, p.position.clone());
    const original = [...engine.effects];
    const payload = { sourceId: p.id, skillName: skill, targetX: p.position.x, targetZ: p.position.z, radius: 9.2, arc: 2 * Math.PI };
    p.position.x += 3; // The actor may move before its accepted cast arrives.
    try {
        GameEngine.prototype.handleServerMessage.call(engine, { type: 'ability', payload });
        for (const effect of original) {
            if (effect.abilityShape) expect(effect.isActive).toBe(false);
            else expect(engine.effects).toContain(effect);
        }
        expect(engine.effects.filter(effect => effect.abilityShape).map(effect => effect.abilityShape.radius)).toEqual([9.2]);
        expect(engine.effects.find(effect => effect.abilityShape).abilityShape.x).toBe(payload.targetX);
        expect(p.playAbilityAnimation).not.toHaveBeenCalled();
        const accepted = [...engine.effects];
        GameEngine.prototype.handleServerMessage.call(engine, { type: 'ability', payload });
        expect(engine.effects).toEqual(accepted);
    } finally { engine.effects.forEach(effect => effect.dispose()); }
});
