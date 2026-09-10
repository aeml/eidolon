import { jest } from '@jest/globals';
import { Vector3 } from 'three';
import { readFileSync } from 'node:fs';
import { readSanctuaryHoverEvidence } from './e2e/sanctuary-hover-observation.js';

afterEach(() => { delete window.game; jest.restoreAllMocks(); });

test('failed hover distinguishes absent candidate from nearby unrendered enemies without changing state', async () => {
    const enemy = { id: 'skeleton', subType: 'Skeleton', isActive: true, state: 'IDLE',
        health: 30, position: new Vector3(125, 0, 180), mesh: { parent: null, visible: true } };
    const player = { position: new Vector3(95, 0, 200), state: 'IDLE', safeZoneId: 'lanternhold', health: 110 };
    const raycast = jest.fn();
    window.game = { player, remotePlayers: new Map([[enemy.id, enemy]]), activeEntitiesCache: [],
        needsRaycast: false, inputManager: { pointerOverCanvas: true }, performRaycast: raycast };
    const attempt = Object.freeze({ requestedTarget: null, id: null, point: null });
    const evidence = await readSanctuaryHoverEvidence({ evaluate: (read, args) => read(args) }, attempt);
    expect(evidence.attempt).toBe(attempt);
    expect(evidence.player).toMatchObject({ position: [95, 0, 200], safeZone: 'lanternhold' });
    expect(evidence.nearby).toEqual([expect.objectContaining({ id: 'skeleton', inActiveCache: false,
        meshAttached: false, position: [125, 0, 180] })]);
    expect(evidence.intent).toBeNull();
    expect(raycast).not.toHaveBeenCalled();
    expect(window.game.player).toBe(player);
    expect(window.game.remotePlayers.get(enemy.id)).toBe(enemy);
});

test('a pending pointer and intercepted canvas point retain the real observation', async () => {
    const elementFromPoint = jest.fn(() => ({ tagName: 'DIV', id: 'combat-intent-card' }));
    Object.defineProperty(document, 'elementFromPoint', { value: elementFromPoint, configurable: true });
    window.game = { player: { position: new Vector3(), stats: { hp: 110 } }, needsRaycast: true,
        inputManager: { pointerOverCanvas: false }, combatIntent: { entityId: 'other', status: 'in_range' } };
    const evidence = await readSanctuaryHoverEvidence({ evaluate: (read, args) => read(args) },
        { id: 'skeleton', point: { x: 120, y: 220 } });
    expect(elementFromPoint).toHaveBeenCalledWith(120, 220);
    expect(evidence).toMatchObject({ needsRaycast: true, pointerOverCanvas: false,
        overlay: { tag: 'DIV', id: 'combat-intent-card' }, intent: { entityId: 'other' } });
});

test('no entered player produces no invented failure state', async () => {
    window.game = {};
    expect(await readSanctuaryHoverEvidence({ evaluate: (read, args) => read(args) }, {})).toBeNull();
});

test('diagnostics retain the exact hover deadline, fatal result and both real boundary assertions', () => {
    const source = readFileSync('tests/e2e/well-rested-gameplay.spec.js', 'utf8');
    expect(source).toContain("timeout: 10_000, message: 'The real enemy hover must populate the combat card'");
    expect(source).toContain('throw error');
    expect(source).toContain("testInfo.outputPath('sanctuary-hover-failure.png')");
    expect(source).toContain("toHaveText('Leave the safe zone')");
    expect(source).toContain('hoverEnemyCardThroughInput(page, testInfo, boundaryTarget)');
    expect(source).not.toMatch(/performRaycast\(|needsRaycast\s*=|hoveredEntity\s*=/);
});
