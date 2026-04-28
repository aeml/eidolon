const DEFAULT_VOLUME = 0.45;
const CUE_COOLDOWN_MS = 45;

export const AUDIO_CUES = Object.freeze({
    uiClick: 'ui.click',
    uiOpen: 'ui.open',
    uiClose: 'ui.close',
    lootPickup: 'loot.pickup',
    combatHit: 'combat.hit',
    combatMiss: 'combat.miss',
    jumpStart: 'movement.jump.start',
    jumpLand: 'movement.jump.land',
});

export class AudioManager {
    constructor(options = {}) {
        this.contextFactory = options.contextFactory || (() => {
            const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
            return AudioContextClass ? new AudioContextClass() : null;
        });
        this.now = options.now || (() => Date.now());
        this.storage = options.storage || globalThis.localStorage || null;
        this.context = options.context || null;
        this.masterGain = null;
        this.lastCueTimes = new Map();
        this.unlocked = false;

        this.enabled = this.readStoredBoolean('eidolon.audioEnabled', true);
        this.volume = this.readStoredNumber('eidolon.audioVolume', DEFAULT_VOLUME, 0, 1);
    }

    readStoredBoolean(key, fallback) {
        try {
            const stored = this.storage?.getItem?.(key);
            return stored === null || stored === undefined ? fallback : stored === 'true';
        } catch {
            return fallback;
        }
    }

    readStoredNumber(key, fallback, min, max) {
        try {
            const storedValue = this.storage?.getItem?.(key);
            if (storedValue === null || storedValue === undefined) return fallback;
            const stored = Number(storedValue);
            return Number.isFinite(stored) ? Math.max(min, Math.min(max, stored)) : fallback;
        } catch {
            return fallback;
        }
    }

    persistSetting(key, value) {
        try {
            this.storage?.setItem?.(key, String(value));
        } catch {
            // Storage can be unavailable in private contexts; audio still works for this session.
        }
    }

    ensureContext() {
        if (this.context) return this.context;
        this.context = this.contextFactory?.() || null;
        if (!this.context) return null;
        return this.context;
    }

    ensureMasterGain() {
        const context = this.ensureContext();
        if (!context) return null;
        if (this.masterGain) return this.masterGain;

        this.masterGain = context.createGain();
        this.masterGain.gain.value = this.enabled ? this.volume : 0;
        this.masterGain.connect(context.destination);
        return this.masterGain;
    }

    unlock() {
        const context = this.ensureContext();
        if (!context) return false;
        this.ensureMasterGain();

        if (context.state === 'suspended' && typeof context.resume === 'function') {
            const resumeResult = context.resume();
            if (resumeResult?.catch) resumeResult.catch(() => {});
        }

        this.unlocked = true;
        return true;
    }

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        this.persistSetting('eidolon.audioEnabled', this.enabled);
        if (this.masterGain) this.masterGain.gain.value = this.enabled ? this.volume : 0;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, Number(volume) || 0));
        this.persistSetting('eidolon.audioVolume', this.volume);
        if (this.masterGain) this.masterGain.gain.value = this.enabled ? this.volume : 0;
    }

    getSettings() {
        return {
            enabled: this.enabled,
            volume: this.volume,
        };
    }

    canPlay(cueName) {
        if (!this.enabled) return false;
        const lastPlayedAt = this.lastCueTimes.get(cueName) || 0;
        const now = this.now();
        if (now - lastPlayedAt < CUE_COOLDOWN_MS) return false;
        this.lastCueTimes.set(cueName, now);
        return true;
    }

    play(cueName, options = {}) {
        if (!this.canPlay(cueName)) return false;
        const context = this.ensureContext();
        const destination = this.ensureMasterGain();
        const cue = this.createCue(cueName, options);
        if (!context || !destination || !cue) return false;

        const startAt = context.currentTime || 0;
        cue.forEach((tone) => this.playTone(context, destination, startAt, tone));
        return true;
    }

    createCue(cueName, options = {}) {
        const impact = Math.max(0, Math.min(1, Number(options.impact ?? 0.5)));
        const pitch = Math.max(0.5, Math.min(1.8, Number(options.pitch ?? 1)));

        switch (cueName) {
            case AUDIO_CUES.uiClick:
                return [{ frequency: 620 * pitch, duration: 0.035, type: 'triangle', gain: 0.08 }];
            case AUDIO_CUES.uiOpen:
                return [
                    { frequency: 420 * pitch, duration: 0.045, type: 'sine', gain: 0.07 },
                    { frequency: 660 * pitch, delay: 0.035, duration: 0.07, type: 'triangle', gain: 0.06 },
                ];
            case AUDIO_CUES.uiClose:
                return [{ frequency: 360 * pitch, duration: 0.055, type: 'triangle', gain: 0.07 }];
            case AUDIO_CUES.lootPickup:
                return [
                    { frequency: 880 * pitch, duration: 0.055, type: 'sine', gain: 0.08 },
                    { frequency: 1320 * pitch, delay: 0.045, duration: 0.08, type: 'sine', gain: 0.06 },
                ];
            case AUDIO_CUES.combatHit:
                return [
                    { frequency: 160 + impact * 90, duration: 0.045, type: 'sawtooth', gain: 0.08 + impact * 0.05 },
                    { frequency: 82, delay: 0.015, duration: 0.07, type: 'square', gain: 0.04 + impact * 0.03 },
                ];
            case AUDIO_CUES.combatMiss:
                return [{ frequency: 240 * pitch, duration: 0.06, type: 'triangle', gain: 0.045 }];
            case AUDIO_CUES.jumpStart:
                return [{ frequency: 300 * pitch, duration: 0.09, type: 'triangle', gain: 0.075 }];
            case AUDIO_CUES.jumpLand:
                return [
                    { frequency: 120 + impact * 80, duration: 0.06, type: 'square', gain: 0.06 + impact * 0.04 },
                    { frequency: 70, delay: 0.025, duration: 0.08, type: 'sine', gain: 0.04 + impact * 0.04 },
                ];
            default:
                return null;
        }
    }

    playTone(context, destination, startAt, tone) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const toneStart = startAt + (tone.delay || 0);
        const toneEnd = toneStart + tone.duration;
        const peakGain = tone.gain;

        oscillator.type = tone.type;
        oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
        gain.gain.setValueAtTime(0.0001, toneStart);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain), toneStart + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);
        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start(toneStart);
        oscillator.stop(toneEnd + 0.01);
    }
}
