import { createHash } from 'node:crypto';

const transactionTypes = new Set(['sell', 'stash_deposit', 'stash_withdraw', 'buyback', 'exchange_gold_for_ep', 'auction_bid', 'pickup']);
const balanceTypes = new Set(['ep_wallet_result', 'room_clear_reward', 'reward_summary', 'loadout_result', 'auction_bid_result']);
const digest = value => typeof value === 'string' && value ? createHash('sha256').update(value).digest('hex') : undefined;
const integer = value => value !== null && value !== undefined && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
const items = value => Array.isArray(value) ? value.filter(item => item?.id).map(item => ({
    idHash: digest(item.id), value: integer(item.value), stack: integer(item.stack)
})) : undefined;

// This observer never returns raw player/item identifiers, credentials, chat,
// command text or packet bodies. It only records the selected owner's economy.
export function createGoldProvenanceObserver(ownerID, limit = 8192) {
    if (typeof ownerID !== 'string' || !ownerID || !Number.isSafeInteger(limit) || limit < 1) throw Error('Invalid observer bounds');
    const records = [];
    let sequence = 0, dropped = 0, previousState;
    const append = event => {
        if (records.length === limit) { dropped++; return; }
        records.push({ sequence, atMs: performance.now(), ...event });
    };
    return {
        observeJSON(direction, message) {
            sequence++;
            const type = message?.type, payload = message?.payload;
            if (direction === 'outgoing') {
                if (transactionTypes.has(type)) append({ source: 'wire', direction, type,
                    itemHash: digest(payload?.itemId || payload?.lootId), slotIndex: integer(payload?.slotIndex), amount: integer(payload?.amount) });
                if (type === 'get_ep_wallet') append({ source: 'wire', direction, type, readIDHash: digest(payload?.readID) });
                return;
            }
            if (direction !== 'incoming' || (payload?.playerID && payload.playerID !== ownerID)) return;
            if (['inventory', 'stash', 'buyback_list'].includes(type)) {
                append({ source: 'wire', direction, type, items: items(payload) }); return;
            }
            if (integer(payload?.gold) !== undefined) append({ source: 'wire', direction,
                type: balanceTypes.has(type) ? type : 'other_balance_control', typeHash: balanceTypes.has(type) ? undefined : digest(type),
                gold: integer(payload.gold), ep: integer(payload.ep), roomIndex: integer(payload.roomIndex),
                readIDHash: digest(payload.readID), success: payload.success === true, pending: payload.pending === true });
            if (type === 'error') {
                const reason = typeof payload?.message === 'string' ? payload.message : typeof payload === 'string' ? payload : '';
                append({ source: 'wire', direction, type, reasonHash: digest(reason),
                    categories: ['vendor', 'save', 'pending', 'stash', 'gold', 'wallet', 'item', 'balance'].filter(word => reason.toLowerCase().includes(word)) });
            }
        },
        observeEnvelope(envelope) {
            sequence++;
            const entity = (envelope?.full?.entities || envelope?.delta?.entities || []).find(entry => entry.id === ownerID);
            if (!entity) return;
            const selected = { gold: integer(entity.gold), inventory: items(entity.inventory) };
            const signature = JSON.stringify(selected);
            if (signature === previousState) return;
            previousState = signature;
            append({ source: 'wire', direction: 'incoming', type: envelope.full ? 'state' : 'delta',
                serverTimeMs: integer(envelope.serverTimeMs), ...selected });
        },
        observeClient(classification, value) {
            sequence++;
            if (classification === 'sale_plan' && value?.expectedGold !== undefined) append({ source: 'client_read', type: classification,
                expectedGold: integer(value.expectedGold), itemHash: digest(value.itemId) });
            if (classification === 'gold_poll' && integer(value) !== undefined) append({ source: 'client_read', type: classification, gold: integer(value) });
            if (classification === 'wallet_baseline' && value) append({ source: 'client_read', type: classification, gold: integer(value.gold), ep: integer(value.ep) });
            if (classification === 'custody_snapshot' && value) append({ source: 'client_read', type: classification,
                gold: integer(value.gold), inventory: items(value.inventory), stash: items(value.stash) });
        },
        snapshot() { return JSON.parse(JSON.stringify({ records, totalObserved: sequence, dropped, complete: dropped === 0 })); }
    };
}
