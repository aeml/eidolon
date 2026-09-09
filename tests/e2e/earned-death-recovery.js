import { expect } from '@playwright/test';
import { returnToTown } from './helpers.js';

// Observe an ordinary death-button response on the wire. A predicted local
// refill alone is insufficient evidence of authoritative recovery.
export async function recoverEarnedDeath(page) {
    await page.evaluate(() => {
        const game = window.game, original = game.handleServerMessage;
        window.__earnedRecovery = { receipt: null, original };
        game.handleServerMessage = function(message) {
            const updates = message.type === 'state' ? message.payload :
                message.type === 'delta' ? message.payload?.u : null;
            const player = updates?.[game.player.id];
            if (player && player.state !== 'DEAD' && player.health > 0 &&
                player.mana !== undefined && player.mana === (player.maxMana ?? game.player.stats.maxMana)) {
                window.__earnedRecovery.receipt = { hp: player.health,
                    maxHP: player.maxHealth ?? game.player.stats.maxHp, mana: player.mana,
                    maxMana: player.maxMana ?? game.player.stats.maxMana };
            }
            return original.call(this, message);
        };
    });
    try {
        await returnToTown(page);
        await expect.poll(() => page.evaluate(() => Boolean(window.__earnedRecovery.receipt)), {
            message: 'ordinary death recovery must receive full mana from the server'
        }).toBe(true);
        const receipt = await page.evaluate(() => window.__earnedRecovery.receipt);
        expect(receipt.hp).toBe(receipt.maxHP);
        expect(receipt.mana).toBe(receipt.maxMana);
        console.log(`[earned-death-recovery] ${JSON.stringify(receipt)}`);
    } finally {
        await page.evaluate(() => {
            window.game.handleServerMessage = window.__earnedRecovery.original;
            delete window.__earnedRecovery;
        });
    }
}
