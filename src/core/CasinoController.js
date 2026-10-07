import * as THREE from 'three';
import { createCasinoFurniture, createCasinoFurnitureColliders, disposeCasinoObject } from '../art/ProceduralCasino.js';
import { BlackjackTableUI } from '../ui/BlackjackTableUI.js';
import { SlotMachineUI } from '../ui/SlotMachineUI.js';
import { PokerTableUI } from '../ui/PokerTableUI.js';
import { HouseTableUI } from '../ui/HouseTableUI.js';
import { CasinoPlayControls } from '../ui/CasinoPlayControls.js';
import { AUDIO_CUES } from '../audio/AudioManager.js';
const CASINO_INSTANCE = 'lanternhold-casino';

export class CasinoController {
    constructor(engine) {
        this.engine = engine;
        this.data = { tables: [], occupants: [], yourSeat: null };
        this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
        this.poses = new Map(); this.cutawayActors = new Map(); this.nextPoll = 0; this.active = false;
        this.panel = document.createElement('section');
        this.panel.className = 'casino-session'; this.panel.hidden = true;
        this.panel.setAttribute('aria-label', 'Casino table');
        this.heading = document.createElement('h2');
        this.status = document.createElement('p'); this.status.setAttribute('role', 'status');
        this.roster = document.createElement('ul');
        this.ready = this.button('Ready at table', () => this.send({ action: 'ready', ready: !this.data.yourSeat?.ready,
            revision: this.data.preparation?.[this.data.yourSeat?.tableId]?.revision }));
        this.leave = this.button('Leave table', () => this.requestLeave());
        this.blackjack = new BlackjackTableUI(payload => this.send(payload));
        this.poker = new PokerTableUI(payload => this.send(payload));
        this.house = new HouseTableUI(payload => this.send(payload));
        this.slots = new SlotMachineUI(payload => this.send(payload), sound => this.engine.playAudioCue?.({ spin: AUDIO_CUES.casinoSpin, stop: AUDIO_CUES.uiClick, win: AUDIO_CUES.casinoWin, bonus: AUDIO_CUES.casinoBonus, jackpot: AUDIO_CUES.casinoJackpot }[sound]));
        this.header = document.createElement('header'); this.header.className = 'casino-session-header';
        this.header.append(this.heading, this.leave);
        this.status.className = 'casino-session-status'; this.roster.className = 'casino-session-roster';
        this.playControls = new CasinoPlayControls(reason => this.slots.stopAuto(reason));
        this.panel.append(this.header, this.status, this.playControls.root, this.roster, this.ready, this.blackjack.root, this.slots.root, this.poker.root, this.house.root);
        for (const event of ['pointerdown', 'pointerup', 'click', 'wheel']) this.panel.addEventListener(event, e => e.stopPropagation());
        document.body.append(this.panel);
        this.stairButton = this.button('Walk upstairs · VIP lounge', () => this.walkStairs());
        this.stairButton.className = 'casino-stair-action'; this.stairButton.hidden = true;
        for (const event of ['pointerdown', 'pointerup', 'click']) this.stairButton.addEventListener(event, e => e.stopPropagation());
        document.body.append(this.stairButton);
        this.dialogue = document.createElement('dialog'); this.dialogue.className = 'casino-entry-dialogue';
        document.body.append(this.dialogue);
        this.keyHandler = event => {
            if (!this.active || event.key !== 'Escape') return;
            event.preventDefault(); event.stopImmediatePropagation(); this.requestLeave();
        };
        document.addEventListener('keydown', this.keyHandler, true);
    }

