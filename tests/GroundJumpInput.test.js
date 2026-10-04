import { jest, expect as jestExpect } from '@jest/globals';
import { GroundInputUnavailableError } from './groundInputFailure.js';

const assertion = Object.assign(value => jestExpect(value), { poll: jest.fn(callback => ({
    toBeGreaterThan: async value => jestExpect(await callback()).toBeGreaterThan(value),
    toBe: async value => jestExpect(await callback()).toBe(value)
})) });
jest.unstable_mockModule('@playwright/test', () => ({ expect: assertion }));
const { jumpByGroundClick, planVisibleGroundJump } = await import('./e2e/helpers.js');

beforeEach(() => assertion.poll.mockClear());

function pageFor(target) {
    return {
        evaluate: jest.fn().mockResolvedValueOnce({ x: 0, z: 0 })
            .mockResolvedValueOnce(target).mockResolvedValueOnce({ x: 9, z: 0 })
            .mockResolvedValueOnce(true),
        mouse: { move: jest.fn(), click: jest.fn() },
        keyboard: { down: jest.fn(), up: jest.fn() }
    };
}

test('covered full jump destination sends no shortened or replacement input', async () => {
    const page = pageFor({ canvas: false, scale: 1 });
    await expect(jumpByGroundClick(page, 9, 0)).rejects.toBeInstanceOf(GroundInputUnavailableError);
    expect(page.evaluate.mock.calls[1][1]).toEqual({ deltaX: 9, deltaZ: 0, allowScaling: false });
    expect(page.mouse.click).not.toHaveBeenCalled();
    expect(page.keyboard.down).not.toHaveBeenCalled();
});

test('visible full jump uses real Ctrl-click then checks displacement and landing', async () => {
    const page = pageFor({ canvas: true, scale: 1, x: 400, y: 300 });
    await jumpByGroundClick(page, 9, 0);
    expect(page.evaluate.mock.calls[1][1]).toEqual({ deltaX: 9, deltaZ: 0, allowScaling: false });
    expect(page.mouse.click).toHaveBeenCalledWith(400, 300);
    expect(page.keyboard.down).toHaveBeenCalledWith('Control');
    expect(page.keyboard.up).toHaveBeenCalledWith('Control');
    expect(page.evaluate).toHaveBeenCalledTimes(4);
});

test.each([[3, 8_000], [54, 8_000], [135, 12_000], [1_350, 60_000]])(
    'landing observation for %s units allows %s ms without weakening input checks', async (distance, timeout) => {
        const page = pageFor({ canvas: true, scale: 1, x: 400, y: 300 });
        await jumpByGroundClick(page, distance, 0);
        expect(assertion.poll).toHaveBeenLastCalledWith(expect.any(Function), { timeout });
        expect(page.evaluate.mock.calls[1][1]).toEqual({ deltaX: distance, deltaZ: 0, allowScaling: false });
        expect(page.mouse.click).toHaveBeenCalledTimes(1);
        expect(page.keyboard.down).toHaveBeenCalledWith('Control');
        expect(page.keyboard.up).toHaveBeenCalledWith('Control');
    }
);

test('route planning chooses a visible prefix first, then execution rechecks its entire intended destination', async () => {
    const planner = { evaluate: jest.fn().mockResolvedValue({ canvas: true, scale: .5, x: 400, y: 300 }) };
    const step = await planVisibleGroundJump(planner, 30, -8);
    expect(step).toEqual({ deltaX: 15, deltaZ: -4 });
    expect(planner.evaluate.mock.calls[0][1]).toEqual({ deltaX: 30, deltaZ: -8 });
    const page = pageFor({ canvas: true, scale: 1, x: 400, y: 300 });
    await jumpByGroundClick(page, step.deltaX, step.deltaZ);
    expect(page.evaluate.mock.calls[1][1]).toEqual({ deltaX: 15, deltaZ: -4, allowScaling: false });
    expect(page.mouse.click).toHaveBeenCalledTimes(1);
    expect(page.keyboard.down).toHaveBeenCalledWith('Control');
});

test.each([
    { canvas: false, scale: 1 }, { canvas: true, scale: .125 },
    { canvas: true, scale: 0 }, { canvas: true, scale: 2 }, null
])('covered or invalid/tiny planning result %j sends no real movement', async projection => {
    const page = { evaluate: jest.fn().mockResolvedValue(projection),
        mouse: { click: jest.fn() }, keyboard: { down: jest.fn() } };
    await expect(planVisibleGroundJump(page, 30, 0)).rejects.toBeInstanceOf(GroundInputUnavailableError);
    expect(page.mouse.click).not.toHaveBeenCalled();
    expect(page.keyboard.down).not.toHaveBeenCalled();
});
