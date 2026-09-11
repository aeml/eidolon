import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Wizard } from '../src/entities/Wizard.js';
import { AbilityController } from '../src/core/AbilityController.js';
import { GameEngine } from '../src/core/GameEngine.js';

function fixture() {
    const source = new Wizard('warp-visual');
    source.position.set(60000, 40, 60000);
    source.level = 100;
    source.unlockedSkills.push('Teleport');
    source.skillRunes = { Teleport: 'teleport_warp' };
    source.talentRanks = { WIZ_36: 5, WIZ_38: 5 };
    source.stats.mana = 200;
    const calls = [];
    const engine = { player: source, currentInstanceId: 'visual-dungeon',
        currentDungeonLayout: { walkRects: [{ x: 60000, z: 60000, width: 20, height: 20 }] },
        spawnTransientEffect: jest.fn((type, position, color, options) => {
            calls.push({ type, position: position.clone(), color, options }); return true;
        }), chunkManager: { getActiveEntities: () => [] } };
    source.gameEngine = engine;
    return { source, engine, calls, controller: new AbilityController(engine) };
}

test('paid offline Warp shows both trained rings at departure and actual wall-clipped landing', () => {
    const f = fixture();
    try {
        f.source.useAbility(new THREE.Vector3(60012, -20, 60000), f.engine, 'Teleport');
        const rings = f.calls.filter(c => c.type === 'ring');
        expect(rings).toHaveLength(2);
        expect(rings.map(c => c.position.toArray())).toEqual([[60000, 40, 60000], f.source.position.toArray()]);
        expect(f.source.position.x).toBe(60010);
        for (const ring of rings) expect(ring.options).toMatchObject({ radius: 5, arc: 2 * Math.PI, abilityName: 'Teleport' });
        expect(f.calls).toHaveLength(4);
    } finally { f.source.dispose(); }
});

test.each([4, 5])('observer uses accepted origin and radius %s without private runes or ranks', radius => {
    const f = fixture();
    try {
        f.source.position.set(60020, 40, 60020); // Newer snapshot than cast event.
        f.source.skillRunes = {}; f.source.talentRanks = {};
        f.controller.triggerRemoteAbilityVisuals(f.source, 'Teleport', 60009, 60000,
            { origin: { x: 60000, z: 60000 }, radius, arc: 2 * Math.PI, shapeResolved: true });
        const rings = f.calls.filter(c => c.type === 'ring');
        expect(rings).toHaveLength(2);
        expect(rings.map(c => [c.position.x, c.position.z])).toEqual([[60000, 60000], [60009, 60000]]);
        rings.forEach(c => expect(c.options).toMatchObject({ radius, arc: 2 * Math.PI, authoritativeShape: true }));
        expect([f.calls[0].position.x, f.calls[0].position.z]).toEqual([60000, 60000]);
    } finally { f.source.dispose(); }
});

test('accepted non-Warp event suppresses stale local rune rings', () => {
    const f = fixture();
    try {
        f.controller.triggerRemoteAbilityVisuals(f.source, 'Teleport', 60009, 60000,
            { origin: { x: 60000, z: 60000 }, shapeResolved: true });
        expect(f.calls.map(c => c.type)).toEqual(['smoke', 'burst']);
    } finally { f.source.dispose(); }
});

test.each(['', 'teleport_blink', 'teleport_phase'])('paid offline %s has no misleading damage boundary', rune => {
    const f = fixture();
    try {
        f.source.skillRunes.Teleport = rune;
        f.source.useAbility(new THREE.Vector3(60005, 40, 60000), f.engine, 'Teleport');
        expect(f.calls.map(c => c.type)).toEqual(['smoke', 'burst']);
    } finally { f.source.dispose(); }
});

