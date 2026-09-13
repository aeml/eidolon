import * as THREE from 'three';
import { createCasinoFurniture, disposeCasinoObject, updateCasinoCutaway } from '../art/ProceduralCasino.js';
import { BlackjackTableUI } from '../ui/BlackjackTableUI.js';
import { SlotMachineUI } from '../ui/SlotMachineUI.js';
import { PokerTableUI } from '../ui/PokerTableUI.js';
import { AUDIO_CUES } from '../audio/AudioManager.js';
const CASINO_INSTANCE = 'lanternhold-casino';

export class CasinoController {
    constructor(engine) {
        this.engine = engine;
        this.data = { tables: [], occupants: [], yourSeat: null };
        this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
        this.poses = new Map(); this.nextPoll = 0; this.active = false;
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
        this.slots = new SlotMachineUI(payload => this.send(payload), sound => this.engine.playAudioCue?.({ spin: AUDIO_CUES.casinoSpin, stop: AUDIO_CUES.uiClick, win: AUDIO_CUES.casinoWin, bonus: AUDIO_CUES.casinoBonus, jackpot: AUDIO_CUES.casinoJackpot }[sound]));
        this.panel.append(this.heading, this.status, this.roster, this.ready, this.blackjack.root, this.slots.root, this.poker.root, this.leave);
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
        if (payload.action.startsWith('slot_') && this.engine.network.socket?.readyState !== WebSocket.OPEN) return false;
        this.engine.network.send('casino', { sessionId: this.data.yourSeat?.sessionId, ...payload });
    }

    requestLeave() {
        if (!this.active) return;
        this.slots.stopAuto('Leaving machine; auto spins stopped.');
        this.status.textContent = 'Leaving table… waiting for the server.';
        this.send({ action: 'leave' });
    }

    handleActionError(error) {
        if (!error || error.sessionId !== this.data.yourSeat?.sessionId) return;
        this.slots.rejectAction(error); this.blackjack.rejectAction(error); this.poker.rejectAction(error);
    }

