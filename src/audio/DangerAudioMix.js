// An audio-clock envelope makes room for accepted danger warnings. It never
// edits the user's buses or boosts the warning itself, and needs no JS timers.
const DEPTH = Object.freeze({ combat: .65, ambience: .45 });
const ATTACK = .012;
const RECOVERY = .14;

export class DangerAudioMix {
    constructor(audio) {
        this.audio = audio;
        this.gains = new Map();
        this.envelope = null;
    }

    destination(bus) {
        const destination = this.audio.ensureBusGain(bus);
        if (!destination || !Object.hasOwn(DEPTH, bus)) return destination;
        if (!this.gains.has(bus)) {
            const node = this.audio.context.createGain();
            node.connect(destination);
            this.gains.set(bus, node);
            this.schedule(bus, node);
        }
        return this.gains.get(bus);
    }

    weightAt(time) {
        const e = this.envelope;
        if (!e || time >= e.releaseEnd) return 0;
        if (time < e.attackEnd) return e.from + (1 - e.from) * Math.max(0, time - e.start) / ATTACK;
        if (time <= e.holdUntil) return 1;
        return (e.releaseEnd - time) / RECOVERY;
    }

    schedule(bus, node) {
        const now = this.audio.context.currentTime, gain = node.gain, e = this.envelope;
        gain.cancelScheduledValues?.(now);
        gain.setValueAtTime(1 - DEPTH[bus] * this.weightAt(now), now);
        if (!e || now >= e.releaseEnd) return;
        if (now < e.attackEnd) gain.linearRampToValueAtTime(1 - DEPTH[bus], e.attackEnd);
        if (now < e.holdUntil) gain.linearRampToValueAtTime(1 - DEPTH[bus], e.holdUntil);
        gain.linearRampToValueAtTime(1, e.releaseEnd);
    }

    warn(duration) {
        const now = this.audio.context.currentTime, from = this.weightAt(now);
        const holdUntil = Math.max(now + duration, this.envelope?.holdUntil || 0);
        this.envelope = { start: now, from, attackEnd: now + ATTACK, holdUntil, releaseEnd: holdUntil + RECOVERY };
        for (const [bus, node] of this.gains) this.schedule(bus, node);
    }

    reset() {
        this.envelope = null;
        for (const [bus, node] of this.gains) this.schedule(bus, node);
    }

    dispose() {
        this.envelope = null;
        for (const node of this.gains.values()) node.disconnect();
        this.gains.clear();
    }
}
