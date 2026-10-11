import { createGoldProvenanceObserver } from '../scripts/gold-provenance-observer.mjs';

test('retains only owned numeric economy and hashes identifiers without changing source packets', () => {
    const observer = createGoldProvenanceObserver('player-private-owner');
    const packet = { full: { entities: [{ id: 'player-other', gold: 888, inventory: [{ id: 'other-secret' }] },
        { id: 'player-private-owner', name: 'private-owner', gold: 1000, inventory: [{ id: 'item-private-password', name: 'private-password', value: 3, stack: 1 }] }] } };
    const original = JSON.stringify(packet);
    observer.observeEnvelope(packet);
    observer.observeJSON('outgoing', { type: 'login', payload: { username: 'private-owner', password: 'private-password' } });
    observer.observeJSON('incoming', { type: 'ep_wallet_result', payload: { playerID: 'player-other', gold: 888 } });
    expect(JSON.stringify(packet)).toBe(original);
    const snapshot = observer.snapshot();
    expect(snapshot.records).toHaveLength(1);
    expect(snapshot.records[0].gold).toBe(1000);
    expect(snapshot.records[0].inventory).toEqual([{ idHash: expect.stringMatching(/^[a-f0-9]{64}$/), value: 3, stack: 1 }]);
    for (const secret of ['private-owner', 'private-password', 'player-other', 'other-secret']) expect(JSON.stringify(snapshot)).not.toContain(secret);
});

test('preserves Gold rollback and sale/earned-room ordering while deduplicating unchanged state', () => {
    const observer = createGoldProvenanceObserver('owner');
    const state = gold => ({ delta: { entities: [{ id: 'owner', gold }] } });
    observer.observeEnvelope(state(1000)); observer.observeEnvelope(state(1000));
    observer.observeJSON('outgoing', { type: 'sell', payload: { itemId: 'spare', slotIndex: 2 } });
    observer.observeClient('sale_plan', { itemId: 'spare', expectedGold: 1003 });
    observer.observeJSON('incoming', { type: 'room_clear_reward', payload: { gold: 175, roomIndex: 1 } });
    observer.observeEnvelope(state(1178)); observer.observeEnvelope(state(1000));
    expect(observer.snapshot().records.map(record => record.type)).toEqual(['delta', 'sell', 'sale_plan', 'room_clear_reward', 'delta', 'delta']);
    expect(observer.snapshot().records.filter(record => record.type === 'delta').map(record => record.gold)).toEqual([1000, 1178, 1000]);
});

test('never stores arbitrary control type/reason text or unsafe numeric balances', () => {
    const observer = createGoldProvenanceObserver('owner');
    observer.observeJSON('incoming', { type: 'private-password', payload: { gold: 12, ep: Number.MAX_SAFE_INTEGER + 1, token: 'private-token' } });
    observer.observeJSON('incoming', { type: 'error', payload: { message: 'private-password vendor save pending' } });
    const snapshot = observer.snapshot();
    expect(snapshot.records[0]).toMatchObject({ type: 'other_balance_control', gold: 12 });
    expect(snapshot.records[0].ep).toBeUndefined();
    expect(snapshot.records[1].categories).toEqual(['vendor', 'save', 'pending']);
    expect(JSON.stringify(snapshot)).not.toContain('private-password');
    expect(JSON.stringify(snapshot)).not.toContain('private-token');
});

test('marks incomplete evidence explicitly at its bound and returns detached snapshots', () => {
    const observer = createGoldProvenanceObserver('owner', 1);
    observer.observeClient('gold_poll', 1000); observer.observeClient('gold_poll', 1001);
    const snapshot = observer.snapshot();
    expect(snapshot).toMatchObject({ totalObserved: 2, dropped: 1, complete: false });
    snapshot.records[0].gold = 0;
    expect(observer.snapshot().records[0].gold).toBe(1000);
});
