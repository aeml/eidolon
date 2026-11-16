import { afterEach, beforeEach, expect, test } from '@jest/globals';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { browserSmokeBaselineFiles, buildBrowserSmokePlan } from '../../../../scripts/qa/browser-smoke-plan.mjs';

const catalog = JSON.parse(readFileSync('scripts/qa/e2e-suites.json', 'utf8'));
let directory;
beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'eidolon-partition-verifier-test-'));
    mkdirSync(join(directory, 'scripts/qa'), { recursive: true });
    mkdirSync(join(directory, 'node_modules/@playwright/test'), { recursive: true });
    for (const name of ['verify-browser-smoke-partition.mjs', 'browser-smoke-plan.mjs',
        'browser-smoke-coverage.mjs', 'e2e-suite-catalog.mjs', 'e2e-suites.json']) {
        copyFileSync(`scripts/qa/${name}`, join(directory, 'scripts/qa', name));
    }
    // A real package manifest contains no suite catalog at its top level.
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ type: 'module' }));
    // Discovery fixture only: no browser, server or account is started.
    writeFileSync(join(directory, 'node_modules/@playwright/test/cli.js'), `
        import { appendFileSync } from 'node:fs';
        const args = process.argv.slice(2);
        appendFileSync('invocations.jsonl', JSON.stringify(args) + '\\n');
        const shard = args.find(arg => arg.startsWith('--shard='));
        const partition = shard ? Number(shard.split('=')[1].split('/')[0]) - 1 : null;
        const grouped = args.some(arg => arg.startsWith('--output='));
        const files = args.filter(arg => arg.startsWith('tests/e2e/'));
        console.log(JSON.stringify({ suites: files.map(file => ({ title: file,
            specs: [0, 1, 2].filter(index => partition === null || index === partition)
                .filter(index => !(process.env.EIDOLON_TEST_OMIT_CASE && grouped &&
                    file === 'tests/e2e/account/owner-export-download.spec.js' && index === 0))
                .map(index => ({ file, title: 'case ' + index, tests: [{ projectName: 'chromium' }] }))
        })) }));
    `);
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

const run = (env = {}) => spawnSync(process.execPath, ['scripts/qa/verify-browser-smoke-partition.mjs'], {
    cwd: directory, encoding: 'utf8', timeout: 15_000, env: { ...process.env, ...env }
});

test('the CI verifier reads the suite catalog and discovers the complete three-shard partition', () => {
    const result = run();
    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    const calls = readFileSync(join(directory, 'invocations.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    const baseline = browserSmokeBaselineFiles(catalog);
    const stages = [1, 2, 3].flatMap(shard => buildBrowserSmokePlan(catalog, shard));
    expect(calls).toEqual([['test', ...baseline], ...stages.map(stage => stage.args)]
        .map(args => [...args, '--list', '--reporter=json']));
    expect(result.stdout).toContain(`Exact browser case union verified: ${baseline.length * 3} cases, no omissions or duplicates.`);
});

test('the CI verifier rejects a case missing from the discovered partition', () => {
    const result = run({ EIDOLON_TEST_OMIT_CASE: '1' });
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Browser coverage mismatch: missing=1, unexpected=0');
    expect(result.stdout).not.toContain('Exact browser case union verified:');
});
