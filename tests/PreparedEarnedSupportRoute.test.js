import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
const body = script.match(/run_prepared_earned_support\(\) \{\n[\s\S]*?\n\}/)[0];
function run(failClass = '') {
    return spawnSync('bash', ['-c', `${body}
        QA_USERNAME_BASE=prepared-support-fixture
        npx() {
            printf '%s|%s|%s|%s\\n' "$EIDOLON_E2E_USERNAME" "$EIDOLON_E2E_CLASS" "$EIDOLON_E2E_PREPARED_SUPPORT" "$*"
            if [[ "$EIDOLON_E2E_CLASS" == "$FAIL_CLASS" ]]; then return 19; fi
        }
        run_prepared_earned_support
    `], { encoding: 'utf8', timeout: 5000, env: { PATH: process.env.PATH, FAIL_CLASS: failClass } });
}

test('prepared support runs separate allowlisted actors with zero retries and scoped artifacts', () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split('\n')).toEqual(['Rogue', 'Cleric'].map(name =>
        `prepared-support-fixture-${name.toLowerCase()}|${name}|1|playwright test --retries=0 --output=test-results/prepared-support-${name.toLowerCase()} tests/e2e/prepared-earned-support.spec.js`));
    for (const suffix of ['rogue', 'cleric']) expect(script).toContain(`\${QA_USERNAME_BASE}-${suffix}`);
    expect(script).toContain('prepared-earned-support)\n    run_prepared_earned_support');
});
test.each(['Rogue', 'Cleric'])('prepared support preserves %s failure and stops the chain', name => {
    const result = run(name);
    expect(result.status).toBe(19);
    expect(result.stdout.trim().split('\n')).toHaveLength(name === 'Rogue' ? 1 : 2);
});
test('prepared casts stay opt-in and are not inserted into the earned or release chains', () => {
    const spec = readFileSync('tests/e2e/prepared-earned-support.spec.js', 'utf8');
    expect(spec.indexOf("process.env.EIDOLON_E2E_PREPARED_SUPPORT !== '1'"))
        .toBeLessThan(spec.indexOf('await loginAndEnterWorld('));
    expect(script.match(/run_prepared_earned_support/g)).toHaveLength(2); // Definition and explicit case only.
    expect(spec).toContain('await driver(page, target)');
    expect(spec).toContain('expect(result?.accepted');
    expect(spec).toContain('h.kind === \'guardian_embrace\' && h.amount > 0');
});