    button(text, action) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.onclick = action; return button;
    }

    send(payload) {
        if (this.disposed || this.engine.isDestroyed) return false;
        this.playControls.setContext(this.engine.player?.id || this.engine.player, this.engine.currentInstanceId === CASINO_INSTANCE);
        if (!this.playControls.allows(payload, this.slots.view)) {
            this.rejectLocalRequest(payload, 'New play is paused. Use Start new session when you choose to continue.');
            return false;
        }
        const disconnected = () => {
            this.slots.stopAuto('Connection unavailable; unstarted auto spins stopped.');
            if (payload.action !== 'get') this.rejectLocalRequest(payload,
                'Connection unavailable. No request was sent. Confirmed wagers keep their server rules; reconnect, review the table and choose again.');
            return false;
        };
        if (this.engine.network.socket?.readyState !== WebSocket.OPEN) return disconnected();
        if (this.engine.network.send('casino', { sessionId: this.data.yourSeat?.sessionId, ...payload }) === false) return disconnected();
        return true;
    }

    rejectLocalRequest(payload, message) {
        const error = { ...payload, roundRevision: payload.roundRevision || 0, local: true, error: message };
        this.blackjack.rejectAction(error); this.poker.rejectAction(error); this.house.rejectAction(error); this.slots.rejectAction(error);
        this.status.textContent = message;
    }

    requestLeave() {
        if (!this.active) return;
        this.slots.stopAuto('Leaving machine; auto spins stopped.');
        this.status.textContent = 'Leaving table… waiting for the server.';
        this.send({ action: 'leave' });
    }

    handleActionError(error) {
        if (!error || error.sessionId !== this.data.yourSeat?.sessionId) return;
        this.slots.rejectAction(error); this.blackjack.rejectAction(error); this.poker.rejectAction(error); this.house.rejectAction(error);
    }

    setFloor(payload = {}) {
        if (this.disposed || this.engine.isDestroyed || this.engine.currentInstanceId !== CASINO_INSTANCE || !this.engine.player
            || ![payload.x, payload.y, payload.z].every(Number.isFinite)) return;
        this.floor = payload.upstairs ? 'vip' : 'public';
        this.engine.collisionManager.casinoVIPFloor = payload.upstairs === true;
        const player = this.engine.player;
        player.position.set(payload.x, payload.y, payload.z); player.state = 'IDLE';
        player.targetPosition = null; player.velocity?.set(0, 0, 0); player.resetTransformInterpolation?.();
        this.pendingDoor = null; this.pendingSeat = null; this.engine.inputManager?.clearInputState?.();
        this.closeDoorDialogue();
        this.engine.renderSystem.setCameraTarget(player.position);
    }

    updateState(payload = {}) {
        if (this.disposed || this.engine.isDestroyed) return;
        this.playControls.setContext(this.engine.player?.id || this.engine.player, this.engine.currentInstanceId === CASINO_INSTANCE);
        this.floor = payload.floor || 'public'; this.vipActive = payload.vip === true;
        if (this.engine.collisionManager) this.engine.collisionManager.casinoVIPFloor = this.floor === 'vip';
        if (this.data.yourSeat?.sessionId !== payload.yourSeat?.sessionId) { this.slots.update(null); this.house.update(null); }
        const tables = Array.isArray(payload.tables) ? payload.tables : [];
        const signature = JSON.stringify(tables);
        if (signature !== this.catalogSignature) {
            this.removeFurnitureColliders();
            disposeCasinoObject(this.furniture);
            this.furniture = createCasinoFurniture(tables); this.catalogSignature = signature;
            this.furnitureColliders = createCasinoFurnitureColliders(tables);
        }
        this.data = { tables, occupants: Array.isArray(payload.occupants) ? payload.occupants : [],
            preparation: payload.preparation || {},
            yourSeat: this.engine.currentInstanceId === CASINO_INSTANCE ? payload.yourSeat || null : null };
        const seat = this.data.yourSeat;
        const isBlackjack = tables.find(table => table.id === seat?.tableId)?.game === 'blackjack' && Boolean(payload.blackjack);
        const isSlots = tables.find(table => table.id === seat?.tableId)?.game === 'slots' && Boolean(payload.slots);
        const isPoker = tables.find(table => table.id === seat?.tableId)?.game === 'poker' && Boolean(payload.poker);
        const isHouse = ['roulette', 'baccarat'].includes(tables.find(table => table.id === seat?.tableId)?.game) && Boolean(payload.house);
        const tablePresence = { yourSeat: seat, occupants: this.data.occupants.filter(p => p.tableId === seat?.tableId) };
        this.poker.update(isPoker ? payload.poker : null, this.engine.player?.id, tablePresence);
        this.house.update(isHouse ? payload.house : null, this.engine.player?.id, tablePresence);
        this.panel.classList.toggle('has-house', isHouse);
        this.panel.classList.toggle('has-poker', isPoker);
        this.slots.update(isSlots ? payload.slots : null);
        this.panel.classList.toggle('has-slots', Boolean(isSlots));
        this.blackjack.update(isBlackjack ? payload.blackjack : null, this.engine.player?.id, tablePresence);
        this.panel.classList.toggle('has-blackjack', isBlackjack);
        this.ready.hidden = isBlackjack || isSlots || isPoker || isHouse;
        this.roster.hidden = Boolean(isSlots || isBlackjack || isPoker || isHouse);
        if (seat) this.lastSeat = seat;
        if (seat && !this.active) this.enterView();
        else if (!seat && this.active) this.exitView();
        if (!seat) return;
        const table = tables.find(table => table.id === seat.tableId);
        this.heading.textContent = table?.name || 'Casino table';
        const occupants = this.data.occupants.filter(occupant => occupant.tableId === seat.tableId);
        const ready = occupants.filter(occupant => occupant.connected && occupant.ready).length;
        const preparation = this.data.preparation[seat.tableId];
        const phase = { waiting_players: `Waiting for players (minimum ${preparation?.minimumPlayers || table?.minimumPlayers || 1}).`,
            waiting_reconnect: 'Waiting for a seated player to reconnect.', preparing: 'Players are preparing.',
            ready: 'Everyone is ready.' }[preparation?.phase] || 'Synchronizing table…';
        this.status.textContent = `${phase} ${ready} ready · ${occupants.length}/${table?.seats.length || 0} seats occupied. Roster changes reset readiness. Waiting for saved game state; confirmed wagers are retained. Reconnect reservations last 60 seconds.`;
        this.ready.disabled = !preparation?.revision;
        this.ready.textContent = seat.ready ? 'Not ready' : 'Ready at table';
        this.ready.setAttribute('aria-pressed', String(Boolean(seat.ready)));
        if (isBlackjack) this.status.textContent = `${table.floor === 'vip' ? 'VIP floor · EP' : 'Public floor · Gold'} blackjack. Leaving restores world controls; confirmed wagers continue and payouts are saved.`;
        if (isSlots) this.status.textContent = `${table.floor === 'vip' ? 'VIP floor · EP' : 'Public floor · Gold'} slots. Free spins and bonus choices belong to you and remain saved when you leave.`;
        if (isPoker) this.status.textContent = `${table.floor === 'vip' ? 'VIP floor · EP' : 'Public floor · Gold'} Hold’em. Leaving folds a remaining stack; all-in hands stay eligible. Unspent stake and winnings return after the hand.`;
        if (isHouse) this.status.textContent = `${table.floor === 'vip' ? 'VIP floor · EP' : 'Public floor · Gold'} ${table.game}. One shared round for every seat. Confirmed bets continue and payouts are saved if you leave.`;
        this.status.title = this.status.textContent;
        this.roster.replaceChildren();
        for (const occupant of occupants.sort((a, b) => a.seat - b.seat)) {
            const row = document.createElement('li');
            row.textContent = `Seat ${occupant.seat + 1}: ${occupant.name} · ${occupant.connected ? occupant.ready ? 'Ready' : 'Preparing' : 'Reconnecting (reserved)'}`;
            this.roster.append(row);
        }
    }

    enterView() {
        const engine = this.engine, render = engine.renderSystem;
        this.savedView = { zoom: render.camera.zoom, locked: engine.cameraLocked,
            position: render.camera.position.clone(), target: render.cameraTarget.clone() };
        this.active = true; this.blend = 0; this.pendingSeat = null;
        engine.cameraLocked = false;
        engine.clearCombatIntentState?.(); engine.inputManager?.clearInputState?.();
        this.panel.hidden = false; document.body.classList.add('casino-seated'); this.leave.focus({ preventScroll: true });
    }

    exitView() {
        this.slots.update(null);
        this.blackjack.update(null); this.poker.update(null); this.house.update(null);
        this.active = false; this.panel.hidden = true; this.pendingSeat = null;
        document.body.classList.remove('casino-seated');
        const engine = this.engine, render = engine.renderSystem;
        if (this.savedView) {
            engine.cameraLocked = this.savedView.locked;
            render.camera.zoom = this.savedView.zoom; render.camera.updateProjectionMatrix();
            render.setCameraTarget(this.savedView.locked && engine.player ? engine.player.position : this.savedView.target);
        }
        engine.inputManager?.clearInputState?.();
        if (engine.player) {
            engine.player.targetPosition = null; engine.player.casinoSeated = false;
            if (engine.currentInstanceId === CASINO_INSTANCE && this.lastSeat && engine.player.state !== 'DEAD') {
                engine.player.position.set(this.lastSeat.exitX, this.lastSeat.exitY || 0, this.lastSeat.exitZ);
                engine.player.state = 'IDLE'; engine.player.resetTransformInterpolation?.();
            }
        }
        this.savedView = null;
    }

    captureDoorContext(kind) {
        const engine = this.engine;
        return { kind, player: engine.player, instanceId: engine.currentInstanceId,
            generation: engine.overworldSceneGeneration, floor: this.floor,
            socket: engine.network.socket, vip: this.vipActive };
    }

    isDoorContextCurrent(context) {
        if (!context || this.disposed || this.engine.isDestroyed || this.active) return false;
        const engine = this.engine;
        if (!engine.player || engine.player.state === 'DEAD' || engine.player.state === 'SEATED' ||
            context.player !== engine.player || context.instanceId !== engine.currentInstanceId ||
            context.generation !== engine.overworldSceneGeneration ||
            (context.kind !== 'entry' && context.floor !== this.floor) ||
            context.socket !== engine.network.socket ||
            (context.socket && context.socket.readyState !== WebSocket.OPEN)) return false;
        const inside = engine.currentInstanceId === CASINO_INSTANCE;
        if (context.kind === 'entry') return !engine.currentInstanceId;
        if (context.kind === 'downstairs') return inside && this.floor === 'vip';
        if (context.kind === 'guard') return inside && this.floor !== 'vip' && context.vip === this.vipActive;
        return context.kind === 'exit' && inside && this.floor !== 'vip';
    }

    closeDoorDialogue() {
        if (this.dialogue.open) this.dialogue.close();
        this.dialogueContext = null;
        this.pendingDoor = null; this.pendingDoorContext = null;
    }

    showDoorDialogue(kind) {
        const context = this.captureDoorContext(kind);
        if (!this.isDoorContextCurrent(context)) return;
        this.dialogueContext = context;
        const act = callback => {
            if (!this.dialogue.open || this.dialogueContext !== context || !this.isDoorContextCurrent(context)) return;
            this.closeDoorDialogue(); callback();
        };
        const guard = kind === 'guard', exit = kind === 'exit', downstairs = kind === 'downstairs';
        this.engine.clearCombatIntentState?.();
        this.engine.inputManager?.clearInputState?.();
        if (this.engine.player) this.engine.player.targetPosition = null;
        const heading = document.createElement('h2'); heading.textContent = guard ? 'VIP Guard' : 'Lanternhold Casino';
        const copy = document.createElement('p');
        copy.textContent = guard ? (this.vipActive ? 'Welcome to the Sovereign Lounge. Upstairs games wager and return only EP, usable for cosmetics—not Gold or combat power.' : 'You must be a VIP to enter')
            : downstairs ? 'Return to the main Gold gaming floor? Your saved outcomes and bonus features remain yours.'
            : exit ? 'Return to Lanternhold? Your saved casino outcomes remain yours.'
                : 'Step into Lanternhold’s grand gaming hall. Meet other adventurers at Gold tables and elemental machines. The upstairs lounge is reserved for VIP guests.';
        this.dialogue.replaceChildren(heading, copy);
        if (guard || downstairs) {
            const entry = this.button(downstairs ? 'Return downstairs' : 'Enter VIP lounge', () => act(() => {
                if (!guard || this.vipActive === true) this.send({ action: downstairs ? 'downstairs' : 'vip' });
            }));
            entry.disabled = guard && this.vipActive !== true;
            this.dialogue.append(entry);
        }
        if (!guard && !downstairs) this.dialogue.append(this.button(exit ? 'Return to Lanternhold' : 'Enter Casino', () => {
            act(() => {
                if (exit) this.engine.requestTownRecall();
                else this.send({ action: 'enter' });
            });
        }));
        this.dialogue.append(this.button('Close', () => {
            if (this.dialogueContext === context) this.closeDoorDialogue();
        }));
        if (!this.dialogue.open) this.dialogue.showModal();
    }

    updateDoorHover() {
        const engine = this.engine;
        this.hoverHint = null;
        if (this.hoveredDoor) this.hoveredDoor.material.emissive.setHex(0x000000);
        this.hoveredDoor = null;
        if (this.active || this.dialogue.open || engine.currentInstanceId || !engine.player) return null;
        const door = engine.renderSystem.scene.getObjectByName('lanternhold-casino-shell')?.userData.casinoDoor;
        if (!door || !engine.inputManager?.mouse) return null;
        this.raycaster.setFromCamera(engine.inputManager.mouse, engine.renderSystem.camera);
        if (!this.raycaster.intersectObject(door, true).length) return null;
        this.hoveredDoor = door; door.material.emissive.setHex(0x72501c);
        const distance = engine.player.position.distanceTo(new THREE.Vector3(0, 0, 181));
        this.hoverHint = { dungeonType: '', dungeonName: 'Lanternhold Casino', distance, inRange: distance < 7,
            statusLabel: distance < 7 ? 'Entrance · Click to interact' : 'Entrance · Walk to enter',
            promptLabel: distance < 7 ? 'Click to open the Casino entrance, then choose Enter Casino.' : 'Click to walk to the Casino entrance.' };
        return this.hoverHint;
    }

    handlePrimaryClick(event) {
        if (this.disposed || this.engine.isDestroyed) return false;
        if (this.active || this.dialogue.open) return true;
        if (!event || event.button > 0 || !Number.isFinite(event.clientX)) return false;
        const engine = this.engine;
        const rect = engine.renderSystem.renderer.domElement.getBoundingClientRect();
        this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        this.raycaster.setFromCamera(this.pointer, engine.renderSystem.camera);
        const inside = engine.currentInstanceId === CASINO_INSTANCE;
        const shell = engine.renderSystem.scene.getObjectByName(inside ? 'lanternhold-casino-interior' : 'lanternhold-casino-shell');
        const targets = inside ? (this.floor === 'vip' ? [shell?.userData.casinoStairs] : [shell?.userData.casinoGuard, shell?.userData.casinoExit]) : !engine.currentInstanceId ? [shell?.userData.casinoDoor] : [];
        const hit = this.raycaster.intersectObjects(targets.filter(Boolean), true)[0];
        if (hit) {
            let kind = 'entry';
            if (inside) kind = this.floor === 'vip' ? 'downstairs' : this.raycaster.intersectObject(shell.userData.casinoGuard, true).length ? 'guard' : 'exit';
            const destination = new THREE.Vector3(0, this.floor === 'vip' && inside ? 8 : 0,
                kind === 'entry' ? 181 : kind === 'guard' || kind === 'downstairs' ? 104 : 204);
            if (engine.player.position.distanceTo(destination) < 7) this.showDoorDialogue(kind);
            else { this.pendingDoor = { kind, destination }; this.pendingDoorContext = this.captureDoorContext(kind); engine.player.move(destination); }
            return true;
        }
        if (!inside || !this.furniture?.parent) return false;
        this.stairRoute = null;
        const hits = this.raycaster.intersectObjects(this.furniture.userData.seats.filter(chair => chair.userData.casinoSeat.floor === (this.floor || 'public')), true);
        if (!hits.length) { this.pendingSeat = null; return false; }
        let chair = hits[0].object;
        while (chair && !chair.userData.casinoSeat) chair = chair.parent;
        if (!chair) return false;
        const selection = chair.userData.casinoSeat;
        const table = this.data.tables.find(table => table.id === selection.tableId);
        const seat = table?.seats[selection.seat];
        if (!seat) return false;
        if (this.data.occupants.some(occupant => occupant.tableId === selection.tableId && occupant.seat === selection.seat)) {
            engine.uiManager.addChatMessage?.('System', 'That chair is occupied or reserved for a reconnect.'); return true;
        }
        if (engine.currentInstanceId !== CASINO_INSTANCE) {
            engine.uiManager.addChatMessage?.('System', 'Walk through the casino entrance before choosing a chair.'); return true;
        }
        engine.clearCombatIntentState?.();
        this.pendingSeat = { ...selection, ...seat, expiresAt: performance.now() + 15000 };
        engine.player.move(new THREE.Vector3(seat.exitX, seat.y || 0, seat.exitZ));
        return true;
    }

    walkStairs() {
        const p = this.engine.player?.position;
        if (!p || this.active) return;
        const inside = this.engine.currentInstanceId === CASINO_INSTANCE;
        if (inside) this.showDoorDialogue(this.floor === 'vip' ? 'downstairs' : p.z < 150 ? 'guard' : 'exit');
        else if (!this.engine.currentInstanceId) this.showDoorDialogue('entry');
    }

    beforeUpdate(dt) {
        if (this.disposed || this.engine.isDestroyed) return;
        const engine = this.engine, player = engine.player;
        this.playControls.setContext(player?.id || player, engine.currentInstanceId === CASINO_INSTANCE);
        this.playControls.tick();
        if (this.dialogueContext && !this.isDoorContextCurrent(this.dialogueContext)) this.closeDoorDialogue();
        if (engine.network.socket?.readyState !== WebSocket.OPEN && this.slots.autoRemaining) this.slots.stopAuto('Connection lost; auto spins stopped.');
        if (!player) return;
        if (engine.currentInstanceId !== CASINO_INSTANCE && this.active) { this.data.yourSeat = null; this.exitView(); }
        const overworld = engine.currentInstanceId === CASINO_INSTANCE;
        const upstairs = overworld && this.floor === 'vip';
        if (engine.collisionManager) engine.collisionManager.casinoVIPFloor = upstairs;
        const nearGuard = overworld && Math.hypot(player.position.x, player.position.z - 100) < 7;
        const nearExit = overworld && !upstairs && Math.hypot(player.position.x, player.position.z - 204) < 7;
        const nearDoor = !engine.currentInstanceId && Math.hypot(player.position.x, player.position.z - 181) < 7;
        this.stairButton.hidden = this.active || !(nearGuard || nearExit || nearDoor);
        this.stairButton.textContent = nearGuard ? upstairs ? 'Return downstairs' : 'Talk to VIP Guard' : nearExit ? 'Leave Casino' : 'Casino Entrance';
        if (engine.inputManager?.groundPlane) engine.inputManager.groundPlane.constant = upstairs ? -8 : 0;
        if (this.pendingDoor) {
            const { kind, destination } = this.pendingDoor;
            if (!this.isDoorContextCurrent(this.pendingDoorContext)) this.closeDoorDialogue();
            else if (player.position.distanceTo(destination) < 6) {
                this.pendingDoor = null; this.pendingDoorContext = null;
                player.targetPosition = null; this.showDoorDialogue(kind);
            }
        }
        const near = overworld;
        if (near && performance.now() >= this.nextPoll) { this.nextPoll = performance.now() + 3000; this.send({ action: 'get' }); }
        if (this.furniture) {
            this.furniture.visible = overworld;
            if (overworld && !this.furniture.parent) engine.renderSystem.scene.add(this.furniture);
            const colliders = engine.collisionManager?.colliders;
            if (colliders) {
                if (!overworld) this.removeFurnitureColliders();
                else for (const box of this.furnitureColliders || []) if (!colliders.includes(box)) engine.collisionManager.addCollider(box);
            }
        }
        const floors = engine.renderSystem.scene.getObjectByName('lanternhold-casino-interior')?.userData.floors;
        if (floors) { floors.public.visible = !upstairs; floors.vip.visible = upstairs; }
        if (this.furniture?.userData.vipFloor) this.furniture.userData.vipFloor.visible = upstairs;
        if (this.furniture?.userData.publicFloor) this.furniture.userData.publicFloor.visible = !upstairs;
        if (this.stairRoute?.length) {
            if (!overworld || player.state === 'DEAD' || this.active) this.stairRoute = null;
            else if (player.position.distanceTo(this.stairRoute[0]) < .35) {
                this.stairRoute.shift();
                if (this.stairRoute.length) player.move(this.stairRoute[0]);
            }
        }
        if (this.pendingSeat) {
            if (!overworld || Math.abs(player.position.y - (this.pendingSeat.y || 0)) > 1 || performance.now() > this.pendingSeat.expiresAt) this.pendingSeat = null;
            else if (Math.hypot(player.position.x - this.pendingSeat.exitX, player.position.z - this.pendingSeat.exitZ) <= 1.7) {
                const pending = this.pendingSeat; this.pendingSeat = null;
                player.targetPosition = null; engine.inputManager?.clearInputState?.();
                this.send({ action: 'sit', tableId: pending.tableId, seat: pending.seat });
            }
        }
        if (!this.active) return;
        this.blend = Math.min(1, this.blend + dt * 3);
        engine.inputManager?.clearInputState?.(); player.targetPosition = null; player.casinoSeated = true;
        engine.pendingInteraction = null;
        const table = this.data.tables.find(table => table.id === this.data.yourSeat.tableId);
        const position = table?.seats[this.data.yourSeat.seat];
        if (position) {
            player.position.set(position.x, position.y || 0, position.z); player.state = 'SEATED';
            player.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), position.rotation);
            player.velocity?.set(0, 0, 0); player.resetTransformInterpolation?.();
        }
    }

    isActorCutAway(entity) {
        return this.engine.currentInstanceId === CASINO_INSTANCE && entity !== this.engine.player
            && ((entity?.position?.y ?? entity?.mesh?.position?.y ?? 0) >= 7.5) !== (this.floor === 'vip');
    }

    restoreCutawayActors(entities = this.engine.chunkManager?.getActiveEntities?.(), keepHidden = false) {
        for (const [entity, record] of this.cutawayActors) {
            const { mesh } = record;
            const alive = entity.mesh === mesh && entity.state !== 'DEAD' && entity.isActive !== false;
            const present = !entities || entities.includes(entity);
            if (alive && present && keepHidden && this.isActorCutAway(entity)) {
                mesh.visible = false;
                // Chunk streaming can reattach the same live mesh. Only detach
                // scene-owned roots; never disturb another subsystem's parent.
                if (mesh.parent === this.engine.renderSystem.scene) {
                    record.parent = mesh.parent;
                    mesh.removeFromParent();
                }
                continue;
            }
            if (alive) {
                mesh.visible = true;
                // An absent actor belongs to streaming/scene teardown. Restore
                // visibility for future reuse, but do not reinsert its body.
                if (present && record.parent && !mesh.parent) record.parent.add(mesh);
            }
            this.cutawayActors.delete(entity);
        }
    }

    render(entities) {
        if (this.disposed || this.engine.isDestroyed) return;
        this.restoreCutawayActors(entities, true);
        for (const entity of entities) {
            if (!entity.mesh) continue;
            if (this.isActorCutAway(entity) && entity.mesh.visible) {
                const parent = entity.mesh.parent === this.engine.renderSystem.scene ? entity.mesh.parent : null;
                this.cutawayActors.set(entity, { mesh: entity.mesh, parent });
                entity.mesh.visible = false;
                // Visibility alone still traverses every rig/equipment matrix
                // in Three. Keep the live actor, but omit its hidden scene root.
                if (parent) entity.mesh.removeFromParent();
            }
            const seated = entity.state === 'SEATED' || (entity === this.engine.player && this.active);
            let pose = this.poses.get(entity);
            if (pose && pose.mesh !== entity.mesh) { this.restorePose(pose); this.poses.delete(entity); pose = null; }
            if (seated && !pose) {
                const names = ['Rig_Hips', ...['Left', 'Right'].flatMap(side => ['Thigh', 'Shin', 'UpperArm', 'Forearm'].map(part => `Rig_${part}${side}`))];
                pose = { mesh: entity.mesh, authored: entity.mesh.userData.createSeatedPose?.(), bones: names.map(name => entity.mesh.getObjectByName(name)).filter(Boolean).map(bone => ({ bone, x: bone.rotation.x, y: bone.position.y })) };
                this.poses.set(entity, pose);
            }
            if (seated && pose) {
                // Off-floor actors are cut out of scene traversal. Do not undo
                // that saving by rebuilding their entire authored rig here.
                // Keep the prior pose for exit cleanup; returning to this
                // floor reapplies seating after the current animation state.
                if (!entity.mesh.visible) continue;
                pose.authored?.apply();
                for (const { bone } of pose.bones) {
                    if (bone.name === 'Rig_Hips') bone.position.y = 1.12;
                    else if (bone.name.includes('Thigh')) bone.rotation.x = -Math.PI / 2;
                    else if (bone.name.includes('Shin')) bone.rotation.x = Math.PI / 2;
                    else if (bone.name.includes('UpperArm')) bone.rotation.x = -0.3;
                    else if (bone.name.includes('Forearm')) bone.rotation.x = -0.9;
                }
            } else if (pose) { this.restorePose(pose); this.poses.delete(entity); }
        }
        for (const [entity, pose] of this.poses) if (!entities.includes(entity)) { this.restorePose(pose); this.poses.delete(entity); }
        if (!this.active || !this.savedView) return;
        const table = this.data.tables.find(table => table.id === this.data.yourSeat.tableId);
        if (!table) return;
        const camera = this.engine.renderSystem.camera;
        const focus = new THREE.Vector3(table.x, (table.y || 0) + 1, table.z + (this.engine.isMobile ? 1 : 0));
        const destination = focus.clone().add(new THREE.Vector3(5, 10, 8));
        const t = this.blend * this.blend * (3 - 2 * this.blend);
        camera.position.lerpVectors(this.savedView.position, destination, t);
        camera.lookAt(this.savedView.target.clone().lerp(focus, t));
        const width = Math.min(camera.right - camera.left, camera.top - camera.bottom);
        camera.zoom = THREE.MathUtils.lerp(this.savedView.zoom, width / (this.engine.isMobile ? 13 : 11), t);
        camera.updateProjectionMatrix();
    }

    restorePose(pose) {
        pose.authored?.restore();
        for (const { bone, x, y } of pose.bones) { bone.rotation.x = x; bone.position.y = y; }
    }

    clearActorPresentation() {
        this.restoreCutawayActors();
        for (const pose of this.poses.values()) this.restorePose(pose);
        this.poses.clear();
    }

    removeFurnitureColliders() {
        const colliders = this.engine.collisionManager?.colliders;
        if (!colliders) return;
        for (const box of this.furnitureColliders || []) {
            const index = colliders.indexOf(box); if (index >= 0) colliders.splice(index, 1);
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.closeDoorDialogue();
        if (this.active) this.exitView();
        this.clearActorPresentation();
        disposeCasinoObject(this.furniture); this.dialogue.remove(); this.panel.remove();
        this.slots.dispose();
        this.blackjack.dispose();
        this.poker.dispose();
        this.house.dispose();
        this.playControls.dispose();
        this.stairButton.remove();
        this.removeFurnitureColliders();
        document.removeEventListener('keydown', this.keyHandler, true);
    }
}
