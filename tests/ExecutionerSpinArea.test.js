import fs from 'node:fs';
import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Actor } from '../src/entities/Actor.js';
import { Cleric } from '../src/entities/Cleric.js';
import { AbilityController } from '../src/core/AbilityController.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { getAbilityAoeRadius } from '../src/skills/abilityRadii.js';

const skill = 'Executioner Spin';
const cases = JSON.parse(fs.readFileSync('server/internal/game/testdata/executioner_spin_area.json', 'utf8'));
function fixture(ranks = {}) {
    const p = new Fighter('spin-caster'); p.unlockedSkills.push(skill); p.talentRanks = ranks;
    p.stats.mana = 200; p.stats.maxMana = 200; p.stats.damage = 100; p.stats.strength = 10;
    p.position.set(60000, 40, 60000);
    const entities = [];
    const engine = { chunkManager: { getActiveEntities: () => entities },
        spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() },
        isHostileActorTarget: target => target instanceof Actor && !(target instanceof Cleric) };
    return { p, engine, entities };
}

describe.each(cases)('$name', entry => {
    test.each([false, true])('offline paid single strike reaches padded boundary outside=%s', outside => {
        const { p, engine, entities } = fixture(entry.ranks);
        const target = new Actor('spin-enemy', {}); target.radius = 5;
        target.position.set(p.position.x + entry.radius + 5 + (outside ? .01 : -.01), 0, p.position.z);
        target.takeDamage = jest.fn(); entities.push(target);
        p.useAbility(p.position.clone().addScalar(100), engine, skill);
        expect(p.stats.mana).toBe(160);
        expect(target.takeDamage).toHaveBeenCalledTimes(outside ? 0 : 1);
        if (!outside) expect(target.takeDamage.mock.calls[0][0]).toBe(Math.floor(130 * 1.3 * (1 + .02 * (entry.ranks.FTR_38 || 0))));
        expect(p.isWhirlwinding).toBeFalsy(); // Animation must not enable later repeated damage.
        expect(p.cooldowns[skill]).toBeCloseTo(15 * (1 - p.stats.cooldownReduction) * (1 - .03 * (entry.ranks.FTR_24 || 0)), 8);
        expect(getAbilityAoeRadius('Fighter', skill, p)).toBeCloseTo(entry.radius, 8);
    });
    test.each(['high', 'low'])('%s local and rank-private remote rings match the strike', quality => {
        for (const remote of [false, true]) {
            const p = { id: 'spin-caster', meshType: 'Fighter', mesh: new THREE.Group(),
                position: new THREE.Vector3(60000, 40, 60000), ...(remote ? {} : { talentRanks: entry.ranks }) };
            const engine = { effects: [], uiManager: { getGraphicsQuality: () => quality },
                renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
                spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
            try {
                if (remote) new AbilityController(engine).triggerRemoteAbilityVisuals(p, skill, 60002, 60000, { radius: entry.radius, arc: 2 * Math.PI });
                else Actor.prototype.spawnAbilityPresentation.call(p, engine, skill, new THREE.Vector3(60100, 0, 60100));
                const shapes = engine.effects.filter(effect => effect.abilityShape);
                expect(shapes).toHaveLength(1);
                const root = shapes[0].meshes[0];
                expect(root.position.x).toBe(remote ? 60002 : 60000);
                expect(root.children.find(part => part.userData.normalizedGameplayRadius === 1).scale.x).toBeCloseTo(entry.radius, 8);
                expect(shapes[0].abilityShape.arc).toBeCloseTo(2 * Math.PI, 8);
            } finally { engine.effects.forEach(effect => effect.dispose()); }
        }
    });
});

test.each([false, true])('offline spin preserves walls and excluded targets, doorway=%s', doorway => {
    const { p, engine, entities } = fixture({ FTR_33: 5 });
    p.position.set(50009, 40, 50000);
    engine.currentInstanceId = 'dungeon_spin'; engine.currentDungeonLayout = { walkRects: [
        { x: 50000, z: 50000, width: 20, height: 20 }, { x: 50020.5, z: 50000, width: 20, height: 20 },
        ...(doorway ? [{ x: 50010, z: 50000, width: 5, height: 6 }] : [])] };
    for (const id of ['enemy', 'ally', 'dead', 'inactive']) {
        const target = id === 'ally' ? new Cleric(id) : new Actor(id, {});
        target.position.set(50011, 0, 50000); target.takeDamage = jest.fn();
        if (id === 'dead') target.state = 'DEAD';
        if (id === 'inactive') target.isActive = false;
        entities.push(target);
    }
    p.useAbility(p.position.clone(), engine, skill);
    expect(entities.map(target => target.takeDamage.mock.calls.length)).toEqual([doorway ? 1 : 0, 0, 0, 0]);
});

test.each(['none', 'weak-point', 'weakness', 'threat'])('offline strike preserves mastery and marked/threat bonus: %s', status => {
    const { p, engine, entities } = fixture({ FTR_23: 5, FTR_38: 5 });
    const target = new Actor('spin-enemy', {}); target.position.copy(p.position); target.takeDamage = jest.fn();
    if (status === 'weak-point') target.weakPointMarkTimer = 10;
    if (status === 'weakness') target.markWeaknessTimer = 10;
    if (status === 'threat') target.threat = { [p.id]: 10 };
    entities.push(target); p.useAbility(p.position.clone(), engine, skill);
    const base = Math.floor(130 * 1.3 * 1.3);
    expect(target.takeDamage).toHaveBeenCalledWith(status === 'none' ? base : Math.floor(base * 1.5), p);
});

test('offline animation cannot repeat damage or hit a target reached after the cast', () => {
    const { p, engine, entities } = fixture();
    const target = new Actor('spin-enemy', {}); target.position.copy(p.position); target.takeDamage = jest.fn();
    const later = new Actor('later', {}); later.position.copy(p.position).addScalar(50); later.takeDamage = jest.fn();
    entities.push(target, target, later); // Duplicate broadphase references must still produce one strike.
    p.useAbility(p.position.clone(), engine, skill);
    expect(target.takeDamage).toHaveBeenCalledTimes(1);
    const update = jest.spyOn(Actor.prototype, 'update').mockImplementation(() => {});
    try {
        p.position.copy(later.position);
        for (let tick = 0; tick < 10; tick++) p.update(.21, null, null, engine.chunkManager, engine.floatingTextManager);
        expect(target.takeDamage).toHaveBeenCalledTimes(1); expect(later.takeDamage).not.toHaveBeenCalled();
    } finally { update.mockRestore(); }
});

test.each(['mana', 'cooldown', 'multiplayer'])('%s never executes offline damage', mode => {
    const { p, engine, entities } = fixture();
    const target = new Actor('spin-enemy', {}); target.position.copy(p.position); target.takeDamage = jest.fn(); entities.push(target);
    if (mode === 'mana') p.stats.mana = 0;
    if (mode === 'cooldown') p.cooldowns[skill] = 3;
    if (mode === 'multiplayer') engine.isMultiplayer = true;
    p.useAbility(p.position.clone(), engine, skill);
    expect(target.takeDamage).not.toHaveBeenCalled();
});

test('accepted spin corrects its original footprint without replaying animation', () => {
    const p = new Fighter('spin-caster'); p.mesh = new THREE.Group(); p.playAbilityAnimation = jest.fn();
    const engine = { player: p, effects: [], renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
        spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
    engine.abilityController = new AbilityController(engine);
    Actor.prototype.spawnAbilityPresentation.call(p, engine, skill, p.position.clone());
    const payload = { sourceId: p.id, skillName: skill, targetX: p.position.x, targetZ: p.position.z, radius: 8.1, arc: 2 * Math.PI };
    p.position.x += 3;
    try {
        GameEngine.prototype.handleServerMessage.call(engine, { type: 'ability', payload });
        const shapes = engine.effects.filter(effect => effect.isActive && effect.abilityShape);
        expect(shapes).toHaveLength(1); expect(shapes[0].abilityShape).toMatchObject({ radius: 8.1, x: payload.targetX, authoritative: true });
        expect(p.playAbilityAnimation).not.toHaveBeenCalled();
        const accepted = [...engine.effects];
        GameEngine.prototype.handleServerMessage.call(engine, { type: 'ability', payload });
        expect(engine.effects).toEqual(accepted);
    } finally { engine.effects.forEach(effect => effect.dispose()); }
});
