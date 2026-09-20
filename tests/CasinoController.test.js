import { jest } from '@jest/globals';
import * as THREE from 'three';
import { CasinoController } from '../src/core/CasinoController.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { AttachedStatusEffect } from '../src/entities/AttachedStatusEffect.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { createCasinoShell, createCasinoFurniture, updateCasinoCutaway, disposeCasinoObject } from '../src/art/ProceduralCasino.js';

const table = { id: 'public-blackjack', name: 'Lanternhold Blackjack', game: 'blackjack', x: -4.3, z: 171,
    seats: [{ x: -4.3, z: 173.2, rotation: Math.PI, exitX: -4.3, exitZ: 174.4 }], minimumPlayers: 1 };
const seat = { tableId: table.id, seat: 0, sessionId: 'private-token', exitX: -4.3, exitZ: 174.4, ready: false };

function setup() {
    const camera = new THREE.OrthographicCamera(-15, 15, 15, -15, .1, 500);
    camera.position.set(10, 15, 190);
    const engine = { currentInstanceId: 'lanternhold-casino', network: { send: jest.fn() }, collisionManager: new CollisionManager(),
        renderSystem: { camera, cameraTarget: new THREE.Vector3(0, 0, 185), scene: new THREE.Scene(), setCameraTarget: jest.fn() },
        inputManager: { clearInputState: jest.fn() }, cameraLocked: true,
        player: { position: new THREE.Vector3(-4.3, 0, 174.4), rotation: new THREE.Quaternion(), velocity: new THREE.Vector3(), state: 'IDLE', resetTransformInterpolation: jest.fn() } };
    const controller = new CasinoController(engine);
    return { engine, controller };
}

test('only the current floor and its patrons are visible, without revealing already hidden actors', () => {
    const { engine, controller } = setup();
    const interior = new THREE.Group(); interior.name = 'lanternhold-casino-interior';
    const floors = { public: new THREE.Group(), vip: new THREE.Group() };
    interior.userData.floors = floors; interior.add(floors.public, floors.vip);
    engine.renderSystem.scene.add(interior);
    const patron = y => ({ mesh: new THREE.Group(), position: new THREE.Vector3(0, y, 137), state: 'SEATED' });
    const upstairs = patron(8), downstairs = patron(0), hidden = patron(8);
    hidden.mesh.visible = false;
    engine.player.position.set(26, 0, 160);
    controller.beforeUpdate(.1); controller.render([upstairs, downstairs, hidden]);
    engine.casino = controller; upstairs.gameEngine = engine;
    const aura = new AttachedStatusEffect(engine.renderSystem.scene, upstairs, 'well_rested');
    expect(floors.vip.visible).toBe(false);
    expect(floors.public.visible).toBe(true);
    expect(upstairs.mesh.visible).toBe(false);
    expect(aura.group.visible).toBe(false);
    expect(downstairs.mesh.visible).toBe(true);
    expect(hidden.mesh.visible).toBe(false);
    expect(GameEngine.prototype.getRaycastMeshForEntity.call({ casino: controller }, upstairs)).toBeNull();
    expect(GameEngine.prototype.getRaycastMeshForEntity.call({ casino: controller }, downstairs)).toBe(downstairs.mesh);
    // Authoritative actor snapshots may restore the base mesh visibility.
    upstairs.mesh.visible = true;
    controller.render([upstairs, downstairs, hidden]);
    expect(upstairs.mesh.visible).toBe(false);
    controller.floor = 'vip';
    controller.beforeUpdate(.1); controller.render([upstairs, downstairs, hidden]);
    aura.update(.1);
    expect(aura.group.visible).toBe(true);
    expect(floors.vip.visible).toBe(true);
    expect(floors.public.visible).toBe(false);
    expect(upstairs.mesh.visible).toBe(true);
    expect(GameEngine.prototype.getRaycastMeshForEntity.call({ casino: controller }, upstairs)).toBe(upstairs.mesh);
    expect(downstairs.mesh.visible).toBe(false);
    expect(hidden.mesh.visible).toBe(false);
    controller.floor = 'public';
    controller.beforeUpdate(.1); controller.render([upstairs, downstairs, hidden]);
    engine.currentInstanceId = '';
    controller.render([upstairs, downstairs, hidden]);
    aura.update(.1);
    expect(aura.group.visible).toBe(true);
    expect(upstairs.mesh.visible).toBe(true);
    expect(hidden.mesh.visible).toBe(false);
    aura.dispose(); controller.dispose();
});

