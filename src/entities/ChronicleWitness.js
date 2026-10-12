import { Entity } from './Entity.js';
import * as THREE from 'three';
import { findChronicleWitness } from '../data/chronicleWitnesses.js';
import { RemoteTransformBuffer, exponentialSmoothingFactor } from '../core/MovementSmoothing.js';

// A conversational resident, not an Actor or quest giver. No attack target,
// quest marker, local completion or reward-producing message is introduced.
export class ChronicleWitness extends Entity {
    constructor(id) {
        super(id);
        const witness = findChronicleWitness(id);
        this.witnessInstanceId = witness?.instanceId || '';
        this.type = 'ChronicleWitness';
        this.name = witness?.name || 'Covenant witness';
        this.meshType = witness?.model || 'QuestNPC';
        this.remoteTransformBuffer = new RemoteTransformBuffer();
        this.walkWeight = 0;
    }

    setMesh(mesh) {
        super.setMesh(mesh);
        this.serviceMarks = [];
        mesh.traverse(part => {
            if (/_Service(?:Plinth|Sigil)$/.test(part.name)) {
                this.serviceMarks.push([part, part.visible]); part.visible = false;
            }
        });
        this.mixer?.stopAllAction();
        this.mixer = new THREE.AnimationMixer(mesh);
        const idle = mesh.userData.animations?.find(clip => clip.name === 'Idle');
        if (idle) this.mixer.clipAction(idle).play();
        this.walkRig = Object.fromEntries(['ThighLeft', 'ThighRight', 'ShinLeft', 'ShinRight', 'UpperArmLeft', 'UpperArmRight'].map(name => {
            const pivot = mesh.getObjectByName(`Rig_${name}`);
            return [name, pivot ? { pivot, rest: pivot.rotation.x } : null];
        }));
        this.walkPhase = 0;
    }

    update(dt) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        const step = Math.min(dt, .1), sample = this.remoteTransformBuffer.sample();
        const previous = this.position.clone();
        if (sample) {
            this.position.copy(sample.position);
            this.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, sample.rotation);
        }
        const distance = Math.hypot(this.position.x - previous.x, this.position.z - previous.z);
        const speed = distance / step;
        this.walkWeight += (Math.min(1, speed / .9) - this.walkWeight) * exponentialSmoothingFactor(10, step);
        this.walkPhase = (this.walkPhase || 0) + distance * 3.4;
        this.mixer?.update(step);
        const stride = Math.sin(this.walkPhase) * .42 * this.walkWeight;
        for (const [name, rig] of Object.entries(this.walkRig || {})) {
            if (!rig) continue;
            const side = name.endsWith('Left') ? 1 : -1;
            rig.pivot.rotation.x = rig.rest + (name.startsWith('Shin') ? Math.max(0, -side * stride) * .7 :
                name.startsWith('UpperArm') ? -side * stride * .55 : side * stride);
        }
    }

    pushRemoteTransform(position, rotation, options) {
        const result = this.remoteTransformBuffer.push(position, rotation, options);
        if (result.teleported) {
            this.position.copy(position);
            this.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotation || 0);
            this.resetTransformInterpolation();
        }
        return result;
    }

    dispose() {
        this.mixer?.stopAllAction();
        if (this.mesh) this.mixer?.uncacheRoot(this.mesh);
        this.mixer = null;
        this.remoteTransformBuffer.clear();
        this.walkRig = null;
        for (const [mark, visible] of this.serviceMarks || []) mark.visible = visible;
        this.serviceMarks = null;
        super.dispose();
    }

    interact(engine) {
        const player = engine.player;
        if (!player || player.state === 'DEAD' || !this.isActive ||
            (engine.currentInstanceId || '') !== this.witnessInstanceId) return false;
        const distance = Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z);
        if (!Number.isFinite(distance) || distance > 5) return false;
        return engine.uiManager?.quest?.openWitnessConversation(this.id) || false;
    }
}
