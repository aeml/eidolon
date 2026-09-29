import { WorldAmbience } from './WorldAmbience.js';
import { ABILITY_CAST_PROFILES, getAbilityCastProfile } from './AbilityCastProfiles.js';

const DEFAULT_VOLUME = 0.45;
const CUE_COOLDOWN_MS = 45;
const DEFAULT_DETAIL_LEVEL = 'full';
export const AUDIO_BUSES = Object.freeze(['combat', 'interface', 'ambience']);
export const MAX_CUE_TONES = 24;
const RESERVED_DANGER_TONES = 2;

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
    dangerWarning: 'combat.danger',
    fighterCast: 'ability.fighter',
    rogueCast: 'ability.rogue',
    wizardCast: 'ability.wizard',
    clericCast: 'ability.cleric',
    jumpStart: 'movement.jump.start',
    jumpLand: 'movement.jump.land',
    casinoSpin: 'casino.spin',
    casinoWin: 'casino.win',
    casinoBonus: 'casino.bonus',
    casinoJackpot: 'casino.jackpot',
});

const createCueAsset = (category, slug) => Object.freeze({
    category,
    fallback: 'generated',
    sources: Object.freeze([
        Object.freeze({ src: `assets/audio/cues/${slug}.ogg`, type: 'audio/ogg' }),
        Object.freeze({ src: `assets/audio/cues/${slug}.mp3`, type: 'audio/mpeg' }),
    ]),
});

const generatedCombatCue = Object.freeze({ category: 'combat', fallback: 'generated', sources: Object.freeze([]) });
const CLASS_CAST_CUES = Object.freeze({ Fighter: AUDIO_CUES.fighterCast, Rogue: AUDIO_CUES.rogueCast,
    Wizard: AUDIO_CUES.wizardCast, Cleric: AUDIO_CUES.clericCast });

export function playLocalAbilityCue(engine, actor, skillName) {
    if (!actor || actor !== engine?.player) return false;
    const cue = CLASS_CAST_CUES[actor.meshType || actor.subType || actor.constructor.name];
    return cue ? engine.playAudioCue?.(cue, { skillName }) || false : false;
}

