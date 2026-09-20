import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export const earnedEarthCheckpointSHA = 'be0c40ad5c8ff6cc42cb2dbb42e23bb07ad721814959f3f8e518b21ecaeb765c';
const historicalCheckpoints = Object.freeze([
    { sha: earnedEarthCheckpointSHA, level: 30, xp: 7170, gold: 8539, count: 46, completed: false },
    { sha: 'c3cca5c86852d354fc13b3e8f4c48513c5ff083153608866a45c5afdb358c673',
        level: 31, xp: 12448, gold: 9047, count: 50, completed: true },
    { sha: '8b075ebdac1f5fea3b7849927dfd3679b6b2e70d3dfb1dd908961dbc9c31e741',
        level: 33, xp: 23108, gold: 10598, count: 50, completed: true, waterOffered: true },
    { sha: 'c65ddaee9a989f47289b9db2fbc98842746871d5fea84df2e1dd1248382b45a1',
        level: 42, xp: 32261, gold: 25427, count: 50, completed: true,
        waterProgress: { accepted: true, completed: false, count: 58 } },
    { sha: 'e6a43eaf1a70cb8e681ef7a14e1a0e0125b91e4b22b294b642c376807887055e',
        level: 43, xp: 35906, gold: 27416, count: 50, completed: true,
        waterProgress: { accepted: true, completed: true, count: 60, grantedGold: 400, grantedXP: 28593 } },
    { sha: 'ebf5969b1e122e7931fd2f7fd0d1b2112c81f619b3e027b93e6830613405b1a0',
        level: 61, xp: 21946, gold: 51012, count: 50, completed: true,
        waterProgress: { accepted: true, completed: true, count: 60, grantedGold: 400, grantedXP: 28593 },
        waterChapters: [
            { id: 'chronicle_water_flood_shelter', accepted: true, completed: true, count: 1, max_count: 1, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_snow_debts', accepted: true, completed: true, count: 60, max_count: 60, granted_gold: 500, granted_xp: 45093 },
            { id: 'chronicle_04_pearls_without_tides', accepted: true, completed: true, count: 8, max_count: 8, granted_gold: 300, granted_xp: 18038 },
            { id: 'chronicle_water_false_reflection', accepted: true, completed: true, count: 3, max_count: 3, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_unmastered_current', accepted: true, completed: false, count: 25, max_count: 70, granted_gold: 0, granted_xp: 0 }
        ] },
    { sha: '66b9238c0b35b9b10720885664197079eda0418c24971542b112955d39493e2f',
        level: 62, xp: 7668, gold: 51749, count: 50, completed: true,
        waterProgress: { accepted: true, completed: true, count: 60, grantedGold: 400, grantedXP: 28593 },
        waterChapters: [
            { id: 'chronicle_water_flood_shelter', accepted: true, completed: true, count: 1, max_count: 1, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_snow_debts', accepted: true, completed: true, count: 60, max_count: 60, granted_gold: 500, granted_xp: 45093 },
            { id: 'chronicle_04_pearls_without_tides', accepted: true, completed: true, count: 8, max_count: 8, granted_gold: 300, granted_xp: 18038 },
            { id: 'chronicle_water_false_reflection', accepted: true, completed: true, count: 3, max_count: 3, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_unmastered_current', accepted: true, completed: false, count: 28, max_count: 70, granted_gold: 0, granted_xp: 0 }
        ] },
    { sha: '24094f09eb741015a20288c3530569349432628ae8ede8e1afe7da2aaafb2624',
        level: 62, xp: 40713, gold: 53469, count: 50, completed: true,
        resources: { version: 1, health: 0, mana: 2005, dead: true },
        waterProgress: { accepted: true, completed: true, count: 60, grantedGold: 400, grantedXP: 28593 },
        waterChapters: [
            { id: 'chronicle_water_flood_shelter', accepted: true, completed: true, count: 1, max_count: 1, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_snow_debts', accepted: true, completed: true, count: 60, max_count: 60, granted_gold: 500, granted_xp: 45093 },
            { id: 'chronicle_04_pearls_without_tides', accepted: true, completed: true, count: 8, max_count: 8, granted_gold: 300, granted_xp: 18038 },
            { id: 'chronicle_water_false_reflection', accepted: true, completed: true, count: 3, max_count: 3, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_unmastered_current', accepted: true, completed: false, count: 31, max_count: 70, granted_gold: 0, granted_xp: 0 }
        ] },
    { sha: '1bcc55dbffdd271ce8abd909480dd142e5b754378c6e8dcf5ca95d239a9928c4',
        level: 80, xp: 87276, gold: 98595, count: 50, completed: true,
        resources: { version: 1, health: 3415, mana: 2766, dead: false },
        waterProgress: { accepted: true, completed: true, count: 60, grantedGold: 400, grantedXP: 28593 },
        waterChapters: [
            { id: 'chronicle_water_flood_shelter', accepted: true, completed: true, count: 1, max_count: 1, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_snow_debts', accepted: true, completed: true, count: 60, max_count: 60, granted_gold: 500, granted_xp: 45093 },
            { id: 'chronicle_04_pearls_without_tides', accepted: true, completed: true, count: 8, max_count: 8, granted_gold: 300, granted_xp: 18038 },
            { id: 'chronicle_water_false_reflection', accepted: true, completed: true, count: 3, max_count: 3, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_unmastered_current', accepted: true, completed: false, count: 61, max_count: 70, granted_gold: 0, granted_xp: 0 }
        ] },
    { sha: '80ed91fd1520a1dd51aff44f17112c0456f4ef341460ad932721f561d7c38ae5',
        level: 83, xp: 90198, gold: 104319, count: 50, completed: true,
        resources: { version: 1, health: 3663, mana: 2816, dead: false },
        waterProgress: { accepted: true, completed: true, count: 60, grantedGold: 400, grantedXP: 28593 },
        waterChapters: [
            { id: 'chronicle_water_flood_shelter', accepted: true, completed: true, count: 1, max_count: 1, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_snow_debts', accepted: true, completed: true, count: 60, max_count: 60, granted_gold: 500, granted_xp: 45093 },
            { id: 'chronicle_04_pearls_without_tides', accepted: true, completed: true, count: 8, max_count: 8, granted_gold: 300, granted_xp: 18038 },
            { id: 'chronicle_water_false_reflection', accepted: true, completed: true, count: 3, max_count: 3, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_unmastered_current', accepted: true, completed: true, count: 70, max_count: 70, granted_gold: 550, granted_xp: 54750 }
        ],
        waterDungeon: { id: 'chronicle_05_drowned_name', accepted: true, completed: false, count: 0,
            max_count: 1, granted_gold: 0, granted_xp: 0 } },
    { sha: 'aba07629adf896bd1a5f2ffd07fba4958c83912869a36be56f50f537657fc55e',
        level: 85, xp: 4217, gold: 107425, count: 50, completed: true,
        resources: { version: 1, health: 3718, mana: 2849, dead: false },
        waterProgress: { accepted: true, completed: true, count: 60, grantedGold: 400, grantedXP: 28593 },
        waterChapters: [
            { id: 'chronicle_water_flood_shelter', accepted: true, completed: true, count: 1, max_count: 1, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_snow_debts', accepted: true, completed: true, count: 60, max_count: 60, granted_gold: 500, granted_xp: 45093 },
            { id: 'chronicle_04_pearls_without_tides', accepted: true, completed: true, count: 8, max_count: 8, granted_gold: 300, granted_xp: 18038 },
            { id: 'chronicle_water_false_reflection', accepted: true, completed: true, count: 3, max_count: 3, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_unmastered_current', accepted: true, completed: true, count: 70, max_count: 70, granted_gold: 550, granted_xp: 54750 }
        ],
        waterDungeon: { id: 'chronicle_05_drowned_name', accepted: true, completed: true, count: 1,
            max_count: 1, granted_gold: 600, granted_xp: 43562 },
        continuationChapters: [{ id: 'chronicle_fire_cold_kiln', accepted: false, completed: false, count: 0,
            max_count: 1, granted_gold: 0, granted_xp: 0 }] },
    { sha: 'f4e51871b68b08113620ec4bf3c80d1c82b8b3d0cf52ea8939014363b2864e90',
        level: 87, xp: 72166, gold: 114225, count: 50, completed: true,
        resources: { version: 1, health: 0, mana: 3700, dead: true },
        waterProgress: { accepted: true, completed: true, count: 60, grantedGold: 400, grantedXP: 28593 },
        waterChapters: [
            { id: 'chronicle_water_flood_shelter', accepted: true, completed: true, count: 1, max_count: 1, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_snow_debts', accepted: true, completed: true, count: 60, max_count: 60, granted_gold: 500, granted_xp: 45093 },
            { id: 'chronicle_04_pearls_without_tides', accepted: true, completed: true, count: 8, max_count: 8, granted_gold: 300, granted_xp: 18038 },
            { id: 'chronicle_water_false_reflection', accepted: true, completed: true, count: 3, max_count: 3, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_unmastered_current', accepted: true, completed: true, count: 70, max_count: 70, granted_gold: 550, granted_xp: 54750 }
        ],
        waterDungeon: { id: 'chronicle_05_drowned_name', accepted: true, completed: true, count: 1,
            max_count: 1, granted_gold: 600, granted_xp: 43562 },
        continuationChapters: [
            { id: 'chronicle_fire_cold_kiln', accepted: true, completed: true, count: 1, max_count: 1, granted_gold: 250, granted_xp: 5956 },
            { id: 'chronicle_fire_unending_war', accepted: true, completed: false, count: 7, max_count: 35, granted_gold: 0, granted_xp: 0 }
        ] },
    { sha: '63be9a1f66da16dede4d38d168021bb989898d6809376c6601a64a53f7a10c7f',
        level: 100, xp: 245125, gold: 209955, count: 50, completed: true,
        resources: { version: 1, health: 4645, mana: 3251, dead: false },
        waterProgress: { accepted: true, completed: true, count: 60, grantedGold: 400, grantedXP: 28593 },
        waterChapters: [
            { id: 'chronicle_water_flood_shelter', accepted: true, completed: true, count: 1, max_count: 1, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_snow_debts', accepted: true, completed: true, count: 60, max_count: 60, granted_gold: 500, granted_xp: 45093 },
            { id: 'chronicle_04_pearls_without_tides', accepted: true, completed: true, count: 8, max_count: 8, granted_gold: 300, granted_xp: 18038 },
            { id: 'chronicle_water_false_reflection', accepted: true, completed: true, count: 3, max_count: 3, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_unmastered_current', accepted: true, completed: true, count: 70, max_count: 70, granted_gold: 550, granted_xp: 54750 }
        ],
        waterDungeon: { id: 'chronicle_05_drowned_name', accepted: true, completed: true, count: 1,
            max_count: 1, granted_gold: 600, granted_xp: 43562 },
        continuationChapters: [
            { id: 'chronicle_fire_cold_kiln', accepted: true, completed: true, count: 1, max_count: 1, granted_gold: 250, granted_xp: 5956 },
            { id: 'chronicle_fire_unending_war', accepted: true, completed: true, count: 35, max_count: 35, granted_gold: 750, granted_xp: 0, granted_resonance_xp: 102750 },
            { id: 'chronicle_06_ash_refuses_cool', accepted: true, completed: true, count: 8, max_count: 8, granted_gold: 500, granted_xp: 0, granted_resonance_xp: 35738 },
            { id: 'chronicle_fire_obedient_ember', accepted: true, completed: false, count: 1, max_count: 3, investigation_mask: 1, granted_gold: 0, granted_xp: 0, granted_resonance_xp: 0 }
        ] },
    { sha: '1a01831ca383c9623cdf88125e7988b7195f3d1ffbfd8c68d1262e72f7d9b2d9',
        level: 100, xp: 245125, gold: 211256, count: 50, completed: true,
        resources: { version: 1, health: 5109, mana: 4031, dead: false },
        waterProgress: { accepted: true, completed: true, count: 60, grantedGold: 400, grantedXP: 28593 },
        waterChapters: [
            { id: 'chronicle_water_flood_shelter', accepted: true, completed: true, count: 1, max_count: 1, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_snow_debts', accepted: true, completed: true, count: 60, max_count: 60, granted_gold: 500, granted_xp: 45093 },
            { id: 'chronicle_04_pearls_without_tides', accepted: true, completed: true, count: 8, max_count: 8, granted_gold: 300, granted_xp: 18038 },
            { id: 'chronicle_water_false_reflection', accepted: true, completed: true, count: 3, max_count: 3, granted_gold: 150, granted_xp: 3006 },
            { id: 'chronicle_water_unmastered_current', accepted: true, completed: true, count: 70, max_count: 70, granted_gold: 550, granted_xp: 54750 }
        ],
        waterDungeon: { id: 'chronicle_05_drowned_name', accepted: true, completed: true, count: 1,
            max_count: 1, granted_gold: 600, granted_xp: 43562 },
        continuationChapters: [
            { id: 'chronicle_fire_cold_kiln', accepted: true, completed: true, count: 1, max_count: 1, granted_gold: 250, granted_xp: 5956 },
            { id: 'chronicle_fire_unending_war', accepted: true, completed: true, count: 35, max_count: 35, granted_gold: 750, granted_xp: 0, granted_resonance_xp: 102750 },
            { id: 'chronicle_06_ash_refuses_cool', accepted: true, completed: true, count: 8, max_count: 8, granted_gold: 500, granted_xp: 0, granted_resonance_xp: 35738 },
            { id: 'chronicle_fire_obedient_ember', accepted: true, completed: true, count: 3, max_count: 3, investigation_mask: 7, granted_gold: 250, granted_xp: 0, granted_resonance_xp: 5956 },
            { id: 'chronicle_07_crown_of_embers', accepted: true, completed: false, count: 0, max_count: 1, granted_gold: 0, granted_xp: 0, granted_resonance_xp: 0 }
        ] }
]);

export const earnedEarthCheckpoints = Object.freeze([
    ...historicalCheckpoints,
    // Failed Molten expedition: actual drops/resources are retained, but the
    // quest is still uncompleted. Normal login owns the 15-minute run expiry;
    // transferring this save must never refresh its logout or dungeon clock.
    { ...historicalCheckpoints[13],
        sha: '2d0fd77d61aee892a57c563041fa2be5bb6c155f66a6fe3415e9de91e20059a1',
        gold: 213922, resources: { version: 1, health: 4645, mana: 3665, dead: false } }
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
        for (const [key, value] of Object.entries(${JSON.stringify(checkpoint.resources || {})})) {
            if (character.resources?.[key] !== value) throw Error('Unexpected earned saved resources');
        }
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
            if (${Boolean(checkpoint.waterProgress)}) {
                const next = character.quests.find(q => q.id === 'chronicle_water_flood_shelter');
                if (water.max_count !== 60 || (water.granted_gold || 0) !== (expected.grantedGold || 0) ||
                    (water.granted_xp || 0) !== (expected.grantedXP || 0) ||
                    (!expected.completed && next) || (expected.completed && ${!checkpoint.waterChapters} &&
                        (!next || next.accepted || next.completed || next.count !== 0)))
                    throw Error('Unexpected earned Water reward or next chapter');
            }
        }
        const chapters = ${JSON.stringify([...(checkpoint.waterChapters || []), ...(checkpoint.waterDungeon ? [checkpoint.waterDungeon] : []), ...(checkpoint.continuationChapters || [])])};
        for (const expected of chapters) {
            const matches = character.quests.filter(q => q.id === expected.id);
            if (matches.length !== 1 || Object.entries(expected).some(([key, value]) =>
                (key === 'investigation_mask' ? Number(matches[0][key] || 0) :
                    key.startsWith('granted_') ? (matches[0][key] || 0) : matches[0][key]) !== value))
                throw Error('Unexpected earned Water continuation');
        }
        if (chapters.length && ${!checkpoint.waterDungeon} && character.quests.some(q => q.id === 'chronicle_05_drowned_name'))
            throw Error('Premature earned Water dungeon offer');
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
