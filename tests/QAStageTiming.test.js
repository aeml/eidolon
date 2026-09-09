import { spawnSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';

const helper = fileURLToPath(new URL('../scripts/qa-stage-timing.sh', import.meta.url));
const invoke = (...args) => spawnSync('bash', ['-c',
    'set -e; source "$1"; shift; run_qa_stage "$@"', 'qa-timing', helper, ...args],
{ encoding: 'utf8', timeout: 5000 });
const events = result => result.stdout.split('\n').filter(line => line.startsWith('[qa-stage] '))
    .map(line => JSON.parse(line.slice('[qa-stage] '.length)));

test.each([0, 1, 23])('records and preserves command exit status %i under errexit', status => {
    const result = invoke('sample', 'bash', '-c', `exit ${status}`);
    expect(result.status).toBe(status);
    expect(events(result)).toEqual([
        { stage: 'sample', event: 'start' },
        { stage: 'sample', event: 'end', status, seconds: expect.any(Number) }
    ]);
    expect(events(result)[1].seconds).toBeGreaterThanOrEqual(0);
});

test('does not expose command arguments while retaining their exit status', () => {
    const result = invoke('private-input', 'bash', '-c', 'test "$1" = fake-private-value; exit 7',
        'test-child', 'fake-private-value');
    expect(result.status).toBe(7);
    expect(result.stdout + result.stderr).not.toContain('fake-private-value');
});

test.each(['bad\nlabel', 'quote"label', '../path', 'a'.repeat(65), ''])('rejects unsafe label %j without running a command', label => {
    const result = invoke(label, 'printf', 'command-executed');
    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain('command-executed');
    expect(events(result)).toEqual([]);
});

test('requires a command', () => {
    expect(invoke('missing-command').status).toBe(2);
});

test('records shell-function failures and preserves the runner AND-chain stop', () => {
    const result = spawnSync('bash', ['-c', `
        set -e
        source "$1"
        fails() { return 19; }
        run_qa_stage failed-route fails && run_qa_stage must-not-run printf leaked
    `, 'qa-timing', helper], { encoding: 'utf8', timeout: 5000 });
    expect(result.status).toBe(19);
    expect(events(result)).toHaveLength(2);
    expect(events(result)[1]).toMatchObject({ stage: 'failed-route', status: 19 });
    expect(result.stdout).not.toContain('must-not-run');
    expect(result.stdout).not.toContain('leaked');
});

test('nested stage timing does not overwrite the outer label', () => {
    const result = spawnSync('bash', ['-c', `
        source "$1"
        nested() { run_qa_stage inner bash -c 'exit 0'; }
        run_qa_stage outer nested
    `, 'qa-timing', helper], { encoding: 'utf8', timeout: 5000 });
    expect(result.status).toBe(0);
    expect(events(result).map(event => [event.stage, event.event])).toEqual([
        ['outer', 'start'], ['inner', 'start'], ['inner', 'end'], ['outer', 'end']
    ]);
});
