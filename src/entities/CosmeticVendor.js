import * as THREE from 'three';
import { Entity } from './Entity.js';

export class CosmeticVendor extends Entity {
    constructor(id) {
        super(id);
        this.type = 'CosmeticVendor';
        this.meshType = 'DwarfSalesman';
        this.name = 'Veyra · VIP Outfitter';
    }

    setMesh(mesh) {
        super.setMesh(mesh);
        this.mixer?.stopAllAction();
        this.mixer = new THREE.AnimationMixer(mesh);
        const idle = mesh.userData.animations?.find(clip => clip.name === 'Idle');
        if (idle) this.mixer.clipAction(idle).play();
    }

    update(dt) { if (Number.isFinite(dt) && dt > 0) this.mixer?.update(Math.min(dt, .1)); }

    interact(engine) {
        const player = engine.player;
        const distance = player ? Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) : Infinity;
        if (!this.isActive || player?.state === 'DEAD' || engine.currentInstanceId || !Number.isFinite(distance) || distance > 5) return false;
        engine.clearCombatIntentState?.();
        engine.inputManager?.clearInputState?.();
        return engine.uiManager?.cosmeticVendor?.open() || false;
    }

    dispose() {
        this.mixer?.stopAllAction();
        if (this.mesh) this.mixer?.uncacheRoot(this.mesh);
        this.mixer = null;
        super.dispose();
    }
}
