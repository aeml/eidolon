import { advancePreparedSimulation } from './e2e/prepared-simulation.js';

test('software-rendering hitches advance real timers in bounded simulation steps', () => {
    let timer = 15, elapsed = 0;
    const steps = [];
    for (let frame = 0; frame < 30; frame++) elapsed += advancePreparedSimulation(.5, dt => {
        steps.push(dt); timer = Math.max(0, timer - dt);
    });
    expect(elapsed).toBe(15);
    expect(timer).toBeCloseTo(0, 10);
    expect(steps.every(dt => dt > 0 && dt <= .05)).toBe(true);
});

test('catch-up work stays bounded and zero or invalid intervals cannot advance timers', () => {
    const steps = [];
    expect(advancePreparedSimulation(20, dt => steps.push(dt))).toBe(1);
    expect(steps).toHaveLength(20);
    expect(advancePreparedSimulation(0, () => { throw new Error('unexpected step'); })).toBe(0);
    for (const seconds of [-1, NaN, Infinity]) expect(() => advancePreparedSimulation(seconds, () => {})).toThrow();
});
