import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const scanner = path.resolve('scripts/sanitize-playwright-artifacts.mjs');
const helper = path.resolve('scripts/qa-evidence.sh');
const password = 'owned-fixture-password-only', username = 'owned-fixture-account-only';
const roots = [];
const temporary = () => { const root = mkdtempSync(path.join(os.tmpdir(), 'eidolon-qa-evidence-')); roots.push(root); return root; };
const env = () => ({ ...process.env, PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
    EIDOLON_E2E_USERNAME: username, EIDOLON_E2E_PASSWORD: password, EIDOLON_E2E_USERNAME_SECONDARY: '', EIDOLON_E2E_PASSWORD_SECONDARY: '' });
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test('an explicit JSON report file is sanitized without scanning its neighboring files', () => {
    const root = temporary(), report = path.join(root, 'result.json'), neighbor = path.join(root, 'unrelated.json');
    for (const file of [report, neighbor]) writeFileSync(file, JSON.stringify({ password }));
    const run = spawnSync(process.execPath, [scanner, report], { cwd: root, env: env(), encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(readFileSync(report, 'utf8')).not.toContain(password);
    expect(readFileSync(neighbor, 'utf8')).toContain(password);
});

test.each(['separate', 'equals'])('isolated QA sanitizes configured HTML/JSON and the final CLI output (%s)', form => {
    const root = temporary(), html = path.join(root, 'html report'), results = path.join(root, 'actual results');
    const discarded = path.join(root, 'unused output'), defaults = path.join(root, 'test-results');
    for (const dir of [html, results, discarded, defaults]) mkdirSync(dir);
    const htmlFile = path.join(html, 'index.html'), resultFile = path.join(results, 'steps.log');
    const jsonFile = path.join(root, 'separate-report.json'), defaultFile = path.join(defaults, 'original.log');
    const otherFile = path.join(discarded, 'untouched.log');
    writeFileSync(htmlFile, `<p>${password}</p>`); writeFileSync(resultFile, username);
    writeFileSync(jsonFile, JSON.stringify({ password })); writeFileSync(defaultFile, username); writeFileSync(otherFile, password);
    const output = form === 'equals' ? [`--output=${results}`] : ['--output', results];
    const run = spawnSync('bash', ['-c', 'source "$1"; shift; sanitize_isolated_qa_evidence "$@"',
        'qa-evidence-test', helper, `--output=${discarded}`, '--workers=1', ...output], {
        cwd: root, env: { ...env(), PLAYWRIGHT_HTML_OUTPUT_DIR: html, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile }, encoding: 'utf8'
    });
    expect(run.status).toBe(0);
    for (const file of [htmlFile, resultFile, jsonFile, defaultFile]) {
        const text = readFileSync(file, 'utf8'); expect(text).not.toContain(password); expect(text).not.toContain(username);
    }
    expect(readFileSync(otherFile, 'utf8')).toContain(password);
});
