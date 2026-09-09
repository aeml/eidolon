import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const script = 'scripts/run-live-recovery-qa.sh';
const invoke = (overrides = {}) => spawnSync('bash', ['-c', `
    calls=0
    node() {
        if [ "$1" = scripts/sanitize-playwright-artifacts.mjs ]; then
            printf 'SCAN %s %s\\n' "$2" "$3"
            return "$SCAN_STATUS"
        fi
        command node "$@"
    }
    npx() {
        calls=$((calls + 1))
        printf 'RUN %s %s %s %s\\n' "$EIDOLON_E2E_USERNAME" "$EIDOLON_E2E_CLASS" "$EIDOLON_E2E_REGISTER" "$*"
        if [ "$calls" = "$FAIL_CALL" ]; then return 23; fi
    }
    source "$1"
`, 'live-recovery-harness', script], {
    encoding: 'utf8', timeout: 5000,
    env: { ...process.env, EIDOLON_E2E_USERNAME: 'dedicated-test-account',
        EIDOLON_E2E_PASSWORD: 'fake-private-password', EIDOLON_E2E_BASE_URL: 'https://example.invalid',
        EIDOLON_E2E_WS_URL: 'wss://example.invalid/ws', EIDOLON_EXPECTED_COMMIT: 'a'.repeat(40),
        FAIL_CALL: '0', SCAN_STATUS: '0', ...overrides }
});
const runs = result => result.stdout.split('\n').filter(line => line.startsWith('RUN '));

test('live recovery runs all three native routes with fresh ordinary users and retained evidence', () => {
    const result = invoke();
    expect(result.status).toBe(0);
    const calls = runs(result);
    expect(calls).toHaveLength(2);
    const owner = calls[0].split(' ')[1];
    expect(owner).toMatch(/^dedica-r-[a-f0-9]{12}$/);
    expect(`${owner}-party-ally`.length).toBeLessThanOrEqual(32);
    expect(calls[0]).toContain(`${owner} Wizard 1 --no-install playwright test tests/e2e/well-rested-gameplay.spec.js tests/e2e/well-rested-expiry-gameplay.spec.js`);
    expect(calls[1]).toContain(`${owner}-party Wizard 1 --no-install playwright test tests/e2e/well-rested-party-gameplay.spec.js`);
    for (const call of calls) expect(call).toContain('--retries=0 --reporter=line --output=test-results/live-rest-');
    expect(result.stdout).toContain('SCAN test-results/live-rest-journey test-results/live-rest-party');
    expect(result.stdout + result.stderr).not.toContain('fake-private-password');
    expect(runs(invoke())[0].split(' ')[1]).not.toBe(owner);
});

test.each([1, 2])('route %i failure preserves its status, stops later routes and still scans evidence', fail => {
    const result = invoke({ FAIL_CALL: String(fail) });
    expect(result.status).toBe(23);
    expect(runs(result)).toHaveLength(fail);
    expect(result.stdout).toContain('SCAN ');
    expect(result.stdout).not.toContain('QA passed.');
});

test('artifact sanitation failure fails the gate', () => {
    const result = invoke({ SCAN_STATUS: '9' });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('QA passed.');
});

test.each(['EIDOLON_E2E_USERNAME', 'EIDOLON_E2E_PASSWORD', 'EIDOLON_E2E_BASE_URL',
    'EIDOLON_E2E_WS_URL', 'EIDOLON_EXPECTED_COMMIT'])('missing %s fails before browser execution', name => {
    const result = invoke({ [name]: '' });
    expect(result.status).not.toBe(0);
    expect(runs(result)).toHaveLength(0);
});

test.each([{ EIDOLON_E2E_USERNAME: 'bad name' }, { EIDOLON_EXPECTED_COMMIT: 'short' }])(
    'invalid identity refuses execution: %j', overrides => {
        const result = invoke(overrides);
        expect(result.status).toBe(2);
        expect(runs(result)).toHaveLength(0);
    });

test('post-deployment recovery is mandatory after matching identity and before artifact sanitation', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const live = workflow.slice(workflow.indexOf('  post-deploy-browser:'));
    const position = live.indexOf('- name: Run live town recovery and Well Rested QA');
    expect(position).toBeGreaterThan(live.indexOf('- name: Wait for matching live releases'));
    expect(position).toBeLessThan(live.indexOf('- name: Sanitize live browser evidence'));
    const step = live.slice(position, live.indexOf('- name: Sanitize live browser evidence'));
    expect(step).toContain("run: sg render -c 'bash scripts/run-live-recovery-qa.sh'");
    expect(step).toContain('EIDOLON_EXPECTED_COMMIT: ${{ github.sha }}');
    expect(step).not.toContain('continue-on-error');
    expect(step).not.toContain('if:');
});

test('disposable rehearsal runs the same live wrapper without changing the default full gate', () => {
    const isolated = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const route = isolated.split('  live-recovery-rehearsal)')[1].split('    ;;')[0];
    expect(route).toContain('EIDOLON_E2E_BASE_URL="http://127.0.0.1:${EIDOLON_E2E_WEB_PORT:-4173}"');
    expect(route).toContain('EIDOLON_EXPECTED_COMMIT="${QA_SOURCE_COMMIT}" bash scripts/run-live-recovery-qa.sh');
    expect(route).not.toContain('EIDOLON_QA_USERNAMES');
    expect(route).not.toContain('npx');
});
