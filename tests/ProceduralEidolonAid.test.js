import { jest } from '@jest/globals';
import * as THREE from 'three';
import { createTransientEffect } from '../src/core/TransientEffects.js';
import { createEidolonAidPresentation } from '../src/art/ProceduralEidolonAid.js';
import { GameEngine } from '../src/core/GameEngine.js';

test.each([1, 2, 3, 4])('phase %s has a distinct, bounded airborne cue at the supplied world height', phase => {
    for (const quality of ['low', 'high']) {
        const scene = new THREE.Group(), position = new THREE.Vector3(2, 14, 5);
        const effect = createTransientEffect(scene, 'eidolon_aid', position, 0xffffff, { phase, quality });
        const root = effect.meshes[0];
        expect(root.position.equals(position)).toBe(true);
        expect(root.userData.eidolonAidPhase).toBe(phase);
        expect(root.children).toHaveLength(quality === 'low' ? 4 : 8);
        for (let i = 0; i < 6; i++) {
            effect.update(.3);
            for (const mote of root.children) {
                expect(mote.position.y).toBeGreaterThan(.2);
                expect(Math.hypot(mote.position.x, mote.position.z)).toBeLessThanOrEqual(.73);
                expect(mote.material.depthWrite).toBe(false);
                expect(mote.material.opacity).toBeGreaterThanOrEqual(0);
                expect(mote.material.opacity).toBeLessThanOrEqual(.7);
            }
        }
        const geometry = root.children[0].geometry;
        const disposeGeometry = jest.spyOn(geometry, 'dispose');
        const materialSpies = [...new Set(root.children.map(child => child.material))].map(material => jest.spyOn(material, 'dispose'));
        effect.update(1);
        expect(effect.isActive).toBe(false);
        expect(scene.children).toHaveLength(0);
        expect(disposeGeometry).toHaveBeenCalledTimes(1);
        materialSpies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
        effect.dispose();
        expect(disposeGeometry).toHaveBeenCalledTimes(1);
        expect(position).toEqual(new THREE.Vector3(2, 14, 5));
    }
});

test('four elements use four different silhouettes, with no unknown-phase effect', () => {
    const effects = [1, 2, 3, 4].map(phase => createEidolonAidPresentation(phase, 'low'));
    expect(new Set(effects.map(effect => effect.root.children[0].geometry.type)).size).toBe(4);
    expect(createEidolonAidPresentation(5)).toBeNull();
    effects.forEach(effect => {
        effect.root.children[0].geometry.dispose();
        [...new Set(effect.root.children.map(child => child.material))].forEach(material => material.dispose());
    });
});

test('only a living observer in the matching instance spawns aid, without changing resources', () => {
    const engine = Object.create(GameEngine.prototype);
    engine.currentInstanceId = 'court';
    engine.renderSystem = { effectGroup: new THREE.Group() };
    engine.spawnTransientEffect = jest.fn();
    engine.player = { state: 'IDLE', position: new THREE.Vector3(), stats: { hp: 32, mp: 10 } };
    const event = { type: 'raid_phase', payload: { instanceId: 'court', phase: 2 } };
    engine.handleServerMessage(event);
    expect(engine.spawnTransientEffect).toHaveBeenCalledWith('eidolon_aid', engine.player.position, 0xffffff, { phase: 2 });
    expect(engine.player.stats).toEqual({ hp: 32, mp: 10 });
    engine.player.state = 'DEAD'; engine.handleServerMessage(event);
    engine.player.state = 'IDLE'; engine.currentInstanceId = 'town'; engine.handleServerMessage(event);
    expect(engine.spawnTransientEffect).toHaveBeenCalledTimes(1);
});
