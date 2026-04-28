const DEFAULT_VOLUME = 0.45;
const CUE_COOLDOWN_MS = 45;
const DEFAULT_DETAIL_LEVEL = 'full';

const AUDIO_DETAIL_LEVELS = Object.freeze({
    full: 'full',
    reduced: 'reduced',
});

export const AUDIO_CUES = Object.freeze({
    uiClick: 'ui.click',
    uiOpen: 'ui.open',
    uiClose: 'ui.close',
    lootPickup: 'loot.pickup',
    lootBlocked: 'loot.blocked',
    combatHit: 'combat.hit',
    combatMiss: 'combat.miss',
    jumpStart: 'movement.jump.start',
    jumpLand: 'movement.jump.land',
});

const createCueAsset = (category, slug) => Object.freeze({
    category,
    fallback: 'generated',
    sources: Object.freeze([
        Object.freeze({ src: `assets/audio/cues/${slug}.ogg`, type: 'audio/ogg' }),
        Object.freeze({ src: `assets/audio/cues/${slug}.mp3`, type: 'audio/mpeg' }),
    ]),
});

export const AUDIO_CUE_ASSETS = Object.freeze({
    [AUDIO_CUES.uiClick]: createCueAsset('ui', 'ui-click'),
    [AUDIO_CUES.uiOpen]: createCueAsset('ui', 'ui-open'),
    [AUDIO_CUES.uiClose]: createCueAsset('ui', 'ui-close'),
    [AUDIO_CUES.lootPickup]: createCueAsset('loot', 'loot-pickup'),
    [AUDIO_CUES.lootBlocked]: createCueAsset('loot', 'loot-blocked'),
    [AUDIO_CUES.combatHit]: createCueAsset('combat', 'combat-hit'),
    [AUDIO_CUES.combatMiss]: createCueAsset('combat', 'combat-miss'),
    [AUDIO_CUES.jumpStart]: createCueAsset('movement', 'jump-start'),
    [AUDIO_CUES.jumpLand]: createCueAsset('movement', 'jump-land'),
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
        this.assetManifest = options.assetManifest || AUDIO_CUE_ASSETS;
        this.mediaFactory = options.mediaFactory || null;
        this.masterGain = null;
        this.lastCueTimes = new Map();
        this.mediaCache = new Map();
        this.failedAssetCues = new Set();
        this.unlocked = false;

        this.enabled = this.readStoredBoolean('eidolon.audioEnabled', true);
        this.volume = this.readStoredNumber('eidolon.audioVolume', DEFAULT_VOLUME, 0, 1);
        this.detailLevel = this.readStoredDetailLevel('eidolon.audioDetailLevel', DEFAULT_DETAIL_LEVEL);
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

    readStoredDetailLevel(key, fallback) {
        try {
            const stored = this.storage?.getItem?.(key);
            return this.normalizeDetailLevel(stored || fallback);
        } catch {
            return fallback;
        }
    }

    normalizeDetailLevel(detailLevel) {
        return detailLevel === AUDIO_DETAIL_LEVELS.reduced ? AUDIO_DETAIL_LEVELS.reduced : AUDIO_DETAIL_LEVELS.full;
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

    setDetailLevel(detailLevel) {
        this.detailLevel = this.normalizeDetailLevel(detailLevel);
        this.persistSetting('eidolon.audioDetailLevel', this.detailLevel);
    }

    getSettings() {
        return {
            enabled: this.enabled,
            volume: this.volume,
            detailLevel: this.detailLevel,
        };
    }

    getCueAssetMetadata(cueName) {
        return this.assetManifest?.[cueName] || null;
    }

    getCueAssetManifest() {
        return this.assetManifest;
    }

    isCueAllowedForDetailLevel(cueName) {
        if (this.detailLevel !== AUDIO_DETAIL_LEVELS.reduced) return true;
        return cueName !== AUDIO_CUES.uiClick
            && cueName !== AUDIO_CUES.uiOpen
            && cueName !== AUDIO_CUES.uiClose;
    }

    canPlay(cueName) {
        if (!this.enabled) return false;
        if (!this.isCueAllowedForDetailLevel(cueName)) return false;
        const lastPlayedAt = this.lastCueTimes.get(cueName) || 0;
        const now = this.now();
        if (now - lastPlayedAt < CUE_COOLDOWN_MS) return false;
        this.lastCueTimes.set(cueName, now);
        return true;
    }

    play(cueName, options = {}) {
        if (!this.canPlay(cueName)) return false;
        if (this.playAuthoredCue(cueName)) return true;

        const context = this.ensureContext();
        const destination = this.ensureMasterGain();
        const cue = this.createCue(cueName, options);
        if (!context || !destination || !cue) return false;

        const startAt = context.currentTime || 0;
        try {
            cue.forEach((tone) => this.playTone(context, destination, startAt, tone));
        } catch {
            return false;
        }
        return true;
    }

    playAuthoredCue(cueName) {
        if (!this.mediaFactory || this.failedAssetCues.has(cueName)) return false;
        const asset = this.getCueAssetMetadata(cueName);
        if (!asset?.sources?.length) return false;

        const media = this.getMediaForCue(cueName, asset);
        if (!media?.play) return false;

        try {
            if ('currentTime' in media) media.currentTime = 0;
            if ('volume' in media) media.volume = this.volume;
            const result = media.play();
            if (result?.catch) {
                result.catch(() => {
                    this.failedAssetCues.add(cueName);
                });
            }
            return true;
        } catch {
            this.failedAssetCues.add(cueName);
            return false;
        }
    }

    getMediaForCue(cueName, asset) {
        if (this.mediaCache.has(cueName)) return this.mediaCache.get(cueName);

        const source = asset.sources[0];
        let media = null;
        try {
            media = this.mediaFactory(source, cueName, asset) || null;
        } catch {
            this.failedAssetCues.add(cueName);
            return null;
        }

        if (media && 'preload' in media) media.preload = 'auto';
        this.mediaCache.set(cueName, media);
        return media;
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
            case AUDIO_CUES.lootBlocked:
                return [
                    { frequency: 260 * pitch, duration: 0.055, type: 'triangle', gain: 0.06 },
                    { frequency: 180 * pitch, delay: 0.04, duration: 0.07, type: 'triangle', gain: 0.045 },
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
        if (oscillator.frequency?.setValueAtTime) {
            oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
        } else if (oscillator.frequency) {
            oscillator.frequency.value = tone.frequency;
        }
        if (gain.gain?.setValueAtTime && gain.gain?.exponentialRampToValueAtTime) {
            gain.gain.setValueAtTime(0.0001, toneStart);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain), toneStart + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);
        } else if (gain.gain) {
            gain.gain.value = peakGain;
        }
        oscillator.connect?.(gain);
        gain.connect?.(destination);
        oscillator.start?.(toneStart);
        oscillator.stop?.(toneEnd + 0.01);
    }
}
