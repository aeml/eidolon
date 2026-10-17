import { afterEach, beforeEach, expect, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

const deploy = path.resolve('server/deploy');
let root, point, destination, knownHosts, probe, env;
const sha = body => createHash('sha256').update(body).digest('hex');

function put(name, body) { fs.writeFileSync(path.join(point, name), body, { mode: 0o600 }); }
function fixture(fresh = false) {
    fs.mkdirSync(point, { mode: 0o700 });
    for (const name of ['mongo.archive.gz', 'logs.tar.gz', ...fresh ? [] : ['previous-api.tar.gz']])
        put(name, gzipSync(`Synthetic transport fixture: ${name}; not real game data.`));
    put('previous-image-id.txt', fresh ? 'No prior API container; no previous server image is available.\n' : `sha256:${'a'.repeat(64)}\n`);
    put('COMPLETE', 'target_commit=synthetic-fixture\ncreated_utc=2026-10-17T00:00:00Z\n');
    const names = ['mongo.archive.gz', 'logs.tar.gz', 'previous-image-id.txt', ...fresh ? [] : ['previous-api.tar.gz']];
    put('SHA256SUMS', names.map(name => `${sha(fs.readFileSync(path.join(point, name)))}  ${name}\n`).join(''));
}
function copy(overrides = [], extraEnv = {}) {
    const args = [point, 'backup@fixture.example', destination, knownHosts, '49241'];
    for (const [index, value] of overrides) args[index] = value;
    return spawnSync('bash', [path.join(deploy, 'copy_upgrade_backup.sh'), ...args], {
        env: { ...env, ...extraEnv }, encoding: 'utf8', timeout: 15000
    });
}
function snapshot(directory) {
    return Object.fromEntries(fs.readdirSync(directory).sort().map(name => [name, sha(fs.readFileSync(path.join(directory, name)))]));
}
function partials() { return fs.readdirSync(destination).filter(name => name.startsWith('.eidolon-receive-')); }

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'eidolon-backup-transfer-'));
    fs.chmodSync(root, 0o700);
    point = path.join(root, 'save-upgrade-fixture');
    destination = path.join(root, "destination ' ; touch shell-executed ; # $(touch injected)");
    fs.mkdirSync(destination, { mode: 0o700 });
    knownHosts = path.join(root, 'known hosts');
    fs.writeFileSync(knownHosts, 'synthetic pin; actual transport is tested separately\n', { mode: 0o600 });
    probe = path.join(root, 'ssh-arguments.json');
    const bin = path.join(root, 'bin'); fs.mkdirSync(bin, { mode: 0o700 });
    fs.writeFileSync(path.join(bin, 'ssh'), `#!/usr/bin/python3
import sys,os,json,subprocess,tarfile,io
args=sys.argv[1:]
with open(os.environ['QA_SSH_PROBE'],'w') as f: json.dump(args[:-1],f)
mode=os.environ.get('QA_SSH_MODE','ordinary')
if mode=='ordinary':
    os.execv('/bin/bash',['bash','-c',args[-1]])
data=sys.stdin.buffer.read()
if mode=='truncated': data=data[:1536]
elif mode in ('corrupt','verifier','linked-verifier'):
    output=io.BytesIO()
    with tarfile.open(fileobj=io.BytesIO(data)) as original,tarfile.open(fileobj=output,mode='w') as changed:
        for member in original:
            body=original.extractfile(member).read()
            if mode=='corrupt' and member.name=='logs.tar.gz': body=b'corrupted transfer'
            if mode=='verifier' and member.name=='verify_upgrade_backup.sh': body=b'#!/bin/bash\\nprintf injected > receiver-injected\\n'
            if mode=='linked-verifier' and member.name=='verify_upgrade_backup.sh':
                member.type=tarfile.SYMTYPE;member.linkname='/bin/true';member.size=0;changed.addfile(member);continue
            member.size=len(body); changed.addfile(member,io.BytesIO(body))
    data=output.getvalue()
sys.exit(subprocess.run(['/bin/bash','-c',args[-1]],input=data).returncode)
`, { mode: 0o700 });
    fs.writeFileSync(path.join(bin, 'sync'), `#!/usr/bin/python3
import os,sys,json
p=os.environ['QA_SYNC_PROBE']
try:
    with open(p) as f: calls=json.load(f)
except FileNotFoundError: calls=[]
calls.append(sys.argv[1:])
with open(p,'w') as f:json.dump(calls,f)
sys.exit(1 if str(len(calls))==os.environ.get('QA_SYNC_FAIL_AT') else 0)
`, { mode: 0o700 });
    env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, QA_SSH_PROBE: probe, QA_SYNC_PROBE: path.join(root, 'sync-calls.json') };
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

test.each([false, true])('publishes a byte-exact verified recovery point with fresh-install=%s', fresh => {
    fixture(fresh); const before = snapshot(point), result = copy();
    expect(result.stderr).toBe(''); expect(result.status).toBe(0);
    expect(result.stdout).toContain('Remote recovery point verified and published: save-upgrade-fixture');
    const remote = path.join(destination, path.basename(point));
    expect(snapshot(remote)).toEqual(before); expect(snapshot(point)).toEqual(before); expect(partials()).toEqual([]);
    expect(fs.statSync(remote).mode & 0o777).toBe(0o700);
    for (const name of fs.readdirSync(remote)) expect(fs.statSync(path.join(remote, name)).mode & 0o777).toBe(0o600);
    const args = JSON.parse(fs.readFileSync(probe, 'utf8'));
    for (const option of ['StrictHostKeyChecking=yes', `UserKnownHostsFile=${knownHosts}`, 'GlobalKnownHostsFile=/dev/null',
        'UpdateHostKeys=no', 'BatchMode=yes', 'ClearAllForwardings=yes', 'ControlMaster=no', 'ControlPath=none']) expect(args).toContain(option);
    expect(args).toContain('/dev/null'); expect(args).toContain('49241'); expect(args.at(-1)).toBe('backup@fixture.example');
    const barriers = JSON.parse(fs.readFileSync(env.QA_SYNC_PROBE, 'utf8'));
    expect(barriers).toHaveLength(3); expect(barriers[0]).toContain('COMPLETE.pending');
    expect(barriers[0]).toContain('mongo.archive.gz'); expect(barriers[2]).toEqual(['--', destination]);
    expect(barriers.flat()).not.toContain('-f');
    expect(fs.existsSync(path.join(process.cwd(), 'shell-executed'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'injected'))).toBe(false);
});

