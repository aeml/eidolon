import * as THREE from 'three';
import { createMotionPreference } from '../core/MotionPreference.js';

const DURATION = .28;

// Presentation only: an unanimated parent composes with the named rig's mixer
// tracks. Never move the actor root, selection volume or authoritative position.
export class ActorHitReaction {
    constructor(actor) {
        this.actor = actor;
        const mesh = actor.mesh;
        this.rig = mesh?.children.find(child => /^(RigRoot|Rig_.*Body)$/.test(child.name));
        this.pivot = null;
        this.elapsed = DURATION;
        this.direction = new THREE.Vector3();
        this.axis = new THREE.Vector3();
        this.inverse = new THREE.Quaternion();
        this.motionPreference = createMotionPreference();
        if (!this.rig) return;
        this.pivot = new THREE.Group();
        this.pivot.name = 'ActorHitReactionPivot';
        mesh.add(this.pivot);
        this.pivot.add(this.rig);
    }

    play(sourcePosition, amount) {
        const { actor, pivot } = this;
        if (!pivot || actor.state === 'DEAD' || actor.stats?.hp <= 0
            || this.motionPreference?.matches || !Number.isFinite(amount) || amount <= 0
            || !sourcePosition || this.elapsed < DURATION) return false;
        this.direction.subVectors(actor.position, sourcePosition).setY(0);
        const distance = this.direction.length();
        if (!Number.isFinite(distance) || distance < .001) return false;
        this.direction.divideScalar(distance).applyQuaternion(this.inverse.copy(actor.rotation).invert());
        this.axis.set(this.direction.z, 0, -this.direction.x).normalize();
        // Large bodies resist recoil. A boss must not look staggered or lose
        // its wind-up just because several players land ordinary hits.
        const height = Number(actor.mesh.userData.bounds?.height) || 4;
        const mass = actor.mesh.userData.proceduralBossFamily ? .3 : Math.min(1, 4 / Math.max(1, height));
        const fraction = amount / Math.max(1, Number(actor.stats?.maxHp) || 100);
        this.angle = (.055 + Math.min(.045, fraction * .3)) * mass;
        this.elapsed = 0;
        return true;
    }

    update(dt) {
        if (!this.pivot) return;
        if (this.actor.state === 'DEAD' || this.actor.stats?.hp <= 0 || this.motionPreference?.matches) {
            this.elapsed = DURATION;
        } else if (Number.isFinite(dt)) {
            this.elapsed = Math.min(DURATION, this.elapsed + Math.max(0, dt));
        }
        if (this.elapsed >= DURATION) {
            this.pivot.quaternion.identity();
            return;
        }
        // Quick contact, eased recovery; no spring-like repeated wobble.
        const t = this.elapsed;
        const envelope = t < .045 ? Math.sin(t / .045 * Math.PI / 2)
            : Math.pow(1 - (t - .045) / (DURATION - .045), 2);
        this.pivot.quaternion.setFromAxisAngle(this.axis, this.angle * envelope);
    }

    dispose() {
        if (!this.pivot) return;
        this.pivot.quaternion.identity();
        this.pivot.parent?.add(this.rig);
        this.pivot.removeFromParent();
        this.pivot = null;
    }
}
