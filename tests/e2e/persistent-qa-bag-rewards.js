import { expect } from '@playwright/test';

// Test observation only. A full bag retains the complete room award; making
// space can deliver it after a correctly synchronized wallet baseline.
export async function beginPersistentQABagRewards(page) {
    return page.evaluate(() => {
        const game = window.game, player = game?.player;
        if (!player?.id || typeof game.handleServerMessage !== 'function' || game.__qaBagRewards) {
            throw new Error('QA bag reward observation needs one connected owner');
        }
        const original = game.handleServerMessage;
        const observation = { playerID: player.id, gold: player.gold, credits: [], seen: new Set(), error: null };
        const observe = function (message) {
            const handled = original.call(this, message);
            const reward = message?.payload;
            if (message?.type === 'room_clear_reward' && reward?.playerId === observation.playerID) {
                const key = `${reward.instanceType}:${reward.roomIndex}`;
                if (!Number.isSafeInteger(reward.gold) || reward.gold < 0 ||
                    !Number.isSafeInteger(reward.roomIndex) || reward.roomIndex < 0 ||
                    typeof reward.instanceType !== 'string' || !reward.instanceType || observation.seen.has(key)) {
                    observation.error = 'Invalid or repeated room reward at the QA bag boundary';
                } else {
                    observation.seen.add(key);
                    observation.credits.push({ gold: reward.gold, roomIndex: reward.roomIndex, instanceType: reward.instanceType });
                }
            }
            return handled;
        };
        observation.original = original;
        observation.observe = observe;
        game.__qaBagRewards = observation;
        game.handleServerMessage = observe;
        // The snapshot and observer start are atomic with respect to incoming
        // messages. No credit can be counted in both this baseline and ledger.
        return { gold: player.gold, ep: player.ep, inventory: player.inventory,
            stash: player.stash, equipment: player.equipment };
    });
}

export async function waitForPersistentQABagGold(page, transactionCredit) {
    if (!Number.isSafeInteger(transactionCredit) || transactionCredit < 0) throw new Error('Invalid exact QA transaction credit');
    let receipt;
    await expect.poll(async () => {
        receipt = await page.evaluate(credit => {
            const game = window.game, observation = game?.__qaBagRewards, player = game?.player;
            if (!observation || player?.id !== observation.playerID || game.handleServerMessage !== observation.observe) {
                throw new Error('QA bag reward observation changed owner');
            }
            if (observation.error) throw new Error(observation.error);
            const expectedGold = observation.gold + credit + observation.credits.reduce((sum, reward) => sum + reward.gold, 0);
            if (![expectedGold, player.gold].every(Number.isSafeInteger) || observation.gold < 0 || player.gold < 0) {
                throw new Error('Invalid exact QA Gold balance');
            }
            return { difference: player.gold - expectedGold, expectedGold, credits: observation.credits,
                after: { gold: player.gold, ep: player.ep, inventory: player.inventory,
                    stash: player.stash, equipment: player.equipment } };
        }, transactionCredit);
        return receipt.difference;
    }, { timeout: 15_000, message: 'Gold must equal the exact bag transaction plus separately observed earned room credits' }).toBe(0);
    return receipt;
}

export async function endPersistentQABagRewards(page) {
    await page.evaluate(() => {
        const game = window.game, observation = game?.__qaBagRewards;
        if (!observation) return;
        if (game.handleServerMessage !== observation.observe) throw new Error('QA bag reward observer lost ownership');
        game.handleServerMessage = observation.original;
        delete game.__qaBagRewards;
    });
}
