import { loginAndEnterWorld } from './helpers.js';

export function uninterruptedEarnedMode(env = process.env) {
    const flag = env.EIDOLON_E2E_UNINTERRUPTED;
    if (flag !== undefined && flag !== '0' && flag !== '1') throw new Error('EIDOLON_E2E_UNINTERRUPTED must be 0 or 1');
    if (flag !== '1') return false;
    if (env.EIDOLON_E2E_FRESH_STORY_HUNT !== '1' || ['FRESH_COLLECTION', 'FRESH_HUNT',
        'FRESH_READY', 'FRESH_DUNGEON', 'FRESH_EARLY_PREPARATION'].some(name => env[`EIDOLON_E2E_${name}`] === '1')) {
        throw new Error('Uninterrupted verification currently covers only opening, diary and first story hunt');
    }
    return true;
}

const resources = page => page.evaluate(() => {
    const p = window.game.player;
    return { hp: p.stats.hp, maxHP: p.stats.maxHp, mana: p.stats.mana, maxMana: p.stats.maxMana };
});

// Keep reconnect assertions for persistence, but never refill bars through a
// mid-route login when measuring uninterrupted resource/combat pacing.
export async function earnedCheckpoint(page, credentials, { label, final = false, env = process.env } = {}) {
    const reconnect = !uninterruptedEarnedMode(env) || final;
    const before = await resources(page);
    if (reconnect) {
        await loginAndEnterWorld(page, credentials);
    }
    const after = await resources(page);
    console.log(`[earned-checkpoint] ${JSON.stringify({ label, reconnect, final, before, after })}`);
    return reconnect;
}
