import { jest } from '@jest/globals';
import { startVisualFixtureLoop } from './visualFixtureLoop.js';
import { createVisualActorClock } from './visualLifecycleClock.js';

function fixture() {
    return {
        requestAnimationFrame: jest.fn(() => 1),
        cancelAnimationFrame: jest.fn(),
        setTimeout: jest.fn(() => 2),
        clearTimeout: jest.fn()
    };
}

test('yields after each completed draw before requesting another frame', () => {
    const scheduler = fixture();
    const draw = jest.fn();
    startVisualFixtureLoop(draw, scheduler);
    expect(scheduler.setTimeout).not.toHaveBeenCalled();
    scheduler.requestAnimationFrame.mock.calls[0][0](1600);
    expect(draw).toHaveBeenCalledWith(1600);
    expect(scheduler.setTimeout).toHaveBeenCalledWith(expect.any(Function), 50);
    expect(scheduler.requestAnimationFrame).toHaveBeenCalledTimes(1);
    scheduler.setTimeout.mock.calls[0][0]();
    expect(scheduler.requestAnimationFrame).toHaveBeenCalledTimes(2);
});

test('slow draws and idle gaps still charge all real elapsed actor time', () => {
    const scheduler = fixture();
    let elapsed = 0;
    const clock = createVisualActorClock({ update: dt => { elapsed += dt; } }, 0);
    startVisualFixtureLoop(clock, scheduler);
    scheduler.requestAnimationFrame.mock.calls[0][0](1600);
    scheduler.setTimeout.mock.calls[0][0]();
    scheduler.requestAnimationFrame.mock.calls[1][0](3250);
    expect(elapsed).toBeCloseTo(3.25);
});

test('stop cancels a queued frame and ignores a late frame callback', () => {
    const scheduler = fixture(), draw = jest.fn();
    const stop = startVisualFixtureLoop(draw, scheduler);
    stop(); stop();
    scheduler.requestAnimationFrame.mock.calls[0][0](1600);
    expect(scheduler.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(draw).not.toHaveBeenCalled();
    expect(scheduler.setTimeout).not.toHaveBeenCalled();
});

test('stop cancels the idle timer and prevents a late timer from restarting', () => {
    const scheduler = fixture();
    const stop = startVisualFixtureLoop(jest.fn(), scheduler);
    scheduler.requestAnimationFrame.mock.calls[0][0](16);
    stop();
    scheduler.setTimeout.mock.calls[0][0]();
    expect(scheduler.clearTimeout).toHaveBeenCalledWith(2);
    expect(scheduler.requestAnimationFrame).toHaveBeenCalledTimes(1);
});

test('stopping during a draw cannot schedule another draw', () => {
    const scheduler = fixture();
    const stop = startVisualFixtureLoop(() => stop(), scheduler);
    scheduler.requestAnimationFrame.mock.calls[0][0](16);
    expect(scheduler.setTimeout).not.toHaveBeenCalled();
});

test('draw failures remain visible and do not start another iteration', () => {
    const scheduler = fixture();
    startVisualFixtureLoop(() => { throw new Error('render failed'); }, scheduler);
    expect(() => scheduler.requestAnimationFrame.mock.calls[0][0](16)).toThrow('render failed');
    expect(scheduler.setTimeout).not.toHaveBeenCalled();
});
