// Read-only hot-path health checks. Large diagnostic receipts are fetched only
// on failure; they remain recorded in each browser for final evidence.
export function partyCombatHealthSnapshot(game, evidence, now) {
    return { dead: game.player.state === 'DEAD', sawDeath: evidence?.sawDeath === true,
        updateAge: Number.isFinite(evidence?.lastUpdate) ? now - evidence.lastUpdate : Infinity };
}

export async function observePartyCombatHealth(actors, read) {
    const results = await Promise.allSettled(actors.map(async actor => read(actor)));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    return results.map(result => result.value);
}
