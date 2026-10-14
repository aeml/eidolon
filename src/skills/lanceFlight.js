// Entry into a target's collision circle along this frame's legal segment.
// Sorting by contact, rather than chunk order, keeps a slow frame from letting
// a non-piercing shot hit through the enemy in front.
export function lanceContactFraction(start, end, target, radius) {
    const dx = end.x - start.x, dz = end.z - start.z;
    const lengthSquared = dx * dx + dz * dz;
    if (!lengthSquared) return Math.hypot(target.x - start.x, target.z - start.z) < radius ? 0 : Infinity;
    const length = Math.sqrt(lengthSquared);
    const projection = ((target.x - start.x) * dx + (target.z - start.z) * dz) / length;
    const perpendicularSquared = Math.max(0, (target.x - start.x) ** 2 + (target.z - start.z) ** 2 - projection ** 2);
    if (perpendicularSquared >= radius * radius) return Infinity;
    const offset = Math.sqrt(radius * radius - perpendicularSquared);
    if (projection + offset <= 0 || projection - offset >= length) return Infinity;
    return Math.max(0, (projection - offset) / length);
}

export function orderLanceTargets(entities, start, end, radius) {
    return entities.map(entity => ({ entity, fraction: lanceContactFraction(start, end, entity.position, radius) }))
        .sort((a, b) => a.fraction - b.fraction || String(a.entity.id).localeCompare(String(b.entity.id)))
        .map(entry => entry.entity);
}
