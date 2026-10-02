import { jest } from '@jest/globals';
import * as THREE from 'three';
import { CasinoController } from '../src/core/CasinoController.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { AttachedStatusEffect } from '../src/entities/AttachedStatusEffect.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { ChunkManager } from '../src/core/ChunkManager.js';
import { createCasinoShell, createCasinoFurniture, disposeCasinoObject } from '../src/art/ProceduralCasino.js';

const table = { id: 'public-blackjack', name: 'Lanternhold Blackjack', game: 'blackjack', x: -4.3, z: 171,
    seats: [{ x: -4.3, z: 173.2, rotation: Math.PI, exitX: -4.3, exitZ: 174.4 }], minimumPlayers: 1 };
const seat = { tableId: table.id, seat: 0, sessionId: 'private-token', exitX: -4.3, exitZ: 174.4, ready: false };

test('authored seating is reapplied after animation and restored on exit or mesh replacement', () => {
    const { engine, controller } = setup();
    const make = () => {
        const pose = { apply: jest.fn(), restore: jest.fn() }, mesh = new THREE.Group();
        mesh.userData.createSeatedPose = jest.fn(() => pose); return { pose, mesh };
    };
    const first = make(), second = make(), actor = { mesh: first.mesh, state: 'SEATED', position: new THREE.Vector3() };
    engine.currentInstanceId = '';
    controller.render([actor]); controller.render([actor]);
    expect(first.mesh.userData.createSeatedPose).toHaveBeenCalledTimes(1); expect(first.pose.apply).toHaveBeenCalledTimes(2);
    actor.mesh = second.mesh; controller.render([actor]); expect(first.pose.restore).toHaveBeenCalledTimes(1);
    actor.state = 'IDLE'; controller.render([actor]); expect(second.pose.restore).toHaveBeenCalledTimes(1);
    expect(controller.poses.size).toBe(0); controller.dispose();
});

function setup() {
    const camera = new THREE.OrthographicCamera(-15, 15, 15, -15, .1, 500);
    camera.position.set(10, 15, 190);
    const engine = { currentInstanceId: 'lanternhold-casino', network: { send: jest.fn(), socket: { readyState: WebSocket.OPEN } }, collisionManager: new CollisionManager(),
        renderSystem: { camera, cameraTarget: new THREE.Vector3(0, 0, 185), scene: new THREE.Scene(), setCameraTarget: jest.fn() },
        inputManager: { clearInputState: jest.fn() }, cameraLocked: true,
        player: { position: new THREE.Vector3(-4.3, 0, 174.4), rotation: new THREE.Quaternion(), velocity: new THREE.Vector3(), state: 'IDLE', resetTransformInterpolation: jest.fn() } };
    const controller = new CasinoController(engine);
    return { engine, controller };
}

function doorSetup(kind = 'entry', vip = false) {
    const { engine, controller } = setup();
    engine.currentInstanceId = kind === 'entry' ? '' : 'lanternhold-casino';
    controller.floor = kind === 'downstairs' ? 'vip' : 'public'; controller.vipActive = vip;
    engine.overworldSceneGeneration = 1;
    engine.network.socket = { readyState: WebSocket.OPEN };
    engine.requestTownRecall = jest.fn();
    controller.dialogue.showModal = () => { controller.dialogue.open = true; };
    controller.dialogue.close = () => { controller.dialogue.open = false; };
    controller.showDoorDialogue(kind);
    return { engine, controller, action: [...controller.dialogue.querySelectorAll('button')].find(button => button.textContent !== 'Close') };
}

test('a locked guard explains VIP access without an actionable entry request', () => {
    const { engine, controller, action } = doorSetup('guard');
    expect(controller.dialogue.textContent).toContain('You must be a VIP to enter');
    expect(action.disabled).toBe(true); action.click();
    expect(engine.network.send).not.toHaveBeenCalled();
    controller.dispose();
});

