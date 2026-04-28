import { jest } from '@jest/globals';
import { AudioManager, AUDIO_CUES } from '../src/audio/AudioManager.js';

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

        expect(audio.getSettings()).toEqual({ enabled: true, volume: 0.45 });
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
        expect(audio.getSettings()).toEqual({ enabled: false, volume: 0.8 });
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
});
