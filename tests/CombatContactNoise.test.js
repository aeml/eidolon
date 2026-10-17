import { jest } from '@jest/globals';
import { AudioManager, AUDIO_CUES, MAX_CUE_TONES } from '../src/audio/AudioManager.js';

function contextFixture() {
    const nodes = [];
    const param = () => ({ value: 0, setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn(),
        linearRampToValueAtTime: jest.fn(), cancelScheduledValues: jest.fn() });
    const node = (properties = {}) => {
        const value = { connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn(), ...properties };
        nodes.push(value); return value;
    };
    return {
        nodes, state: 'running', currentTime: 2, sampleRate: 48000, destination: {},
        createGain: jest.fn(() => node({ gain: param() })),
        createOscillator: jest.fn(() => node({ frequency: param() })),
        createBufferSource: jest.fn(() => node()),
        createBiquadFilter: jest.fn(() => node({ frequency: param(), Q: param() })),
        createBuffer: jest.fn((channels, length, rate) => {
            const data = new Float32Array(length);
            return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: () => data };
        })
    };
}

test('contact noise is lazy, deterministic and shared only within its AudioManager', () => {
    const context = contextFixture(), other = contextFixture();
    let now = 1000;
    const audio = new AudioManager({ context, now: () => now, storage: { getItem: () => null } });
    const second = new AudioManager({ context: other, storage: { getItem: () => null } });
    try {
        audio.play(AUDIO_CUES.combatHit, { kind: 'holy' });
        expect(context.createBuffer).not.toHaveBeenCalled();
        now += 100;
        expect(audio.play(AUDIO_CUES.combatHit, { kind: 'physical' })).toBe(true);
        expect(context.createBuffer).toHaveBeenCalledWith(1, 7680, 48000);
        const first = context.createBufferSource.mock.results[0].value.buffer;
        now += 100; audio.play(AUDIO_CUES.combatHit, { kind: 'fire' });
        expect(context.createBuffer).toHaveBeenCalledTimes(1);
        expect(context.createBufferSource.mock.results[1].value.buffer).toBe(first);
        second.play(AUDIO_CUES.combatHit, { kind: 'physical' });
        const separate = other.createBufferSource.mock.results[0].value.buffer;
        expect(separate).not.toBe(first);
        expect(separate.getChannelData(0)).toEqual(first.getChannelData(0));
        expect(first.getChannelData(0).every(value => Number.isFinite(value) && Math.abs(value) <= 1)).toBe(true);
    } finally { audio.dispose(); second.dispose(); }
    expect(audio.contactNoiseBuffer).toBeNull();
});

test('filtered contacts retain source, filter and gain ownership through mute and late ended events', () => {
    const context = contextFixture();
    const audio = new AudioManager({ context, storage: { getItem: () => null } });
    try {
        expect(audio.play(AUDIO_CUES.combatHit, { kind: 'physical' })).toBe(true);
        expect(audio.activeTones.size).toBe(2);
        const source = context.createBufferSource.mock.results[0].value;
        const filter = context.createBiquadFilter.mock.results[0].value;
        const gain = source.connect.mock.calls[0][0].connect.mock.calls[0][0];
        expect(source.connect).toHaveBeenCalledWith(filter);
        expect(source.start).toHaveBeenCalledWith(2.012);
        expect(source.stop).toHaveBeenCalledWith(2.097);
        expect(filter.type).toBe('bandpass');
        expect(filter.frequency.setValueAtTime).toHaveBeenCalledWith(1800, 2.012);
        audio.setBusVolume('combat', 0);
        expect(audio.activeTones.size).toBe(0);
        source.onended();
        for (const value of [source, filter, gain]) expect(value.disconnect).toHaveBeenCalledTimes(1);
    } finally { audio.dispose(); }
});

test.each(['filter', 'start'])('a %s failure releases the complete contact cue', failure => {
    const context = contextFixture();
    if (failure === 'filter') context.createBiquadFilter.mockImplementation(() => { throw new Error('closed'); });
    else context.createBufferSource.mockImplementation(() => {
        const source = { connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(() => { throw new Error('closed'); }), stop: jest.fn() };
        context.nodes.push(source); return source;
    });
    const audio = new AudioManager({ context, storage: { getItem: () => null } });
    try {
        expect(audio.play(AUDIO_CUES.combatHit, { kind: 'physical' })).toBe(false);
        expect(audio.activeTones.size).toBe(0);
        for (const value of [...context.createOscillator.mock.results, ...context.createBufferSource.mock.results]) {
            if (value.type === 'return') expect(value.value.disconnect).toHaveBeenCalledTimes(1);
        }
        expect(audio.lastCueTimes.has(AUDIO_CUES.combatHit)).toBe(false);
    } finally { audio.dispose(); }
});

test('crowded noise contacts use the existing budget and yield complete cues to danger', () => {
    const context = contextFixture(); let now = 1000;
    const audio = new AudioManager({ context, now: () => now, storage: { getItem: () => null } });
    try {
        for (let i = 0; i < 11; i++) {
            expect(audio.play(AUDIO_CUES.combatHit, { kind: 'physical' })).toBe(true); now += 100;
        }
        expect(audio.activeTones.size).toBe(MAX_CUE_TONES - 2);
        expect(audio.play(AUDIO_CUES.combatHit, { kind: 'fire' })).toBe(false);
        expect(context.createBufferSource).toHaveBeenCalledTimes(11);
        expect(audio.play(AUDIO_CUES.dangerWarning)).toBe(true); now += 300;
        expect(audio.play(AUDIO_CUES.dangerWarning)).toBe(true);
        expect(audio.activeTones.size).toBe(MAX_CUE_TONES);
        expect(context.createBufferSource.mock.results[0].value.disconnect).toHaveBeenCalledTimes(1);
        expect(context.createBiquadFilter.mock.results[0].value.disconnect).toHaveBeenCalledTimes(1);
    } finally { audio.dispose(); }
});
