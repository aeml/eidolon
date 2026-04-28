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
                frequency: { setValueAtTime: jest.fn() },
                connect: jest.fn(),
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