    updateState(payload = {}) {
        if (this.data.yourSeat?.sessionId !== payload.yourSeat?.sessionId) this.slots.update(null);
        const tables = Array.isArray(payload.tables) ? payload.tables : [];
        const signature = JSON.stringify(tables);
        if (signature !== this.catalogSignature) {
            this.removeFurnitureColliders();
            disposeCasinoObject(this.furniture);
            this.furniture = createCasinoFurniture(tables); this.catalogSignature = signature;
            this.furnitureColliders = tables.map(table => new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(table.x, 1, table.z), new THREE.Vector3(table.game === 'slots' ? 1.55 : 2.8, 2, table.game === 'slots' ? 0.95 : 2.8)));
        }
        this.data = { tables, occupants: Array.isArray(payload.occupants) ? payload.occupants : [],
            preparation: payload.preparation || {},
            yourSeat: this.engine.currentInstanceId === CASINO_INSTANCE ? payload.yourSeat || null : null };
        const seat = this.data.yourSeat;
        const isBlackjack = tables.find(table => table.id === seat?.tableId)?.game === 'blackjack' && Boolean(payload.blackjack);
        const isSlots = seat?.tableId?.startsWith('public-slots-') && Boolean(payload.slots);
        const isPoker = seat?.tableId === 'public-poker' && Boolean(payload.poker);
        this.poker.update(isPoker ? payload.poker : null, this.engine.player?.id);
        this.panel.classList.toggle('has-poker', isPoker);
        this.slots.update(isSlots ? payload.slots : null);
        this.panel.classList.toggle('has-slots', Boolean(isSlots));
        this.blackjack.update(isBlackjack ? payload.blackjack : null, this.engine.player?.id);
        this.panel.classList.toggle('has-blackjack', isBlackjack);
        this.ready.hidden = isBlackjack || isSlots || isPoker;
        this.roster.hidden = Boolean(isSlots);
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
        this.status.textContent = `${phase} ${ready} ready · ${occupants.length}/${table?.seats.length || 0} seats occupied. Roster changes reset readiness. Games and wagering arrive in the next casino stage; no Gold is spent here. Reconnect reservations last 60 seconds.`;
        this.ready.disabled = !preparation?.revision;
        this.ready.textContent = seat.ready ? 'Not ready' : 'Ready at table';
        this.ready.setAttribute('aria-pressed', String(Boolean(seat.ready)));
        if (isBlackjack) this.status.textContent = 'Public floor · Gold blackjack. Leaving restores world controls; confirmed wagers continue and payouts are saved.';
        if (isSlots) this.status.textContent = 'Public floor · Gold slots. Free spins and bonus choices belong to you and remain saved when you leave.';
        if (isPoker) this.status.textContent = 'Public floor · Real-player Hold’em. Leaving folds a remaining stack; all-in hands stay eligible. Unspent Gold and winnings return after the hand.';
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
                engine.player.position.set(this.lastSeat.exitX, 0, this.lastSeat.exitZ);
                engine.player.state = 'IDLE'; engine.player.resetTransformInterpolation?.();
            }
        }
        this.savedView = null;
    }

    showDoorDialogue(kind) {
        const guard = kind === 'guard', exit = kind === 'exit';
        this.engine.clearCombatIntentState?.();
        this.engine.inputManager?.clearInputState?.();
        if (this.engine.player) this.engine.player.targetPosition = null;
        const heading = document.createElement('h2'); heading.textContent = guard ? 'VIP Guard' : 'The Fourfold Casino';
        const copy = document.createElement('p');
        copy.textContent = guard ? 'You must be a VIP to enter'
            : exit ? 'Return to Lanternhold? Your saved casino outcomes remain yours.'
                : 'Step into Lanternhold’s grand gaming hall. Meet other adventurers at Gold tables and elemental machines. The upstairs lounge is reserved for VIP guests.';
        this.dialogue.replaceChildren(heading, copy);
        if (!guard) this.dialogue.append(this.button(exit ? 'Return to Lanternhold' : 'Enter Casino', () => {
            this.dialogue.close(); this.pendingDoor = null;
            if (exit) this.engine.requestTownRecall();
            else this.send({ action: 'enter' });
        }));
        this.dialogue.append(this.button('Close', () => this.dialogue.close()));
        if (!this.dialogue.open) this.dialogue.showModal();
    }

    handlePrimaryClick(event) {
        if (this.active || this.dialogue.open) return true;
        if (!event || event.button > 0 || !Number.isFinite(event.clientX)) return false;
        const engine = this.engine;
        const rect = engine.renderSystem.renderer.domElement.getBoundingClientRect();
        this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        this.raycaster.setFromCamera(this.pointer, engine.renderSystem.camera);
        const inside = engine.currentInstanceId === CASINO_INSTANCE;
        const shell = engine.renderSystem.scene.getObjectByName(inside ? 'lanternhold-casino-interior' : 'lanternhold-casino-shell');
        const targets = inside ? [shell?.userData.casinoGuard, shell?.userData.casinoExit] : !engine.currentInstanceId ? [shell?.userData.casinoDoor] : [];
        const hit = this.raycaster.intersectObjects(targets.filter(Boolean), true)[0];
        if (hit) {
            let kind = 'entry';
            if (inside) kind = this.raycaster.intersectObject(shell.userData.casinoGuard, true).length ? 'guard' : 'exit';
            const destination = new THREE.Vector3(0, 0, kind === 'entry' ? 181 : kind === 'guard' ? 152 : 200);
            if (engine.player.position.distanceTo(destination) < 7) this.showDoorDialogue(kind);
            else { this.pendingDoor = { kind, destination }; engine.player.move(destination); }
            return true;
        }
        if (!inside || !this.furniture?.parent) return false;
        this.stairRoute = null;
        if (engine.player.position.y > 1) return false;
        const hits = this.raycaster.intersectObjects(this.furniture.userData.seats, true);
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
        engine.player.move(new THREE.Vector3(seat.exitX, 0, seat.exitZ));
        return true;
    }

    walkStairs() {
        const p = this.engine.player?.position;
        if (!p || this.active) return;
        const inside = this.engine.currentInstanceId === CASINO_INSTANCE;
        if (inside) this.showDoorDialogue(p.z < 160 ? 'guard' : 'exit');
        else if (!this.engine.currentInstanceId) this.showDoorDialogue('entry');
    }

    beforeUpdate(dt) {
        const engine = this.engine, player = engine.player;
        if (engine.network.socket?.readyState !== WebSocket.OPEN && this.slots.autoRemaining) this.slots.stopAuto('Connection lost; auto spins stopped.');
        if (!player) return;
        if (engine.currentInstanceId !== CASINO_INSTANCE && this.active) { this.data.yourSeat = null; this.exitView(); }
        const overworld = engine.currentInstanceId === CASINO_INSTANCE;
        const nearGuard = overworld && Math.hypot(player.position.x, player.position.z - 150) < 7;
        const nearExit = overworld && Math.hypot(player.position.x, player.position.z - 201) < 7;
        const nearDoor = !engine.currentInstanceId && Math.hypot(player.position.x, player.position.z - 181) < 7;
        this.stairButton.hidden = this.active || !(nearGuard || nearExit || nearDoor);
        this.stairButton.textContent = nearGuard ? 'Talk to VIP Guard' : nearExit ? 'Leave Casino' : 'Casino Entrance';
        if (engine.inputManager?.groundPlane) engine.inputManager.groundPlane.constant = 0;
        if (this.pendingDoor) {
            const { kind, destination } = this.pendingDoor;
            if (player.position.distanceTo(destination) < 6) { this.pendingDoor = null; player.targetPosition = null; this.showDoorDialogue(kind); }
            else if ((kind === 'entry') === overworld) this.pendingDoor = null;
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
        const shell = engine.renderSystem.scene.getObjectByName('lanternhold-casino-shell');
        updateCasinoCutaway(shell, null);
        const balcony = engine.renderSystem.scene.getObjectByName('casino-vip-balcony');
        if (balcony) balcony.visible = player.position.z > 149 && Math.abs(player.position.x) < 23;
        if (this.stairRoute?.length) {
            if (!overworld || player.state === 'DEAD' || this.active) this.stairRoute = null;
            else if (player.position.distanceTo(this.stairRoute[0]) < .35) {
                this.stairRoute.shift();
                if (this.stairRoute.length) player.move(this.stairRoute[0]);
            }
        }
        if (player.position.y > 1) this.pendingSeat = null;
        if (this.pendingSeat) {
            if (!overworld || performance.now() > this.pendingSeat.expiresAt) this.pendingSeat = null;
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
            player.position.set(position.x, 0, position.z); player.state = 'SEATED';
            player.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), position.rotation);
            player.velocity?.set(0, 0, 0); player.resetTransformInterpolation?.();
        }
    }

    render(entities) {
        for (const entity of entities) {
            if (!entity.mesh) continue;
            const seated = entity.state === 'SEATED' || (entity === this.engine.player && this.active);
            let pose = this.poses.get(entity);
            if (pose && pose.mesh !== entity.mesh) { this.restorePose(pose); this.poses.delete(entity); pose = null; }
            if (seated && !pose) {
                const names = ['Rig_Hips', ...['Left', 'Right'].flatMap(side => ['Thigh', 'Shin', 'UpperArm', 'Forearm'].map(part => `Rig_${part}${side}`))];
                pose = { mesh: entity.mesh, bones: names.map(name => entity.mesh.getObjectByName(name)).filter(Boolean).map(bone => ({ bone, x: bone.rotation.x, y: bone.position.y })) };
                this.poses.set(entity, pose);
            }
            if (seated && pose) {
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
        const focus = new THREE.Vector3(table.x, 1, table.z + (this.engine.isMobile ? 1 : 0));
        const destination = focus.clone().add(new THREE.Vector3(5, 10, 8));
        const t = this.blend * this.blend * (3 - 2 * this.blend);
        camera.position.lerpVectors(this.savedView.position, destination, t);
        camera.lookAt(this.savedView.target.clone().lerp(focus, t));
        const width = Math.min(camera.right - camera.left, camera.top - camera.bottom);
        camera.zoom = THREE.MathUtils.lerp(this.savedView.zoom, width / (this.engine.isMobile ? 13 : 11), t);
        camera.updateProjectionMatrix();
    }

    restorePose(pose) { for (const { bone, x, y } of pose.bones) { bone.rotation.x = x; bone.position.y = y; } }

    removeFurnitureColliders() {
        const colliders = this.engine.collisionManager?.colliders;
        if (!colliders) return;
        for (const box of this.furnitureColliders || []) {
            const index = colliders.indexOf(box); if (index >= 0) colliders.splice(index, 1);
        }
    }

    dispose() {
        if (this.active) this.exitView();
        for (const pose of this.poses.values()) this.restorePose(pose);
        this.poses.clear(); disposeCasinoObject(this.furniture); this.dialogue.remove(); this.panel.remove();
        this.slots.dispose();
        this.poker.dispose();
        this.stairButton.remove();
        this.removeFurnitureColliders();
        document.removeEventListener('keydown', this.keyHandler, true);
    }
}
