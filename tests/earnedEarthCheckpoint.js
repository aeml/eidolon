import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export const earnedEarthCheckpointSHA = 'be0c40ad5c8ff6cc42cb2dbb42e23bb07ad721814959f3f8e518b21ecaeb765c';
export const earnedEarthCheckpoints = Object.freeze([
    { sha: earnedEarthCheckpointSHA, level: 30, xp: 7170, gold: 8539, count: 46, completed: false },
    { sha: 'c3cca5c86852d354fc13b3e8f4c48513c5ff083153608866a45c5afdb358c673',
        level: 31, xp: 12448, gold: 9047, count: 50, completed: true },
    { sha: '8b075ebdac1f5fea3b7849927dfd3679b6b2e70d3dfb1dd908961dbc9c31e741',
        level: 33, xp: 23108, gold: 10598, count: 50, completed: true, waterOffered: true },
    { sha: 'c65ddaee9a989f47289b9db2fbc98842746871d5fea84df2e1dd1248382b45a1',
        level: 42, xp: 32261, gold: 25427, count: 50, completed: true,
        waterProgress: { accepted: true, completed: false, count: 58 } }
]);

// These are full private earned saves, not build-only JSON fixtures.
// Import gameplay state into a NEW disposable account, remapping only its name
// to that account's save key. Never copy credentials,
// change logout timestamps, fill missing inventory or synthesize later progress.
export function earnedEarthTransferScript(username, checkpoint = earnedEarthCheckpoints[0]) {
    if (!/^codexqa[a-z0-9-]+$/.test(username || '')) throw new Error('Disposable account required');
    if (!earnedEarthCheckpoints.includes(checkpoint)) throw new Error('Known earned checkpoint required');
    return `
        if (!db.getSiblingDB('admin').auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) throw Error('Checkpoint auth failed');
        const users = db.getSiblingDB('earned_checkpoint').users.find({'characters.class':'Wizard'}).limit(2).toArray();
        if (users.length !== 1 || users[0].characters?.length !== 1) throw Error('Ambiguous checkpoint');
        const character = users[0].characters[0];
        const quest = character.quests.find(q => q.id === 'chronicle_earth_borrowed_oath');
        if (character.class !== 'Wizard' || character.level !== ${checkpoint.level} || character.xp !== ${checkpoint.xp} || character.gold !== ${checkpoint.gold} ||
            !quest?.accepted || Boolean(quest.completed) !== ${checkpoint.completed} || quest.count !== ${checkpoint.count} || quest.max_count !== 50 ||
            character.quests.some(q => q.id.startsWith('daily_') && (q.accepted || q.completed))) throw Error('Unexpected earned progress');
        if (${checkpoint.waterOffered === true || Boolean(checkpoint.waterProgress)}) {
            const dungeon = character.quests.find(q => q.id === 'chronicle_03_roots_remember');
            const water = character.quests.find(q => q.id === 'chronicle_water_missing_ferry');
            const expected = ${JSON.stringify(checkpoint.waterProgress || { accepted: false, completed: false, count: 0 })};
            if (!dungeon?.completed || dungeon.count !== 1 || !water || water.accepted !== expected.accepted ||
                water.completed !== expected.completed || water.count !== expected.count)
                throw Error('Unexpected earned Water handoff');
            if (${Boolean(checkpoint.waterProgress)} && (water.max_count !== 60 ||
                (!expected.completed && ((water.granted_gold || 0) !== 0 || (water.granted_xp || 0) !== 0 ||
                    character.quests.some(q => q.id === 'chronicle_water_flood_shelter')))))
                throw Error('Unexpected earned Water reward or next chapter');
        }
        character.name = ${JSON.stringify(username)};
        const target = db.getSiblingDB('eidolon').users;
        const result = target.updateOne({ username: ${JSON.stringify(username)}, 'characters.0': { $exists: false } },
            { $set: { characters: [character] } });
        if (result.matchedCount !== 1 || result.modifiedCount !== 1) throw Error('Requires a new empty account');
        const saved = target.findOne({ username: ${JSON.stringify(username)} }).characters[0];
        if (EJSON.stringify(saved) !== EJSON.stringify(character)) throw Error('Character changed during transfer');
        print('Earned gameplay state transferred with new account save key: Wizard level${checkpoint.level}, XP${checkpoint.xp}, Gold${checkpoint.gold}, Orc${checkpoint.count}/50.');
    `;
}

