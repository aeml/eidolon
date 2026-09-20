import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export const earnedEarthCheckpointSHA = 'be0c40ad5c8ff6cc42cb2dbb42e23bb07ad721814959f3f8e518b21ecaeb765c';

// This is the complete private September14 save, not the build-only JSON fixture.
// Import only its character into a NEW disposable account. Never copy credentials,
// change logout timestamps, fill missing inventory or synthesize later progress.
export function earnedEarthTransferScript(username) {
    if (!/^codexqa[a-z0-9-]+$/.test(username || '')) throw new Error('Disposable account required');
    return `
        if (!db.getSiblingDB('admin').auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) throw Error('Checkpoint auth failed');
        const users = db.getSiblingDB('earned_checkpoint').users.find({}).limit(2).toArray();
        if (users.length !== 1 || users[0].characters?.length !== 1) throw Error('Ambiguous checkpoint');
        const character = users[0].characters[0];
        const quest = character.quests.find(q => q.id === 'chronicle_earth_borrowed_oath');
        if (character.class !== 'Wizard' || character.level !== 30 || character.xp !== 7170 || character.gold !== 8539 ||
            !quest?.accepted || quest.completed || quest.count !== 46 || quest.max_count !== 50 ||
            character.quests.some(q => q.id.startsWith('daily_') && (q.accepted || q.completed))) throw Error('Unexpected earned progress');
        const target = db.getSiblingDB('eidolon').users;
        const result = target.updateOne({ username: ${JSON.stringify(username)}, 'characters.0': { $exists: false } },
            { $set: { characters: [character] } });
        if (result.matchedCount !== 1 || result.modifiedCount !== 1) throw Error('Requires a new empty account');
        const saved = target.findOne({ username: ${JSON.stringify(username)} }).characters[0];
        if (EJSON.stringify(saved) !== EJSON.stringify(character)) throw Error('Character changed during transfer');
        print('Earned checkpoint transferred exactly: Wizard level30, XP7170, Gold8539, Orc46/50.');
    `;
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
    const script = earnedEarthTransferScript(username);
    const info = lstatSync(archive);
    if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 ||
        createHash('sha256').update(readFileSync(archive)).digest('hex') !== earnedEarthCheckpointSHA) {
        throw new Error('Expected the private, checksum-pinned earned Earth archive');
    }
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
