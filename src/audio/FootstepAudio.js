import { worldAmbienceKey } from './WorldAmbience.js';

export const FOOTSTEP_CUE = 'movement.footstep';
const surfaces = {
    town: 'stone', dungeon: 'stone', dark: 'stone', casino: 'stone', casino_vip: 'stone',
    earth: 'earth', water: 'ice', fire: 'ash', air: 'gravel'
};
const profiles = {
    stone: [1600, 520, 105, .023], earth: [530, 190, 75, .018],
    ice: [2600, 780, 125, .018], ash: [780, 210, 65, .016], gravel: [1900, 420, 90, .021]
};

// Original filtered-noise contacts use the existing shared noise buffer and
// ordinary effect bus; no recordings, new audio graph or per-frame synthesis.
export function createFootstepCue({ surface = 'stone', sequence = 0 } = {}) {
    const [high, low, thud, gain] = profiles[surface] || profiles.stone;
    const pitch = [1, .94, 1.04, .97][Number.isFinite(sequence) ? Math.abs(Math.trunc(sequence)) % 4 : 0];
    return [
        { type: 'noise', filterType: 'lowpass', q: .6, frequency: high * pitch,
            endFrequency: low * pitch, duration: .065, gain },
        { type: 'sine', frequency: thud * pitch, endFrequency: thud * .53 * pitch,
            duration: .075, gain: .012 }
    ];
}

export class FootstepAudio {
    constructor(audio) { this.audio = audio; this.reset(); }

    reset() {
        this.actor = null; this.instance = null; this.instanceType = null;
        this.x = 0; this.z = 0; this.phase = null; this.action = null;
        this.distance = 0; this.elapsed = 0; this.sequence = 0;
    }

    update(engine, dt) {
        const actor = engine.player, position = actor?.position;
        if (this.audio.disposed || engine.isDestroyed || !position ||
            !Number.isFinite(position.x) || !Number.isFinite(position.z)) { this.reset(); return false; }
        const instance = engine.currentInstanceId || '', instanceType = engine.currentInstanceType || '';
        const arriving = actor !== this.actor || instance !== this.instance || instanceType !== this.instanceType;
        const distance = Math.hypot(position.x - this.x, position.z - this.z);
        this.actor = actor; this.instance = instance; this.instanceType = instanceType;
        this.x = position.x; this.z = position.z;
        const blocked = arriving || !Number.isFinite(dt) || dt <= 0 || dt > .25 ||
            distance > Math.max(3, 25 * dt) || distance < .0001 ||
            actor.state !== 'MOVING' || engine.playerJumpState || engine.localRoofFallActive || engine.playerCorrectionVisualState || actor.jumpVisualState || actor.jumpLandingVisual ||
            actor.stunTimer > 0 || actor.rootTimer > 0 || actor.frozenTimer > 0 ||
            actor.teleportPhaseTimer > 0 || actor.isCharging || actor.isWhirlwinding;
        if (blocked) { this.distance = 0; this.elapsed = 0; this.phase = null; this.action = null; return false; }
        this.distance += distance; this.elapsed += dt;

        // Follow the existing locomotion clock, including its lower-body
        // moving-cast layer. No extra skeleton updates or animation mixer.
        const gait = actor.movingCastGait;
        const action = gait?.active ? actor.animations?.[gait.name] : actor.currentAction;
        const name = gait?.active ? gait.name : actor.currentAnimationName;
        const duration = action?.getClip?.().duration;
        const time = gait?.active ? gait.time : action?.time;
        const animated = /(?:^|_)(?:Run|Walk)$/.test(name || '') &&
            Number.isFinite(duration) && duration > 0 && Number.isFinite(time);
        let contact = this.distance >= 3;
        if (animated) {
            const phase = ((time / duration) % 1 + 1) % 1;
            const delta = this.phase === null ? 0 : (phase - this.phase + 1) % 1;
            contact = action === this.action && this.phase !== null && delta > 0 && delta <= .6 &&
                (phase < this.phase || Math.floor(phase * 2) !== Math.floor(this.phase * 2));
            this.phase = phase; this.action = action;
        } else { this.phase = null; this.action = null; }
        if (!contact || this.distance < .08 || this.elapsed < .16) return false;
        // Never catch up missed contacts or queue movement sounds. A busy or
        // muted owner may decline this cue; movement continues unchanged.
        this.distance = 0; this.elapsed = 0;
        return this.audio.play(FOOTSTEP_CUE, {
            surface: surfaces[worldAmbienceKey(engine)] || 'stone', sequence: this.sequence++
        });
    }
}
