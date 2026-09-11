// Prepared visual fixtures are not throughput benchmarks. Leave a small idle
// interval AFTER each completed draw so software WebGL cannot monopolize input
// and browser inspection. The actor clock still receives actual RAF timestamps.
// Never install this scheduler in the production game loop.
export function startVisualFixtureLoop(draw, scheduler = globalThis) {
    if (typeof draw !== 'function') throw new Error('A visual draw callback is required');
    let stopped = false;
    let frame = null;
    let timer = null;
    const queueFrame = () => {
        timer = null;
        if (!stopped) frame = scheduler.requestAnimationFrame(tick);
    };
    const tick = now => {
        frame = null;
        if (stopped) return;
        draw(now);
        if (!stopped) timer = scheduler.setTimeout(queueFrame, 50);
    };
    queueFrame();
    return () => {
        stopped = true;
        if (frame !== null) scheduler.cancelAnimationFrame(frame);
        if (timer !== null) scheduler.clearTimeout(timer);
        frame = null;
        timer = null;
    };
}
