import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { validateSoakEvidence, verifySoakHealth } from './lib/soak-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mongoURI = process.env.MONGO_URI;
assert.equal(process.env.SOAK_DISPOSABLE_DATABASE, '1', 'Requires an explicitly disposable database');
assert.match(mongoURI || '', /^mongodb:\/\/127\.0\.0\.1:\d+\/?$/, 'Requires an isolated loopback Mongo service');
const duration = process.env.SOAK_DURATION || '24h';
assert.match(duration, /^(?:\d+(?:\.\d+)?(?:ms|s|m|h))+$/, 'Invalid soak duration');
const units = { ms: .001, s: 1, m: 60, h: 3600 };
const seconds = [...duration.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)]
    .reduce((sum, match) => sum + Number(match[1]) * units[match[2]], 0);
assert(seconds >= 60 && seconds <= 86400, 'Soak duration must be between one minute and 24 hours');
const evidence = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'eidolon-soak-'));
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `evidence-dir=${evidence}\n`);
console.log(`Soak evidence: ${evidence}`);
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const expectedCommit = `${revision}-${path.basename(evidence)}`;
const serverPath = path.join(evidence, 'server');
const clientPath = path.join(evidence, 'loadtest');
execFileSync('go', ['build', '-trimpath', '-ldflags', `-X main.buildCommit=${expectedCommit}`, '-o', serverPath, '.'],
    { cwd: path.join(root, 'server'), stdio: 'inherit' });
execFileSync('go', ['build', '-trimpath', '-o', clientPath, './cmd/loadtest'],
    { cwd: path.join(root, 'server'), stdio: 'inherit' });

const port = await new Promise((resolve, reject) => {
    const reservation = net.createServer();
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', () => {
        const selected = reservation.address().port;
        reservation.close(error => error ? reject(error) : resolve(selected));
    });
});
const address = `127.0.0.1:${port}`;
const children = [];
function start(binary, args, logName) {
    const output = fs.openSync(path.join(evidence, logName), 'a');
    const child = spawn(binary, args, { cwd: path.join(root, 'server'), stdio: ['ignore', output, output] });
    fs.closeSync(output);
    const result = new Promise(resolve => {
        child.once('error', error => resolve({ code: -1, error: error.message }));
        child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    const tracked = { child, result, ended: false };
    result.then(() => { tracked.ended = true; });
    children.push(tracked);
    return tracked;
}
async function stopOwnedChildren() {
    for (const process of [...children].reverse()) {
        if (process.ended) continue;
        process.child.kill('SIGINT');
        await Promise.race([process.result, delay(5000, undefined, { ref: false })]);
        if (!process.ended) process.child.kill('SIGKILL');
        await process.result;
    }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
    await stopOwnedChildren();
    process.exit(signal === 'SIGINT' ? 130 : 143);
});

try {
    const server = start(serverPath, ['-addr', address, '-mongo-uri', mongoURI,
        '-log-file', path.join(evidence, 'soak-server.log'), '-log-stdout=false',
        '-suspicious-log-file', path.join(evidence, 'soak-suspicious.log'), '-economy-metrics-file', ''], 'soak-process.log');
    let healthy = false;
    for (let attempt = 0; attempt < 60; attempt++) {
        assert(!server.ended, 'Owned soak server exited before readiness; inspect soak-server.log');
        try {
            const response = await fetch(`http://${address}/healthz`, { signal: AbortSignal.timeout(2000) });
            assert(response.ok);
            verifySoakHealth(await response.json(), expectedCommit);
            assert(!server.ended);
            healthy = true;
            break;
        } catch { await delay(1000); }
    }
    assert(healthy, 'Owned soak server did not become healthy');
    // The temporary port reservation is released before spawn. A rare bind
    // race fails closed through child liveness and the per-run build identity;
    // a different listener never receives the load harness or test accounts.
    const client = start(clientPath, ['-addr', address, '-scheme', 'ws', '-n', '100',
        '-scenario', 'mixed', '-duration', duration], 'soak-client.log');
    const samples = [];
    const sample = async () => {
        assert(!server.ended, 'Owned soak server exited during load');
        const response = await fetch(`http://${address}/healthz`, { signal: AbortSignal.timeout(5000) });
        assert(response.ok, 'Soak health request failed');
        const value = verifySoakHealth(await response.json(), expectedCommit);
        samples.push(value);
        fs.appendFileSync(path.join(evidence, 'soak-runtime.jsonl'), `${JSON.stringify(value)}\n`);
    };
    await sample();
    while (!client.ended) {
        await Promise.race([client.result, delay(60_000, undefined, { ref: false })]);
        await sample();
    }
    assert.equal((await client.result).code, 0, 'Load harness failed; inspect soak-client.log');
    const report = validateSoakEvidence(fs.readFileSync(path.join(evidence, 'soak-client.log'), 'utf8'), samples);
    console.log(JSON.stringify({ duration, address, expectedCommit, ...report }));
} finally {
    await stopOwnedChildren();
}
