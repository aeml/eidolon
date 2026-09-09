import { jest } from '@jest/globals';

const browserExpect = value => expect(value);
browserExpect.poll = read => ({ toBe: async value => expect(await read()).toBe(value) });
jest.unstable_mockModule('@playwright/test', () => ({ expect: browserExpect }));
const { leaveEarnedCombatSafety } = await import('./e2e/earned-safe-zone-combat.js');

test('a living character who crossed into safety leaves through ordinary input and waits for server membership', async () => {
    const page = { evaluate: jest.fn().mockResolvedValueOnce({ zone: 'lanternhold', dead: false }).mockResolvedValue('') };
    const leave = jest.fn();
    expect(await leaveEarnedCombatSafety(page, leave)).toBe(true);
    expect(leave).toHaveBeenCalledTimes(1);
    expect(page.evaluate).toHaveBeenCalledTimes(2);
    expect(leave.mock.invocationCallOrder[0]).toBeLessThan(page.evaluate.mock.invocationCallOrder[1]);
});

test.each([{ zone: '', dead: false }, { zone: 'lanternhold', dead: true }])('does not move an outside or dead character: %j', async state => {
    const leave = jest.fn();
    expect(await leaveEarnedCombatSafety({ evaluate: jest.fn().mockResolvedValue(state) }, leave)).toBe(false);
    expect(leave).not.toHaveBeenCalled();
});

test('failed departure cannot be reported as successful combat recovery', async () => {
    const page = { evaluate: jest.fn().mockResolvedValueOnce({ zone: 'future-zone', dead: false }).mockResolvedValue('future-zone') };
    await expect(leaveEarnedCombatSafety(page, jest.fn())).rejects.toThrow();
});
