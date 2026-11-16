// Match the engine's fixed 60Hz simulation and maximum two updates per render.
// A speed boost changes world distance, not the amount of simulation permitted.
export function movementFrameBudget(frames) {
    if (!Array.isArray(frames)) return { maxSimulationTicks: 0, maxRenderStepExcess: 0, invalidFrames: 1 };
    let maxSimulationTicks = 0;
    let maxRenderStepExcess = 0;
    let invalidFrames = frames.length < 2 ? 1 : 0;
    for (let index = 1; index < frames.length; index++) {
        const previous = frames[index - 1], current = frames[index];
        if (!previous || !current) {
            invalidFrames++;
            continue;
        }
        const ticks = current.simulationFrame - previous.simulationFrame;
        const values = [previous.speed, current.speed, previous.renderX, previous.renderZ,
            current.renderX, current.renderZ, previous.simulationFrame, current.simulationFrame];
        if (!values.every(Number.isFinite) || !Number.isInteger(ticks) || ticks < 0 ||
            previous.speed < 0 || current.speed < 0) {
            invalidFrames++;
            continue;
        }
        maxSimulationTicks = Math.max(maxSimulationTicks, ticks);
        const budget = Math.max(previous.speed, current.speed) * Math.min(ticks, 2) / 60;
        const distance = Math.hypot(current.renderX - previous.renderX, current.renderZ - previous.renderZ);
        maxRenderStepExcess = Math.max(maxRenderStepExcess, distance - budget);
    }
    return { maxSimulationTicks, maxRenderStepExcess, invalidFrames };
}