test.each(['entry', 'guard', 'downstairs', 'exit'])('current %s dialogue uses one explicit normal action', kind => {
    const { engine, controller, action } = doorSetup(kind, true);
    action.click(); action.click();
    expect(controller.dialogue.open).toBe(false);
    if (kind === 'exit') expect(engine.requestTownRecall).toHaveBeenCalledTimes(1);
    else expect(engine.network.send).toHaveBeenCalledWith('casino', expect.objectContaining({
        action: { entry: 'enter', guard: 'vip', downstairs: 'downstairs' }[kind]
    }));
    expect(engine.network.send).toHaveBeenCalledTimes(kind === 'exit' ? 0 : 1);
    controller.dispose();
});

test.each(['instance', 'generation', 'character', 'socket', 'disconnect', 'death', 'seated', 'closed', 'disposed'])(
    'retired entry actions cannot send after %s', change => {
        const { engine, controller, action } = doorSetup();
        if (change === 'instance') engine.currentInstanceId = 'other-dungeon';
        if (change === 'generation') engine.overworldSceneGeneration++;
        if (change === 'character') engine.player = { ...engine.player };
        if (change === 'socket') engine.network.socket = { readyState: WebSocket.OPEN };
        if (change === 'disconnect') engine.network.socket.readyState = WebSocket.CLOSED;
        if (change === 'death') engine.player.state = 'DEAD';
        if (change === 'seated') engine.player.state = 'SEATED';
        if (change === 'closed') controller.dialogue.close();
        if (change === 'disposed') controller.dispose();
        action.click();
        expect(engine.network.send).not.toHaveBeenCalled();
        controller.dispose();
    }
);

test('guard entitlement and current floor are rechecked before confirming stairs', () => {
    for (const change of ['vip', 'floor']) {
        const { engine, controller, action } = doorSetup('guard', true);
        if (change === 'vip') controller.vipActive = false;
        else controller.floor = 'vip';
        action.click(); expect(engine.network.send).not.toHaveBeenCalled();
        controller.dispose();
    }
});

test('a replaced dialogue cannot use a detached action from the same scene', () => {
    const { engine, controller, action } = doorSetup('guard', true);
    controller.showDoorDialogue('exit'); action.click();
    expect(engine.network.send).not.toHaveBeenCalled();
    expect(controller.dialogue.open).toBe(true);
    controller.dispose();
});

test('scene changes close the modal and clear queued door walking before checking proximity', () => {
    const { engine, controller } = doorSetup();
    controller.pendingDoor = { kind: 'entry', destination: engine.player.position.clone() };
    controller.pendingDoorContext = controller.captureDoorContext('entry');
    engine.currentInstanceId = 'other-dungeon';
    controller.beforeUpdate(.1);
    expect(controller.dialogue.open).toBe(false);
    expect(controller.pendingDoor).toBeNull();
    expect(controller.dialogueContext).toBeNull();
    expect(engine.network.send).not.toHaveBeenCalled();
    controller.dispose();
});

test('arriving at a queued door still requires a fresh explicit Enter Casino click', () => {
    const { engine, controller } = doorSetup();
    controller.closeDoorDialogue();
    controller.pendingDoor = { kind: 'entry', destination: engine.player.position.clone() };
    controller.pendingDoorContext = controller.captureDoorContext('entry');
    controller.beforeUpdate(.1);
    expect(controller.dialogue.open).toBe(true);
    expect(engine.network.send).not.toHaveBeenCalled();
    controller.dispose();
});

test('initial catalogue floor metadata does not invalidate a town entrance dialogue', () => {
    const { engine, controller, action } = doorSetup();
    controller.floor = undefined;
    controller.showDoorDialogue('entry');
    const current = [...controller.dialogue.querySelectorAll('button')].find(button => button.textContent === 'Enter Casino');
    controller.floor = 'public'; action.click(); current.click();
    expect(engine.network.send).toHaveBeenCalledTimes(1);
    controller.dispose();
});

test('disposal retires other detached casino buttons without sending or reactivating the view', () => {
    const { engine, controller } = setup();
    controller.dispose();
    controller.ready.click(); controller.beforeUpdate(.1);
    expect(engine.network.send).not.toHaveBeenCalled();
    expect(controller.active).toBe(false);
});

