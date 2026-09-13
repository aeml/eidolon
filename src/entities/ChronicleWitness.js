import { Entity } from './Entity.js';
import * as THREE from 'three';
import { CHRONICLE_WITNESSES } from '../data/chronicleWitnesses.js';

// A conversational resident, not an Actor or quest giver. No attack target,
// quest marker, local completion or reward-producing message is introduced.
export class ChronicleWitness extends Entity {
    constructor(id) {
        super(id);
        const witness = CHRONICLE_WITNESSES.find(value => value.id === id);
        this.type = 'ChronicleWitness';
        this.name = witness?.name || 'Covenant witness';
        this.meshType = witness?.model || 'QuestNPC';
    }

    setMesh(mesh) {
        super.setMesh(mesh);
        this.mixer?.stopAllAction();
        this.mixer = new THREE.AnimationMixer(mesh);
        const idle = mesh.userData.animations?.find(clip => clip.name === 'Idle');
        if (idle) this.mixer.clipAction(idle).play();
    }

    update(dt) {
        if (Number.isFinite(dt) && dt > 0) this.mixer?.update(Math.min(dt, 0.1));
    }

    dispose() {
        this.mixer?.stopAllAction();
        if (this.mesh) this.mixer?.uncacheRoot(this.mesh);
        this.mixer = null;
        super.dispose();
    }

    interact(engine) {
        const player = engine.player;
        if (!player || player.state === 'DEAD' || !this.isActive || engine.currentInstanceId) return false;
        const distance = Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z);
        if (!Number.isFinite(distance) || distance > 5) return false;
        return engine.uiManager?.quest?.openWitnessConversation(this.id) || false;
    }
}
