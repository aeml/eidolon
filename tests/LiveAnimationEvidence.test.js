import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function invoke(failCall = 0) {
    return spawnSync('bash', ['-c', `
        calls=0
        npx() {
            calls=$((calls+1))
            printf 'REPORT %s OUTPUT %s\\n' "$PLAYWRIGHT_HTML_OUTPUT_DIR" "$*"
            if [ "$calls" = "$FAIL_CALL" ]; then return 23; fi
            return 0
        }
        source "$1"
    `, 'live-animation-evidence-harness', 'scripts/run-live-animation-qa.sh'], {
        encoding:'utf8', timeout:5000,
        env:{...process.env, FAIL_CALL:String(failCall), PLAYWRIGHT_HTML_OUTPUT_DIR:'', EIDOLON_E2E_USERNAME:'dedicated-fixture',
            EIDOLON_E2E_PASSWORD:'fake-fixture-password', EIDOLON_E2E_BASE_URL:'https://example.invalid',
            EIDOLON_E2E_WS_URL:'wss://example.invalid/ws'}
    });
}

const calls = result => result.stdout.split('\n').filter(line=>line.startsWith('REPORT '));

test('all four live classes and the remote matrix retain separate reports and artifacts', () => {
    const result = invoke();
    expect(result.status).toBe(0);
    const routes = ['fighter','rogue','wizard','cleric','remote'];
    expect(calls(result)).toHaveLength(routes.length);
    for (const [index, route] of routes.entries()) {
        const call = calls(result)[index];
        expect(call).toContain(`REPORT playwright-report/live-${route} OUTPUT `);
        expect(call).toContain(`--output=test-results/live-${route}`);
        expect(call).toContain(route === 'remote' ? 'tests/e2e/multiplayer.spec.js' : 'tests/e2e/animation-gameplay.spec.js');
    }
    expect(result.stdout + result.stderr).not.toContain('fake-fixture-password');
});

test.each([1,2,3,4,5])('failed stage %s stops the wrapper without losing its exit code', fail => {
    const result = invoke(fail);
    expect(result.status).toBe(23);
    expect(calls(result)).toHaveLength(fail);
    expect(result.stdout).not.toContain('QA passed.');
});

test('existing upload and sanitizer roots include the retained nested reports', () => {
    const sanitizer = readFileSync('scripts/sanitize-playwright-artifacts.mjs','utf8');
    expect(sanitizer).toContain("['playwright-report', 'test-results']");
    expect(sanitizer).toContain('entry.isDirectory() ? filesBelow(entryPath)');
    const live = readFileSync('.github/workflows/ci.yml','utf8').split('  post-deploy-browser:')[1];
    expect(live).toContain('playwright-report/');
    expect(live).toContain('test-results/');
    expect(live).toContain("steps.sanitize_evidence.outcome == 'success'");
    const recovery = readFileSync('scripts/run-live-recovery-qa.sh','utf8');
    expect(recovery).toContain('--reporter=line --output=test-results/live-rest-journey');
    expect(recovery).toContain('--reporter=line --output=test-results/live-rest-party');
});
