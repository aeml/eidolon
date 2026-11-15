// Prepared component scenes can advance their retirement review by a fixed
// simulation interval after inspecting the active visuals. Run real entity
// updates in bounded steps and render once afterward. This is fixture scheduling,
// not a change to the game clock or a replacement for native timing acceptance.
export function advancePreparedSimulation(seconds, update) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid prepared frame interval');
    const elapsed = Math.min(seconds, 1);
    const steps = Math.ceil(elapsed / .05);
    for (let step = 0; step < steps; step++) update(elapsed / steps);
    return elapsed;
}
