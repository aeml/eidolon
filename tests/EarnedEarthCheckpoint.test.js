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

function postVerdant(character) {
    Object.assign(character, { level: 33, xp: 23108, gold: 10598 });
    Object.assign(character.quests[0], { count: 50, completed: true });
    character.quests.push({ id: 'chronicle_03_roots_remember', accepted: true, completed: true, count: 1 },
        { id: 'chronicle_water_missing_ferry', accepted: false, completed: false, count: 0 });
}

test('continues the full saved post-Verdant character without replaying the accepted dungeon', () => {
    const fixture = exercise(postVerdant, false, earnedEarthCheckpoints[2]);
    fixture.run();
    expect(fixture.result().saved).toEqual({ ...JSON.parse(fixture.original), name: 'codexqaresume' });
    expect(fixture.result().writes).toBe(1);
});

function partialWater(character) {
    postVerdant(character);
    Object.assign(character, { level: 42, xp: 32261, gold: 25427 });
    Object.assign(character.quests[2], { accepted: true, count: 58, max_count: 60 });
}

test('continues the actual saved 58 Water kills without repeating or claiming them', () => {
    const fixture = exercise(partialWater, false, earnedEarthCheckpoints[3]);
    fixture.run();
    expect(fixture.result().saved).toEqual({ ...JSON.parse(fixture.original), name: 'codexqaresume' });
    expect(fixture.result().writes).toBe(1);
});

function completedFerry(character) {
    partialWater(character);
    Object.assign(character, { level: 43, xp: 35906, gold: 27416 });
    Object.assign(character.quests[2], { completed: true, count: 60, granted_gold: 400, granted_xp: 28593 });
    character.quests.push({ id: 'chronicle_water_flood_shelter', accepted: false, completed: false, count: 0 });
}

test('continues the saved level43 manual reward and fresh investigation without replaying Missing Ferry', () => {
    const fixture = exercise(completedFerry, false, earnedEarthCheckpoints[4]);
    fixture.run();
    expect(fixture.result().saved).toEqual({ ...JSON.parse(fixture.original), name: 'codexqaresume' });
    expect(fixture.result().writes).toBe(1);
});

function partialWaterRegion(character) {
    completedFerry(character);
    const checkpoint = earnedEarthCheckpoints[5];
    Object.assign(character, { level: checkpoint.level, xp: checkpoint.xp, gold: checkpoint.gold });
    character.quests.pop();
    character.quests.push(...checkpoint.waterChapters.map(q => ({ ...q })));
}

test('retains the actual level61 Water chapters, rewards and 25 earned Golem kills', () => {
    const fixture = exercise(partialWaterRegion, false, earnedEarthCheckpoints[5]);
    fixture.run();
    expect(fixture.result().saved).toEqual({ ...JSON.parse(fixture.original), name: 'codexqaresume' });
    expect(fixture.result().writes).toBe(1);
});

test('retains the actual level62 Water save and 28 earned Golem kills after recovery', () => {
    const checkpoint = earnedEarthCheckpoints[6];
    const fixture = exercise(character => {
        partialWaterRegion(character);
        Object.assign(character, { level: checkpoint.level, xp: checkpoint.xp, gold: checkpoint.gold });
        character.quests.at(-1).count = 28;
    }, false, checkpoint);
    fixture.run();
    expect(fixture.result().saved).toEqual({ ...JSON.parse(fixture.original), name: 'codexqaresume' });
    expect(fixture.result().writes).toBe(1);
});

test('retains all 31 earned Golem kills and the actual dead resource snapshot', () => {
    const checkpoint = earnedEarthCheckpoints[7];
    const fixture = exercise(character => {
        partialWaterRegion(character);
        Object.assign(character, { level: checkpoint.level, xp: checkpoint.xp, gold: checkpoint.gold,
            resources: { ...checkpoint.resources } });
        character.quests.at(-1).count = 31;
    }, false, checkpoint);
    fixture.run();
    expect(fixture.result().saved).toEqual({ ...JSON.parse(fixture.original), name: 'codexqaresume' });
    expect(fixture.result().saved.resources).toEqual({ version: 1, health: 0, mana: 2005, dead: true });
});

