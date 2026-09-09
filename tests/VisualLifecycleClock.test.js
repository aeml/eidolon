import { createVisualActorClock } from './visualLifecycleClock.js';

const actorFixture = () => {
    const steps = [];
    const actor = { timer: .6, update: dt => {
        steps.push(dt);
        actor.timer = Math.max(0, actor.timer - dt);
    } };
    return { actor, steps };
};

test.each([16, 50, 100, 1600, 6000])('a %sms rendered frame consumes all elapsed time in bounded actor steps', milliseconds => {
    const { actor, steps } = actorFixture();
    const clock = createVisualActorClock(actor, 1000);
    expect(clock(1000 + milliseconds)).toBeCloseTo(milliseconds / 1000);
    expect(steps.reduce((sum, dt) => sum + dt, 0)).toBeCloseTo(milliseconds / 1000);
    expect(steps.every(dt => dt > 0 && dt <= .05)).toBe(true);
});

test('slow rendering cannot stretch a 0.6s actor timer across many seconds', () => {
    const { actor } = actorFixture();
    const clock = createVisualActorClock(actor, 0);
    clock(2000);
    expect(actor.timer).toBe(0);
});

test('advancing immediately before a button action does not charge earlier time to a new effect', () => {
    const { actor } = actorFixture();
    const clock = createVisualActorClock(actor, 0);
    clock(5000);
    actor.timer = .6;
    clock(5100);
    expect(actor.timer).toBeCloseTo(.5);
    clock(5700);
    expect(actor.timer).toBe(0);
});

test('duplicate or older RAF timestamps neither consume nor rewind elapsed time', () => {
    const { actor, steps } = actorFixture();
    const clock = createVisualActorClock(actor, 1000);
    expect(clock(1000)).toBe(0);
    expect(clock(900)).toBe(0);
    expect(steps).toEqual([]);
    clock(1100);
    expect(steps.reduce((sum, dt) => sum + dt, 0)).toBeCloseTo(.1);
});

test('invalid clocks fail instead of silently corrupting actor timers', () => {
    const { actor } = actorFixture();
    expect(() => createVisualActorClock({}, 0)).toThrow('visual actor');
    expect(() => createVisualActorClock(actor, NaN)).toThrow('finite');
    expect(() => createVisualActorClock(actor, 0)(Infinity)).toThrow('finite');
});
