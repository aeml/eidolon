import { createEarnedWizardDefense } from './earned-wizard-defense.js';

// Same ordinary spacing/earned shield inputs as the hunt route. No grants,
// skill purchases, recovery commands or changes to collection/death limits.
export async function createFreshCollectionCombat(page) {
    const className = await page.evaluate(() => window.game.player.constructor.name);
    return className === 'Wizard' ? createEarnedWizardDefense(page) : async () => false;
}

// Read-only diagnostic: never include account details or general game payloads.
export async function readFreshCollectionCombat(page, targetId) {
    return page.evaluate(id => {
        const game = window.game, p = game.player;
        const target = game.remotePlayers.get(id);
        return { level: p.level, state: p.state, hp: p.stats.hp, maxHP: p.stats.maxHp,
            mana: p.stats.mana, maxMana: p.stats.maxMana, x: p.position.x, z: p.position.z,
            defense: window.__freshWizardDefense?.counts || null,
            target: target ? { type: target.subType, level: target.level,
                hp: target.health ?? target.stats?.hp, state: target.state,
                distance: p.position.distanceTo(target.position) } : null,
            nearby: [...game.remotePlayers.values()].filter(enemy => game.isHostileActorTarget(enemy) &&
                p.position.distanceTo(enemy.position) < 18).map(enemy => ({ type: enemy.subType,
                level: enemy.level, distance: p.position.distanceTo(enemy.position) })) };
    }, targetId);
}
