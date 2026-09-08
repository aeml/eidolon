// Preserve the normal click-owned auto-attack/chase until ordinary movement,
// death, or deliberate target selection changes it. Repeated clicks on moving
// silhouettes can switch to an overlapping actor instead of finishing a fight.
export async function readEarnedAttackTarget(page) {
    return page.evaluate(() => {
        const game = window.game, target = game.pendingInteraction;
        if (!target || !game.isHostileActorTarget(target) || target.isActive === false ||
            target.state === 'DEAD' || (target.health ?? target.stats?.hp) <= 0) return null;
        return { id: target.id };
    });
}

export async function selectEarnedAttackTarget(page, target, point) {
    const selected = await readEarnedAttackTarget(page);
    if (selected?.id === target.id) return target;
    await page.mouse.click(point.x, point.y);
    // The actual ray hit owns selection, not our previously projected ID.
    return await readEarnedAttackTarget(page) || target;
}

export async function reacquireEarnedAttackTarget(page, target, findNearby) {
    const disengaged = await page.evaluate(id => {
        const game = window.game, enemy = game.remotePlayers.get(id);
        if (!enemy || enemy.state === 'DEAD' || (enemy.health ?? enemy.stats?.hp) <= 0 ||
            game.isHostileActorTarget(game.pendingInteraction)) return false;
        return game.player.position.distanceTo(enemy.position) > game.getBasicAttackRangeForEntity(enemy) + 2;
    }, target.id);
    return disengaged ? await findNearby() || target : target;
}
