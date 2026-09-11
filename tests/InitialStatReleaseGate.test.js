import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const wrapper = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
const helper = wrapper.match(/^run_initial_stats\(\) \{[\s\S]*?^\}/m)?.[0] || '';

test.each([0, 23])('initial-stat gate opts into native checks and preserves exit %i', status => {
    const result = spawnSync('bash', ['-c', `
        npx() { printf '%s\\n' "$EIDOLON_E2E_INITIAL_STAT_PARITY" "$*"; return ${status}; }
        ${helper}
        run_initial_stats
    `], { encoding: 'utf8', timeout: 5000 });
    expect(result.status).toBe(status);
    expect(result.stdout.split('\n')).toEqual(['1',
        'playwright test --retries=0 --output=test-results/initial-stat-parity tests/e2e/initial-stat-parity.spec.js', '']);
});

test('full release sequence and focused route use the same initial-stat check', () => {
    const all = wrapper.split('\n  all)')[1].split('\n    ;;')[0].trim();
    expect(all).toMatch(/^run_initial_stats && npm run test:e2e:authenticated && /);
    expect(all).toContain('run_well_rested && run_forge_socket_appearance');
    expect(wrapper.split('\n  initial-stats)')[1].split('\n    ;;')[0].trim()).toBe('run_initial_stats');
    for (const className of ['fighter', 'rogue', 'wizard', 'cleric']) {
        expect(wrapper).toContain('${QA_USERNAME_BASE}-baseline-' + className);
    }
});
