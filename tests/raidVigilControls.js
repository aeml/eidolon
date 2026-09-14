// Read the same personal crystal snapshot that drives the visible ritual markers.
// Slots 2/3 are the Wizard/Rogue runners; tank and both healers keep their roles.
// Returning a point never advances an objective: the server observes movement,
// elapsed time, different carriers and every wave's remaining enemies.
export function raidVigilDestination(crystal, actorIndex) {
    const objective = crystal?.objective;
    if (crystal?.stage !== 'repairing' || !objective || objective.complete || objective.paused ||
        !Array.isArray(objective.points) || !Number.isInteger(objective.current)) return null;
    let point;
    switch (crystal.element) {
    case 'Earth':
        if (actorIndex !== 3) return null;
        point = objective.points[0];
        break;
    case 'Water':
        if (actorIndex !== 3) return null;
        point = objective.points[objective.hint?.startsWith('You carry a memory.') ? 1 : 0];
        break;
    case 'Fire':
        if (actorIndex !== 3) return null;
        point = objective.points[objective.current];
        break;
    case 'Air':
        if (actorIndex !== 2 + objective.current % 2 || objective.hint?.startsWith('You passed the wind.')) return null;
        point = objective.points[objective.current];
        break;
    default:
        return null;
    }
    if (!point || point.state !== 'active' || ![point.x, point.z, point.radius].every(Number.isFinite) || point.radius <= 0) return null;
    // Stand inside the marker, offset from Maelin/the marker's central prop.
    return { x: point.x + point.radius / 2, z: point.z,
        tolerance: Math.min(1, point.radius / 4), label: point.label };
}
