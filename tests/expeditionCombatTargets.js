// Earned QA strategy, not quest eligibility: close pursuers may need to be
// defeated before the requested expedition target can be fought safely. Their
// deaths never count unless the ordinary server quest rules award credit.
export function earthExpeditionSearchAnchor(hunt) {
    if (hunt?.huntingRealm !== 'earth') throw new Error('Earth search requires an Earth hunting realm');
    switch (hunt.enemy) {
    case 'Skeleton':
        return hunt.minEnemyLevel < 10 ? { x: 175, z: 200 } : { x: 125, z: -150 };
    case 'Imp': return { x: -300, z: 200 };
    case 'DemonOrc': return { x: 300, z: 200 };
    case 'Construct': return { x: -800, z: 200 };
    default: throw new Error(`Unsupported Earth expedition target: ${hunt.enemy}`);
    }
}

export function levelAppropriateExpeditionTargets(candidates, minimumLevel, playerLevel) {
    const maximumLevel = Math.max(minimumLevel, playerLevel + 1);
    return candidates.filter(enemy => Number.isInteger(enemy.level) &&
        enemy.level >= minimumLevel && enemy.level <= maximumLevel)
        .sort((a, b) => a.distance - b.distance);
}

export function chooseExpeditionCombatTarget(questTarget, threats) {
    const nearby = threats.filter(enemy => enemy && enemy.alive &&
        Number.isFinite(enemy.distance) && enemy.distance < 8)
        .sort((a, b) => a.distance - b.distance);
    const closest = nearby[0];
    if (closest && (!questTarget?.alive || closest.distance + 3 < questTarget.distance)) return closest;
    return questTarget?.alive ? questTarget : closest || null;
}

export function canEngageExpeditionTarget(target, projectedVisible) {
    // A normal click can start pursuit and a ranged spell can reach beyond the
    // basic-attack radius. Distance alone must not send an already visible foe
    // back through the same search loop without ever selecting it.
    return Boolean(target?.alive && projectedVisible && Number.isFinite(target.distance) && target.distance >= 0);
}
