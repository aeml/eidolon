import { renderFrameInterval } from './e2e/renderFrameInterval.js';

test.each([
    [32080.3, 32046.9, 33.4],
    [32080.2, 32046.8, 33.4],
    [17016.7, 17000, 16.7],
    [33050, 33000, 50],
    [17033.4001, 17000, 33.4001],
    [17033.401, 17000, 33.401],
    [17.005, .5, 16.505],
    [10, 10, 0],
    [2, 3, -1],
    [1e-7, 0, 1e-7]
])('reported timestamps %p minus%p preserve their decimal interval%p', (now, previous, expected) => {
    expect(renderFrameInterval(now, previous)).toBe(expected);
});

test('the exact33.4ms limit passes, but actual excesses are not rounded or tolerated', () => {
    expect(32080.2 - 32046.8).toBeGreaterThan(33.4);
    expect(renderFrameInterval(32080.2, 32046.8)).toBeLessThanOrEqual(33.4);
    for (const now of [17033.4001, 17033.401, 17033.5])
        expect(renderFrameInterval(now, 17000)).toBeGreaterThan(33.4);
});
