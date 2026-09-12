import { jest } from '@jest/globals';

const assertions = value => expect(value);
assertions.poll = callback => ({
    async toBe(value) { expect(await callback()).toBe(value); },
    async toBeGreaterThan(value) { expect(await callback()).toBeGreaterThan(value); }
});
jest.unstable_mockModule('@playwright/test', () => ({ expect: assertions }));
const { moveByGroundClick, enterDungeon, returnToTown } = await import('./e2e/helpers.js');

function movementPage(covered, mobile = false, drift = 0, displacement = 10) {
    let x = 0;
    let ground;
    const keys = new Set();
    return {
        evaluate: jest.fn(async (callback, args) => {
            const code = callback.toString();
            if (args?.deltaX !== undefined) {
                ground = { x: x + args.deltaX, y: 0, z: args.deltaZ };
                return { canvas: true, x: 100, y: 100, world: ground };
            }
            if (code.includes('getGroundIntersectionFromEvent')) return ground && { ...ground, x: ground.x + drift };
            if (code.includes('!window.game?.hoveredEntity')) return !covered;
            if (code.includes('Boolean(window.game?.isMobile)')) return mobile;
            if (code.includes('inventoryCount')) return { x, z: 0, state: 'IDLE', health: 100, instanceType: 'dungeon', instanceId: 'dungeon-test' };
            return {};
        }),
        mouse: { move: jest.fn(), click: jest.fn(async () => {
            // A normal entity-covered click must not be treated as movement.
            if (!covered || keys.has('Control') || keys.has('Shift')) x += displacement;
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

test('optional phase timing observes the same strict move-only input without changing it', async () => {
    const page = movementPage(true), phases = [];
    const after = await moveByGroundClick(page, 9, 0, { moveOnly: true, requireClearPath: true,
        allowJumpFallback: false, allowAlternatePaths: false, onTiming: phase => phases.push(phase) });
    expect(after.x).toBe(10);
    expect(phases.map(p => p.phase)).toEqual(['click-observer', 'read-origin', 'path-clear',
        'project-ground', 'mouse-move', 'hover-settled', 'ground-ray', 'click-released',
        'click-observed', 'movement-observed']);
    for (const [index, phase] of phases.entries()) {
        expect(Number.isFinite(phase.elapsedMs)).toBe(true);
        expect(phase.durationMs).toBeGreaterThanOrEqual(0);
        expect(phase.elapsedMs).toBeGreaterThanOrEqual(phases[index - 1]?.elapsedMs || 0);
    }
    expect(page.mouse.click).toHaveBeenCalledTimes(1);
    expect(page.keyboard.down.mock.calls).toEqual([['Shift']]);
    expect(page.keyboard.up.mock.calls).toEqual([['Shift']]);
});

test('timing records a stale ground ray without inventing a successful input', async () => {
    const page = movementPage(true, false, .4), phases = [];
    await expect(moveByGroundClick(page, 9, 0, { moveOnly: true, requireClearPath: true,
        allowJumpFallback: false, allowAlternatePaths: false, onTiming: phase => phases.push(phase) }))
        .rejects.toMatchObject({ name: 'GroundInputUnavailableError' });
    expect(phases.map(p => p.phase)).toContain('ray-invalid');
    expect(phases.map(p => p.phase)).not.toContain('click-released');
    expect(phases.map(p => p.phase)).not.toContain('movement-observed');
    expect(page.mouse.click).not.toHaveBeenCalled();
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
    expect(projections.map(([, args]) => args)).toEqual([{ deltaX: 9, deltaZ: 0, allowScaling: true }]);
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

test('move-only walking ignores covered ground without using a jump', async () => {
    const page = movementPage(true);
    expect((await moveByGroundClick(page, 9, 0, { moveOnly: true,
        allowJumpFallback: false, allowAlternatePaths: false, minimumDistance: 6 })).x).toBe(10);
    expect(page.keyboard.down).toHaveBeenCalledWith('Shift');
    expect(page.keyboard.up).toHaveBeenCalledWith('Shift');
    expect(page.keyboard.down).not.toHaveBeenCalledWith('Control');
    expect(page.mouse.click).toHaveBeenCalledTimes(1);
});

test('move-only walking still fails real movement failure and always releases Shift', async () => {
    const page = movementPage(true);
    page.mouse.click.mockImplementation(async () => {});
    await expect(moveByGroundClick(page, 9, 0, { moveOnly: true,
        allowJumpFallback: false, allowAlternatePaths: false, minimumDistance: 6 }))
        .rejects.toThrow('No real input established 6 units');
    expect(page.mouse.click).toHaveBeenCalledTimes(1);
    expect(page.keyboard.up).toHaveBeenCalledWith('Shift');
    expect(page.keyboard.down).not.toHaveBeenCalledWith('Control');
});

test('strict prevalidated movement projects the entire vector without shrinking it', async () => {
    const page = movementPage(true);
    await moveByGroundClick(page, 9, 0, { moveOnly: true, requireClearPath: true,
        allowJumpFallback: false, allowAlternatePaths: false, minimumDistance: 6 });
    const projections = page.evaluate.mock.calls.filter(([, args]) => args?.deltaX !== undefined);
    expect(projections.map(([, args]) => args)).toEqual([{ deltaX: 9, deltaZ: 0, allowScaling: false }]);
    expect(page.mouse.click).toHaveBeenCalledTimes(1);
});

test('camera drift invalidates a checked destination before any input is issued', async () => {
    const page = movementPage(true, false, .4);
    await expect(moveByGroundClick(page, 9, 0, { moveOnly: true, requireClearPath: true,
        allowJumpFallback: false, allowAlternatePaths: false, minimumDistance: 6 }))
        .rejects.toMatchObject({ name: 'GroundInputUnavailableError' });
    expect(page.mouse.click).not.toHaveBeenCalled();
    expect(page.keyboard.down).not.toHaveBeenCalled();
});

test('an issued strict click that really fails movement remains an error', async () => {
    const page = movementPage(true);
    page.mouse.click.mockImplementation(async () => {});
    await expect(moveByGroundClick(page, 9, 0, { moveOnly: true, requireClearPath: true,
        allowJumpFallback: false, allowAlternatePaths: false, minimumDistance: 6 }))
        .rejects.toMatchObject({ name: 'Error' });
    expect(page.mouse.click).toHaveBeenCalledTimes(1);
    expect(page.keyboard.up).toHaveBeenCalledWith('Shift');
});

test('a real short formation click can finish inside its required arrival region', async () => {
    const page = movementPage(true, false, 0, .888);
    const result = await moveByGroundClick(page, 1.805, 0, { moveOnly: true, requireClearPath: true,
        allowJumpFallback: false, allowAlternatePaths: false, arrival: { x: 5.8, z: 0, radius: 5, instanceId: 'dungeon-test' } });
    expect(result.x).toBe(.888);
    expect(page.mouse.click).toHaveBeenCalledTimes(1);
    expect(page.keyboard.down).toHaveBeenCalledWith('Shift');
});
test('the same short movement still fails without an explicit reached arrival region', async () => {
    for (const arrival of [undefined, { x: 6, z: 0, radius: 5, instanceId: 'dungeon-test' }]) {
        const page = movementPage(true, false, 0, .888);
        await expect(moveByGroundClick(page, 1.805, 0, { moveOnly: true, requireClearPath: true,
            allowJumpFallback: false, allowAlternatePaths: false, arrival })).rejects.toThrow('No real input established 1 units');
    }
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
