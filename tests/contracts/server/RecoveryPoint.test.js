import { afterEach, beforeEach, expect, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const deploy = path.resolve('server/deploy');
let root, env, stateFile, callsFile, holder;
const state = () => JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const calls = () => JSON.parse(fs.readFileSync(callsFile, 'utf8'));
const setState = patch => fs.writeFileSync(stateFile, JSON.stringify({ ...state(), ...patch }));
const invoke = (script, args = []) => spawnSync('bash', [path.join(root, 'deploy', script), ...args], { cwd: root, env, encoding: 'utf8', timeout: 15000 });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function holdDeploymentLock() {
    const ready = path.join(root, 'holder-ready');
    holder = spawn('bash', ['-c', 'exec 9>>"$1"; flock -n 9 || exit; : > "$2"; read -r _', 'holder', path.join(root, 'logs/deploy.lock'), ready], { stdio: ['pipe', 'ignore', 'pipe'] });
    for (let n = 0; n < 100 && !fs.existsSync(ready); n++) await wait(10);
    expect(fs.existsSync(ready)).toBe(true);
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'eidolon-recovery-point-')); fs.chmodSync(root, 0o700);
    for (const dir of ['deploy', 'logs', 'bin']) fs.mkdirSync(path.join(root, dir), { mode: 0o700 });
    for (const name of ['backup_before_upgrade.sh', 'restore_mongo_archive.sh', 'verify_upgrade_backup.sh', 'operation_lock.sh', 'create_recovery_point.sh'])
        if (fs.existsSync(path.join(deploy, name))) fs.copyFileSync(path.join(deploy, name), path.join(root, 'deploy', name));
    fs.writeFileSync(path.join(root, '.env'), 'touch env-executed\n', { mode: 0o600 });
    fs.writeFileSync(path.join(root, 'logs/pending.json'), 'synthetic journal: health17 mana0 gold1184 ep83\n', { mode: 0o600 });
    stateFile = path.join(root, 'api-state.json'); callsFile = path.join(root, 'calls.json');
    fs.writeFileSync(stateFile, JSON.stringify({ present: true, running: true, image: `sha256:${'b'.repeat(64)}` })); fs.writeFileSync(callsFile, '[]');
    fs.writeFileSync(path.join(root, 'bin/docker'), `#!/usr/bin/python3
import sys,os,json,gzip,tarfile,io
root=os.environ['QA_RECOVERY_ROOT'];state_path=root+'/api-state.json';calls_path=root+'/calls.json'
with open(state_path) as f:s=json.load(f)
with open(calls_path) as f:calls=json.load(f)
a=sys.argv[1:];calls.append(a)
with open(calls_path,'w') as f:json.dump(calls,f)
def save():
    with open(state_path,'w') as f:json.dump(s,f)
def refuse(code): sys.exit(code)
if a==['compose','ps','-a','-q','api']:
    if s.get('ambiguous'):print('a'*64+'\\n'+'c'*64)
    elif s['present']:print('a'*64)
elif a[:2]==['inspect','--format'] and a[-1]=='a'*64:
    if a[2]=='{{.State.Running}}':print(str(s['running']).lower())
    elif a[2]=='{{.State.Status}} {{.State.Running}}':print(s.get('status','running' if s['running'] else 'exited'),str(s['running']).lower())
    elif a[2]=='{{.Image}}':print(s['image'])
    else:refuse(99)
elif a==['compose','stop','--timeout','60','api']:
    s['running']=False;save()
elif a[:2]==['image','save']:
    if s.get('failImage'):refuse(31)
    if s.get('statusAfterImage'):
        s['status']=s['statusAfterImage'];s['running']=True;save()
    sys.stdout.buffer.write(b'synthetic Docker image bytes, not a real image')
elif a[:4]==['compose','exec','-T','mongo'] and 'mongodump' in a[-1]:
    if s.get('failDump'):refuse(32)
    sys.stdout.buffer.write(gzip.compress(b'synthetic Mongo archive bytes, not real BSON'))
elif a[0]=='run':
    if s.get('failJournal'):refuse(33)
    stream=io.BytesIO()
    with tarfile.open(fileobj=stream,mode='w:gz') as t:t.add(root+'/logs',arcname='.')
    sys.stdout.buffer.write(stream.getvalue())
elif a==['start','a'*64]:
    if s.get('failStart'):refuse(34)
    s['running']=True;save()
else:
    print('unexpected synthetic Docker command',a,file=sys.stderr);refuse(99)
`, { mode: 0o700 });
    fs.writeFileSync(path.join(root, 'sync-calls.json'), '[]');
    fs.writeFileSync(path.join(root, 'bin/sync'), `#!/usr/bin/python3
import os,sys,json
root=os.environ['QA_RECOVERY_ROOT']
with open(root+'/sync-calls.json') as f:calls=json.load(f)
calls.append(sys.argv[1:])
with open(root+'/sync-calls.json','w') as f:json.dump(calls,f)
with open(root+'/api-state.json') as f:state=json.load(f)
sys.exit(1 if len(calls)==state.get('failSyncAt') else 0)
`, { mode: 0o700 });
    env = { ...process.env, PATH: `${path.join(root, 'bin')}:${process.env.PATH}`, QA_RECOVERY_ROOT: root };
});
afterEach(async () => {
    if (holder && holder.exitCode === null) { holder.kill('SIGTERM'); await Promise.race([new Promise(resolve => holder.once('exit', resolve)), wait(1000)]); }
    holder = null; fs.rmSync(root, { recursive: true, force: true });
});