export const AUDIO_CUE_ASSETS = Object.freeze({
    [AUDIO_CUES.casinoSpin]: Object.freeze({ category: 'ui', fallback: 'generated', sources: Object.freeze([]) }),
    [AUDIO_CUES.casinoWin]: Object.freeze({ category: 'ui', fallback: 'generated', sources: Object.freeze([]) }),
    [AUDIO_CUES.casinoBonus]: Object.freeze({ category: 'ui', fallback: 'generated', sources: Object.freeze([]) }),
    [AUDIO_CUES.casinoJackpot]: Object.freeze({ category: 'ui', fallback: 'generated', sources: Object.freeze([]) }),
    [AUDIO_CUES.uiClick]: createCueAsset('ui', 'ui-click'),
    [AUDIO_CUES.uiOpen]: createCueAsset('ui', 'ui-open'),
    [AUDIO_CUES.uiClose]: createCueAsset('ui', 'ui-close'),
    [AUDIO_CUES.lootPickup]: createCueAsset('loot', 'loot-pickup'),
    [AUDIO_CUES.lootBlocked]: createCueAsset('loot', 'loot-blocked'),
    [AUDIO_CUES.combatHit]: createCueAsset('combat', 'combat-hit'),
    [AUDIO_CUES.combatMiss]: createCueAsset('combat', 'combat-miss'),
    [AUDIO_CUES.dangerWarning]: generatedCombatCue,
    [AUDIO_CUES.fighterCast]: generatedCombatCue,
    [AUDIO_CUES.rogueCast]: generatedCombatCue,
    [AUDIO_CUES.wizardCast]: generatedCombatCue,
    [AUDIO_CUES.clericCast]: generatedCombatCue,
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
        this.busGains = new Map();
        this.lastCueTimes = new Map();
        this.mediaCache = new Map();
        this.failedAssetCues = new Set();
        this.unlocked = false;
        this.disposed = false;
        this.activeTones = new Set();

        this.enabled = this.readStoredBoolean('eidolon.audioEnabled', true);
        this.volume = this.readStoredNumber('eidolon.audioVolume', DEFAULT_VOLUME, 0, 1);
        this.detailLevel = this.readStoredDetailLevel('eidolon.audioDetailLevel', DEFAULT_DETAIL_LEVEL);
        this.busVolumes = Object.fromEntries(AUDIO_BUSES.map(bus =>
            [bus, this.readStoredNumber(`eidolon.audioBus.${bus}`, 1, 0, 1)]));
        this.ambience = new WorldAmbience(this);
        this.observedContext = null;
        this.onContextStateChange = () => {
            if (this.disposed) return;
            if (this.context?.state !== 'running') this.stopOneShots();
            this.ambience.update(this.ambience.key);
        };
        this.onVisibilityChange = () => {
            if (globalThis.document?.hidden) this.stopOneShots();
            this.ambience.update(this.ambience.key);
        };
        globalThis.document?.addEventListener('visibilitychange', this.onVisibilityChange);
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
        if (this.disposed) return null;
        if (!this.context) this.context = this.contextFactory?.() || null;
        if (!this.context) return null;
        if (this.observedContext !== this.context) {
            this.observedContext?.removeEventListener?.('statechange', this.onContextStateChange);
            this.observedContext = this.context;
            this.context.addEventListener?.('statechange', this.onContextStateChange);
        }
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
        if (!context || context.state === 'closed' || globalThis.document?.hidden) return false;
        this.ensureMasterGain();

        if (context.state === 'suspended' && typeof context.resume === 'function') {
            const resumeResult = context.resume();
            if (resumeResult?.catch) resumeResult.catch(() => {});
        }

        this.unlocked = true;
        return true;
    }

    getCueBus(cueName) {
        const category = this.getCueAssetMetadata(cueName)?.category;
        return category === 'ui' || category === 'loot' ? 'interface' : 'combat';
    }

    ensureBusGain(bus) {
        const master = this.ensureMasterGain();
        if (!master) return null;
        if (!this.busGains.has(bus)) {
            const gain = this.context.createGain();
            gain.gain.value = this.busVolumes[bus];
            gain.connect(master);
            this.busGains.set(bus, gain);
        }
        return this.busGains.get(bus);
    }

    getBusVolumes() {
        return { ...this.busVolumes };
    }

    setBusVolume(bus, volume) {
        if (!AUDIO_BUSES.includes(bus)) return false;
        const numeric = Number(volume);
        if (!Number.isFinite(numeric)) return false;
        this.busVolumes[bus] = Math.max(0, Math.min(1, numeric));
        this.persistSetting(`eidolon.audioBus.${bus}`, this.busVolumes[bus]);
        if (this.busGains.has(bus)) this.busGains.get(bus).gain.value = this.busVolumes[bus];
        this.syncMediaVolumes();
        if (this.busVolumes[bus] === 0) this.stopOneShots(bus);
        this.ambience.update(this.ambience.key);
        return true;
    }

    syncMediaVolumes() {
        for (const [cueName, media] of this.mediaCache) {
            if (media && 'volume' in media) media.volume = this.enabled
                ? this.volume * this.busVolumes[this.getCueBus(cueName)] : 0;
        }
    }

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        this.persistSetting('eidolon.audioEnabled', this.enabled);
        if (this.masterGain) this.masterGain.gain.value = this.enabled ? this.volume : 0;
        this.syncMediaVolumes();
        if (!this.enabled) this.stopOneShots();
        this.ambience.update(this.ambience.key);
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, Number(volume) || 0));
        this.persistSetting('eidolon.audioVolume', this.volume);
        if (this.masterGain) this.masterGain.gain.value = this.enabled ? this.volume : 0;
        this.syncMediaVolumes();
        if (this.volume === 0) this.stopOneShots();
        this.ambience.update(this.ambience.key);
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
        const lastPlayedAt = this.lastCueTimes.get(cueName) ?? -Infinity;
        const now = this.now();
        const cooldown = cueName === AUDIO_CUES.dangerWarning ? 250
            : typeof cueName === 'string' && cueName.startsWith('ability.') ? 120 : CUE_COOLDOWN_MS;
        if (now - lastPlayedAt < cooldown) return false;
        return true;
    }

    play(cueName, options = {}) {
        if (this.disposed || globalThis.document?.hidden) return false;
        const bus = this.getCueBus(cueName);
        if (options.gain === 0) return false;
        if (this.volume === 0 || this.busVolumes[bus] === 0) return false;
        if (!this.canPlay(cueName)) return false;
        if (this.playAuthoredCue(cueName)) {
            this.lastCueTimes.set(cueName, this.now());
            return true;
        }

        const context = this.ensureContext();
        const cue = this.createCue(cueName, options);
        if (!context || !cue || context.state === 'closed') return false;
        // A suspended live context must not accumulate effects for a later
        // gesture. OfflineAudioContext deliberately schedules before rendering.
        if (context.state === 'suspended' && typeof context.startRendering !== 'function') return false;
        if (!this.reserveCueTones(cueName, cue.length)) return false;
        const destination = this.ensureBusGain(bus);
        if (!destination) return false;

        const startAt = context.currentTime || 0;
        const cueId = {};
        try {
            cue.forEach((tone) => this.playTone(context, destination, startAt, tone, { ...options, bus, cueName, cueId }));
        } catch {
            this.stopTones(voice => voice.cueId === cueId);
            return false;
        }
        this.lastCueTimes.set(cueName, this.now());
        return true;
    }

    stopTones(matches = () => true) {
        for (const voice of [...this.activeTones]) {
            if (!matches(voice)) continue;
            try { voice.oscillator.stop?.(); } catch { /* Already stopped/closed. */ }
            voice.release();
        }
    }

    stopOneShots(bus = null) {
        this.stopTones(voice => !bus || voice.bus === bus);
        for (const [cueName, media] of this.mediaCache) {
            if (!bus || this.getCueBus(cueName) === bus) media?.pause?.();
        }
    }

    reserveCueTones(cueName, count) {
        const danger = cueName === AUDIO_CUES.dangerWarning;
        const limit = MAX_CUE_TONES - (danger ? 0 : RESERVED_DANGER_TONES);
        if (count > limit) return false;
        if (!danger) return this.activeTones.size + count <= limit;
        while (this.activeTones.size + count > limit) {
            // Retire complete older cues, not half an arpeggio. Warnings may
            // displace ordinary sounds; ordinary sounds cannot displace them.
            const oldest = [...this.activeTones].find(voice => voice.cueName !== AUDIO_CUES.dangerWarning)
                || this.activeTones.values().next().value;
            this.stopTones(voice => voice.cueId === oldest.cueId);
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
            if ('volume' in media) media.volume = this.volume * this.busVolumes[this.getCueBus(cueName)];
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
        const className = Object.keys(CLASS_CAST_CUES).find(key => CLASS_CAST_CUES[key] === cueName);
        const profile = className && options.skillName ? getAbilityCastProfile(className, options.skillName) : null;
        if (profile) return ABILITY_CAST_PROFILES[profile];
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
            case AUDIO_CUES.casinoSpin:
                return [160, 220, 280, 350, 440].map((frequency, index) => ({ frequency, delay: index * .06, duration: .065, type: 'triangle', gain: .035 }));
            case AUDIO_CUES.casinoWin:
                return [523, 659, 784].map((frequency, index) => ({ frequency, delay: index * .09, duration: .15, type: 'sine', gain: .045 }));
            case AUDIO_CUES.casinoBonus:
                return [392, 523, 659, 784].map((frequency, index) => ({ frequency, delay: index * .1, duration: .22, type: 'triangle', gain: .04 }));
            case AUDIO_CUES.casinoJackpot:
                return [523, 659, 784, 1046, 1318, 1568].map((frequency, index) => ({ frequency, delay: index * .11, duration: .25, type: 'sine', gain: .04 }));
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
            case AUDIO_CUES.dangerWarning:
                return [
                    { frequency: 330, endFrequency: 220, duration: .14, type: 'triangle', gain: .065 },
                    { frequency: 440, endFrequency: 294, delay: .12, duration: .16, type: 'sine', gain: .055 }
                ];
            case AUDIO_CUES.fighterCast:
                return [
                    { frequency: 190, endFrequency: 85, duration: .13, type: 'triangle', gain: .09 },
                    { frequency: 680, endFrequency: 360, delay: .025, duration: .055, type: 'sawtooth', gain: .025 }
                ];
            case AUDIO_CUES.rogueCast:
                return [
                    { frequency: 1050, endFrequency: 180, duration: .12, type: 'triangle', gain: .055 },
                    { frequency: 1450, delay: .035, duration: .04, type: 'sine', gain: .025 }
                ];
            case AUDIO_CUES.wizardCast:
                return [
                    { frequency: 280, endFrequency: 820, duration: .17, type: 'sine', gain: .075 },
                    { frequency: 560, endFrequency: 1120, delay: .04, duration: .13, type: 'triangle', gain: .035 }
                ];
            case AUDIO_CUES.clericCast:
                return [523, 659, 784].map((frequency, index) => ({
                    frequency, delay: index * .025, duration: .18, type: 'sine', gain: .04
                }));
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

    playTone(context, destination, startAt, tone, options = {}) {
        const oscillator = context.createOscillator();
        let gain = null, panner = null;
        let released = false;
        const voice = { oscillator, bus: options.bus, cueName: options.cueName, cueId: options.cueId, release: () => {
            if (released) return;
            released = true;
            oscillator.disconnect?.();
            gain?.disconnect?.();
            panner?.disconnect();
            this.activeTones.delete(voice);
        } };
        oscillator.onended = voice.release;
        this.activeTones.add(voice);
        try {
            gain = context.createGain();
            const toneStart = startAt + (tone.delay || 0);
            const toneEnd = toneStart + tone.duration;
            const peakGain = tone.gain * (Number.isFinite(options.gain) ? Math.max(0, Math.min(1, options.gain)) : 1);
            oscillator.type = tone.type;
            if (oscillator.frequency?.setValueAtTime) {
                oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
                if (tone.endFrequency > 0) oscillator.frequency.exponentialRampToValueAtTime?.(tone.endFrequency, toneEnd);
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
            if (Number.isFinite(options.pan) && options.pan !== 0 && context.createStereoPanner) {
                panner = context.createStereoPanner();
                panner.pan.value = Math.max(-1, Math.min(1, options.pan));
                gain.connect?.(panner);
                panner.connect(destination);
            } else gain.connect?.(destination);
            oscillator.start?.(toneStart);
            oscillator.stop?.(toneEnd + 0.01);
        } catch (error) {
            voice.release();
            throw error;
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        globalThis.document?.removeEventListener('visibilitychange', this.onVisibilityChange);
        this.observedContext?.removeEventListener?.('statechange', this.onContextStateChange);
        this.observedContext = null;
        this.ambience.dispose();
        if (this.masterGain) this.masterGain.gain.value = 0;
        this.stopTones();
        for (const media of this.mediaCache.values()) {
            media?.pause?.();
            if (media && 'volume' in media) media.volume = 0;
        }
        this.mediaCache.clear();
        for (const bus of this.busGains.values()) bus.disconnect?.();
        this.busGains.clear();
        this.masterGain?.disconnect?.();
        const context = this.context;
        this.context = null;
        this.masterGain = null;
        if (context?.state !== 'closed') {
            try { context?.close?.()?.catch?.(() => {}); } catch { /* Browser already released context. */ }
        }
    }
}
