import { jest } from '@jest/globals';
import { observePartyCombatHealth, partyCombatHealthSnapshot } from './partyCombatHealth.js';

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
