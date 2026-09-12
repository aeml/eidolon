import { jest } from '@jest/globals';
jest.unstable_mockModule('@playwright/test', () => ({ expect }));
const { moveByPhoneJoystick } = await import('./e2e/phone-joystick-movement.js');

function fixture({ progress = 3, delayedStart = false, observeError = false, releaseError = false } = {}) {
    let acknowledgeStart;
    let active = false, failedRelease = false;
    const events = [];
    const cdp = { detach: jest.fn(), send: jest.fn(async (_method, event) => {
        events.push(event.type);
        if (event.type === 'touchStart') active = true;
        if (event.type === 'touchEnd') {
            if (!active) throw new Error('Must send a TouchStart first to start a new touch');
            if (releaseError && !failedRelease) {
                failedRelease = true;
                throw new Error('release unavailable');
            }
            active = false;
        }
        if (event.type === 'touchStart' && delayedStart) await new Promise(resolve => { acknowledgeStart = resolve; });
        if (event.type === 'touchEnd') acknowledgeStart?.();
    }) };
    const page = { locator: () => ({ boundingBox: async () => ({ x: 0, y: 0, width: 100, height: 100 }) }),
        context: () => ({ newCDPSession: async () => cdp }), isClosed: () => false,
        evaluate: jest.fn(async (_callback, args) => {
            if (!args) return { x: 0, z: 0, hp: 100, instance: null, mobile: true };
            if (observeError) throw new Error('observation unavailable');
            return { x: progress, z: 0, hp: 100, state: 'IDLE', instance: null, progress, joystick: 0, blocked: null };
        }) };
    return { page, cdp, events };
}

test('release is sent before waiting for a delayed start receipt, then actual progress is checked', async () => {
    const { page, cdp, events } = fixture({ delayedStart: true });
    const result = await moveByPhoneJoystick(page, 3, 0);
    expect(events).toEqual(['touchStart', 'touchEnd']);
    expect(result.samples).toHaveLength(1);
    expect(cdp.detach).toHaveBeenCalledTimes(1);
});

test('an observation failure still releases touch and detaches the protocol session', async () => {
    const { page, cdp, events } = fixture({ observeError: true });
    await expect(moveByPhoneJoystick(page, 3, 0)).rejects.toThrow('observation unavailable');
    expect(events.at(-1)).toBe('touchEnd'); expect(cdp.detach).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['touchStart', 'touchEnd']);
});

test('a failed release attempts cleanup once and preserves the input failure', async () => {
    const { page, cdp, events } = fixture({ releaseError: true });
    await expect(moveByPhoneJoystick(page, 3, 0)).rejects.toThrow('release unavailable');
    expect(events).toEqual(['touchStart', 'touchEnd', 'touchEnd']);
    expect(cdp.detach).toHaveBeenCalledTimes(1);
});

test('blocked movement has eight bounded pulses and retains actual endpoint diagnostics', async () => {
    const { page, cdp, events } = fixture({ progress: 0 });
    await expect(moveByPhoneJoystick(page, 3, 0)).rejects.toThrow('"progress":0');
    expect(events.filter(event => event === 'touchStart')).toHaveLength(8);
    expect(events.filter(event => event === 'touchEnd')).toHaveLength(8);
    expect(cdp.detach).toHaveBeenCalledTimes(1);
});
