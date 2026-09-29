import { getOverworldRegion } from '../data/worldGeography.js';

// Original synthesized sound beds; no downloaded recordings or sample rights.
// Noise stays quiet underneath the more distinct transient combat warnings.
export const AMBIENCE_PROFILES = Object.freeze({
    town: { cutoff: 430, noise: .018, notes: [130.81, 196], swell: .08 },
    earth: { cutoff: 680, noise: .032, notes: [65.41, 98], swell: .13 },
    water: { cutoff: 1700, noise: .035, notes: [146.83, 220], swell: .18 },
    fire: { cutoff: 210, noise: .07, notes: [49, 73.42], swell: .31 },
    air: { cutoff: 2900, noise: .022, notes: [196, 293.66], swell: .11 },
    dark: { cutoff: 280, noise: .04, notes: [55, 58.27], swell: .07 },
    dungeon: { cutoff: 350, noise: .026, notes: [73.42, 110], swell: .09 },
    casino: { cutoff: 850, noise: .012, notes: [174.61, 261.63], swell: .15 },
    casino_vip: { cutoff: 560, noise: .009, notes: [220, 329.63], swell: .1 }
});

export function worldAmbienceKey(engine) {
    if (!engine.player || engine.isDestroyed) return null;
    if (engine.currentInstanceId === 'lanternhold-casino') return engine.casino?.floor === 'vip' ? 'casino_vip' : 'casino';
    if (engine.currentInstanceType === 'dark_realm' || engine.currentInstanceType === 'umbral_nexus') return 'dark';
    if (engine.currentInstanceId) return 'dungeon';
    return getOverworldRegion(engine.player.position?.x, engine.player.position?.z);
}

export function createAmbienceNoise(context) {
    const buffer = context.createBuffer(2, context.sampleRate * 4, context.sampleRate);
    let seed = 144;
    for (let channel = 0; channel < 2; channel++) {
        const samples = buffer.getChannelData(channel);
        for (let i = 0; i < samples.length; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            samples[i] = (seed / 4294967296) * 2 - 1;
        }
    }
    return buffer;
}

export function createAmbienceLayer(context, destination, buffer, profile) {
    const nodes = [], sources = [];
    const keep = node => { nodes.push(node); return node; };
    const gain = keep(context.createGain());
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(1, context.currentTime + .8);
    gain.connect(destination);
    const filter = keep(context.createBiquadFilter());
    filter.type = 'lowpass'; filter.frequency.value = profile.cutoff; filter.Q.value = .5;
    const noiseGain = keep(context.createGain()); noiseGain.gain.value = profile.noise;
    filter.connect(noiseGain); noiseGain.connect(gain);
    const noise = keep(context.createBufferSource());
    noise.buffer = buffer; noise.loop = true; noise.connect(filter); sources.push(noise);
    const swell = keep(context.createOscillator()), swellGain = keep(context.createGain());
    swell.frequency.value = profile.swell; swellGain.gain.value = profile.noise * .22;
    swell.connect(swellGain); swellGain.connect(noiseGain.gain); sources.push(swell);
    for (const frequency of profile.notes) {
        const tone = keep(context.createOscillator()), level = keep(context.createGain());
        tone.type = 'sine'; tone.frequency.value = frequency; level.gain.value = .0025;
        tone.connect(level); level.connect(gain); sources.push(tone);
    }
    let disposed = false;
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        sources.forEach(source => { try { source.stop(); } catch { /* Already stopped. */ } });
        nodes.forEach(node => node.disconnect());
    };
    noise.onended = dispose;
    sources.forEach(source => source.start());
    return {
        dispose,
        fadeOut() {
            if (disposed) return;
            const now = context.currentTime;
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.linearRampToValueAtTime(0, now + .8);
            sources.forEach(source => source.stop(now + .81));
        }
    };
}

export class WorldAmbience {
    constructor(audio) {
        this.audio = audio; this.key = null; this.activeKey = null;
        this.active = null; this.fading = null; this.buffer = null;
    }

    update(key) {
        this.key = Object.hasOwn(AMBIENCE_PROFILES, key) ? key : null;
        const audio = this.audio, context = audio.context;
        const audible = !audio.disposed && audio.unlocked && audio.enabled && audio.volume > 0
            && audio.busVolumes.ambience > 0 && context?.state === 'running' && !globalThis.document?.hidden;
        const next = audible ? this.key : null;
        if (!next) { this.stop(); return; }
        if (next === this.activeKey) return;
        // Only one fading and one active layer, even during rapid zone changes.
        this.fading?.dispose(); this.fading = this.active;
        this.fading?.fadeOut();
        this.buffer ||= createAmbienceNoise(context);
        this.active = createAmbienceLayer(context, audio.ensureBusGain('ambience'), this.buffer, AMBIENCE_PROFILES[next]);
        this.activeKey = next;
    }

    stop() {
        this.active?.dispose(); this.fading?.dispose();
        this.active = null; this.fading = null; this.activeKey = null;
    }

    dispose() { this.stop(); this.buffer = null; this.key = null; }
}
