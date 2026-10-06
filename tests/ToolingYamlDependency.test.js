import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { loadNycConfig } = require('@istanbuljs/load-nyc-config');
const yamlRequire = createRequire(require.resolve('@istanbuljs/load-nyc-config'));

describe('coverage YAML dependency compatibility', () => {
    let fixture;
    beforeEach(() => { fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'eidolon-nyc-yaml-')); });
    afterEach(() => { fs.rmSync(fixture, { recursive: true, force: true }); });

    test('removes vulnerable sprintf-js without downgrading Jest', () => {
        const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
        expect(Object.keys(lock.packages).some(name => name.endsWith('/sprintf-js'))).toBe(false);
        expect(require('jest/package.json').version).toMatch(/^30\./);
        expect(yamlRequire('js-yaml/package.json').version).toBe('4.3.2');
    });

    test('loads real NYC YAML configuration and inherited options', async () => {
        fs.writeFileSync(path.join(fixture, 'base.yml'), 'check-coverage: true\nbranches: 80\n');
        fs.writeFileSync(path.join(fixture, '.nycrc.yml'),
            'extends: ./base.yml\nreporter: [text, lcov]\ninclude: src/**/*.js\nexclude: [tests/**]\n');
        const config = await loadNycConfig({ cwd: fixture, nycrcPath: '.nycrc.yml' });
        expect(config).toMatchObject({ cwd: fixture, checkCoverage: true, branches: 80,
            reporter: ['text', 'lcov'], include: ['src/**/*.js'], exclude: ['tests/**'] });
    });

    test('rejects malformed YAML instead of silently ignoring configuration', async () => {
        fs.writeFileSync(path.join(fixture, '.nycrc.yml'), 'reporter: [text\n');
        await expect(loadNycConfig({ cwd: fixture, nycrcPath: '.nycrc.yml' })).rejects.toThrow();
    });

    test('retains a working YAML CLI with its compatible argument parser', () => {
        const bin = path.join(path.dirname(yamlRequire.resolve('js-yaml/package.json')), 'bin/js-yaml.js');
        const result = spawnSync(process.execPath, [bin, '--help'], { encoding: 'utf8', timeout: 5000 });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('usage:');
        expect(result.stderr).toBe('');
    });
});