test('a healed replacement cannot masquerade as the pinned dead save', () => {
    const fixture = exercise(() => {}, false, earnedEarthCheckpoints[7]);
    expect(fixture.run).toThrow('Unexpected earned saved resources');
    expect(fixture.result().writes).toBe(0);
});

test('retains the actual level80 gem-heavy save with 61 kills and no claimed hunt reward', () => {
    const checkpoint = earnedEarthCheckpoints[8];
    const fixture = exercise(character => {
        partialWaterRegion(character);
        Object.assign(character, { level: checkpoint.level, xp: checkpoint.xp, gold: checkpoint.gold,
            resources: { ...checkpoint.resources } });
        character.quests.at(-1).count = 61;
        character.inventory.push({ id: 'gem-earned', name: 'Chipped Diamond', type: 'GEM', stack: 2, maxStack: 99 });
    }, false, checkpoint);
    fixture.run();
    expect(fixture.result().saved).toEqual({ ...JSON.parse(fixture.original), name: 'codexqaresume' });
    expect(fixture.result().saved.quests.at(-1)).toMatchObject({ count: 61, completed: false, granted_gold: 0, granted_xp: 0 });
});

test.each([
    p => { p.quests.at(-1).count++; }, p => { p.quests.at(-1).completed = true; },
    p => { p.quests.at(-1).granted_gold = 600; }, p => { p.quests[3].granted_xp++; },
    p => { p.quests[4].accepted = false; }, p => { p.quests[5].max_count++; },
    p => { p.quests.pop(); }, p => { p.quests.push({ ...p.quests[3] }); },
    p => { p.quests.push({ id: 'chronicle_05_drowned_name', accepted: false }); }
])('refuses altered Water continuation state before copying', change => {
    const fixture = exercise(p => { partialWaterRegion(p); change(p); }, false, earnedEarthCheckpoints[5]);
    expect(fixture.run).toThrow(/earned Water/);
    expect(fixture.result().writes).toBe(0);
});

test.each([
    p => { p.quests[2].granted_gold = 0; }, p => { p.quests[2].granted_xp++; },
    p => { p.quests[3].accepted = true; }, p => { p.quests[3].completed = true; },
    p => { p.quests[3].count = 1; }, p => { p.quests.pop(); }
])('rejects altered claimed reward or investigation handoff', change => {
    const fixture = exercise(character => { completedFerry(character); change(character); }, false, earnedEarthCheckpoints[4]);
    expect(fixture.run).toThrow('Unexpected earned Water reward or next chapter');
    expect(fixture.result().writes).toBe(0);
});

test.each([
    p => { p.quests[2].count = 60; }, p => { p.quests[2].completed = true; },
    p => { p.quests[2].accepted = false; }, p => { p.quests[2].max_count = 58; },
    p => { p.quests[2].granted_gold = 400; }, p => { p.quests[2].granted_xp = 28593; },
    p => { p.quests.push({ id: 'chronicle_water_flood_shelter', accepted: false }); }
])('refuses altered partial Water credit, premature reward or investigation access', change => {
    const fixture = exercise(character => { partialWater(character); change(character); }, false, earnedEarthCheckpoints[3]);
    expect(fixture.run).toThrow(/Unexpected earned Water/);
    expect(fixture.result().writes).toBe(0);
});

test.each([
    p => { p.quests[1].completed = false; }, p => { p.quests[1].count = 0; },
    p => { p.quests[2].accepted = true; }, p => { p.quests[2].completed = true; },
    p => { p.quests[2].count = 1; }, p => { p.quests.pop(); }
])('rejects altered post-dungeon/Water progress before copying', change => {
    const fixture = exercise(character => { postVerdant(character); change(character); }, false, earnedEarthCheckpoints[2]);
    expect(fixture.run).toThrow('Unexpected earned Water handoff');
    expect(fixture.result().writes).toBe(0);
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
