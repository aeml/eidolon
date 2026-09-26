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

// The second healer escorts the currently assigned runner before incoming
// damage. Waiting for an injured runner can leave a 70-unit gap to close while
// that player is channeling. This assigns ordinary follow/heal inputs only.
export function raidVigilSupportAnchor(crystal, healerIndex, states) {
    if (healerIndex !== 4 || states.length < 5) return null;
    const healer = states[healerIndex];
    if (!healer || healer.dead || healer.hp <= 0) return null;
    for (const index of [2, 3]) {
        const runner = states[index];
        if (runner && !runner.dead && runner.hp > 0 && runner.instance === healer.instance &&
            raidVigilDestination(crystal, index)) return runner;
    }
    return null;
}

// After handing off an Air anchor (or completing another ritual), rejoin
// support instead of standing alone waiting for the tank's next selected kill.
// The currently assigned runner must still physically complete their marker.
export function raidVigilRecoveryAnchor(crystal, actorIndex, actor, healers) {
    if (crystal?.stage !== 'repairing' || ![2, 3].includes(actorIndex) ||
        !actor || actor.dead || !(actor.hp > 0) || raidVigilDestination(crystal, actorIndex)) return null;
    const distance = other => Math.hypot(actor.x - other.x, actor.z - other.z);
    const nearest = healers.filter(other => other && !other.dead && other.hp > 0 && other.instance === actor.instance &&
        [other.x, other.z, actor.x, actor.z].every(Number.isFinite))
        .sort((a, b) => distance(a) - distance(b))[0];
    return nearest && distance(nearest) > 9 ? nearest : null;
}

// Once the marker work ends, the escort must not remain alone self-healing
// against a pack while both damage runners return to the tank. Walk during
// direct-heal cooldowns (or when nobody needs healing), never instead of a
// ready heal. The caller still uses normal warning-aware, collision-safe input.
export function raidVigilEscortRecoveryAnchor(crystal, healerIndex, healer, tank,
    { allowMovement, cooldown, needsHeal }) {
    if (crystal?.stage !== 'repairing' || !crystal.objective?.complete || healerIndex !== 4 ||
        !allowMovement || (needsHeal && !(Number.isFinite(cooldown) && cooldown >= 1)) ||
        !healer || !tank || healer.dead || tank.dead || !(healer.hp > 0) || !(tank.hp > 0) ||
        healer.instance !== tank.instance || ![healer.x, healer.z, tank.x, tank.z].every(Number.isFinite)) return null;
    return Math.hypot(healer.x - tank.x, healer.z - tank.z) > 9 ? tank : null;
}
