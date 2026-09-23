import { jest, expect as jestExpect } from '@jest/globals';
import { GroundInputUnavailableError } from './groundInputFailure.js';

const assertion = Object.assign(value => jestExpect(value), { poll: callback => ({
    toBeGreaterThan: async value => jestExpect(await callback()).toBeGreaterThan(value),
    toBe: async value => jestExpect(await callback()).toBe(value)
}) });
jest.unstable_mockModule('@playwright/test', () => ({ expect: assertion }));
const { jumpByGroundClick } = await import('./e2e/helpers.js');

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
