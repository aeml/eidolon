import { createEarnedWizardDefense } from './earned-wizard-defense.js';

export async function observeCollectionCombatReceipts(page) {
    await page.evaluate(async () => {
        const { recordCollectionCombatReceipt } = await import('/tests/collectionCombatReceipts.js');
        const game = window.game, original = game.handleServerMessage.bind(game);
        window.__collectionCombatReceipts = {};
        game.handleServerMessage = message => {
            recordCollectionCombatReceipt(window.__collectionCombatReceipts, message, game.player?.id);
            return original(message);
        };
    });
}

// Same ordinary spacing/earned shield inputs as the hunt route. No grants,
// skill purchases, recovery commands or changes to collection/death limits.
export async function createFreshCollectionCombat(page) {
    const className = await page.evaluate(() => window.game.player.constructor.name);
    return className === 'Wizard' ? createEarnedWizardDefense(page, { retreatBelowHealthRatio: .8 }) : async () => false;
}

// Observe the result of an ordinary click, not the originally projected ID.
// Moving/overlapping enemies can change which actual hitbox receives the click.
export async function readSelectedCollectionTarget(page) {
    return page.evaluate(() => {
        const game = window.game, target = game.pendingInteraction;
        if (!target || !game.isHostileActorTarget(target)) return null;
        return { id: target.id };
    });
}

export async function readCollectionTarget(page, id) {
    return page.evaluate(id => {
        const enemy = window.game.remotePlayers.get(id);
        return enemy ? { hp: enemy.health ?? enemy.stats?.hp, state: enemy.state,
            x: enemy.position.x, z: enemy.position.z } : null;
    }, id);
}

export async function selectCollectionTargetThroughInput(page, target, point) {
    const selected = await readSelectedCollectionTarget(page);
    // A normal click already owns cooldown-driven auto-attack/chase. Repeated
    // clicks at a moving silhouette can select another overlapping enemy.
    if (selected?.id === target.id) return target;
    await page.mouse.click(point.x, point.y);
    return await readSelectedCollectionTarget(page) || target;
}

// Read-only diagnostic: never include account details or general game payloads.
export async function readFreshCollectionCombat(page, targetId) {
    return page.evaluate(id => {
        const game = window.game, p = game.player;
        const target = game.remotePlayers.get(id);
        return { level: p.level, state: p.state, hp: p.stats.hp, maxHP: p.stats.maxHp,
            mana: p.stats.mana, maxMana: p.stats.maxMana, x: p.position.x, z: p.position.z,
            defense: window.__freshWizardDefense?.counts || null,
            receipts: window.__collectionCombatReceipts || null,
            pendingTarget: game.pendingInteraction?.id || null,
            hoveredTarget: game.hoveredEntity?.id || null,
            target: target ? { id, type: target.subType, level: target.level,
                hp: target.health ?? target.stats?.hp, state: target.state,
                distance: p.position.distanceTo(target.position) } : null,
            nearby: [...game.remotePlayers.values()].filter(enemy => game.isHostileActorTarget(enemy) &&
                p.position.distanceTo(enemy.position) < 18).map(enemy => ({ type: enemy.subType,
                id: enemy.id, hp: enemy.health ?? enemy.stats?.hp,
                level: enemy.level, distance: p.position.distanceTo(enemy.position) })) };
    }, targetId);
}
