import { jest } from '@jest/globals';
import { AMBIENCE_PROFILES, WorldAmbience, worldAmbienceKey } from '../src/audio/WorldAmbience.js';
import { AudioManager } from '../src/audio/AudioManager.js';

function contextFixture() {
    const nodes = [];
    const param = () => ({ value: 0, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(), cancelScheduledValues: jest.fn() });
    const node = () => {
        const value = { gain: param(), frequency: param(), Q: param(), connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn() };
        nodes.push(value); return value;
    };
    return { nodes, currentTime: 0, sampleRate: 100, state: 'running', destination: {}, close: jest.fn(),
        createGain: node, createBiquadFilter: node, createBufferSource: node, createOscillator: node,
        createBuffer: jest.fn((channels, size) => {
            const data = Array.from({ length: channels }, () => new Float32Array(size));
            return { getChannelData: channel => data[channel] };
        }) };
}

test.each([
    [0, 200, 'town'], [300, 0, 'earth'], [0, -1000, 'water'], [-2000, 0, 'fire'], [2000, 0, 'air']
])('world location %s,%s selects %s ambience', (x, z, expected) => {
    expect(worldAmbienceKey({ player: { position: { x, z } } })).toBe(expected);
});

test('instances take priority over reused world coordinates and logged-out games are silent', () => {
    const engine = { player: { position: { x: 0, z: 200 } }, currentInstanceId: 'lanternhold-casino' };
    expect(worldAmbienceKey(engine)).toBe('casino');
    engine.casino = { floor: 'vip' }; expect(worldAmbienceKey(engine)).toBe('casino_vip');
    engine.currentInstanceId = 'raid-id'; expect(worldAmbienceKey(engine)).toBe('dungeon');
    engine.currentInstanceType = 'dark_realm'; expect(worldAmbienceKey(engine)).toBe('dark');
    engine.isDestroyed = true; expect(worldAmbienceKey(engine)).toBeNull();
    expect(worldAmbienceKey({})).toBeNull();
    expect(new Set(Object.values(AMBIENCE_PROFILES).map(profile => JSON.stringify(profile))).size).toBe(9);
});

test('sound beds wait for activation, crossfade with bounded ownership, reuse noise and dispose', () => {
    const context = contextFixture();
    const audio = { context, enabled: true, volume: .5, busVolumes: { ambience: 1 }, ensureBusGain: () => ({}) };
    const ambience = new WorldAmbience(audio);
    const visible = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    try {
        ambience.update('earth'); expect(context.nodes).toHaveLength(0);
        audio.unlocked = true;
        ambience.update('earth'); expect(context.nodes).toHaveLength(10);
        ambience.update('earth'); expect(context.nodes).toHaveLength(10);
        ambience.update('water'); ambience.update('fire');
        expect(context.nodes.filter(node => !node.disconnect.mock.calls.length)).toHaveLength(20);
        expect(context.createBuffer).toHaveBeenCalledTimes(1);
        expect(ambience.activeKey).toBe('fire');
        visible.mockReturnValue(true); ambience.update('fire');
        expect(context.nodes.every(node => node.disconnect.mock.calls.length === 1)).toBe(true);
        expect(ambience.activeKey).toBeNull();
        visible.mockReturnValue(false); ambience.update('air'); expect(ambience.activeKey).toBe('air');
        audio.busVolumes.ambience = 0; ambience.update('air'); expect(ambience.activeKey).toBeNull();
        ambience.dispose(); ambience.dispose(); expect(ambience.buffer).toBeNull();
        expect(context.nodes.every(node => node.disconnect.mock.calls.length === 1)).toBe(true);
    } finally { visible.mockRestore(); ambience.dispose(); }
});

test('manager mute, hidden tab and teardown release ambient graphs without changing saved preferences', () => {
    const context = contextFixture();
    const visible = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const audio = new AudioManager({ context, storage: { getItem: () => null, setItem: jest.fn() } });
    try {
        audio.unlock(); audio.ambience.update('town'); expect(audio.ambience.activeKey).toBe('town');
        audio.setEnabled(false); expect(audio.ambience.activeKey).toBeNull();
        audio.setEnabled(true); expect(audio.ambience.activeKey).toBe('town');
        visible.mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange'));
        expect(audio.ambience.activeKey).toBeNull();
        visible.mockReturnValue(false); document.dispatchEvent(new Event('visibilitychange'));
        expect(audio.ambience.activeKey).toBe('town');
        audio.dispose(); document.dispatchEvent(new Event('visibilitychange'));
        expect(audio.ambience.activeKey).toBeNull();
        expect(audio.ambience.buffer).toBeNull(); expect(context.close).toHaveBeenCalledTimes(1);
    } finally { audio.dispose(); visible.mockRestore(); }
});
