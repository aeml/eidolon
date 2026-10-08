import { jest } from '@jest/globals';
import { installFoliageRevisionObservation, readFoliageRevisionObservation,
    restoreFoliageRevisionObservation } from './e2e/foliage-revision-observation.js';

let controller, originalGame;
beforeEach(() => {
    originalGame = window.game;
    controller = { roots: new Set(['trees', 'grass']), viewRevision: 1, shadowRevision: 2,
        visit: jest.fn(object => object),
        beginFrame(change, object) {
            if (change === 'view') this.viewRevision++;
            if (change === 'shadow') this.shadowRevision++;
            return this.visit(object);
        } };
    window.game = { renderSystem: { foliageShadowInfluence: controller } };
});
afterEach(() => {
    restoreFoliageRevisionObservation();
    window.game = originalGame;
});

test('probe preserves arguments/results and counts actual changed and unchanged frame inputs', () => {
    const object = {}, visit = controller.visit, begin = controller.beginFrame;
    installFoliageRevisionObservation();
    expect(controller.beginFrame('view', object)).toBe(object);
    controller.beginFrame('shadow', object); controller.beginFrame('same', object);
    expect(visit).toHaveBeenCalledTimes(3); expect(visit).toHaveBeenCalledWith(object);
    expect(readFoliageRevisionObservation()).toEqual({ frames: 3, visits: 3,
        viewChanges: 1, shadowChanges: 1, initialRoots: 2 });
    const snapshot = readFoliageRevisionObservation(); snapshot.frames = 100;
    expect(readFoliageRevisionObservation().frames).toBe(3);
    expect(restoreFoliageRevisionObservation()).toBe(true);
    expect(controller.beginFrame).toBe(begin); expect(controller.visit).toBe(visit);
    expect(window.__terrainFoliageDiagnostic).toBeUndefined();
    expect(restoreFoliageRevisionObservation()).toBe(true);
});

test('duplicate installation cannot nest wrappers or lose the original owner', () => {
    const begin = controller.beginFrame;
    installFoliageRevisionObservation();
    expect(() => installFoliageRevisionObservation()).toThrow('already installed');
    expect(restoreFoliageRevisionObservation()).toBe(true);
    expect(controller.beginFrame).toBe(begin);
});

test('cleanup preserves a subsequent method owner and reports incomplete restoration', () => {
    installFoliageRevisionObservation();
    const later = () => 'later'; controller.beginFrame = later;
    expect(restoreFoliageRevisionObservation()).toBe(false);
    expect(controller.beginFrame).toBe(later);
    expect(window.__terrainFoliageDiagnostic).toBeUndefined();
});

test('original failure propagates and the probe can still be cleaned up', () => {
    const error = new Error('original failure');
    controller.beginFrame = () => { throw error; };
    const begin = controller.beginFrame;
    installFoliageRevisionObservation();
    expect(() => controller.beginFrame()).toThrow(error);
    expect(readFoliageRevisionObservation().frames).toBe(0);
    expect(restoreFoliageRevisionObservation()).toBe(true);
    expect(controller.beginFrame).toBe(begin);
});