test.each(['mana', 'cooldown', 'dead', 'stunned', 'locked'])('rejected %s Warp produces no endpoint effects', reason => {
    const f = fixture();
    try {
        if (reason === 'mana') f.source.stats.mana = 0;
        if (reason === 'cooldown') f.source.cooldowns.Teleport = 10;
        if (reason === 'dead') f.source.state = 'DEAD';
        if (reason === 'stunned') f.source.stunTimer = 1;
        if (reason === 'locked') f.source.unlockedSkills = [];
        f.source.useAbility(new THREE.Vector3(60005, 40, 60000), f.engine, 'Teleport');
        expect(f.calls.length).toBe(0);
    } finally { f.source.dispose(); }
});

test('multiplayer intent defers location effects until accepted event, without replaying animation', () => {
    const f = fixture();
    try {
        f.engine.isMultiplayer = true;
        f.source.useAbility(new THREE.Vector3(60012, 40, 60000), f.engine, 'Teleport');
        expect(f.calls).toHaveLength(0);
        const animation = jest.spyOn(f.source, 'playAbilityAnimation');
        f.controller.reconcileLocalAbilityShape({ skillName: 'Teleport', targetX: 60009, targetZ: 60000,
            origin: { x: 60000, z: 60000 }, radius: 5, arc: 2 * Math.PI, shapeResolved: true });
        expect(f.calls).toHaveLength(4);
        expect(animation).not.toHaveBeenCalled();
    } finally { f.source.dispose(); }
});

describe.each(['high', 'low'])('%s actual Teleport meshes', quality => {
    test.each(['local', 'observer'])('%s accepted message fixes both boundaries and expires all effects', perspective => {
        const f = fixture();
        const engine = Object.assign(Object.create(GameEngine.prototype), f.engine, {
            effects: [], remotePlayers: new Map(),
            uiManager: { getGraphicsQuality: () => quality },
            renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1, setCameraTarget: jest.fn() },
            spawnTransientEffect: GameEngine.prototype.spawnTransientEffect,
            beginPlayerCorrectionVisual: jest.fn(), clearCombatIntentState: jest.fn(),
            beginRemoteActionPresentation: jest.fn(), showRemoteActionReadability: jest.fn()
        });
        engine.chunkManager.updateEntityChunk = jest.fn();
        engine.abilityController = new AbilityController(engine);
        f.source.skillRunes = {}; f.source.talentRanks = {};
        f.source.position.set(60020, 40, 60020);
        if (perspective === 'observer') {
            engine.player = { id: 'observer', position: new THREE.Vector3(60005, 40, 60005) };
            engine.remotePlayers.set(f.source.id, f.source);
        }
        try {
            engine.handleServerMessage({ type: 'ability', payload: { sourceId: f.source.id, skillName: 'Teleport',
                targetX: 60009, targetZ: 60000, origin: { x: 60000, z: 60000 },
                radius: 5, arc: 2 * Math.PI, shapeResolved: true } });
            expect(engine.effects.length).toBe(4);
            const rings = engine.effects.filter(effect => effect.abilityShape);
            expect(rings.length).toBe(2);
            expect(rings.map(effect => [effect.abilityShape.x, effect.abilityShape.z]))
                .toEqual([[60000, 60000], [60009, 60000]]);
            for (const effect of rings) {
                expect(effect.abilityShape).toMatchObject({ skillName: 'Teleport', radius: 5, arc: 2 * Math.PI, authoritative: true });
                const root = effect.meshes[0];
                expect(root.position.y).toBe(40);
                const boundary = root.children.find(part => part.userData.normalizedGameplayRadius === 1);
                expect(boundary.visible).toBe(true);
                expect(boundary.scale.x).toBe(5);
                effect.update(.2);
                expect(boundary.scale.x).toBe(5);
            }
            if (perspective === 'local') expect(f.source.position.toArray()).toEqual([60009, 40, 60000]);
            engine.effects.forEach(effect => effect.update(2));
            expect(engine.renderSystem.effectGroup.children.length).toBe(0);
        } finally { engine.effects.forEach(effect => effect.dispose()); f.source.dispose(); }
    });
});
