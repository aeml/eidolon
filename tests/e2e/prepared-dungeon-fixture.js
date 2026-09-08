import { expect } from '@playwright/test';

// ONLY the explicitly prepared functional dungeon route calls this. A previous
// test may already have leveled the shared QA character, spent mana, and altered
// its stats. Establish the same canonical level-100 starting fixture every time,
// before entry; never restore resources between fights or on an earned route.
export async function initializePreparedDungeonFixture(page) {
    const read = () => page.evaluate(() => {
        const p = window.game.player;
        return { level: p.level, hp: p.stats.hp, maxHP: p.stats.maxHp,
            mana: p.stats.mana, maxMana: p.stats.maxMana };
    });
    const before = await read();
    await page.evaluate(() => {
        const game = window.game, original = game.handleServerMessage;
        window.__preparedLevelAck = { received: false, restore: () => { game.handleServerMessage = original; } };
        game.handleServerMessage = function (message) {
            if (message.type === 'chat' && message.payload?.sender === 'System' &&
                message.payload?.message === 'Level set to 100.') window.__preparedLevelAck.received = true;
            return original.call(this, message);
        };
    });
    await page.locator('#chat-tab-chat').click();
    const chat = page.locator('#chat-input');
    await chat.click();
    await chat.fill('/level 100');
    await chat.press('Enter');
    await expect.poll(() => page.evaluate(() => window.__preparedLevelAck.received)).toBe(true);
    await expect.poll(async () => {
        const state = await read();
        return state.level === 100 && state.hp === state.maxHP && state.mana === state.maxMana;
    }).toBe(true);
    const after = await read();
    await page.evaluate(() => { window.__preparedLevelAck.restore(); delete window.__preparedLevelAck; });
    console.log('[prepared-dungeon-fixture]', JSON.stringify({ before, after,
        note: 'Explicit QA setup before entry; not earned progression or an in-run refill.' }));
}