export function readSavedEarnedHandoff(username, env = process.env, { includeQuests = false } = {}) {
    if (env.EIDOLON_E2E_EARNED_RESUME !== '1' || !/^codexqa[a-z0-9-]+$/.test(username || '') ||
        !/^eidolon-isolated-qa-mongo-[a-z0-9_.-]+$/.test(env.EIDOLON_E2E_BUILD_MONGO_CONTAINER || '') ||
        !/^\d+$/.test(env.EIDOLON_E2E_BUILD_MONGO_PORT || '') ||
        !/^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(env.EIDOLON_E2E_WS_URL || '')) throw new Error('Isolated earned save read required');
    const script = `
        if (!db.getSiblingDB('admin').auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) throw Error('Auth failed');
        // Keep the shell's async database call outside an optional-chain:
        // the deployed mongosh otherwise throws before emitting the receipt.
        const user = db.getSiblingDB('eidolon').users.findOne({username:${JSON.stringify(username)}});
        const c = (user && user.characters && user.characters[0]) || {};
        const q = (c.quests || []).find(q => q.id === 'chronicle_earth_borrowed_oath') || {};
        const d = (c.quests || []).find(q => q.id === 'chronicle_03_roots_remember') || {};
        print(JSON.stringify({level:c.level,xp:c.xp,gold:c.gold,correctSaveKey:c.name===${JSON.stringify(username)},
            huntCompleted:q.completed===true,dungeonAccepted:d.accepted===true,dungeonCount:d.count,dungeonCompleted:d.completed===true
            ${includeQuests ? ',quests:c.quests' : ''}}));`;
    try {
        return JSON.parse(execFileSync('docker', ['exec', '-i', env.EIDOLON_E2E_BUILD_MONGO_CONTAINER,
            'mongosh', '--quiet', '--port', env.EIDOLON_E2E_BUILD_MONGO_PORT, '--file', '/dev/stdin'],
        { input: script, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 15_000 }));
    } catch { throw new Error('Could not read saved earned progress'); }
}

export function restoreEarnedEarthCheckpoint(username, env = process.env) {
    const container = env.EIDOLON_E2E_BUILD_MONGO_CONTAINER;
    const port = env.EIDOLON_E2E_BUILD_MONGO_PORT;
    const archive = env.EIDOLON_E2E_EARNED_CHECKPOINT;
    if (env.EIDOLON_E2E_EARNED_RESUME !== '1' || env.EIDOLON_E2E_REGISTER !== '1' ||
        !/^eidolon-isolated-qa-mongo-[a-z0-9_.-]+$/.test(container || '') ||
        !/^\d+$/.test(port || '') || Number(port) < 1024 || Number(port) > 65535 ||
        !/^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(env.EIDOLON_E2E_WS_URL || '') ||
        !archive?.startsWith('/tmp/eidolon-')) throw new Error('Earned resume requires explicit isolated local QA');
    const info = lstatSync(archive);
    const checkpoint = info.isFile() && !info.isSymbolicLink() && (info.mode & 0o077) === 0 &&
        earnedEarthCheckpoints.find(value => value.sha === createHash('sha256').update(readFileSync(archive)).digest('hex'));
    if (!checkpoint) {
        throw new Error('Expected the private, checksum-pinned earned Earth archive');
    }
    const script = earnedEarthTransferScript(username, checkpoint);
    const options = { stdio: ['pipe', 'pipe', 'pipe'], timeout: 30_000 };
    try {
        execFileSync('docker', ['cp', archive, `${container}:/tmp/earned-earth.archive.gz`], options);
        execFileSync('docker', ['exec', container, 'sh', '-c',
            'exec mongorestore --port "$1" --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive=/tmp/earned-earth.archive.gz --gzip --nsInclude=eidolon.users --nsFrom=eidolon.users --nsTo=earned_checkpoint.users --stopOnError',
            'sh', port], options);
        return execFileSync('docker', ['exec', '-i', container, 'mongosh', '--quiet', '--port', port, '--file', '/dev/stdin'],
            { ...options, input: script, encoding: 'utf8' }).trim();
    } catch { throw new Error('Could not restore the private earned checkpoint; no progression substitution allowed'); }
}
