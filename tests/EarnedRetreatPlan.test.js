import { jest } from '@jest/globals';
import * as THREE from 'three';
import { planReachableWizardStep } from './e2e/earned-retreat-plan.js';

const state = { className: 'Wizard', x: 0, z: 0, radius: 1.25,
    healthRatio: 1, threats: [{ x: 2, z: 0 }] };
afterEach(() => { delete window.game; });

test('browser callback needs no imports and checks the entire actual collision path', async () => {
    const position = new THREE.Vector3();
    const checkCollision = jest.fn(point => point.x < -3 && point.x > -4
        ? point.clone().add(new THREE.Vector3(1, 0, 0)) : point);
    window.game = { player: { position }, collisionManager: { checkCollision } };
    const evaluate = jest.fn(async (callback, data) => {
        expect(callback.toString()).not.toContain('import(');
        return callback(data);
    });
    const plan = await planReachableWizardStep({ evaluate }, state);
    expect(plan.action).toBe('retreat');
    expect(plan.x).toBeGreaterThanOrEqual(-3);
    expect(checkCollision).toHaveBeenCalled();
    expect(position.toArray()).toEqual([0, 0, 0]);
    expect(evaluate).toHaveBeenCalledTimes(1);
});

test('all blocked paths select combat rather than inventing movement', async () => {
    const page = { evaluate: jest.fn(async (_, data) => data.options.map(() => false)) };
    expect(await planReachableWizardStep(page, state)).toBeNull();
});

test('healthy collection policy does not run an unnecessary browser query', async () => {
    const page = { evaluate: jest.fn() };
    expect(await planReachableWizardStep(page, { ...state, retreatBelowHealthRatio: .8 })).toBeNull();
    expect(page.evaluate).not.toHaveBeenCalled();
});
