import { jest } from '@jest/globals';
import { Vector3, OrthographicCamera } from 'three';
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

test.each([false, true])('a pending pointer and intercepted canvas point retain the real observation (last projection %s)', async useLast => {
    const elementFromPoint = jest.fn(() => ({ tagName: 'DIV', id: 'combat-intent-card' }));
    Object.defineProperty(document, 'elementFromPoint', { value: elementFromPoint, configurable: true });
    window.game = { player: { position: new Vector3(), stats: { hp: 110 } }, needsRaycast: true,
        inputManager: { pointerOverCanvas: false }, combatIntent: { entityId: 'other', status: 'in_range' } };
    const projection = { id: 'skeleton', point: { x: 120, y: 220 } };
    const evidence = await readSanctuaryHoverEvidence({ evaluate: (read, args) => read(args) },
        useLast ? { id: null, point: null, lastProjection: projection } : projection);
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

test('observed nearby live enemies lie outside the default camera but inside ordinary wider framing', () => {
    const target = new Vector3(94.9849853515625, 0, 200.00953674316406);
    const positions = [
        [107.51438023561845, 1, 233.94963723003613],
        [128.74340990475315, 1, 215.44486649854426],
        [128.85178921655427, 1, 172.8319529088575]
    ];
    const projected = zoom => {
        const aspect = 1280 / 720;
        const camera = new OrthographicCamera(-zoom * aspect, zoom * aspect, zoom, -zoom, .1, 1000);
        camera.position.copy(target).add(new Vector3(100, 100, 100));
        camera.lookAt(target); camera.updateMatrixWorld();
        return positions.map(value => new Vector3(...value).project(camera));
    };
    const inFrame = point => Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && Math.abs(point.z) <= 1;
    expect(projected(15).some(inFrame)).toBe(false);
    expect(projected(30).every(inFrame)).toBe(true);
});

test('sanctuary framing uses real wheel input without moving out of protection or bypassing hover', () => {
    const source = readFileSync('tests/e2e/well-rested-gameplay.spec.js', 'utf8');
    const framing = source.indexOf('await zoomOutThroughCanvas(page)');
    expect(framing).toBeGreaterThan(source.indexOf('const insidePosition = await readPlayerState(page)'));
    expect(framing).toBeLessThan(source.indexOf('const boundaryTarget = await hoverEnemyCardThroughInput'));
    expect(source).toContain('framedPosition.x - insidePosition.x');
    expect(source).not.toMatch(/setZoom\(|currentZoom\s*=/);
    const helper = readFileSync('tests/e2e/helpers.js', 'utf8').split('export async function zoomOutForPortal(page)')[1]
        .split('async function projectVerdantEntrance')[0];
    expect(helper).toContain('await page.mouse.wheel(0, 100)');
    expect(helper).toContain('document.elementFromPoint(x, y) === canvas');
    expect(helper).not.toMatch(/setZoom\(|currentZoom\s*=/);
});
