import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';

const walletRequests = new WeakMap();

async function reserveWalletRead(page) {
    const requests = walletRequests.get(page) || [];
    walletRequests.set(page, requests);
    // Match the existing server allowance: five wallet reads in ten seconds.
    // This is rate-limit pacing, not a timed assumption that Gold has settled.
    while (true) {
        const now = performance.now();
        while (requests.length && !requests[0].pending && now - requests[0].time >= 10_100) requests.shift();
        if (requests.length < 5) {
            const reservation = { time: now, pending: true };
            requests.push(reservation); return reservation;
        }
        await new Promise(resolve => setTimeout(resolve, Math.max(1, requests[0].pending ? 100 : requests[0].time + 10_100 - now)));
    }
}

export async function waitForPersistentQAGoldBaseline(page) {
    const reservation = await reserveWalletRead(page);
    let receipt;
    try {
        receipt = await page.evaluate(requestID => {
            const game = window.game;
            if (!game?.player?.id || typeof game.handleServerMessage !== 'function' ||
                typeof game.network?.send !== 'function') throw new Error('QA wallet baseline needs a connected character');
            const playerID = game.player.id;
            return new Promise((resolve, reject) => {
                const original = game.handleServerMessage;
                let settled = false;
                const cleanup = () => {
                    clearTimeout(timer);
                    if (game.handleServerMessage === observe) game.handleServerMessage = original;
                };
                const finish = (error, value) => {
                    if (settled) return;
                    settled = true; cleanup();
                    if (error) reject(error); else resolve(value);
                };
                const observe = function (message) {
                    const handled = original.call(this, message);
                    const reply = message?.payload;
                    if (message?.type === 'ep_wallet_result' && reply?.readID === requestID && reply.playerID === playerID) {
                        if (window.game !== game || game.player?.id !== playerID || !reply.success || reply.pending ||
                            !Number.isSafeInteger(reply.gold) || reply.gold < 0 || !Number.isSafeInteger(reply.ep) || reply.ep < 0) {
                            finish(new Error('QA wallet baseline was rejected, changed owner or returned invalid balances'));
                        } else finish(null, { gold: reply.gold, ep: reply.ep });
                    }
                    return handled;
                };
                const timer = setTimeout(() => finish(new Error('Correlated QA wallet baseline did not arrive')), 15_000);
                game.handleServerMessage = observe;
                try {
                    if (!game.network.send('get_ep_wallet', { readID: requestID })) finish(new Error('QA wallet read was not sent'));
                } catch (error) { finish(error); }
            });
        }, randomUUID());
    } finally {
        // Response completion follows server handling, so latency variation
        // cannot move the next burst inside the server's rolling window.
        reservation.pending = false; reservation.time = performance.now();
    }
    // Never assign a balance or drain packets ourselves. Ordinary state
    // replication must reach the exact correlated server snapshot first.
    await expect.poll(() => page.evaluate(() => window.game?.player?.gold), {
        timeout: 15_000, message: 'Replicated Gold must match the fresh authoritative wallet baseline'
    }).toBe(receipt.gold);
    return receipt;
}
