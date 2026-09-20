import { runInNewContext } from 'node:vm';
import { earnedEarthCheckpoints, earnedEarthTransferScript, restoreEarnedEarthCheckpoint } from './earnedEarthCheckpoint.js';

function exercise(change = () => {}, occupied = false, checkpoint = earnedEarthCheckpoints[0]) {
    const character = { name: 'old-account', class: 'Wizard', level: 30, xp: 7170, gold: 8539,
        inventory: [{ id: 'earned-drop', stats: { wisdom: 3 } }], stash: [{ id: 'saved-drop' }],
        resources: { hp: 31, mana: 0 }, last_logout: '2026-09-14T05:58:33Z',
        quests: [{ id: 'chronicle_earth_borrowed_oath', accepted: true, completed: false, count: 46, max_count: 50 }] };
    change(character);
    const original = JSON.stringify(character);
    let saved = occupied ? { inventory: [{ id: 'existing-player-item' }] } : null, writes = 0;
    const context = { process: { env: {} }, print() {}, EJSON: JSON,
        db: { getSiblingDB(name) {
            if (name === 'admin') return { auth: () => true };
            if (name === 'earned_checkpoint') return { users: { find: filter => {
                expect(filter).toEqual({ 'characters.class': 'Wizard' });
                return { limit: () => ({ toArray: () => [{ characters: [character] }] }) };
            } } };
            if (name !== 'eidolon') throw new Error('Unexpected database');
            return { users: {
                updateOne(filter, update) {
                    expect(filter).toEqual({ username: 'codexqaresume', 'characters.0': { $exists: false } });
                    if (saved) return { matchedCount: 0, modifiedCount: 0 };
                    writes++; saved = JSON.parse(JSON.stringify(update.$set.characters[0]));
                    return { matchedCount: 1, modifiedCount: 1 };
                }, findOne: () => ({ characters: [saved] })
            } };
        } } };
    const run = () => runInNewContext(earnedEarthTransferScript('codexqaresume', checkpoint), context);
    return { run, original, result: () => ({ saved, writes }) };
}

test('copies the entire earned character without reconstructing inventory, resources or logout time', () => {
    const fixture = exercise();
    fixture.run();
    expect(fixture.result().saved).toEqual({ ...JSON.parse(fixture.original), name: 'codexqaresume' });
    expect(fixture.result().writes).toBe(1);
});

test('continues the actually saved level31 handoff without reconstructing or repeating its rewards', () => {
    const checkpoint = earnedEarthCheckpoints[1];
    const fixture = exercise(character => {
        Object.assign(character, { level: checkpoint.level, xp: checkpoint.xp, gold: checkpoint.gold });
        Object.assign(character.quests[0], { count: 50, completed: true });
        character.quests.push({ id: 'chronicle_03_roots_remember', accepted: true, completed: false, count: 0 });
    }, false, checkpoint);
    fixture.run();
    expect(fixture.result().saved).toEqual({ ...JSON.parse(fixture.original), name: 'codexqaresume' });
    expect(fixture.result().writes).toBe(1);
});

test.each([
    p => { p.level = 31; }, p => { p.xp++; }, p => { p.gold++; },
    p => { p.quests[0].count = 50; }, p => { p.quests[0].completed = true; },
    p => { p.quests.push({ id: 'daily_skeleton', accepted: true }); }
])('refuses changed progression before any write', change => {
    const fixture = exercise(change);
    expect(fixture.run).toThrow('Unexpected earned progress');
    expect(fixture.result().writes).toBe(0);
});

test('does not overwrite an existing character', () => {
    const fixture = exercise(() => {}, true);
    expect(fixture.run).toThrow('Requires a new empty account');
    expect(fixture.result().saved.inventory[0].id).toBe('existing-player-item');
    expect(fixture.result().writes).toBe(0);
});

test('refuses public endpoints, ordinary accounts and implicit restoration', () => {
    expect(() => earnedEarthTransferScript('ordinary-player')).toThrow('Disposable account');
    expect(() => restoreEarnedEarthCheckpoint('codexqaresume', {})).toThrow('isolated local QA');
    expect(() => restoreEarnedEarthCheckpoint('codexqaresume', {
        EIDOLON_E2E_EARNED_RESUME: '1', EIDOLON_E2E_REGISTER: '1',
        EIDOLON_E2E_BUILD_MONGO_CONTAINER: 'eidolon-isolated-qa-mongo-test',
        EIDOLON_E2E_BUILD_MONGO_PORT: '27017',
        EIDOLON_E2E_WS_URL: 'wss://server.eidolonrealms.com/ws',
        EIDOLON_E2E_EARNED_CHECKPOINT: '/tmp/eidolon-private/archive.gz'
    })).toThrow('isolated local QA');
});
