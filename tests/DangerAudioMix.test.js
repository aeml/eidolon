import { jest } from '@jest/globals';
import { AudioManager, AUDIO_CUES } from '../src/audio/AudioManager.js';

function fixture() {
    const param = () => ({ value: 1, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(), cancelScheduledValues: jest.fn() });
    const node = () => ({ gain: param(), frequency: param(), connect: jest.fn(), disconnect: jest.fn(),
        start: jest.fn(), stop: jest.fn() });
    const context = { state: 'running', currentTime: 2, destination: {},
        createGain: jest.fn(node), createOscillator: jest.fn(node) };
    let now = 1000;
    const storage = { getItem: () => null, setItem: jest.fn() };
    const audio = new AudioManager({ context, storage, now: () => now });
    return { context, audio, storage, advance: seconds => { context.currentTime += seconds; now += seconds * 1000; } };
}

test('warnings bypass competing combat attenuation while user buses and interface stay independent', () => {
    const { audio, context, storage } = fixture();
    try {
        audio.setBusVolume('combat', .7); audio.setBusVolume('ambience', .8);
        expect(audio.play(AUDIO_CUES.wizardCast)).toBe(true);
        const ordinary = context.createOscillator.mock.results[0].value.connect.mock.calls[0][0];
        const mix = ordinary.connect.mock.calls[0][0];
        expect(mix).not.toBe(audio.busGains.get('combat'));
        expect(mix.connect).toHaveBeenCalledWith(audio.busGains.get('combat'));
        const ambience = audio.dangerMix.destination('ambience');
        expect(audio.play(AUDIO_CUES.dangerWarning)).toBe(true);
        const warning = context.createOscillator.mock.results[2].value.connect.mock.calls[0][0];
        expect(warning.connect).toHaveBeenCalledWith(audio.busGains.get('combat'));
        expect(mix.gain.linearRampToValueAtTime).toHaveBeenCalledWith(.35, 2.012);
        expect(ambience.gain.linearRampToValueAtTime).toHaveBeenCalledWith(.55, 2.012);
        expect(mix.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(1, 2.43);
        expect(audio.getBusVolumes()).toEqual({ combat: .7, interface: 1, ambience: .8 });
        expect(storage.setItem).toHaveBeenCalledTimes(2);
        expect(audio.play(AUDIO_CUES.uiClick)).toBe(true);
        const ui = context.createOscillator.mock.results[4].value.connect.mock.calls[0][0];
        expect(ui.connect).toHaveBeenCalledWith(audio.busGains.get('interface'));
    } finally { audio.dispose(); }
});

test('overlapping accepted warnings extend a continuous envelope without premature recovery', () => {
    const { audio, advance } = fixture();
    try {
        audio.play(AUDIO_CUES.wizardCast);
        const mix = audio.dangerMix.destination('combat');
        audio.play(AUDIO_CUES.dangerWarning);
        advance(.3);
        expect(audio.play(AUDIO_CUES.dangerWarning)).toBe(true);
        const held = 1 - .65 * (1 - (.3 - .29) / .14);
        expect(mix.gain.setValueAtTime).toHaveBeenLastCalledWith(expect.closeTo(held, 8), 2.3);
        expect(mix.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(1, expect.closeTo(2.73, 8));
        advance(.5);
        const ambience = audio.dangerMix.destination('ambience');
        expect(ambience.gain.setValueAtTime).toHaveBeenLastCalledWith(1, 2.8);
    } finally { audio.dispose(); }
});

test('a background bus first opened during recovery joins the remaining envelope', () => {
    const { audio, advance } = fixture();
    try {
        audio.play(AUDIO_CUES.dangerWarning); advance(.36);
        const ambience = audio.dangerMix.destination('ambience');
        expect(ambience.gain.setValueAtTime).toHaveBeenLastCalledWith(expect.closeTo(.775, 8), 2.36);
        expect(ambience.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(1, 2.43);
        expect(ambience.gain.linearRampToValueAtTime.mock.calls.every(([, time]) => time >= 2.36)).toBe(true);
    } finally { audio.dispose(); }
});

test('suppressed and partially failed warnings never change the background mix', () => {
    const { audio, context } = fixture();
    try {
        audio.play(AUDIO_CUES.wizardCast);
        const mix = audio.dangerMix.destination('combat');
        const scheduled = mix.gain.linearRampToValueAtTime.mock.calls.length;
        expect(audio.play(AUDIO_CUES.dangerWarning, { gain: 0 })).toBe(false);
        context.createOscillator.mockImplementationOnce(() => { throw new Error('context lost'); });
        expect(audio.play(AUDIO_CUES.dangerWarning)).toBe(false);
        expect(mix.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(scheduled);
        expect(audio.lastCueTimes.has(AUDIO_CUES.dangerWarning)).toBe(false);
        expect(audio.play(AUDIO_CUES.dangerWarning)).toBe(true);
        const accepted = mix.gain.linearRampToValueAtTime.mock.calls.length;
        expect(audio.play(AUDIO_CUES.dangerWarning)).toBe(false);
        expect(mix.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(accepted);
    } finally { audio.dispose(); }
});

test.each(['mute', 'suspend'])('%s cancels pending attenuation without changing stored preferences or replaying warnings', cause => {
    const { audio, context, advance } = fixture();
    try {
        audio.unlock(); audio.play(AUDIO_CUES.wizardCast); audio.play(AUDIO_CUES.dangerWarning);
        const mix = audio.dangerMix.destination('combat');
        advance(.1);
        if (cause === 'mute') audio.setBusVolume('combat', 0);
        else { context.state = 'suspended'; audio.onContextStateChange(); }
        expect(mix.gain.setValueAtTime).toHaveBeenLastCalledWith(1, 2.1);
        expect(audio.activeTones.size).toBe(0);
        if (cause === 'mute') audio.setBusVolume('combat', .6);
        else { context.state = 'running'; audio.onContextStateChange(); }
        expect(audio.activeTones.size).toBe(0);
        const node = audio.dangerMix.destination('ambience');
        audio.dispose(); audio.dispose();
        expect(mix.disconnect).toHaveBeenCalledTimes(1);
        expect(node.disconnect).toHaveBeenCalledTimes(1);
    } finally { audio.dispose(); }
});