test.each(['disposed', 'destroyed engine'])('a %s controller cannot apply late seat/floor state or alter another actor', state => {
    const { engine, controller } = setup();
    const position = engine.player.position.clone();
    const actor = { mesh: new THREE.Group(), position: new THREE.Vector3(0, 8, 180), state: 'IDLE' };
    if (state === 'disposed') controller.dispose();
    else engine.isDestroyed = true;
    controller.updateState({ tables: [table], yourSeat: seat });
    controller.setFloor({ upstairs: true, x: 0, y: 8, z: 104 });
    controller.beforeUpdate(.1); controller.render([actor]);
    expect(controller.handlePrimaryClick({ button: 0, clientX: 1 })).toBe(false);
    expect(controller.active).toBe(false); expect(controller.data.yourSeat).toBeNull();
    expect(engine.player.position.equals(position)).toBe(true);
    expect(actor.mesh.visible).toBe(true);
    controller.dispose();
});

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

test('hidden floor patrons leave the scene traversal and return with current transforms', () => {
    const { engine, controller } = setup();
    const actor = { mesh: new THREE.Group(), position: new THREE.Vector3(0, 8, 137), state: 'SEATED' };
    actor.mesh.position.copy(actor.position);
    engine.renderSystem.scene.add(actor.mesh);
    const update = jest.spyOn(actor.mesh, 'updateMatrixWorld');
    controller.render([actor]);
    expect(actor.mesh.parent).toBeNull();
    engine.renderSystem.scene.updateMatrixWorld(true);
    expect(update).not.toHaveBeenCalled();
    // Ordinary authoritative movement still updates the detached actor.
    actor.position.x = 12; actor.mesh.position.copy(actor.position);
    actor.mesh.visible = true;
    controller.render([actor]);
    expect(actor.mesh.visible).toBe(false);
    expect(actor.mesh.parent).toBeNull();
    controller.floor = 'vip'; controller.render([actor]);
    expect(actor.mesh.visible).toBe(true);
    expect(actor.mesh.parent).toBe(engine.renderSystem.scene);
    engine.renderSystem.scene.updateMatrixWorld(true);
    expect(actor.mesh.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([12, 8, 137]);
    update.mockRestore(); controller.dispose();
});

test('cutaway does not resurrect removed, retired or replaced scene meshes', () => {
    for (const change of ['absent', 'dead', 'inactive', 'replaced']) {
        const { engine, controller } = setup();
        const mesh = new THREE.Group(); engine.renderSystem.scene.add(mesh);
        const actor = { mesh, position: new THREE.Vector3(0, 8, 137), state: 'SEATED' };
        controller.render([actor]);
        if (change === 'dead') actor.state = 'DEAD';
        if (change === 'inactive') actor.isActive = false;
        if (change === 'replaced') {
            actor.mesh = new THREE.Group(); engine.renderSystem.scene.add(actor.mesh);
        }
        controller.floor = 'vip'; controller.render(change === 'absent' ? [] : [actor]);
        expect(mesh.parent).toBeNull();
        if (change === 'absent') {
            // A streamed-out live actor may later be added by ChunkManager.
            expect(mesh.visible).toBe(true);
            engine.renderSystem.scene.add(mesh); controller.render([actor]);
            expect(mesh.parent).toBe(engine.renderSystem.scene);
            expect(mesh.visible).toBe(true);
        }
        if (change === 'replaced') expect(actor.mesh.visible).toBe(true);
        controller.dispose();
    }
});

test('cutaway cleanup restores scene-owned bodies without reparenting nested meshes', () => {
    const { engine, controller } = setup();
    const nested = new THREE.Group(); engine.renderSystem.scene.add(nested);
    const actor = { mesh: new THREE.Group(), position: new THREE.Vector3(0, 8, 137), state: 'SEATED' };
    const child = { ...actor, mesh: new THREE.Group() };
    engine.renderSystem.scene.add(actor.mesh); nested.add(child.mesh);
    controller.render([actor, child]);
    expect(actor.mesh.parent).toBeNull();
    expect(child.mesh.parent).toBe(nested);
    controller.dispose();
    expect(actor.mesh.parent).toBe(engine.renderSystem.scene);
    expect(actor.mesh.visible).toBe(true);
    expect(child.mesh.parent).toBe(nested);
    expect(child.mesh.visible).toBe(true);
});

test('actual chunk streaming restores a hidden-floor actor after leaving and returning', () => {
    const { engine, controller } = setup();
    const chunks = new ChunkManager(engine.renderSystem.scene); engine.chunkManager = chunks;
    const actor = { mesh: new THREE.Group(), position: new THREE.Vector3(0, 8, 137), state: 'SEATED', isActive: true };
    const near = chunks.getChunkKey(actor.position.x, actor.position.z);
    chunks.activeChunkKeys.add(near); chunks.addEntity(actor);
    controller.render(chunks.getActiveEntities());
    expect(actor.mesh.parent).toBeNull();
    actor.position.x = 10000; chunks.updateEntityChunk(actor);
    controller.render(chunks.getActiveEntities());
    expect(actor.mesh.parent).toBeNull(); expect(actor.mesh.visible).toBe(true);
    actor.position.x = 0; chunks.updateEntityChunk(actor);
    controller.floor = 'vip'; controller.render(chunks.getActiveEntities());
    expect(actor.mesh.parent).toBe(engine.renderSystem.scene);
    expect(actor.mesh.visible).toBe(true);
    controller.floor = 'public'; controller.render(chunks.getActiveEntities());
    chunks.removeEntity(actor);
    controller.dispose();
    expect(actor.mesh.parent).toBeNull();
});

test('server-owned seat controls camera/input, readiness and exit without altering camera preferences', () => {
    const { engine, controller } = setup();
    const zoom = engine.renderSystem.camera.zoom;
    controller.updateState({ tables: [table], preparation: { [table.id]: { revision: 'roster-1', phase: 'preparing', minimumPlayers: 1 } }, occupants: [{ playerId: 'p', name: '<b>Alice</b>', tableId: table.id, seat: 0, connected: true }], yourSeat: seat });
    controller.beforeUpdate(.4); controller.render([]);
    expect(controller.active).toBe(true); expect(controller.panel.hidden).toBe(false);
    expect(controller.roster.querySelector('b')).toBeNull();
    expect(controller.status.textContent).toContain('Waiting for saved game state');
    expect(controller.status.textContent).not.toContain('no Gold is spent');
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
    engine.network.socket.readyState = WebSocket.CLOSED;
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

test('town facade retains wall openings and batches exterior/furniture separately', () => {
    const shell = createCasinoShell(); const collision = new CollisionManager();
    for (const wall of shell.userData.casinoWalls) collision.addCollider(new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(wall.position[0], wall.position[1], 170 + wall.position[2]), new THREE.Vector3(...wall.size)));
    expect(collision.checkCollision(new THREE.Vector3(0, 0, 178), 1.25, new THREE.Vector3(0, 0, 180))).toBeNull();
    expect(collision.checkCollision(new THREE.Vector3(6, 0, 178), 1.25, new THREE.Vector3(6, 0, 180))).not.toBeNull();
    expect(shell.userData.casinoFacade.visible).toBe(true);
    expect(shell.userData.casinoUpstairs).toBeUndefined();
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
    shell.userData.casinoFacade.traverse(mesh => {
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

test('town facade uses masonry and slate while its door remains an isolated interaction material', () => {
    const shell = createCasinoShell();
    const surfaces = new Set();
    shell.userData.casinoFacade.traverse(mesh => {
        if (mesh.material?.userData.worldSurfaceDetail) surfaces.add(mesh.material.userData.worldSurfaceDetail);
    });
    expect([...surfaces].sort()).toEqual(['slate', 'stone']);
    expect(shell.userData.casinoDoor.material.userData.worldSurfaceDetail).toBeUndefined();
    const doorMaterialUsers = [];
    shell.traverse(mesh => { if (mesh.material === shell.userData.casinoDoor.material) doorMaterialUsers.push(mesh); });
    expect(doorMaterialUsers).toHaveLength(1);
    expect(doorMaterialUsers[0]).toBe(shell.userData.casinoDoor);
    expect(shell.userData.drawMeshCount).toBeLessThanOrEqual(18);
    disposeCasinoObject(shell);
});

test('town casino door raycast provides Casino label, click prompt and isolated hover tint', () => {
    const { engine, controller } = setup(); engine.currentInstanceId = '';
    const shell = createCasinoShell(); engine.renderSystem.scene.add(shell); shell.updateMatrixWorld(true);
    engine.player.position.set(0, 0, 181);
    const camera = engine.renderSystem.camera; camera.position.set(0, 8, 200); camera.lookAt(0, 2.4, 178.35); camera.updateMatrixWorld(true);
    const pointer = new THREE.Vector3(0, 2.4, 178.35).project(camera);
    engine.inputManager.mouse = new THREE.Vector2(pointer.x, pointer.y);
    const sign = shell.getObjectByName('casino-nameplate');
    expect(sign.isMesh).toBe(true);
    expect(sign.material.depthTest).toBe(true);
    expect(sign.material.depthWrite).toBe(true);
    expect(sign.geometry.parameters.width).toBe(8.5);
    expect(sign.position.y - sign.geometry.parameters.height / 2).toBeGreaterThan(4.8);
    expect(controller.updateDoorHover()).toEqual(expect.objectContaining({ dungeonName: 'Lanternhold Casino', inRange: true,
        promptLabel: 'Click to open the Casino entrance, then choose Enter Casino.' }));
    expect(shell.userData.casinoDoor.material.emissive.getHex()).not.toBe(0);
    engine.inputManager.mouse.set(99, 99); expect(controller.updateDoorHover()).toBeNull();
    expect(shell.userData.casinoDoor.material.emissive.getHex()).toBe(0);
    engine.currentInstanceId = 'dungeon'; expect(controller.updateDoorHover()).toBeNull();
    controller.dispose(); disposeCasinoObject(shell);
});

test('all facade windows are visible in front of opaque walls after material batching', () => {
    const shell = createCasinoShell(); shell.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const seeGlass = (origin, direction) => {
        ray.set(new THREE.Vector3(...origin), new THREE.Vector3(...direction));
        const hit = ray.intersectObject(shell.userData.casinoFacade, true)[0];
        expect(hit?.object.material.userData.casinoExteriorGlass).toBe(true);
    };
    for (const x of [-10.3, -6.6, 6.6, 10.3]) for (const y of [3.1, 8.25]) {
        seeGlass([x + .25, y + .25, 184], [0, 0, -1]);
    }
    for (const side of [-1, 1]) for (const x of [-4.8, 0, 4.8]) for (const y of [3.1, 8.25]) {
        seeGlass([side * 18, y + .25, 170 - side * (x + .25)], [-side, 0, 0]);
    }
    for (const x of [-4.5, 4.5, -2.8, 2.8]) {
        ray.set(new THREE.Vector3(x, 3.75, 184), new THREE.Vector3(0, 0, -1));
        expect(ray.intersectObject(shell.userData.casinoFacade, true)[0]?.object.material.name).toBe('casino-carved-limestone');
    }
    // The area above the door must not reveal the obsolete shell VIP carpet.
    ray.set(new THREE.Vector3(1.8, 9, 184), new THREE.Vector3(0, 0, -1));
    const overdoor = ray.intersectObject(shell.userData.casinoFacade, true)[0];
    expect(overdoor.point.z).toBeCloseTo(178.25);
    // Every roof triangle faces outward/up, with a long ridge at the same cap.
    const roofVertices = [];
    shell.userData.casinoFacade.traverse(mesh => {
        if (!mesh.isMesh || mesh.material.userData.worldSurfaceDetail !== 'slate') return;
        const position = mesh.geometry.attributes.position, normal = mesh.geometry.attributes.normal;
        for (let i = 0; i < position.count; i++) if (position.getY(i) > 10.8) {
            expect(normal.getY(i)).toBeGreaterThan(0);
            if (position.getY(i) > 14.29) roofVertices.push(position.getX(i));
        }
    });
    expect(roofVertices).toContain(-7); expect(roofVertices).toContain(7);
    disposeCasinoObject(shell);
});
