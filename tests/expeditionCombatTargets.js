// Earned QA strategy, not quest eligibility: close pursuers may need to be
// defeated before the requested expedition target can be fought safely. Their
// deaths never count unless the ordinary server quest rules award credit.
export function chooseExpeditionCombatTarget(questTarget, threats) {
    const nearby = threats.filter(enemy => enemy && enemy.alive &&
        Number.isFinite(enemy.distance) && enemy.distance < 8)
        .sort((a, b) => a.distance - b.distance);
    const closest = nearby[0];
    if (closest && (!questTarget?.alive || closest.distance + 3 < questTarget.distance)) return closest;
    return questTarget?.alive ? questTarget : closest || null;
}
