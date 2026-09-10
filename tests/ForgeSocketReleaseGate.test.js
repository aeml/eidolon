import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const wrapper = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
const helper = wrapper.slice(wrapper.indexOf('run_forge_socket_appearance() {'),
    wrapper.indexOf('\nrun_talent_economy() {'));

test.each([0, 23])('socket native gate uses dedicated accounts and propagates exit %i', status => {
    const result = spawnSync('bash', ['-c', `
        QA_USERNAME_BASE=dedicated
        QA_PASSWORD=fixture-password
        MONGO_CONTAINER=eidolon-isolated-qa-mongo-fixture
        mongo_port=18581
        npx() {
            printf '%s\\n' "$EIDOLON_E2E_USERNAME" "$EIDOLON_E2E_USERNAME_SECONDARY" \
                "$EIDOLON_E2E_PASSWORD_SECONDARY" "$EIDOLON_E2E_SOCKET_MONGO_CONTAINER" \
                "$EIDOLON_E2E_SOCKET_MONGO_PORT" "$*"
            return ${status}
        }
        ${helper}
        run_forge_socket_appearance
    `], { encoding: 'utf8', timeout: 5000 });
    expect(result.status).toBe(status);
    expect(result.stdout.split('\n')).toEqual([
        'dedicated-socket-owner', 'dedicated-socket-observer', 'fixture-password',
        'eidolon-isolated-qa-mongo-fixture', '18581',
        'playwright test --retries=0 --output=test-results/forge-socket-appearance tests/e2e/forge-socket-appearance.spec.js', ''
    ]);
});

test('full predeploy requires socket verification after earlier gates, with isolated actor allowlisting', () => {
    const all = wrapper.split('  all)')[1].split('    ;;')[0];
    expect(all.trim()).toMatch(/&& run_well_rested && run_forge_socket_appearance$/);
    expect(all).not.toMatch(/\|\| true/);
    expect(wrapper).toContain('${QA_USERNAME_BASE}-socket-owner,${QA_USERNAME_BASE}-socket-observer');
    expect(wrapper.split('  forge-socket-appearance)')[1].split('    ;;')[0].trim()).toBe('run_forge_socket_appearance');
});
