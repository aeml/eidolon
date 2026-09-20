import { jest } from '@jest/globals';
import * as THREE from 'three';
import { aimDungeonCombatTarget, readDungeonTargetPointerInPage } from './dungeonTargetInput.js';
import { createProceduralMagmaGolem } from '../src/art/ProceduralOverworldEnemies.js';
import { MagmaGolem } from '../src/entities/MagmaGolem.js';

const makeInput = () => ({
    project: jest.fn().mockResolvedValue({ x: 100, y: 200, visible: true }),
    move: jest.fn(), settle: jest.fn(), hoveredId: jest.fn().mockResolvedValue('boss')
});

test('failed aim retains the actual ray and proxy transform before a later ground movement', () => {
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2));
    proxy.geometry.computeBoundingBox();
    proxy.userData.entityId = 'target';
    proxy.position.set(10, 1.5, 20);
    proxy.updateMatrixWorld(true);
    const target = { position: new THREE.Vector3(10, 0, 20), mesh: proxy };
    const raycaster = new THREE.Raycaster(new THREE.Vector3(100, 100, 100), new THREE.Vector3(-1, -1, -1).normalize());
    window.__partyClearEvidence = {};
    window.game = { hoveredEntity: { id: 'foreground' }, remotePlayers: new Map([['target', target]]),
        getRaycastMeshForEntity: () => proxy, raycastHitEntities: [{ id: 'foreground' }],
        inputManager: { mouse: new THREE.Vector2(.1, .2), pointerOverCanvas: true, raycaster },
        needsRaycast: false, frameCount: 42 };
    try {
        expect(readDungeonTargetPointerInPage('target')).toBe('foreground');
        const evidence = window.__partyClearEvidence.lastMissedTargetProbe;
        expect(evidence).toMatchObject({ id: 'target', hovered: 'foreground', hits: ['foreground'],
            logicalPosition: { x: 10, y: 0, z: 20 }, proxyOwner: 'target', frame: 42,
            ray: { origin: { x: 100, y: 100, z: 100 } } });
        expect(evidence.proxyWorld).toEqual(proxy.matrixWorld.elements);
        proxy.matrixWorld.elements[12] = 999;
        raycaster.ray.origin.x = 999;
        expect(evidence.proxyWorld[12]).toBe(10);
        expect(evidence.ray.origin.x).toBe(100);
        window.game.hoveredEntity = target;
        target.id = 'target';
        expect(readDungeonTargetPointerInPage('target')).toBe('target');
        expect(window.__partyClearEvidence.lastMissedTargetProbe).toBe(evidence);
    } finally {
        delete window.game;
        delete window.__partyClearEvidence;
    }
});

test('solo aiming keeps its existing center projection and settle', async () => {
    const input = makeInput();
    expect(await aimDungeonCombatTarget(input, 'boss')).toEqual({ x: 100, y: 200, visible: true });
    expect(input.project).toHaveBeenCalledWith('boss');
    expect(input.move).toHaveBeenCalledWith(100, 200);
    expect(input.settle).toHaveBeenCalledTimes(1);
    expect(input.hoveredId).not.toHaveBeenCalled();
});
test('party tank uses the exposed boss point instead of returning its covered center', async () => {
    const input = makeInput();
    const exposed = { x: 110, y: 170, visible: true };
    input.project.mockResolvedValueOnce({ x: 100, y: 200, visible: true }).mockResolvedValue(exposed);
    input.hoveredId.mockResolvedValueOnce('Cleric').mockResolvedValue('boss');
    expect(await aimDungeonCombatTarget(input, 'boss', true)).toBe(exposed);
    expect(input.project.mock.calls[1]).toEqual(['boss', { x: .5, y: .85, z: .5 }]);
    expect(input.move.mock.calls).toEqual([[100, 200], [110, 170]]);
    expect(input.settle).toHaveBeenCalledTimes(2);
});
test('completely covered target yields no attack point after bounded hitbox search', async () => {
    const input = makeInput();
    input.hoveredId.mockResolvedValue('Cleric');
    expect(await aimDungeonCombatTarget(input, 'boss', true)).toBeNull();
    expect(input.project).toHaveBeenCalledTimes(10);
});
test.each([false, true])('offscreen target cannot become an attack point, party=%s', async party => {
    const input = makeInput(); input.project.mockResolvedValue({ visible: false });
    expect(await aimDungeonCombatTarget(input, 'boss', party)).toBeNull();
    expect(input.move).not.toHaveBeenCalled();
    expect(input.hoveredId).not.toHaveBeenCalled();
});
test('projection failures propagate rather than fabricate acquisition', async () => {
    const input = makeInput(); input.project.mockRejectedValue(new Error('projection failed'));
    await expect(aimDungeonCombatTarget(input, 'boss', true)).rejects.toThrow('projection failed');
});

test('overlapping golems leave an exposed upper corner despite covering all six axial samples', async () => {
    // Two recorded Fire elite-room positions, actual procedural hitboxes, and
    // the game's isometric camera direction. This isolates geometry, not live
    // raid acceptance: other actors, motion and HUD occlusion are not replayed.
    const positions = [[99999.7265625, 19594.291015625], [99997.203125, 19592.751953125]];
    const actors = positions.map(([x, z], i) => {
        const actor = new MagmaGolem(i ? 'target' : 'foreground');
        actor.updateNameTag = () => {}; // No canvas/font rendering in this geometry test.
        actor.setMesh(createProceduralMagmaGolem());
        actor.mesh.position.set(x, 0, z);
        actor.mesh.updateMatrixWorld(true);
        return actor;
    });
    const hitboxes = actors.map(actor => actor.mesh.getObjectByName('ActorInteractionHitbox'));
    const target = hitboxes[1];
    target.geometry.computeBoundingBox();
    const box = target.geometry.boundingBox;
    const camera = new THREE.OrthographicCamera(-30, 30, 20, -20, .1, 2000);
    camera.position.set(100093.999, 100, 19691.154);
    camera.lookAt(99993.999, 0, 19591.154);
    camera.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster();
    let hovered;
    const observations = [];
    const input = {
        project: async (_id, fraction = null) => {
            fraction ||= { x: .5, y: .5, z: .5 };
            const point = new THREE.Vector3(...['x', 'y', 'z'].map(axis =>
                box.min[axis] + (box.max[axis] - box.min[axis]) * fraction[axis]));
            target.localToWorld(point).project(camera);
            return { x: point.x, y: point.y, visible: Math.abs(point.x) < 1 && Math.abs(point.y) < 1 };
        },
        move: async (x, y) => {
            raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
            hovered = raycaster.intersectObjects(hitboxes)[0]?.object.userData.entityId;
            observations.push(hovered);
        },
        settle: async () => {}, hoveredId: async () => hovered
    };
    const point = await aimDungeonCombatTarget(input, 'target', true);
    expect(observations.slice(0, 6)).toEqual(Array(6).fill('foreground'));
    expect(point?.visible).toBe(true);
    expect(hovered).toBe('target');
    expect(observations.length).toBeLessThanOrEqual(10);
});
