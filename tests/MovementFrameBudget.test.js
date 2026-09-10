import { readFileSync } from 'node:fs';
import { movementFrameBudget } from './movementFrameBudget.js';

const frames = (speed, distance, ticks = 2) => [
    { speed, renderX: 0, renderZ: 0, simulationFrame: 359 },
    { speed, renderX: distance, renderZ: 0, simulationFrame: 359 + ticks }
];
const passes = result => result.invalidFrames === 0 && result.maxSimulationTicks <= 2 && result.maxRenderStepExcess < 1e-5;

test.each([[9.6, .32], [10.56, .352], [28.8, .96],
    [31.68000030517578, 1.0560000101725278]])('legal two-tick movement at speed %s travels %s', (speed, distance) => {
    expect(passes(movementFrameBudget(frames(speed, distance)))).toBe(true);
});

test.each([[10.56, .7, 2], [31.68, 1.2, 2], [31.68, 1.056, 1], [10.56, .1, 0],
    [31.68, 1.584, 3], [31.68, .1, 3]])('rejects excess motion or simulation: speed=%s distance=%s ticks=%s', (speed, distance, ticks) => {
    expect(passes(movementFrameBudget(frames(speed, distance, ticks)))).toBe(false);
});

test.each([undefined, {}, [], [{}], [null, null], frames(NaN, 0), frames(-1, 0), frames(10, 0, -1), frames(10, 0, .5)]
    .map(samples => ({ samples })))(
    'incomplete or invalid evidence cannot pass %#', ({ samples }) => {
        expect(passes(movementFrameBudget(samples))).toBe(false);
    });

test('a tick without movement and an ordinary speed transition are valid', () => {
    expect(passes(movementFrameBudget(frames(0, 0)))).toBe(true);
    const transition = frames(31.68, 1.056);
    transition[0].speed = 28.8;
    expect(passes(movementFrameBudget(transition))).toBe(true);
});

test('both movement segments enforce the simulation budget without dropping other checks', () => {
    const spec = readFileSync('tests/e2e/movement-smoothness.spec.js', 'utf8');
    for (const segment of ['sustainedAnalysis', 'outsideAnalysis']) {
        expect(spec).toContain(`expect(${segment}.maxSimulationTicks).toBeLessThanOrEqual(2)`);
        expect(spec).toContain(`expect(${segment}.maxRenderStepExcess).toBeLessThan(1e-5)`);
        expect(spec).toContain(`expect(${segment}.invalidFrames).toBe(0)`);
        expect(spec).toContain(`expect(${segment}.largestRenderBacktrack).toBeGreaterThanOrEqual(-0.02)`);
    }
    const runtime = readFileSync('src/core/GameEngineRuntimeConstants.js', 'utf8');
    expect(runtime).toContain('MAX_FRAME_SIMULATION_DELTA = 1 / 30');
    expect(readFileSync('src/core/GameEngine.js', 'utf8')).toContain('this.fixedTimeStep = 1 / 60');
});
