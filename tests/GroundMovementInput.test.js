import { jest } from '@jest/globals';

const assertions = value => expect(value);
assertions.poll = callback => ({
    async toBe(value) { expect(await callback()).toBe(value); },
    async toBeGreaterThan(value) { expect(await callback()).toBeGreaterThan(value); }
});
jest.unstable_mockModule('@playwright/test', () => ({ expect: assertions }));
const { moveByGroundClick, enterDungeon, returnToTown } = await import('./e2e/helpers.js');

function movementPage(covered, mobile = false) {
    let x = 0;
    const keys = new Set();
    return {
        evaluate: jest.fn(async (callback, args) => {
            const code = callback.toString();
            if (args?.deltaX !== undefined) return { canvas: true, x: 100, y: 100 };
            if (code.includes('!window.game?.hoveredEntity')) return !covered;
            if (code.includes('Boolean(window.game?.isMobile)')) return mobile;
            if (code.includes('inventoryCount')) return { x, z: 0, state: 'IDLE', health: 100 };
            return {};
        }),
        mouse: { move: jest.fn(), click: jest.fn(async () => {
            // A normal entity-covered click must not be treated as movement.
            if (!covered || keys.has('Control') || keys.has('Shift')) x += 10;
        }) },
        keyboard: { down: jest.fn(async key => keys.add(key)), up: jest.fn(async key => keys.delete(key)) },
        waitForTimeout: jest.fn()
    };
}

test('covered ground can use the existing real Control-click fallback', async () => {
    const page = movementPage(true);
    expect((await moveByGroundClick(page, 15, 0)).x).toBe(10);
    expect(page.keyboard.down).toHaveBeenCalledWith('Control');
    expect(page.keyboard.up).toHaveBeenCalledWith('Control');
    expect(page.mouse.click).toHaveBeenCalledTimes(1);
});

test('no-jump retreat stays strict and never invents desktop WASD movement', async () => {
    const page = movementPage(true);
    await expect(moveByGroundClick(page, 9, 0, { allowJumpFallback: false, minimumDistance: 6 }))
        .rejects.toThrow('No real input established 6 units');
    expect(page.mouse.click).not.toHaveBeenCalled();
    expect(page.keyboard.down).not.toHaveBeenCalled();
});

test('clear ground continues through a normal click without a jump', async () => {
    const page = movementPage(false);
    expect((await moveByGroundClick(page, 15, 0)).x).toBe(10);
    expect(page.keyboard.down).not.toHaveBeenCalled();
});

test('a checked retreat never substitutes an unchecked sideways path', async () => {
    const page = movementPage(true);
    await expect(moveByGroundClick(page, 9, 0, {
        allowJumpFallback: false, allowAlternatePaths: false, minimumDistance: 6
    })).rejects.toThrow('No real input established 6 units');
    const projections = page.evaluate.mock.calls.filter(([, args]) => args?.deltaX !== undefined);
    expect(projections.map(([, args]) => args)).toEqual([{ deltaX: 9, deltaZ: 0 }]);
    expect(page.mouse.click).not.toHaveBeenCalled();
    expect(page.keyboard.down).not.toHaveBeenCalled();
});

test('an issued checked-path click that cannot move still fails', async () => {
    const page = movementPage(false);
    page.mouse.click.mockImplementation(async () => {});
    await expect(moveByGroundClick(page, 9, 0, {
        allowJumpFallback: false, allowAlternatePaths: false, minimumDistance: 6
    })).rejects.toThrow('No real input established 6 units');
    expect(page.mouse.click).toHaveBeenCalledTimes(1);
    expect(page.keyboard.down).not.toHaveBeenCalled();
});

test.each([false, true])('deliberate move-only input walks with Shift even on covered ground: %s', async covered => {
    const page = movementPage(covered);
    expect((await moveByGroundClick(page, 15, 0, { moveOnly: true, allowJumpFallback: false })).x).toBe(10);
    expect(page.keyboard.down.mock.calls).toEqual([['Shift']]);
    expect(page.keyboard.up.mock.calls).toEqual([['Shift']]);
    expect(page.mouse.click).toHaveBeenCalledTimes(1);
});

test('failed move-only clicks release Shift and do not silently retry as a jump', async () => {
    const page = movementPage(true);
    page.mouse.click.mockRejectedValueOnce(new Error('input unavailable'));
    await expect(moveByGroundClick(page, 15, 0, { moveOnly: true, allowJumpFallback: false }))
        .rejects.toThrow('input unavailable');
    expect(page.keyboard.down.mock.calls).toEqual([['Shift']]);
    expect(page.keyboard.up.mock.calls).toEqual([['Shift']]);
    expect(page.mouse.click).toHaveBeenCalledTimes(1);
});

test('standalone entry is available to the focused party resume diagnostic', () => {
    expect(typeof enterDungeon).toBe('function');
});

test('party recall cannot hide a death behind default respawn behavior', async () => {
    const page = { evaluate: jest.fn().mockResolvedValue({ state: 'DEAD' }), locator: jest.fn(),
        keyboard: { press: jest.fn() } };
    await expect(returnToTown(page, { allowRespawn: false })).rejects.toThrow('cannot hide a respawn');
    expect(page.locator).not.toHaveBeenCalled();
    expect(page.keyboard.press).not.toHaveBeenCalled();
});