test('a held deployment lock refuses a raw snapshot before Docker inspection', async () => {
    await holdDeploymentLock(); const before = state(), result = invoke('backup_before_upgrade.sh');
    expect(result.status).not.toBe(0); expect(calls()).toEqual([]); expect(state()).toEqual(before);
    expect(fs.existsSync(path.join(root, 'backups'))).toBe(false);
});

test('a held deployment lock refuses a standalone recovery point before Docker inspection', async () => {
    await holdDeploymentLock(); const before = state(), result = invoke('create_recovery_point.sh');
    expect(result.status).not.toBe(0); expect(calls()).toEqual([]); expect(state()).toEqual(before);
});

test('a held deployment lock refuses an explicitly approved synthetic restore before Docker inspection', async () => {
    const archive = path.join(root, 'synthetic.archive.gz'); fs.writeFileSync(archive, gzipSync('synthetic only'));
    await holdDeploymentLock(); const result = invoke('restore_mongo_archive.sh', [archive, '--confirm-data-loss', '--confirm-privacy-and-journal-plan']);
    expect(result.status).not.toBe(0); expect(calls()).toEqual([]);
});

test('an inherited real deployment descriptor permits the nested pre-upgrade helper', () => {
    const result = spawnSync('bash', ['-c', 'exec 9>>logs/deploy.lock; flock -n 9 || exit; bash deploy/backup_before_upgrade.sh'], { cwd: root, env, encoding: 'utf8', timeout: 15000 });
    expect(result.stderr).toBe(''); expect(result.status).toBe(0); expect(result.stdout).toContain('Consistent pre-upgrade backup');
    expect(state().running).toBe(false); // Existing deployment caller owns restart.
});

test('an inherited unrelated descriptor cannot bypass the actual deployment lock', async () => {
    await holdDeploymentLock();
    const result = spawnSync('bash', ['-c', 'exec 9>>unrelated.lock; bash deploy/backup_before_upgrade.sh'], { cwd: root, env, encoding: 'utf8', timeout: 15000 });
    expect(result.status).not.toBe(0); expect(calls()).toEqual([]);
});

test.each(['running', 'stopped', 'created', 'absent'])('a standalone recovery point preserves the original %s API state', initial => {
    setState({ present: initial !== 'absent', running: initial === 'running' }); const before = state();
    if (initial === 'created') { setState({ status: 'created' }); before.status = 'created'; }
    const result = invoke('create_recovery_point.sh'); expect(result.stderr).toBe(''); expect(result.status).toBe(0);
    expect(state()).toEqual(before); expect(result.stdout).toContain('Verified standalone recovery point:');
    const points = fs.readdirSync(path.join(root, 'backups')).filter(name => name.startsWith('save-upgrade-')); expect(points).toHaveLength(1);
    expect(invoke('verify_upgrade_backup.sh', [path.join(root, 'backups', points[0])]).status).toBe(0);
    expect(calls().filter(c => c[0] === 'start')).toHaveLength(initial === 'running' ? 1 : 0);
    expect(fs.readFileSync(path.join(root, 'logs/pending.json'), 'utf8')).toContain('health17 mana0 gold1184 ep83');
    expect(fs.existsSync(path.join(root, 'env-executed'))).toBe(false);
    expect(calls().filter(c => ['start', 'inspect'].includes(c[0])).every(c => c.at(-1) === 'a'.repeat(64))).toBe(true);
    const barriers = JSON.parse(fs.readFileSync(path.join(root, 'sync-calls.json'), 'utf8'));
    expect(barriers).toHaveLength(2); expect(barriers.flat()).not.toContain('-f');
    expect(barriers[1]).toContain(path.join(root, 'backups', points[0], 'COMPLETE'));
    expect(barriers[1]).toContain(root);
});

test.each([
    ['paused', true], ['restarting', true], ['dead', false], ['removing', false],
    ['unknown', false], ['running', false], ['exited', true], ['created', true]
])('standalone recovery refuses original API status %s / running=%s without changing it', (status, running) => {
    setState({ status, running }); const before = state(), result = invoke('create_recovery_point.sh');
    expect(result.status).not.toBe(0); expect(result.stdout).not.toContain('Verified standalone recovery point:');
    expect(state()).toEqual(before); expect(calls().every(c => ['inspect', 'compose'].includes(c[0]) && c[1] !== 'stop')).toBe(true);
    expect(fs.existsSync(path.join(root, 'backups'))).toBe(false);
});

