import * as THREE from 'three';
import { createCasinoFurniture, disposeCasinoObject, updateCasinoCutaway } from '../art/ProceduralCasino.js';
import { BlackjackTableUI } from '../ui/BlackjackTableUI.js';

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
        this.panel.append(this.heading, this.status, this.roster, this.ready, this.blackjack.root, this.leave);
        for (const event of ['pointerdown', 'pointerup', 'click', 'wheel']) this.panel.addEventListener(event, e => e.stopPropagation());
        document.body.append(this.panel);
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
        this.engine.network.send('casino', { sessionId: this.data.yourSeat?.sessionId, ...payload });
    }

    requestLeave() {
        if (!this.active) return;
        this.status.textContent = 'Leaving table… waiting for the server.';
        this.send({ action: 'leave' });
    }

    updateState(payload = {}) {
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
            yourSeat: this.engine.currentInstanceId ? null : payload.yourSeat || null };
        const seat = this.data.yourSeat;
        const isBlackjack = seat?.tableId === 'public-blackjack' && Boolean(payload.blackjack);
        this.blackjack.update(isBlackjack ? payload.blackjack : null, this.engine.player?.id);
        this.panel.classList.toggle('has-blackjack', isBlackjack);
        this.ready.hidden = isBlackjack;
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
            if (!engine.currentInstanceId && this.lastSeat && engine.player.state !== 'DEAD') {
                engine.player.position.set(this.lastSeat.exitX, 0, this.lastSeat.exitZ);
                engine.player.state = 'IDLE'; engine.player.resetTransformInterpolation?.();
            }
        }
        this.savedView = null;
    }

    handlePrimaryClick(event) {
        if (this.active) return true;
        if (!event || !this.furniture?.parent || event.button > 0 || !Number.isFinite(event.clientX)) return false;
        const engine = this.engine;
        const rect = engine.renderSystem.renderer.domElement.getBoundingClientRect();
        this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        this.raycaster.setFromCamera(this.pointer, engine.renderSystem.camera);
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
        if (Math.abs(engine.player.position.x) > 9 || engine.player.position.z > 178 || engine.player.position.z < 162) {
            engine.uiManager.addChatMessage?.('System', 'Walk through the casino entrance before choosing a chair.'); return true;
        }
        engine.clearCombatIntentState?.();
        this.pendingSeat = { ...selection, ...seat, expiresAt: performance.now() + 15000 };
        engine.player.move(new THREE.Vector3(seat.exitX, 0, seat.exitZ));
        return true;
    }

    beforeUpdate(dt) {
        const engine = this.engine, player = engine.player;
        if (!player) return;
        if (engine.currentInstanceId && this.active) { this.data.yourSeat = null; this.exitView(); }
        const overworld = !engine.currentInstanceId;
        const near = overworld && Math.hypot(player.position.x, player.position.z - 170) < 50;
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
        updateCasinoCutaway(shell, overworld ? player.position : null);
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
        this.poses.clear(); disposeCasinoObject(this.furniture); this.panel.remove();
        this.removeFurnitureColliders();
        document.removeEventListener('keydown', this.keyHandler, true);
    }
}
