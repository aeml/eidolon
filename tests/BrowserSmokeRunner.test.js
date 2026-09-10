import { afterEach, beforeEach, expect, test } from '@jest/globals';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildBrowserSmokePlan } from '../scripts/browser-smoke-plan.mjs';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
let directory;
beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'eidolon-browser-runner-test-'));
    mkdirSync(join(directory, 'scripts'));
    mkdirSync(join(directory, 'node_modules/@playwright/test'), { recursive: true });
    for (const name of ['run-browser-smoke.mjs', 'browser-smoke-plan.mjs']) {
        copyFileSync(`scripts/${name}`, join(directory, 'scripts', name));
    }
    writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest));
    // Exercise the real orchestration process, not a browser or fixture account.
    writeFileSync(join(directory, 'node_modules/@playwright/test/cli.js'), `
        import { appendFileSync } from 'node:fs';
        const args = process.argv.slice(2);
        const stage = args.find(arg => arg.startsWith('--output=')).split('/').at(-1);
        appendFileSync('invocations.jsonl', JSON.stringify({ args, stage,
            report: process.env.PLAYWRIGHT_HTML_OUTPUT_DIR,
            open: process.env.PLAYWRIGHT_HTML_OPEN }) + '\\n');
        if (stage === process.env.EIDOLON_TEST_FAIL_STAGE) process.exit(7);
        if (stage === process.env.EIDOLON_TEST_SIGNAL_STAGE) process.kill(process.pid, 'SIGTERM');
    `);
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

const run = (args, env = {}) => spawnSync(process.execPath,
    ['scripts/run-browser-smoke.mjs', ...args], {
        cwd: directory, encoding: 'utf8', timeout: 15_000,
        env: { ...process.env, ...env }
    });
const calls = () => readFileSync(join(directory, 'invocations.jsonl'), 'utf8')
    .trim().split('\n').map(line => JSON.parse(line));

test.each([1, 2, 3])('real shard %i runner invokes every stage with distinct evidence paths', shard => {
    const result = run([String(shard)]);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const plan = buildBrowserSmokePlan(manifest, shard);
    expect(calls()).toEqual(plan.map(stage => ({ args: stage.args, stage: stage.name,
        report: stage.env.PLAYWRIGHT_HTML_OUTPUT_DIR, open: 'never' })));
});

test.each([1, 2, 3].flatMap(shard => buildBrowserSmokePlan(manifest, shard)
    .map((stage, index) => [shard, stage.name, index])))(
    'failure in shard %i stage %s preserves status and stops subsequent processes', (shard, name, index) => {
    const result = run([String(shard)], { EIDOLON_TEST_FAIL_STAGE: name });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(7);
    expect(calls().map(call => call.stage)).toEqual(
        buildBrowserSmokePlan(manifest, shard).slice(0, index + 1).map(stage => stage.name));
});

test('a signaled child cannot advance the release gate or report success', () => {
    const result = run(['2'], { EIDOLON_TEST_SIGNAL_STAGE: 'entrances' });
    expect(result.status).toBe(1);
    expect(calls().map(call => call.stage)).toEqual(['layout', 'entrances']);
    expect(result.stdout).toContain('status=interrupted');
});

test('plan mode validates without launching children; malformed arguments fail', () => {
    const result = run(['2', '--plan']);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(buildBrowserSmokePlan(manifest, 2));
    expect(() => calls()).toThrow();
    for (const args of [[], ['4'], ['1', '--skip'], ['1', '--plan', 'extra']]) {
        expect(run(args).status).not.toBe(0);
        expect(() => calls()).toThrow();
    }
});
