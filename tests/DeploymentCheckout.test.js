import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
// Execute the actual SSH checkout segment against disposable local repositories.
const checkout = workflow.split('# DEPLOY_CHECKOUT_BEGIN:')[1]
    .split('\n').slice(1).join('\n').split('# DEPLOY_CHECKOUT_END')[0];
let directory, source, deployed, testedCommit, newerCommit;

function git(cwd, ...args) {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
}

beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'eidolon-checkout-test-'));
    source = path.join(directory, 'source');
    deployed = path.join(directory, 'deployed');
    mkdirSync(source);
    git(source, 'init', '--initial-branch=master');
    git(source, 'config', 'user.name', 'Release Test');
    git(source, 'config', 'user.email', 'release-test@example.invalid');
    writeFileSync(path.join(source, 'game.txt'), 'tested release\n');
    git(source, 'add', 'game.txt');
    git(source, 'commit', '-m', 'tested release');
    testedCommit = git(source, 'rev-parse', 'HEAD');
    git(directory, 'clone', source, deployed);
    writeFileSync(path.join(source, 'game.txt'), 'later push\n');
    git(source, 'commit', '-am', 'later push');
    newerCommit = git(source, 'rev-parse', 'HEAD');
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

function run(commit = testedCommit, branch = 'master') {
    return spawnSync('bash', ['-euo', 'pipefail', '-c', checkout], {
        cwd: deployed,
        env: { ...process.env, COMMIT_SHA: commit, REF_NAME: branch },
        encoding: 'utf8'
    });
}

test('a newer branch tip does not replace the tested commit', () => {
    git(deployed, 'fetch', 'origin', 'master');
    git(deployed, 'checkout', '--detach', newerCommit);
    writeFileSync(path.join(deployed, 'operator-note.txt'), 'preserve untracked data');
    expect(run().status).toBe(0);
    expect(git(deployed, 'rev-parse', 'HEAD')).toBe(testedCommit);
    expect(readFileSync(path.join(deployed, 'game.txt'), 'utf8')).toBe('tested release\n');
    expect(readFileSync(path.join(deployed, 'operator-note.txt'), 'utf8')).toBe('preserve untracked data');
    expect(run(newerCommit).status).toBe(0);
    expect(git(deployed, 'rev-parse', 'HEAD')).toBe(newerCommit);
});

test.each([false, true])('tracked local changes are preserved (staged=%s)', staged => {
    writeFileSync(path.join(deployed, 'game.txt'), 'operator change\n');
    if (staged) git(deployed, 'add', 'game.txt');
    const result = run(newerCommit);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('tracked local changes');
    expect(readFileSync(path.join(deployed, 'game.txt'), 'utf8')).toBe('operator change\n');
});

test('a commit outside the fetched production branch is rejected', () => {
    git(source, 'checkout', '--orphan', 'unrelated');
    git(source, 'commit', '-am', 'unrelated history');
    const unrelated = git(source, 'rev-parse', 'HEAD');
    git(deployed, 'fetch', 'origin', 'unrelated');
    const result = run(unrelated);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('not in the fetched production branch');
    expect(git(deployed, 'rev-parse', 'HEAD')).toBe(testedCommit);
});

test.each([['master', 'master'], ['a'.repeat(40), 'untrusted']])(
    'rejects invalid release input %s / %s before checkout', (commit, branch) => {
        expect(run(commit, branch).status).not.toBe(0);
        expect(git(deployed, 'rev-parse', 'HEAD')).toBe(testedCommit);
    }
);
