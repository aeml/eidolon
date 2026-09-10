// Coordinates are observed from an actually defeated enemy. The caller supplies
// ordinary movement; this helper never teleports or manufactures a pickup.
export async function approachEarnedDrop({ destination, readPosition, move, radius = 2, maxSteps = 16 }) {
    if (![destination?.x, destination?.z, radius].every(Number.isFinite) || radius <= 0 ||
        !Number.isInteger(maxSteps) || maxSteps < 1) throw new Error('Invalid earned drop approach');
    for (let step = 0; step <= maxSteps; step++) {
        const position = await readPosition();
        const dx = destination.x - position.x, dz = destination.z - position.z;
        const distance = Math.hypot(dx, dz);
        if (!Number.isFinite(distance)) throw new Error('Missing actual position during earned drop approach');
        if (distance <= radius) return position;
        if (step === maxSteps) break;
        const scale = Math.min(1, 8 / distance);
        await move(dx * scale, dz * scale);
    }
    throw new Error(`Ordinary movement did not reach the actual drop within ${maxSteps} steps`);
}
