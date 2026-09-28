import * as THREE from 'three';
import { Entity } from './Entity.js';
import { WORLD_READINGS } from '../data/worldPopulation.js';
import { openWorldReadingDialog } from '../ui/WorldReadingDialog.js';

export class WorldReading extends Entity {
    constructor(id) {
        super(id);
        this.type = 'WorldReading';
        this.reading = WORLD_READINGS.find(site => site.id === id);
        this.name = this.reading?.name || 'Roadside reading';
    }

    async ensureMesh() {
        if (this.mesh || !this.isActive || !this.reading) return;
        const root = new THREE.Group();
        const stone = new THREE.MeshStandardMaterial({ color: 0xb2aa8d, roughness: .94 });
        const ink = new THREE.MeshStandardMaterial({ color: 0x393b31, roughness: 1 });
        const tablet = new THREE.Mesh(new THREE.BoxGeometry(1.7, .12, 1.05), stone);
        tablet.rotation.x = .55; tablet.position.y = 1.7; root.add(tablet);
        for (let i = 0; i < 5; i++) {
            const line = new THREE.Mesh(new THREE.BoxGeometry(1.2 - i % 2 * .2, .015, .035), ink);
            line.position.set(0, .068, -.32 + i * .15); tablet.add(line);
        }
        // A generous real-geometry pick target, visibly the inscribed tablet.
        // It is never an Actor and does not consume an attack or grant credit.
        root.traverse(part => { if (part.isMesh) { part.userData.entityId = this.id; part.receiveShadow = true; } });
        this.setMesh(root); this.mesh.position.copy(this.position);
    }

    canInteract(engine) {
        const player = engine?.player;
        return Boolean(this.reading && this.isActive && player && player.state !== 'DEAD' && !engine.currentInstanceId &&
            (!engine.currentInstanceType || engine.currentInstanceType === 'overworld') &&
            Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) <= 5);
    }

    interact(engine) {
        if (!this.canInteract(engine)) return false;
        engine.inputManager?.clearInputState?.(); engine.clearCombatIntentState?.();
        engine.pendingInteraction = null; engine.player.targetPosition = null;
        if (engine.player.state === 'MOVING') { engine.player.state = 'IDLE'; engine.player.playAnimation?.('Idle'); }
        this.dialog?.close(); this.dialog = openWorldReadingDialog(engine, this);
        return true;
    }

    update() { this.dialog?.update(); }

    dispose() {
        this.dialog?.close(); this.dialog = null;
        const mesh = this.mesh;
        super.dispose();
        const materials = new Set();
        mesh?.traverse(part => { if (part.isMesh) { part.geometry?.dispose(); materials.add(part.material); } });
        for (const material of materials) material.dispose();
    }
}
