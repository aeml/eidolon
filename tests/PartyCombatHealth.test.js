import { jest } from '@jest/globals';
import { observePartyCombatHealth, partyCombatHealthSnapshot, partyRoleSnapshot } from './partyCombatHealth.js';

test('healing and formation reads exclude accumulated diagnostic history', () => {
    const game = { currentInstanceId: 'run', player: { id: 'rogue', state: 'IDLE',
        position: { x: 3, z: 4 }, stats: { hp: 1102, maxHp: 3075, mana: 12, maxMana: 100 } } };
    Object.defineProperty(game.player, 'quests', { get() { throw new Error('not a hot-path field'); } });
    Object.defineProperty(game, '__partyClearEvidence', { get() { throw new Error('never copy combat history'); } });
    expect(partyRoleSnapshot(game)).toEqual({ id: 'rogue', instance: 'run', x: 3, z: 4,
        hp: 1102, maxHP: 3075, mana: 12, maxMana: 100, dead: false });
    game.player.state = 'DEAD';
    expect(partyRoleSnapshot(game).dead).toBe(true);
});

test('compact observations retain death history and browser-clock update age', () => {
    const game = { player: { state: 'IDLE' } };
    const evidence = { sawDeath: true, lastUpdate: 150, combatReceipts: ['large detail'] };
    expect(partyCombatHealthSnapshot(game, evidence, 200)).toEqual({ dead: false, sawDeath: true, updateAge: 50 });
    expect(partyCombatHealthSnapshot({ player: { state: 'DEAD' } }, { lastUpdate: 1 }, 3).dead).toBe(true);
    expect(partyCombatHealthSnapshot(game, {}, 200).updateAge).toBe(Infinity);
});

test('all browser observations start together and results retain party order', async () => {
    let finishTank;
    const tank = new Promise(resolve => { finishTank = resolve; });
    const read = jest.fn(role => role === 'tank' ? tank : Promise.resolve(role));
    const result = observePartyCombatHealth(['tank', 'healer', 'wizard', 'rogue'], read);
    expect(read.mock.calls.map(([role]) => role)).toEqual(['tank', 'healer', 'wizard', 'rogue']);
    finishTank('tank');
    expect(await result).toEqual(['tank', 'healer', 'wizard', 'rogue']);
});

test('failed observations join outstanding work then propagate the original failure', async () => {
    let finishTank, finished = false;
    const tank = new Promise(resolve => { finishTank = resolve; });
    const error = new Error('browser unavailable');
    const result = observePartyCombatHealth(['tank', 'healer'], role => {
        if (role === 'healer') throw error;
        return tank;
    }).catch(failure => { finished = true; return failure; });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(finished).toBe(false);
    finishTank('tank');
    expect(await result).toBe(error);
});