test.each([{ ambiguous: true }, { image: 'mutable:current' }])('standalone recovery refuses ambiguous or unpinned identity %j before snapshotting', identity => {
    setState(identity); const before = state(), result = invoke('create_recovery_point.sh');
    expect(result.status).not.toBe(0); expect(state()).toEqual(before);
    expect(calls().some(c => c[0] === 'start' || c[1] === 'stop' || c[0] === 'run')).toBe(false);
    expect(fs.existsSync(path.join(root, 'backups'))).toBe(false);
});

test('standalone recovery verifies its own new point and preserves an older future-dated point', () => {
    const old = path.join(root, 'backups/save-upgrade-29990101T000000Z-existing');
    fs.mkdirSync(old, { recursive: true }); fs.writeFileSync(path.join(old, 'COMPLETE'), 'old invalid point must stay untouched');
    fs.utimesSync(old, new Date('2099-01-01'), new Date('2099-01-01'));
    const result = invoke('create_recovery_point.sh'); expect(result.status).toBe(0);
    expect(result.stdout).not.toContain(`Verified standalone recovery point: ${old}`);
    expect(fs.readFileSync(path.join(old, 'COMPLETE'), 'utf8')).toBe('old invalid point must stay untouched');
    expect(state().running).toBe(true);
});

test('failed standalone verification invalidates only its own new point and restores the API', () => {
    const old = path.join(root, 'backups/save-upgrade-29990101T000000Z-existing');
    fs.mkdirSync(old, { recursive: true }); fs.writeFileSync(path.join(old, 'COMPLETE'), 'retained old marker');
    fs.writeFileSync(path.join(root, 'deploy/verify_upgrade_backup.sh'), '#!/bin/bash\nexit 17\n');
    const result = invoke('create_recovery_point.sh'); expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('Verified standalone recovery point:'); expect(state().running).toBe(true);
    expect(fs.readFileSync(path.join(old, 'COMPLETE'), 'utf8')).toBe('retained old marker');
    const points = fs.readdirSync(path.join(root, 'backups')).filter(name => name !== path.basename(old)); expect(points).toHaveLength(1);
    expect(fs.existsSync(path.join(root, 'backups', points[0], 'COMPLETE'))).toBe(false);
});

test('standalone recovery refuses to restart an API that becomes paused during capture', () => {
    setState({ statusAfterImage: 'paused' }); const result = invoke('create_recovery_point.sh');
    expect(result.status).not.toBe(0); expect(result.stdout).not.toContain('Verified standalone recovery point:');
    expect(state().status).toBe('paused'); expect(calls().filter(c => c[0] === 'start')).toEqual([]);
    const points = fs.readdirSync(path.join(root, 'backups')); expect(points).toHaveLength(1);
    expect(invoke('verify_upgrade_backup.sh', [path.join(root, 'backups', points[0])]).status).toBe(0);
});

test.each(['failImage', 'failDump', 'failJournal'])('failed %s capture preserves the original API and leaves no completed point', failure => {
    setState({ [failure]: true }); const result = invoke('create_recovery_point.sh');
    expect(result.status).not.toBe(0); expect(result.stdout).not.toContain('Verified standalone recovery point:'); expect(state().running).toBe(true);
    for (const name of fs.readdirSync(path.join(root, 'backups'))) expect(fs.existsSync(path.join(root, 'backups', name, 'COMPLETE'))).toBe(false);
});

test('failed original API restart reports failure while preserving the verified recovery set', () => {
    setState({ failStart: true }); const result = invoke('create_recovery_point.sh');
    expect(result.status).not.toBe(0); expect(result.stdout).not.toContain('Verified standalone recovery point:'); expect(state().running).toBe(false);
    const points = fs.readdirSync(path.join(root, 'backups')).filter(name => name.startsWith('save-upgrade-')); expect(points).toHaveLength(1);
    expect(invoke('verify_upgrade_backup.sh', [path.join(root, 'backups', points[0])]).status).toBe(0);
    expect(calls().filter(c => c[0] === 'start')).toHaveLength(1);
});

test('failed completion durability leaves no completed point and restores the original API', () => {
    setState({ failSyncAt: 2 }); const result = invoke('backup_before_upgrade.sh');
    expect(result.status).not.toBe(0); expect(state().running).toBe(true);
    const points = fs.readdirSync(path.join(root, 'backups')).filter(name => name.startsWith('save-upgrade-')); expect(points).toHaveLength(1);
    expect(fs.existsSync(path.join(root, 'backups', points[0], 'COMPLETE'))).toBe(false);
});
