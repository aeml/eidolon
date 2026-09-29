import { jest } from '@jest/globals';
import { AudioManager, AUDIO_CUES, AUDIO_CUE_ASSETS } from '../src/audio/AudioManager.js';

function createMockContext() {
    const destination = { id: 'destination' };
    const createdOscillators = [];
    const createdGains = [];

    const context = {
        currentTime: 2,
        destination,
        state: 'running',
        resume: jest.fn(() => Promise.resolve()),
        createGain: jest.fn(() => {
            const gain = {
                connect: jest.fn(),
                disconnect: jest.fn(),
                gain: {
                    value: 1,
                    setValueAtTime: jest.fn(),
                    exponentialRampToValueAtTime: jest.fn(),
                },
            };
            createdGains.push(gain);
            return gain;
        }),
        createOscillator: jest.fn(() => {
            const oscillator = {
                type: '',
                frequency: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
                connect: jest.fn(),
                disconnect: jest.fn(),
                start: jest.fn(),
                stop: jest.fn(),
            };
            createdOscillators.push(oscillator);
            return oscillator;
        }),
        createdOscillators,
        createdGains,
    };

    return context;
}

describe('AudioManager', () => {
    test('disposing a session stops pending tones/media, closes context and cannot restart from stale UI callbacks', () => {
        const context = createMockContext();
        context.close = jest.fn(() => Promise.resolve());
        const media = { volume: 1, play: jest.fn(), pause: jest.fn() };
        const audio = new AudioManager({ context, mediaFactory: () => media, now: () => 1000 });
        audio.play(AUDIO_CUES.wizardCast);
        audio.play(AUDIO_CUES.uiClick);
        expect(audio.activeTones.size).toBe(2);
        audio.dispose(); audio.dispose();
        expect(audio.activeTones.size).toBe(0);
        expect(media.pause).toHaveBeenCalledTimes(1);
        expect(media.volume).toBe(0);
        expect(context.close).toHaveBeenCalledTimes(1);
        context.createdOscillators.forEach(oscillator => {
            expect(oscillator.stop).toHaveBeenCalledTimes(2);
            oscillator.onended();
            expect(oscillator.disconnect).toHaveBeenCalledTimes(1);
        });
        expect(audio.play(AUDIO_CUES.clericCast)).toBe(false);
        expect(audio.unlock()).toBe(false);
        expect(audio.getSettings().enabled).toBe(true);
    });

    test('danger tones pan, attenuate, clean up and survive reduced detail without rapid repeats', () => {
        const context = createMockContext();
        const panners = [];
        context.createStereoPanner = () => {
            const node = { pan: { value: 0 }, connect: jest.fn(), disconnect: jest.fn() };
            panners.push(node); return node;
        };
        let now = 1000;
        const audio = new AudioManager({ context, now: () => now });
        audio.setDetailLevel('reduced');
        expect(audio.play(AUDIO_CUES.dangerWarning, { pan: -.8, gain: .5 })).toBe(true);
        expect(panners).toHaveLength(2);
        expect(panners[0].pan.value).toBe(-.8);
        expect(context.createdGains[2].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(.0325, 2.008);
        expect(panners[0].connect).toHaveBeenCalledWith(audio.busGains.get('combat'));
        context.createdOscillators.forEach(oscillator => oscillator.onended());
        panners.forEach(panner => expect(panner.disconnect).toHaveBeenCalledTimes(1));
        now += 100; expect(audio.play(AUDIO_CUES.dangerWarning)).toBe(false);
        now += 200; expect(audio.play(AUDIO_CUES.dangerWarning)).toBe(true);
        audio.setEnabled(false);
        expect(audio.play(AUDIO_CUES.dangerWarning)).toBe(false);
    });

    test('positional cues retain mono feedback if stereo panning is unavailable', () => {
        const context = createMockContext();
        const audio = new AudioManager({ context, now: () => 1000 });
        expect(audio.play(AUDIO_CUES.dangerWarning, { pan: .8 })).toBe(true);
        expect(context.createdGains[2].connect).toHaveBeenCalledWith(audio.busGains.get('combat'));
    });

    test('independent buses persist and route generated cues through master volume', () => {
        const context = createMockContext();
        const audio = new AudioManager({ context, now: () => 1000 });
        audio.setBusVolume('interface', .2);
        audio.setBusVolume('combat', .7);
        expect(audio.play(AUDIO_CUES.uiClick)).toBe(true);
        expect(audio.play(AUDIO_CUES.wizardCast)).toBe(true);
        expect(audio.busGains.get('interface').gain.value).toBe(.2);
        expect(audio.busGains.get('combat').gain.value).toBe(.7);
        for (const bus of audio.busGains.values()) expect(bus.connect).toHaveBeenCalledWith(audio.masterGain);
        expect(audio.masterGain.gain.value).toBe(.45);
        expect(context.createdGains[2].connect).toHaveBeenCalledWith(audio.busGains.get('interface'));
        expect(context.createdGains[4].connect).toHaveBeenCalledWith(audio.busGains.get('combat'));
        expect(new AudioManager().getBusVolumes()).toEqual({ combat: .7, interface: .2, ambience: 1 });
        audio.setBusVolume('combat', 0);
        expect(audio.busGains.get('combat').gain.value).toBe(0);
        expect(audio.play(AUDIO_CUES.combatHit)).toBe(false);
        expect(audio.play(AUDIO_CUES.lootPickup)).toBe(true);
        audio.setVolume(0);
        expect(audio.play(AUDIO_CUES.casinoWin)).toBe(false);
        expect(audio.getBusVolumes()).toEqual({ combat: 0, interface: .2, ambience: 1 });
    });

    test('authored media already playing follows bus, master and mute changes', () => {
        const media = { volume: 1, play: jest.fn() };
        const audio = new AudioManager({ mediaFactory: () => media, now: () => 1000 });
        expect(audio.play(AUDIO_CUES.uiClick)).toBe(true);
        audio.setBusVolume('interface', .5);
        expect(media.volume).toBeCloseTo(.225);
        audio.setVolume(.8);
        expect(media.volume).toBeCloseTo(.4);
        audio.setEnabled(false);
        expect(media.volume).toBe(0);
        audio.setEnabled(true);
        expect(media.volume).toBeCloseTo(.4);
        audio.setBusVolume('combat', 0);
        expect(media.volume).toBeCloseTo(.4);
    });

    test('bus settings clamp valid values and survive blocked storage without invalid gains', () => {
        const audio = new AudioManager({ storage: {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); }
        } });
        expect(audio.getBusVolumes()).toEqual({ combat: 1, interface: 1, ambience: 1 });
        expect(audio.setBusVolume('combat', Infinity)).toBe(false);
        expect(audio.setBusVolume('other', .5)).toBe(false);
        audio.setBusVolume('combat', -1);
        audio.setBusVolume('interface', 8);
        expect(audio.getBusVolumes()).toEqual({ combat: 0, interface: 1, ambience: 1 });
    });

    test('finished generated tones release oscillator and envelope connections', () => {
        const context = createMockContext();
        const audio = new AudioManager({ context, now: () => 1000 });
        audio.play(AUDIO_CUES.uiClick);
        context.createdOscillators[0].onended();
        expect(context.createdOscillators[0].disconnect).toHaveBeenCalledTimes(1);
        expect(context.createdGains[2].disconnect).toHaveBeenCalledTimes(1);
        expect(audio.masterGain.disconnect).not.toHaveBeenCalled();
        expect(audio.busGains.get('interface').disconnect).not.toHaveBeenCalled();
    });

    test('class cast sounds have distinct envelopes, no missing asset requests, and bounded repeats', () => {
        let now = 1000;
        const context = createMockContext();
        const mediaFactory = jest.fn();
        const audio = new AudioManager({ context, now: () => now, mediaFactory });
        const cues = [AUDIO_CUES.fighterCast, AUDIO_CUES.rogueCast, AUDIO_CUES.wizardCast, AUDIO_CUES.clericCast];
        expect(new Set(cues.map(cue => JSON.stringify(audio.createCue(cue)))).size).toBe(4);
        expect(audio.play(AUDIO_CUES.wizardCast)).toBe(true);
        expect(context.createdOscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(820, 2.17);
        expect(mediaFactory).not.toHaveBeenCalled();
        now += 80; expect(audio.play(AUDIO_CUES.wizardCast)).toBe(false);
        now += 50; expect(audio.play(AUDIO_CUES.wizardCast)).toBe(true);
        audio.setEnabled(false);
        expect(audio.play(AUDIO_CUES.clericCast)).toBe(false);
    });
    beforeEach(() => {
        localStorage.clear();
    });

    test('defaults to enabled generated cue playback with persisted-safe settings', () => {
        const context = createMockContext();
        const audio = new AudioManager({ contextFactory: () => context, now: () => 1000 });

        expect(audio.getSettings()).toEqual({ enabled: true, volume: 0.45, detailLevel: 'full' });
        expect(audio.play(AUDIO_CUES.uiClick)).toBe(true);

        expect(context.createGain).toHaveBeenCalled();
        expect(context.createOscillator).toHaveBeenCalledTimes(1);
        expect(context.createdOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(620, 2);
    });

    test('persists enable and volume settings and applies them to master gain', () => {
        const context = createMockContext();
        const audio = new AudioManager({ contextFactory: () => context, now: () => 1000 });

        audio.unlock();
        audio.setVolume(0.8);
        audio.setEnabled(false);

        expect(localStorage.getItem('eidolon.audioVolume')).toBe('0.8');
        expect(localStorage.getItem('eidolon.audioEnabled')).toBe('false');
        expect(audio.getSettings()).toEqual({ enabled: false, volume: 0.8, detailLevel: 'full' });
        expect(context.createdGains[0].gain.value).toBe(0);

        audio.setEnabled(true);
        expect(context.createdGains[0].gain.value).toBe(0.8);
    });

    test('respects cue cooldowns to avoid noisy rapid repeats', () => {
        let now = 1000;
        const context = createMockContext();
        const audio = new AudioManager({ contextFactory: () => context, now: () => now });

        expect(audio.play(AUDIO_CUES.lootPickup)).toBe(true);
        now += 20;
        expect(audio.play(AUDIO_CUES.lootPickup)).toBe(false);
        now += 50;
        expect(audio.play(AUDIO_CUES.lootPickup)).toBe(true);
    });

    test('unlocks suspended browser audio context safely after user gesture', () => {
        const context = createMockContext();
        context.state = 'suspended';
        const audio = new AudioManager({ contextFactory: () => context });

        expect(audio.unlock()).toBe(true);
        expect(context.resume).toHaveBeenCalled();
        expect(audio.unlocked).toBe(true);
    });

    test('exposes generated jump start and landing cues', () => {
        const audio = new AudioManager({ contextFactory: () => createMockContext() });

        expect(audio.createCue(AUDIO_CUES.jumpStart)).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'triangle' }),
        ]));
        expect(audio.createCue(AUDIO_CUES.jumpLand, { impact: 1 })).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'square' }),
            expect.objectContaining({ type: 'sine' }),
        ]));
    });

    test('exposes a distinct blocked-loot cue for failed pickup feedback', () => {
        const audio = new AudioManager({ contextFactory: () => createMockContext() });

        expect(audio.createCue(AUDIO_CUES.lootBlocked)).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'triangle', frequency: 260 }),
            expect.objectContaining({ type: 'triangle', frequency: 180 }),
        ]));
    });

    test('reduced detail level suppresses routine UI cues while preserving gameplay cues', () => {
        let now = 1000;
        const context = createMockContext();
        const audio = new AudioManager({ contextFactory: () => context, now: () => now });

        audio.setDetailLevel('reduced');
        expect(localStorage.getItem('eidolon.audioDetailLevel')).toBe('reduced');
        expect(audio.getSettings().detailLevel).toBe('reduced');
        expect(audio.play(AUDIO_CUES.uiClick)).toBe(false);

        now += 50;
        expect(audio.play(AUDIO_CUES.combatHit)).toBe(true);
        expect(context.createOscillator).toHaveBeenCalled();
    });

    test('normalizes invalid detail levels back to full cues', () => {
        localStorage.setItem('eidolon.audioDetailLevel', 'verbose');

        const audio = new AudioManager({ contextFactory: () => createMockContext() });

        expect(audio.getSettings().detailLevel).toBe('full');
        audio.setDetailLevel('reduced');
        audio.setDetailLevel('invalid');
        expect(audio.getSettings().detailLevel).toBe('full');
    });

    test('exposes replacement-ready asset metadata for every generated cue', () => {
        const audio = new AudioManager({ contextFactory: () => createMockContext() });

        expect(Object.keys(AUDIO_CUE_ASSETS).sort()).toEqual(Object.values(AUDIO_CUES).sort());
        expect(audio.getCueAssetMetadata(AUDIO_CUES.lootPickup)).toEqual({
            category: 'loot',
            fallback: 'generated',
            sources: [
                { src: 'assets/audio/cues/loot-pickup.ogg', type: 'audio/ogg' },
                { src: 'assets/audio/cues/loot-pickup.mp3', type: 'audio/mpeg' },
            ],
        });
        expect(audio.getCueAssetMetadata(AUDIO_CUES.jumpLand).category).toBe('movement');
    });

    test('plays authored cue media through the same cue route when a factory is provided', () => {
        const context = createMockContext();
        const media = {
            currentTime: 10,
            volume: 1,
            preload: '',
            play: jest.fn(() => Promise.resolve()),
        };
        const mediaFactory = jest.fn(() => media);
        const audio = new AudioManager({ contextFactory: () => context, mediaFactory, now: () => 1000 });

        expect(audio.play(AUDIO_CUES.uiClick)).toBe(true);

        expect(mediaFactory).toHaveBeenCalledWith(
            { src: 'assets/audio/cues/ui-click.ogg', type: 'audio/ogg' },
            AUDIO_CUES.uiClick,
            AUDIO_CUE_ASSETS[AUDIO_CUES.uiClick],
        );
        expect(media.preload).toBe('auto');
        expect(media.currentTime).toBe(0);
        expect(media.volume).toBe(0.45);
        expect(media.play).toHaveBeenCalledTimes(1);
        expect(context.createOscillator).not.toHaveBeenCalled();
    });

    test('falls back to generated cues when authored media cannot be created', () => {
        const context = createMockContext();
        const audio = new AudioManager({
            contextFactory: () => context,
            mediaFactory: () => {
                throw new Error('missing audio asset');
            },
            now: () => 1000,
        });

        expect(audio.play(AUDIO_CUES.combatMiss)).toBe(true);
        expect(context.createOscillator).toHaveBeenCalledTimes(1);
    });
});
