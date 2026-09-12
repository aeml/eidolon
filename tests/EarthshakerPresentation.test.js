import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Actor } from '../src/entities/Actor.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { AbilityController } from '../src/core/AbilityController.js';
import { resolveEarthshakerFootprint } from '../src/skills/earthshakerPresentation.js';

function fixture(quality = 'high') {
    const player = new Fighter('quake'); player.mesh = new THREE.Group();
    player.position.set(50000, 40, 50000);
    player.talentRanks = { FTR_14: 5, FTR_33: 5, FTR_38: 5 };
    player.playAbilityAnimation = jest.fn();
    const engine = { player, effects: [], uiManager: { getGraphicsQuality: () => quality },
        renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
        spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
    const controller = new AbilityController(engine); engine.abilityController = controller;
    const aim = player.position.clone().add(new THREE.Vector3(1, -40, 0));
    const event = (shapeKind, phase = '') => ({ sourceId: player.id, skillName: 'Earthshaker', shapeResolved: true,
        shapeKind, phase, radius: phase ? 4.725 : 8.1, arc: 2*Math.PI,
        origin: { x: 50000, z: 50000 }, targetX: 50001, targetZ: 50000 });
    const cleanup = () => { engine.effects.forEach(effect => effect.dispose()); player.dispose(); };
    return { player, engine, controller, aim, event, cleanup };
}

describe.each(['high', 'low'])('%s physical quake footprints', quality => {
    test.each(['circle', 'line'])('%s prediction and rank-private observer agree on the exact ground footprint', shapeKind => {
        const f = fixture(quality);
        f.player.skillRunes = { Earthshaker: shapeKind === 'line' ? 'earthshaker_fissure' : '' };
        try {
            Actor.prototype.spawnAbilityPresentation.call(f.player, f.engine, 'Earthshaker', f.aim);
            const predicted = f.engine.effects[0];
            expect(f.engine.effects).toHaveLength(1);
            const observer = { id: 'observer-quake', meshType: 'Fighter', mesh: new THREE.Group(),
                position: new THREE.Vector3(50200, 40, 50200), playAbilityAnimation: jest.fn() };
            f.controller.triggerRemoteAbilityVisuals(observer, 'Earthshaker', 50001, 50000, f.event(shapeKind));
            expect(observer.playAbilityAnimation).toHaveBeenCalledTimes(1);
            for (const effect of [predicted, f.engine.effects[1]]) {
                expect(effect.root.parent).toBe(f.engine.renderSystem.effectGroup);
                expect(effect.root.position.toArray()).toEqual([50000, 40, 50000]);
                expect(effect.abilityShape).toMatchObject({ radius: expect.closeTo(8.1, 8), shapeKind });
                const boundaries = effect.root.children.filter(child => child.userData.gameplayBoundary);
                expect(boundaries).toHaveLength(shapeKind === 'line' ? 4 : 1);
                effect.root.updateMatrixWorld(true);
                if (shapeKind === 'line') {
                    const sides = boundaries.filter(child => child.name.includes('FissureSide'));
                    const ends = boundaries.filter(child => child.name.includes('FissureEnd'));
                    expect(sides.map(child => child.position.x).sort((a,b) => a-b)).toEqual([expect.closeTo(-2.025, 8), expect.closeTo(2.025, 8)]);
                    expect(ends.map(child => child.position.z)).toEqual([0, expect.closeTo(8.1, 8)]);
                    const finish = ends[1].getWorldPosition(new THREE.Vector3());
                    expect(finish.x).toBeCloseTo(50008.1, 8); expect(finish.z).toBeCloseTo(50000, 8);
                    expect(effect.root.children.some(child => child.name.includes('ExactGameplayBoundary'))).toBe(false);
                } else {
                    expect(boundaries[0].scale.x).toBeCloseTo(8.1, 8);
                }
                const before = boundaries.map(child => child.matrixWorld.clone());
                effect.update(.2); effect.root.updateMatrixWorld(true);
                boundaries.forEach((child, i) => expect(child.matrixWorld.elements).toEqual(before[i].elements));
            }
        } finally { f.cleanup(); }
    });
});

test('accepted rune, heading and origin correct stale prediction without replaying the cast', () => {
    const f = fixture();
    f.player.talentRanks = {};
    try {
        Actor.prototype.spawnAbilityPresentation.call(f.player, f.engine, 'Earthshaker', f.aim);
        const original = f.engine.effects[0];
        expect(original.abilityShape.radius).toBe(6);
        const accepted = f.event('line'); accepted.targetX = 50000; accepted.targetZ = 50001;
        f.player.position.x += 100;
        f.controller.reconcileLocalAbilityShape(accepted);
        expect(original.isActive).toBe(false);
        expect(f.engine.effects).toHaveLength(1);
        const current = f.engine.effects[0];
        expect(current.abilityShape).toMatchObject({ radius: 8.1, x: 50000, z: 50000, shapeKind: 'line', authoritative: true, directionX: 0, directionZ: 1 });
        f.controller.reconcileLocalAbilityShape(accepted);
        expect(f.engine.effects).toEqual([current]);
        expect(f.player.playAbilityAnimation).not.toHaveBeenCalled();
    } finally { f.cleanup(); }
});

test('delayed Aftershock keeps its cast origin and does not replay remote animation or action feedback', () => {
    const f = fixture();
    try {
        const remote = { id: 'remote', meshType: 'Fighter', mesh: new THREE.Group(),
            position: new THREE.Vector3(50100, 40, 50100), playAbilityAnimation: jest.fn() };
        jest.spyOn(remote.mesh, 'lookAt');
        Object.assign(f.engine, { remotePlayers: new Map([[remote.id, remote]]),
            beginRemoteActionPresentation: jest.fn(), showRemoteActionReadability: jest.fn() });
        const payload = { ...f.event('circle', 'aftershock'), sourceId: remote.id };
        GameEngine.prototype.handleServerMessage.call(f.engine, { type: 'ability', payload });
        expect(f.engine.effects).toHaveLength(1);
        expect(f.engine.effects[0].abilityShape).toMatchObject({ radius: 4.725, x: 50000, z: 50000, phase: 'aftershock' });
        expect(remote.playAbilityAnimation).not.toHaveBeenCalled();
        expect(remote.mesh.lookAt).not.toHaveBeenCalled();
        expect(f.engine.beginRemoteActionPresentation).not.toHaveBeenCalled();
        expect(f.engine.showRemoteActionReadability).not.toHaveBeenCalled();
        f.engine.effects[0].update(1);
        expect(f.engine.effects[0].isActive).toBe(false);
    } finally { f.cleanup(); }
});

test('zero-distance prediction uses planar facing and invalid accepted geometry cannot replace a valid shape', () => {
    const f = fixture(); f.player.skillRunes = { Earthshaker: 'earthshaker_fissure' };
    f.player.mesh.rotation.y = Math.PI/2;
    try {
        expect(resolveEarthshakerFootprint(f.player, f.player.position).direction.x).toBeCloseTo(1, 8);
        Actor.prototype.spawnAbilityPresentation.call(f.player, f.engine, 'Earthshaker', f.player.position);
        const original = f.engine.effects[0];
        for (const corrupt of [{ radius: NaN }, { radius: 900 }, { shapeKind: 'unknown' }, { origin: null },
            { phase: 'unknown' }, { shapeKind: 'line', phase: 'aftershock' }, { targetX: Infinity }]) {
            f.controller.reconcileLocalAbilityShape({ ...f.event('line'), ...corrupt });
            expect(f.engine.effects).toEqual([original]); expect(original.isActive).toBe(true);
        }
    } finally { f.cleanup(); }
});