test('cutaway cleanup restores living patrons but never revives retired bodies', () => {
    const { engine, controller } = setup();
    const living = { mesh: new THREE.Group(), position: new THREE.Vector3(0, 8, 137), state: 'SEATED' };
    const dead = { ...living, mesh: new THREE.Group() };
    controller.render([living, dead]);
    expect(living.mesh.visible).toBe(false);
    expect(dead.mesh.visible).toBe(false);
    dead.state = 'DEAD';
    controller.dispose();
    expect(living.mesh.visible).toBe(true);
    expect(dead.mesh.visible).toBe(false);
    expect(engine.currentInstanceId).toBe('lanternhold-casino');
});

test('server-owned seat controls camera/input, readiness and exit without altering camera preferences', () => {
    const { engine, controller } = setup();
    const zoom = engine.renderSystem.camera.zoom;
    controller.updateState({ tables: [table], preparation: { [table.id]: { revision: 'roster-1', phase: 'preparing', minimumPlayers: 1 } }, occupants: [{ playerId: 'p', name: '<b>Alice</b>', tableId: table.id, seat: 0, connected: true }], yourSeat: seat });
    controller.beforeUpdate(.4); controller.render([]);
    expect(controller.active).toBe(true); expect(controller.panel.hidden).toBe(false);
    expect(controller.roster.querySelector('b')).toBeNull();
    expect(engine.player.position.z).toBe(173.2);
    expect(engine.inputManager.clearInputState).toHaveBeenCalled();
    expect(engine.renderSystem.camera.zoom).not.toBe(zoom);
    controller.ready.click();
    expect(engine.network.send).toHaveBeenCalledWith('casino', { action: 'ready', ready: true, sessionId: 'private-token', revision: 'roster-1' });
    controller.updateState({ tables: [table], preparation: { [table.id]: { revision: 'roster-2', phase: 'waiting_reconnect' } }, yourSeat: seat });
    expect(controller.status.textContent).toContain('Waiting for a seated player to reconnect');
    controller.leave.click(); expect(controller.active).toBe(true);
    controller.updateState({ tables: [table], occupants: [], yourSeat: null });
    expect(engine.cameraLocked).toBe(true); expect(engine.renderSystem.camera.zoom).toBe(zoom);
    expect(engine.player.position.z).toBe(174.4); expect(engine.player.state).toBe('IDLE');
    controller.dispose(); expect(engine.collisionManager.colliders).toHaveLength(0);
});

test('scene changes restore controls without teleporting back and pose cleanup restores rig', () => {
    const { engine, controller } = setup();
    const mesh = new THREE.Group(), hips = new THREE.Group(), thigh = new THREE.Group();
    hips.name = 'Rig_Hips'; hips.position.y = 1.8; thigh.name = 'Rig_ThighLeft'; mesh.add(hips, thigh);
    const actor = { mesh, state: 'SEATED' };
    controller.render([actor]); expect(hips.position.y).toBe(1.12); expect(thigh.rotation.x).toBe(-Math.PI / 2);
    actor.state = 'IDLE'; controller.render([actor]); expect(hips.position.y).toBe(1.8); expect(thigh.rotation.x).toBe(0);
    controller.updateState({ tables: [table], yourSeat: seat });
    engine.currentInstanceId = 'dungeon-x'; engine.player.position.set(50, 0, 70);
    controller.beforeUpdate(.1);
    expect(controller.active).toBe(false); expect(engine.player.position.z).toBe(70);
    controller.dispose();
});

test('leave, disconnect and seat changes cancel auto spins; errors require the current seat', () => {
    const { engine, controller } = setup();
    controller.updateState({ tables: [table], yourSeat: seat });
    controller.slots.autoRemaining = 50; controller.requestLeave(); expect(controller.slots.autoRemaining).toBe(0);
    controller.slots.autoRemaining = 50; controller.beforeUpdate(.1); expect(controller.slots.autoRemaining).toBe(0);
    controller.slots.autoRemaining = 50; controller.updateState({ tables: [table], yourSeat: { ...seat, sessionId: 'new-seat' } });
    expect(controller.slots.autoRemaining).toBe(0);
    const reject = jest.spyOn(controller.slots, 'rejectAction');
    controller.handleActionError({ sessionId: 'old-seat' }); expect(reject).not.toHaveBeenCalled();
    controller.handleActionError({ sessionId: 'new-seat' }); expect(reject).toHaveBeenCalledTimes(1);
    expect(controller.send({ action: 'slot_spin' })).toBe(false);
    engine.network.socket = { readyState: WebSocket.OPEN }; controller.send({ action: 'slot_spin' });
    expect(engine.network.send).toHaveBeenLastCalledWith('casino', { action: 'slot_spin', sessionId: 'new-seat' });
    controller.dispose();
});

