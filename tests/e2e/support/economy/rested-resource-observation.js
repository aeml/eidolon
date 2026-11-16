import { expect } from '@playwright/test';

// These functional routes run against the owned loopback server on this host.
// Both timestamps therefore share a clock. Never use this freshness predicate
// to infer timing on an arbitrary remote server.
export async function observeRestedResources(page) {
    expect(new URL(process.env.EIDOLON_E2E_WS_URL).hostname).toBe('127.0.0.1');
    await page.evaluate(() => {
        const game = window.game, player = game.player;
        if (window.__restedResourceObservation) return;
        const evidence = window.__restedResourceObservation = { frame: null };
        const state = { mana: player.stats.mana, maxMana: player.stats.maxMana,
            hp: player.stats.hp, maxHP: player.stats.maxHp, state: player.state,
            bank: player.wellRestedSeconds, zone: player.safeZoneId,
            cdr: player.stats.cooldownReduction };
        const original = game.handleServerMessage.bind(game);
        game.handleServerMessage = message => {
            const updates = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
            const row = updates?.[game.player.id];
            if (row) {
                for (const [wire, field] of [['mana', 'mana'], ['maxMana', 'maxMana'],
                    ['health', 'hp'], ['maxHealth', 'maxHP'], ['state', 'state'],
                    ['wellRestedSeconds', 'bank'], ['safeZoneId', 'zone']]) {
                    if (row[wire] !== undefined) state[field] = row[wire];
                }
                if (row.wellRestedSeconds !== undefined && row._serverTimeMs > 0) {
                    evidence.frame = { ...state, serverTimeMs: row._serverTimeMs };
                }
            }
            const result = original(message);
            state.cdr = game.player.stats.cooldownReduction;
            if (evidence.frame && evidence.frame.serverTimeMs === row?._serverTimeMs) evidence.frame.cdr = state.cdr;
            return result;
        };
    });
}

export async function freshRestedResources(page, afterMs = Date.now()) {
    await expect.poll(() => page.evaluate(after =>
        (window.__restedResourceObservation?.frame?.serverTimeMs || 0) > after, afterMs))
        .toBe(true);
    return page.evaluate(() => ({ ...window.__restedResourceObservation.frame }));
}
