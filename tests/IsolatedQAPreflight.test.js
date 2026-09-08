import { mkdtempSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('a missing browser runtime fails before Docker or credential creation', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'eidolon-qa-runtime-preflight-'));
    try {
        const result = spawnSync('/bin/bash', [path.resolve('scripts/run-isolated-character-qa.sh')], {
            cwd: directory, env: { PATH: '/nonexistent' }, encoding: 'utf8', timeout: 5000
        });
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Missing browser runtime vendor/manifest.json');
        expect(result.stderr).toContain('run npm run prepare:client first');
        expect(result.stderr).not.toContain('command not found');
    } finally { rmdirSync(directory); }
});
