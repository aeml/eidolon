import { afterEach, beforeEach, expect, test } from '@jest/globals';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { suiteFiles } from '../../../../scripts/qa/e2e-suite-catalog.mjs';

const catalog = JSON.parse(readFileSync('scripts/qa/e2e-suites.json', 'utf8'));
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
let directory;
beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'eidolon-suite-test-'));
    mkdirSync(join(directory, 'scripts/qa'), { recursive: true });
    mkdirSync(join(directory, 'node_modules/@playwright/test'), { recursive: true });
    for (const file of ['run-e2e-suite.mjs', 'e2e-suite-catalog.mjs', 'e2e-suites.json']) {
        copyFileSync(`scripts/qa/${file}`, join(directory, 'scripts/qa', file));
    }
    writeFileSync(join(directory, 'node_modules/@playwright/test/cli.js'), `
        console.log(JSON.stringify({args: process.argv.slice(2), marker: process.env.SUITE_MARKER}));
        if (process.env.SUITE_SIGNAL) process.kill(process.pid, 'SIGTERM');
        else process.exit(Number(process.env.SUITE_STATUS || 0));
    `);
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));
function run(args, env = {}) {
    return spawnSync(process.execPath, ['scripts/qa/run-e2e-suite.mjs', ...args],
        { cwd: directory, encoding: 'utf8', env: { ...process.env, SUITE_MARKER: 'preserved', ...env } });
}

test.each(Object.keys(catalog))('%s keeps its npm entry, existing files and exact CLI argument order', name => {
    expect(manifest.scripts[`test:e2e:${name}`]).toBe(`node scripts/qa/run-e2e-suite.mjs ${name}`);
    const files = suiteFiles(catalog, name);
    for (const file of files) expect(existsSync(file)).toBe(true);
    const options = ['--workers=1', '--grep', 'two words', '--output=custom/results'];
    const result = run([name, ...options]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ args: ['test', ...files, ...options], marker: 'preserved' });
    files.pop();
    expect(catalog[name].length).toBe(files.length + 1);
});

test('unknown/missing suites fail before starting Playwright', () => {
    for (const args of [[], ['missing'], ['toString']]) {
        const result = run(args);
        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe('');
    }
});

test('empty, duplicate, malformed and shell-like entries fail closed', () => {
    for (const files of [[], 'not-an-array', [null], ['--grep'], ['../private.spec.js'],
        ['tests/e2e/account/anonymous.spec.js', 'tests/e2e/account/anonymous.spec.js']]) {
        expect(() => suiteFiles({ bad: files }, 'bad')).toThrow('bad');
    }
});

test('failed and interrupted browser processes never report success', () => {
    expect(run(['privacy'], { SUITE_STATUS: '7' }).status).toBe(7);
    expect(run(['privacy'], { SUITE_SIGNAL: '1' }).status).toBe(1);
});
