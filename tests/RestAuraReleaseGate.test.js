import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const isolated = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
const invokeRender = (overrides = {}) => spawnSync('bash', ['-c', `
    npx() { printf 'RUN %s\\nJSON %s\\n' "$*" "$PLAYWRIGHT_JSON_OUTPUT_FILE"; return "$RENDER_STATUS"; }
    node() { printf 'SCAN %s\\n' "$*"; return "$SCAN_STATUS"; }
    source scripts/run-rest-render-qa.sh
`], { encoding: 'utf8', timeout: 5000,
    env: { ...process.env, RENDER_STATUS: '0', SCAN_STATUS: '0', ...overrides } });

test('required renderer wrapper runs all four tests once and preserves separate JSON/image evidence', () => {
    const result = invokeRender();
    expect(result.status).toBe(0);
    for (const file of ['well-rested-batching', 'well-rested-populated-render', 'well-rested-gpu-lifecycle']) {
        expect(result.stdout).toContain(`tests/e2e/${file}.spec.js`);
    }
    expect(result.stdout).toContain('--retries=0 --reporter=line,json --output=rest-render-results');
    expect(result.stdout).toContain(`JSON ${path.resolve('rest-render-results/results.json')}`);
    expect(result.stdout).toContain('SCAN scripts/sanitize-playwright-artifacts.mjs rest-render-results');
    expect(readFileSync('.gitignore', 'utf8').split('\n')).toContain('rest-render-results/');
});

test('renderer failure retains its exit status and still sanitizes', () => {
    const result = invokeRender({ RENDER_STATUS: '23' });
    expect(result.status).toBe(23); expect(result.stdout).toContain('SCAN ');
});

test.each(['0', '23'])('sanitation failure fails even after renderer status %s', status => {
    expect(invokeRender({ RENDER_STATUS: status, SCAN_STATUS: '9' }).status).toBe(1);
});

function invokeNative(fail = 0) {
    const functions = isolated.slice(isolated.indexOf('run_well_rested_transitions() {'), isolated.indexOf('\nset +e\ncase'));
    return spawnSync('bash', ['-c', `
        QA_USERNAME_BASE=dedicated
        calls=0
        npx() {
            calls=$((calls + 1))
            printf 'RUN %s %s %s %s\\n' "$EIDOLON_E2E_USERNAME" "$EIDOLON_E2E_CLASS" "$EIDOLON_E2E_REGISTER" "$*"
            if [ "$calls" = "$FAIL_CALL" ]; then return 23; fi
        }
        ${functions}
        run_well_rested
    `], { encoding: 'utf8', timeout: 5000, env: { ...process.env, FAIL_CALL: String(fail) } });
}

test('native full suffix preserves journey, expiry and party before mandatory transition checks', () => {
    const result = invokeNative();
    expect(result.status).toBe(0);
    const runs = result.stdout.split('\n').filter(line => line.startsWith('RUN '));
    expect(runs).toHaveLength(3);
    expect(runs[0]).toContain('dedicated-rest Wizard 1');
    expect(runs[0]).toContain('well-rested-gameplay.spec.js'); expect(runs[0]).toContain('well-rested-expiry-gameplay.spec.js');
    expect(runs[1]).toContain('dedicated-rest-party Wizard 1'); expect(runs[1]).toContain('well-rested-party-gameplay.spec.js');
    expect(runs[2]).toContain('dedicated-rest-transitions Wizard 1');
    expect(runs[2]).toContain('--output=test-results/well-rested-transitions');
    expect(runs[2]).toContain('well-rested-transitions-gameplay.spec.js --retries=0');
    expect(isolated.split('  all)')[1].split('    ;;')[0]).toMatch(
        /&&\s+run_qa_stage well-rested run_well_rested &&\s+run_qa_stage forge-socket-appearance run_forge_socket_appearance\s*$/);
    expect(isolated.split('  well-rested-transitions)')[1].split('    ;;')[0]).toContain('run_well_rested_transitions');
    expect(isolated).toContain('${QA_USERNAME_BASE}-rest-transitions-death,${QA_USERNAME_BASE}-rest-transitions-dungeon');
});

test.each([1, 2, 3])('native stage %i failure stops following stages and propagates status', fail => {
    const result = invokeNative(fail);
    expect(result.status).toBe(23);
    expect(result.stdout.split('\n').filter(line => line.startsWith('RUN '))).toHaveLength(fail);
});

test('full stabilization retains rendering while ordinary releases use focused smoke', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const predeploy = workflow.split('  predeploy-character:')[1].split('  release-inputs:')[0];
    const start = predeploy.indexOf('- name: Run required Well Rested rendering and GPU lifecycle QA');
    expect(start).toBeGreaterThan(predeploy.indexOf('- name: Run deterministic High/Low animation gallery'));
    const end = predeploy.indexOf('- name: Run disposable full-character gameplay');
    expect(start).toBeLessThan(end);
    const step = predeploy.slice(start, end);
    expect(step).toContain("run: sg render -c 'npm run test:e2e:rest-render'");
    expect(step).not.toContain('continue-on-error');
    expect(step).toContain("if: inputs.full_stabilization == true || vars.EIDOLON_FULL_STABILIZATION == 'true'");
    expect(predeploy).toContain("if: inputs.full_stabilization != true && vars.EIDOLON_FULL_STABILIZATION != 'true'");
    expect(predeploy).toContain('EIDOLON_ISOLATED_QA_ROUTE: release-smoke');
    const smoke = isolated.split('  release-smoke)')[1].split('    ;;')[0];
    expect(smoke).toContain('EIDOLON_E2E_FULL_GAMEPLAY=1 EIDOLON_E2E_PORTAL_ONLY=1');
    expect(smoke).toContain('--retries=0 tests/e2e/authenticated.spec.js tests/e2e/inventory-quality-of-life.spec.js');
    expect(predeploy).toContain('            rest-render-results/');
    const commands = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
    expect(commands['test:e2e:rest-render']).toBe('bash scripts/run-rest-render-qa.sh');
    // Prepared death/level setup belongs to disposable QA, not the ordinary live wrapper.
    expect(readFileSync('scripts/run-live-recovery-qa.sh', 'utf8')).not.toContain('well-rested-transitions');
});
