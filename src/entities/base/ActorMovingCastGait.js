import * as THREE from 'three';

// A presentation-only lower-body mask for the known procedural rig. Restore
// the mixer's pose before its next update, then sample just legs/ankles and
// pelvis height. Authored rigs opt in with an explicit quaternion/vector mask;
// never guess imported bone names or blend Run into the skill's upper body.
const LOWER_TRACK = /^(Rig_(?:Thigh|Shin)(?:Left|Right)|Equipment_Foot(?:Left|Right))\.rotation\[x\]$|^(Rig_Hips)\.position\[y\]$/;

export class ActorMovingCastGait {
    constructor(actor) {
        this.actor = actor;
        this.cache = new Map();
        this.saved = [];
        this.active = false;
        this.time = 0;
        this.blend = 0;
    }

    restore() {
        for (const entry of this.saved) {
            if (entry.axis) entry.target[entry.axis] = entry.value;
            else entry.target.copy(entry.value);
        }
        this.saved.length = 0;
    }

    phaseFor(name) {
        return this.active && name === this.name ? this.time : null;
    }

    apply(dt) {
        const actor = this.actor;
        const allowed = actor.currentAbilityAnimation && actor.state === 'MOVING'
            && !actor.currentAbilityAnimation.profile.movement
            && !actor.isCharging && !actor.isWhirlwinding
            && !(actor.stunTimer > 0 || actor.rootTimer > 0 || actor.frozenTimer > 0);
        if (!allowed) { this.active = false; this.blend = 0; return; }
        const name = actor.getMovementAnimationName(actor.isRunning), action = actor.animations[name];
        const clip = action?.getClip();
        if (!clip || !['Run', 'Walk'].includes(name)) return;
        if (!this.cache.has(clip)) {
            const tracks = clip.tracks.flatMap(track => {
                if (actor.mesh.userData.lowerBodyAnimationTracks?.includes(track.name)) {
                    const [name, property] = track.name.split('.');
                    const target = actor.mesh.getObjectByName(name)?.[property];
                    if (!target || !['quaternion', 'position'].includes(property)) return [];
                    return [{ target, property, value: target.clone(), sample: target.clone(), interpolant: track.createInterpolant() }];
                }
                const match = LOWER_TRACK.exec(track.name);
                if (!match) return [];
                const object = actor.mesh.getObjectByName(match[1] || match[2]);
                if (!object) return [];
                return [{ target: match[2] ? object.position : object.rotation,
                    axis: match[2] ? 'y' : 'x', interpolant: track.createInterpolant() }];
            });
            this.cache.set(clip, tracks);
        }
        const starting = !this.active || this.name !== name;
        if (starting) {
            this.time = Math.max(0, action.time || 0) % clip.duration;
            this.blend = 0;
        }
        this.active = true; this.name = name;
        const step = Math.max(0, Number(dt) || 0);
        // On entry the fading Run action already advanced in this mixer tick.
        if (!starting) this.time = (this.time + step * (actor.scaleAnimSpeed ? actor.getMovementAnimationTimeScale() : 1)) % clip.duration;
        this.blend = Math.min(1, this.blend + step / .06);
        for (const track of this.cache.get(clip)) {
            if (track.property) {
                track.value.copy(track.target); this.saved.push(track);
                track.sample.fromArray(track.interpolant.evaluate(this.time));
                if (track.property === 'quaternion') track.target.slerp(track.sample, this.blend);
                else track.target.lerp(track.sample, this.blend);
                continue;
            }
            const value = track.target[track.axis];
            track.value = value; this.saved.push(track);
            track.target[track.axis] = THREE.MathUtils.lerp(value, track.interpolant.evaluate(this.time)[0], this.blend);
        }
    }

    dispose() {
        this.restore(); this.cache.clear(); this.active = false; this.actor = null;
    }
}