test('mixed slot gems and table furniture share valid triangle batches', () => {
    const report = jest.spyOn(console, 'error').mockImplementation(() => {});
    let furniture;
    try {
        furniture = createCasinoFurniture([table, { id: 'public-slots-earth', game: 'slots', x: -5, z: 164,
            seats: [{ x: -5, z: 166, rotation: Math.PI }] },
        { ...table, id: 'public-roulette', game: 'roulette', x: 18, z: 186 },
        { ...table, id: 'vip-baccarat', game: 'baccarat', floor: 'vip', y: 8 }]);
        expect(report).not.toHaveBeenCalled();
        const batches = []; furniture.traverse(child => { if (child.isMesh && !child.userData.casinoPickOnly) batches.push(child); });
        expect(batches.length).toBeGreaterThan(0);
        for (const mesh of batches) {
            expect(mesh.geometry.index).toBeNull();
            expect(mesh.geometry.getAttribute('position').count % 3).toBe(0);
        }
        expect(furniture.userData.seats).toHaveLength(4);
    } finally { disposeCasinoObject(furniture); report.mockRestore(); }
});

test('walkable shell retains walls, opens a real doorway and batches the cutaway/furniture', () => {
    const shell = createCasinoShell(); const collision = new CollisionManager();
    for (const wall of shell.userData.casinoWalls) collision.addCollider(new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(wall.position[0], wall.position[1], 170 + wall.position[2]), new THREE.Vector3(...wall.size)));
    expect(collision.checkCollision(new THREE.Vector3(0, 0, 178), 1.25, new THREE.Vector3(0, 0, 180))).toBeNull();
    expect(collision.checkCollision(new THREE.Vector3(6, 0, 178), 1.25, new THREE.Vector3(6, 0, 180))).not.toBeNull();
    updateCasinoCutaway(shell, new THREE.Vector3(0, 0, 170)); expect(shell.userData.casinoCutaway.visible).toBe(false);
    updateCasinoCutaway(shell, new THREE.Vector3(0, 0, 190)); expect(shell.userData.casinoCutaway.visible).toBe(true);
    expect(shell.userData.drawMeshCount).toBeLessThanOrEqual(18);
    const furniture = createCasinoFurniture([table]); let visibleMeshes = 0;
    furniture.traverse(mesh => { if (mesh.isMesh && mesh.material.visible) visibleMeshes++; });
    expect(visibleMeshes).toBeLessThanOrEqual(6);
    expect(furniture.userData.seats[0].userData.casinoSeat).toEqual({ tableId: table.id, seat: 0, floor: 'public' });
    disposeCasinoObject(shell); disposeCasinoObject(furniture);
});

test('casino roof is one axis-aligned canopy covering the upper cornice', () => {
    const shell = createCasinoShell(); shell.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    shell.userData.casinoCutaway.traverse(mesh => {
        if (!mesh.isMesh) return;
        const vertices = mesh.geometry.getAttribute('position');
        for (let i = 0; i < vertices.count; i++) {
            const p = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld);
            if (p.y >= 10.79) bounds.expandByPoint(p);
        }
    });
    expect(bounds.min.x).toBeCloseTo(-14); expect(bounds.max.x).toBeCloseTo(14);
    expect(bounds.min.z).toBeCloseTo(161); expect(bounds.max.z).toBeCloseTo(179);
    expect(bounds.max.y).toBeCloseTo(14.3);
    disposeCasinoObject(shell);
});

test('town casino door raycast provides Casino label, click prompt and isolated hover tint', () => {
    const { engine, controller } = setup(); engine.currentInstanceId = '';
    const shell = createCasinoShell(); engine.renderSystem.scene.add(shell); shell.updateMatrixWorld(true);
    engine.player.position.set(0, 0, 181);
    const camera = engine.renderSystem.camera; camera.position.set(0, 8, 200); camera.lookAt(0, 2.4, 178.35); camera.updateMatrixWorld(true);
    const pointer = new THREE.Vector3(0, 2.4, 178.35).project(camera);
    engine.inputManager.mouse = new THREE.Vector2(pointer.x, pointer.y);
    expect(shell.getObjectByName('casino-nameplate')).toBeDefined();
    expect(controller.updateDoorHover()).toEqual(expect.objectContaining({ dungeonName: 'Lanternhold Casino', inRange: true,
        promptLabel: 'Click to open the Casino entrance, then choose Enter Casino.' }));
    expect(shell.userData.casinoDoor.material.emissive.getHex()).not.toBe(0);
    engine.inputManager.mouse.set(99, 99); expect(controller.updateDoorHover()).toBeNull();
    expect(shell.userData.casinoDoor.material.emissive.getHex()).toBe(0);
    engine.currentInstanceId = 'dungeon'; expect(controller.updateDoorHover()).toBeNull();
    controller.dispose(); disposeCasinoObject(shell);
});
