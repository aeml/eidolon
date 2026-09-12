import { jest } from '@jest/globals';
import { runPartyRoleInputs } from './partyRoleScheduling.js';

const roles = ['Fighter', 'Cleric', 'Wizard', 'Rogue'];
const safe = { allowCasts: true, allowApproach: false };
const escaping = { allowCasts: false, allowApproach: false };
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

test.each(['Fighter', 'Rogue'])('safe healer acts while %s still executes its escape input', async slowRole => {
    const escape = deferred(), act = jest.fn();
    const avoid = jest.fn(role => role === slowRole ? escape.promise : Promise.resolve(safe));
    let completed = false;
    const round = runPartyRoleInputs(roles, avoid, act).then(result => { completed = true; return result; });
    await flush();
    const actedBeforeEscape = act.mock.calls.map(([role]) => role);
    const finishedBeforeEscape = completed;
    escape.resolve(escaping);
    const policies = await round;
    expect(actedBeforeEscape).toContain('Cleric');
    expect(actedBeforeEscape).toContain('Wizard');
    expect(actedBeforeEscape).not.toContain(slowRole);
    expect(finishedBeforeEscape).toBe(false);
    expect(policies[roles.indexOf(slowRole)]).toBe(escaping);
    expect(act.mock.calls.some(([role]) => role === slowRole)).toBe(false);
});

test('each actor must finish its own safety decision before acting and retains its policy', async () => {
    const decision = deferred(), act = jest.fn();
    const round = runPartyRoleInputs(['Cleric'], () => decision.promise, act);
    await flush(); expect(act).not.toHaveBeenCalled();
    decision.resolve(safe);
    expect(await round).toEqual([safe]);
    expect(act).toHaveBeenCalledWith('Cleric', safe);
});

test('the round joins outstanding role inputs before returning', async () => {
    const input = deferred(); let completed = false;
    const round = runPartyRoleInputs(roles, () => safe,
        role => role === 'Cleric' ? input.promise : undefined).then(() => { completed = true; });
    await flush(); expect(completed).toBe(false);
    input.resolve(); await round; expect(completed).toBe(true);
});

test.each(['decision', 'input'])('a failed %s still joins other active roles and propagates the original error', async stage => {
    const input = deferred(), failure = new Error('real input failed');
    let completed = false;
    const round = runPartyRoleInputs(roles,
        role => { if (stage === 'decision' && role === 'Rogue') throw failure; return safe; },
        role => {
            if (role === 'Cleric') return input.promise;
            if (stage === 'input' && role === 'Rogue') throw failure;
        }).catch(error => { completed = true; return error; });
    await flush(); const finishedBeforeJoin = completed;
    input.resolve();
    expect(await round).toBe(failure);
    expect(finishedBeforeJoin).toBe(false);
});
