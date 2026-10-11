// Read-only encounter evidence. Keep every acquired identity long enough to
// observe its server-replicated death even if pointer targeting moves elsewhere.
export function observeFightTargetsInPage({ requestedId, acquiredIds = [] }) {
    const game = window.game, pending = game.pendingInteraction;
    const ids = new Set([requestedId, ...acquiredIds]);
    if (pending?.id && pending.isActive && game.isHostileActorTarget(pending)) ids.add(pending.id);
    if (ids.size > 32) throw Error('Bounded encounter exceeded32acquired targets');
    const defeated = [...ids].find(id => {
        const actor = game.remotePlayers.get(id);
        const localDamage = window.__equippedFightReview?.damage.some(hit => hit.localSource && hit.targetId === id && hit.amount > 0);
        return actor && localDamage && (actor.state === 'DEAD' || (actor.health ?? actor.stats?.hp) <= 0);
    });
    const id = defeated || (pending?.id && ids.has(pending.id) ? pending.id : requestedId);
    const selected = game.remotePlayers.get(id);
    return { id, acquiredIds: [...ids], dead: Boolean(defeated), hp: game.player.stats.hp,
        instance: game.currentInstanceId || '', localState: game.player.state,
        clip: game.player.currentAction?.getClip?.().name, clipTime: game.player.currentAction?.time,
        cooldown: game.player.abilityCooldown, targetHp: selected?.health ?? selected?.stats?.hp,
        position: game.player.position.toArray(), ironFortress: game.player.ironFortressTimer };
}