test.each(['1', '2', '3'])('failed durability barrier %s never leaves a completed recovery point', barrier => {
    fixture(); const before = snapshot(point), result = copy([], { QA_SYNC_FAIL_AT: barrier });
    expect(result.status).not.toBe(0); expect(result.stdout).not.toContain('Remote recovery point verified and published');
    expect(snapshot(point)).toEqual(before);
    for (const name of fs.readdirSync(destination)) expect(fs.existsSync(path.join(destination, name, 'COMPLETE'))).toBe(false);
});

test.each(['truncated', 'corrupt', 'verifier', 'linked-verifier'])('an incomplete or corrupted %s transfer never publishes a recovery point', mode => {
    fixture(); const before = snapshot(point), result = copy([], { QA_SSH_MODE: mode });
    expect(result.status).not.toBe(0); expect(snapshot(point)).toEqual(before);
    expect(fs.existsSync(path.join(destination, path.basename(point)))).toBe(false);
    expect(partials()).toHaveLength(1);
    expect(fs.existsSync(path.join(destination, partials()[0], 'COMPLETE'))).toBe(false);
    expect(fs.existsSync(path.join(destination, partials()[0], 'receiver-injected'))).toBe(false);
    if (mode === 'linked-verifier') expect(result.stderr).toContain('unsafe artifact');
});

test('a duplicate transfer preserves every byte of the already published point', () => {
    fixture(); expect(copy().status).toBe(0); const remote = path.join(destination, path.basename(point)), before = snapshot(remote);
    const result = copy(); expect(result.status).not.toBe(0); expect(result.stderr).toContain('refusing replacement');
    expect(snapshot(remote)).toEqual(before); expect(partials()).toEqual([]);
});

test('a selected source below a literal backslash and quoted parent transfers without shell interpretation', () => {
    fixture(); const parent = path.join(root, "source \\ ' $(touch source-injected)"); fs.mkdirSync(parent, { mode: 0o700 });
    const selected = path.join(parent, path.basename(point)); fs.renameSync(point, selected); point = selected;
    const before = snapshot(point), result = copy(); expect(result.stderr).toBe(''); expect(result.status).toBe(0);
    expect(snapshot(path.join(destination, path.basename(point)))).toEqual(before); expect(snapshot(point)).toEqual(before);
    expect(fs.existsSync(path.join(process.cwd(), 'source-injected'))).toBe(false);
});

test.each(['public-permissions', 'directory-link', 'ancestor-link'])('refuses unsafe destination %s', scenario => {
    fixture(); let selected = destination;
    if (scenario === 'public-permissions') fs.chmodSync(destination, 0o755);
    else {
        const link = path.join(root, 'linked-destination');
        fs.symlinkSync(scenario === 'directory-link' ? destination : root, link);
        selected = scenario === 'directory-link' ? `${link}/.` : path.join(link, path.basename(destination));
    }
    const result = copy([[2, selected]]); expect(result.status).not.toBe(0);
    expect(fs.readdirSync(destination)).toEqual([]);
});

test.each(['bad-checksum', 'directory-link', 'known-hosts-link'])('refuses unsafe source/pin %s before SSH', scenario => {
    fixture(); const overrides = [];
    if (scenario === 'bad-checksum') put('logs.tar.gz', gzipSync('changed after completed snapshot'));
    else {
        const link = path.join(root, 'linked');
        fs.symlinkSync(scenario === 'directory-link' ? point : knownHosts, link);
        overrides.push([scenario === 'directory-link' ? 0 : 3, link]);
    }
    const result = copy(overrides); expect(result.status).not.toBe(0); expect(fs.existsSync(probe)).toBe(false);
    expect(fs.readdirSync(destination)).toEqual([]);
});

test.each([[1, '-oProxyCommand=touch injected'], [1, 'user@host;touch injected'], [2, '/tmp/root\ncommand'], [4, '0'], [4, '65536']])(
    'refuses malformed transfer argument %s=%s before SSH', (index, value) => {
        fixture(); const result = copy([[index, value]]); expect(result.status).not.toBe(0); expect(fs.existsSync(probe)).toBe(false);
    });

test('pending transfer verification never makes that point eligible for the ordinary restore verifier', () => {
    fixture(); fs.renameSync(path.join(point, 'COMPLETE'), path.join(point, 'COMPLETE.pending'));
    const script = path.join(deploy, 'verify_upgrade_backup.sh'), before = snapshot(point);
    expect(spawnSync('bash', [script, point, '--pending-transfer']).status).toBe(0);
    expect(spawnSync('bash', [script, point]).status).not.toBe(0);
    expect(spawnSync('bash', [script, point, '--unknown-option']).status).not.toBe(0);
    expect(snapshot(point)).toEqual(before);
});
